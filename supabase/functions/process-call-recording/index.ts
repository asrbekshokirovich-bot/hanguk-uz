// process-call-recording
// ----------------------------------------------------------------------------
// The Uzbek-first call-intelligence worker. Given a call id it:
//   1. fetches the recording bytes (server-side, with the Mediateka key)
//   2. transcribes with ElevenLabs Scribe (diarized, Uzbek) — Gemini fallback
//   3. stores the transcript (call_transcripts)
//   4. analyses it with Gemini → bilingual summary, intent, sentiment,
//      action items, promises, entities, risk flags (call_analyses)
//   5. embeds the transcript into communication_embeddings for RAG
//   6. updates the comm_processing_jobs bookkeeping
//
// Internal-only: callers must present the service-role key as a Bearer token.
// Invoked by voip-webhook (live) and dispatch-comm-jobs (queue drain / retries).
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchRecording, bytesToBase64 } from "../_shared/recording.ts";
import { transcribeWithScribe, type TranscriptionResult } from "../_shared/scribe.ts";
import { embedText, generateJSON, transcribeAudioWithGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const JOB_TYPE = "call_transcribe_analyze";

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary_uz: { type: "string", description: "2-4 sentence summary in Uzbek" },
    summary_en: { type: "string", description: "2-4 sentence summary in English" },
    intent: { type: "string", description: "Primary reason for the call" },
    sentiment: {
      type: "string",
      enum: ["positive", "neutral", "negative", "frustrated", "confused"],
    },
    topics: { type: "array", items: { type: "string" } },
    action_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          owner: { type: "string", description: "staff | student | unknown" },
          due: { type: "string" },
        },
        required: ["text"],
      },
    },
    promises: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, by: { type: "string" } },
        required: ["text"],
      },
    },
    entities: {
      type: "object",
      properties: {
        documents: { type: "array", items: { type: "string" } },
        payments: { type: "array", items: { type: "string" } },
        universities: { type: "array", items: { type: "string" } },
        dates: { type: "array", items: { type: "string" } },
        people: { type: "array", items: { type: "string" } },
      },
    },
    follow_up_needed: { type: "boolean" },
    follow_up_reason: { type: "string" },
    risk_flags: { type: "array", items: { type: "string" } },
  },
  required: ["summary_uz", "summary_en", "intent", "sentiment", "follow_up_needed"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "").trim() !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  let callId: string | null = null;
  let force = false;
  try {
    const body = await req.json();
    callId = body.call_id ?? null;
    force = !!body.force;
  } catch (_e) { /* no body */ }

  if (!callId) {
    return new Response(JSON.stringify({ error: "Missing call_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Claim the job (create if the trigger somehow didn't) -----------------
  await supabase.from("comm_processing_jobs").upsert(
    { job_type: JOB_TYPE, ref_table: "calls", ref_id: callId, status: "pending" },
    { onConflict: "job_type,ref_table,ref_id", ignoreDuplicates: true },
  );

  const { data: job } = await supabase
    .from("comm_processing_jobs")
    .select("id, status, attempts, max_attempts")
    .eq("job_type", JOB_TYPE).eq("ref_table", "calls").eq("ref_id", callId)
    .maybeSingle();

  if (job && job.status === "done" && !force) {
    return json({ ok: true, skipped: "already_done", call_id: callId });
  }

  if (job) {
    await supabase.from("comm_processing_jobs")
      .update({ status: "processing", attempts: (job.attempts ?? 0) + 1, locked_at: new Date().toISOString() })
      .eq("id", job.id);
  }

  try {
    const result = await processCall(supabase, callId);
    if (job) {
      await supabase.from("comm_processing_jobs")
        .update({ status: "done", last_error: null }).eq("id", job.id);
    }
    return json({ ok: true, call_id: callId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`process-call-recording failed for ${callId}:`, message);
    if (job) {
      const exhausted = (job.attempts ?? 0) + 1 >= (job.max_attempts ?? 3);
      await supabase.from("comm_processing_jobs")
        .update({ status: exhausted ? "error" : "pending", last_error: message })
        .eq("id", job.id);
    }
    return json({ ok: false, call_id: callId, error: message }, 500);
  }
});

async function processCall(supabase: any, callId: string) {
  const { data: call, error } = await supabase
    .from("calls")
    .select("id, recording_url, voip_provider, phone_number, direction, duration, started_at, student_id, lead_id")
    .eq("id", callId)
    .maybeSingle();

  if (error || !call) throw new Error("Call not found");
  if (!call.recording_url) throw new Error("Call has no recording_url");

  // 1. Audio --------------------------------------------------------------
  const audio = await fetchRecording(call.recording_url, call.voip_provider);

  // 2. Transcribe (Scribe primary, Gemini fallback) -----------------------
  let transcription: TranscriptionResult;
  try {
    transcription = await transcribeWithScribe(audio.bytes, audio.mimeType, "uzb");
  } catch (scribeErr) {
    console.warn("Scribe failed, falling back to Gemini:", scribeErr instanceof Error ? scribeErr.message : scribeErr);
    const text = await transcribeAudioWithGemini(bytesToBase64(audio.bytes), audio.mimeType, "Uzbek");
    transcription = {
      provider: "gemini",
      text,
      languageCode: "uzb",
      segments: textToSegments(text),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  }

  if (!transcription.text?.trim()) throw new Error("Empty transcript");

  // 3. Store transcript ---------------------------------------------------
  await supabase.from("call_transcripts").upsert({
    call_id: callId,
    provider: transcription.provider,
    language_code: transcription.languageCode,
    full_text: transcription.text,
    segments: transcription.segments,
    word_count: transcription.wordCount,
  }, { onConflict: "call_id" });

  // 4. Analyse ------------------------------------------------------------
  const who = await describeParticipant(supabase, call);
  const analysis = await generateJSON<any>({
    systemInstruction:
      "You are Hanguk AI, analysing phone calls for a Korean-university study-abroad agency in Uzbekistan. " +
      "Calls are mostly in Uzbek (sometimes Russian or Korean). Understand the Uzbek accurately. " +
      "Extract what matters operationally: documents, payments, university/admission topics, visa, TOPIK/IELTS, deadlines, complaints. " +
      "summary_uz MUST be in Uzbek; summary_en MUST be in English.",
    prompt:
      `Call direction: ${call.direction}. Duration: ${call.duration ?? 0}s. ${who}\n\n` +
      `TRANSCRIPT:\n${transcription.text.slice(0, 16000)}`,
    schema: ANALYSIS_SCHEMA,
    temperature: 0.2,
  });

  if (analysis) {
    await supabase.from("call_analyses").upsert({
      call_id: callId,
      student_id: call.student_id,
      lead_id: call.lead_id,
      summary_uz: analysis.summary_uz ?? null,
      summary_en: analysis.summary_en ?? null,
      intent: analysis.intent ?? null,
      sentiment: analysis.sentiment ?? null,
      topics: analysis.topics ?? null,
      action_items: analysis.action_items ?? null,
      promises: analysis.promises ?? null,
      entities: analysis.entities ?? null,
      follow_up_needed: !!analysis.follow_up_needed,
      follow_up_reason: analysis.follow_up_reason ?? null,
      risk_flags: analysis.risk_flags ?? null,
      model: "gemini-2.5-flash",
    }, { onConflict: "call_id" });
  }

  // 5. Embed for RAG ------------------------------------------------------
  await embedCall(supabase, call, transcription.text, analysis);

  return {
    provider: transcription.provider,
    words: transcription.wordCount,
    analysed: !!analysis,
    follow_up_needed: !!analysis?.follow_up_needed,
  };
}

/** Build a short human descriptor of who the call is with, for the analysis prompt. */
async function describeParticipant(supabase: any, call: any): Promise<string> {
  if (call.student_id) {
    const { data } = await supabase.from("profiles").select("full_name").eq("user_id", call.student_id).maybeSingle();
    return `Counterparty: student ${data?.full_name ?? "(unknown name)"} (${call.phone_number}).`;
  }
  if (call.lead_id) {
    const { data } = await supabase.from("leads").select("full_name").eq("id", call.lead_id).maybeSingle();
    return `Counterparty: lead ${data?.full_name ?? "(unknown name)"} (${call.phone_number}).`;
  }
  return `Counterparty: unknown contact (${call.phone_number}).`;
}

/** Replace any prior embeddings for this call, then chunk + embed the transcript. */
async function embedCall(supabase: any, call: any, transcript: string, analysis: any) {
  await supabase.from("communication_embeddings")
    .delete().eq("source_type", "call").eq("source_id", call.id);

  const chunks = chunkText(transcript, 1200);
  if (analysis?.summary_en || analysis?.summary_uz) {
    chunks.unshift([analysis.summary_uz, analysis.summary_en].filter(Boolean).join("\n"));
  }

  const rows: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await embedText(chunks[i], "RETRIEVAL_DOCUMENT");
      rows.push({
        source_type: "call",
        source_id: call.id,
        student_id: call.student_id,
        lead_id: call.lead_id,
        channel: "phone",
        chunk_index: i,
        content: chunks[i],
        embedding,
        metadata: { started_at: call.started_at, direction: call.direction },
      });
    } catch (e) {
      console.error("embed chunk failed:", e instanceof Error ? e.message : e);
    }
  }
  if (rows.length) {
    const { error } = await supabase.from("communication_embeddings").insert(rows);
    if (error) console.error("insert embeddings failed:", error.message);
  }
}

/** Split text into ~maxLen chunks on paragraph/line boundaries. */
function chunkText(text: string, maxLen: number): string[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const line of lines) {
    if (buf && (buf.length + line.length + 1) > maxLen) {
      chunks.push(buf);
      buf = "";
    }
    buf = buf ? `${buf}\n${line}` : line;
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

/** Best-effort speaker segmentation when only flat text is available. */
function textToSegments(text: string) {
  return text.split(/\n+/).map((line) => {
    const m = line.match(/^\s*([A-Za-z][\w' ]{0,20}):\s*(.*)$/);
    return m
      ? { speaker: m[1].trim(), start: null, end: null, text: m[2].trim() }
      : { speaker: "unknown", start: null, end: null, text: line.trim() };
  }).filter((s) => s.text.length > 0);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
