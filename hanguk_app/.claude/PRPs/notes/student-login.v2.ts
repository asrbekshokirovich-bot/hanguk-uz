// student-login-v2 — fixes for magic-code login
// See plan: .claude/PRPs/plans/magic-code-login-fix.plan.md
//
// Differences from v1 (.claude/PRPs/notes/student-login.deployed-source.ts):
//   1. Eliminates O(N) listUsers pagination by using a SECURITY DEFINER RPC
//      `public.admin_get_auth_user_id_by_email(p_email)` to do a direct O(1)
//      lookup against auth.users.
//   2. Race-safe createUser: catches "email already exists" and falls
//      through to the existing-user path instead of returning 500.
//   3. Stops password drift: stable password is derived from the AUTH user's
//      id (after we know it), not the orphaned profile.user_id placeholder.
//      Subsequent logins no longer trigger an unnecessary password reset.
//   4. Typed error codes: BAD_INPUT / CODE_NOT_FOUND / CODE_LOOKUP_FAILED /
//      STAFF_BLOCKED / AUTH_CREATE_FAILED / AUTH_SIGNIN_FAILED / INTERNAL_ERROR.
//   5. Structured logging: one JSON line per request with non-PII codeMask,
//      result bucket, branch, and durationMs. Filter logs on result != 'OK'
//      for instant production diagnostics.
//   6. Returns the FULL session (access_token + refresh_token + expires_in
//      + expires_at + token_type + user) so the Dart client can use
//      recoverSession() instead of the fragile setSession(refresh_token-only).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type ErrorCode =
  | 'BAD_INPUT'
  | 'CODE_NOT_FOUND'
  | 'CODE_LOOKUP_FAILED'
  | 'STAFF_BLOCKED'
  | 'AUTH_CREATE_FAILED'
  | 'AUTH_SIGNIN_FAILED'
  | 'INTERNAL_ERROR';

function err(code: ErrorCode, detail: string | undefined, status: number) {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function logEvent(o: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'student-login-v2', ts: new Date().toISOString(), ...o }));
}

function maskCode(code: string): string {
  if (!code) return '***';
  return '*'.repeat(Math.max(0, code.length - 3)) + code.slice(-3);
}

function isAlreadyRegistered(msg: string | undefined): boolean {
  if (!msg) return false;
  return /already (registered|exists|been registered)|email_exists|user_already_exists/i.test(msg);
}

