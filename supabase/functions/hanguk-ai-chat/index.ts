import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embedContent001 } from "../_shared/gemini.ts";
import { CLARIFY_GUIDE, QUERY_TOOL, runReadOnlyQuery, getAiSchema } from "./analytics.ts";

// Hanguk AI — retrieval-augmented assistant.
// Answers questions about a student from their REAL data: call summaries
// (Uzbek), Telegram chats, plus CRM facts — and can search across everyone.
// Streams an OpenAI-compatible SSE response (the web client parses delta.content).
//
// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// ---- small language + entity helpers (no backslash-heavy regex) ------------
function isUzbek(message: string): boolean {
  const s = message.toLowerCase();
  const markers = ["o'", "g'", "ning", "uchun", "kerak", "haqida", "qanday", "qancha", "talaba", "rahmat", "salom", "bo'", "hujjat", "to'lov"];
  let n = 0;
  for (const w of markers) if (s.includes(w)) n++;
  return n >= 2;
}

// Staff frequently identify a student by a pasted phone number. Pull any
// digit run of 7+ (after stripping spaces / dashes / parens / +) so we can
// match on profiles.phone as well as on the name.
function phoneCandidates(message: string): string[] {
  const matches = message.match(/\+?\d[\d\s\-()]{6,}\d/g) || [];
  return Array.from(new Set(
    matches.map((m) => m.replace(/\D/g, "")).filter((d) => d.length >= 7),
  )).slice(0, 2);
}

