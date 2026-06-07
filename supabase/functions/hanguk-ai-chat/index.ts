import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function candidateNames(message: string): string[] {
  const matches = message.match(/[A-Z][a-zA-Z'’ʼ]{2,}/g) || [];
  const stop = new Set(["Hanguk", "Telegram", "Instagram", "TOPIK", "IELTS", "Korea", "Korean", "Bakalavr", "Magistr", "What", "Which", "Who", "When", "Where"]);
  return Array.from(new Set(matches.filter((m) => !stop.has(m)))).slice(0, 4);
}

function sanitizeQuery(message: string): string {
  const cleaned = message.toLowerCase().replace(/[^\p{L}\p{N}\s'’ʼ]/gu, " ").replace(/\s+/g, " ").trim();
  const stop = new Set(["the", "and", "for", "what", "who", "which", "this", "that", "with", "did", "does", "about", "from", "have", "has", "nima", "kim", "qaysi", "uchun", "bilan", "haqida", "bormi"]);
  const words = cleaned.split(" ").filter((w) => w.length >= 3 && !stop.has(w));
  return Array.from(new Set(words)).slice(0, 8).join(" ");
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

async function getStudentDocs(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("document_extractions").select("doc_type, key_fields, full_text").eq("student_id", userId).limit(20);
  if (!data || !data.length) return "";
  const rows = data.map((d: any) => {
    const fields = Array.isArray(d.key_fields) ? d.key_fields.map((f: any) => `${f.label}: ${f.value}`).join("; ") : "";
    return `• ${d.doc_type || "document"}: ${fields || String(d.full_text || "").slice(0, 200)}`;
  });
  return "\n📄 DOCUMENT CONTENTS:\n" + rows.join("\n");
}

function formatBundle(b: any, opts: { staff: boolean }): string {
  const p = b.profile || {};
  const lines: string[] = [];
  lines.push(`### ${p.full_name || "Student"}${opts.staff && p.phone ? ` (${p.phone})` : ""}`);
  if (p.city || p.topik_level || p.payment_plan) {
    lines.push(`City: ${p.city || "—"} | TOPIK: ${p.topik_level || "—"}${opts.staff ? ` | Plan: ${p.payment_plan || "—"}` : ""}`);
  }
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

  const names = candidateNames(message);
  let queried: any[] = [];
  if (names.length) {
    const ors = names.map((n) => `full_name.ilike.%${n}%`).join(",");
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").or(ors).limit(3);
    queried = profs || [];
  }
  const bundles = await Promise.all(queried.map(async (s: any) => {
    const b = await getStudentBundle(supabase, s.user_id);
    (b as any).docText = await getStudentDocs(supabase, s.user_id);
    return b;
  }));
  const [stats, search] = await Promise.all([lightStats(supabase), crossSearch(supabase, message)]);

  let studentSection = "";
  if (bundles.length) {
    studentSection = "\n## 👤 STUDENT(S) IN THIS QUESTION\n" + bundles.map((b) => formatBundle(b, { staff: true })).join("\n\n");
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
${leadsSection}
${search}

## HOW TO ANSWER
- "What did we discuss with X / what did we promise X?" → use that student's RECENT CALLS + CHAT above, quote specifics with dates.
- "Who asked about X this week?" → use SEARCH MATCHES above, list the students.
- "List leads who [take the exam in May / are high priority / from Telegram / want a Master's / from Tashkent]" → filter the LEADS list by exam_date, exam_type, target_intake, status, source, priority, program, city or follow-up date, and return a clear numbered list with phone numbers.
- Always cite the date + (call/chat). End with the suggested next step if there is one.`;
}

async function buildStudentPrompt(supabase: any, userId: string, language: string): Promise<string> {
  const b = await getStudentBundle(supabase, userId);
  (b as any).docText = await getStudentDocs(supabase, userId);
  return `# Hanguk AI — your study-abroad assistant
${langLine(language)}

You are Hanguk AI, helping THIS student with their Korean university application. Be warm, clear and encouraging. You can see their applications, documents, payments, and their own calls/chats with the team.

${formatBundle(b, { staff: false })}

## RULES
- Only discuss THIS student's own information.
- Never reveal staff notes, other students, internal finances, commissions, or system details. If asked, say: "Please contact your consultant for that."
- End with 1–2 helpful next steps based on the data above.`;
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
