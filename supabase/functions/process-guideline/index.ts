// process-guideline — Extracts admission data from uploaded PDF guidelines.
//
// Picks up guideline_documents with parse_status='pending', downloads the PDF,
// sends it to Claude for structured extraction, and writes results to
// crawl_findings + review_queue (same flow as crawl-worker for consistency).
//
// Can be called on-demand (POST with {document_id}) or in batch mode (POST with
// no body → processes up to 5 pending documents).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BUCKET = "guideline-blobs";
const MAX_PDF_BYTES = 20 * 1024 * 1024;

interface Period {
  semester: string;
  year: number;
  program_level: string;
  language_track?: string | null;
  application_start?: string | null;
  application_end?: string | null;
  document_deadline?: string | null;
  result_announcement?: string | null;
  application_fee_krw?: number | null;
  application_fee_usd?: number | null;
  application_form_url?: string | null;
  confidence: number;
  field_confidence?: Record<string, number>;
}

const EXTRACTION_TOOL_GEMINI = {
  name: "record_admission_data",
  description:
    "Record structured admission information extracted from a Korean university admissions guideline PDF (모집요강). Only include data explicitly present in the document.",
  parameters: {
    type: "OBJECT" as const,
    properties: {
      page_type: {
        type: "STRING",
        enum: ["admissions_portal", "specific_intake", "department_list", "unknown"],
      },
      periods: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            semester: { type: "STRING", enum: ["spring", "fall"] },
            year: { type: "INTEGER" },
            program_level: { type: "STRING", enum: ["undergraduate", "graduate", "phd", "language"] },
            language_track: { type: "STRING", enum: ["korean", "english"], nullable: true },
            application_start: { type: "STRING", description: "ISO YYYY-MM-DD", nullable: true },
            application_end: { type: "STRING", description: "ISO YYYY-MM-DD", nullable: true },
            document_deadline: { type: "STRING", nullable: true },
            result_announcement: { type: "STRING", nullable: true },
            application_fee_krw: { type: "INTEGER", nullable: true },
            application_fee_usd: { type: "INTEGER", nullable: true },
            application_form_url: { type: "STRING", nullable: true },
            confidence: { type: "NUMBER" },
            field_confidence: { type: "OBJECT", properties: {}, additionalProperties: true },
          },
          required: ["semester", "year", "program_level", "confidence"],
        },
      },
      notes: { type: "STRING" },
    },
    required: ["page_type", "periods"],
  },
};

