// student-login-v2 — magic-code login for contracted Hanguk students.
//
// Replaces `student-login` (v1) per .claude/PRPs/plans/magic-code-login-fix.plan.md.
// v1 stays deployed for 48-hour rollback safety; once v2 logs are clean, v1 is
// retired.
//
// Bugs fixed vs v1:
//   - Bug A: createUser race. v1's "two simultaneous requests with the same code"
//            path returned "Failed to create session" deterministically for the
//            losing request. v2 catches the duplicate-email error, re-looks-up
//            the user that the winning request just created, and continues.
//   - Bug D: stablePassword drift. v1 derived the password from
//            profile.user_id BEFORE confirming whether profile.user_id had
//            drifted (e.g. handle_new_user trigger updated it). Result: every
//            subsequent login fell into the password-reset retry path. v2
//            derives the password from the resolved auth-user id only after
//            the lookup succeeds.
//   - Bug E: opaque error messages. v1 returned the same string for several
//            very different failures, so counsellors couldn't diagnose.
//            v2 returns typed error codes the Dart client maps to messages.
//   - Bug F: logging in rewrote the student's password. See "Minting a
//            session" below — this is the one that reached real students.
//
// Bugs explicitly NOT fixed in this slice (deferred to a follow-up):
//   - Bug B (listUsers pagination scaling) — needs a profiles.auth_email column.
//   - Bug C (client setSession refresh-only)             — Dart-side change.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

type ErrorCode =
  | 'CODE_REQUIRED'
  | 'CODE_NOT_FOUND'
  | 'CODE_LOOKUP_FAILED'
  | 'STAFF_BLOCKED'
  | 'AUTH_CREATE_FAILED'
  | 'AUTH_SIGNIN_FAILED'
  | 'SERVER_MISCONFIGURED'
  | 'INTERNAL_ERROR'

function errorResponse(
  code: ErrorCode,
  detail: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function logEvent(event: Record<string, unknown>): void {
  // One JSON line per request — easy to filter in the Supabase logs view.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }))
}

function isDuplicateEmailError(err: unknown): boolean {
  if (!err) return false
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : ''
  const lowered = message.toLowerCase()
  return (
    lowered.includes('already been registered') ||
    lowered.includes('already exists') ||
    lowered.includes('duplicate key') ||
    lowered.includes('email_exists')
  )
}

async function findExistingAuthUser(
  admin: ReturnType<typeof createClient>,
  profileUserId: string,
  deterministicEmail: string,
): Promise<{ id: string; email: string } | null> {
  // Primary: O(1) lookup by id.
  const { data: byId } = await admin.auth.admin.getUserById(profileUserId)
  if (byId?.user) {
    return { id: byId.user.id, email: byId.user.email ?? deterministicEmail }
  }

  // Secondary: paginated email scan. Capped at 25 pages (= 25 000 users) to
  // avoid runaway latency. Phase-3R-C will replace this with a stored
  // auth_email column for true O(1).
  const PAGE_LIMIT = 25
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (!list?.users || list.users.length === 0) return null
    const found = list.users.find((u) => u.email === deterministicEmail)
    if (found) return { id: found.id, email: found.email ?? deterministicEmail }
    if (list.users.length < 1000) return null
  }
  return null
}

/**
 * Mint a session for `email` without touching the account's password.
 *
 * Bug F. The password path below authenticates as the student by *setting* a
 * password it derives itself, and resetting the account's real one whenever the
 * derived value does not match. For the ~47 students whose accounts were made
 * by `create-student` — `omonovashokhistakomilkizi@hanguk.local` and the like,
 * with a password staff chose — the derived value never matches, so the first
 * magic-code login silently overwrote a working credential. Nothing told the
 * student, or the counsellor who set it.
 *
 * The magic code has already proved who this is by the time we get here. There
 * is no reason to prove it a second time with a password, so this asks GoTrue
 * for a one-time token and exchanges it for a session. The stored password is
 * neither read nor written.
 *
 * Returns null rather than throwing: the caller falls back to the password path
 * so a failure here cannot lock students out.
 */
