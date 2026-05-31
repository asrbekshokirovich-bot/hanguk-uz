// notify-tracked-changes — drain the change_event_outbox and fan out to push.
//
// Cron-triggered every minute. Reads pending events, joins
// user_tracked_universities to find affected users, dispatches to FCM /
// APNs / web-push per recipient, marks the event sent or scheduled for
// retry.
//
// Outbox state machine:
//   pending  — newly enqueued by trigger
//   sending  — claimed by a worker tick (transient; gets reset to pending
//              if not transitioned within 5 minutes via stuck-worker recovery)
//   sent     — terminal success
//   failed   — retry pending; next_attempt_at backed off exponentially
//   dead     — exhausted retries (8 attempts)
//
// Killswitch: UNI_DB_PUSH_ENABLED=false on the function secret skips
// dispatch entirely. The outbox keeps growing harmlessly until enabled.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUSH_ENABLED = (Deno.env.get('UNI_DB_PUSH_ENABLED') || 'false').toLowerCase() === 'true';
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') || '';
const APNS_KEY_P8 = Deno.env.get('APNS_KEY_P8') || '';
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') || '';
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') || '';
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || '';
const VAPID_PRIVATE = Deno.env.get('WEB_PUSH_VAPID_PRIVATE') || '';
const VAPID_PUBLIC = Deno.env.get('WEB_PUSH_VAPID_PUBLIC') || '';
const VAPID_SUBJECT = Deno.env.get('WEB_PUSH_VAPID_SUBJECT') || 'mailto:ops@hanguk.example';

const MAX_BATCH = 100;
const MAX_ATTEMPTS = 8;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface OutboxRow {
  id: string;
  target_table: string;
  target_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

interface PushToken {
  user_id: string;
  platform: 'android' | 'ios' | 'web';
  token: string;
  preferred_lang: string;
}

interface DispatchResult {
  ok: boolean;
  error?: string;
}

function nextRetry(attempts: number): { status: string; next_attempt_at?: string } {
  if (attempts >= MAX_ATTEMPTS) return { status: 'dead' };
  // 2,4,8,16,32,60,60,60 minute backoff
  const minutes = Math.min(60, 2 ** attempts);
  const next = new Date(Date.now() + minutes * 60_000);
  return { status: 'failed', next_attempt_at: next.toISOString() };
}

async function findRecipients(event: OutboxRow): Promise<PushToken[]> {
  // For recruitment_units changes we look up the institution, then
  // fan out to users tracking that institution. Other event_types
  // can extend this switch later.
  let institutionId: string | null = null;

  if (event.target_table === 'recruitment_units') {
    const { data, error } = await sb
      .from('recruitment_units')
      .select('institution_id')
      .eq('id', event.target_id)
      .maybeSingle();
    if (error || !data) return [];
    institutionId = data.institution_id as string;
  } else {
    // Future: handle institutions / scholarships / etc.
    return [];
  }
  if (!institutionId) return [];

  const { data, error } = await sb
    .from('user_tracked_universities')
    .select('user_id, preferred_lang')
    .eq('institution_id', institutionId);
  if (error || !data?.length) return [];
  const userIds = data.map((r) => r.user_id);
  const langByUser = new Map<string, string>();
  for (const r of data) langByUser.set(r.user_id, (r.preferred_lang as string) || 'en');

  const { data: tokens, error: tokErr } = await sb
    .from('user_push_tokens')
    .select('user_id, platform, token, preferred_lang')
    .in('user_id', userIds)
    .eq('enabled', true);
  if (tokErr || !tokens) return [];
  return tokens.map((t) => ({
    user_id: t.user_id as string,
    platform: t.platform as 'android' | 'ios' | 'web',
    token: t.token as string,
    preferred_lang: (t.preferred_lang as string) || langByUser.get(t.user_id as string) || 'en',
  }));
}

async function dispatchToPlatform(
  recipient: PushToken,
  event: OutboxRow,
): Promise<DispatchResult> {
  const title = titleFor(event, recipient.preferred_lang);
  const body = bodyFor(event, recipient.preferred_lang);
  switch (recipient.platform) {
    case 'android':
      if (!FCM_SERVICE_ACCOUNT_JSON) return { ok: false, error: 'fcm_not_configured' };
      return sendFcm(recipient.token, title, body, event);
    case 'ios':
      if (!APNS_KEY_P8 || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID) {
        return { ok: false, error: 'apns_not_configured' };
      }
      return sendApns(recipient.token, title, body, event);
    case 'web':
      if (!VAPID_PRIVATE || !VAPID_PUBLIC) return { ok: false, error: 'vapid_not_configured' };
      return sendWebPush(recipient.token, title, body, event);
    default:
      return { ok: false, error: 'unknown_platform' };
  }
}

// ---------------------------------------------------------------------------
// Per-platform delivery — implementations are intentionally small. Real
// production deploys add SDK-quality retry/error handling, but we keep
// the surface narrow so the hot path stays auditable.
// ---------------------------------------------------------------------------

async function sendFcm(
  token: string,
  title: string,
  body: string,
  event: OutboxRow,
): Promise<DispatchResult> {
  // FCM HTTP v1 requires a short-lived OAuth access token derived from
  // the service account. We exchange JWT-for-token here per call;
  // a production deploy would cache the token until expiry.
  let accessToken: string;
  try {
    accessToken = await fcmAccessToken();
  } catch (err) {
    return { ok: false, error: `fcm_auth: ${(err as Error).message}` };
  }

  const projectId = JSON.parse(FCM_SERVICE_ACCOUNT_JSON).project_id as string;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        data: {
          event_type: event.event_type,
          target_id: event.target_id,
          title,
          body,
        },
        android: {
          priority:
            event.event_type === 'correction_notice' || event.event_type === 'deadline_within_24h'
              ? 'HIGH'
              : 'NORMAL',
        },
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `fcm_${res.status}` };
  return { ok: true };
}

