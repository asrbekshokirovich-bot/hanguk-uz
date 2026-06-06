// enrich-lead — reads a lead's notes, Telegram chats and call summaries and
// uses Gemini to auto-fill structured fields (exam date/type, intake, program,
// levels, priority) + a short summary. Only fills EMPTY fields (never clobbers
// staff-entered values). Internal-only (service-role bearer).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const SCHEMA = {
  type: "object",
  properties: {
    exam_date: { type: "string", description: "Planned TOPIK/IELTS exam date as YYYY-MM-DD, or empty if not mentioned" },
    exam_type: { type: "string", description: "TOPIK | IELTS | none | empty" },
    target_intake: { type: "string", description: "e.g. Spring 2027, or empty" },
    preferred_program: { type: "string" },
    preferred_university: { type: "string" },
    korean_level: { type: "string" },
    english_level: { type: "string" },
    education_level: { type: "string" },
    interest_level: { type: "string", description: "low | medium | high | empty" },
    priority_score: { type: "number", description: "0-100, how promising/ready this lead is" },
    summary: { type: "string", description: "2-3 sentence summary of this lead in English" },
  },
  required: ["summary"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "").trim() !== serviceKey) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  let leadId: string | null = null;
  try { const b = await req.json(); leadId = b.lead_id ?? null; } catch (_e) { /* */ }
  if (!leadId) return json({ error: "Missing lead_id" }, 400);

  try {
    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (error || !lead) throw new Error("Lead not found");

    const [msgs, calls] = await Promise.all([
      supabase.from("messages").select("content, direction, created_at").eq("metadata->>lead_id", leadId).order("created_at", { ascending: true }).limit(60),
      supabase.from("call_analyses").select("summary_uz, summary_en, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(8),
    ]);
    const messages = msgs.data || [];
    const callRows = calls.data || [];

    const hasContext = (lead.notes && lead.notes.trim()) || messages.length || callRows.length;
    if (!hasContext) {
      await supabase.from("leads").update({ enriched_at: new Date().toISOString() }).eq("id", leadId);
      return json({ ok: true, lead_id: leadId, skipped: "no_context" });
    }

    const ctx = [
      `Lead: ${lead.full_name || ""} (${lead.phone || ""})`,
      lead.notes ? `Notes: ${lead.notes}` : "",
      callRows.length ? "Call summaries:\n" + callRows.map((c: any) => `- ${c.summary_uz || c.summary_en || ""}`).join("\n") : "",
      messages.length ? "Telegram chat:\n" + messages.map((m: any) => `${m.direction === "outgoing" ? "Staff" : "Lead"}: ${String(m.content).slice(0, 200)}`).join("\n") : "",
    ].filter(Boolean).join("\n\n");

    const prompt = "You are analysing a sales lead for a Korean university admissions agency in Uzbekistan. Based ONLY on the information below (profile, notes, chats, call summaries — mostly Uzbek), extract what you can. Leave a field empty if it is not mentioned. Use YYYY-MM-DD for dates. Also write a 2-3 sentence summary.\n\n" + ctx;

    const res = await fetch(`${GEMINI_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: SCHEMA } }),
    });
    if (!res.ok) throw new Error(`Gemini failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const jr = await res.json();
    const text = jr?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    let ex: any = null;
    try { ex = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { ex = JSON.parse(m[0]); } catch { /* */ } } }
    if (!ex) throw new Error("Unparseable enrichment");

    // Only fill fields that are currently empty; never overwrite staff data.
    const upd: any = { enriched_at: new Date().toISOString() };
    const setIfEmpty = (col: string, val: any) => {
      if (val === undefined || val === null || String(val).trim() === "" || String(val).toLowerCase() === "none") return;
      if (lead[col] === null || lead[col] === undefined || String(lead[col]).trim() === "") upd[col] = val;
    };
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(ex.exam_date || ""))) setIfEmpty("exam_date", ex.exam_date);
    setIfEmpty("exam_type", ex.exam_type);
    setIfEmpty("target_intake", ex.target_intake);
    setIfEmpty("preferred_program", ex.preferred_program);
    setIfEmpty("preferred_university", ex.preferred_university);
    setIfEmpty("korean_level", ex.korean_level);
    setIfEmpty("english_level", ex.english_level);
    setIfEmpty("education_level", ex.education_level);
    setIfEmpty("interest_level", ex.interest_level);
    if (typeof ex.priority_score === "number" && ex.priority_score >= 0 && ex.priority_score <= 100 && (lead.priority_score === null || lead.priority_score === 0)) upd.priority_score = Math.round(ex.priority_score);
    if (ex.summary && String(ex.summary).trim()) upd.ai_summary = String(ex.summary).slice(0, 1000);

    await supabase.from("leads").update(upd).eq("id", leadId);
    return json({ ok: true, lead_id: leadId, set: Object.keys(upd).filter((k) => k !== "enriched_at") });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`enrich-lead failed for ${leadId}:`, message);
    return json({ ok: false, lead_id: leadId, error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
