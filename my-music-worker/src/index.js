/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env) {
    try {
      // Running a supported text-to-audio model 
      const response = await env.AI.run(
        '@cf/openai/whisper', // Make sure to use an available text/audio model on Cloudflare
        {
          prompt: 'An upbeat electronic trap rap track with a catchy synth melody and deep bass driving beat',
        }
      );

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