function sanitizeQuery(message: string): string {
  const cleaned = message.toLowerCase().replace(/[^\p{L}\p{N}\s'’ʼ]/gu, " ").replace(/\s+/g, " ").trim();
  const stop = new Set(["the", "and", "for", "what", "who", "which", "this", "that", "with", "did", "does", "about", "from", "have", "has", "nima", "kim", "qaysi", "uchun", "bilan", "haqida", "bormi"]);
  const words = cleaned.split(" ").filter((w) => w.length >= 3 && !stop.has(w));
  return Array.from(new Set(words)).slice(0, 8).join(" ");
}

// Names are often typed lowercase ("jetkenshek haqida malumot ber"), in Cyrillic,
// or with apostrophes (O'g'li / qizi). Pull meaningful word tokens — apostrophe-
// stripped, minimum 3 chars, minus common English/Uzbek/Russian query words and
// patronymic suffixes — so we can match a person by name across scripts.
const NAME_STOPWORDS = new Set([
  "the", "and", "for", "what", "who", "which", "this", "that", "with", "does", "did",
  "about", "from", "have", "has", "want", "list", "all", "can", "you", "your", "tell",
  "give", "show", "info", "information", "details", "detail", "find", "search", "name",
  "student", "students", "lead", "leads", "please", "need", "more", "data", "his", "her",
  "topik", "ielts", "level", "score", "language", "proficiency", "document", "documents",
  "nima", "kim", "qaysi", "uchun", "bilan", "haqida", "haqidagi", "bormi", "malumot",
  "malumotlar", "ma'lumot", "ber", "bering", "korsat", "korsating", "royxat", "talaba",
  "talabalar", "mijoz", "menga", "qancha", "qanday", "kerak", "hammasi", "barcha", "qidir",
  "darajasi", "daraja", "hujjat", "hujjatlar", "tili", "bilim",
  // patronymic suffixes that are not useful search terms
  "ogli", "oglu", "ugli", "uglu", "qizi", "kizi",
  "что", "кто", "какой", "про", "дай", "покажи", "информация", "найди", "студент", "имя",
  "уровень", "балл", "язык", "документ", "документы",
]);

function nameTokens(message: string): string[] {
  const cleaned = message
    .toLowerCase()
    .replace(/[''ʼ`']/g, "")                  // O'g'li -> ogli, d'Souza -> dsouza
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned
    .split(" ")
    .filter((w) => w.length >= 3 && !NAME_STOPWORDS.has(w) && !/^\d+$/.test(w));
  return Array.from(new Set(words)).slice(0, 6);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB"); } catch { return String(d); }
}

// ---- retrieval -------------------------------------------------------------
async function getStudentBundle(supabase: any, userId: string) {
  const [profile, apps, docs, pays, analyses, msgs, tasks] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("applications").select("status, decision, notes, university:universities(name_en)").eq("student_id", userId).order("created_at", { ascending: false }),
    supabase.from("documents").select("name, status, notes").eq("student_id", userId).order("created_at", { ascending: false }),
    supabase.from("payments").select("payment_type, amount, paid_amount, status, due_date").eq("student_id", userId),
    supabase.from("call_analyses").select("summary_uz, summary_en, intent, sentiment, action_items, follow_up_needed, created_at").eq("student_id", userId).order("created_at", { ascending: false }).limit(8),
    supabase.from("messages").select("content, direction, created_at").eq("student_id", userId).order("created_at", { ascending: false }).limit(40),
    supabase.from("tasks").select("title, status, priority, due_date").eq("student_id", userId).neq("status", "completed").limit(10),
  ]);
  return {
    profile: profile.data, apps: apps.data || [], docs: docs.data || [], pays: pays.data || [],
    analyses: analyses.data || [], msgs: (msgs.data || []).reverse(), tasks: tasks.data || [],
  };
}

// Pull language-proficiency signals (TOPIK / IELTS) out of an extraction's
// key_fields + text. Profiles.topik_level / ielts_score are almost always empty;
// the real evidence lives in uploaded TOPIK score reports and IELTS certificates.
function profFromExtraction(d: any): string[] {
  const fields: any[] = Array.isArray(d.key_fields) ? d.key_fields : [];
  const fieldText = fields.map((f) => `${f.label}: ${f.value}`).join(" | ");
  const hay = `${d.doc_type || ""} ${fieldText} ${String(d.full_text || "").slice(0, 600)}`.toLowerCase();
  const pick = (labels: string[]): string => {
    for (const f of fields) {
      const l = String(f.label || "").toLowerCase();
      if (labels.some((k) => l.includes(k)) && f.value) return String(f.value);
    }
    return "";
  };
  const out: string[] = [];
  if (hay.includes("topik") || hay.includes("한국어능력") || hay.includes("급")) {
    const level = pick(["level", "급"]);
    const total = pick(["total score", "total"]);
    out.push(`TOPIK${level ? ` — level ${level}` : ""}${total ? `, total ${total}` : ""} (from uploaded TOPIK report)`);
  }
  if (hay.includes("ielts")) {
    const band = pick(["overall", "band", "ielts"]);
    out.push(`IELTS${band ? ` — ${band}` : ""} (from uploaded IELTS certificate)`);
  }
  return out;
}

async function getStudentDocs(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("document_extractions")
    .select("doc_type, key_fields, full_text")
    .eq("student_id", userId)
    .limit(25);
  if (!data || !data.length) return "";

  // Surface any TOPIK / IELTS evidence first so the model never misses it.
  const proficiency = Array.from(new Set(data.flatMap(profFromExtraction)));

  const rows = data.map((d: any) => {
    let fields = "";
    if (Array.isArray(d.key_fields) && d.key_fields.length) {
      // Cap to keep huge transcripts (80+ course rows) from drowning the prompt.
      fields = d.key_fields
        .slice(0, 14)
        .map((f: any) => `${f.label}: ${String(f.value ?? "").slice(0, 120)}`)
        .join("; ");
      if (d.key_fields.length > 14) fields += ` … (+${d.key_fields.length - 14} more fields)`;
    }
    return `• ${d.doc_type || "document"}: ${fields || String(d.full_text || "").slice(0, 240)}`;
  });

  const profBlock = proficiency.length
    ? `\n🎓 LANGUAGE PROFICIENCY (from documents): ${proficiency.join(" | ")}`
    : "";
  return `${profBlock}\n📄 DOCUMENT CONTENTS:\n${rows.join("\n")}`;
}

// Find the student(s) a staff question is about. Robust against the brittle old
// approach (full_name ILIKE '%token%' LIMIT 3, no ranking) which missed people
// when a first name was shared, misspelled, transliterated, or pasted as a phone.
//   1) Prefer the fuzzy, ranked, accent/apostrophe-tolerant `search_students` RPC.
//   2) If that RPC isn't deployed yet, fall back to a ranked ILIKE over the roster:
//      fetch a wide candidate set (no premature LIMIT 3) and score by how many
//      query tokens each name covers, then keep the best handful.
type StudentMatch = { user_id: string; full_name: string; phone: string | null };

async function findStudents(supabase: any, tokens: string[], phones: string[]): Promise<StudentMatch[]> {
  if (!tokens.length && !phones.length) return [];
  const query = [...tokens, ...phones].join(" ").trim();

  try {
    const { data, error } = await supabase.rpc("search_students", { p_query: query, p_limit: 6 });
    if (!error && Array.isArray(data) && data.length) {
      return data.map((r: any) => ({ user_id: r.user_id, full_name: r.full_name, phone: r.phone }));
    }
  } catch { /* RPC not deployed — fall through to ILIKE */ }

  const ors = [
    ...tokens.map((t) => `full_name.ilike.%${t}%`),
    ...phones.map((p) => `phone.ilike.%${p}%`),
  ].join(",");
  if (!ors) return [];
  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, role")
    .or(ors)
    .limit(60);

  const candidates = (data || []).filter((s: any) => !s.role || s.role === "student");
  const scored = candidates.map((s: any) => {
    const hay = String(s.full_name || "").toLowerCase().replace(/[''ʼ`']/g, "");
    const words = hay.split(/\s+/);
    let score = 0;
    for (const t of tokens) {
      if (words.includes(t)) score += 2;        // whole-name-part match
      else if (hay.includes(t)) score += 1;     // substring match
    }
    const digits = String(s.phone || "").replace(/\D/g, "");
    for (const p of phones) if (digits.includes(p)) score += 5;
    return { s, score };
  });
  return scored
    .filter((x: any) => x.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 6)
    .map((x: any) => ({ user_id: x.s.user_id, full_name: x.s.full_name, phone: x.s.phone }));
}

function formatBundle(b: any, opts: { staff: boolean }): string {
  const p = b.profile || {};
  const lines: string[] = [];
  lines.push(`### ${p.full_name || "Student"}${opts.staff && p.phone ? ` (${p.phone})` : ""}`);
  if (p.city || p.payment_plan) {
    lines.push(`City: ${p.city || "—"}${opts.staff ? ` | Plan: ${p.payment_plan || "—"}` : ""}`);
  }
  // Language proficiency — show every signal we have, not just TOPIK. The
  // structured columns are often empty, so flag that the docs hold the evidence.
  const prof: string[] = [];
  if (p.topik_level) prof.push(`TOPIK level ${p.topik_level}`);
  if (p.ielts_score) prof.push(`IELTS ${p.ielts_score}`);
  if (p.language_track) prof.push(`track: ${p.language_track}`);
  lines.push(
    prof.length
      ? `Language proficiency: ${prof.join(" | ")}`
      : `Language proficiency: not set on profile — check DOCUMENT CONTENTS below for a TOPIK/IELTS certificate.`,
  );
  if (b.apps.length) {
    lines.push("Applications: " + b.apps.map((a: any) => `${a.university?.name_en || "University"} (${a.status}${a.decision ? "/" + a.decision : ""})`).join("; "));
  }
  if (opts.staff && b.pays.length) {
    const total = b.pays.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    const paid = b.pays.reduce((s: number, x: any) => s + Number(x.paid_amount || 0), 0);
    lines.push(`Payments: paid $${paid} of $${total} (remaining $${total - paid}).`);
  }
  if (b.docs.length) {
    const pending = b.docs.filter((d: any) => d.status === "uploaded").length;
    const approved = b.docs.filter((d: any) => d.status === "approved").length;
    lines.push(`Documents: ${b.docs.length} total, ${approved} approved, ${pending} pending review.`);
  }
  if (opts.staff && b.tasks.length) {
    lines.push("Open tasks: " + b.tasks.map((t: any) => `${t.title} (${t.priority})`).join("; "));
  }
  if (b.analyses.length) {
    lines.push("\n📞 RECENT CALLS:");
    for (const a of b.analyses) {
      const sum = a.summary_uz || a.summary_en || "";
      const ai = (a.action_items || []).map((x: any) => x.text).filter(Boolean).slice(0, 3).join("; ");
      lines.push(`• [${fmtDate(a.created_at)}] ${sum}${a.follow_up_needed ? " (follow-up needed)" : ""}${ai ? ` — action items: ${ai}` : ""}`);
    }
  }
  if (b.msgs.length) {
    lines.push("\n💬 RECENT TELEGRAM CHAT:");
    for (const m of b.msgs.slice(-25)) {
      lines.push(`• [${fmtDate(m.created_at)}] ${m.direction === "outgoing" ? "Staff" : "Student"}: ${String(m.content).slice(0, 200)}`);
    }
  }
  if (b.docText) lines.push(b.docText);
  return lines.join("\n");
}

async function crossSearch(supabase: any, message: string): Promise<string> {
  const q = sanitizeQuery(message);
  if (q.length < 3) return "";
  const { data, error } = await supabase.rpc("search_communications_text", { p_query: q, p_limit: 12 });
  if (error || !data || !data.length) return "";
  const ids = Array.from(new Set(data.filter((r: any) => r.student_id).map((r: any) => r.student_id)));
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
    for (const p of profs || []) names[p.user_id] = p.full_name;
  }
  const rows = data.map((r: any) => {
    const who = r.student_id ? (names[r.student_id] || "student") : "unknown contact";
    const icon = r.kind === "call" ? "📞" : "💬";
    return `• ${icon} [${fmtDate(r.when_at)}] ${who}: ${String(r.snippet).slice(0, 220)}`;
  });
  return `\n## 🔎 SEARCH MATCHES for "${q}"\n${rows.join("\n")}`;
}

async function lightStats(supabase: any): Promise<string> {
  const [students, overdue, pendingDocs, unread, followups, leads] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "uploaded"),
    supabase.from("message_threads").select("*", { count: "exact", head: true }).gt("unread_count", 0),
    supabase.from("call_analyses").select("*", { count: "exact", head: true }).eq("follow_up_needed", true),
    supabase.from("leads").select("*", { count: "exact", head: true }),
  ]);
  return `Students: ${students.count ?? 0} | Leads: ${leads.count ?? 0} | Overdue payments: ${overdue.count ?? 0} | Docs pending review: ${pendingDocs.count ?? 0} | Unread chats: ${unread.count ?? 0} | Calls needing follow-up: ${followups.count ?? 0}`;
}

