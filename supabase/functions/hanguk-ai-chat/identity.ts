// Who is asking — decided ONLY from the Authorization JWT (plan §9).
//
// Before 2.0 the student path trusted user_id / user_type from the request
// body, so anyone could read another student's card by sending their id
// (2026-10-22 audit). Now:
//   no token / the publishable key / "Bearer "   → guest
//   valid JWT, staff role (not investor)          → staff
//   valid JWT, investor only                      → refused
//   valid JWT, no role                            → student
//   invalid / expired JWT                         → 401 (the client refreshes)
//
// deno-lint-ignore-file no-explicit-any
import type { Caller } from "./tools/types.ts";

export class CallerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CallerError";
  }
}

export interface IdentityDeps {
  /** Client acting as the bearer of the token. */
  userClient: (token: string) => any;
  service: any;
  publicKeys: string[];
}

export function bearer(req: Request): string {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s*/i, "").trim();
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function guestKeyFor(req: Request, body: any): Promise<string> {
  const install = typeof body?.install_id === "string" && /^[0-9a-f-]{36}$/i.test(body.install_id) ? body.install_id : null;
  if (install) return `i:${install.toLowerCase()}`;
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  return `ip:${(await sha256Hex(ip)).slice(0, 24)}`;
}

export async function resolveCaller(req: Request, body: any, deps: IdentityDeps): Promise<{ caller: Caller; client: any }> {
  const token = bearer(req);
  if (!token || deps.publicKeys.includes(token)) {
    return {
      caller: { audience: "guest", userId: null, name: "", roles: [], guestKey: await guestKeyFor(req, body) },
      client: deps.service,
    };
  }

  const client = deps.userClient(token);
  const { data, error } = await client.auth.getUser();
  const user = data?.user;
  if (error || !user) throw new CallerError(401, "Session expired — please sign in again");

  const [{ data: roleRows }, { data: prof }] = await Promise.all([
    deps.service.from("user_roles").select("role").eq("user_id", user.id),
    deps.service.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
  ]);
  const roles: string[] = (roleRows || []).map((r: any) => String(r.role));
  const staffRoles = roles.filter((r) => r !== "investor");
  if (roles.length && !staffRoles.length) throw new CallerError(403, "Hanguk AI is not available for this account");

  return {
    caller: {
      audience: staffRoles.length ? "staff" : "student",
      userId: user.id,
      name: prof?.full_name || "",
      roles: staffRoles,
      guestKey: null,
    },
    client,
  };
}

/** Limits per audience (plan §9). Env overrides: AI_LIMIT_STAFF_HOUR, AI_LIMIT_STUDENT_DAY, AI_LIMIT_GUEST_DAY. */
export function quotaFor(caller: Caller, now = new Date()): { key: string; limit: number } {
  const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const num = (k: string, d: number) => {
    const v = Number(Deno.env.get(k));
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  if (caller.audience === "staff") {
    const hour = now.toLocaleString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false });
    return { key: `staff:${caller.userId}:${day}T${hour}`, limit: num("AI_LIMIT_STAFF_HOUR", 60) };
  }
  if (caller.audience === "student") {
    return { key: `student:${caller.userId}:${day}`, limit: num("AI_LIMIT_STUDENT_DAY", 30) };
  }
  return { key: `guest:${caller.guestKey}:${day}`, limit: num("AI_LIMIT_GUEST_DAY", 10) };
}
