import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// "Konsultantga murojaat" on hanguk.uz/auth: a contact request that becomes a
// lead (public.site_contact_request, service role only).
//
// This function used to run a guest sign-up / login with an email and a
// password stored in leads.password as typed, and compared as plain text; the
// "account" led to /guest-portal, a page that does not exist. The owner chose a
// plain contact request instead (2026-10-14). No password is read, stored or
// compared any more, and nothing about the lead is sent back to the browser
// (the old login returned the whole row, staff notes included).
//
// Old cached pages may still send action 'signup' / 'login': they get
// FORM_UPDATED, and the page asks for a reload.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, fullName, phone, email, note } = body ?? {};

    if (action !== 'contact') {
      return json({ success: false, code: 'FORM_UPDATED' });
    }
    if (typeof fullName !== 'string' || typeof phone !== 'string') {
      return json({ success: false, code: 'MISSING_FIELDS' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await admin.rpc('site_contact_request', {
      p_name: fullName,
      p_phone: phone,
      p_email: typeof email === 'string' ? email : null,
      p_note: typeof note === 'string' ? note : null,
    });

    if (error) {
      console.error('site_contact_request error:', error.message);
      return json({ success: false, code: 'SERVER_ERROR' }, 500);
    }

    const status = (data as { status?: string } | null)?.status;
    if (status === 'ok') return json({ success: true });
    // invalid_name | invalid_phone | invalid_email | student | busy
    return json({ success: false, code: (status ?? 'SERVER_ERROR').toUpperCase() });
  } catch (error) {
    console.error('Unexpected guest-auth error:', error);
    return json({ success: false, code: 'SERVER_ERROR' }, 500);
  }
});
