// Who is calling an edge function that runs with verify_jwt = false.
//
// Security audit 2026-11-05: several functions spent AI credits or read every
// lead with the service key for anyone who knew the URL. Each now calls
// `requireCaller(req, level)` first:
//   "user"    — a signed-in, non-guest account (student or staff);
//   "staff"   — owner / admin / call_operator / document_handler
//               (public.fn_is_inbox_staff, checked with the caller's own token);
//   "service" — only server-side callers holding the service key.
// `allowService: true` also lets server-side callers (cron, other functions)
// through on "user" / "staff" functions.
import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { publishableKey, secretKeys } from "./keys.ts";

export type CallerLevel = "user" | "staff" | "service";

export type CallerResult =
  | { ok: true; service: true; user: null }
  | { ok: true; service: false; user: User }
  | { ok: false; response: Response };

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Constant-time string comparison (no early exit on the first differing byte). */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** True when the request carries one of this project's server-side keys
 *  (an sb_secret_ key or, during the transition, the legacy service_role key),
 *  on `apikey` or as `Authorization: Bearer`. */
export function isServiceRequest(req: Request): boolean {
  const candidates = [bearer(req), req.headers.get("apikey")?.trim()].filter((t): t is string => !!t);
  if (candidates.length === 0) return false;
  const keys = [Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), ...secretKeys()].filter((k): k is string => !!k);
  return candidates.some((t) => keys.some((k) => safeEqual(t, k)));
}

export async function requireCaller(
  req: Request,
  level: CallerLevel,
  cors: Record<string, string>,
  opts: { allowService?: boolean } = {},
): Promise<CallerResult> {
  const deny = (status: number, error: string): CallerResult => ({
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    }),
  });

  if ((level === "service" || opts.allowService) && isServiceRequest(req)) {
    return { ok: true, service: true, user: null };
  }
  if (level === "service") return deny(401, "Unauthorized");

  const token = bearer(req);
  if (!token) return deny(401, "Missing authorization token");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = publishableKey();
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return deny(401, "Invalid or expired token");
  // Guest test accounts (guest-test-session) may only take the tests.
  if (user.app_metadata?.guest === true) return deny(403, "Forbidden");

  if (level === "staff") {
    const { data: isStaff, error: roleError } = await client.rpc("fn_is_inbox_staff");
    if (roleError) {
      console.error("fn_is_inbox_staff", roleError);
      return deny(500, "Role check failed");
    }
    if (isStaff !== true) return deny(403, "Forbidden");
  }

  return { ok: true, service: false, user };
}
