// A session for a guest to take a university's Study Plan and interview
// tests without a client code (owner, 2026-10-21). Supabase's anonymous
// sign-in is off for the project, so this makes the same thing by hand: a
// confirmed user "guest-<uuid>@hanguk.local" with a random password, marked
// guest in app_metadata, whose credentials the app keeps on the phone to sign
// in with later. The app does not count such a session as a client's (the
// application and documents stay locked), and handle_new_user gives it no
// profile, so it never shows in the CRM as a student.
//
// Speed (Tayyorgarlik T2, 2026-11-10): it took 2.8 s (p50), nearly all of it
// waiting on four database calls in a row, each 0.3–0.9 s from the region the
// phone reaches (eu-central-1) to the project's (ap-northeast-2); booting took
// 31 ms. Now only what decides the answer is waited for — the throttle count,
// the new user and, when asked for, its session. The throttle row and the
// cleanup run while the user is made (EdgeRuntime.waitUntil). The app asks
// for this function in ap-northeast-2 (?forceFunctionRegion), next to the
// database, where a call takes ~26 ms.
//
// The session only when asked for (audit P-F4, 2026-11-10): an app that sets
// it itself sends {"session": true} and gets the user signed in here, so the
// phone does not sign in itself. Older builds send {} and ignore a session:
// for them the sign-in here only made a second auth session per guest and
// ~0.4 s more wait, so they get {email, password} alone, as before T2. A
// body that is empty or not JSON counts as {}.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishableKey, serviceKey } from "../_shared/keys.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PER_IP_PER_HOUR = 20;
const TOTAL_PER_DAY = 300;

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown").trim();
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** [work] started now and finished after the response, its failure logged. */
function background(what: string, work: PromiseLike<{ error: unknown }>) {
  const done = Promise.resolve(work).then(
    ({ error }) => {
      if (error) console.error(what, error);
    },
    (e) => console.error(what, e),
  );
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(done);
}

// deno-lint-ignore no-explicit-any
async function overLimit(admin: any, req: Request): Promise<boolean> {
  const ipHash = await sha256(`hanguk-guest:${clientIp(req)}`);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const [perIp, total] = await Promise.all([
    admin.from("guest_session_throttle").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", hourAgo),
    admin.from("guest_session_throttle").select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
  ]);
  if (perIp.error || total.error) {
    // Jadval hali yo'q bo'lsa (migratsiya qo'llanmagan) — ilova ishlashda davom etadi.
    console.error("throttle", perIp.error ?? total.error);
    return false;
  }
  if ((perIp.count ?? 0) >= PER_IP_PER_HOUR || (total.count ?? 0) >= TOTAL_PER_DAY) return true;
  // Sent now, as before, so the next count sees it as soon as it did; only
  // nothing waits for it (or for the cleanup) any more.
  background("throttle insert", admin.from("guest_session_throttle").insert({ ip_hash: ipHash }));
  background(
    "throttle cleanup",
    admin.from("guest_session_throttle").delete().lt("created_at", new Date(Date.now() - 2 * 86400_000).toISOString()),
  );
  return false;
}

/** Whether the body asks for the new guest's session: {"session": true}. */
async function asksForSession(req: Request): Promise<boolean> {
  try {
    const body: unknown = JSON.parse(await req.text());
    return typeof body === "object" && body !== null && (body as { session?: unknown }).session === true;
  } catch {
    // Empty or not JSON: as {}.
    return false;
  }
}

/**
 * The new guest's session, as the app's own sign-in would get it; null when
 * it could not be had (the app then signs in with the credentials). On a
 * client of its own: signing in on the admin client would put the guest's
 * token in place of the service key.
 */
async function signIn(url: string, email: string, password: string) {
  try {
    const client = createClient(url, publishableKey() || serviceKey(), noSession);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    const s = data?.session;
    if (error || !s) {
      console.error("signIn", error ?? "no session");
      return null;
    }
    return {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_in: s.expires_in,
      expires_at: s.expires_at,
      token_type: s.token_type,
      user: s.user,
    };
  } catch (e) {
    console.error("signIn", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, serviceKey(), noSession);
    const withSession = await asksForSession(req);
    // Xavfsizlik (2026-11-05): bitta IP soatiga 20 tadan, hammasi kuniga 300 tadan
    // ko'p mehmon akkaunt ocholmaydi (oldin cheksiz edi). Kuniga eng ko'pi 19 ta
    // ochilgan, bitta IP soatiga eng ko'pi 6 ta (2026-11-04; ofis/mobil NAT bitta IP), shuning uchun oddiy foydalanuvchiga ta'sir qilmaydi.
    const limited = await overLimit(admin, req);
    if (limited) return json({ error: "rate_limited" }, 429);

    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const password = btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "").slice(0, 28) + "Aa1";
    const email = `guest-${crypto.randomUUID()}@hanguk.local`;
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { guest: true },
      user_metadata: { guest: true },
    });
    if (error) {
      console.error("createUser", error);
      return json({ error: "failed" }, 500);
    }
    // email/password stay for the app versions that sign in themselves.
    if (!withSession) return json({ email, password });
    const session = await signIn(url, email, password);
    return json(session ? { email, password, session } : { email, password });
  } catch (e) {
    console.error(e);
    return json({ error: "failed" }, 500);
  }
});
