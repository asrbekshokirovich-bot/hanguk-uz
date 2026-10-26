// app-journey-summary
// ----------------------------------------------------------------------------
// «Ilovada» on a lead's card (the marketing plan of 2026-10-22): two or three
// sentences on what the person did in the app over the last 30 days, and
// «Gapni boshlash» — what the operator could open the call with.
//
// POST { lead_id } (or { user_id }), with the staff member's own JWT. The
// person's profile and path are read through analytics_person and
// analytics_person_journey as that staff member — so only staff get them
// (S6: all staff, no investor) and both reads go into analytics_access_log.
// The text is kept on the profile (app_person_summary_store) and handed back
// from there until the person does something new in the app; { force: true }
// writes it again.
//
// The model follows the operators' rules from the plan: the information is
// for preparing, not for quoting ("you opened X three times" is never said);
// a chance is "taxminan", never a promise; it talks about what the person
// chose themselves. «Mos tarif» is not the model's — it comes from the old
// quiz's rules (assessment_result.tariff).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { generateJSON } from "../_shared/gemini.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** At most this many steps go to the model, newest first. */
const MAX_STEPS = 300;

interface Person {
  person_key: string;
  last_seen_at: string | null;
  platform: string | null;
  visits: number;
  milestones: string[];
  how_heard: string | null;
  for_whom: string | null;
  picks: { institution_id: string; name_en: string | null; name_ko: string | null }[];
  visa: { band: string; bucket: number | null; low: string | null; topik: number | null; income: string | null } | null;
  tariff: string | null;
  report_views: number;
  request_at: string | null;
  ai_summary: string | null;
  ai_starter: string | null;
  ai_fresh: boolean;
}

interface Step {
  at: string;
  event: string;
  screen: string | null;
  element: string | null;
  duration_ms: number | null;
  props: Record<string, unknown> | null;
}

