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
  | 'SERVICE_UNAVAILABLE'
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

// ── Transient upstream failures ──────────────────────────────────────────────
//
// App Review, 2026-08-14 19:47 UTC. The reviewer entered the correct demo code
// twice and was told "Server error while verifying your code. Please contact
// your counsellor." Both attempts are in the logs, and neither was about the
// code: the project's REST origin was returning Cloudflare **522 Connection
// timed out** for ~90 minutes that evening, so `from('profiles')` came back
// with a 20 KB HTML error page in `error.message`. This function read that as
// CODE_LOOKUP_FAILED, answered 500, and the app showed a dead end. Guideline
// 2.1(a) rejection.
//
// A blip in the database is not something the login path can prevent. Turning
// a blip into a hard failure is. Every call below now retries the transient
// class, and what survives the retries is reported as SERVICE_UNAVAILABLE /
// 503 — "the server is unreachable, try again" — never as a verdict on the
// student's code.

/** Attempt delays in ms. Three attempts total; ~1.2 s worst case added. */
const RETRY_DELAYS_MS = [300, 900]

/** Raised when every attempt at an upstream call hit the transient class. */
class TransientUpstreamError extends Error {
  constructor(readonly stage: string, readonly detail: string) {
    super(`${stage}: ${detail}`)
    this.name = 'TransientUpstreamError'
  }
}

function messageOf(err: unknown): string {
  if (!err) return ''
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '')
  }
  return String(err)
}

/**
 * Keep `detail` readable in logs and in the response body.
 *
 * The 2026-08-14 failure logged an entire Cloudflare error page — 20 KB of
 * markup per attempt — which is how a two-line diagnosis ended up buried.
 * HTML never carries information the caller needs, so it is replaced by the
 * status line rather than truncated.
 */
function summarize(err: unknown): string {
  const raw = messageOf(err).trim()
  if (/<!DOCTYPE html|<html[\s>]/i.test(raw)) {
    const title = raw.match(/<title>([^<]{0,120})<\/title>/i)?.[1]?.trim()
    return title ? `upstream returned HTML: ${title}` : 'upstream returned an HTML error page'
  }
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw
}

/**
 * True when the failure is the infrastructure being briefly unreachable
 * rather than an answer about this request.
 *
 * The 522 case is the reason this exists: PostgREST is behind Cloudflare, so
 * an origin timeout arrives as an HTML page in `error.message` with no code
 * and no status — indistinguishable from a real lookup error unless the shape
 * of the body is inspected. Postgres' own "server is having a moment" codes
 * (statement timeout, too many connections, connection failure) are here too.
 */
function isTransientFailure(err: unknown): boolean {
  if (!err) return false

  const raw = messageOf(err)
  // A gateway error page — 502/503/504/522/524 all render as one.
  if (/<!DOCTYPE html|<html[\s>]/i.test(raw)) return true

  const lowered = raw.toLowerCase()
  const TRANSIENT_TEXT = [
    'connection timed out',
    'connection closed',
    'connection refused',
    'connection reset',
    'connection terminated',
    'error sending request',
    'fetch failed',
    'network error',
    'socket hang up',
    'timeout',
    'timed out',
    'temporarily unavailable',
    'too many clients',
    'service unavailable',
    'bad gateway',
    'gateway time-out',
    'gateway timeout',
    'econnreset',
    'econnrefused',
    'etimedout',
    'enotfound',
  ]
  if (TRANSIENT_TEXT.some((t) => lowered.includes(t))) return true

  // Postgres SQLSTATEs that mean "retry", not "you asked for the wrong thing".
  const code = String((err as { code?: unknown }).code ?? '')
  const TRANSIENT_SQLSTATES = [
    '08000', '08003', '08006', '08001', '08004', // connection exceptions
    '53300', // too_many_connections
    '53400', // configuration_limit_exceeded
    '57014', // query_canceled (statement timeout)
    '57P01', '57P02', '57P03', // admin shutdown / crash shutdown / cannot connect now
    'XX000', // internal_error — PostgREST surfaces pooler faults as this
  ]
  if (TRANSIENT_SQLSTATES.includes(code)) return true

  const status = Number((err as { status?: unknown }).status ?? NaN)
  return status === 408 || status === 429 || (status >= 500 && status <= 599)
}

