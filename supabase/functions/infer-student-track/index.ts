// infer-student-track — derives a student's language track (korean | english |
// both) from their chat messages and call transcripts/analyses when no language
// certificate has set it. Certificates and manual staff edits always win, so we
// only write when language_track_source is null/'default'/'conversation'.
//
// Internal-only: present the service-role key as a Bearer token. Intended to be
// invoked by dispatch-comm-jobs (job_type 'student_track_infer') or directly.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateJSON } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    track: { type: "string", description: "korean | english | both | unknown" },
    confidence: { type: "number", description: "0..1" },
    reason: { type: "string" },
  },
  required: ["track"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "").trim() !== serviceKey) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  let studentId: string | null = null;
  try { const b = await req.json(); studentId = b.student_id ?? null; } catch (_e) { /* */ }
  if (!studentId) return json({ error: "Missing student_id" }, 400);

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, language_track, language_track_source")
      .eq("user_id", studentId)
      .maybeSingle();
    if (!profile) return json({ ok: false, error: "Student not found" }, 404);

    // Certificates and manual edits are authoritative — don't touch them.
    if (profile.language_track_source === "manual" || profile.language_track_source === "certificate") {
      return json({ ok: true, skipped: "authoritative_source", source: profile.language_track_source });
    }

    // Gather recent conversation context.
    const [{ data: messages }, { data: transcripts }, { data: analyses }] = await Promise.all([
      supabase.from("messages").select("content, created_at").eq("student_id", studentId)
        .order("created_at", { ascending: false }).limit(60),
      supabase.from("call_transcripts").select("full_text, call_id").eq("student_id", studentId).limit(10),
      supabase.from("call_analyses").select("summary_uz, summary_en, topics").eq("student_id", studentId)
        .order("created_at", { ascending: false }).limit(10),
    ]);

    const chatText = (messages ?? []).map((m: any) => m.content).filter(Boolean).join("\n").slice(0, 8000);
    const callText = (analyses ?? [])
      .map((a: any) => [a.summary_uz, a.summary_en, (a.topics ?? []).join(", ")].filter(Boolean).join(" — "))
      .join("\n").slice(0, 4000);

    if (!chatText && !callText) {
      return json({ ok: true, skipped: "no_conversation_data" });
    }

    const result = await generateJSON<{ track: string; confidence?: number; reason?: string }>({
      prompt:
        "You decide which study/interview language track a Korean-university applicant in Uzbekistan is pursuing, " +
        "based on their conversations with our agency. Return 'korean' if they study/prepare in Korean (TOPIK, 한국어), " +
        "'english' if they pursue English-taught programs (IELTS, English interview), 'both' if clearly both, or " +
        "'unknown' if there is not enough signal.\n\n" +
        `CHAT MESSAGES:\n${chatText || "(none)"}\n\nCALL SUMMARIES:\n${callText || "(none)"}`,
      schema: SCHEMA,
      temperature: 0,
    });

    const track = String(result?.track ?? "unknown").toLowerCase();
    const confidence = Number(result?.confidence ?? 0);
    if (!["korean", "english", "both"].includes(track) || confidence < 0.5) {
      return json({ ok: true, skipped: "low_confidence", track, confidence });
    }

    await supabase.from("profiles")
      .update({ language_track: track, language_track_source: "conversation" })
      .eq("id", profile.id);

    return json({ ok: true, student_id: studentId, track, confidence, reason: result?.reason ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`infer-student-track failed for ${studentId}:`, message);
    return json({ ok: false, student_id: studentId, error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