// ---- leads -----------------------------------------------------------------
const LEAD_WORDS = ["lead", "exam", "topik", "ielts", "follow", "intake", "pipeline", "prospect", "convert", "stipend"];
function leadIntent(message: string): boolean {
  const s = message.toLowerCase();
  return LEAD_WORDS.some((w) => s.includes(w));
}

async function getLeads(supabase: any) {
  const { data } = await supabase.from("leads")
    .select("full_name, phone, status, priority_score, source, exam_date, exam_type, target_intake, preferred_program, preferred_university, city, education_level, korean_level, next_follow_up, interest_level")
    .order("priority_score", { ascending: false }).limit(300);
  return data || [];
}

function formatLeads(leads: any[]): string {
  return leads.map((l: any) => "• " + [
    l.full_name || "—", l.phone || "", `status:${l.status || "new"}`, `prio:${l.priority_score ?? 0}`,
    l.source ? `src:${l.source}` : "",
    (l.exam_type || l.exam_date) ? `exam:${l.exam_type || ""} ${l.exam_date || ""}`.trim() : "",
    l.target_intake ? `intake:${l.target_intake}` : "",
    (l.preferred_program || l.preferred_university) ? `prog:${l.preferred_program || l.preferred_university}` : "",
    l.city ? `city:${l.city}` : "",
    l.korean_level ? `korean:${l.korean_level}` : "",
    l.next_follow_up ? `follow:${fmtDate(l.next_follow_up)}` : "",
  ].filter(Boolean).join(" | ")).join("\n");
}

