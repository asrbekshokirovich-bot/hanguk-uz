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

// Mediateka's documentation isn't public, so this function tries the two
// most common endpoint shapes used by Uzbek/Russian VATS engines:
//   1. POST /crmapi/v1/makecall (action in the path)
//   2. POST /crmapi/v1 with cmd=makecall in the body (symmetric to the
//      inbound webhook which uses cmd=event / cmd=history / cmd=contact)
// Whichever returns a 2xx wins. If both fail, surface the last error so
// we can iterate.
async function attemptMediatekaMakeCall(opts: {
  baseUrl: string;
  apiKey: string;
  user: string;
  phone: string;
}) {
  const { baseUrl, apiKey, user, phone } = opts;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json, text/plain;q=0.9, */*;q=0.5',
  };
  const attempts: { name: string; url: string; body: string }[] = [
    {
      name: 'path-makecall',
      url: `${baseUrl.replace(/\/$/, '')}/makecall`,
      body: new URLSearchParams({ user, phone }).toString(),
    },
    {
      name: 'cmd-makecall',
      url: baseUrl.replace(/\/$/, ''),
      body: new URLSearchParams({ cmd: 'makecall', user, phone }).toString(),
    },
  ];

  let last: { name: string; status: number; body: string } | null = null;
  for (const a of attempts) {
    const resp = await fetch(a.url, { method: 'POST', headers, body: a.body });
    const text = await resp.text().catch(() => '');
    if (resp.ok) {
      return { ok: true as const, attempt: a.name, status: resp.status, body: text };
    }
    last = { name: a.name, status: resp.status, body: text.slice(0, 500) };
    // 404 / 405 / 400 on one shape is the signal to try the next shape.
    // Don't keep trying on auth (401/403) — that's a configuration issue,
    // not an endpoint guess problem.
    if (resp.status === 401 || resp.status === 403) break;
  }
  return { ok: false as const, last };
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

    const result = await attemptMediatekaMakeCall({ baseUrl, apiKey, user: mediatekaUser, phone });

    if (!result.ok) {
      console.error('Mediateka makecall failed:', result.last);
      return new Response(JSON.stringify({
        error: 'Mediateka rejected makecall',
        upstream_status: result.last?.status,
        upstream_body: result.last?.body,
        hint: 'Verify the endpoint path / required fields with Mediateka support if this persists.',
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
