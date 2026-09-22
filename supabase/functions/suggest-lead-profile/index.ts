// suggest-lead-profile
// ----------------------------------------------------------------------------
// One reading of a customer, drawn from every channel they used.
//
// suggest-lead-fields answers "what did this call say?". This answers "what do
// we know about this person?" — the call transcripts, the Telegram thread and
// the Instagram DMs read together, as one conversation. That matters because
// the channels carry different halves of the same story: the phone call has the
// commitment, Instagram has the phone number they typed in, Telegram has the
// document they promised. Read apart, each looks thinner than it is.
//
// It writes proposals into lead_field_suggestions, never into `leads`. Same
// reason as before: a value a model wrote must stay distinguishable from a
// value a person typed, and every proposal carries the sentence it came from
// plus the channel that sentence was said on.
//
// The channels are joined through communication_identities — a chat handle
// belongs to a lead only when someone (or link_chat_identities_by_phone)
// established that. Nothing here guesses an owner: an unlinked handle is simply
// not read, because attaching a stranger's messages to a lead card is worse
// than leaving the card thin.
//
// POST { lead_id } with the service key or an sb_secret_ key in `apikey`.
// { dry: true } returns the proposal and the material it read, writing nothing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";

/** How much conversation to read. Enough for a long relationship, short of a
 *  prompt so large the model starts skimming the middle of it. */
const MAX_MESSAGES_PER_CHANNEL = 200;
const MAX_CALLS = 20;
const MAX_CHARS = 120_000;

