// ai-call-ingest
// ----------------------------------------------------------------------------
// Ingestion endpoint for the AI voice agent (ai-voice-agent/, off-platform).
// When an AI-handled call ends, the worker POSTs the call metadata + the
// Realtime transcript here. This function logs it exactly like a human call:
//   * resolves who the call belongs to (identity spine; auto-links by phone)
//   * upserts a `calls` row (voip_provider='azure_ai')
//   * stores the both-sides transcript into `call_transcripts`
//   * if ACS Call Recording produced a recording_url, nudges
//     `process-call-recording` so the existing analyse + embed pipeline runs.
//
// Auth: shared secret in the `x-ingest-secret` header (== AI_AGENT_INGEST_SECRET).
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveIdentity } from "../_shared/identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

interface Segment { speaker: string; text: string; at?: number }

interface IngestBody {
  external_call_id: string;
  voip_provider?: string;
  direction: "inbound" | "outbound" | "incoming" | "outgoing";
  phone_number: string;
  status?: string;
  started_at?: string;
  ended_at?: string;
  duration?: number;
  recording_url?: string | null;
  transcript_text?: string;
  segments?: Segment[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("AI_AGENT_INGEST_SECRET");
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: IngestBody;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.external_call_id || !body.phone_number) {
    return json({ error: "external_call_id and phone_number required" }, 400);
  }

  // The rest of the codebase speaks incoming/outgoing; the worker speaks in/outbound.
  const direction = body.direction === "outbound" || body.direction === "outgoing"
    ? "outgoing"
    : "incoming";

  // Who is this call with? Persists a new phone→person link if discovered.
  const { studentId, leadId } = await resolveIdentity(supabase, "phone", body.phone_number);

  // Upsert the call by external id (the worker may retry the ingest).
  const { data: existing } = await supabase
    .from("calls")
    .select("id")
    .eq("external_call_id", body.external_call_id)
    .maybeSingle();

  const callFields = {
    phone_number: body.phone_number,
    direction,
    status: body.status || "completed",
    duration: body.duration ?? 0,
    recording_url: body.recording_url ?? null,
    voip_provider: body.voip_provider || "azure_ai",
    started_at: body.started_at || new Date().toISOString(),
    ended_at: body.ended_at || new Date().toISOString(),
    ...(studentId ? { student_id: studentId } : {}),
    lead_id: leadId,
  };

  let callId: string | null = existing?.id ?? null;

  if (existing) {
    const { error } = await supabase.from("calls").update(callFields).eq("id", existing.id);
    if (error) return json({ error: `call update: ${error.message}` }, 500);
  } else {
    const { data: inserted, error } = await supabase
      .from("calls")
      .insert({ external_call_id: body.external_call_id, ...callFields })
      .select("id")
      .single();
    if (error) return json({ error: `call insert: ${error.message}` }, 500);
    callId = inserted?.id ?? null;
  }

  if (!callId) return json({ error: "no call id" }, 500);

  // Store the transcript we already captured from the Realtime API. Diarized by
  // role (AI vs Caller); mapped into the same {speaker,start,end,text} shape the
  // rest of the pipeline uses so CallIntelligence renders it unchanged.
  if (body.transcript_text || (body.segments?.length ?? 0) > 0) {
    const segments = (body.segments || []).map((s) => ({
      speaker: s.speaker === "assistant" ? "AI" : "Caller",
      text: s.text,
      start: null,
      end: null,
    }));
    const wordCount = (body.transcript_text || "").split(/\s+/).filter(Boolean).length;
    const { error } = await supabase.from("call_transcripts").upsert(
      {
        call_id: callId,
        provider: "azure_openai_realtime",
        language_code: null,
        full_text: body.transcript_text || segments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
        segments,
        word_count: wordCount,
      },
      { onConflict: "call_id" },
    );
    if (error) console.error("transcript upsert:", error.message);
  }

  // If a recording exists, run the full transcribe→analyse→embed worker so the
  // bilingual summary/intent/sentiment appear just like a Mediateka call.
  if (body.recording_url) {
    fetch(`${supabaseUrl}/functions/v1/process-call-recording`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ call_id: callId }),
    }).catch((e) => console.error("processor nudge:", e?.message || e));
  }

  return json({ ok: true, call_id: callId, linked: !!(studentId || leadId) });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
