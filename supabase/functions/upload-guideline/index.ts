// upload-guideline — the new ingestion front door.
//
// A staff member finds a university's current admission-guideline PDF (모집요강)
// and uploads it here. This function stores the PDF in the private
// `guideline-blobs` bucket and inserts a `guideline_documents` row with
// parse_status='pending', which the extraction pipeline picks up, analyzes
// (Claude), and publishes. This replaces the brittle crawl/fetch/resolver layer
// with a human-picked PDF — no scraping, no per-site selectors.
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
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  // Tolerate a `data:application/pdf;base64,...` prefix from the browser.
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
  return (name || "guideline.pdf").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1) Authenticate the caller and require a staff role.
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: any) => STAFF_ROLES.includes(r.role))) {
    return json({ error: "Forbidden — staff only" }, 403);
  }

  // 2) Parse + validate the upload.
  const body = await req.json().catch(() => null) as
    | { institution_id?: string; file_base64?: string; filename?: string }
    | null;
  if (!body?.institution_id || !body?.file_base64) {
    return json({ error: "Missing institution_id or file_base64" }, 400);
  }

  let bytes: Uint8Array;
  try { bytes = base64ToBytes(body.file_base64); } catch { return json({ error: "Invalid base64" }, 400); }
  if (bytes.byteLength === 0) return json({ error: "Empty file" }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, 400);
  // Magic bytes: a real PDF starts with "%PDF".
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return json({ error: "Not a PDF (expected a %PDF header)" }, 400);
  }

  // 3) Institution must exist.
  const { data: inst } = await admin.from("institutions").select("id").eq("id", body.institution_id).maybeSingle();
  if (!inst) return json({ error: "Unknown institution_id" }, 404);

  // 4) Hash for idempotency (guideline_documents has UNIQUE(file_hash_sha256)).
  const hash = await sha256Hex(bytes);
  const filename = safeName(body.filename ?? "guideline.pdf");
  const storagePath = `manual/${body.institution_id}/${Date.now()}_${filename}`;

  // 5) Upload to the private bucket (service role bypasses storage RLS).
  const up = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) return json({ error: `Storage upload failed: ${up.error.message}` }, 500);

  // 6) Upsert the guideline_documents row → pending for extraction. Re-uploading
  //    the same PDF (same hash) refreshes the row and re-queues it.
  const nowIso = new Date().toISOString();
  const { data: doc, error: insErr } = await admin
    .from("guideline_documents")
    .upsert({
      institution_id: body.institution_id,
      source_url_ko: `manual-upload:${filename}`,
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
    // Avoid orphan blobs if the DB write fails.
    await admin.storage.from(BUCKET).remove([storagePath]);
    return json({ error: `DB insert failed: ${insErr.message}` }, 500);
  }

  // Fire-and-forget: trigger process-guideline so the PDF is parsed automatically.
  try {
    admin.functions.invoke("process-guideline", { body: { document_id: doc.id } });
  } catch (_) { /* best-effort */ }

  return json({
    ok: true,
    guideline_document_id: doc.id,
    institution_id: doc.institution_id,
    parse_status: doc.parse_status,
    storage_path: storagePath,
    note: "Queued for extraction (parse_status=pending).",
  });
});
