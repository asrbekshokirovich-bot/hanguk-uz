// register-push-token — upsert a per-device push registration.
//
// Called by the Flutter app on cold boot and on platform token refresh.
// Idempotent: same (platform, token) pair updates last_seen_at and
// re-enables a previously disabled row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface RequestBody {
  platform?: 'android' | 'ios' | 'web';
  token?: string;
  app_version?: string;
  device_label?: string;
  preferred_lang?: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VALID_PLATFORMS = new Set(['android', 'ios', 'web']);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'missing_bearer' });
  }
  const jwt = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: 'invalid_token' });
  }
  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }
  const { platform, token, app_version, device_label, preferred_lang } = body;
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return jsonResponse(400, { error: 'invalid_platform' });
  }
  if (!token || typeof token !== 'string' || token.length < 8) {
    return jsonResponse(400, { error: 'invalid_token_string' });
  }

  const { error } = await serviceClient.from('user_push_tokens').upsert(
    {
      user_id: userId,
      platform,
      token,
      app_version: app_version ?? null,
      device_label: device_label ?? null,
      preferred_lang: preferred_lang ?? 'en',
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'platform,token' },
  );
  if (error) {
    console.error('user_push_tokens upsert failed', error);
    return jsonResponse(500, { error: 'upsert_failed' });
  }

  return jsonResponse(200, { ok: true });
});