async function sendApns(
  token: string,
  title: string,
  body: string,
  event: OutboxRow,
): Promise<DispatchResult> {
  let apnsJwt: string;
  try {
    apnsJwt = await apnsBearer();
  } catch (err) {
    return { ok: false, error: `apns_auth: ${(err as Error).message}` };
  }
  const url = `https://api.push.apple.com/3/device/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${apnsJwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority':
        event.event_type === 'correction_notice' || event.event_type === 'deadline_within_24h'
          ? '10'
          : '5',
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
      },
      event_type: event.event_type,
      target_id: event.target_id,
    }),
  });
  if (!res.ok) return { ok: false, error: `apns_${res.status}` };
  return { ok: true };
}

async function sendWebPush(
  subscriptionJson: string,
  title: string,
  body: string,
  event: OutboxRow,
): Promise<DispatchResult> {
  // Web push subscription is the JSON object the browser returned. Real
  // deploys use the `web-push` library; we keep it minimal here and let
  // the production system swap in a richer client if necessary.
  let subscription: { endpoint: string };
  try {
    subscription = JSON.parse(subscriptionJson);
  } catch {
    return { ok: false, error: 'web_push_subscription_unparseable' };
  }
  const payload = JSON.stringify({
    title,
    body,
    event_type: event.event_type,
    target_id: event.target_id,
  });
  // Without VAPID encryption + JWT signing this is a 401, but the
  // skeleton is here for the production handler to flesh out. In dev
  // we report the would-be POST as a soft failure so the outbox row
  // ends up retried, not dead.
  const _payload = payload;
  void _payload;
  return { ok: false, error: 'web_push_not_implemented' };
}

// ---------------------------------------------------------------------------
// Token signing helpers
// ---------------------------------------------------------------------------

async function fcmAccessToken(): Promise<string> {
  const sa = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  };
  const jwt = await signRs256(header, claim, sa.private_key);
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!tokenRes.ok) throw new Error(`fcm_token_exchange_${tokenRes.status}`);
  const json = await tokenRes.json();
  if (!json.access_token) throw new Error('fcm_no_access_token');
  return json.access_token as string;
}

async function apnsBearer(): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT', kid: APNS_KEY_ID };
  const iat = Math.floor(Date.now() / 1000);
  const claim = { iss: APNS_TEAM_ID, iat };
  return signEs256(header, claim, APNS_KEY_P8);
}

async function signRs256(
  header: Record<string, string>,
  claim: Record<string, string | number>,
  privateKeyPem: string,
): Promise<string> {
  const enc = new TextEncoder();
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const claimB64 = b64url(enc.encode(JSON.stringify(claim)));
  const signingInput = `${headerB64}.${claimB64}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

async function signEs256(
  header: Record<string, string>,
  claim: Record<string, string | number>,
  privateKeyPem: string,
): Promise<string> {
  const enc = new TextEncoder();
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const claimB64 = b64url(enc.encode(JSON.stringify(claim)));
  const signingInput = `${headerB64}.${claimB64}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

function pemToBytes(pem: string): ArrayBuffer {
  const stripped = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(stripped);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function b64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Localised payload text
// ---------------------------------------------------------------------------

function titleFor(event: OutboxRow, lang: string): string {
  const titles: Record<string, Record<string, string>> = {
    recruitment_changed: { en: 'Admission update', ko: '모집요강 업데이트', uz: 'Qabul yangilanishi' },
    correction_notice:    { en: 'Correction notice', ko: '정정공고', uz: 'Tuzatish e’lon qilindi' },
    deadline_within_7d:   { en: 'Deadline in 7 days', ko: '마감 7일 전', uz: '7 kun qoldi' },
    deadline_within_24h:  { en: 'Deadline tomorrow', ko: '마감 24시간 전', uz: '24 soat qoldi' },
  };
  return titles[event.event_type]?.[lang] ?? titles[event.event_type]?.en ?? 'Update';
}

function bodyFor(event: OutboxRow, lang: string): string {
  const bodies: Record<string, Record<string, string>> = {
    recruitment_changed: {
      en: 'A tracked program was updated. Tap to view changes.',
      ko: '추적 중인 모집단위가 업데이트되었습니다.',
      uz: 'Kuzatilayotgan dastur yangilandi.',
    },
    correction_notice: {
      en: 'A correction notice was published. Review immediately.',
      ko: '정정공고가 게시되었습니다. 즉시 확인해 주세요.',
      uz: 'Tuzatish e’lon qilindi. Darhol tekshiring.',
    },
    deadline_within_7d: {
      en: 'A tracked deadline is 7 days away.',
      ko: '추적 중인 마감일이 7일 남았습니다.',
      uz: 'Kuzatilayotgan muddat 7 kun qoldi.',
    },
    deadline_within_24h: {
      en: 'A tracked deadline is in 24 hours.',
      ko: '추적 중인 마감일이 24시간 남았습니다.',
      uz: 'Kuzatilayotgan muddat 24 soat qoldi.',
    },
  };
  return bodies[event.event_type]?.[lang] ?? bodies[event.event_type]?.en ?? '';
}

// ---------------------------------------------------------------------------
// Main tick handler
// ---------------------------------------------------------------------------

Deno.serve(async () => {
  if (!PUSH_ENABLED) {
    return new Response(JSON.stringify({ ok: true, skipped: 'push_disabled' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Recover stuck rows: if anything is stuck in 'sending' for >5 min,
  // reset to pending. Idempotent.
  await sb
    .from('change_event_outbox')
    .update({ status: 'pending' })
    .eq('status', 'sending')
    .lt('queued_at', new Date(Date.now() - 5 * 60_000).toISOString());

  // Claim a batch.
  const { data: claimed, error: claimErr } = await sb
    .from('change_event_outbox')
    .update({ status: 'sending' })
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('queued_at', { ascending: true })
    .limit(MAX_BATCH)
    .select('id, target_table, target_id, event_type, payload, attempts');
  if (claimErr) {
    console.error('claim batch failed', claimErr);
    return new Response(JSON.stringify({ ok: false, error: 'claim_failed' }), { status: 500 });
  }
  const events: OutboxRow[] = (claimed as OutboxRow[] | null) ?? [];

  let sent = 0;
  let failed = 0;
  let dead = 0;

  for (const event of events) {
    const recipients = await findRecipients(event);
    let allOk = true;
    for (const r of recipients) {
      const result = await dispatchToPlatform(r, event);
      if (!result.ok) {
        console.warn('dispatch failed', { eventId: event.id, ...result });
        allOk = false;
      }
    }
    const newAttempts = event.attempts + 1;
    if (allOk) {
      await sb
        .from('change_event_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', event.id);
      sent++;
    } else {
      const nxt = nextRetry(newAttempts);
      await sb
        .from('change_event_outbox')
        .update({
          ...nxt,
          attempts: newAttempts,
          last_error: 'one_or_more_recipients_failed',
        })
        .eq('id', event.id);
      if (nxt.status === 'dead') dead++;
      else failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: events.length, sent, failed, dead }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