function validatePeriod(p: Period): boolean {
  const thisYear = new Date().getFullYear();
  if (p.year < 2024 || p.year > thisYear + 3) return false;
  if (!["spring", "fall"].includes(p.semester)) return false;
  if (!["undergraduate", "graduate", "phd", "language"].includes(p.program_level)) return false;
  if (p.application_start && p.application_end) {
    if (new Date(p.application_end) < new Date(p.application_start)) return false;
  }
  if (p.application_fee_krw != null && (p.application_fee_krw < 0 || p.application_fee_krw > 500000)) return false;
  if (p.application_fee_usd != null && (p.application_fee_usd < 0 || p.application_fee_usd > 500)) return false;
  return true;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  if (!geminiKey) {
    return json({ error: "GEMINI_API_KEY not configured" }, 400);
  }

  // Read review-mode config (auto vs manual approval)
  const { data: cfg } = await admin
    .from("ai_crawl_config")
    .select("auto_approve_threshold, require_approval")
    .eq("id", "singleton")
    .single();
  const autoApproveThreshold = cfg?.auto_approve_threshold ?? 0.9;
  const requireApproval = cfg?.require_approval ?? true;

  try {
    const body = await req.json().catch(() => ({})) as { document_id?: string };

    let docs: { id: string; institution_id: string; storage_path: string }[];

    if (body.document_id) {
      const { data } = await admin
        .from("guideline_documents")
        .select("id, institution_id, storage_path")
        .eq("id", body.document_id)
        .eq("parse_status", "pending")
        .limit(1);
      docs = data ?? [];
    } else {
      const { data } = await admin
        .from("guideline_documents")
        .select("id, institution_id, storage_path")
        .eq("parse_status", "pending")
        .order("fetched_at", { ascending: true })
        .limit(5);
      docs = data ?? [];
    }

    if (docs.length === 0) {
      return json({ ok: true, processed: 0, message: "No pending documents" });
    }

    const results: { id: string; status: string; periods: number }[] = [];

    for (const doc of docs) {
      try {
        const { data: updated } = await admin
          .from("guideline_documents")
          .update({ parse_status: "running" })
          .eq("id", doc.id)
          .eq("parse_status", "pending")
          .select("id");
        if (!updated || updated.length === 0) {
          results.push({ id: doc.id, status: "skipped", periods: 0 });
          continue;
        }

        const dl = await admin.storage.from(BUCKET).download(doc.storage_path);
        if (dl.error || !dl.data) throw new Error(`Download failed: ${dl.error?.message}`);

        const bytes = new Uint8Array(await dl.data.arrayBuffer());
        if (bytes.byteLength === 0) throw new Error("Empty file");
        if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("File too large");

        const b64 = bytesToBase64(bytes);

        const geminiModel = "gemini-2.5-flash";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
        const aiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: { mimeType: "application/pdf", data: b64 },
                  },
                  {
                    text: [
                      "You are extracting admission data from a Korean university admissions guideline PDF (모집요강).",
                      "Rules:",
                      "- Only include data EXPLICITLY stated in the document",
                      "- Use ISO dates (YYYY-MM-DD). Convert Korean dates (2025년 3월 2일 → 2025-03-02)",
                      "- Set confidence 0.8-1.0 for clearly stated facts, 0.3-0.6 for inferred data",
                      "- Extract ALL admission periods found (spring, fall, for each program level)",
                      "- If the document covers multiple intakes, create separate period entries for each",
                    ].join("\n"),
                  },
                ],
              },
            ],
            tools: [{ functionDeclarations: [EXTRACTION_TOOL_GEMINI] }],
            toolConfig: {
              functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["record_admission_data"] },
            },
            generationConfig: { maxOutputTokens: 4096 },
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          throw new Error(`Gemini API error ${aiRes.status}: ${errText.slice(0, 200)}`);
        }

        const aiJson = await aiRes.json();
        const fnCall = aiJson.candidates?.[0]?.content?.parts?.find(
          (p: { functionCall?: unknown }) => p.functionCall,
        );
        const extracted = fnCall?.functionCall?.args ?? { periods: [], page_type: "unknown" };
        const periods: Period[] = (extracted.periods ?? []).filter(validatePeriod);

        // Create a crawl_run for tracking
        const { data: run, error: runError } = await admin
          .from("crawl_runs")
          .insert({
            institution_id: doc.institution_id,
            status: periods.length > 0 ? "succeeded" : "empty_extraction",
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            records_seen: extracted.periods?.length ?? 0,
            records_new: periods.length,
          })
          .select("id")
          .single();

        if (runError) {
          console.error("Failed to insert crawl_run:", runError);
        }

        for (const p of periods) {
          p.confidence = Math.max(0, Math.min(1, p.confidence ?? 0.5));

          const { data: finding, error: findingError } = await admin
            .from("crawl_findings")
            .insert({
              crawl_run_id: run?.id ?? null,
              finding_type: "admission_period",
              details: { institution_id: doc.institution_id, page_type: extracted.page_type, ...p },
              detected_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (findingError) {
            console.error("Failed to insert crawl_finding:", findingError);
            continue;
          }

          const isHighConfidence = !requireApproval && p.confidence >= autoApproveThreshold;

          await admin.from("review_queue").insert({
            entity_type: "crawl_finding",
            entity_id: finding.id,
            reason: isHighConfidence ? "high_confidence_auto" : "needs_review",
            priority: isHighConfidence ? 3 : 1,
            status: isHighConfidence ? "approved" : "pending",
            reviewer_decision: {
              institution_id: doc.institution_id,
              confidence: p.confidence,
              suggested: p,
              page_type: extracted.page_type,
              source: "guideline_pdf",
            },
            needs_attention: !isHighConfidence,
            resolved_at: isHighConfidence ? new Date().toISOString() : null,
          });

          if (isHighConfidence) {
            await upsertAdmissionPeriod(admin, doc.institution_id, p);
          }
        }

        await admin
          .from("guideline_documents")
          .update({
            parse_status: "succeeded",
            parsed_version: (extracted.periods?.length ?? 0),
          })
          .eq("id", doc.id);

        results.push({ id: doc.id, status: "succeeded", periods: periods.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`process-guideline failed for ${doc.id}:`, msg);

        await admin
          .from("guideline_documents")
          .update({ parse_status: "failed" })
          .eq("id", doc.id);

        results.push({ id: doc.id, status: "failed", periods: 0 });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

async function upsertAdmissionPeriod(
  admin: ReturnType<typeof createClient>,
  institutionId: string,
  p: Period,
) {
  await admin.from("university_admission_periods").upsert(
    {
      institution_id: institutionId,
      semester: p.semester,
      year: p.year,
      program_level: p.program_level,
      language_track: p.language_track ?? null,
      application_start: p.application_start ?? null,
      application_end: p.application_end ?? null,
      document_deadline: p.document_deadline ?? null,
      result_announcement: p.result_announcement ?? null,
      application_fee_krw: p.application_fee_krw ?? null,
      application_fee_usd: p.application_fee_usd ?? null,
      application_form_url: p.application_form_url ?? null,
      needs_attention: false,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "institution_id,semester,year,program_level,language_track",
      ignoreDuplicates: false,
    },
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
