// Mediateka click-to-call edge function.
//
// Browser hits POST /functions/v1/mediateka-makecall { phone }
//   ↓ (Supabase verifies JWT, we verify owner/admin role)
//   ↓ (POST to Mediateka https://hanguk.sip.uz/crmapi/v1/... with MEDIATEKA_API_KEY)
//   ↓ Mediateka rings the agent's softphone first, then dials the customer
//   ← we return { success: true } so the browser can show "Calling..."
//
// The actual call_id / status / recording will arrive later through the
// existing voip-webhook (Mediateka fires cmd=event then cmd=history). We
// don't pre-insert a `calls` row from here — the webhook is authoritative.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Mediateka phone numbers in inbound webhooks are bare digits ("998704848815"),
// no '+'. Normalise to the same shape before handing back to the API.
function toMediatekaPhone(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('9')) d = '998' + d; // +998 mobile w/o country
  return d;
}

// Mediateka's documentation isn't public, so this function tries multiple
// endpoint shapes used by Uzbek/Russian VATS engines. We log every attempt's
// request + response to the voip_webhook_captures table so the exact body
// Mediateka returned is inspectable via SQL — many of these engines respond
// 200 with an error JSON, which a naive .ok check misclassifies as success.
async function attemptMediatekaMakeCall(opts: {
  baseUrl: string;
  apiKey: string;
  user: string;
  phone: string;
  // deno-lint-ignore no-explicit-any
  captureRow: (row: Record<string, any>) => Promise<void>;
}) {
  const { baseUrl, apiKey, user, phone, captureRow } = opts;
  // Mediateka authenticates outbound CRM calls the SAME way it authenticates
  // its own inbound webhooks: a `crm_token` field in the request body. A
  // capture from the first live test confirmed this — a Bearer header gets
  // "Empty token" from /crmapi/v1/makecall.
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json, text/plain;q=0.9, */*;q=0.5',
  };
  const trimmedBase = baseUrl.replace(/\/$/, '');
  const attempts: { name: string; url: string; body: string }[] = [
    { name: 'makecall-crm_token-user-phone',
      url: `${trimmedBase}/makecall`,
      body: new URLSearchParams({ crm_token: apiKey, user, phone }).toString() },
    { name: 'makecall-crm_token-ext-phone',
      url: `${trimmedBase}/makecall`,
      body: new URLSearchParams({ crm_token: apiKey, ext: user === 'admin' ? '701' : user, phone }).toString() },
  ];

  // Detect failure even when status is 200 — Mediateka sometimes returns an
  // admin-portal HTML page on the wrong endpoint, and the JSON error path
  // returns 400 with {"message":"..."}.
  const isBodyFailure = (body: string, contentType: string): boolean => {
    if (!body) return false;
    const ct = contentType.toLowerCase();
    // HTML response from a JSON API is always a failure — it's the admin
    // dashboard / unsupported-browser page served by mistake.
    if (ct.includes('text/html')) return true;
    const t = body.trim();
    if (t.startsWith('<')) return true;
    try {
      const j = JSON.parse(t);
      if (j && typeof j === 'object') {
        if (j.error || j.errors) return true;
        // Mediateka uses {message: "Empty token"} for errors.
        if (typeof j.message === 'string' && /empty|invalid|denied|fail|error|not\s*found/i.test(j.message)) return true;
        if ('success' in j && !j.success) return true;
        if ('ok' in j && !j.ok) return true;
        if ('status' in j && typeof j.status === 'string' && /err|fail|denied/i.test(j.status)) return true;
        if ('result' in j && typeof j.result === 'string' && /err|fail/i.test(j.result)) return true;
      }
    } catch {
      if (/error|denied|not.?found|unauthor/i.test(t)) return true;
    }
    return false;
  };

  let firstAcceptedAttempt: { name: string; body: string } | null = null;
  let last: { name: string; status: number; body: string } | null = null;

  for (const a of attempts) {
    const resp = await fetch(a.url, { method: 'POST', headers, body: a.body });
    const text = await resp.text().catch(() => '');
    await captureRow({
      method: 'OUT',
      url: a.url,
      query: {},
      headers: { 'attempt': a.name, 'upstream_status': String(resp.status) },
      content_type: resp.headers.get('content-type') || '',
      raw_body: text,
      parsed_payload: { request_body: a.body, attempt: a.name, upstream_status: resp.status },
      notes: 'mediateka-makecall outbound attempt',
    });

    last = { name: a.name, status: resp.status, body: text.slice(0, 1000) };

    const looksOk = resp.ok && !isBodyFailure(text, resp.headers.get('content-type') || '');
    if (looksOk) {
      // Found a genuinely successful shape. Stop.
      return { ok: true as const, attempt: a.name, status: resp.status, body: text };
    }
    // Remember the first attempt that at least returned 2xx so we can
    // report it back to the caller even when none look truly successful.
    if (resp.ok && !firstAcceptedAttempt) firstAcceptedAttempt = { name: a.name, body: text.slice(0, 500) };

    if (resp.status === 401 || resp.status === 403) break;
  }
  return { ok: false as const, last, firstAcceptedAttempt };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const isStaff = roles?.some((r: { role: string }) => ['owner', 'admin'].includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const phoneRaw = String(body.phone || '');
    if (!phoneRaw) {
      return new Response(JSON.stringify({ error: 'Missing phone' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const phone = toMediatekaPhone(phoneRaw);
    if (phone.length < 7) {
      return new Response(JSON.stringify({ error: 'Phone too short' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('MEDIATEKA_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server missing MEDIATEKA_API_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Until we wire a per-staff_id -> Mediateka user/extension map, dial as
    // 'admin' (ext. 701 — the only seat provisioned today).
    const mediatekaUser = Deno.env.get('MEDIATEKA_DEFAULT_USER') || 'admin';
    const baseUrl = Deno.env.get('MEDIATEKA_API_BASE') || 'https://hanguk.sip.uz/crmapi/v1';

    const captureRow = async (row: Record<string, unknown>) => {
      try { await supabaseAdmin.from('voip_webhook_captures').insert(row); }
      catch (e) { console.error('capture insert failed:', e); }
    };

    const result = await attemptMediatekaMakeCall({ baseUrl, apiKey, user: mediatekaUser, phone, captureRow });

    if (!result.ok) {
      console.error('Mediateka makecall failed across all attempts:', result.last);
      return new Response(JSON.stringify({
        error: 'Mediateka rejected makecall',
        upstream_status: result.last?.status,
        upstream_body: result.last?.body,
        first_2xx_attempt: result.firstAcceptedAttempt,
        hint: 'Check voip_webhook_captures rows with notes="mediateka-makecall outbound attempt" for full responses.',
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      attempt: result.attempt,
      phone,
      mediateka_user: mediatekaUser,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('mediateka-makecall error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
