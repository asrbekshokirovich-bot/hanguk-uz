// process-document — reads a student's file with Gemini multimodal (OCR +
// structured extraction) and stores the text + key fields. Internal-only
// (service-role bearer). Handles PDFs and image scans in UZ/RU/KO/EN.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { regionFromIssuingAuthority } from "../_shared/regions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_TYPE = "document_extract";
const BUCKET = "student-documents";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const SCHEMA = {
  type: "object",
  properties: {
    doc_type: { type: "string", description: "passport | id_card | diploma | transcript | certificate | bank_statement | photo | contract | other" },
    language: { type: "string" },
    full_text: { type: "string", description: "All readable text in the document" },
    fields: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] } },
    birth_date: { type: "string", description: "Holder's date of birth in strict ISO YYYY-MM-DD format if this is a passport/ID, else empty" },
    issuing_authority: { type: "string", description: "The 'given by' / issuing authority text on a passport/ID (e.g. 'Toshkent shahar IIB'), else empty" },
  },
  required: ["doc_type", "full_text"],
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "").trim() !== serviceKey) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  let documentId: string | null = null; let force = false;
  try { const b = await req.json(); documentId = b.document_id ?? null; force = !!b.force; } catch (_e) { /* */ }
  if (!documentId) return json({ error: "Missing document_id" }, 400);

  await supabase.from("comm_processing_jobs").upsert(
    { job_type: JOB_TYPE, ref_table: "documents", ref_id: documentId, status: "pending" },
    { onConflict: "job_type,ref_table,ref_id", ignoreDuplicates: true });
  const { data: job } = await supabase.from("comm_processing_jobs")
    .select("id, status, attempts, max_attempts").eq("job_type", JOB_TYPE).eq("ref_table", "documents").eq("ref_id", documentId).maybeSingle();
  if (job && job.status === "done" && !force) return json({ ok: true, skipped: "already_done" });
  if (job) await supabase.from("comm_processing_jobs").update({ status: "processing", attempts: (job.attempts ?? 0) + 1, locked_at: new Date().toISOString() }).eq("id", job.id);

  try {
    const { data: doc, error } = await supabase.from("documents").select("id, name, file_path, file_type, student_id").eq("id", documentId).maybeSingle();
    if (error || !doc) throw new Error("Document not found");
    if (!doc.file_path) throw new Error("Document has no file_path");

    const dl = await supabase.storage.from(BUCKET).download(doc.file_path);
    if (dl.error || !dl.data) throw new Error(`Download failed: ${dl.error?.message || "no data"}`);
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("Empty file");
    if (bytes.byteLength > 18 * 1024 * 1024) throw new Error("File too large for inline extraction");

    const mimeType = doc.file_type || "application/pdf";
    const prompt = "You are extracting data from a document for a Korean university admissions agency in Uzbekistan. The file may be a scan or photo, in Uzbek, Russian, Korean or English. Read ALL text carefully. Identify doc_type, the language, the full_text (everything readable), and fields (important values such as full name, passport/ID number, date of birth, issue/expiry dates, institution, degree, GPA, amounts). For passports/ID cards also return birth_date as a strict ISO date (YYYY-MM-DD) and issuing_authority (the 'given by' / 'berilgan' / 'выдан' authority that issued the document). If it is only a photo with no text, set full_text to a short description.";

    const res = await fetch(`${GEMINI_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: bytesToBase64(bytes) } }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
      }),
    });
    if (!res.ok) throw new Error(`Gemini failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const jr = await res.json();
    const text = jr?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } } }
    if (!parsed) throw new Error("Unparseable extraction");

    await supabase.from("document_extractions").upsert({
      document_id: doc.id, student_id: doc.student_id,
      doc_type: parsed.doc_type ?? null, full_text: parsed.full_text ?? "",
      key_fields: parsed.fields ?? null, language: parsed.language ?? null, model: "gemini-2.5-flash",
    }, { onConflict: "document_id" });

    // Auto-fill the student's profile from this document (birth date + region from
    // passports/ID cards; language track from a language certificate). Provenance
    // columns ensure a staff-set value (source='manual') is never overwritten.
    if (doc.student_id) {
      try {
        await autoFillProfile(supabase, doc, parsed);
      } catch (e) {
        console.error("autoFillProfile failed:", e instanceof Error ? e.message : String(e));
      }
    }

    if (job) await supabase.from("comm_processing_jobs").update({ status: "done", last_error: null }).eq("id", job.id);
    return json({ ok: true, document_id: documentId, doc_type: parsed.doc_type, chars: (parsed.full_text || "").length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`process-document failed for ${documentId}:`, message);
    if (job) {
      const exhausted = (job.attempts ?? 0) + 1 >= (job.max_attempts ?? 3);
      await supabase.from("comm_processing_jobs").update({ status: exhausted ? "error" : "pending", last_error: message }).eq("id", job.id);
    }
    return json({ ok: false, document_id: documentId, error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Detect which upload slot a document belongs to (slot id is encoded as "[slot]"
// in the name, or as a "slot-" prefix on the stored filename).
function detectSlot(name: string | null, filePath: string | null): string | null {
  const tag = (name || "").match(/\[([a-z0-9_]+)\]/i);
  if (tag) return tag[1].toLowerCase();
  const filename = (filePath || "").split("/").pop() || "";
  const prefix = filename.match(/^([a-z0-9_]+?)-/i);
  return prefix ? prefix[1].toLowerCase() : null;
}

function fieldsToText(fields: unknown): string {
  if (!Array.isArray(fields)) return "";
  return fields.map((f: any) => `${f?.label ?? ""}: ${f?.value ?? ""}`).join("\n");
}

function isoDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Populate profile fields from a freshly-extracted document.
 *  - foreign_passport / applicant_id_card -> birth_date + region (city)
 *  - language_certificate -> language_track (TOPIK -> korean, IELTS -> english)
 * Each field is only written when it is empty or was previously auto-filled
 * (its *_source column is not 'manual').
 */
// deno-lint-ignore no-explicit-any
async function autoFillProfile(supabase: any, doc: any, parsed: any): Promise<void> {
  const slot = detectSlot(doc.name, doc.file_path);
  const docType = String(parsed.doc_type ?? "").toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, birth_date, birth_date_source, city, region_source, language_track, language_track_source")
    .eq("user_id", doc.student_id)
    .maybeSingle();
  if (!profile) return;

  const update: Record<string, unknown> = {};

  const isPassport = slot === "foreign_passport" || slot === "applicant_id_card"
    || docType === "passport" || docType === "id_card";

  if (isPassport) {
    // Birth date — prefer the structured field, fall back to scanning the fields list.
    if (profile.birth_date_source !== "manual") {
      const dob = isoDate(parsed.birth_date);
      if (dob) {
        update.birth_date = dob;
        update.birth_date_source = "passport";
      }
    }
    // Region from the "given by" / issuing authority.
    if (profile.region_source !== "manual") {
      const authority = String(parsed.issuing_authority ?? "");
      const region = regionFromIssuingAuthority(authority)
        ?? regionFromIssuingAuthority(fieldsToText(parsed.fields))
        ?? regionFromIssuingAuthority(parsed.full_text);
      if (region) {
        update.city = region;
        update.region_source = "passport";
      }
    }
  }

  // Language certificate -> track. Certificates outrank conversation inference.
  if (slot === "language_certificate" || docType === "certificate") {
    if (profile.language_track_source !== "manual") {
      const text = `${parsed.full_text ?? ""}\n${fieldsToText(parsed.fields)}`.toLowerCase();
      const hasTopik = /\btopik\b|토픽|한국어능력/.test(text);
      const hasIelts = /\bielts\b/.test(text);
      let track: string | null = null;
      if (hasTopik && !hasIelts) track = "korean";
      else if (hasIelts && !hasTopik) track = "english";
      else if (hasTopik && hasIelts) track = "both";
      if (track) {
        update.language_track = track;
        update.language_track_source = "certificate";
      }
    }
  }

  if (Object.keys(update).length > 0) {
    await supabase.from("profiles").update(update).eq("id", profile.id);
  }
}
