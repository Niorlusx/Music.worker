import { createClient } from '@supabase/supabase-js';

/**
 * music-worker: A Cloudflare Worker for generating music using Gemini API and storing in R2.
 * Integrated with Supabase and Telegram Bot commands.
 */

async function queueTask(prompt, lyrics, is_instrumental, env, telegram_chat_id) {
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

	if (dbError) console.error('Supabase Error (Insert):', dbError.message);

	// 2. Push to queue for background processing
	await env.MY_QUEUE.send({
		task_id: task ? task.id : null,
		prompt,
		lyrics,
		is_instrumental,
		telegram_chat_id,
		timestamp: new Date().toISOString(),
	});

	return task ? task.id : 'logged locally';
}

async function sendTelegramMessage(env, chatId, text) {
	if (!env.TELEGRAM_BOT_TOKEN) return;
	try {
		await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text }),
		});
	} catch (err) {
		console.error('Telegram Send Error:', err.message);
	}
}

export default {
	async fetch(req, env, ctx) {
		const url = new URL(req.url);

		// Route for Telegram Webhook
		if (url.pathname === '/telegram-webhook') {
			if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
			
			try {
				const update = await req.json();
				if (!update.message || !update.message.text) return new Response('OK');

				const chatId = update.message.chat.id;
				const text = update.message.text;

				// Security Check: Only allow authorized chat ID
				if (env.TELEGRAM_CHAT_ID && String(chatId) !== String(env.TELEGRAM_CHAT_ID)) {
					await sendTelegramMessage(env, chatId, '⚠️ Unauthorized. You are not allowed to use this bot.');
					return new Response('OK');
				}

				if (text.startsWith('/start')) {
					await sendTelegramMessage(env, chatId, '🎵 Welcome to Music Maker Bot!\n\nUse /generate <your prompt> to create a new track.');
				} else if (text.startsWith('/generate')) {
					const prompt = text.replace('/generate', '').trim();
					if (!prompt) {
						await sendTelegramMessage(env, chatId, '❌ Please provide a prompt. Example: /generate Lo-fi beats for studying');
					} else {
						await sendTelegramMessage(env, chatId, `🚀 Generation started for: "${prompt}"\nI will notify you when it's ready!`);
						await queueTask(prompt, '', false, env, chatId);
					}
				}

				return new Response('OK');
			} catch (err) {
				console.error('Webhook Error:', err.message);
				return new Response('Error', { status: 500 });
			}
		}

		// Standard HTTP API Route
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

			const task_id = await queueTask(prompt, lyrics, is_instrumental, env, telegram_chat_id);

			return new Response(JSON.stringify({ 
				message: 'Music generation request queued.',
				task_id
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
	 * Queue handler: Consumes requests, calls the Gemini API, and stores result in R2.
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
