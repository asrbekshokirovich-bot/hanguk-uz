// A session for a guest to take a university's Study Plan and interview
// tests without a client code (owner, 2026-10-21). Supabase's anonymous
// sign-in is off for the project, so this makes the same thing by hand: a
// confirmed user "guest-<uuid>@hanguk.local" with a random password, marked
// guest in app_metadata, whose credentials the app keeps on the phone and
// signs in with. The app does not count such a session as a client's (the
// application and documents stay locked), and handle_new_user gives it no
// profile, so it never shows in the CRM as a student.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serviceKey } from "../_shared/keys.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PER_IP_PER_HOUR = 20;
const TOTAL_PER_DAY = 300;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown").trim();
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
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
  const { error } = await admin.from("guest_session_throttle").insert({ ip_hash: ipHash });
  if (error) console.error("throttle insert", error);
  await admin.from("guest_session_throttle").delete().lt("created_at", new Date(Date.now() - 2 * 86400_000).toISOString());
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
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
    return json({ email, password });
  } catch (e) {
    console.error(e);
    return json({ error: "failed" }, 500);
  }
});