async function mintSessionWithoutPassword(
  admin: ReturnType<typeof createClient>,
  signInClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ session: unknown } | null> {
  try {
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const hashedToken = link?.properties?.hashed_token
    if (linkErr || !hashedToken) return null

    // GoTrue has spelled this OTP type both ways across versions; try the
    // specific one first and fall back rather than guessing wrong.
    for (const type of ['magiclink', 'email'] as const) {
      const { data, error } = await signInClient.auth.verifyOtp({
        token_hash: hashedToken,
        type,
      })
      if (!error && data?.session) return { session: data.session }
    }
    return null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const startedAt = Date.now()
  let codeMask = ''
  let branch: 'created' | 'existing' | 'created_after_race' = 'existing'

  try {
    const { magicCode } = await req.json()

    if (!magicCode || typeof magicCode !== 'string' || !magicCode.trim()) {
      return errorResponse('CODE_REQUIRED', 'Magic code is required', 400)
    }

    const normalizedCode = magicCode.trim().toUpperCase().replace(/\s+/g, '')
    codeMask = normalizedCode.slice(-3).padStart(normalizedCode.length, '*')

    // ── Env o'zgaruvchilarni bir marta o'qib, darhol tekshiramiz ──
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!SUPABASE_URL || !SERVICE_KEY) {
      // Bu ishlab chiqarish xatosi, foydalanuvchining aybi emas —
      // shuning uchun log'da aniq nomlab yozamiz.
      const missing = [
        !SUPABASE_URL ? 'SUPABASE_URL' : null,
        !SERVICE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      ].filter(Boolean).join(', ')
      logEvent({ result: 'SERVER_MISCONFIGURED', code_mask: codeMask, detail: `missing: ${missing}` })
      return errorResponse('SERVER_MISCONFIGURED', `missing env: ${missing}`, 500)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, user_id, full_name, magic_code')
      .eq('magic_code', normalizedCode)
      .maybeSingle()

    if (profileErr) {
      logEvent({ result: 'CODE_LOOKUP_FAILED', code_mask: codeMask, detail: profileErr.message })
      return errorResponse('CODE_LOOKUP_FAILED', profileErr.message, 500)
    }
    if (!profile) {
      logEvent({ result: 'CODE_NOT_FOUND', code_mask: codeMask })
      return errorResponse('CODE_NOT_FOUND', 'Code does not match any student profile', 401)
    }

    // Reject staff (CRM owners / admins / call operators / etc).
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.user_id)
    const isStaff = (roles ?? []).some((r) =>
      ['staff', 'admin', 'owner', 'call_operator', 'document_handler'].includes(
        String(r.role),
      ),
    )
    if (isStaff) {
      logEvent({ result: 'STAFF_BLOCKED', code_mask: codeMask })
      return errorResponse('STAFF_BLOCKED', 'Staff use the username/password sign-in', 403)
    }

    const deterministicEmail = `student-${profile.user_id}@hanguk.local`
    let authUser = await findExistingAuthUser(admin, profile.user_id, deterministicEmail)

    // ---------- create branch (with race-safe fallback) ----------
    if (!authUser) {
      const placeholderPassword = `student-${profile.user_id}-hanguk-A1!`
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: deterministicEmail,
        password: placeholderPassword,
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name,
          is_student: true,
          original_user_id: profile.user_id,
        },
      })

      if (createErr) {
        if (isDuplicateEmailError(createErr)) {
          // Bug A — another request beat us to it. Re-resolve and continue
          // through the existing-user branch below.
          authUser = await findExistingAuthUser(admin, profile.user_id, deterministicEmail)
          if (authUser) {
            branch = 'created_after_race'
          } else {
            logEvent({
              result: 'AUTH_CREATE_FAILED',
              code_mask: codeMask,
              detail: 'race lookup failed after duplicate-email',
            })
            return errorResponse(
              'AUTH_CREATE_FAILED',
              'Race condition during account creation; please retry',
              500,
            )
          }
        } else {
          logEvent({
            result: 'AUTH_CREATE_FAILED',
            code_mask: codeMask,
            detail: createErr.message,
          })
          return errorResponse('AUTH_CREATE_FAILED', createErr.message, 500)
        }
      } else if (created?.user) {
        authUser = { id: created.user.id, email: created.user.email ?? deterministicEmail }
        branch = 'created'

        // Best-effort migration of any pre-login storage uploads into the
        // new user's folder. v1 had this; preserved here.
        try {
          const { data: oldFiles } = await admin.storage
            .from('student-documents')
            .list(profile.user_id)
          if (oldFiles && oldFiles.length > 0) {
            await Promise.allSettled(
              oldFiles.map((f) =>
                admin.storage
                  .from('student-documents')
                  .move(`${profile.user_id}/${f.name}`, `${authUser!.id}/${f.name}`),
              ),
            )
          }
        } catch {
          // non-fatal
        }
      }
    }

    if (!authUser) {
      logEvent({ result: 'AUTH_CREATE_FAILED', code_mask: codeMask, detail: 'no auth user resolved' })
      return errorResponse('AUTH_CREATE_FAILED', 'Could not resolve student auth user', 500)
    }

    // Repair profile.user_id if it drifted from the actual auth user.
    if (profile.user_id !== authUser.id) {
      await admin.from('profiles').update({ user_id: authUser.id }).eq('id', profile.id)
    }

    // Use a non-admin client to actually exchange the token for a session.
    // Parolni sessiyaga almashtirish uchun anon klient afzal. Agar
    // SUPABASE_ANON_KEY joylashtirilmagan bo'lsa, funksiyani yiqitmasdan
    // admin klient bilan davom etamiz — v1 aynan shunday ishlagan va u
    // ishonchli edi.
    const signInClient = ANON_KEY
      ? createClient(SUPABASE_URL, ANON_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : admin

    if (!ANON_KEY) {
      logEvent({ result: 'WARN', code_mask: codeMask, detail: 'SUPABASE_ANON_KEY missing — falling back to admin client' })
    }

    // ── Minting a session ────────────────────────────────────────────────
    // Preferred path: a one-time token, leaving the stored password alone.
    let session: unknown = null
    let mintedBy: 'otp' | 'password' = 'otp'

    const minted = await mintSessionWithoutPassword(admin, signInClient, authUser.email)
    if (minted) {
      session = minted.session
    } else {
      // Fallback: the legacy password path, unchanged. Kept so a failure in
      // the OTP exchange degrades to what shipped before rather than locking
      // students out — but it is the path that rewrites the password, so its
      // use is logged and should be treated as something to investigate, not
      // as normal operation.
      mintedBy = 'password'
      const stablePassword = `student-${authUser.id}-hanguk-A1!`

      let { data: sessionData, error: signInErr } = await signInClient.auth.signInWithPassword({
        email: authUser.email,
        password: stablePassword,
      })

      if (signInErr) {
        const { error: updateErr } = await admin.auth.admin.updateUserById(authUser.id, {
          password: stablePassword,
        })
        if (updateErr) {
          logEvent({
            result: 'AUTH_SIGNIN_FAILED',
            code_mask: codeMask,
            branch,
            detail: `password reset failed: ${updateErr.message}`,
          })
          return errorResponse(
            'AUTH_SIGNIN_FAILED',
            `Password reset failed: ${updateErr.message}`,
            500,
          )
        }
        logEvent({
          result: 'WARN',
          code_mask: codeMask,
          branch,
          detail: 'OTP mint unavailable and stored password did not match — password was rewritten',
        })
        ;({ data: sessionData, error: signInErr } = await signInClient.auth.signInWithPassword({
          email: authUser.email,
          password: stablePassword,
        }))
        if (signInErr) {
          logEvent({
            result: 'AUTH_SIGNIN_FAILED',
            code_mask: codeMask,
            branch,
            detail: signInErr.message,
          })
          return errorResponse('AUTH_SIGNIN_FAILED', signInErr.message, 500)
        }
      }
      session = sessionData?.session ?? null
    }

    if (!session) {
      logEvent({ result: 'AUTH_SIGNIN_FAILED', code_mask: codeMask, branch, detail: 'no session returned' })
      return errorResponse('AUTH_SIGNIN_FAILED', 'No session returned', 500)
    }

    const s = session as {
      access_token: string
      refresh_token: string
      expires_in: number
      expires_at?: number
      token_type: string
      user: { id: string; email?: string }
    }

    logEvent({
      result: 'OK',
      code_mask: codeMask,
      branch,
      minted_by: mintedBy,
      durationMs: Date.now() - startedAt,
    })

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_in: s.expires_in,
          expires_at: s.expires_at,
          token_type: s.token_type,
        },
        user: {
          id: s.user.id,
          email: s.user.email,
        },
        profile: {
          id: profile.id,
          full_name: profile.full_name,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    logEvent({ result: 'INTERNAL_ERROR', code_mask: codeMask, detail: message })
    return errorResponse('INTERNAL_ERROR', message, 500)
  }
})