const SYSTEM = `Sen HANGUK Consulting call-operatoriga yordamchisan. Kompaniya O'zbekistondan Koreyaga o'qishga yuboradi.
Senga bir odamning talabalar ilovasidagi harakatlari beriladi. Faqat shu ma'lumotdan foydalan, hech narsa o'ylab topma.
Qoidalar:
- O'zbek tilida (lotin), oddiy va qisqa yoz.
- Ma'lumot operatorning tayyorlanishi uchun. "3 marta ochibsiz" kabi kuzatuvni bildiradigan gap yozma. Odamning o'zi tanlagan narsasi (♥ universitetlar, test javoblari) haqida gapirish mumkin.
- Foiz yoki ehtimol — faqat taxminiy ("taxminan"), "viza chiqadi" yoki "kafolat" dema.
- Raqam, narx, grant yoki muddat qo'shma — ular ma'lumotda yo'q.
- Tarif tavsiya qilma.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "2-3 jumla: odam ilovada nimani tanladi va qayerda to'xtadi, nimaga qiziqmoqda",
    },
    starter: {
      type: "STRING",
      description:
        "Gapni nimadan boshlash: bitta qisqa ibora, masalan «Tanlagan 3 universiteti va TOPIK 2 bilan qaysi biriga topshirish mumkinligi»",
    },
  },
  required: ["summary", "starter"],
};

const LOW: Record<string, string> = {
  language: "til darajasi",
  income: "rasmiy daromad",
  deposit: "bankdagi pul",
  gap: "o'qishdan keyingi tanaffus",
  age: "yosh",
};
const FOR_WHOM: Record<string, string> = { self: "o'zi uchun", child: "farzandi uchun", relative: "qarindoshi uchun" };
const BAND: Record<string, string> = { high: "yuqori", mid: "o'rta", low: "past" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/** The profile as the model reads it. */
function describePerson(p: Person): string {
  const lines: string[] = [];
  if (p.how_heard) lines.push(`Bizni qayerdan topgani (o'zi aytgan): ${p.how_heard}`);
  if (p.for_whom) lines.push(`Kim uchun: ${FOR_WHOM[p.for_whom] ?? p.for_whom}`);
  lines.push(`Tashriflar: ${p.visits}; qurilma: ${p.platform ?? "noma'lum"}`);
  const picks = p.picks.map((u) => u.name_en ?? u.name_ko).filter(Boolean);
  lines.push(`Tanlagan universitetlari (♥): ${picks.length ? picks.join(", ") : "yo'q"}`);
  if (p.visa) {
    const parts = [`band: ${BAND[p.visa.band] ?? p.visa.band}`];
    if (p.visa.bucket != null) parts.push(`taxminan ${p.visa.bucket}–${p.visa.bucket + 9}%`);
    if (p.visa.low) parts.push(`past omil: ${LOW[p.visa.low] ?? p.visa.low}`);
    if (p.visa.topik != null) parts.push(p.visa.topik > 0 ? `TOPIK ${p.visa.topik}` : "TOPIK yo'q");
    if (p.visa.income) parts.push(`rasmiy daromad: ${p.visa.income === "yes" ? "bor" : "yo'q"}`);
    lines.push(`Viza testi: ${parts.join(", ")}`);
  } else {
    lines.push("Viza testi: topshirmagan");
  }
  lines.push(`Hisobot: ${p.report_views > 0 ? `ko'rgan (${p.report_views})` : "ko'rmagan"}`);
  lines.push(`Konsultantga so'rov: ${p.request_at ? "yuborgan" : "yubormagan"}`);
  lines.push(`Yetgan bosqichlar: ${p.milestones.join(", ") || "—"}`);
  return lines.join("\n");
}

/** The path, oldest first, one line a step. Only names — never typed text. */
function describeSteps(steps: Step[]): string {
  return steps
    .slice(0, MAX_STEPS)
    .reverse()
    .map((s) => {
      const props = Object.entries(s.props ?? {})
        .filter(([k]) => k !== "x" && k !== "y")
        .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(" ");
      const time = s.at.slice(0, 16).replace("T", " ");
      const secs = s.duration_ms ? ` ${Math.round(s.duration_ms / 1000)}s` : "";
      return `${time} ${s.event}${s.screen ? ` @${s.screen}` : ""}${s.element ? ` [${s.element}]` : ""}${secs}${props ? ` ${props}` : ""}`;
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const auth = req.headers.get("authorization");
  if (!auth) return json({ error: "Missing authorization" }, 401);

  let body: { lead_id?: string; user_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Bad JSON" }, 400);
  }
  if (!body.lead_id && !body.user_id) return json({ error: "lead_id or user_id" }, 400);

  // As the staff member: the role check and the access log are in the RPCs.
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: user, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user?.user) return json({ error: "Unauthorized" }, 401);

  const args = { p_lead_id: body.lead_id ?? null, p_user_id: body.user_id ?? null };
  const { data: person, error: pErr } = await asUser.rpc("analytics_person", args);
  if (pErr) {
    const forbidden = pErr.code === "42501";
    return json({ error: forbidden ? "Forbidden" : pErr.message }, forbidden ? 403 : 500);
  }
  if (!person) return json({ summary: null, starter: null });
  const p = person as Person;

  if (p.ai_fresh && !body.force && p.ai_summary) {
    return json({ summary: p.ai_summary, starter: p.ai_starter, cached: true });
  }

  const { data: journey, error: jErr } = await asUser.rpc("analytics_person_journey", {
    ...args,
    p_days: 30,
    p_limit: MAX_STEPS,
  });
  if (jErr) return json({ error: jErr.message }, 500);
  const steps = ((journey as { steps?: Step[] } | null)?.steps ?? []) as Step[];

  const prompt = `ODAM:\n${describePerson(p)}\n\nILOVADAGI YO'LI (eskidan yangiga, oxirgi 30 kun):\n${
    describeSteps(steps) || "harakat yo'q"
  }\n\nOperatorga xulosa va gapni boshlash iborasini yoz.`;

  let out: { summary?: string; starter?: string } | null = null;
  try {
    out = await generateJSON<{ summary: string; starter: string }>({
      prompt,
      schema: SCHEMA,
      systemInstruction: SYSTEM,
      temperature: 0.3,
    });
  } catch (e) {
    console.error("app-journey-summary: Gemini failed:", e);
    return json({ error: "AI unavailable" }, 502);
  }
  const summary = out?.summary?.trim();
  const starter = out?.starter?.trim();
  if (!summary || !starter) return json({ error: "AI returned nothing" }, 502);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error: sErr } = await admin.rpc("app_person_summary_store", {
    p_person_key: p.person_key,
    p_summary: summary,
    p_starter: starter,
    p_seen_at: p.last_seen_at,
  });
  if (sErr) console.error("app-journey-summary: store failed:", sErr.message);

  return json({ summary, starter, cached: false });
});
