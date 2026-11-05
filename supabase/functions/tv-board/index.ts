// tv-board — ofis TV (hanguk.uz/tv) uchun ochiq vazifalar va bugun bajarilganlar.
// GET ?k=<kalit>. Kalit bot_settings.tv_key (faqat owner ko'radi: CRM → Sozlamalar → Bot).
// Javob shakli avvalgi Orbit tv-board bilan bir xil, shuning uchun tv.html faqat manzilni almashtiradi.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { serviceKey } from "../_shared/keys.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Uzunligi teng bo'lmasa ham vaqt bo'yicha farq qilmaydigan solishtirish. */
function sameKey(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);

  const given = (new URL(req.url).searchParams.get("k") ?? "").trim();
  const { data: row, error: kErr } = await db.from("bot_settings").select("value").eq("key", "tv_key").maybeSingle();
  if (kErr) { console.error("tv-board key:", kErr.message); return json({ ok: false }, 500); }
  const key = String(row?.value ?? "");
  if (!key || !given || !sameKey(given, key)) return json({ ok: false, error: "bad key" }, 401);

  const { data, error } = await db.rpc("tv_board_data");
  if (error) { console.error("tv_board_data:", error.message); return json({ ok: false }, 500); }
  return json(data);
});
