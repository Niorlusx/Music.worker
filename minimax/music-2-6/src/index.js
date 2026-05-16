import { createClient } from '@supabase/supabase-js';

/**
 * music-worker: A Cloudflare Worker for generating music using Minimax API and storing in R2.
 * Integrated with Supabase for persistent task tracking.
 */

export default {
	/**
	 * HTTP handler: Accepts music generation requests and pushes them to the queue.
	 */
	async fetch(req, env, ctx) {
		if (req.method !== 'POST') {
			return new Response('Please send a POST request with prompt and lyrics.', { status: 405 });
		}

		try {
			const body = await req.json().catch(() => ({}));
			const { prompt, lyrics, is_instrumental = false, telegram_chat_id } = body;

			if (!prompt && !lyrics) {
				return new Response(JSON.stringify({ error: 'Missing prompt or lyrics.' }), { 
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Initialize Supabase
			const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

			// 1. Log the new task to Supabase
			const { data: task, error: dbError } = await supabase
				.from('music_tasks')
				.insert([{
					prompt,
					lyrics,
					is_instrumental,
					status: 'queued',
					created_at: new Date().toISOString()
				}])
				.select()
				.single();

			if (dbError) {
				console.error('Supabase Error (Insert):', dbError.message);
			}

			// 2. Push to queue for background processing
			await env.MY_QUEUE.send({
				task_id: task ? task.id : null,
				prompt,
				lyrics,
				is_instrumental,
				telegram_chat_id,
				timestamp: new Date().toISOString(),
			});

			return new Response(JSON.stringify({ 
				message: 'Music generation request queued.',
				task_id: task ? task.id : 'logged locally'
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (err) {
			return new Response(JSON.stringify({ error: err.message }), { 
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	},

	/**
	 * Queue handler: Consumes requests, calls the Minimax API, and stores result in R2.
	 */
	async queue(batch, env) {
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

		for (let message of batch.messages) {
			let { task_id, prompt, lyrics, is_instrumental, telegram_chat_id } = message.body;
			console.log(`Processing music generation for prompt: ${prompt}`);

			try {
				// Update status to processing
				if (task_id) {
					await supabase.from('music_tasks').update({ status: 'processing' }).eq('id', task_id);
				}

				// 1. Use Grok API to optimize the prompt
				if (env.GROK_API_KEY) {
					try {
						const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
							method: 'POST',
							headers: {
								'Authorization': `Bearer ${env.GROK_API_KEY}`,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								model: 'grok-beta',
								messages: [
									{ role: 'system', content: 'You are a music production assistant. Enhance the following music style prompt into a detailed technical description for an AI music generator. Keep it under 200 characters.' },
									{ role: 'user', content: prompt }
								]
							}),
						});
						const grokData = await grokResponse.json();
						if (grokData.choices && grokData.choices[0]) {
							prompt = grokData.choices[0].message.content;
							console.log(`Grok optimized prompt: ${prompt}`);
						}
					} catch (grokErr) {
						console.error(`Grok API Error: ${grokErr.message}`);
					}
				}

				// 2. Call Minimax API for music generation
				const response = await fetch('https://api.minimax.io/v1/music_generation', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${env.MINIMAX_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model: 'music-2.6',
						prompt: prompt,
						lyrics: lyrics,
						is_instrumental: is_instrumental,
						audio_setting: {
							sample_rate: 44100,
							bitrate: 128000,
							format: 'mp3',
						},
					}),
				});

				const result = await response.json();

				if (result.base_resp && result.base_resp.status_code === 0) {
					const fileId = result.file_id;
					console.log(`Successfully generated music, File ID: ${fileId}`);

					let audioData;
					if (result.data && result.data.audio_url) {
						const audioResp = await fetch(result.data.audio_url);
						audioData = await audioResp.arrayBuffer();
					}

					if (audioData) {
						const key = `music-${Date.now()}.mp3`;
						await env.MUSIC_STORAGE.put(key, audioData, {
							httpMetadata: { contentType: 'audio/mpeg' },
							customMetadata: { prompt, fileId }
						});
						console.log(`Stored audio in R2 with key: ${key}`);

						// 3. Update Supabase with success
						if (task_id) {
							await supabase.from('music_tasks').update({ 
								status: 'completed',
								r2_key: key,
								file_id: fileId,
								optimized_prompt: prompt
							}).eq('id', task_id);
						}

						// 4. Notify via Telegram
						const chatId = telegram_chat_id || env.TELEGRAM_CHAT_ID;
						if (env.TELEGRAM_BOT_TOKEN && chatId) {
							try {
								await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										chat_id: chatId,
										text: `🎵 Music Generation Complete!\nPrompt: ${prompt}\nKey: ${key}`,
									}),
								});
							} catch (tgErr) {
								console.error(`Telegram Error: ${tgErr.message}`);
							}
						}
					}
				} else {
					console.error(`Minimax API Error: ${JSON.stringify(result.base_resp)}`);
					if (task_id) {
						await supabase.from('music_tasks').update({ 
							status: 'failed',
							error: JSON.stringify(result.base_resp)
						}).eq('id', task_id);
					}
				}
			} catch (err) {
				console.error(`Failed to process message ${message.id}: ${err.message}`);
				if (task_id) {
					await supabase.from('music_tasks').update({ 
						status: 'error',
						error: err.message
					}).eq('id', task_id);
				}
			}
		}
	},
};
