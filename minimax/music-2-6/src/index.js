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

				// 1. Call Gemini API for music generation (using Lyria models)
				const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
				
				const geminiResponse = await fetch(geminiUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [{ 
							parts: [{ 
								text: `Generate a high-fidelity music track based on this prompt: ${prompt}. Lyrics: ${lyrics || 'None'}. Instrumental: ${is_instrumental}` 
							}] 
						}],
						generationConfig: {
							response_mime_type: "audio/mpeg",
						}
					})
				});

				const result = await geminiResponse.json();
				const audioBase64 = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

				if (audioBase64) {
					const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
					const key = `music-${Date.now()}.mp3`;
					
					await env.MUSIC_STORAGE.put(key, audioBuffer, {
						httpMetadata: { contentType: 'audio/mpeg' },
						customMetadata: { prompt }
					});
					console.log(`Stored Gemini-generated audio in R2 with key: ${key}`);

					// 2. Update Supabase with success
					if (task_id) {
						await supabase.from('music_tasks').update({ 
							status: 'completed',
							r2_key: key,
							optimized_prompt: prompt
						}).eq('id', task_id);
					}

					// 3. Notify via Telegram
					const chatId = telegram_chat_id || env.TELEGRAM_CHAT_ID;
					if (env.TELEGRAM_BOT_TOKEN && chatId) {
						try {
							await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									chat_id: chatId,
									text: `🎵 Gemini Music Generation Complete!\nPrompt: ${prompt}\nKey: ${key}`,
								}),
							});
						} catch (tgErr) {
							console.error(`Telegram Error: ${tgErr.message}`);
						}
					}
				} else {
					throw new Error('Gemini failed to return audio data.');
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
