import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Server-side guest/lead authentication.
//
// Previously the browser authenticated guests by reading the `leads` table
// directly with the anon key (SELECT * WHERE email/password). That required a
// public RLS policy on `leads`, which exposed every lead row — including the
// plaintext `password` column — to anyone with the anon key. This function
// moves that logic server-side (service role) so the `leads` table can be
// locked to staff only.
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
    const { action, email, password, fullName } = await req.json();

    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return json({ success: false, code: 'MISSING_FIELDS', message: 'Email and password are required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Never return the password column to the client.
    const stripPassword = (lead: Record<string, unknown>) => {
      const { password: _pw, ...rest } = lead;
      return rest;
    };

    if (action === 'signup') {
      if (!fullName?.trim()) {
        return json({ success: false, code: 'MISSING_NAME', message: 'Full name is required' }, 400);
      }

      const { data: existing, error: checkError } = await admin
        .from('leads')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (checkError) {
        console.error('Signup duplicate-check error:', checkError);
        return json({ success: false, code: 'SERVER_ERROR', message: 'Failed to register' }, 500);
      }

      if (existing) {
        return json({ success: false, code: 'EMAIL_EXISTS', message: "Bu email allaqachon ro'yxatdan o'tgan." });
      }

      const now = new Date().toISOString();
      const { data: created, error: insertError } = await admin
        .from('leads')
        .insert({
          full_name: fullName,
          email: normalizedEmail,
          password,
          created_at: now,
          updated_at: now,
          login_count: 1,
          login_history: [now],
          source: 'Public Registration',
          status: 'new',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Signup insert error:', insertError);
        return json({ success: false, code: 'SERVER_ERROR', message: 'Failed to register' }, 500);
      }

      return json({ success: true, lead: stripPassword(created) });
    }

    // Default action: login
    const { data: lead, error: lookupError } = await admin
      .from('leads')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      console.error('Login lookup error:', lookupError);
      return json({ success: false, code: 'SERVER_ERROR', message: 'Failed to sign in' }, 500);
    }

    if (!lead) {
      return json({ success: false, code: 'EMAIL_NOT_FOUND', message: 'Email not found' });
    }

    if ((lead as Record<string, unknown>).password !== password) {
      return json({ success: false, code: 'INVALID_PASSWORD', message: 'Invalid email or password' });
    }

    const now = new Date().toISOString();
    const loginCount = ((lead as Record<string, number>).login_count || 0) + 1;
    const loginHistory = [now, ...(((lead as Record<string, string[]>).login_history) || [])].slice(0, 20);

    const { error: updateError } = await admin
      .from('leads')
      .update({ login_count: loginCount, login_history: loginHistory, updated_at: now })
      .eq('id', (lead as Record<string, string>).id);

    if (updateError) {
      console.error('Login stats update error (non-fatal):', updateError);
    }

    return json({
      success: true,
      lead: stripPassword({ ...lead, login_count: loginCount, login_history: loginHistory }),
    });
  } catch (error) {
    console.error('Unexpected guest-auth error:', error);
    return json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});