// ---- prompts ---------------------------------------------------------------
function langLine(language: string): string {
  if (language === "uz") return "MUHIM: Faqat o'zbek tilida javob bering.";
  if (language === "ru") return "ВАЖНО: Отвечайте только на русском языке.";
  if (language === "ko") return "중요: 한국어로만 답변하세요.";
  return "Respond in English.";
}

async function buildStaffPrompt(supabase: any, userId: string, message: string, language: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);

  // Match the person across scripts (Latin/Cyrillic), lowercase typing, apostrophes
  // and pasted phone numbers, then look them up in BOTH the student roster (fuzzy,
  // ranked) and the leads pipeline by name/phone.
  const tokens = nameTokens(message);
  const phones = phoneCandidates(message);
  let namedLeads: any[] = [];
  const leadOrs = [
    ...tokens.map((t) => `full_name.ilike.%${t}%`),
    ...phones.map((p) => `phone.ilike.%${p}%`),
  ].join(",");
  const [matched, leadsRes] = await Promise.all([
    findStudents(supabase, tokens, phones),
    leadOrs
      ? supabase.from("leads")
          .select("full_name, phone, status, priority_score, source, exam_date, exam_type, target_intake, preferred_program, preferred_university, city, education_level, korean_level, next_follow_up, interest_level")
          .or(leadOrs).limit(8)
      : Promise.resolve({ data: [] }),
  ]);
  namedLeads = leadsRes.data || [];

  const bundles = await Promise.all(matched.map(async (s: StudentMatch) => {
    const b = await getStudentBundle(supabase, s.user_id);
    (b as any).docText = await getStudentDocs(supabase, s.user_id);
    return b;
  }));
  const [stats, search] = await Promise.all([lightStats(supabase), crossSearch(supabase, message)]);

  let studentSection = "";
  if (bundles.length) {
    studentSection = "\n## 👤 STUDENT(S) IN THIS QUESTION\n" + bundles.map((b) => formatBundle(b, { staff: true })).join("\n\n");
  }

  let namedLeadsSection = "";
  if (namedLeads.length) {
    namedLeadsSection = "\n## 🎯 MATCHING LEAD(S) BY NAME\n" + formatLeads(namedLeads);
  }

  let leadsSection = "";
  if (leadIntent(message)) {
    const leads = await getLeads(supabase);
    leadsSection = `\n## 🎯 LEADS (${leads.length}) — filter this list to answer lead questions\n${formatLeads(leads)}`;
  }

  return `# Hanguk AI — CRM assistant for staff
${langLine(language)}

You are Hanguk AI for Hanguk Consulting (Korean university admissions, Uzbekistan).
You can READ each student's phone-call summaries (Uzbek), Telegram chats, applications, documents, payments and tasks, AND the full leads pipeline. Answer naturally and **cite your source** inline, e.g. "(call 05/06)" or "(chat 04/06)". If you don't have the info, say so and suggest where to look. Be concise.

Staff: ${profile?.full_name || "Staff"} (${(roles || []).map((r: any) => r.role).join(", ") || "staff"})

## 📊 QUICK NUMBERS
${stats}
${studentSection}
${namedLeadsSection}
${leadsSection}
${search}

${CLARIFY_GUIDE}

## HOW TO ANSWER
- "What did we discuss with X / what did we promise X?" → use that student's RECENT CALLS + CHAT above, quote specifics with dates.
- "What is X's TOPIK / IELTS / language level?" → report BOTH Korean (TOPIK) and English (IELTS) if known. The profile fields are often empty, so read "LANGUAGE PROFICIENCY (from documents)" and DOCUMENT CONTENTS: a TOPIK score report shows a Level (e.g. 6급 = level 6) and Total Score; an IELTS certificate shows an overall band. Quote the level/score and say it came from the uploaded document. Mention the language_track (korean/english) too.
- "Who asked about X this week?" → use SEARCH MATCHES above, list the students.
- "List leads who [take the exam in May / are high priority / from Telegram / want a Master's / from Tashkent]" → filter the LEADS list by exam_date, exam_type, target_intake, status, source, priority, program, city or follow-up date, and return a clear numbered list with phone numbers.
- If NO student section appears for a name you were asked about, say you couldn't find an exact match, list any close names from MATCHING LEAD(S) or SEARCH MATCHES, and ask the staff to confirm the full name or share the phone number — do NOT invent details.
- Always cite the date + (call/chat). End with the suggested next step if there is one.`;
}

