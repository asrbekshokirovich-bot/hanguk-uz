// Caller checks for edge functions that pg_cron (or another function) calls
// with the project's service role: lead-alert-dispatch, lead-reports,
// lead-brief. Deliberately free of remote imports so vitest can run it.
//
// It is the `authorized()` of lead-sla-check with two differences:
//
//   * keys are compared in constant time;
//   * a JWT that merely CLAIMS role=service_role is not believed. lead-sla-check
//     decodes the payload without checking the signature, which is harmless
//     behind verify_jwt=true but not behind verify_jwt=false (these functions):
//     anyone could forge `{"role":"service_role"}`, and lead-reports would then
//     send a report on every call. A claim that is not byte-equal to
//     SUPABASE_SERVICE_ROLE_KEY goes through `verifyJwt`, which the function
//     implements as one PostgREST round trip (PostgREST checks the signature).

/** Equal-length-independent comparison: time depends on the longer string only. */
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** The `role` claim of a JWT, WITHOUT checking the signature. */
export function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const pad = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims?.role === "string" ? claims.role : null;
  } catch (_e) {
    return null;
  }
}

/** Every sb_secret_ key configured for this project, whatever it is named. */
export function knownSecretKeys(raw: string | null | undefined): string[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Object.values(parsed).filter((v): v is string => typeof v === "string");
  } catch (_e) {
    return [];
  }
}

export interface ServiceAuthConfig {
  /** SUPABASE_SERVICE_ROLE_KEY */
  serviceKey: string;
  /** SUPABASE_SECRET_KEYS (JSON map name -> sb_secret_...) */
  secretKeysJson?: string | null;
  /**
   * Called for a bearer that is a JWT claiming role=service_role but is not the
   * service key itself (e.g. the copy of the key kept in vault for pg_cron).
   * Must really verify the signature. Without it such a bearer is refused.
   */
  verifyJwt?: (token: string) => Promise<boolean>;
}

/**
 * `verifyJwt` for isServiceRequest: asks PostgREST to read one row with the
 * token. PostgREST checks the signature, so a forged service_role claim gets a
 * 401 here. A verified token is remembered for `ttlMs` (the cron calls every
 * 30 seconds).
 */
export function restJwtVerifier(
  supabaseUrl: string,
  fetchFn: typeof fetch = fetch,
  ttlMs = 5 * 60_000,
): (token: string) => Promise<boolean> {
  const verified = new Map<string, number>();
  return async (token: string): Promise<boolean> => {
    const until = verified.get(token);
    if (until && until > Date.now()) return true;
    const res = await fetchFn(`${supabaseUrl}/rest/v1/lead_settings?select=key&limit=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    verified.set(token, Date.now() + ttlMs);
    return true;
  };
}

/** A secret key in `apikey`, or the service_role JWT in `Authorization: Bearer`. */
export async function isServiceRequest(req: Request, cfg: ServiceAuthConfig): Promise<boolean> {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys(cfg.secretKeysJson).some((k) => constantTimeEqual(k, apikey))) {
    return true;
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  if (cfg.serviceKey && constantTimeEqual(bearer, cfg.serviceKey)) return true;
  if (jwtRole(bearer) !== "service_role") return false;
  if (!cfg.verifyJwt) return false;
  try {
    return await cfg.verifyJwt(bearer);
  } catch (_e) {
    return false;
  }
}
