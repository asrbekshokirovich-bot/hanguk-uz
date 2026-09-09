// suggest-lead-fields
// ----------------------------------------------------------------------------
// Reads a finished call's transcript and proposes values for the lead card,
// one row per field in call_lead_suggestions, for an operator to accept.
//
// It writes suggestions, never the lead itself. A model editing `leads` in
// place is unreviewable: a wrong TOPIK level or city becomes indistinguishable
// from something a person typed. Every value carries the sentence it came from,
// so an operator can judge it at a glance instead of re-listening to the call.
//
// The glossary below is not decoration. In the June recordings Gemini heard
// "Hanguk" as "Xabib" and wrote the same university as both "Daegu Haany" and
// "Deguhan" — ordinary Uzbek is transcribed well, the domain nouns are what it
// gets wrong, and those nouns are exactly what the lead card is made of.
//
// POST { call_id } with the service key or an sb_secret_ key in `apikey`.
// Add { dry: true } to get the proposal back without writing anything.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";

/**
 * The lead-card fields worth filling from a call, each mapped to the column it
 * already has in `leads`. No new columns: the CRM has carried these since long
 * before the AI did, and inventing parallel ones would split the record in two.
 */
const FIELDS: { field: string; uz: string }[] = [
  { field: "full_name",            uz: "mijozning to'liq ismi" },
  { field: "city",                 uz: "shahri yoki viloyati" },
  { field: "age",                  uz: "yoshi (faqat aniq aytilsa)" },
  { field: "education_level",      uz: "ma'lumoti: maktab / kollej / litsey / bakalavr / magistr" },
  { field: "korean_level",         uz: "koreys tili darajasi yoki TOPIK bosqichi" },
  { field: "english_level",        uz: "ingliz tili darajasi yoki IELTS bali" },
  { field: "preferred_university", uz: "qiziqqan universiteti" },
  { field: "preferred_program",    uz: "yo'nalishi yoki mutaxassisligi" },
  { field: "target_intake",        uz: "qaysi qabulga: masalan 2027 bahor / 2027 kuz" },
  { field: "budget_range",         uz: "aytilgan byudjeti" },
  { field: "how_heard",            uz: "bizni qayerdan bilgani" },
  { field: "interest_level",       uz: "qiziqish darajasi: low | medium | high (mezon quyida)" },
  { field: "call_result",          uz: "qo'ng'iroq natijasi bir jumlada" },
  { field: "next_follow_up",       uz: "kelishilgan keyingi aloqa sanasi (YYYY-MM-DD), agar aytilgan bo'lsa" },
];

const GLOSSARY = `Sohaga oid atamalar (transkripsiyada buzilgan bo'lishi mumkin, to'g'ri shaklda yozing):
- HANGUK / Hanguk Consulting — kompaniya nomi. "Xabib", "Xanguk", "Hanguq" deb yozilgan bo'lsa ham shu.
- TOPIK — koreys tili imtihoni. Darajalari 1-6.
- GKS — Koreya hukumati stipendiyasi (Global Korea Scholarship).
- Daegu Haany, Dongshin, Chungnam, Ansan, Songho, Youngsang — universitet nomlari;
  "Deguhan", "Degu Xani" kabi shakllar ham shu universitetlarni bildiradi.
- D-2 — talaba vizasi. D-4 — til kursi vizasi.
- "til kursi", "bakalavr", "magistratura" — o'qish turlari.`;

/**
 * How committed the caller actually is.
 *
 * Written as a rule about behaviour, not as a list of phrases. Uzbek carries a
 * lot of polite non-commitment, and a prompt that names specific formulas
 * teaches the model to look for those exact words — every other polite form
 * then slips through and lands as high. The opposite error is as bad: a polite
 * formula sitting next to a real commitment ("I will send the documents
 * tomorrow") must still read as high, or the grade punishes courtesy.
 *
 * The test the model applies is therefore: is there a concrete step, and is it
 * the CALLER who takes it — not how warm the sentence sounds.
 *
 * The medium/low line is drawn on whether the caller ASKED for anything. A first
 * pass put both "I am still thinking it over" and "I will try, I will call you
 * myself" in the same band, and the model graded a polite brush-off as medium.
 * Wanting something is observable in a transcript; interest is not.
 *
 * Sharpening that line then swallowed the case it should not touch: a call that
 * dropped on a bad line also "puts the conversation off", so the model started
 * grading unusable calls as low. Hence the precedence rule at the end — a call
 * that never reached the subject is not a lukewarm lead, it is no reading at all,
 * and a field left empty is the honest answer.
 */
