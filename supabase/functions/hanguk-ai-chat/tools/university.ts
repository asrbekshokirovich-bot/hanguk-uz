// University knowledge tools (plan §5.1): the admission guidelines in the
// database. Open to every audience — a guideline is the university's public
// document — while staff-only parts (institution_notes) are cut in Postgres by
// ai_is_staff(). Guests call through the service client (auth.uid() empty =
// student-level view).
//
// deno-lint-ignore-file no-explicit-any
import { type AgentTool, rpc, type Source, type ToolCtx } from "./types.ts";

const everyone = ["staff", "student", "guest"] as const;
const uuid = { type: "string", description: "uuid from uni_search / uni_card" };
const daraja = { type: "string", enum: ["bakalavr", "magistratura", "til_kursi", "kasbiy"], description: "level: bakalavr (bachelor), magistratura (master/PhD), til_kursi (language course), kasbiy (vocational/college)" };

function guidelineSource(s: any): Source | null {
  if (!s || typeof s !== "object" || !s.label) return null;
  return { kind: "guideline", label: `Yo'riqnoma: ${s.label}`, date: s.date ?? null };
}

/** Pulls `source` objects out of a result (top level or per item). */
export function sourcesOf(data: any): Source[] {
  const out: Source[] = [];
  const one = guidelineSource(data?.source);
  if (one) out.push(one);
  for (const u of Array.isArray(data?.universities) ? data.universities : []) {
    const s = guidelineSource(u?.source);
    if (s) out.push(s);
  }
  return out;
}

const tool = (
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  call: (ctx: ToolCtx, a: any) => [string, Record<string, unknown>],
): AgentTool => ({
  name,
  description,
  parameters,
  audiences: [...everyone],
  run: async (ctx, a) => {
    const [fn, params] = call(ctx, a ?? {});
    const data = await rpc(ctx.user, fn, params);
    return { data, sources: sourcesOf(data) };
  },
});

