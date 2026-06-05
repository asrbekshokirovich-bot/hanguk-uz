import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-api-key, x-pbx-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Reads the request body once and parses it regardless of encoding.
 * Supports JSON, application/x-www-form-urlencoded and multipart/form-data.
 * Falls back gracefully so a malformed/unknown body never throws.
 */
async function readPayload(req: Request, url: URL): Promise<{ payload: Record<string, unknown>; rawBody: string; contentType: string }> {
  const contentType = req.headers.get('content-type') || '';
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (_e) {
    rawBody = '';
  }

  let payload: Record<string, unknown> = {};

  if (rawBody) {
    // 1) JSON
    if (contentType.includes('application/json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
      try {
        payload = JSON.parse(rawBody);
      } catch (_e) {
        /* fall through */
      }
    }
    // 2) form-urlencoded (very common for Uzbek/Russian VATS engines)
    if (Object.keys(payload).length === 0) {
      try {
        const params = new URLSearchParams(rawBody);
        const obj: Record<string, string> = {};
        let found = false;
        params.forEach((v, k) => { obj[k] = v; found = true; });
        if (found) payload = obj;
      } catch (_e) {
        /* fall through */
      }
    }
  }

  // Merge query-string params (some engines send the command/key via the URL)
  url.searchParams.forEach((v, k) => {
    if (!(k in payload)) (payload as Record<string, unknown>)[k] = v;
  });

  return { payload, rawBody, contentType };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const { payload, rawBody, contentType } = await readPayload(req, url);

    // ---- Comprehensive capture logging ----
    // A single test call from any provider reveals its exact format here.
    const headersObj: Record<string, string> = {};
    req.headers.forEach((v, k) => { headersObj[k] = v; });
    console.log('=== VoIP webhook received ===');
    console.log('method:', req.method);
    console.log('url:', req.url);
    console.log('query:', JSON.stringify(Object.fromEntries(url.searchParams)));
    console.log('content-type:', contentType);
    console.log('headers:', JSON.stringify(headersObj));
    console.log('raw body:', rawBody);
    console.log('parsed payload:', JSON.stringify(payload));

    // Webhook secret validation (legacy providers — only enforced if env var set)
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('VOIP_WEBHOOK_SECRET');

    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Detect if this is a Voximplant payload
    const isVoximplant = !!(payload.call_session_id || payload.call_session_history_id);

    let callData;

    if (isVoximplant) {
      // --- Voximplant-specific parsing ---
      const voximplantApiKey = Deno.env.get('VOXIMPLANT_API_KEY');
      const incomingApiKey = (payload.api_key as string) || req.headers.get('x-api-key');
      if (voximplantApiKey && incomingApiKey && incomingApiKey !== voximplantApiKey) {
        console.error('Invalid Voximplant API key');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const direction = ((payload.call_direction as string) || 'incoming').toLowerCase();
      const phoneNumber = direction === 'outgoing'
        ? (payload.callee || payload.destination || payload.caller_id)
        : (payload.caller_id || payload.callee);

      callData = {
        external_call_id: payload.call_session_id || payload.call_session_history_id,
        phone_number: phoneNumber,
        direction: direction === 'outbound' ? 'outgoing' : direction,
        status: mapVoximplantStatus((payload.result as string) || (payload.status as string) || 'unknown'),
        duration: parseInt((payload.duration as string) || '0'),
        recording_url: payload.record_url || payload.recording_url,
        started_at: payload.start_time || payload.started_at || new Date().toISOString(),
        ended_at: payload.end_time || payload.ended_at,
        voip_provider: 'voximplant',
      };
      console.log('Parsed Voximplant call data:', callData);
    } else {
      // --- Generic / legacy provider parsing ---
      const eventType = payload.event || payload.type || payload.EventType || 'unknown';
      callData = {
        external_call_id: payload.call_id || payload.CallSid || payload.callId || payload.uuid,
        phone_number: payload.from || payload.From || payload.caller_id || payload.callerNumber,
        direction: ((payload.direction as string) || (payload.Direction as string) || 'incoming').toLowerCase(),
        status: mapCallStatus((payload.status as string) || (payload.CallStatus as string) || (payload.state as string) || (eventType as string)),
        duration: parseInt((payload.duration as string) || (payload.Duration as string) || (payload.CallDuration as string) || '0'),
        recording_url: payload.recording_url || payload.RecordingUrl || payload.recordingUrl,
        started_at: payload.start_time || payload.StartTime || payload.startedAt || new Date().toISOString(),
        ended_at: payload.end_time || payload.EndTime || payload.endedAt,
        voip_provider: (payload.provider as string) || 'unknown',
      };
    }

    // If we couldn't identify a call id, this is likely a capture-only request
    // (e.g. provider handshake/test). Acknowledge with 200 so the provider
    // doesn't disable the webhook, and rely on the logs above to learn the format.
    if (!callData.external_call_id && !callData.phone_number) {
      console.log('No identifiable call fields — acknowledging without DB write.');
      return new Response(JSON.stringify({ success: true, captured: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Try to find student / lead by phone number
    let studentId = null;
    let leadId = null;

    if (callData.phone_number) {
      const normalizedPhone = normalizePhoneNumber(callData.phone_number as string);

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .or(`phone.eq.${normalizedPhone},phone.eq.${callData.phone_number}`)
        .maybeSingle();

      if (profile) {
        studentId = profile.user_id;
        console.log('Found student:', studentId);
      }

      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('id')
        .or(`phone.eq.${normalizedPhone},phone.eq.${callData.phone_number}`)
        .maybeSingle();

      if (lead) {
        leadId = lead.id;
        console.log('Found lead:', leadId);
      }
    }

    // Check if call already exists (update) or create new
    const { data: existingCall } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('external_call_id', callData.external_call_id)
      .maybeSingle();

    if (existingCall) {
      const { error: updateError } = await supabaseAdmin
        .from('calls')
        .update({
          status: callData.status,
          duration: callData.duration,
          recording_url: callData.recording_url,
          ended_at: callData.ended_at,
          lead_id: leadId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCall.id);

      if (updateError) {
        console.error('Error updating call:', updateError);
        throw updateError;
      }
      console.log('Updated call:', existingCall.id);
    } else {
      const { data: newCall, error: insertError } = await supabaseAdmin
        .from('calls')
        .insert({
          external_call_id: callData.external_call_id,
          phone_number: callData.phone_number || 'unknown',
          direction: callData.direction === 'outgoing' ? 'outgoing' : 'incoming',
          status: callData.status,
          duration: callData.duration,
          recording_url: callData.recording_url,
          started_at: callData.started_at,
          ended_at: callData.ended_at,
          voip_provider: callData.voip_provider,
          student_id: studentId,
          lead_id: leadId,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating call:', insertError);
        throw insertError;
      }
      console.log('Created new call:', newCall.id);

      if (callData.direction === 'incoming' && callData.status === 'ringing') {
        console.log('Incoming call notification would be sent here');
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('VoIP webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Return 200 so the provider does not disable the webhook on transient
    // errors. The error is logged above for debugging.
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Voximplant-specific status mapping
function mapVoximplantStatus(result: string): string {
  const r = result.toLowerCase();
  if (['successful', 'success', 'answered', 'connected', 'normal_clearing'].includes(r)) return 'completed';
  if (['missed', 'no_answer', 'noanswer', 'timeout', 'originator_cancel'].includes(r)) return 'missed';
  if (['busy', 'rejected', 'user_busy'].includes(r)) return 'busy';
  if (['failed', 'error', 'canceled', 'cancelled', 'internal_error'].includes(r)) return 'failed';
  if (['ringing', 'in-progress', 'progress'].includes(r)) return 'no_answer';
  return 'completed';
}

// Generic status mapping (legacy providers)
function mapCallStatus(status: string): string {
  const statusLower = status.toLowerCase();
  if (['completed', 'answered', 'connected'].includes(statusLower)) return 'completed';
  if (['missed', 'no-answer', 'noanswer', 'timeout'].includes(statusLower)) return 'missed';
  if (['busy', 'rejected'].includes(statusLower)) return 'busy';
  if (['failed', 'error', 'canceled', 'cancelled'].includes(statusLower)) return 'failed';
  if (['ringing', 'initiated', 'queued', 'in-progress'].includes(statusLower)) return 'no_answer';
  return 'completed';
}

function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('998')) {
    normalized = '+' + normalized;
  } else if (normalized.startsWith('9') && normalized.length === 9) {
    normalized = '+998' + normalized;
  }
  return normalized;
}
