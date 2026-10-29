// deno-lint-ignore-file no-explicit-any no-import-prefix
// guideline-index — turns the guideline PDFs in Storage into searchable,
// page-numbered text for Hanguk AI (plan §5.2).
//
// Called by pg_cron every 10 minutes (guideline-index-10min) with the project
// secret key in `apikey`, or by staff with the service-role key. Each run takes
// the next documents from ai_guideline_index_next() — current season first —
// until ~100 s have passed:
//   download (guideline-blobs) → text per page (unpdf + CMaps) → chunks
//   → gemini-embedding-001 @1024 (batch) → embedding_chunks, guideline_index_state
//
// A PDF with no extractable text (a scan) is marked no_text and left for the
// OCR decision (plan D6). A failure is retried up to three times.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as unpdf from "npm:unpdf@0.12.1";
import { chunkPages } from "./chunk.ts";
import { extractPages } from "./pdf.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const BUDGET_MS = 100_000;
const DIMS = 1024;
const MAX_BYTES = 40e6;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    return Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer !== "" && bearer === SERVICE_KEY;
}

function l2(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n ? v.map((x) => x / n) : v;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
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

    const vectors = await embedBatch(chunks.map((c) => c.text));
    await db.from("embedding_chunks").delete().eq("guideline_document_id", doc.id);
    for (let i = 0; i < chunks.length; i += 200) {
      const rows = chunks.slice(i, i + 200).map((c, k) => ({
        guideline_document_id: doc.id,
        institution_id: doc.institution_id,
        chunk_text_ko: c.text,
        embedding: JSON.stringify(vectors[i + k]),
        page: c.page,
        chunk_index: c.index,
        chunk_meta: { page: c.page, academic_year: doc.academic_year, semester: doc.semester, model: "gemini-embedding-001", dims: DIMS },
      }));
      const { error: insErr } = await db.from("embedding_chunks").insert(rows);
      if (insErr) throw new Error(`insert: ${insErr.message}`);
    }
    await save({ status: "done", pages: pages.length, chunks: chunks.length, chars, error: null });
    return { id: doc.id, status: "done", pages: pages.length, chunks: chunks.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await save({ status: "failed", error: msg.slice(0, 500) });
    return { id: doc.id, status: "failed", error: msg.slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const started = Date.now();
  const results: Record<string, unknown>[] = [];

  while (Date.now() - started < BUDGET_MS && results.length < 10) {
    const { data: next, error } = await db.rpc("ai_guideline_index_next", { p_limit: 1 });
    if (error) return json({ error: error.message, results }, 500);
    const doc = next?.[0];
    if (!doc) break;
    results.push(await indexOne(db, doc));
  }

  console.log(`[guideline-index] ${results.map((r) => `${r.status}`).join(",") || "nothing to do"} in ${Date.now() - started} ms`);
  return json({ processed: results.length, results });
});
