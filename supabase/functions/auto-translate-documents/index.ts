// Translates a student's diploma / attestat and birth certificate as soon as
// they are uploaded, and files the result as the document's translation for an
// admin to approve.
//
//   documents insert ──trigger──> translation_jobs (auto_triggered, 'queued')
//   pg_cron, every minute while work is queued ──> this function
//     1. claim_auto_translation_job()            one job, row-locked
//     2. rules.planTranslation()                 identity documents present?
//          no  -> 'waiting_documents'            (re-queued by the trigger
//                                                 when the missing one arrives)
//     3. translateDocument()                     same core as the CRM page
//     4. DOCX -> student-documents as `[<slot>_translation]`, status
//        'uploaded', so it shows in Hujjatlar for approval
//     5. job 'completed'
//
// AUTH: verify_jwt is off at the gateway because the sb_secret_ key pg_cron
// sends is not a JWT (same as notify-student-stages). Checked in authorized().
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  blocksToPlainText,
  DOCX_MIME,
  renderDocx,
  translateDocument,
  uploadTranslationDocx,
} from "../_shared/certified-translation.ts";
import {
  AUTO_SOURCES,
  existingTranslationAction,
  newestFor,
  planTranslation,
  slotTag,
  type StudentDoc,
  waitingMessage,
} from "./rules.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

/** A failed translation is retried this many times in all before it is 'failed'. */
const MAX_ATTEMPTS = 3;
/** Stop claiming new jobs after this long, so a run ends well inside the wall-clock limit. */
const RUN_BUDGET_MS = 90_000;

interface Job {
  id: string;
  student_id: string;
  document_type_id: string;
  source_document_id: string | null;
  attempts: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Only pg_cron (an sb_secret_ key) or the service-role key itself. */
function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return !!bearer && bearer === SUPABASE_SERVICE_ROLE_KEY;
}

function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    return Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string");
  } catch (_e) {
    return [];
  }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function setJob(db: SupabaseClient, id: string, fields: Record<string, unknown>) {
  const { error } = await db.from("translation_jobs").update(fields).eq("id", id);
  if (error) console.error("translation_jobs update failed:", id, error.message);
}