async function buildStudentPrompt(supabase: any, userId: string, language: string): Promise<string> {
  const b = await getStudentBundle(supabase, userId);
  (b as any).docText = await getStudentDocs(supabase, userId);
  return `# Hanguk AI — your study-abroad assistant
${langLine(language)}

You are Hanguk AI, helping THIS student with their Korean university application. Be warm, clear and encouraging. You can see their applications, documents, payments, and their own calls/chats with the team.

${formatBundle(b, { staff: false })}

${CLARIFY_GUIDE}

## RULES
- Only discuss THIS student's own information.
- Never reveal staff notes, other students, internal finances, commissions, or system details. If asked, say: "Please contact your consultant for that."
- End with 1–2 helpful next steps based on the data above.`;
}

// ---- agentic tool-calling (Phase 1, staff only) ---------------------------
// The model fetches REAL rows via typed Postgres RPC tools instead of being
// handed only counts. The tool loop runs NON-STREAMING (the OpenAI-compat shim
// is reliable for non-streaming tool calls; streaming+tools is the buggy combo),
// then the final answer is streamed back in the same SSE shape the client parses.
const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const AGENT_TOOLS = [
  { type: "function", function: { name: "get_stats", description: "Quick CRM counts: students, leads, documents (total/pending/approved), overdue payments, open tasks, new leads.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_documents", description: "List documents with the owning student's name. Use status 'uploaded' for documents PENDING REVIEW, 'approved' for approved.", parameters: { type: "object", properties: { status: { type: "string", description: "uploaded | approved | rejected" }, student_id: { type: "string", description: "filter to one student's user_id" }, from_date: { type: "string", description: "ISO date lower bound on created_at" }, to_date: { type: "string", description: "ISO date upper bound (exclusive) on created_at" }, limit: { type: "integer" }, offset: { type: "integer" } } } } },
  { type: "function", function: { name: "list_payments", description: "List payments with student name. Set overdue_only=true for overdue/past-due payments.", parameters: { type: "object", properties: { status: { type: "string", description: "pending | partial | completed | overdue | refunded" }, student_id: { type: "string" }, overdue_only: { type: "boolean" }, limit: { type: "integer" }, offset: { type: "integer" } } } } },
  { type: "function", function: { name: "list_tasks", description: "List staff tasks.", parameters: { type: "object", properties: { status: { type: "string", description: "todo | in_progress | completed | cancelled" }, priority: { type: "string", description: "urgent | high | normal | low" }, limit: { type: "integer" }, offset: { type: "integer" } } } } },
  { type: "function", function: { name: "list_leads", description: "List/filter the leads pipeline.", parameters: { type: "object", properties: { query: { type: "string", description: "name or phone substring" }, status: { type: "string", description: "new | contacted | qualified | converted | lost" }, source: { type: "string", description: "manual | telegram | instagram | call | ai_detected" }, exam_type: { type: "string", description: "TOPIK | IELTS | none" }, city: { type: "string" }, interest_level: { type: "string", description: "low | medium | high" }, from_exam_date: { type: "string", description: "ISO date" }, to_exam_date: { type: "string", description: "ISO date" }, limit: { type: "integer" }, offset: { type: "integer" } } } } },
  { type: "function", function: { name: "list_students", description: "List/search students (non-staff users) by name/phone/city.", parameters: { type: "object", properties: { query: { type: "string" }, city: { type: "string" }, limit: { type: "integer" }, offset: { type: "integer" } } } } },
  { type: "function", function: { name: "search_students", description: "Fuzzy, ranked student lookup by name or pasted phone number. Use to resolve a person mentioned by name to their student_id.", parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } }, required: ["query"] } } },
  { type: "function", function: { name: "search_communications", description: "Hybrid (semantic + keyword) search across Telegram chats, call summaries/transcripts and documents. Use for 'what did we discuss about X' / 'who asked about X' / topical questions. Returns the most relevant snippets with the student they belong to.", parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" }, student_id: { type: "string", description: "optional: restrict to one student's user_id" } }, required: ["query"] } } },
];

// Phase 2: hybrid retrieval for the content tool. Embed the query with
// gemini-embedding-001, fuse PGroonga (lexical) + pgvector (dense) via the
// hybrid_search_content RPC (RRF), then optionally rerank. Degrades gracefully:
// if embedding/hybrid yields nothing (e.g. content_embeddings not back-filled
// yet) or errors, fall back to the original lexical search over the source
// tables so there is never a regression vs. Phase 1.
async function searchCommunicationsHybrid(
  client: any,
  query: string,
  limit: number,
  studentId?: string | null,
): Promise<any[]> {
  const q = sanitizeQuery(query);
  if (q.length < 3) return [];
  try {
    const embedding = await embedContent001(q, "RETRIEVAL_QUERY", 1536);
    const { data, error } = await client.rpc("hybrid_search_content", {
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
  // Lexical fallback (works even before the embedding backfill completes).
  const { data } = await client.rpc("search_communications_text", { p_query: q, p_limit: limit, p_student: studentId ?? null });
  return data ?? [];
}

async function callAgentTool(client: any, name: string, rawArgs: string | undefined): Promise<any> {
  let a: any = {};
  try { a = rawArgs ? JSON.parse(rawArgs) : {}; } catch { /* tolerate bad args */ }
  const rpc = async (fn: string, params: any) => {
    const { data, error } = await client.rpc(fn, params);
    return error ? { error: error.message } : data;
  };
  switch (name) {
    case "get_stats": return rpc("ai_stats", {});
    case "list_documents": return rpc("ai_list_documents", { p_status: a.status ?? null, p_student_id: a.student_id ?? null, p_from: a.from_date ?? null, p_to: a.to_date ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 });
    case "list_payments": return rpc("ai_list_payments", { p_status: a.status ?? null, p_student_id: a.student_id ?? null, p_overdue_only: a.overdue_only ?? false, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 });
    case "list_tasks": return rpc("ai_list_tasks", { p_status: a.status ?? null, p_priority: a.priority ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 });
    case "list_leads": return rpc("ai_list_leads", { p_query: a.query ?? null, p_status: a.status ?? null, p_source: a.source ?? null, p_exam_type: a.exam_type ?? null, p_city: a.city ?? null, p_interest_level: a.interest_level ?? null, p_from_exam_date: a.from_exam_date ?? null, p_to_exam_date: a.to_exam_date ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 });
    case "list_students": return rpc("ai_list_students", { p_query: a.query ?? null, p_city: a.city ?? null, p_limit: a.limit ?? 50, p_offset: a.offset ?? 0 });
    case "search_students": return rpc("search_students", { p_query: a.query ?? "", p_limit: a.limit ?? 6 });
    case "search_communications": return searchCommunicationsHybrid(client, a.query ?? "", a.limit ?? 12, a.student_id ?? null);
    case "query_database": return runReadOnlyQuery(a.sql);
    default: return { error: `unknown tool: ${name}` };
  }
}

function staffAgentSystem(language: string, today: string, staffName: string, schema: string | null): string {
  const analytics = schema
    ? `

## 🛠 query_database — run SQL to COMPUTE any number the typed tools don't cover
For "how many / how much / total / average / which / breakdown by …" questions
that the tools above can't answer directly (e.g. admissions outcomes, revenue by
university, applications by status), call query_database with a read-only SQL
SELECT over these views (bare names resolve to them; SELECT/WITH only, one
statement, no semicolon):
${schema}

Notes:
- There is NO explicit "accepted" field. \`applications.decision\` is usually
  empty and \`applications.status\` holds mixed values — so if asked about
  admissions outcomes, FIRST run \`select status, count(*) from applications
  group by 1 order by 2 desc\` to see the real values, then ASK the user (see the
  multiple-choice rule) which status counts as accepted, then compute.
- Join keys: applications.student_id → students.user_id; payments.student_id →
  students.user_id; applications.institution_id → institutions.id (or use the
  built-in university_name). Money: sum(paid_amount) = collected, sum(amount -
  paid_amount) = outstanding.`
    : "";
  return `# Hanguk AI — CRM assistant for staff (agentic)
${langLine(language)}

You are Hanguk AI for Hanguk Consulting (Korean university admissions, Uzbekistan).
Today is ${today} (timezone Asia/Tashkent). Staff member: ${staffName}.

You answer questions by CALLING TOOLS to fetch real CRM data, then summarising the results.

## RULES
- ALWAYS call a tool to get data. NEVER invent rows, names, phone numbers, counts, statuses or dates.
- "documents pending review" = documents with status 'uploaded' → call list_documents(status:"uploaded").
- "overdue payments" → list_payments(overdue_only:true). "open tasks" → list_tasks(status:"todo" or "in_progress").
- To answer about a person mentioned by name, first call search_students (or list_leads with query) to resolve them, then fetch their details.
- Present results as a clear numbered list including each person's NAME (and phone). State the total: "Showing N of M".
- If a tool returns 0 rows (or {total:0}), say so plainly — do not fabricate. If a tool returns {error: ...}, report that you couldn't fetch it.
- Answer ONLY from values present in tool results. Cite dates from the data. Be concise.${analytics}

${CLARIFY_GUIDE}`;
}

function streamTextAsSSE(text: string): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const size = 90;
      for (let i = 0; i < text.length; i += size) {
        const chunk = text.slice(i, i + size);
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
      }
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

async function runStaffAgent(
  userClient: any,
  service: any,
  opts: { message: string; language: string; userId: string; staffName: string; canQuery: boolean },
): Promise<Response> {
  const { message, language, userId, staffName, canQuery } = opts;

  const { data: prev } = await service.from("ai_conversations")
    .select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  const history = (prev || []).reverse();
  await service.from("ai_conversations").insert({ user_id: userId, user_type: "staff", role: "user", content: message });

  // owner/admin also get the read-only SQL analytics tool + its schema.
  const schema = canQuery ? await getAiSchema() : null;
  const tools = canQuery ? [...AGENT_TOOLS, QUERY_TOOL] : AGENT_TOOLS;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const messages: any[] = [
    { role: "system", content: staffAgentSystem(language, today, staffName, schema) },
    ...history.map((c: any) => ({ role: c.role, content: c.content })),
    { role: "user", content: message },
  ];

  let finalText = "";
  for (let i = 0; i < 6; i++) {
    const resp = await fetch(GEMINI_OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-2.5-flash", messages, tools, tool_choice: "auto", stream: false }),
    });
    if (!resp.ok) throw new Error(`agent gateway ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const data = await resp.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("agent: no message in response");

    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        const result = await callAgentTool(userClient, tc.function?.name, tc.function?.arguments);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 12000) });
      }
      continue;
    }
    finalText = msg.content || "";
    break;
  }

  if (!finalText) finalText = "I couldn't produce a verified answer from the data. Please rephrase, or check the relevant section directly.";
  await service.from("ai_conversations").insert({ user_id: userId, user_type: "staff", role: "assistant", content: finalText });
  return streamTextAsSSE(finalText);
}

// ---- handler ---------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, user_id, user_type, language: requestedLang = "en" } = await req.json();
    if (!message || !user_id || !user_type) {
      return new Response(JSON.stringify({ error: "Missing required fields: message, user_id, user_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const language = isUzbek(message) ? "uz" : requestedLang;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Phase 1: agentic tool-calling for STAFF. Requires a real user JWT in the
    // Authorization header (the RPC tools self-gate on auth.uid() = a staff user),
    // so it activates only when the client forwards the session token. Any failure
    // (no JWT, not staff, gateway error) falls through to the legacy path below.
    const agentEnabled = (Deno.env.get("AI_AGENT_TOOLS") ?? "on") !== "off";
    if (agentEnabled && user_type === "staff") {
      try {
        const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
        if (token && anonKey) {
          const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: ures } = await userClient.auth.getUser();
          const authedUser = ures?.user;
          if (authedUser) {
            const { data: isStaff } = await userClient.rpc("ai_is_staff", { p_uid: authedUser.id });
            if (isStaff === true) {
              const [{ data: prof }, { data: roleRows }] = await Promise.all([
                supabase.from("profiles").select("full_name").eq("user_id", authedUser.id).maybeSingle(),
                supabase.from("user_roles").select("role").eq("user_id", authedUser.id),
              ]);
              const roleList = (roleRows || []).map((r: any) => r.role);
              const canQuery = roleList.includes("owner") || roleList.includes("admin");
              return await runStaffAgent(userClient, supabase, {
                message, language, userId: authedUser.id, staffName: prof?.full_name || "Staff", canQuery,
              });
            }
          }
        }
      } catch (e) {
        console.error("agent path failed, falling back to legacy:", e);
      }
    }

    const systemPrompt = user_type === "student"
      ? await buildStudentPrompt(supabase, user_id, language)
      : await buildStaffPrompt(supabase, user_id, message, language);

    // Short-term chat memory.
    const { data: prev } = await supabase.from("ai_conversations")
      .select("role, content").eq("user_id", user_id).order("created_at", { ascending: false }).limit(10);
    const history = (prev || []).reverse();

    await supabase.from("ai_conversations").insert({ user_id, user_type, role: "user", content: message });

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((c: any) => ({ role: c.role, content: c.content })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-2.5-flash", messages, stream: true }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Pipe the SSE through, accumulating the full text to save afterwards.
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) fullResponse += content;
              } catch { /* ignore */ }
            }
          }
        }
        if (fullResponse) {
          await supabase.from("ai_conversations").insert({ user_id, user_type, role: "assistant", content: fullResponse });
        }
        await writer.close();
      } catch (e) {
        console.error("stream error:", e);
        await writer.abort(e);
      }
    })();

    return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (error) {
    console.error("Hanguk AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