/**
 * Run `fn` until it succeeds or stops failing transiently.
 *
 * `fn` returns supabase-js' `{ data, error }` shape. A non-transient `error`
 * is handed straight back for the caller to interpret; only the transient
 * class is retried, and exhausting the attempts throws
 * [TransientUpstreamError] so the caller cannot mistake infrastructure for a
 * verdict.
 */
async function withRetry<T>(
  stage: string,
  // PromiseLike, not Promise: PostgREST query builders are thenables, so a
  // `Promise` signature would reject `from(...).select(...)` at type-check.
  fn: () => PromiseLike<{ data: T; error: unknown }>,
): Promise<{ data: T; error: unknown }> {
  let last: unknown = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let result: { data: T; error: unknown }
    try {
      result = await fn()
    } catch (thrown) {
      // supabase-js throws rather than returning `{ error }` for network-level
      // faults (the admin/auth calls especially). Same class, same handling.
      if (!isTransientFailure(thrown)) throw thrown
      result = { data: null as T, error: thrown }
    }

    if (!result.error || !isTransientFailure(result.error)) return result

    last = result.error
    if (attempt < RETRY_DELAYS_MS.length) {
      logEvent({
        result: 'RETRY',
        stage,
        attempt: attempt + 1,
        detail: summarize(last),
      })
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
    }
  }

  throw new TransientUpstreamError(stage, summarize(last))
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
  //
  // Retried: an unreachable GoTrue here returns no user, which sends the
  // caller into the create branch for a student who already has an account —
  // duplicate email, race path, AUTH_CREATE_FAILED. A blip must not look like
  // a missing account.
  const { data: byId } = await withRetry('auth.getUserById', () =>
    admin.auth.admin.getUserById(profileUserId),
  )
  if (byId?.user) {
    return { id: byId.user.id, email: byId.user.email ?? deterministicEmail }
  }

  // Secondary: paginated email scan. Capped at 25 pages (= 25 000 users) to
  // avoid runaway latency. Phase-3R-C will replace this with a stored
  // auth_email column for true O(1).
  const PAGE_LIMIT = 25
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const { data: list } = await withRetry('auth.listUsers', () =>
      admin.auth.admin.listUsers({ page, perPage: 1000 }),
    )
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
 *
 * The one thing it does throw on is [TransientUpstreamError]. The fallback is
 * the path that rewrites the stored password (Bug F above), and taking it
 * because GoTrue was unreachable for a second would spend a student's real
 * credential on a network blip. Unreachable is not the same as unsupported:
 * the first is worth retrying and then reporting, the second is what the
 * fallback is for.
 */
