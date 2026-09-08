// mediateka-makecall
// ----------------------------------------------------------------------------
// Click-to-call: the CRM asks Mediateka (hanguk.sip.uz/crmapi/v1/makecall) to
// dial `phone` from the operator's extension. Staff-only (owner/admin JWT).
// Every upstream attempt is captured into voip_webhook_captures for debugging.
//
// Recovered 2026-09-07 from the live Supabase project (lysjdtyanhdfphqyijsr,
// version 17, deployed 2026-06-05). It had only ever existed on the server.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function toMediatekaPhone(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('9')) d = '998' + d;
  return d;
}

async function attemptMediatekaMakeCall(opts: {
  baseUrl: string;
  apiKey: string;
  user: string;
  phone: string;
  // deno-lint-ignore no-explicit-any
  captureRow: (row: Record<string, any>) => Promise<void>;
}) {
  const { baseUrl, apiKey, user, phone, captureRow } = opts;
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

  const isBodyFailure = (body: string, contentType: string): boolean => {
    if (!body) return false;
    const ct = contentType.toLowerCase();
    if (ct.includes('text/html')) return true;
    const t = body.trim();
    if (t.startsWith('<')) return true;
    try {
      const j = JSON.parse(t);
      if (j && typeof j === 'object') {
        if (j.error || j.errors) return true;
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
      return { ok: true as const, attempt: a.name, status: resp.status, body: text };
    }
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
