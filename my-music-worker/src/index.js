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
      // Example prompt for music generation
      const prompt = 'An upbeat electronic trap rap track with a catchy synth melody and deep bass driving beat';

      // 1. Log the task to Supabase (assuming a 'tasks' table exists)
      // If the table doesn't exist, this will fail or can be ignored.
      const { data, error: dbError } = await supabase
        .from('tasks')
        .insert([{ prompt, status: 'pending', created_at: new Date().toISOString() }])
        .select();

      if (dbError) {
        console.warn('Supabase Insert Error:', dbError.message);
      }

      // 2. Run the AI model
      // Note: @cf/openai/whisper is for speech-to-text. 
      // For music generation, you'd typically use a different model or external API.
      const response = await env.AI.run(
        '@cf/openai/whisper', 
        {
          prompt: prompt,
        }
      );

      return new Response(JSON.stringify({
        message: 'Task initiated',
        supabase_task: data ? data[0] : 'Table not found or insert failed',
        ai_response: response
      }), {
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
