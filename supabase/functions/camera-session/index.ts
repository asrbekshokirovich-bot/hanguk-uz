// camera-session — CRM «Kameralar» sahifasiga 5 daqiqalik kamera kaliti.
//
// POST (yoki GET) xodimning JWT'si bilan → { gate, token, expires_at, ttl, cameras: [{id, name}] }
//   401 — kirmagan · 403 — ruxsat yo'q (has_camera_access) · 409 — yoqilgan kamera yo'q
//   503 — CAMERA_GATE_SECRET / CAMERA_GATE_URL qo'yilmagan
// Har berilgan kalit camera_access_log'ga yoziladi; yozilmasa kalit berilmaydi.
// Kalit formati: _shared/camera-token.ts (ofisdagi camera-gate bilan bir xil). docs/kameralar.md
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { buildSession, clientIp, configProblems } from "./session.ts";
import { serviceKey, publishableKey } from "../_shared/keys.ts";
import { isAnonymousAccount } from "../_shared/hanguk-ish.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = publishableKey();
const SERVICE_KEY = serviceKey();
const SECRET = Deno.env.get("CAMERA_GATE_SECRET") ?? "";
const GATE_URL = (Deno.env.get("CAMERA_GATE_URL") ?? "").trim().replace(/\/+$/, "");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const missing = configProblems(SECRET, GATE_URL);
  if (missing.length) {
    console.error("camera-session: secrets yo'q:", missing.join(", "));
    return json({ error: "not_configured" }, 503);
  }

  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: "unauthorized" }, 401);
  if (isAnonymousAccount(who.user)) return json({ error: "forbidden" }, 403);
  const userId = who.user.id;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const result = await buildSession({
      userId,
      secret: SECRET,
      gateUrl: GATE_URL,
      hasAccess: async () => {
        const { data, error } = await asUser.rpc("has_camera_access");
        if (error) throw new Error(`has_camera_access: ${error.message}`);
        return data === true;
      },
      listCameras: async () => {
        const { data, error } = await asUser
          .from("cameras")
          .select("id, name")
          .eq("enabled", true)
          .order("sort", { ascending: true })
          .order("name", { ascending: true });
        if (error) throw new Error(`cameras: ${error.message}`);
        return (data ?? []) as { id: string; name: string }[];
      },
      log: async (cameraIds) => {
        const { error } = await admin.from("camera_access_log").insert({
          user_id: userId,
          camera_ids: cameraIds,
          ip: clientIp(req),
          user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
        });
        if (error) throw new Error(`camera_access_log: ${error.message}`);
      },
    });
    return json(result.body, result.status);
  } catch (e) {
    console.error("camera-session:", e instanceof Error ? e.message : String(e));
    return json({ error: "internal" }, 500);
  }
});
