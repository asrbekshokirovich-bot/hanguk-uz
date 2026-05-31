// student-login-v2 (plain JS, no TypeScript syntax) — fixes for magic-code login
// See plan: .claude/PRPs/plans/magic-code-login-fix.plan.md

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function err(code, detail, status) {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function logEvent(o) {
  try {
    console.log(JSON.stringify({ fn: 'student-login-v2', ts: new Date().toISOString(), ...o }));
  } catch (_) {}
}

function maskCode(code) {
  if (!code) return '***';
  return '*'.repeat(Math.max(0, code.length - 3)) + code.slice(-3);
}

function isAlreadyRegistered(msg) {
  if (!msg) return false;
  return /already (registered|exists|been registered)|email_exists|user_already_exists/i.test(msg);
}

Deno.serve(async (req) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = body && body.magicCode;

    if (typeof rawCode !== 'string' || !rawCode.trim()) {
      logEvent({ result: 'BAD_INPUT', durationMs: Date.now() - startedAt });
      return err('BAD_INPUT', 'magicCode is required', 400);
    }

    const code = rawCode.trim().toUpperCase().replace(/\s+/g, '');
    const codeMask = maskCode(code);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Profile lookup
    const profileResp = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, full_name, magic_code')
      .eq('magic_code', code)
      .maybeSingle();

    if (profileResp.error) {
      logEvent({ codeMask, result: 'CODE_LOOKUP_FAILED', detail: profileResp.error.message, durationMs: Date.now() - startedAt });
      return err('CODE_LOOKUP_FAILED', profileResp.error.message, 500);
    }
    const profile = profileResp.data;
    if (!profile) {
      logEvent({ codeMask, result: 'CODE_NOT_FOUND', durationMs: Date.now() - startedAt });
      return err('CODE_NOT_FOUND', undefined, 401);
    }

    // 2. Reject staff
    const rolesResp = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.user_id);
    const roles = rolesResp.data || [];
    const isStaff = roles.some(r => ['staff', 'admin', 'owner'].includes(r.role));
    if (isStaff) {
      logEvent({ codeMask, result: 'STAFF_BLOCKED', durationMs: Date.now() - startedAt });
      return err('STAFF_BLOCKED', 'Staff members must use username/password', 403);
    }

    // 3. Locate auth user
    const email = `student-${profile.user_id}@hanguk.local`;
    let existingUser = null;

    // 3a. Direct lookup by id
    const byIdResp = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
    if (byIdResp.data && byIdResp.data.user) {
      existingUser = { id: byIdResp.data.user.id, email: byIdResp.data.user.email || null };
    }

    // 3b. Direct lookup by deterministic email via SECURITY DEFINER RPC (O(1))
    if (!existingUser) {
      const rpcResp = await supabaseAdmin.rpc('admin_get_auth_user_id_by_email', { p_email: email });
      if (rpcResp.error) {
        logEvent({ codeMask, branch: 'rpc_lookup_failed', detail: rpcResp.error.message });
      }
      const foundId = rpcResp.data;
      if (typeof foundId === 'string' && foundId) {
        const byEmailResp = await supabaseAdmin.auth.admin.getUserById(foundId);
        if (byEmailResp.data && byEmailResp.data.user) {
          existingUser = { id: byEmailResp.data.user.id, email: byEmailResp.data.user.email || null };
        }
      }
    }

    let session = null;
    let branch = 'unknown';

    if (existingUser) {
      // Stable password derived from CONFIRMED auth user id — never drifts
      const stablePassword = `student-${existingUser.id}-hanguk-A1!`;

      // Repair drift if profile.user_id stale
      if (profile.user_id !== existingUser.id) {
        await supabaseAdmin.from('profiles').update({ user_id: existingUser.id }).eq('id', profile.id);
      }

      const signInEmail = existingUser.email || email;
      const signedResp = await supabaseAdmin.auth.signInWithPassword({
        email: signInEmail,
        password: stablePassword,
      });

      if (signedResp.error || !signedResp.data || !signedResp.data.session) {
        // Reset to canonical, retry
        const updResp = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: stablePassword });
        if (updResp.error) {
          logEvent({ codeMask, branch: 'existing_reset_update_failed', result: 'AUTH_SIGNIN_FAILED', detail: updResp.error.message });
          return err('AUTH_SIGNIN_FAILED', updResp.error.message, 500);
        }
        const retryResp = await supabaseAdmin.auth.signInWithPassword({
          email: signInEmail,
          password: stablePassword,
        });
        if (retryResp.error || !retryResp.data || !retryResp.data.session) {
          logEvent({ codeMask, branch: 'existing_reset_signin_failed', result: 'AUTH_SIGNIN_FAILED', detail: retryResp.error && retryResp.error.message });
          return err('AUTH_SIGNIN_FAILED', retryResp.error && retryResp.error.message, 500);
        }
        session = retryResp.data.session;
        branch = 'existing_reset';
      } else {
        session = signedResp.data.session;
        branch = 'existing';
      }
    } else {
      // No existing user — create one. Race-safe.
      const tempPassword = `student-${profile.user_id}-hanguk-A1!`;
      const createResp = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name,
          is_student: true,
          original_user_id: profile.user_id,
        },
      });

      const createErr = createResp.error;
      if (createErr && !isAlreadyRegistered(createErr.message)) {
        logEvent({ codeMask, branch: 'create_failed', result: 'AUTH_CREATE_FAILED', detail: createErr.message });
        return err('AUTH_CREATE_FAILED', createErr.message, 500);
      }

      if (createResp.data && createResp.data.user) {
        const newUserId = createResp.data.user.id;
        const stablePassword = `student-${newUserId}-hanguk-A1!`;

        if (newUserId !== profile.user_id) {
          await supabaseAdmin.auth.admin.updateUserById(newUserId, { password: stablePassword });
        }

        const signedResp = await supabaseAdmin.auth.signInWithPassword({
          email,
          password: stablePassword,
        });
        if (signedResp.error || !signedResp.data || !signedResp.data.session) {
          logEvent({ codeMask, branch: 'created_signin_failed', result: 'AUTH_SIGNIN_FAILED', detail: signedResp.error && signedResp.error.message });
          return err('AUTH_SIGNIN_FAILED', signedResp.error && signedResp.error.message, 500);
        }
        session = signedResp.data.session;
        branch = 'created';

        // Best-effort storage migration
        if (newUserId !== profile.user_id) {
          try {
            const listResp = await supabaseAdmin.storage.from('student-documents').list(profile.user_id);
            const oldFiles = listResp.data || [];
            if (oldFiles.length > 0) {
              await Promise.allSettled(
                oldFiles.map(f =>
                  supabaseAdmin.storage
                    .from('student-documents')
                    .move(`${profile.user_id}/${f.name}`, `${newUserId}/${f.name}`)
                )
              );
            }
          } catch (e) {
            logEvent({ codeMask, branch: 'created_storage_warning', detail: String(e) });
          }
        }
      } else {
        // Race: email already existed. Look up via RPC, recover.
        const rpcResp = await supabaseAdmin.rpc('admin_get_auth_user_id_by_email', { p_email: email });
        const foundId = rpcResp.data;
        if (typeof foundId !== 'string' || !foundId) {
          logEvent({ codeMask, branch: 'create_race_lookup_failed', result: 'AUTH_CREATE_FAILED', detail: 'email exists but cannot resolve user id' });
          return err('AUTH_CREATE_FAILED', 'race-condition during account creation', 500);
        }
        const byEmailResp = await supabaseAdmin.auth.admin.getUserById(foundId);
        if (!byEmailResp.data || !byEmailResp.data.user) {
          logEvent({ codeMask, branch: 'create_race_user_missing', result: 'AUTH_CREATE_FAILED' });
          return err('AUTH_CREATE_FAILED', 'race-condition: user vanished', 500);
        }
        const stablePassword = `student-${byEmailResp.data.user.id}-hanguk-A1!`;
        await supabaseAdmin.auth.admin.updateUserById(byEmailResp.data.user.id, { password: stablePassword });
        const signedResp = await supabaseAdmin.auth.signInWithPassword({
          email: byEmailResp.data.user.email || email,
          password: stablePassword,
        });
        if (signedResp.error || !signedResp.data || !signedResp.data.session) {
          logEvent({ codeMask, branch: 'create_race_signin_failed', result: 'AUTH_SIGNIN_FAILED', detail: signedResp.error && signedResp.error.message });
          return err('AUTH_SIGNIN_FAILED', signedResp.error && signedResp.error.message, 500);
        }
        session = signedResp.data.session;
        branch = 'create_race_recovered';
        if (profile.user_id !== byEmailResp.data.user.id) {
          await supabaseAdmin.from('profiles').update({ user_id: byEmailResp.data.user.id }).eq('id', profile.id);
        }
      }
    }

    if (!session) {
      logEvent({ codeMask, branch, result: 'AUTH_SIGNIN_FAILED', detail: 'session null after sign-in' });
      return err('AUTH_SIGNIN_FAILED', 'session generation failed', 500);
    }

    logEvent({ codeMask, branch, result: 'OK', durationMs: Date.now() - startedAt });

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        profile: {
          id: profile.id,
          full_name: profile.full_name,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    logEvent({ result: 'INTERNAL_ERROR', detail: String(e), durationMs: Date.now() - startedAt });
    return err('INTERNAL_ERROR', String(e), 500);
  }
});
