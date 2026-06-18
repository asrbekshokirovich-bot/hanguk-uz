// embed-content — Phase 2 hybrid-retrieval worker.
// ----------------------------------------------------------------------------
// Drains one `content_embed` job: fetches the source row (a message, a document
// extraction, or a call analysis + transcript), chunks it, embeds each chunk
// with gemini-embedding-001 (1536-dim, L2-normalised), and replaces the rows in
// `content_embeddings` for that (source_type, source_id).
//
// Invoked by dispatch-comm-jobs with { ref_table, ref_id }. Internal-only
// (service-role bearer). Mirrors the job lifecycle of process-document.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embedContent001 } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_TYPE = "content_embed";
const EMBED_DIM = 1536;
const MAX_CHUNKS = 20; // cap cost/latency on pathologically long sources

type Prepared = {
  source_type: "message" | "document" | "call";
  source_id: string;
  student_id: string | null;
  lead_id: string | null;
  channel: string | null;
  language: string | null;
  metadata: Record<string, unknown> | null;
  chunks: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "").trim() !== serviceKey) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  if (!Deno.env.get("GEMINI_API_KEY")) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  let refTable: string | null = null;
  let refId: string | null = null;
  let force = false;
  try {
    const b = await req.json();
    refTable = b.ref_table ?? null;
    refId = b.ref_id ?? null;
    force = !!b.force;
  } catch (_e) { /* */ }
  if (!refTable || !refId) return json({ error: "Missing ref_table / ref_id" }, 400);

  // Idempotent job row (so manual invokes + the queue share one record).
  await supabase.from("comm_processing_jobs").upsert(
    { job_type: JOB_TYPE, ref_table: refTable, ref_id: refId, status: "pending" },
    { onConflict: "job_type,ref_table,ref_id", ignoreDuplicates: true },
  );
  const { data: jobRow } = await supabase.from("comm_processing_jobs")
    .select("id, status, attempts, max_attempts")
    .eq("job_type", JOB_TYPE).eq("ref_table", refTable).eq("ref_id", refId).maybeSingle();
  if (jobRow && jobRow.status === "done" && !force) return json({ ok: true, skipped: "already_done" });
  if (jobRow) {
    await supabase.from("comm_processing_jobs")
      .update({ status: "processing", attempts: (jobRow.attempts ?? 0) + 1, locked_at: new Date().toISOString() })
      .eq("id", jobRow.id);
  }

  try {
    const prep = await prepare(supabase, refTable, refId);
    if (!prep || !prep.chunks.length) {
      // Nothing to embed (deleted row / empty content) — clear any stale rows, done.
      if (prep) {
        await supabase.from("content_embeddings")
          .delete().eq("source_type", prep.source_type).eq("source_id", prep.source_id);
      }
      if (jobRow) await supabase.from("comm_processing_jobs").update({ status: "done", last_error: null }).eq("id", jobRow.id);
      return json({ ok: true, ref_table: refTable, ref_id: refId, embedded: 0, note: "no content" });
    }

    const rows: any[] = [];
    for (let i = 0; i < prep.chunks.length && i < MAX_CHUNKS; i++) {
      try {
        const embedding = await embedContent001(prep.chunks[i], "RETRIEVAL_DOCUMENT", EMBED_DIM);
        rows.push({
          source_type: prep.source_type,
          source_id: prep.source_id,
          student_id: prep.student_id,
          lead_id: prep.lead_id,
          channel: prep.channel,
          language: prep.language,
          chunk_index: i,
          content: prep.chunks[i],
          embedding,
          model: "gemini-embedding-001",
          metadata: prep.metadata,
        });
      } catch (e) {
        console.error("embed chunk failed:", e instanceof Error ? e.message : e);
      }
    }
    if (!rows.length) throw new Error("all chunk embeddings failed");

    // Replace prior embeddings for this entity, then insert the fresh set.
    await supabase.from("content_embeddings")
      .delete().eq("source_type", prep.source_type).eq("source_id", prep.source_id);
    const { error: insErr } = await supabase.from("content_embeddings").insert(rows);
    if (insErr) throw new Error(`insert embeddings failed: ${insErr.message}`);

    if (jobRow) await supabase.from("comm_processing_jobs").update({ status: "done", last_error: null }).eq("id", jobRow.id);
    return json({ ok: true, ref_table: refTable, ref_id: refId, embedded: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`embed-content failed for ${refTable}/${refId}:`, message);
    if (jobRow) {
      const exhausted = (jobRow.attempts ?? 0) + 1 >= (jobRow.max_attempts ?? 3);
      await supabase.from("comm_processing_jobs")
        .update({ status: exhausted ? "error" : "pending", last_error: message }).eq("id", jobRow.id);
    }
    return json({ ok: false, ref_table: refTable, ref_id: refId, error: message }, 500);
  }
});

/** Fetch + shape the source row into embeddable chunks keyed by stable entity id. */
async function prepare(supabase: any, refTable: string, refId: string): Promise<Prepared | null> {
  if (refTable === "messages") {
    const { data } = await supabase.from("messages")
      .select("id, content, student_id, source, metadata, created_at").eq("id", refId).maybeSingle();
    if (!data) return null;
    const leadId = (data.metadata && (data.metadata.lead_id as string)) || null;
    return {
      source_type: "message", source_id: data.id, student_id: data.student_id ?? null,
      lead_id: leadId, channel: data.source ?? null, language: null,
      metadata: { created_at: data.created_at, direction: data.metadata?.direction ?? null },
      chunks: chunkText(String(data.content ?? ""), 1200),
    };
  }

  if (refTable === "document_extractions") {
    const { data } = await supabase.from("document_extractions")
      .select("id, document_id, student_id, doc_type, full_text, language, created_at").eq("id", refId).maybeSingle();
    if (!data) return null;
    const header = data.doc_type ? `${data.doc_type}\n` : "";
    return {
      source_type: "document", source_id: data.document_id, student_id: data.student_id ?? null,
      lead_id: null, channel: "document", language: data.language ?? null,
      metadata: { created_at: data.created_at, doc_type: data.doc_type ?? null },
      chunks: chunkText(header + String(data.full_text ?? ""), 1200),
    };
  }

  if (refTable === "call_analyses") {
    const { data } = await supabase.from("call_analyses")
      .select("id, call_id, student_id, lead_id, summary_uz, summary_en, created_at").eq("id", refId).maybeSingle();
    if (!data) return null;
    const { data: tr } = await supabase.from("call_transcripts")
      .select("full_text, language_code").eq("call_id", data.call_id).maybeSingle();
    const summary = [data.summary_uz, data.summary_en].filter(Boolean).join("\n");
    const chunks = chunkText(String(tr?.full_text ?? ""), 1200);
    if (summary) chunks.unshift(summary); // lead with the summary chunk
    return {
      source_type: "call", source_id: data.call_id, student_id: data.student_id ?? null,
      lead_id: data.lead_id ?? null, channel: "phone", language: tr?.language_code ?? null,
      metadata: { created_at: data.created_at },
      chunks: chunks.filter((c) => c && c.trim().length),
    };
  }

  return null; // unknown ref_table
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
  return chunks.filter(Boolean);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
