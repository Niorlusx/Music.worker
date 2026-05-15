/**
 * music-worker: A Cloudflare Worker for generating music using Minimax API and storing in R2.
 * Includes integrations for Grok (xAI) and Telegram.
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
			const { prompt, lyrics, is_instrumental = false } = await req.json();

			if (!prompt && !lyrics) {
				return new Response('Missing prompt or lyrics.', { status: 400 });
			}

			// Push to queue for background processing
			await env.MY_QUEUE.send({
				prompt,
				lyrics,
				is_instrumental,
				timestamp: new Date().toISOString(),
			});

			return new Response(JSON.stringify({ message: 'Music generation request queued.' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (err) {
			return new Response(`Error: ${err.message}`, { status: 500 });
		}
	},

	/**
	 * Queue handler: Consumes requests, calls the Minimax API, and stores result in R2.
	 */
	async queue(batch, env) {
		for (let message of batch.messages) {
			const { prompt, lyrics, is_instrumental } = message.body;
			console.log(`Processing music generation for prompt: ${prompt}`);

			try {
				// Example: Using Grok API to optimize prompt (Optional)
				// const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', { ... });

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
					} else {
						console.log('No direct audio_url found.');
						continue;
					}

					if (audioData) {
						const key = `music-${Date.now()}.mp3`;
						await env.MUSIC_STORAGE.put(key, audioData, {
							httpMetadata: { contentType: 'audio/mpeg' },
							customMetadata: { prompt, fileId }
						});
						console.log(`Stored audio in R2 with key: ${key}`);

						// Example: Notify via Telegram
						if (env.TELEGRAM_BOT_TOKEN) {
							// await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { ... });
						}
					}
				} else {
					console.error(`Minimax API Error: ${JSON.stringify(result.base_resp)}`);
				}
			} catch (err) {
				console.error(`Failed to process message ${message.id}: ${err.message}`);
			}
		}
	},
};
