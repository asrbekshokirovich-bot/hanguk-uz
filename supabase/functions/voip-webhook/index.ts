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
    if (contentType.includes('application/json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
      try {
        payload = JSON.parse(rawBody);
      } catch (_e) {
        /* fall through */
      }
    }
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

  url.searchParams.forEach((v, k) => {
    if (!(k in payload)) (payload as Record<string, unknown>)[k] = v;
  });

  return { payload, rawBody, contentType };
}

/**
 * Mediateka's "CRM-da avtorizatsiya qilish uchun kalit" is sent by the PBX
 * inside each webhook request, but we don't yet know whether it arrives as a
 * header, a query param, or a body field. Look in all the usual places.
 */
function extractMediatekaSecret(req: Request, url: URL, payload: Record<string, unknown>): string | null {
  const headerCandidates = ['x-pbx-token', 'x-api-key', 'x-webhook-secret', 'authorization', 'x-crm-token', 'token'];
  for (const h of headerCandidates) {
    const v = req.headers.get(h);
    if (v) return v.replace(/^Bearer\s+/i, '').trim();
  }
  const fieldCandidates = ['crm_token', 'token', 'api_key', 'key', 'secret', 'auth'];
  for (const f of fieldCandidates) {
    const v = (payload[f] ?? url.searchParams.get(f)) as string | null;
    if (v) return String(v).trim();
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const url = new URL(req.url);
  const { payload, rawBody, contentType } = await readPayload(req, url);

  const headersObj: Record<string, string> = {};
  req.headers.forEach((v, k) => { headersObj[k] = v; });

  // Capture every request to the database so we can SQL-inspect the exact
  // payload format of new providers (Mediateka onboarding). Capture happens
  // BEFORE any auth check so we never lose a request to an auth mismatch.
  try {
    await supabaseAdmin.from('voip_webhook_captures').insert({
      method: req.method,
      url: req.url,
      query: Object.fromEntries(url.searchParams),
      headers: headersObj,
      content_type: contentType,
      raw_body: rawBody,
      parsed_payload: payload,
      source_ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
    });
  } catch (e) {
    console.error('Failed to write capture row:', e);
  }

  try {
    // --- Authentication ---
    // Mediateka uses MEDIATEKA_WEBHOOK_SECRET (set in CRM-da avtorizatsiya qilish uchun kalit).
    // If the env var is set, we require the secret in the request — but only
    // *after* the capture above, so we can still see rejected attempts in the DB.
    const mediatekaSecret = Deno.env.get('MEDIATEKA_WEBHOOK_SECRET');
    if (mediatekaSecret) {
      const provided = extractMediatekaSecret(req, url, payload);
      if (provided && provided === mediatekaSecret) {
        // Authenticated Mediateka request. Tag the provider so downstream
        // parsing branches can react accordingly.
        (payload as Record<string, unknown>).__voip_provider = 'mediateka';
      } else if (provided) {
        // Provided a secret but it didn't match — log and reject.
        console.error('Mediateka secret mismatch');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // No secret provided => fall through to other provider branches.
    }

    // Voximplant payload detection
    const isVoximplant = !!(payload.call_session_id || payload.call_session_history_id);

    // Mediateka payload detection (best-effort until we see real payloads).
    // Tag is set above when our secret matched.
    const isMediateka = (payload as Record<string, unknown>).__voip_provider === 'mediateka';

    let callData;

    if (isVoximplant) {
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
    } else {
      // Generic parser — also used as a first pass for Mediateka until we
      // capture a real payload and write provider-specific field mappings.
      const eventType = payload.event || payload.type || payload.EventType || payload.cmd || 'unknown';
      callData = {
        external_call_id: payload.call_id || payload.CallSid || payload.callId || payload.uuid || payload.uid || payload.session_id,
        phone_number: payload.from || payload.From || payload.caller_id || payload.callerNumber || payload.caller || payload.src,
        direction: ((payload.direction as string) || (payload.Direction as string) || 'incoming').toLowerCase(),
        status: mapCallStatus((payload.status as string) || (payload.CallStatus as string) || (payload.state as string) || (eventType as string)),
        duration: parseInt((payload.duration as string) || (payload.Duration as string) || (payload.CallDuration as string) || '0'),
        recording_url: payload.recording_url || payload.RecordingUrl || payload.recordingUrl || payload.record_url,
        started_at: payload.start_time || payload.StartTime || payload.startedAt || new Date().toISOString(),
        ended_at: payload.end_time || payload.EndTime || payload.endedAt,
        voip_provider: isMediateka ? 'mediateka' : ((payload.provider as string) || 'unknown'),
      };
    }

    // If we couldn't identify a call id, ack 200 — provider handshake or
    // a payload shape we don't yet parse. The capture row above lets us
    // study it offline.
    if (!callData.external_call_id && !callData.phone_number) {
      return new Response(JSON.stringify({ success: true, captured: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Match phone to student / lead
    let studentId = null;
    let leadId = null;

    if (callData.phone_number) {
      const normalizedPhone = normalizePhoneNumber(callData.phone_number as string);

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .or(`phone.eq.${normalizedPhone},phone.eq.${callData.phone_number}`)
        .maybeSingle();

      if (profile) studentId = profile.user_id;

      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('id')
        .or(`phone.eq.${normalizedPhone},phone.eq.${callData.phone_number}`)
        .maybeSingle();

      if (lead) leadId = lead.id;
    }

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

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin
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
        });

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('VoIP webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // 200 so provider doesn't auto-disable the webhook on transient errors;
    // the capture row above preserves the full request for debugging.
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function mapVoximplantStatus(result: string): string {
  const r = result.toLowerCase();
  if (['successful', 'success', 'answered', 'connected', 'normal_clearing'].includes(r)) return 'completed';
  if (['missed', 'no_answer', 'noanswer', 'timeout', 'originator_cancel'].includes(r)) return 'missed';
  if (['busy', 'rejected', 'user_busy'].includes(r)) return 'busy';
  if (['failed', 'error', 'canceled', 'cancelled', 'internal_error'].includes(r)) return 'failed';
  if (['ringing', 'in-progress', 'progress'].includes(r)) return 'no_answer';
  return 'completed';
}

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