const FIELDS: { field: string; uz: string }[] = [
  { field: "summary",              uz: "butun muloqotning 2-4 jumlalik xulosasi O'ZBEK TILIDA: mijoz kim, qaysi bosqichda, nima kutmoqda, bizdan nima kutilmoqda" },
  { field: "full_name",            uz: "mijozning to'liq ismi" },
  { field: "phone",                uz: "telefon raqami (mijoz o'zi yozgan yoki aytgan bo'lsa)" },
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
  { field: "current_stage",        uz: "mijoz hozir qaysi bosqichda: bir jumlada" },
  { field: "promised_to_client",   uz: "bizning tomondan nima va'da qilingan (aytilgan bo'lsa)" },
  { field: "client_promised",      uz: "mijoz nima qilishga va'da bergan (aytilgan bo'lsa)" },
  { field: "open_question",        uz: "javobsiz qolgan savol bo'lsa — nima so'ralgan" },
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
 * Same rubric as the per-call version, with one addition it needs here: when
 * several channels disagree, the newest evidence wins. A customer who was cool
 * on Instagram in March and booked a meeting by phone last week is a hot lead,
 * not an average of the two — and reading the whole history at once is exactly
 * what makes that averaging tempting.
 */
const INTEREST_RUBRIC = `interest_level uchun mezon:
- high — mijoz aniq qadam qo'ydi yoki qo'yishga rozi bo'ldi: sana yoki vaqt kelishildi,
  hujjat yuborishga rozi bo'ldi yoki yubordi, uchrashuvga kelishini aytdi, to'lov bo'yicha
  aniq qadam bor.
- medium — aniq qadam yo'q, lekin mijoz FAOL qatnashdi: savol berdi, tafsilot yoki
  shart-sharoit so'radi, narx bilan qiziqdi.
- low — mijoz na aniq qadam qo'ydi, na biror narsa so'radi: suhbatni keyinga surdi,
  umumiy javob bilan cheklandi, yoki qiziqmasligini bildirdi.

Qoidalar:
1. Muloyim ibora o'z-o'zidan bahoni pasaytirmaydi. Aniq qadam bo'lsa — qadam hal qiladi.
2. Qadamni MIJOZ qo'yishi kerak. Operator taklif qilgani mijozning roziligisiz hisobga olinmaydi.
3. Kanallar bir-biriga zid bo'lsa — ENG YANGI dalil hal qiladi. O'rtachasini olma.

Hammasidan ustun turadigan qoida: agar hech bir kanalda mavzuga oid haqiqiy muloqot
bo'lmagan bo'lsa — texnik uzilish, javobsiz xabarlar, yoki mijoz umuman gapirmagan —
interest_level maydonini UMUMAN qaytarma. "low" bu "qiziqmadi" degani, "muloqot bo'lmadi"
degani emas.`;

interface Piece { channel: string; when: string; who: string; text: string }

function buildPrompt(pieces: Piece[]): string {
  const fieldList = FIELDS.map((f) => `- ${f.field}: ${f.uz}`).join("\n");
  const body = pieces
    .map((p) => `[${p.when}] [${p.channel}] ${p.who}: ${p.text}`)
    .join("\n");

  return `Sen HANGUK ta'lim konsalting kompaniyasining CRM tizimidasan. Quyida BITTA mijozning kompaniya bilan barcha muloqoti berilgan: telefon suhbatlari, Telegram va Instagram yozishmalari — vaqt bo'yicha tartiblangan. Sening vazifang — mijoz kartochkasi uchun faqat muloqotda AYTILGAN ma'lumotlarni ajratib olish.

${GLOSSARY}

${INTEREST_RUBRIC}

Qat'iy qoidalar:
1. Faqat matnda bor narsani yoz. Taxmin qilma, mantiqan chiqarma, to'ldirib yuborma.
2. Har bir maydon uchun "evidence" — matndan aynan o'sha jumlani ko'chir, va "channel" —
   o'sha jumla qaysi kanalda aytilgani (phone / telegram / instagram). Jumla topolmasang,
   maydonni umuman qaytarma.
   ISTISNO: "summary" maydoni umumlashma bo'lgani uchun unga alohida dalil jumlasi shart emas.
3. Ishonch darajasi (confidence): 0.9+ — mijoz aniq aytgan; 0.6-0.9 — aytilgan lekin noaniq;
   0.6 dan past bo'lsa maydonni qaytarma.
4. Mijoz aytmagan maydonni qaytarma. Bo'sh qiymat yoki "noma'lum" yozma.
5. Operator yoki kompaniya aytgan gaplarni mijozning ma'lumoti sifatida yozma —
   promised_to_client maydonidan tashqari, u aynan bizning va'damiz uchun.
6. Bir maydon bo'yicha kanallar zid bo'lsa — eng yangi ma'lumotni ol.
7. TIL: sen yozadigan barcha qiymatlar va xulosa O'ZBEK TILIDA bo'lsin — muloqot rus,
   ingliz yoki kirill alifbosida bo'lsa ham. Faqat "evidence" maydoni istisno: u
   matndan aynan ko'chirilgani uchun asl tilida qoladi.

Maydonlar:
${fieldList}

Javobni faqat JSON sifatida qaytar, boshqa matnsiz:
{"suggestions":[{"field":"...","value":"...","confidence":0.0,"evidence":"...","channel":"..."}]}

Muloqot:
---
${body}
---`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 503);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!(await authorized(req, supabase))) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const leadId = String(body.lead_id ?? "").trim();
    const dry = !!body.dry;
    if (!leadId) return json({ error: "Missing lead_id" }, 400);

    const { data: lead } = await supabase
      .from("leads").select("id, full_name, phone").eq("id", leadId).maybeSingle();
    if (!lead) return json({ error: "Lead not found" }, 404);

    const pieces: Piece[] = [];
    const counts: Record<string, number> = { phone: 0, telegram: 0, instagram: 0 };

    // ---- phone: the transcripts of this lead's calls
    const { data: calls } = await supabase
      .from("calls")
      .select("id, started_at")
      .eq("lead_id", leadId)
      .order("started_at", { ascending: false })
      .limit(MAX_CALLS);

    const callIds = (calls ?? []).map((c: { id: string }) => c.id);
    if (callIds.length) {
      const { data: transcripts } = await supabase
        .from("call_transcripts")
        .select("call_id, full_text")
        .in("call_id", callIds);
      const byCall = new Map(
        (transcripts ?? []).map((t: { call_id: string; full_text: string }) => [t.call_id, t.full_text]),
      );
      for (const c of calls ?? []) {
        const text = byCall.get((c as { id: string }).id);
        if (!text || !String(text).trim()) continue;
        pieces.push({
          channel: "phone",
          when: String((c as { started_at: string }).started_at ?? "").slice(0, 10),
          who: "Telefon suhbati",
          text: String(text).trim(),
        });
        counts.phone++;
      }
    }

    // ---- chat: only handles that are actually attached to this lead
    const { data: identities } = await supabase
      .from("communication_identities")
      .select("channel, identifier")
      .eq("lead_id", leadId)
      .in("channel", ["telegram", "instagram"]);

    for (const ch of ["telegram", "instagram"]) {
      const ids = (identities ?? [])
        .filter((i: { channel: string }) => i.channel === ch)
        .map((i: { identifier: string }) => i.identifier);
      if (!ids.length) continue;

      const { data: msgs } = await supabase
        .from("messages")
        .select("content, direction, sender_name, created_at")
        .eq("source", ch)
        .in("sender_id", ids)
        .order("created_at", { ascending: false })
        .limit(MAX_MESSAGES_PER_CHANNEL);

      for (const m of (msgs ?? []).reverse()) {
        const row = m as { content: string; direction: string; sender_name: string; created_at: string };
        if (!row.content || !row.content.trim()) continue;
        pieces.push({
          channel: ch,
          when: String(row.created_at ?? "").slice(0, 10),
          who: row.direction === "incoming" ? (row.sender_name || "Mijoz") : "HANGUK",
          text: row.content.trim(),
        });
        counts[ch]++;
      }
    }

    if (!pieces.length) {
      return json({ error: "Bu mijoz uchun hech qanday muloqot topilmadi", counts }, 404);
    }

    // Oldest first: the rubric's "newest evidence wins" rule needs the model to
    // see the order, and a chronology reads as a story rather than a pile.
    pieces.sort((a, b) => a.when.localeCompare(b.when));

    // Trim from the OLD end if it is too long. Dropping recent material would
    // break the same rule the rubric depends on.
    let total = pieces.reduce((n, p) => n + p.text.length, 0);
    while (total > MAX_CHARS && pieces.length > 1) {
      total -= pieces[0].text.length;
      pieces.shift();
    }

    const window = { from: pieces[0]?.when ?? null, to: pieces[pieces.length - 1]?.when ?? null };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(pieces) }] }],
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
    try { parsed = JSON.parse(raw); } catch (_e) {
      return json({ error: "Model did not return JSON", raw: String(raw).slice(0, 400) }, 502);
    }

    const known = new Set(FIELDS.map((f) => f.field));
    const sources = { ...counts, window, pieces: pieces.length };

    const rows = (parsed.suggestions ?? [])
      .filter((s) => known.has(String(s.field)))
      .filter((s) => Number(s.confidence) >= 0.6)
      .filter((s) => String(s.value ?? "").trim().length > 0)
      .map((s) => ({
        lead_id: leadId,
        field: String(s.field),
        suggested_value: String(s.value).trim(),
        confidence: Math.min(1, Math.max(0, Number(s.confidence))),
        evidence: s.evidence ? String(s.evidence).slice(0, 1000) : null,
        evidence_channel: ["phone", "telegram", "instagram"].includes(String(s.channel))
          ? String(s.channel) : null,
        sources,
        model: MODEL,
        status: "pending",
        updated_at: new Date().toISOString(),
      }));

    if (dry) return json({ ok: true, dry: true, sources, count: rows.length, suggestions: rows });

    if (rows.length) {
      const { error } = await supabase
        .from("lead_field_suggestions")
        .upsert(rows, { onConflict: "lead_id,field" });
      if (error) throw error;
    }

    return json({ ok: true, count: rows.length, sources });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("suggest-lead-profile failed:", e);
    return json({ ok: false, error: message }, 500);
  }
});