async function processJob(db: SupabaseClient, job: Job): Promise<string> {
  const { data: docs, error: docsErr } = await db
    .from("documents")
    .select("id, name, file_path, created_at, status, intake_id")
    .eq("student_id", job.student_id);
  if (docsErr) throw new Error(`documents: ${docsErr.message}`);
  const studentDocs = (docs ?? []) as StudentDoc[];

  const source = studentDocs.find((d) => d.id === job.source_document_id);
  const sourceSlot = source ? slotTag(source) : null;
  if (!source || !sourceSlot || !AUTO_SOURCES[sourceSlot]) {
    // The upload was deleted or replaced; a replacement has its own job.
    await setJob(db, job.id, { status: "cancelled", error_message: "Asl hujjat o'chirilgan yoki almashtirilgan" });
    return "cancelled";
  }
  if (newestFor(studentDocs, sourceSlot)?.id !== source.id) {
    await setJob(db, job.id, { status: "cancelled", error_message: "Yangiroq hujjat yuklangan" });
    return "cancelled";
  }

  const plan = planTranslation(sourceSlot, studentDocs);
  if (!plan.ready) {
    await setJob(db, job.id, { status: "waiting_documents", error_message: waitingMessage(plan.missing) });
    return "waiting";
  }

  const { data: docType, error: typeErr } = await db
    .from("translation_document_types").select("id, code, name_uz, name_en")
    .eq("id", job.document_type_id).maybeSingle();
  if (typeErr || !docType) throw new Error("Hujjat turi topilmadi");

  const { data: profile } = await db
    .from("profiles").select("full_name").eq("user_id", job.student_id).maybeSingle();

  const structured = await translateDocument(db, GEMINI_API_KEY!, {
    docType,
    source: { path: source.file_path, bucket: "student-documents" },
    supporting: plan.supporting.map((s) => ({ path: s.path, bucket: s.bucket, role: s.role })),
    studentName: profile?.full_name ?? undefined,
    documentNote: AUTO_SOURCES[sourceSlot].documentNote,
  });
  const docxBytes = await renderDocx(structured);
  const outputPath = await uploadTranslationDocx(db, docxBytes, docType.code);

  // File it in the student's documents as the slot's translation.
  const translationSlot = `${sourceSlot}_translation`;
  const existing = studentDocs.find((d) => slotTag(d) === translationSlot);
  const action = existingTranslationAction(existing, source);
  let filedPath: string | null = null;

  if (action !== "keep") {
    filedPath = `${job.student_id}/${translationSlot}-${Date.now()}-auto.docx`;
    const { error: upErr } = await db.storage.from("student-documents")
      .upload(filedPath, docxBytes, { contentType: DOCX_MIME, upsert: false });
    if (upErr) throw new Error(`student-documents upload: ${upErr.message}`);

    if (existing) {
      // One row per (student, slot tag) — documents_student_doc_type_unique.
      const { error: delErr } = await db.from("documents").delete().eq("id", existing.id);
      if (delErr) {
        await db.storage.from("student-documents").remove([filedPath]);
        throw new Error(`eski tarjimani o'chirib bo'lmadi: ${delErr.message}`);
      }
      await db.storage.from("student-documents").remove([existing.file_path]);
    }

    const unclear = structured.unclearItems.length
      ? ` Aniq bo'lmagan joylar: ${structured.unclearItems.join("; ")}`
      : "";
    const { error: insErr } = await db.from("documents").insert({
      student_id: job.student_id,
      name: `[${translationSlot}] ${docType.name_en ?? docType.name_uz} translation (AI).docx`,
      file_path: filedPath,
      file_type: DOCX_MIME,
      file_size: docxBytes.byteLength,
      status: "uploaded",
      intake_id: source.intake_id,
      notes: `AI avtomatik tarjima — tekshirib tasdiqlang.${unclear}`,
    });
    if (insErr) {
      await db.storage.from("student-documents").remove([filedPath]);
      throw new Error(`documents insert: ${insErr.message}`);
    }
  }

  await setJob(db, job.id, {
    status: "completed",
    output_docx_path: outputPath,
    translated_file_path: filedPath,
    structured_translation: structured,
    verified_names: structured.verifiedNames,
    translated_text: blocksToPlainText(structured),
    supporting_documents: plan.supporting,
    completed_at: new Date().toISOString(),
    error_message: action === "keep" ? "Tarjima tayyor; hujjatlardagi mavjud tarjima almashtirilmadi" : null,
  });
  return action === "keep" ? "completed (kept existing)" : "completed";
}

async function run(): Promise<Record<string, number>> {
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const started = Date.now();
  const counts: Record<string, number> = {};

  while (Date.now() - started < RUN_BUDGET_MS) {
    const { data, error } = await db.rpc("claim_auto_translation_job", { p_max_attempts: MAX_ATTEMPTS });
    if (error) throw new Error(`claim: ${error.message}`);
    const job = (Array.isArray(data) ? data[0] : data) as Job | null;
    if (!job?.id) break;

    let outcome: string;
    try {
      outcome = await processJob(db, job);
    } catch (e) {
      const msg = errText(e);
      console.error("auto-translate job failed:", job.id, msg);
      const final = job.attempts >= MAX_ATTEMPTS;
      await setJob(db, job.id, { status: final ? "failed" : "queued", error_message: msg });
      outcome = final ? "failed" : "retry";
    }
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  return counts;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
  if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  const work = run()
    .then((counts) => console.log("auto-translate-documents:", JSON.stringify(counts)))
    .catch((e) => console.error("auto-translate-documents run failed:", errText(e)));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // Answer the cron at once; a translation can take a minute or more.
    EdgeRuntime.waitUntil(work);
    return json({ ok: true, started: true }, 202);
  }
  await work;
  return json({ ok: true, finished: true });
});
