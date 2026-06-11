// Mediateka call-recording proxy.
//
// The browser asks for /functions/v1/mediateka-recording?call_id=<calls.id>;
// this function checks the user is a logged-in staff member (owner or admin),
// looks up the upstream recording URL, fetches the MP3 from Mediateka on the
// server side, and streams the bytes back. The upstream URL and any API key
// never reach the browser.
//
// HTTP Range is forwarded so audio players can seek.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get('call_id');
    if (!callId) {
      return new Response('Missing call_id', { status: 400, headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isStaff = roles?.some((r: { role: string }) => ['owner', 'admin'].includes(r.role));
    if (!isStaff) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select('recording_url, voip_provider')
      .eq('id', callId)
      .maybeSingle();

    if (callError || !call) {
      return new Response('Call not found', { status: 404, headers: corsHeaders });
    }
    if (!call.recording_url) {
      return new Response('No recording for this call', { status: 404, headers: corsHeaders });
    }

    const upstreamHeaders: Record<string, string> = {};
    const range = req.headers.get('range');
    if (range) upstreamHeaders['range'] = range;

    // Mediateka recordings live on hanguk.sip.uz/api/v2/... and likely require
    // the same API key used for the CRM-API (Authorization: Bearer <key>).
    // Send it if it's configured; if Mediateka happens to accept unauth'd
    // requests for these URLs we'll still get a 200.
    const apiKey = Deno.env.get('MEDIATEKA_API_KEY');
    if (apiKey && call.voip_provider === 'mediateka') {
      upstreamHeaders['authorization'] = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(call.recording_url, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      const body = await upstream.text().catch(() => '');
      console.error('Upstream fetch failed:', upstream.status, body.slice(0, 500));
      return new Response(`Recording fetch failed (${upstream.status})`, { status: 502, headers: corsHeaders });
    }

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=300',
    };
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (err) {
    console.error('mediateka-recording error:', err);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