export const UNIVERSITY_TOOLS: AgentTool[] = [
  tool("uni_search",
    "Find Korean universities in the database by name (English, Korean or transliterated, e.g. 'Hanyang', '한양', 'kyunghee'), city, level, language minimum or English track. Returns institution_id and guideline_id per level. guideline_id null = no admission guideline in the database for that level — then say so. Call this first for any question about a named university.",
    {
      type: "object",
      properties: {
        query: { type: "string", description: "university name; omit to list by filters" },
        daraja,
        city: { type: "string", description: "city, Korean or English (서울, Busan…)" },
        max_topik: { type: "number", description: "only universities whose general TOPIK minimum is at most this" },
        max_ielts: { type: "number" },
        english_track: { type: "boolean" },
        limit: { type: "integer" },
      },
    },
    (_c, a) => ["ai_uni_search", {
      p_query: a.query ?? null, p_daraja: a.daraja ?? null, p_city: a.city ?? null,
      p_max_topik: a.max_topik ?? null, p_max_ielts: a.max_ielts ?? null,
      p_english_track: a.english_track ?? null, p_limit: a.limit ?? 15,
    }]),

  tool("uni_card",
    "One admission guideline in full: intake, application site and fee, bank balance needed, language minimums, recommendation letter, tuition range and period, entrance fee, grant status, contacts and document address, and every step with dates and status (online/offline submission, application fee, interview, result, tuition payment, certificate of admission, visa). Rounds' holat: tasdiqlangan = stated, taxminiy = estimate, nisbiy = relative, keyin_elon = announced later, etap_yoq = no such step. Give guideline_id, or institution_id + daraja.",
    { type: "object", properties: { guideline_id: uuid, institution_id: uuid, daraja } },
    (_c, a) => ["ai_uni_card", { p_guideline_id: a.guideline_id ?? null, p_institution_id: a.institution_id ?? null, p_daraja: a.daraja ?? null }]),

  tool("uni_faculties",
    "Faculties / majors of one guideline: track (korean / english), college, major, TOPIK / IELTS / TOEFL minimum, tuition and period, page. Filter by name, track or by the scores a student has.",
    {
      type: "object",
      properties: {
        guideline_id: uuid,
        query: { type: "string", description: "part of a college / major name (English or Korean)" },
        track: { type: "string", enum: ["korean", "english"] },
        max_topik: { type: "number", description: "only majors open with this TOPIK level" },
        max_ielts: { type: "number" },
        limit: { type: "integer" },
      },
      required: ["guideline_id"],
    },
    (_c, a) => ["ai_uni_faculties", {
      p_guideline_id: a.guideline_id ?? null, p_query: a.query ?? null, p_track: a.track ?? null,
      p_max_topik: a.max_topik ?? null, p_max_ielts: a.max_ielts ?? null, p_limit: a.limit ?? 60,
    }]),

  tool("uni_documents",
    "Documents one guideline requires: who must give it, required (ha / shartli = only in some cases / ixtiyoriy), form, apostille, notarized translation, deadline, page; plus the address documents are posted to and the recommendation-letter rule.",
    { type: "object", properties: { guideline_id: uuid }, required: ["guideline_id"] },
    (_c, a) => ["ai_uni_documents", { p_guideline_id: a.guideline_id ?? null }]),

  tool("uni_grants",
    "Scholarships of one guideline: when (kirishda = at admission, oqish_davomida = during studies), criterion, TOPIK / IELTS range → percent of tuition or amount, duration, condition to keep it, the guideline's own words (quote) and page. These are the same rows the app's grant table shows.",
    { type: "object", properties: { guideline_id: uuid }, required: ["guideline_id"] },
    (_c, a) => ["ai_uni_grants", { p_guideline_id: a.guideline_id ?? null }]),

  tool("uni_deadlines",
    "Guideline steps of the current season that end (or start) within the next N days, soonest first, across all universities. Filter by level or step name (e.g. 'Online hujjat', 'Intervyu', 'Vizaga'). mine=true: only the universities this student chose (for staff, also give student_id).",
    {
      type: "object",
      properties: {
        days: { type: "integer", description: "default 30, max 180" },
        daraja,
        etap: { type: "string", description: "part of the step name" },
        mine: { type: "boolean" },
        student_id: { type: "string", description: "staff only: whose chosen universities" },
      },
    },
    (_c, a) => ["ai_uni_deadlines", {
      p_days: a.days ?? 30, p_daraja: a.daraja ?? null, p_etap: a.etap ?? null,
      p_mine: a.mine ?? false, p_student_id: a.student_id ?? null,
    }]),

  tool("uni_compare",
    "2–4 guidelines side by side with the same fields: language minimums, application fee, bank balance, tuition range, grant status, number of faculties and documents, online deadline.",
    { type: "object", properties: { guideline_ids: { type: "array", items: { type: "string" }, description: "2–4 guideline ids" } }, required: ["guideline_ids"] },
    (_c, a) => ["ai_uni_compare", { p_guideline_ids: Array.isArray(a.guideline_ids) ? a.guideline_ids.slice(0, 4) : [] }]),

  tool("uni_eligibility",
    "Which universities / how many faculties are open for given TOPIK and/or IELTS scores, using ONLY the language minimums in the guidelines (not GPA, documents or interview — never call it an admission chance). Without scores a student is checked with their profile values. Optionally limit to given guideline ids.",
    {
      type: "object",
      properties: {
        topik: { type: "number" },
        ielts: { type: "number" },
        daraja,
        guideline_ids: { type: "array", items: { type: "string" } },
        limit: { type: "integer" },
      },
    },
    (_c, a) => ["ai_uni_eligibility", {
      p_topik: a.topik ?? null, p_ielts: a.ielts ?? null, p_daraja: a.daraja ?? "bakalavr",
      p_guideline_ids: Array.isArray(a.guideline_ids) && a.guideline_ids.length ? a.guideline_ids : null,
      p_limit: a.limit ?? 20,
    }]),

  tool("gks_info",
    "GKS (Global Korea Scholarship) programmes in the database: year, level, track (embassy / university), slots, application and result dates, benefits, eligibility, number of designated universities.",
    { type: "object", properties: {} },
    () => ["ai_gks_info", {}]),

  tool("glossary",
    "Official translations of Korean admission terms (전형, 모집요강, 재외국민 …).",
    { type: "object", properties: { term: { type: "string" } }, required: ["term"] },
    (_c, a) => ["ai_glossary", { p_term: a.term ?? "" }]),

  tool("announcements",
    "Recent admission announcements found on the universities' own sites (title in Korean, link, date).",
    { type: "object", properties: { institution_id: uuid, days: { type: "integer" } } },
    (_c, a) => ["ai_announcements", { p_institution_id: a.institution_id ?? null, p_days: a.days ?? 60 }]),
];

/** Prompt section that teaches the agent how to use the guideline tools. */
export const UNIVERSITY_RULES = `## UNIVERSITY QUESTIONS
- Named university → uni_search (name as typed) → uni_card for the level asked (ask which level only if the question does not say and the university has several). Then uni_faculties / uni_documents / uni_grants as the question needs.
- The current season is in every result (season / current_season). If the only guideline is for another intake, say so first.
- "Can I / can he get in with TOPIK N?" → uni_eligibility or uni_faculties(max_topik). Say it checks only the language minimum.
- Deadlines across universities → uni_deadlines. Comparisons → uni_compare.
- Quote the guideline's page (sahifa) when the row has one. Amounts in the guideline's currency.
- Questions the tables do not answer (interview format, dormitory, evaluation, exceptions) → guideline_text_search with Korean keywords; quote the page.
- A university without a guideline in the database: say "bazada yo'riqnomasi yo'q" and give its admissions_url if the tool returned one.`;
