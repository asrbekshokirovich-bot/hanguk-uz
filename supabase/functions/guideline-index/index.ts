// deno-lint-ignore-file no-explicit-any no-import-prefix
// guideline-index — turns the guideline PDFs in Storage into searchable,
// page-numbered text for Hanguk AI (plan §5.2).
//
// Called by pg_cron every minute, 3 calls at once ({"slot": 0..2}, guideline-index-10min), with the project
// secret key in `apikey`, or by staff with the service-role key. Each run takes
// ONE document from ai_guideline_index_next() — current season first. PDF
// parsing is CPU-heavy: on 2026-11-02 the third PDF of one run hit the edge
// CPU limit ("CPU Time exceeded", 546), so a run never takes a second one.
//   download (guideline-blobs) → text per page (unpdf + CMaps) → chunks
//   → gemini-embedding-001 @1024 (batch) → embedding_chunks, guideline_index_state
//
// A PDF with no extractable text (a scan) is marked no_text and left for the
// OCR decision (plan D6). A failure is retried up to three times.
//
// Embeddings are optional (2026-11-02): when Gemini refuses (quota 429) or has
// no key, the page text is still saved without a vector, so the keyword half
// of guideline_text_search (PGroonga, Korean terms from Claude) finds it. Such
// a document is "done" with chunk_meta.embedded = false. Every run then
// embeds up to BACKFILL such chunks while Gemini answers, so the vectors catch
// up once the quota is back. Anthropic has no embedding model of its own.
//
// {"mode":"claude"} (cron guideline-claude-3min): Claude reads the PDFs pdf.js
// could not — scans, CPU-heavy files, files over 40 MB — see claude.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as unpdf from "npm:unpdf@0.12.1";
import { chunkPages } from "./chunk.ts";
import { fitBudget, VOYAGE_MODEL, voyageBatchChars, voyageEmbed, voyageKey } from "../_shared/voyage.ts";
import { extractPages } from "./pdf.ts";
import {
  claudeTranscribe, FILES_OVER, PAGES_PER_CALL, parseProgress, parseTranscript, uploadToFiles,
} from "./claude.ts";
import { serviceKey } from "../_shared/keys.ts";
import { isServiceRequest } from "../_shared/caller.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = serviceKey();
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
// Voyage when its key is set (2026-11-03), otherwise Gemini; EMBED_ON = some provider.
const VOYAGE_KEY = voyageKey();
const EMBED_MODEL = VOYAGE_KEY ? VOYAGE_MODEL : "gemini-embedding-001";
const EMBED_ON = !!(VOYAGE_KEY || GEMINI_KEY);
// Chunks embedded per run: Voyage takes 128 texts per call and has no 429 trouble.
const BACKFILL = 100;
// Voyage without a payment method: one small request per run (VOYAGE_BATCH_CHARS).
const VOYAGE_CHARS = voyageBatchChars();
const DIMS = 1024;
const MAX_BYTES = 40e6;
const SLOTS = 3;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OCR_MODEL = Deno.env.get("GUIDELINE_OCR_MODEL") || "claude-sonnet-5-5";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Server callers only: an sb_secret_ key (or, during the transition, the
 *  legacy service_role key) on `apikey` or `Authorization: Bearer`. */
function authorized(req: Request): boolean {
  return isServiceRequest(req);
}

function l2(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n ? v.map((x) => x / n) : v;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (VOYAGE_KEY) return (await voyageEmbed(texts, "document", VOYAGE_KEY)).map(l2);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const part = texts.slice(i, i + 100);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: part.map((t) => ({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: t.slice(0, 8000) }] },
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: DIMS,
          })),
        }),
      },
    );
    if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    for (const e of j.embeddings ?? []) out.push(l2(e.values));
  }
  if (out.length !== texts.length) throw new Error(`embed returned ${out.length}/${texts.length}`);
  return out;
}

