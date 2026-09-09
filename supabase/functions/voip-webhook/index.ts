import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveIdentity } from "./_shared/identity.ts";

/**
 * Best-effort nudge to the call-intelligence worker. The DB trigger already
 * enqueued a durable job; this makes live calls get transcribed immediately.
 * Runs in the background (EdgeRuntime.waitUntil) so the webhook still returns
 * fast; dispatch-comm-jobs is the retry safety net.
 */
function invokeCallProcessor(callId: string): void {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-call-recording`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const p = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ call_id: callId }),
  })
    .then((r) => (r.ok ? undefined : r.text().then((t) => console.error("processor invoke non-200:", r.status, t.slice(0, 200)))))
    .catch((e) => console.error("processor invoke failed:", e));
  try {
    (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(p);
  } catch (_e) { /* not on edge runtime — fire and forget */ }
}

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
    // --- Provider routing ---
    // Asterisk posts to /voip-webhook/asterisk. A path rather than a header, so
    // the provider is obvious in the logs and in the capture row, and a
    // misconfigured PBX can never fall through into the Mediateka parser.
    if (url.pathname.replace(/\/+$/, '').endsWith('/asterisk')) {
      return await handleAsterisk(req, supabaseAdmin, payload);
    }

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

    // Mediateka uses form-urlencoded with a `crm_token` body field and a
    // `callid` identifier. Detect either by tag (set above when our secret
    // matched the env var) or by the unmistakable field combo, so a captured
    // request that pre-dates the env var still gets parsed correctly.
    const isMediateka =
      (payload as Record<string, unknown>).__voip_provider === 'mediateka' ||
      (typeof payload.crm_token === 'string' && typeof payload.callid === 'string');

    let callData;
    // The PBX extension that handled the call (Mediateka `ext`, later the
    // Asterisk channel's extension). Resolved to a person via staff_extensions.
    let staffExtension: string | null = null;

    if (isMediateka) {
      const cmd = String(payload.cmd ?? '').toLowerCase();
      const callid = String(payload.callid ?? '');
      const phone = String(payload.phone ?? '');
      const ext = payload.ext ? String(payload.ext) : null;

      // ---- cmd=contact: Mediateka is asking us who this caller is so the
      // agent's phone screen can show the name. Look up the lead/student
      // and respond with the name. Do NOT write to calls — this is metadata,
      // not a call event.
      if (cmd === 'contact') {
        const normalized = normalizePhoneNumber(phone);
        let name: string | null = null;

        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('id, full_name')
          .or(`phone.eq.${normalized},phone.eq.${phone}`)
          .maybeSingle();
        if (lead) name = (lead as { full_name: string | null }).full_name;

        if (!name) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .or(`phone.eq.${normalized},phone.eq.${phone}`)
            .maybeSingle();
          if (profile) name = (profile as { full_name: string | null }).full_name;
        }

        const displayName = name || `+${normalized.replace(/^\+/, '')}`;
        return new Response(JSON.stringify({
          success: true,
          name: displayName,
          contact: { name: displayName },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ---- cmd=event / cmd=history: actual call state. Map to calls table.
      const directionRaw = String(payload.direction ?? payload.type ?? '').toLowerCase();
      const direction = directionRaw === 'out' || directionRaw === 'outgoing' ? 'outgoing' : 'incoming';

      let status = 'no_answer';
      let endedAt: string | null = null;
      let recordingUrl: string | null = null;

      if (cmd === 'event') {
        const evType = String(payload.type ?? '').toUpperCase();
        if (evType === 'OUTGOING' || evType === 'INCOMING') status = 'no_answer';
        else if (evType === 'ACCEPTED') status = 'no_answer'; // call alive; final state arrives via history
        else if (evType === 'COMPLETED') { status = 'completed'; endedAt = new Date().toISOString(); }
        else if (evType === 'CANCELLED') { status = 'missed'; endedAt = new Date().toISOString(); }
      } else if (cmd === 'history') {
        const histStatus = String(payload.status ?? '').toLowerCase();
        if (histStatus === 'success') status = 'completed';
        else if (histStatus === 'missed') status = 'missed';
        else if (histStatus === 'busy') status = 'busy';
        else if (histStatus === 'notavailable') status = 'failed';
        else status = 'completed';
        endedAt = new Date().toISOString();
        if (payload.link) recordingUrl = String(payload.link);
      }

      callData = {
        external_call_id: callid,
        phone_number: phone,
        direction,
        status,
        duration: parseInt(String(payload.duration ?? '0'), 10) || 0,
        recording_url: recordingUrl,
        started_at: parseMediatekaTimestamp(payload.start as string | undefined) || new Date().toISOString(),
        ended_at: endedAt,
        voip_provider: 'mediateka',
      };
      staffExtension = ext;
    } else if (isVoximplant) {
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

    // Match phone to student / lead via the shared identity spine. This also
    // persists newly-discovered phone→person mappings into
    // communication_identities, so the link is reused on future calls/chats
    // and is visible/editable by staff.
    let studentId: string | null = null;
    let leadId: string | null = null;

    if (callData.phone_number) {
      const resolved = await resolveIdentity(supabaseAdmin, 'phone', callData.phone_number as string);
      studentId = resolved.studentId;
      leadId = resolved.leadId;
    }

    // Extension → operator. A call with no mapping keeps staff_id null rather
    // than guessing: an unmapped extension is a configuration gap, and a wrong
    // owner is worse than none once screen-pop and per-operator stats read it.
    let staffId: string | null = null;
    if (staffExtension) {
      const provider = String(callData.voip_provider ?? '');
      const { data: mapped, error: mapError } = await supabaseAdmin
        .from('staff_extensions')
        .select('staff_id')
        .eq('provider', provider)
        .eq('extension', staffExtension)
        .eq('is_active', true)
        .maybeSingle();
      if (mapError) {
        console.error('staff_extensions lookup failed:', mapError.message);
      } else if (mapped) {
        staffId = (mapped as { staff_id: string }).staff_id;
      } else {
        console.warn(`No active staff_extensions row for ${provider} ext=${staffExtension}`);
      }
    }

    const { data: existingCall } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('external_call_id', callData.external_call_id)
      .maybeSingle();

    let callRowId: string | null = existingCall?.id ?? null;

    if (existingCall) {
      const { error: updateError } = await supabaseAdmin
        .from('calls')
        .update({
          status: callData.status,
          duration: callData.duration,
          recording_url: callData.recording_url,
          ended_at: callData.ended_at,
          // Keep an existing student link; backfill it (and the lead link) when
          // the identity spine now resolves a match it didn't have before.
          ...(studentId ? { student_id: studentId } : {}),
          ...(staffId ? { staff_id: staffId } : {}),
          lead_id: leadId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCall.id);

      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
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
          staff_id: staffId,
          lead_id: leadId,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      callRowId = inserted?.id ?? null;
    }

    // Completed call with a recording → transcribe + analyse (Uzbek-first).
    if (callRowId && callData.status === 'completed' && callData.recording_url) {
      invokeCallProcessor(callRowId);
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


function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Asterisk / FreePBX feed.
 *
 * Reached at /voip-webhook/asterisk — a path, not a header, so a misconfigured
 * PBX can never be mistaken for Mediateka: the provider is visible in the logs
 * and in voip_webhook_captures.url before anything is parsed.
 *
 * Expected body (JSON), one POST per event:
 *   { event: 'start' | 'answer' | 'hangup' | 'recording',
 *     uniqueid: '1757400000.123',        // Asterisk channel uniqueid — our call key
 *     ext: '1001',                       // operator's extension
 *     phone: '998901234567',             // the other party
 *     direction: 'outgoing' | 'incoming',
 *     started_at?, answered_at?, ended_at?,   // ISO 8601
 *     duration?: 42,                     // billsec — talk time, not ring time
 *     hangupcause?: 16,                  // Q.850 cause, hangup only
 *     recording_path?: '2026/09/1757400000.123.mp3' }  // recording only
 *
 * Authenticated with ASTERISK_WEBHOOK_SECRET in the `x-webhook-secret` header.
 * Fails closed: with no secret configured the endpoint refuses everything, so a
 * half-finished PBX setup cannot write calls anonymously.
 */
async function handleAsterisk(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<Response> {
  const secret = Deno.env.get('ASTERISK_WEBHOOK_SECRET');
  if (!secret) {
    console.error('ASTERISK_WEBHOOK_SECRET is not configured — refusing Asterisk events');
    return json({ error: 'Asterisk endpoint not configured' }, 503);
  }
  const provided = (req.headers.get('x-webhook-secret') || String(payload.secret ?? '')).trim();
  if (provided !== secret) {
    console.error('Asterisk secret mismatch');
    return json({ error: 'Unauthorized' }, 401);
  }

  const event = String(payload.event ?? '').toLowerCase();
  const uniqueid = String(payload.uniqueid ?? '').trim();
  if (!uniqueid) return json({ error: 'Missing uniqueid' }, 400);

  const { data: existing } = await supabaseAdmin
    .from('calls')
    .select('id, answered_at')
    .eq('external_call_id', uniqueid)
    .maybeSingle();
  const existingRow = existing as { id: string; answered_at: string | null } | null;

  // ---- recording: the office uploader finished pushing the file. This is the
  // event the transcription worker waits for — hangup arrives while the file is
  // still on the PBX disk, so starting analysis there would find nothing.
  if (event === 'recording') {
    const path = String(payload.recording_path ?? '').trim();
    if (!path) return json({ error: 'Missing recording_path' }, 400);
    if (!existingRow) return json({ error: 'Unknown uniqueid for recording' }, 404);

    // A signed URL so the worker can fetch the object over plain HTTP. It
    // expires; recording_path is the durable reference the CRM re-signs from.
    const { data: signed, error: signError } = await supabaseAdmin
      .storage.from('call-recordings').createSignedUrl(path, 60 * 60 * 24);
    if (signError) {
      console.error('createSignedUrl failed:', signError.message);
      return json({ error: 'Could not sign recording URL' }, 502);
    }

    const { error: recError } = await supabaseAdmin
      .from('calls')
      .update({
        recording_path: path,
        recording_url: signed?.signedUrl ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRow.id);
    if (recError) throw recError;

    invokeCallProcessor(existingRow.id);
    return json({ success: true, call_id: existingRow.id, analysis: 'queued' });
  }

  const ext = payload.ext ? String(payload.ext) : null;
  const phone = String(payload.phone ?? '').trim();
  const direction = String(payload.direction ?? 'incoming').toLowerCase() === 'outgoing'
    ? 'outgoing'
    : 'incoming';

  // Extension → operator, same rule as Mediateka: no mapping means no owner,
  // never a guessed one.
  let staffId: string | null = null;
  if (ext) {
    const { data: mapped, error: mapError } = await supabaseAdmin
      .from('staff_extensions')
      .select('staff_id')
      .eq('provider', 'asterisk')
      .eq('extension', ext)
      .eq('is_active', true)
      .maybeSingle();
    if (mapError) console.error('staff_extensions lookup failed:', mapError.message);
    else if (mapped) staffId = (mapped as { staff_id: string }).staff_id;
    else console.warn(`No active staff_extensions row for asterisk ext=${ext}`);
  }

  let studentId: string | null = null;
  let leadId: string | null = null;
  if (phone) {
    const resolved = await resolveIdentity(supabaseAdmin, 'phone', phone);
    studentId = resolved.studentId;
    leadId = resolved.leadId;
  }

  const answeredAt = payload.answered_at ? String(payload.answered_at) : null;

  // `start` and `answer` leave the call open; only `hangup` decides an outcome.
  let status = 'no_answer';
  let endedAt: string | null = null;
  let duration = 0;

  if (event === 'hangup') {
    const cause = parseInt(String(payload.hangupcause ?? ''), 10);
    const everAnswered = !!(answeredAt || existingRow?.answered_at);
    status = mapAsteriskHangupCause(cause, everAnswered);
    endedAt = payload.ended_at ? String(payload.ended_at) : new Date().toISOString();
    // billsec: talk time. Ring time is not conversation and must not inflate it.
    duration = parseInt(String(payload.duration ?? '0'), 10) || 0;
  }

  if (existingRow) {
    const { error } = await supabaseAdmin
      .from('calls')
      .update({
        ...(event === 'hangup' ? { status, ended_at: endedAt, duration } : {}),
        ...(answeredAt ? { answered_at: answeredAt } : {}),
        ...(studentId ? { student_id: studentId } : {}),
        ...(staffId ? { staff_id: staffId } : {}),
        lead_id: leadId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRow.id);
    if (error) throw error;
    return json({ success: true, call_id: existingRow.id, event });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('calls')
    .insert({
      external_call_id: uniqueid,
      phone_number: phone || 'unknown',
      direction,
      status,
      duration,
      started_at: payload.started_at ? String(payload.started_at) : new Date().toISOString(),
      answered_at: answeredAt,
      ended_at: endedAt,
      voip_provider: 'asterisk',
      student_id: studentId,
      staff_id: staffId,
      lead_id: leadId,
    })
    .select('id')
    .single();
  if (insertError) throw insertError;

  return json({ success: true, call_id: (inserted as { id: string })?.id, event });
}

/**
 * Q.850 hangup causes → our call statuses.
 *
 * Without this every Asterisk call would land as 'completed', because that is
 * what a "the channel closed" event looks like if you don't read the cause.
 * `everAnswered` decides the ambiguous ones: a channel that closed normally but
 * was never picked up is a missed call, not a conversation.
 */
function mapAsteriskHangupCause(cause: number, everAnswered: boolean): string {
  switch (cause) {
    case 16: return everAnswered ? 'completed' : 'no_answer'; // normal clearing
    case 17: return 'busy';                                   // user busy
    case 18: return 'no_answer';                              // no user responding
    case 19: return 'no_answer';                              // no answer from user
    case 21: return 'failed';                                 // call rejected
    case 20: return 'missed';                                 // subscriber absent
    case 34: return 'failed';                                 // no circuit available
    case 38: return 'failed';                                 // network out of order
    default: return everAnswered ? 'completed' : 'failed';
  }
}

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

// Mediateka serializes timestamps as compact ISO 8601: "20260605T115444Z".
// Postgres timestamptz can't parse that — expand to "2026-06-05T11:54:44Z".
function parseMediatekaTimestamp(s: string | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
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
