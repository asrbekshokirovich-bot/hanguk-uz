import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serviceKey } from "../_shared/keys.ts";
import { ipLimiter } from "../_shared/rate-limiter.ts";
import { type GuestDb, type GuestLead, handleGuestAuth, type PasswordCheck } from "./logic.ts";

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
//
// The rules are in logic.ts; this file is the database behind them.

/** The function or table the migration adds is not there yet. */
const notMigrated = (error: { code?: string } | null) =>
  !!error && ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? '');

const LEAD_COLUMNS = 'id, full_name, email, password, login_count, login_history';

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
    const input = await req.json();

    // Nobody signs in here: anyone can call it. A browser that hammers it is
    // slowed down (per running instance — the per-account lock in the
    // database is what actually stops password guessing).
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const allowed = input?.action === 'signup'
      ? await ipLimiter.checkLimit(`guest-signup:${ip}`, 5, 60 * 60 * 1000)
      : await ipLimiter.checkLimit(`guest-login:${ip}`, 30, 10 * 60 * 1000);
    if (!allowed) {
      return json({ success: false, code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again later.' }, 429);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const db: GuestDb = {
      async findLeadByEmail(email) {
        const { data, error } = await admin.from('leads').select(LEAD_COLUMNS).eq('email', email).limit(1).maybeSingle();
        if (error) throw error;
        return (data as GuestLead | null) ?? null;
      },
      async insertLead({ full_name, email, phone, now }) {
        const row: Record<string, unknown> = {
          full_name,
          email,
          created_at: now,
          updated_at: now,
          login_count: 1,
          login_history: [now],
          source: 'Public Registration',
          status: 'new',
        };
        if (phone) {
          // Somebody to call: a "Yangi lid", as a request from the app is
          // (app_quiz_submit). Its 10 minutes start now, or at 09:00 on the
          // next working day when the site is used after hours.
          const { data: slaStart, error: slaError } = await admin.rpc('fn_lead_sla_start', { p_at: now });
          if (slaError) console.error('fn_lead_sla_start failed (non-fatal):', slaError.message);
          row.phone = phone;
          row.contact_channel = 'Sayt formasi';
          row.new_lead_at = now;
          row.sla_start_at = typeof slaStart === 'string' && slaStart ? slaStart : now;
        }
        const { data, error } = await admin
          .from('leads')
          .insert(row)
          .select('id, full_name, email')
          .single();
        if (error) throw error;
        return data as GuestLead;
      },
      async setPassword(leadId, password) {
        const { error } = await admin.rpc('fn_guest_set_password', { p_lead_id: leadId, p_password: password });
        if (notMigrated(error)) return 'missing';
        if (error) throw error;
        return 'ok';
      },
      async checkPassword(leadId, password): Promise<PasswordCheck> {
        const { data, error } = await admin.rpc('fn_guest_check_password', { p_lead_id: leadId, p_password: password });
        if (notMigrated(error)) return 'missing';
        if (error) throw error;
        return (['ok', 'wrong', 'locked', 'none'].includes(data as string) ? data : 'wrong') as PasswordCheck;
      },
      async setLegacyPassword(leadId, password) {
        const { error } = await admin.from('leads').update({ password }).eq('id', leadId);
        if (error) throw error;
      },
      async recordLogin(leadId, count, history, now) {
        const { error } = await admin
          .from('leads')
          .update({ login_count: count, login_history: history, updated_at: now })
          .eq('id', leadId);
        if (error) console.error('Login stats update error (non-fatal):', error);
      },
    };

    const reply = await handleGuestAuth(db, input ?? {}, new Date().toISOString());
    return json(reply.body, reply.status);
  } catch (error) {
    console.error('Unexpected guest-auth error:', error);
    return json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  }
});
