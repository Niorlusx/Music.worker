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
	/**
	 * Scheduled handler: Automatically triggers every day to generate a new track.
	 */
	async scheduled(event, env, ctx) {
		console.log("Cron trigger: Generating daily hands-free track...");
		try {
			// 1. Ask Gemini Flash for a creative music prompt
			const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
			const flashResp = await fetch(geminiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: "Invent a short, highly creative prompt for an AI music generator. Just return the prompt text, no intro." }] }]
				})
			});
			const flashResult = await flashResp.json();
			const prompt = flashResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "A beautiful ambient morning melody";

			// 2. Queue the task
			await queueTask(prompt, "Daily hands-free track", false, env, env.TELEGRAM_CHAT_ID);
		} catch (err) {
			console.error("Cron Error:", err.message);
		}
	},

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
				const geminiKey = env.GEMINI_API_KEY;
				const lyriaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`;
				
				const lyriaResponse = await fetch(lyriaUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [{ parts: [{ text: `Generate a high-fidelity music track: ${prompt}. Lyrics: ${lyrics || 'None'}. Instrumental: ${is_instrumental}` }] }],
						generationConfig: { response_mime_type: "audio/mpeg" }
					})
				});

				const lyriaResult = await lyriaResponse.json();
				const audioBase64 = lyriaResult.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

				if (audioBase64) {
					const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
					const musicKey = `music-${Date.now()}.mp3`;
					await env.MUSIC_STORAGE.put(musicKey, audioBuffer, { httpMetadata: { contentType: 'audio/mpeg' } });

					// 2. Generate 8-second Music Video Loop using Veo 3.1
					console.log(`Generating music video for prompt: ${prompt}`);
					const veoUrl = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predict?key=${geminiKey}`;
					const veoResp = await fetch(veoUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							prompt: `Cinematic visualization matching this music: ${prompt}`,
							aspect_ratio: "16:9",
							video_format: "mp4"
						})
					});
					
					const veoOperation = await veoResp.json();
					let videoBuffer;

					if (veoOperation.name) {
						// Poll for completion (Veo is async)
						console.log(`Veo operation started: ${veoOperation.name}. Polling...`);
						while (true) {
							await new Promise(r => setTimeout(r, 15000));
							const pollResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/${veoOperation.name}?key=${geminiKey}`);
							const opStatus = await pollResp.json();
							
							if (opStatus.done) {
								const videoBase64 = opStatus.response?.generated_clip?.video?.data;
								if (videoBase64) {
									videoBuffer = Uint8Array.from(atob(videoBase64), c => c.charCodeAt(0));
								}
								break;
							}
						}
					}

					let videoKey = null;
					if (videoBuffer) {
						videoKey = `video-${Date.now()}.mp4`;
						await env.MUSIC_STORAGE.put(videoKey, videoBuffer, { httpMetadata: { contentType: 'video/mp4' } });
					}

					// 3. Update Supabase with success
					if (task_id) {
						await supabase.from('music_tasks').update({ 
							status: 'completed',
							r2_key: musicKey,
							optimized_prompt: prompt
						}).eq('id', task_id);
					}

					// 4. Notify via Telegram
					const chatId = telegram_chat_id || env.TELEGRAM_CHAT_ID;
					if (env.TELEGRAM_BOT_TOKEN && chatId) {
						const msg = `✨ Hands-Free Generation Complete!\n\n🎵 Music: ${musicKey}\n🎬 Video: ${videoKey || 'Failed'}\n\nPrompt: ${prompt}`;
						await sendTelegramMessage(env, chatId, msg);
					}
				} else {
					throw new Error('Gemini failed to return audio data.');
				}
			} catch (err) {
				console.error(`Failed to process message ${message.id}: ${err.message}`);
				if (task_id) {
					await supabase.from('music_tasks').update({ status: 'error', error: err.message }).eq('id', task_id);
				}
			}
		}
	},
};