const INTEREST_RUBRIC = `interest_level uchun mezon:
- high — mijoz aniq qadam qo'ydi yoki qo'yishga rozi bo'ldi: sana yoki vaqt kelishildi,
  hujjat yuborishga rozi bo'ldi yoki yubordi, uchrashuvga kelishini aytdi, to'lov bo'yicha
  aniq qadam bor.
- medium — aniq qadam yo'q, lekin mijoz suhbatda FAOL qatnashdi: savol berdi, tafsilot
  yoki shart-sharoit so'radi, narx bilan qiziqdi.
- low — mijoz na aniq qadam qo'ydi, na biror narsa so'radi: suhbatni keyinga surdi,
  umumiy javob bilan cheklandi, yoki qiziqmasligini bildirdi.

Ikki muhim qoida:
1. Muloyim ibora o'z-o'zidan bahoni pasaytirmaydi. Agar o'sha jumlada yoki suhbatning
   boshqa joyida aniq qadam ham bo'lsa — qadam hal qiladi, ibora emas.
2. Qadamni MIJOZ qo'yishi kerak. Operator taklif qilgan sana yoki harakat mijozning
   roziligisiz baho uchun hisobga olinmaydi.

Hammasidan ustun turadigan qoida: agar suhbat mavzuga umuman yetib bormagan bo'lsa —
texnik uzilish, aloqa yomon, noto'g'ri raqam, yoki mijoz masala bo'yicha umuman gapirmadi —
interest_level maydonini UMUMAN qaytarma. Bunday holatni "low" deb baholama: "low" bu
"qiziqmadi" degani, "suhbat bo'lmadi" degani emas. Xuddi shunday, "medium" ham
"o'rtacha qiziqish" degani, "bilmayman" degani emas.`;

function buildPrompt(transcript: string): string {
  const fieldList = FIELDS.map((f) => `- ${f.field}: ${f.uz}`).join("\n");
  return `Sen HANGUK ta'lim konsalting kompaniyasining CRM tizimidasan. Quyida operator va mijoz o'rtasidagi telefon suhbati transkripsiyasi berilgan. Sening vazifang — mijoz kartochkasi uchun faqat suhbatda AYTILGAN ma'lumotlarni ajratib olish.

${GLOSSARY}

${INTEREST_RUBRIC}

Qat'iy qoidalar:
1. Faqat transkripsiyada bor narsani yoz. Taxmin qilma, mantiqan chiqarma, to'ldirib yubormа.
2. Har bir maydon uchun "evidence" — transkripsiyadan aynan o'sha jumlani ko'chir. Jumla topolmasang, maydonni umuman qaytarma.
3. Ishonch darajasi (confidence): 0.9+ — mijoz aniq aytgan; 0.6-0.9 — aytilgan lekin noaniq; 0.6 dan past bo'lsa maydonni qaytarma.
4. Mijoz aytmagan maydonni qaytarma. Bo'sh qiymat yoki "noma'lum" yozma — shunchaki ro'yxatga kiritma.
5. Operator aytgan gaplarni mijozning ma'lumoti sifatida yozma. Faqat mijoz haqidagi faktlar kerak.

Maydonlar:
${fieldList}

Javobni faqat JSON sifatida qaytar, boshqa matnsiz:
{"suggestions":[{"field":"...","value":"...","confidence":0.0,"evidence":"..."}]}

Transkripsiya:
---
${transcript}
---`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 503);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const callId = String(body.call_id ?? "").trim();
    const dry = !!body.dry;
    if (!callId) return json({ error: "Missing call_id" }, 400);

    const { data: callRow } = await supabase
      .from("calls").select("id, lead_id, student_id").eq("id", callId).maybeSingle();
    const call = callRow ?? { id: callId, lead_id: null, student_id: null };
    if (!callRow && !dry) return json({ error: "Call not found" }, 404);

    // A dry run may carry its own transcript. That is how the rubric is tested
    // against cases the recordings do not contain yet, without inventing call
    // rows to hold them. Never allowed outside dry mode: a suggestion must be
    // traceable to a real call.
    let text = "";
    if (dry && typeof body.transcript === "string" && body.transcript.trim()) {
      text = body.transcript;
    } else {
      const { data: transcript } = await supabase
        .from("call_transcripts").select("full_text").eq("call_id", callId).maybeSingle();
      text = (transcript as { full_text: string } | null)?.full_text ?? "";
    }
    if (!text.trim()) return json({ error: "No transcript for this call" }, 404);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(text) }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return json({ error: `Gemini ${res.status}`, detail: errText.slice(0, 300) }, 502);
    }

    const payload = await res.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: { suggestions?: Array<Record<string, unknown>> };
    try { parsed = JSON.parse(raw); } catch (_e) { return json({ error: "Model did not return JSON", raw: raw.slice(0, 400) }, 502); }

    const known = new Set(FIELDS.map((f) => f.field));
    const rows = (parsed.suggestions ?? [])
      .filter((s) => known.has(String(s.field)))
      .filter((s) => Number(s.confidence) >= 0.6)
      .filter((s) => String(s.value ?? "").trim().length > 0)
      .map((s) => ({
        call_id: callId,
        lead_id: (call as { lead_id: string | null }).lead_id,
        student_id: (call as { student_id: string | null }).student_id,
        field: String(s.field),
        suggested_value: String(s.value).trim(),
        confidence: Math.min(1, Math.max(0, Number(s.confidence))),
        evidence: s.evidence ? String(s.evidence).slice(0, 1000) : null,
        model: MODEL,
      }));

    if (dry) return json({ ok: true, dry: true, count: rows.length, suggestions: rows });

    if (rows.length) {
      const { error } = await supabase
        .from("call_lead_suggestions")
        .upsert(rows, { onConflict: "call_id,field" });
      if (error) throw error;
    }

    return json({ ok: true, count: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("suggest-lead-fields failed:", e);
    return json({ ok: false, error: message }, 500);
  }
});

function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  if (bearer === SERVICE_KEY) return true;
  try {
    const p = bearer.split(".")[1];
    const pad = p + "=".repeat((4 - p.length % 4) % 4);
    return JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/")))?.role === "service_role";
  } catch (_e) { return false; }
}

function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    return Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string");
  } catch (_e) { return []; }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
