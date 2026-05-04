import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { ApiError, handleError } from "../_shared/error-handler.ts";
import { requireAuth } from "../_shared/auth.ts";
import { fetchWithRetry } from "../_shared/api-utils.ts";
import { ipLimiter } from "../_shared/rate-limiter.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. IP-based Rate Limiting (100 reqs per 10 mins per isolate)
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const allowed = await ipLimiter.checkLimit(clientIp, 100, 10 * 60 * 1000);
    if (!allowed) {
      throw new ApiError(429, "Rate limit exceeded. Please try again later.");
    }

    // 2. Auth checking - Secures the endpoint from abuse
    const user = await requireAuth(req);

    const { text, voiceId = 'cgSgspJ2msm6clMCkdW9' } = await req.json();
    
    if (!text) {
      throw new ApiError(400, "Text is required");
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new ApiError(500, "ElevenLabs API configuration is missing");
    }

    console.log(`[elevenlabs-tts] User ${user.id} generating TTS. Text length: ${text.length}`);
    
    // 3. Resilient Fetch using built-in Retry pattern
    const response = await fetchWithRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
      3
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(response.status, `Provider failed: ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error: unknown) {
    return handleError(error);
  }
});
