// crawl-worker
//
// Fetches one institution's admissions page and uses the Claude API (tool_use,
// structured extraction) to pull out admission periods / requirements. Results
// are written to crawl_runs + crawl_findings and queued in review_queue for
// staff approval. High-confidence findings (>= auto_approve_threshold) can be
// auto-applied later by the reviewer flow.
//
// This function only runs when explicitly invoked by crawl-dispatcher, which is
// itself gated by ai_crawl_config.enabled. It needs the ANTHROPIC_API_KEY
// secret; until that is set and the pipeline is enabled, nothing here executes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface WorkerBody {
  institution_id: string;
  url: string;
  model?: string;
  auto_approve_threshold?: number;
}

// Tool schema Claude must fill — keeps extraction structured & validated.
const EXTRACTION_TOOL = {
  name: "record_admission_data",
  description: "Record structured admission information extracted from a Korean university admissions page.",
  input_schema: {
    type: "object",
    properties: {
      periods: {
        type: "array",
        description: "Admission application periods found on the page.",
        items: {
          type: "object",
          properties: {
            semester: { type: "string", enum: ["spring", "fall"] },
            year: { type: "integer" },
            program_level: { type: "string", enum: ["undergraduate", "graduate", "phd", "language"] },
            language_track: { type: ["string", "null"], enum: ["korean", "english", null] },
            application_start: { type: ["string", "null"], description: "ISO date YYYY-MM-DD" },
            application_end: { type: ["string", "null"], description: "ISO date YYYY-MM-DD" },
            document_deadline: { type: ["string", "null"] },
            confidence: { type: "number", description: "0..1 confidence for this row" },
          },
          required: ["semester", "year", "program_level", "confidence"],
        },
      },
      notes: { type: "string", description: "Anything ambiguous a human should verify." },
    },
    required: ["periods"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  let runId: string | null = null;

  try {
    const body = (await req.json()) as WorkerBody;
    const { institution_id, url, model = "claude-sonnet-4-6", auto_approve_threshold = 0.9 } = body;

    if (!anthropicKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured — pipeline is not enabled yet." }, 400);
    }

    // 1) Open a crawl run
    const { data: run, error: runErr } = await admin
      .from("crawl_runs")
      .insert({ status: "running", started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (runErr) throw runErr;
    runId = run.id;

    // 2) Fetch the page
    const pageRes = await fetch(url, { headers: { "User-Agent": "HangukUZ-AdmissionsBot/1.0" } });
    const httpStatus = pageRes.status;
    const html = await pageRes.text();
    const text = stripHtml(html).slice(0, 60_000); // cap input size

    // 3) Ask Claude to extract (structured tool_use)
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: "record_admission_data" },
        messages: [{
          role: "user",
          content: `Extract admission application periods from this Korean university admissions page text. Only include data explicitly present. Use ISO dates.\n\n---\n${text}`,
        }],
      }),
    });

    const aiJson = await aiRes.json();
    const toolUse = (aiJson.content ?? []).find((c: { type: string }) => c.type === "tool_use");
    const extracted = toolUse?.input ?? { periods: [] };
    const periods = extracted.periods ?? [];

    // 4) Record findings + queue for review
    let newCount = 0;
    for (const p of periods) {
      const conf = typeof p.confidence === "number" ? p.confidence : 0.5;
      const { data: finding } = await admin
        .from("crawl_findings")
        .insert({
          crawl_run_id: runId,
          finding_type: "admission_period",
          details: { institution_id, ...p },
          detected_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      newCount++;

      // Queue for staff review (auto-approve hint stored in decision payload)
      await admin.from("review_queue").insert({
        entity_type: "crawl_finding",
        entity_id: finding?.id ?? null,
        reason: conf >= auto_approve_threshold ? "high_confidence_auto" : "needs_review",
        priority: conf >= auto_approve_threshold ? 3 : 1,
        status: "pending",
        reviewer_decision: { institution_id, confidence: conf, suggested: p },
        needs_attention: conf < auto_approve_threshold,
      });
    }

    // 5) Close run
    await admin
      .from("crawl_runs")
      .update({
        status: "succeeded",
        ended_at: new Date().toISOString(),
        http_status_code: httpStatus,
        records_seen: periods.length,
        records_new: newCount,
      })
      .eq("id", runId);

    return json({ ok: true, run_id: runId, periods_found: periods.length, notes: extracted.notes ?? null });
  } catch (e) {
    console.error(e);
    if (runId) {
      await admin.from("crawl_runs").update({ status: "failed", ended_at: new Date().toISOString(), error_text: String(e) }).eq("id", runId).then(() => {});
    }
    return json({ error: String(e) }, 500);
  }
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
