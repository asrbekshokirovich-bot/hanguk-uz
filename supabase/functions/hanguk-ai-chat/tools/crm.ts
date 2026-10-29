// CRM tools (staff only) — the 29 typed tools Hanguk AI had before 2.0, moved
// here unchanged in behaviour. Each runs an ai_* RPC as the signed-in staff
// member; the RPCs check ai_is_staff() / finance access themselves.
//
// deno-lint-ignore-file no-explicit-any
import { embedContent001 } from "../../_shared/gemini.ts";
import { type AgentTool, rpc, type ToolCtx } from "./types.ts";

const obj = (properties: Record<string, unknown> = {}, required: string[] = []) =>
  ({ type: "object", properties, ...(required.length ? { required } : {}) });
const str = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const int = (description?: string) => ({ type: "integer", ...(description ? { description } : {}) });

const tashkentDay = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });

export function sanitizeQuery(message: string): string {
  const cleaned = message.toLowerCase().replace(/[^\p{L}\p{N}\s'’ʼ]/gu, " ").replace(/\s+/g, " ").trim();
  const stop = new Set(["the", "and", "for", "what", "who", "which", "this", "that", "with", "did", "does", "about", "from", "have", "has", "nima", "kim", "qaysi", "uchun", "bilan", "haqida", "bormi"]);
  const words = cleaned.split(" ").filter((w) => w.length >= 3 && !stop.has(w));
  return Array.from(new Set(words)).slice(0, 8).join(" ");
}

// Hybrid (semantic + lexical) search over chats / calls / documents. Falls back
// to the lexical search while content_embeddings is empty (it is, 2026-10-29).
async function searchCommunicationsHybrid(service: any, query: string, limit: number, studentId?: string | null) {
  const q = sanitizeQuery(query);
  if (q.length < 3) return [];
  try {
    const embedding = await embedContent001(q, "RETRIEVAL_QUERY", 1536);
    const { data, error } = await service.rpc("hybrid_search_content", {
      query_text: q,
      query_embedding: embedding,
      match_count: limit,
      filter_student_id: studentId ?? null,
    });
    if (!error && Array.isArray(data) && data.length) {
      return data.map((r: any) => ({
        kind: r.source_type,
        student_id: r.student_id,
        lead_id: r.lead_id,
        when_at: r.created_at,
        snippet: String(r.content ?? "").slice(0, 300),
      }));
    }
  } catch (e) {
    console.error("hybrid search failed, falling back to lexical:", e instanceof Error ? e.message : e);
  }
  const { data } = await service.rpc("search_communications_text", { p_query: q, p_limit: limit, p_student: studentId ?? null });
  return data ?? [];
}

const staff = ["staff"] as const;
const t = (
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  run: (ctx: ToolCtx, a: any) => Promise<unknown>,
): AgentTool => ({
  name,
  description,
  parameters,
  audiences: [...staff],
  run: async (ctx, a) => ({ data: await run(ctx, a ?? {}) }),
});

export const CRM_TOOLS: AgentTool[] = [
  t("get_stats", "Quick CRM counts: students, leads, documents (total/pending/approved), overdue payments, open tasks, new leads.", obj(),
    (c) => rpc(c.user, "ai_stats", {})),
  t("list_documents", "List documents with the owning student's name. Use status 'uploaded' for documents PENDING REVIEW, 'approved' for approved.",
    obj({ status: str("uploaded | approved | rejected"), student_id: str("filter to one student's user_id"), from_date: str("ISO date lower bound on created_at"), to_date: str("ISO date upper bound (exclusive) on created_at"), limit: int(), offset: int() }),
    (c, a) => rpc(c.user, "ai_list_documents", { p_status: a.status ?? null, p_student_id: a.student_id ?? null, p_from: a.from_date ?? null, p_to: a.to_date ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 })),
  t("list_payments", "List payments with student name. Set overdue_only=true for overdue/past-due payments.",
    obj({ status: str("pending | partial | completed | overdue | refunded"), student_id: str(), overdue_only: { type: "boolean" }, limit: int(), offset: int() }),
    (c, a) => rpc(c.user, "ai_list_payments", { p_status: a.status ?? null, p_student_id: a.student_id ?? null, p_overdue_only: a.overdue_only ?? false, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 })),
  t("list_tasks", "List staff tasks.",
    obj({ status: str("todo | in_progress | completed | cancelled"), priority: str("urgent | high | normal | low"), limit: int(), offset: int() }),
    (c, a) => rpc(c.user, "ai_list_tasks", { p_status: a.status ?? null, p_priority: a.priority ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 })),
  t("list_leads", "List/filter the leads pipeline.",
    obj({ query: str("name or phone substring"), status: str("new | contacted | qualified | converted | lost"), source: str("manual | telegram | instagram | call | ai_detected"), exam_type: str("TOPIK | IELTS | none"), city: str(), interest_level: str("low | medium | high"), from_exam_date: str("ISO date"), to_exam_date: str("ISO date"), limit: int(), offset: int() }),
    (c, a) => rpc(c.user, "ai_list_leads", { p_query: a.query ?? null, p_status: a.status ?? null, p_source: a.source ?? null, p_exam_type: a.exam_type ?? null, p_city: a.city ?? null, p_interest_level: a.interest_level ?? null, p_from_exam_date: a.from_exam_date ?? null, p_to_exam_date: a.to_exam_date ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 })),
  t("list_students", "List/search students (non-staff users) by name/phone/city.",
    obj({ query: str(), city: str(), limit: int(), offset: int() }),
    (c, a) => rpc(c.user, "ai_list_students", { p_query: a.query ?? null, p_city: a.city ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 })),
  // search_students has no EXECUTE grant for signed-in users; the caller was
  // confirmed as staff (ai_is_staff) before any staff tool is offered.
  t("search_students", "Fuzzy, ranked student lookup by name or pasted phone number. Use to resolve a person mentioned by name to their student_id.",
    obj({ query: str(), limit: int() }, ["query"]),
    (c, a) => rpc(c.service, "search_students", { p_query: a.query ?? "", p_limit: a.limit ?? 6 })),
  t("get_student_card", "EVERYTHING about one student, exactly as the CRM shows it: seasons with contract status (active / cancelled), Arizalar board stage, tariff, payments per currency ('X to'langan, Z qoldi'), the 8-document application pack (which are approved / under review / missing), chosen universities with online/offline submission, interview, result, final choice and visa, open tasks, last call summaries. Call this after search_students for ANY question about a named student.",
    obj({ student_id: str("the student's user_id from search_students") }, ["student_id"]),
    (c, a) => rpc(c.user, "ai_student_card", { p_student_id: a.student_id ?? null })),
  t("season_pipeline", "The CRM Arizalar board for a season: number of active students, cancelled contracts, and each stage (Yangi, Hujjat tayyor, Onlayn ariza, Oflayn ariza, Suhbat, Natija, Viza…) with the students' names. Use for 'how many students have documents ready / submitted / got results' and similar season questions. Defaults to the current season.",
    obj({ intake_id: str("optional intake id; omit for the current season") }),
    (c, a) => rpc(c.user, "ai_season_pipeline", { p_intake_id: a.intake_id ?? null })),
  t("leads_overview", "Leads pages exactly as the CRM counts them for a day (default today, Tashkent): 'Yangi lid' (nobody answered yet, with waiting minutes), 'Bugungi lidlar' (arrived that day and answered, by channel / call result / outcome, with names and phones), 'Lidlar' pipeline totals, and all-season counts by source. Use for ANY question about new leads, today's leads, leads from the site / Instagram / Telegram / app, how many leads came on a date.",
    obj({ day: str("YYYY-MM-DD; omit for today") }),
    (c, a) => rpc(c.user, "ai_leads_overview", { p_day: a.day ?? null, p_intake_id: null })),
  t("search_leads", "Find LEADS (potential clients, not yet students) by name, phone, Telegram or Instagram handle. Spelling-tolerant (x/kh, q/k). Also finds leads by what they wrote in their Telegram/Instagram chat (many leads are saved only under a first name and typed their full name in the chat), and by part of the name. Each result says how it matched. Use when a person is not found among students, or the question says lid / lead / mijoz.",
    obj({ query: str(), limit: int() }, ["query"]),
    (c, a) => rpc(c.user, "ai_search_leads", { p_query: a.query ?? "", p_limit: a.limit ?? 8 })),
  t("get_lead_card", "Everything about one lead: contact, status, call result, channel, how they heard, education and language levels, wishes, next follow-up, assignee, latest staff notes with who wrote them, calls, and the Telegram/Instagram chat (same as the CRM Muloqot oqimi: total count and the latest 30 messages, mijoz = client, otherwise the staff member). Read the chat to answer what the client asked, agreed or promised.",
    obj({ lead_id: str() }, ["lead_id"]),
    (c, a) => rpc(c.user, "ai_lead_card", { p_lead_id: a.lead_id ?? null })),
  t("staff_activity", "What staff members did in a date range (default today): leads contacted (lead notes by type and outcome, with lead names), phone calls, chat replies, open chats assigned, leads created, tasks done and open, documents reviewed, online/offline submissions recorded. Use for 'X bugun nechta lid bilan gaplashdi', 'kim nima qildi', staff performance. The team list is in the system prompt.",
    obj({ staff: str("staff name; omit for everyone"), from: str("YYYY-MM-DD"), to: str("YYYY-MM-DD") }),
    (c, a) => rpc(c.user, "ai_staff_activity", { p_staff: a.staff ?? null, p_from: a.from ?? null, p_to: a.to ?? null })),
  t("calls_summary", "Telefon page: calls in a date range (default last 7 days) by direction, status, staff; missed calls; recent calls with lead/student names.",
    obj({ from: str(), to: str() }),
    (c, a) => rpc(c.user, "ai_calls_summary", { p_from: a.from ?? null, p_to: a.to ?? null })),
  t("messages_queue", "Xabarlar page: open chats, unassigned, unread, by source and assignee, chats waiting for a reply longer than 10 minutes (longest first), today's incoming/outgoing message counts.", obj(),
    (c) => rpc(c.user, "ai_messages_queue", {})),
  t("university_selection", "Universitet tanlash page for the season: students with and without chosen universities, choice statuses (offered/accepted/change_requested/confirmed), confirmed students per university, change requests.", obj(),
    (c) => rpc(c.user, "ai_university_selection", { p_intake_id: null })),
  t("application_fees", "Application fee page for the season: payments, students paid, total and expense in KRW, by university, list.", obj(),
    (c) => rpc(c.user, "ai_application_fees", { p_intake_id: null })),
  t("learning_centers", "O'quv markazlar: each centre with students, leads, converted, assignee.", obj(),
    (c) => rpc(c.user, "ai_learning_centers", {})),
  t("surveys", "So'rovnomalar: surveys with question and respondent counts.", obj(),
    (c) => rpc(c.user, "ai_surveys", {})),
  t("today_in_app", "Bugun ilovada page: today's signals from the student app (new app requests, came back, reports/picks, unanswered offers) with names and assignees.", obj(),
    (c) => rpc(c.user, "analytics_today_in_app", {})),
  t("app_summary", "Ilova analitikasi → Umumiy: student app activity for the last N days (default 7): devices and new installs per day, events, funnel (app_open → university_open → report_view → lead_form → lead_submit).",
    obj({ days: int() }),
    (c, a) => rpc(c.user, "app_events_summary", { p_days: a.days ?? 7, p_include_test: false })),
  t("app_marketing", "Ilova analitikasi → Marketing: installs, leads and conversion by channel / how-heard for a date range (default last 7 days).",
    obj({ from: str(), to: str() }),
    (c, a) => rpc(c.user, "analytics_marketing", { p_from: a.from ?? tashkentDay(-7), p_to: a.to ?? tashkentDay(), p_include_test: false, p_seg: null })),
  t("app_live", "Ilova analitikasi → Jonli: who is using the app right now (last N minutes, default 5).",
    obj({ minutes: int() }),
    (c, a) => rpc(c.user, "analytics_live", { p_minutes: a.minutes ?? 5 })),
  t("app_people", "Ilova analitikasi → Odamlar: app users of the last N days with activity; optional name search.",
    obj({ days: int(), search: str() }),
    (c, a) => rpc(c.user, "analytics_people", { p_days: a.days ?? 7, p_kind: null, p_include_test: false, p_search: a.search ?? null, p_limit: 15, p_offset: 0 })),
  t("app_quality", "Ilova analitikasi → Sifat: app errors, crashes and slow screens for the last N days.",
    obj({ days: int() }),
    (c, a) => rpc(c.user, "analytics_quality", { p_days: a.days ?? 7 })),
  t("app_retention", "Ilova analitikasi → Qaytish: weekly retention of app users (last N weeks, default 6).",
    obj({ weeks: int() }),
    (c, a) => rpc(c.user, "analytics_retention", { p_weeks: a.weeks ?? 6, p_include_test: false, p_seg: null })),
  t("finance_summary", "Moliya (owners / finance access only): season payments per currency (total, paid, outstanding), payment statuses, this month's expenses by category, staff bonuses.", obj(),
    (c) => rpc(c.user, "ai_finance_summary", { p_intake_id: null })),
  t("search_communications", "Hybrid (semantic + keyword) search across Telegram chats, call summaries/transcripts and documents. Use for 'what did we discuss about X' / 'who asked about X' / topical questions. Returns the most relevant snippets with the student they belong to.",
    obj({ query: str(), limit: int(), student_id: str("optional: restrict to one student's user_id") }, ["query"]),
    (c, a) => searchCommunicationsHybrid(c.service, a.query ?? "", a.limit ?? 12, a.student_id ?? null)),
];