async function indexOne(db: any, doc: any): Promise<Record<string, unknown>> {
  const prev = await db.from("guideline_index_state").select("attempts").eq("guideline_document_id", doc.id).maybeSingle();
  const attempts = (prev.data?.attempts ?? 0) + 1;
  const save = (row: Record<string, unknown>) =>
    db.from("guideline_index_state").upsert({
      guideline_document_id: doc.id, file_hash: doc.file_hash, attempts, indexed_at: new Date().toISOString(), ...row,
    });

  // Marked first: if the isolate dies on a huge PDF, the attempt still counts
  // and the document leaves the queue after three tries.
  await save({ status: "failed", error: "started; the run ended before it finished" });

  try {
    const { data: blob, error } = await db.storage.from("guideline-blobs").download(doc.storage_path);
    if (error || !blob) throw new Error(`download: ${error?.message ?? "empty"}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      await save({ status: "skipped", error: `larger than ${MAX_BYTES / 1e6} MB`, pages: 0, chunks: 0, chars: 0 });
      return { id: doc.id, status: "skipped" };
    }
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      await save({ status: "skipped", error: "not a PDF file", pages: 0, chunks: 0, chars: 0 });
      return { id: doc.id, status: "skipped" };
    }

    const pages = await extractPages(unpdf as any, bytes);
    const chars = pages.reduce((s, p) => s + (p?.trim().length ?? 0), 0);
    const chunks = chunkPages(pages);
    if (!chunks.length || chars < 300) {
      await save({ status: "no_text", pages: pages.length, chunks: 0, chars, error: null });
      return { id: doc.id, status: "no_text", pages: pages.length };
    }

    let vectors: number[][] | null = null;
    let embedError: string | null = EMBED_ON ? null : "no embedding key (VOYAGE_API_KEY / GEMINI_API_KEY)";
    // Voyage free tier: a big PDF would only spend the request limit on a 429;
    // its chunks are saved without vectors and the backfill embeds them.
    const tooBig = VOYAGE_KEY && fitBudget(chunks.map((c) => c.text), VOYAGE_CHARS) < chunks.length;
    if (tooBig) embedError = "vectors later by the backfill (Voyage without a payment method)";
    if (EMBED_ON && !tooBig) {
      try {
        vectors = await embedBatch(chunks.map((c) => c.text));
      } catch (e) {
        embedError = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      }
    }
    await db.from("embedding_chunks").delete().eq("guideline_document_id", doc.id);
    for (let i = 0; i < chunks.length; i += 200) {
      const rows = chunks.slice(i, i + 200).map((c, k) => ({
        guideline_document_id: doc.id,
        institution_id: doc.institution_id,
        chunk_text_ko: c.text,
        embedding: vectors ? JSON.stringify(vectors[i + k]) : null,
        page: c.page,
        chunk_index: c.index,
        chunk_meta: {
          page: c.page, academic_year: doc.academic_year, semester: doc.semester,
          embedded: !!vectors, model: vectors ? EMBED_MODEL : null, dims: vectors ? DIMS : null,
        },
      }));
      const { error: insErr } = await db.from("embedding_chunks").insert(rows);
      if (insErr) throw new Error(`insert: ${insErr.message}`);
    }
    const note = embedError ? `text only, no embedding: ${embedError}` : null;
    await save({ status: "done", pages: pages.length, chunks: chunks.length, chars, error: note });
    return { id: doc.id, status: "done", pages: pages.length, chunks: chunks.length, embedded: !!vectors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await save({ status: "failed", error: msg.slice(0, 500) });
    return { id: doc.id, status: "failed", error: msg.slice(0, 200) };
  }
}

/** Adds vectors to chunks saved without one (Gemini quota was out then), and with
 * Voyage on, replaces the Gemini ones. */
async function backfillEmbeddings(db: any): Promise<{ embedded: number; error: string | null }> {
  const { data: rows, error } = await db
    .from("embedding_chunks")
    .select("id, guideline_document_id, institution_id, chunk_text_ko, page, chunk_index, chunk_meta")
    // With Voyage, Gemini vectors are re-embedded too: one vector space per column.
    .or(VOYAGE_KEY ? `embedding.is.null,chunk_meta->>model.neq.${VOYAGE_MODEL}` : "embedding.is.null")
    .not("guideline_document_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(BACKFILL);
  if (error) return { embedded: 0, error: `select: ${error.message}` };
  if (!rows?.length) return { embedded: 0, error: null };
  if (VOYAGE_KEY) rows.splice(fitBudget(rows.map((r: any) => r.chunk_text_ko), VOYAGE_CHARS));

  let vectors: number[][];
  try {
    vectors = await embedBatch(rows.map((r: any) => r.chunk_text_ko));
  } catch (e) {
    return { embedded: 0, error: (e instanceof Error ? e.message : String(e)).slice(0, 120) };
  }
  const { error: upErr } = await db.from("embedding_chunks").upsert(
    rows.map((r: any, i: number) => ({
      ...r,
      embedding: JSON.stringify(vectors[i]),
      chunk_meta: { ...(r.chunk_meta ?? {}), embedded: true, model: EMBED_MODEL, dims: DIMS },
    })),
    { onConflict: "id" },
  );
  if (upErr) return { embedded: 0, error: `update: ${upErr.message}` };
  return { embedded: rows.length, error: null };
}

/** One Claude call: the next PAGES_PER_CALL pages of one PDF pdf.js could not read. */
async function claudeRead(db: any, slot: number): Promise<Record<string, unknown>> {
  if (!ANTHROPIC_KEY) return { status: "skipped", error: "ANTHROPIC_API_KEY is not configured" };
  const { data: next, error } = await db.rpc("ai_guideline_claude_next", { p_limit: slot + 1 });
  if (error) return { status: "failed", error: error.message };
  const doc = next?.[slot];
  if (!doc) return { status: "nothing to do" };

  const prog = parseProgress(doc.error);
  const from = prog.done + 1;
  const to = prog.total ? Math.min(prog.total, from + PAGES_PER_CALL - 1) : from + PAGES_PER_CALL - 1;
  const setError = (text: string, extra: Record<string, unknown> = {}) =>
    db.from("guideline_index_state").update({ error: text, indexed_at: new Date().toISOString(), ...extra })
      .eq("guideline_document_id", doc.id);

  try {
    // ref: the signed URL, or the Files API id for a PDF over FILES_OVER.
    let ref = prog.file ?? prog.url;
    if (!ref) {
      const { data: signed, error: sErr } = await db.storage.from("guideline-blobs")
        .createSignedUrl(doc.storage_path, 7 * 24 * 3600);
      if (sErr || !signed?.signedUrl) throw new Error(`signed url: ${sErr?.message ?? "none"}`);
      ref = signed.signedUrl as string;
      const head = await fetch(ref, { method: "HEAD" });
      const size = Number(head.headers.get("content-length") ?? 0);
      if (size > FILES_OVER) {
        const name = String(doc.storage_path).split("/").pop() || "guideline.pdf";
        ref = await uploadToFiles(ref, name, ANTHROPIC_KEY);
      }
    }
    const { text, usage } = await claudeTranscribe(ref, from, to, ANTHROPIC_KEY, OCR_MODEL);
    const parsed = parseTranscript(text);
    const total = parsed.total ?? prog.total;
    if (!total) throw new Error("no TOTAL_PAGES in the transcript");
    const last = Math.min(to, total);

    // Page texts in order; chunkPages numbers pages from 1, so shift by from - 1.
    const texts: string[] = [];
    for (let p = from; p <= last; p++) texts.push(parsed.pages.get(p) ?? "");
    if (from === 1) await db.from("embedding_chunks").delete().eq("guideline_document_id", doc.id);
    const { data: maxRow } = await db.from("embedding_chunks").select("chunk_index")
      .eq("guideline_document_id", doc.id).order("chunk_index", { ascending: false }).limit(1).maybeSingle();
    const base = (maxRow?.chunk_index ?? -1) + 1;
    const chunks = chunkPages(texts).map((c) => ({ ...c, page: c.page + from - 1, index: c.index + base }));

    let vectors: number[][] | null = null;
    if (EMBED_ON && chunks.length && !(VOYAGE_KEY && fitBudget(chunks.map((c) => c.text), VOYAGE_CHARS) < chunks.length)) {
      try { vectors = await embedBatch(chunks.map((c) => c.text)); } catch { vectors = null; }
    }
    if (chunks.length) {
      const rows = chunks.map((c, k) => ({
        guideline_document_id: doc.id,
        institution_id: doc.institution_id,
        chunk_text_ko: c.text,
        embedding: vectors ? JSON.stringify(vectors[k]) : null,
        page: c.page,
        chunk_index: c.index,
        chunk_meta: {
          page: c.page, academic_year: doc.academic_year, semester: doc.semester, reader: "claude", ocr_model: OCR_MODEL,
          embedded: !!vectors, model: vectors ? EMBED_MODEL : null, dims: vectors ? DIMS : null,
        },
      }));
      const { error: insErr } = await db.from("embedding_chunks").insert(rows);
      if (insErr) throw new Error(`insert: ${insErr.message}`);
    }

    const chars = texts.reduce((n, t) => n + t.length, 0);
    if (last >= total) {
      const { count } = await db.from("embedding_chunks").select("id", { count: "exact", head: true })
        .eq("guideline_document_id", doc.id);
      await setError(`claude: done ${total}/${total}`, { status: "done", pages: total, chunks: count ?? null });
    } else {
      const keep = ref.startsWith("file_") ? `file=${ref}` : `url=${ref}`;
      await setError(`claude: ${last}/${total} ${keep}`, { pages: total });
    }
    return { id: doc.id, status: "ok", pages: `${from}-${last}/${total}`, chunks: chunks.length, chars, usage };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    const k = prog.failures + 1;
    await setError(`claude failed (${k}): ${msg}${prog.done ? ` [${prog.done}/${prog.total ?? "?"}]` : ""}`);
    return { id: doc.id, status: "failed", error: msg };
  }
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  // Cron runs SLOTS calls at once (2026-11-03, "tezlashtir"): call k takes the
  // k-th document of the queue, so parallel calls never read the same PDF.
  const slot = Math.max(0, Math.min(SLOTS - 1, Math.floor(Number(body?.slot) || 0)));
  if (body?.mode === "claude") {
    const t0 = Date.now();
    const r = await claudeRead(db, slot);
    console.log(`[guideline-index] claude ${r.status} ${r.pages ?? ""} ${r.error ?? ""} in ${Date.now() - t0} ms`);
    return json(r);
  }
  const started = Date.now();
  const results: Record<string, unknown>[] = [];

  const { data: next, error } = await db.rpc("ai_guideline_index_next", { p_limit: slot + 1 });
  if (error) return json({ error: error.message }, 500);
  const doc = next?.[slot];
  if (doc) results.push(await indexOne(db, doc));

  // Only slot 0 backfills, and not when this run's own document just met the quota.
  const quotaHit = results.some((r) => r.status === "done" && r.embedded === false);
  const backfill = EMBED_ON && !quotaHit && slot === 0
    ? await backfillEmbeddings(db)
    : { embedded: 0, error: null };

  console.log(
    `[guideline-index] ${results.map((r) => `${r.status}`).join(",") || "nothing to do"}; ` +
      `backfill ${backfill.embedded}${backfill.error ? ` (${backfill.error})` : ""} in ${Date.now() - started} ms`,
  );
  return json({ processed: results.length, results, backfill });
});