/**
 * Who may ask for an analysis.
 *
 * Two kinds of caller, and they are not interchangeable. A machine — cron, a
 * backfill — carries a secret key and is trusted outright. A person carries
 * their own session token, and a session alone is not enough: every signed-in
 * student has one. So a user token is checked against user_roles, and only the
 * three staff roles that already decide on proposals may create them.
 *
 * Without that second check the endpoint would let any logged-in student run an
 * analysis of any lead — the function reads with the service key, so it would
 * happily assemble someone else's private conversation.
 */
const STAFF_ROLES = ["owner", "admin", "call_operator"];

async function authorized(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  if (bearer === SERVICE_KEY) return true;

  let claims: { role?: string; sub?: string } | null = null;
  try {
    const p = bearer.split(".")[1];
    const pad = p + "=".repeat((4 - p.length % 4) % 4);
    claims = JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (_e) { return false; }

  if (claims?.role === "service_role") return true;
  if (!claims?.sub) return false;

  // The token is only a claim of identity until Supabase confirms it; a
  // hand-written JWT decodes just as cleanly as a real one.
  const { data: user, error } = await supabase.auth.getUser(bearer);
  if (error || !user?.user?.id || user.user.id !== claims.sub) return false;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claims.sub);

  return (roles ?? []).some((r: { role: string }) => STAFF_ROLES.includes(r.role));
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
