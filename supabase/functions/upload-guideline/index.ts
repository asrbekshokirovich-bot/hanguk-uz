// upload-guideline — the ingestion front door for staff-uploaded PDFs.
//
// Supports two flows:
//   1. DIRECT (legacy): send `file_base64` in the body — works for small files
//      but hits Supabase compute/body limits for anything over ~4 MB.
//   2. SIGNED URL (recommended): two-step flow that avoids sending the file
//      through the edge function at all:
//        a. POST { mode: "create_upload_url", institution_id, filename }
//           → returns { upload_url, upload_token, storage_path }
//        b. Client PUTs the raw file bytes to `upload_url` (with the token).
//        c. POST { mode: "register", institution_id, storage_path, filename }
//           → validates the blob, inserts the guideline_documents row.
//
// Auth: caller must be signed-in staff (owner / admin / document_handler /
// university_staff). verify_jwt=false in config; the role check is enforced here.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "guideline-blobs";
const STAFF_ROLES = ["owner", "admin", "document_handler", "university_staff"];
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const PDF_HEADER_SCAN_BYTES = 1024;

function findPdfHeader(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length, PDF_HEADER_SCAN_BYTES) - PDF_HEADER.length;
  for (let i = 0; i <= limit; i++) {
    let hit = true;
    for (let j = 0; j < PDF_HEADER.length; j++) {
      if (bytes[i + j] !== PDF_HEADER[j]) { hit = false; break; }
    }
    if (hit) return i;
  }
  return -1;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeName(name: string): string {
  return (name || "guideline.pdf").replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
}

async function authenticateStaff(req: Request, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader) return { error: json({ error: "Unauthorized" }, 401) };
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return { error: json({ error: "Unauthorized" }, 401) };

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: any) => STAFF_ROLES.includes(r.role))) {
    return { error: json({ error: "Forbidden — staff only" }, 403) };
  }
  return { user, admin };
}

async function insertGuidelineDoc(
  admin: any,
  institutionId: string,
  storagePath: string,
  hash: string,
  sizeBytes: number,
  filename: string,
) {
  const nowIso = new Date().toISOString();
  const { data: doc, error: insErr } = await admin
    .from("guideline_documents")
    .upsert({
      institution_id: institutionId,
      source_url_ko: `manual-upload:${filename}`,
      storage_path: storagePath,
      file_hash_sha256: hash,
      file_size_bytes: sizeBytes,
      mime_type: "application/pdf",
      parse_status: "pending",
      fetched_at: nowIso,
      last_checked_at: nowIso,
    }, { onConflict: "file_hash_sha256" })
    .select("id, institution_id, parse_status")
    .single();
  return { doc, insErr };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const mode = body.mode as string | undefined;

  // ── Mode: create_upload_url ──────────────────────────────────────────
  // Returns a signed upload URL so the client can PUT the file directly
  // to Storage without going through this function's memory.
  if (mode === "create_upload_url") {
    if (!body.institution_id) return json({ error: "Missing institution_id" }, 400);

    const auth = await authenticateStaff(req, supabaseUrl, anonKey, serviceKey);
    if (auth.error) return auth.error;
    const admin = auth.admin!;

    const { data: inst } = await admin.from("institutions").select("id").eq("id", body.institution_id).maybeSingle();
    if (!inst) return json({ error: "Unknown institution_id" }, 404);

    const filename = safeName(body.filename ?? "guideline.pdf");
    const storagePath = `manual/${body.institution_id}/${Date.now()}_${filename}`;

    const { data: signedData, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signErr || !signedData) {
      return json({ error: `Failed to create upload URL: ${signErr?.message ?? "unknown"}` }, 500);
    }

    return json({
      upload_url: signedData.signedUrl,
      upload_token: signedData.token,
      storage_path: storagePath,
      filename,
    });
  }

  // ── Mode: register ───────────────────────────────────────────────────
  // The file is already in Storage (via signed URL upload). Download it
  // with service role, validate, hash, and insert the DB row.
  if (mode === "register") {
    if (!body.institution_id || !body.storage_path) {
      return json({ error: "Missing institution_id or storage_path" }, 400);
    }

    const auth = await authenticateStaff(req, supabaseUrl, anonKey, serviceKey);
    if (auth.error) return auth.error;
    const admin = auth.admin!;

    const { data: inst } = await admin.from("institutions").select("id").eq("id", body.institution_id).maybeSingle();
    if (!inst) return json({ error: "Unknown institution_id" }, 404);

    // Download the blob to validate and hash it.
    const { data: blob, error: dlErr } = await admin.storage
      .from(BUCKET)
      .download(body.storage_path);

    if (dlErr || !blob) {
      return json({ error: `File not found in storage: ${dlErr?.message ?? "unknown"}` }, 400);
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength === 0) return json({ error: "Empty file" }, 400);
    if (bytes.byteLength > MAX_BYTES) {
      await admin.storage.from(BUCKET).remove([body.storage_path]);
      return json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, 400);
    }
    if (findPdfHeader(bytes) < 0) {
      await admin.storage.from(BUCKET).remove([body.storage_path]);
      return json({ error: "Not a PDF (no %PDF- marker in the first 1 KiB)" }, 400);
    }

    const hash = await sha256Hex(bytes);
    const filename = safeName(body.filename ?? "guideline.pdf");

    const { doc, insErr } = await insertGuidelineDoc(
      admin, body.institution_id, body.storage_path, hash, bytes.byteLength, filename,
    );

    if (insErr) {
      await admin.storage.from(BUCKET).remove([body.storage_path]);
      return json({ error: `DB insert failed: ${insErr.message}` }, 500);
    }

    return json({
      ok: true,
      guideline_document_id: doc.id,
      institution_id: doc.institution_id,
      parse_status: doc.parse_status,
      storage_path: body.storage_path,
      note: "Queued for extraction (parse_status=pending).",
    });
  }

  // ── Legacy mode: file_base64 ─────────────────────────────────────────
  if (!body.institution_id || !body.file_base64) {
    return json({ error: "Missing institution_id or file_base64" }, 400);
  }

  const auth = await authenticateStaff(req, supabaseUrl, anonKey, serviceKey);
  if (auth.error) return auth.error;
  const admin = auth.admin!;

  let bytes: Uint8Array;
  try { bytes = base64ToBytes(body.file_base64); } catch { return json({ error: "Invalid base64" }, 400); }
  if (bytes.byteLength === 0) return json({ error: "Empty file" }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, 400);
  if (findPdfHeader(bytes) < 0) {
    return json({ error: "Not a PDF (no %PDF- marker in the first 1 KiB)" }, 400);
  }

  const { data: inst } = await admin.from("institutions").select("id").eq("id", body.institution_id).maybeSingle();
  if (!inst) return json({ error: "Unknown institution_id" }, 404);

  const hash = await sha256Hex(bytes);
  const filename = safeName(body.filename ?? "guideline.pdf");
  const storagePath = `manual/${body.institution_id}/${Date.now()}_${filename}`;

  const up = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) return json({ error: `Storage upload failed: ${up.error.message}` }, 500);

  const { doc, insErr } = await insertGuidelineDoc(
    admin, body.institution_id, storagePath, hash, bytes.byteLength, filename,
  );

  if (insErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return json({ error: `DB insert failed: ${insErr.message}` }, 500);
  }

  return json({
    ok: true,
    guideline_document_id: doc.id,
    institution_id: doc.institution_id,
    parse_status: doc.parse_status,
    storage_path: storagePath,
    note: "Queued for extraction (parse_status=pending).",
  });
});