Deno.serve(async (req) => {
  const startedAt = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const rawCode = (body as { magicCode?: unknown }).magicCode;

    if (typeof rawCode !== 'string' || !rawCode.trim()) {
      logEvent({ result: 'BAD_INPUT', durationMs: Date.now() - startedAt });
      return err('BAD_INPUT', 'magicCode is required', 400);
    }

    // Identical normalisation to the Dart client (auth_repository.dart:76)
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, '');
    const codeMask = maskCode(code);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Profile lookup ───────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, full_name, magic_code')
      .eq('magic_code', code)
      .maybeSingle();

    if (profileError) {
      logEvent({ codeMask, result: 'CODE_LOOKUP_FAILED', detail: profileError.message, durationMs: Date.now() - startedAt });
      return err('CODE_LOOKUP_FAILED', profileError.message, 500);
    }
    if (!profile) {
      logEvent({ codeMask, result: 'CODE_NOT_FOUND', durationMs: Date.now() - startedAt });
      return err('CODE_NOT_FOUND', undefined, 401);
    }

    // 2. Reject staff ──────────────────────────────────────────────────────
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.user_id);

    const isStaff = roles?.some((r: { role: string }) => ['staff', 'admin', 'owner'].includes(r.role));
    if (isStaff) {
      logEvent({ codeMask, result: 'STAFF_BLOCKED', durationMs: Date.now() - startedAt });
      return err('STAFF_BLOCKED', 'Staff members must use username/password', 403);
    }

    // 3. Locate the auth user ──────────────────────────────────────────────
    const email = `student-${profile.user_id}@hanguk.local`;

    type AuthUser = { id: string; email: string | null };
    let existingUser: AuthUser | null = null;

    // 3a. Direct lookup by id (fast, succeeds on returning students whose
    // profile.user_id was correctly updated by the handle_new_user trigger).
    const { data: byId } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
    if (byId?.user) {
      existingUser = { id: byId.user.id, email: byId.user.email ?? null };
    }

    // 3b. Direct lookup by deterministic email via SECURITY DEFINER RPC.
    // O(1). Replaces the v1 paginated listUsers loop entirely.
    if (!existingUser) {
      const { data: foundId, error: rpcErr } = await supabaseAdmin.rpc(
        'admin_get_auth_user_id_by_email',
        { p_email: email },
      );
      if (rpcErr) {
        // RPC missing or permission denied — treat as "not found" so the
        // create path runs, but log loudly so we can fix the migration.
        logEvent({ codeMask, branch: 'rpc_lookup_failed', detail: rpcErr.message });
      }
      if (typeof foundId === 'string' && foundId) {
        const { data: byEmailUser } = await supabaseAdmin.auth.admin.getUserById(foundId);
        if (byEmailUser?.user) {
          existingUser = { id: byEmailUser.user.id, email: byEmailUser.user.email ?? null };
        }
      }
    }

    // 4. Sign in (existing) or create (new) ────────────────────────────────
    let session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at?: number;
      token_type: string;
      user: { id: string; email: string | null };
    } | null = null;
    let branch = 'unknown';

    if (existingUser) {
      // Stable password derived from the CONFIRMED auth user id — never drifts.
      const stablePassword = `student-${existingUser.id}-hanguk-A1!`;

      // Repair drift if the trigger never updated profile.user_id.
      if (profile.user_id !== existingUser.id) {
        await supabaseAdmin
          .from('profiles')
          .update({ user_id: existingUser.id })
          .eq('id', profile.id);
      }

      const signInEmail = existingUser.email ?? email;
      const { data: signed, error: siErr } = await supabaseAdmin.auth.signInWithPassword({
        email: signInEmail,
        password: stablePassword,
      });

      if (siErr || !signed?.session) {
        // Legacy / mismatched password: reset to the canonical value once.
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          { password: stablePassword },
        );
        if (updErr) {
          logEvent({ codeMask, branch: 'existing_reset_update_failed', result: 'AUTH_SIGNIN_FAILED', detail: updErr.message });
          return err('AUTH_SIGNIN_FAILED', updErr.message, 500);
        }
        const { data: retry, error: retryErr } = await supabaseAdmin.auth.signInWithPassword({
          email: signInEmail,
          password: stablePassword,
        });
        if (retryErr || !retry?.session) {
          logEvent({ codeMask, branch: 'existing_reset_signin_failed', result: 'AUTH_SIGNIN_FAILED', detail: retryErr?.message });
          return err('AUTH_SIGNIN_FAILED', retryErr?.message, 500);
        }
        session = retry.session as typeof session;
        branch = 'existing_reset';
      } else {
        session = signed.session as typeof session;
        branch = 'existing';
      }
    } else {
      // No existing user — create one. Race-safe: if email already exists,
      // someone else (or a parallel request) created it; sign in with the
      // stable password and reset if needed.
      const tempPassword = `student-${profile.user_id}-hanguk-A1!`;
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name,
          is_student: true,
          original_user_id: profile.user_id,
        },
      });

      if (createErr && !isAlreadyRegistered(createErr.message)) {
        logEvent({ codeMask, branch: 'create_failed', result: 'AUTH_CREATE_FAILED', detail: createErr.message });
        return err('AUTH_CREATE_FAILED', createErr.message, 500);
      }

      if (created?.user) {
        // Successfully created. Trigger handle_new_user should run and
        // update profile.user_id. We deliberately do NOT migrate storage
        // files here (the trigger and ON UPDATE CASCADE handle DB FKs;
        // storage migration is best-effort below).
        const newUserId = created.user.id;
        const stablePassword = `student-${newUserId}-hanguk-A1!`;

        // Reset password to the canonical id-derived value (so subsequent
        // logins won't need a reset round-trip).
        if (newUserId !== profile.user_id) {
          await supabaseAdmin.auth.admin.updateUserById(newUserId, {
            password: stablePassword,
          });
        }

        const { data: signed, error: siErr } = await supabaseAdmin.auth.signInWithPassword({
          email,
          password: stablePassword,
        });
        if (siErr || !signed?.session) {
          logEvent({ codeMask, branch: 'created_signin_failed', result: 'AUTH_SIGNIN_FAILED', detail: siErr?.message });
          return err('AUTH_SIGNIN_FAILED', siErr?.message, 500);
        }
        session = signed.session as typeof session;
        branch = 'created';

        // Best-effort storage migration so files uploaded by staff
        // (under the orphan profile.user_id folder) are reachable.
        if (newUserId !== profile.user_id) {
          try {
            const { data: oldFiles } = await supabaseAdmin.storage
              .from('student-documents')
              .list(profile.user_id);
            if (oldFiles && oldFiles.length > 0) {
              await Promise.allSettled(
                oldFiles.map((f) =>
                  supabaseAdmin.storage
                    .from('student-documents')
                    .move(`${profile.user_id}/${f.name}`, `${newUserId}/${f.name}`),
                ),
              );
            }
          } catch (e) {
            logEvent({ codeMask, branch: 'created_storage_warning', detail: String(e) });
          }
        }
      } else {
        // Race: email already existed but our pre-checks didn't find it.
        // Look it up again via RPC and treat as existing-user.
        const { data: foundId } = await supabaseAdmin.rpc('admin_get_auth_user_id_by_email', { p_email: email });
        if (typeof foundId !== 'string' || !foundId) {
          logEvent({ codeMask, branch: 'create_race_lookup_failed', result: 'AUTH_CREATE_FAILED', detail: 'email exists but cannot resolve user id' });
          return err('AUTH_CREATE_FAILED', 'race-condition during account creation', 500);
        }
        const { data: byEmailUser } = await supabaseAdmin.auth.admin.getUserById(foundId);
        if (!byEmailUser?.user) {
          logEvent({ codeMask, branch: 'create_race_user_missing', result: 'AUTH_CREATE_FAILED' });
          return err('AUTH_CREATE_FAILED', 'race-condition: user vanished', 500);
        }
        const stablePassword = `student-${byEmailUser.user.id}-hanguk-A1!`;
        // Force-reset password to known stable value, then sign in.
        await supabaseAdmin.auth.admin.updateUserById(byEmailUser.user.id, { password: stablePassword });
        const { data: signed, error: siErr } = await supabaseAdmin.auth.signInWithPassword({
          email: byEmailUser.user.email ?? email,
          password: stablePassword,
        });
        if (siErr || !signed?.session) {
          logEvent({ codeMask, branch: 'create_race_signin_failed', result: 'AUTH_SIGNIN_FAILED', detail: siErr?.message });
          return err('AUTH_SIGNIN_FAILED', siErr?.message, 500);
        }
        session = signed.session as typeof session;
        branch = 'create_race_recovered';
        // Repair profile.user_id if drifted
        if (profile.user_id !== byEmailUser.user.id) {
          await supabaseAdmin.from('profiles').update({ user_id: byEmailUser.user.id }).eq('id', profile.id);
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    logEvent({ result: 'INTERNAL_ERROR', detail: String(e), durationMs: Date.now() - startedAt });
    return err('INTERNAL_ERROR', String(e), 500);
  }
});
