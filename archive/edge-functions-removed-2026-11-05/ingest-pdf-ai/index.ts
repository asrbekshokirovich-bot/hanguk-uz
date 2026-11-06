// ingest-pdf-ai — internal-only ingestion endpoint, invoked server-side via pg_net
// from Postgres (not exposed to end users; verify_jwt=false, service-role-only flow).
// Accepts {institution_id, file_base64, filename, source_url, notes} and stores the
// PDF in the guideline-blobs bucket + upserts guideline_documents, exactly like the
// staff upload-guideline flow, but callable without a signed-in user JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "guideline-blobs";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeName(name: string): string {
  return (name || "guideline.pdf").replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => null) as
    | { institution_id?: string; file_base64?: string; filename?: string; source_url?: string; notes?: string }
    | null;
  if (!body?.institution_id || !body?.file_base64) {
    return json({ error: "Missing institution_id or file_base64" }, 400);
  }

  let bytes: Uint8Array;
  try { bytes = base64ToBytes(body.file_base64); } catch { return json({ error: "Invalid base64" }, 400); }
  if (bytes.byteLength === 0) return json({ error: "Empty file" }, 400);
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return json({ error: "Not a PDF (expected a %PDF header)" }, 400);
  }

  const { data: inst } = await admin.from("institutions").select("id").eq("id", body.institution_id).maybeSingle();
  if (!inst) return json({ error: "Unknown institution_id" }, 404);

  const hash = await sha256Hex(bytes);
  const filename = safeName(body.filename ?? "guideline.pdf");
  const storagePath = `ai-synth/${body.institution_id}/${Date.now()}_${filename}`;

  const up = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) return json({ error: `Storage upload failed: ${up.error.message}` }, 500);

  const nowIso = new Date().toISOString();
  const { data: doc, error: insErr } = await admin
    .from("guideline_documents")
    .upsert({
      institution_id: body.institution_id,
      source_url_ko: body.source_url ?? `ai-synth:${filename}`,
      storage_path: storagePath,
      file_hash_sha256: hash,
      file_size_bytes: bytes.byteLength,
      mime_type: "application/pdf",
      parse_status: "pending",
      fetched_at: nowIso,
      last_checked_at: nowIso,
    }, { onConflict: "file_hash_sha256" })
    .select("id, institution_id, parse_status")
    .single();

  if (insErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return json({ error: `DB insert failed: ${insErr.message}` }, 500);
  }

  return json({ ok: true, guideline_document_id: doc.id, storage_path: storagePath });
});
