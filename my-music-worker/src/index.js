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

      // 2. Run the AI model (Gemini for Text-to-Speech)
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
      
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text }] }],
          generationConfig: {
            response_mime_type: "audio/mpeg",
          }
        })
      });

      const result = await geminiResponse.json();
      
      // Extract audio from Gemini response (assuming it returns base64 in the first part)
      // Note: Gemini 1.5 Flash supports native audio generation in preview.
      // If the specific TTS model is used, the endpoint might differ slightly.
      const audioBase64 = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!audioBase64) {
        throw new Error('Failed to generate audio from Gemini.');
      }

      // Update Supabase task status to completed
      if (data && data[0]) {
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', data[0].id);
      }

      // Convert base64 to array buffer
      const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

      return new Response(audioBuffer, {
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