async function mintSessionWithoutPassword(
  admin: ReturnType<typeof createClient>,
  signInClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ session: unknown } | null> {
  try {
    const { data: link, error: linkErr } = await withRetry('auth.generateLink', () =>
      admin.auth.admin.generateLink({ type: 'magiclink', email }),
    )
    // The cast is load-bearing at deploy time: `withRetry` widens `data` to a
    // generic, and generateLink's response type does not survive that on its
    // own. Carried over from what is running in production.
    const hashedToken = (link as { properties?: { hashed_token?: string } } | null)
      ?.properties?.hashed_token
    if (linkErr || !hashedToken) return null

    // GoTrue has spelled this OTP type both ways across versions; try the
    // specific one first and fall back rather than guessing wrong.
    //
    // A wrong `type` fails non-transiently, which is the whole point of the
    // loop, so withRetry hands that error straight back and the next spelling
    // is tried. Only unreachability is retried, and only that escapes.
    for (const type of ['magiclink', 'email'] as const) {
      const { data, error } = await withRetry(`auth.verifyOtp:${type}`, () =>
        signInClient.auth.verifyOtp({ token_hash: hashedToken, type }),
      )
      if (!error && data?.session) return { session: data.session }
    }
    return null
  } catch (err) {
    // Unreachable GoTrue must reach the caller: falling through to the
    // password path would rewrite this student's stored credential over a
    // network blip. Everything else degrades to the fallback as before.
    if (err instanceof TransientUpstreamError) throw err
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

    // The 2026-08-14 rejection lives on this line. See the retry block above.
    const { data: profile, error: profileErr } = await withRetry('profiles.lookup', () =>
      admin
        .from('profiles')
        .select('id, user_id, full_name, magic_code')
        .eq('magic_code', normalizedCode)
        .maybeSingle(),
    )

    if (profileErr) {
      logEvent({ result: 'CODE_LOOKUP_FAILED', code_mask: codeMask, detail: summarize(profileErr) })
      return errorResponse('CODE_LOOKUP_FAILED', summarize(profileErr), 500)
    }
    if (!profile) {
      logEvent({ result: 'CODE_NOT_FOUND', code_mask: codeMask })
      return errorResponse('CODE_NOT_FOUND', 'Code does not match any student profile', 401)
    }

    // Reject staff (CRM owners / admins / call operators / etc).
    //
    // Retried for the same reason the profile lookup is, but read the other
    // way round: an unreachable table yields no roles, and no roles reads as
    // "not staff". Failing open on this one is the safe direction — a student
    // signs in — but it should be because the query answered, not because it
    // never landed.
    const { data: roles } = await withRetry('user_roles.lookup', () =>
      admin.from('user_roles').select('role').eq('user_id', profile.user_id),
    )
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

      let { data: sessionData, error: signInErr } = await withRetry('auth.signInWithPassword', () =>
        signInClient.auth.signInWithPassword({
          email: authUser!.email,
          password: stablePassword,
        }),
      )

      if (signInErr) {
        const { error: updateErr } = await withRetry('auth.updateUserById', () =>
          admin.auth.admin.updateUserById(authUser!.id, { password: stablePassword }),
        )
        if (updateErr) {
          logEvent({
            result: 'AUTH_SIGNIN_FAILED',
            code_mask: codeMask,
            branch,
            detail: `password reset failed: ${summarize(updateErr)}`,
          })
          return errorResponse(
            'AUTH_SIGNIN_FAILED',
            `Password reset failed: ${summarize(updateErr)}`,
            500,
          )
        }
        logEvent({
          result: 'WARN',
          code_mask: codeMask,
          branch,
          detail: 'OTP mint unavailable and stored password did not match — password was rewritten',
        })
        ;({ data: sessionData, error: signInErr } = await withRetry(
          'auth.signInWithPassword.retry',
          () =>
            signInClient.auth.signInWithPassword({
              email: authUser!.email,
              password: stablePassword,
            }),
        ))
        if (signInErr) {
          logEvent({
            result: 'AUTH_SIGNIN_FAILED',
            code_mask: codeMask,
            branch,
            detail: summarize(signInErr),
          })
          return errorResponse('AUTH_SIGNIN_FAILED', summarize(signInErr), 500)
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
    // Infrastructure that stayed unreachable across every retry. It is not a
    // fault in the request and must not read like one: 503 tells the client to
    // come back, and the client says so to the student instead of sending them
    // to their counsellor over a code that was correct all along.
    if (error instanceof TransientUpstreamError) {
      logEvent({
        result: 'SERVICE_UNAVAILABLE',
        code_mask: codeMask,
        branch,
        stage: error.stage,
        detail: error.detail,
        durationMs: Date.now() - startedAt,
      })
      return errorResponse('SERVICE_UNAVAILABLE', `${error.stage}: ${error.detail}`, 503)
    }

    // A network fault thrown from somewhere without a retry wrapper reads the
    // same way to the student, so classify it the same way.
    if (isTransientFailure(error)) {
      logEvent({
        result: 'SERVICE_UNAVAILABLE',
        code_mask: codeMask,
        branch,
        stage: 'unwrapped',
        detail: summarize(error),
        durationMs: Date.now() - startedAt,
      })
      return errorResponse('SERVICE_UNAVAILABLE', summarize(error), 503)
    }

    const message = error instanceof Error ? summarize(error) : 'Unexpected error'
    logEvent({ result: 'INTERNAL_ERROR', code_mask: codeMask, detail: message })
    return errorResponse('INTERNAL_ERROR', message, 500)
  }
})
