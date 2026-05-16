import { createClient } from '@supabase/supabase-js';

/**
 * Welcome to Cloudflare Workers!
 * 
 * This worker integrates with Supabase to store generation tasks.
 */

export default {
  async fetch(request, env) {
    // Initialize Supabase client
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    try {
      let text = 'Hello, this is a generated voice message.';
      
      // Attempt to get text from request body
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          if (body.text) text = body.text;
        } catch (e) {
          console.warn('Invalid JSON in request body');
        }
      }

      // 1. Log the task to Supabase
      const { data, error: dbError } = await supabase
        .from('tasks')
        .insert([{ prompt: text, status: 'processing', created_at: new Date().toISOString() }])
        .select();

      if (dbError) {
        console.warn('Supabase Insert Error:', dbError.message);
      }

      // 2. Run the AI model (MeloTTS for Text-to-Speech)
      const response = await env.AI.run('@cf/myshell-ai/melotts', {
        text: text,
      });

      // Update Supabase task status to completed
      if (data && data[0]) {
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', data[0].id);
      }

      return new Response(response, {
        headers: { 'Content-Type': 'audio/mpeg' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
