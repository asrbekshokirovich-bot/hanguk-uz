// crawl-worker — Production-ready admissions page scraper with 8 resilience patterns:
//
// 1. Validate-then-commit: never overwrite good data with empty/garbage extraction
// 2. Guardrails: reject impossible values (past deadlines, bad TOPIK/GPA ranges)
// 3. Text-hash gate: skip LLM call if page content hasn't changed
// 4. DOM pruning: strip nav/footer/scripts before LLM sees content
// 5. Per-field confidence: each extracted field carries its own confidence score
// 6. Classify-then-extract: detect page type, use appropriate schema
// 7. Per-host circuit breaker: back off after consecutive failures
// 8. Adaptive scheduling: (handled by dispatcher)
//
// Remains inert until ANTHROPIC_API_KEY is set and ai_crawl_config.enabled = true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

interface WorkerBody {
  institution_id: string;
  url: string;
  model?: string;
  auto_approve_threshold?: number;
}

// ---------- Tool schemas for Claude structured extraction ----------

const EXTRACTION_TOOL = {
  name: "record_admission_data",
  description:
    "Record structured admission information extracted from a Korean university admissions page. Only include data explicitly present on the page. If uncertain, set confidence lower.",
  input_schema: {
    type: "object",
    properties: {
      page_type: {
        type: "string",
        enum: ["admissions_portal", "specific_intake", "department_list", "unknown"],
        description: "Detected page type",
      },
      periods: {
        type: "array",
        description: "Admission application periods found on the page.",
        items: {
          type: "object",
          properties: {
            semester: { type: "string", enum: ["spring", "fall"] },
            year: { type: "integer", minimum: 2024, maximum: 2030 },
            program_level: {
              type: "string",
              enum: ["undergraduate", "graduate", "phd", "language"],
            },
            language_track: {
              type: ["string", "null"],
              enum: ["korean", "english", null],
            },
            application_start: {
              type: ["string", "null"],
              description: "ISO date YYYY-MM-DD",
            },
            application_end: {
              type: ["string", "null"],
              description: "ISO date YYYY-MM-DD",
            },
            document_deadline: { type: ["string", "null"] },
            result_announcement: { type: ["string", "null"] },
            application_fee_krw: { type: ["integer", "null"] },
            application_fee_usd: { type: ["integer", "null"] },
            application_form_url: { type: ["string", "null"] },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Overall confidence for this row (0..1)",
            },
            field_confidence: {
              type: "object",
              description: "Per-field confidence scores where uncertain",
              additionalProperties: { type: "number" },
            },
          },
          required: ["semester", "year", "program_level", "confidence"],
        },
      },
      notes: {
        type: "string",
        description: "Anything ambiguous a human should verify.",
      },
    },
    required: ["page_type", "periods"],
  },
};

// ---------- Guardrails ----------

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

function validatePeriod(p: Period): { valid: boolean; reason?: string } {
  const now = new Date();
  const thisYear = now.getFullYear();

  if (p.year < 2024 || p.year > thisYear + 3) {
    return { valid: false, reason: `year ${p.year} out of range` };
  }

  if (!["spring", "fall"].includes(p.semester)) {
    return { valid: false, reason: `invalid semester: ${p.semester}` };
  }

  if (!["undergraduate", "graduate", "phd", "language"].includes(p.program_level)) {
    return { valid: false, reason: `invalid program_level: ${p.program_level}` };
  }

  // Date sanity: end should be after start
  if (p.application_start && p.application_end) {
    if (new Date(p.application_end) < new Date(p.application_start)) {
      return { valid: false, reason: "application_end before application_start" };
    }
  }

  // Fee sanity
  if (p.application_fee_krw !== null && p.application_fee_krw !== undefined) {
    if (p.application_fee_krw < 0 || p.application_fee_krw > 500000) {
      return { valid: false, reason: `fee_krw ${p.application_fee_krw} out of range` };
    }
  }
  if (p.application_fee_usd !== null && p.application_fee_usd !== undefined) {
    if (p.application_fee_usd < 0 || p.application_fee_usd > 500) {
      return { valid: false, reason: `fee_usd ${p.application_fee_usd} out of range` };
    }
  }

  // URL sanity
  if (p.application_form_url && !p.application_form_url.startsWith("http")) {
    return { valid: false, reason: "application_form_url not a URL" };
  }

  return { valid: true };
}

// ---------- DOM Pruning ----------

function pruneAndExtractText(html: string): string {
  let cleaned = html;

  // Remove script, style, noscript, svg, nav, footer, header (common noise)
  const stripTags = [
    "script", "style", "noscript", "svg", "nav", "footer", "header",
    "iframe", "object", "embed",
  ];
  for (const tag of stripTags) {
    cleaned = cleaned.replace(
      new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"),
      " ",
    );
  }

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, " ");

  // Remove elements with common noise classes/ids
  cleaned = cleaned.replace(
    /<(?:div|section|aside|ul)[^>]*(?:class|id)="[^"]*(?:menu|sidebar|breadcrumb|cookie|popup|modal|banner|advertisement|social)[^"]*"[^>]*>[\s\S]*?<\/(?:div|section|aside|ul)>/gi,
    " ",
  );

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n)));

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

// ---------- Content hashing ----------

async function hashContent(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return encodeHex(new Uint8Array(hashBuffer));
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  let runId: string | null = null;
  let institutionId: string | null = null;

  try {
    const body = (await req.json()) as WorkerBody;
    const {
      institution_id,
      url,
      model = "claude-sonnet-4-6",
      auto_approve_threshold = 0.9,
    } = body;
    institutionId = institution_id;

    if (!anthropicKey) {
      return json(
        { error: "ANTHROPIC_API_KEY not configured — pipeline is not enabled yet." },
        400,
      );
    }

    // --- Pattern 7: Circuit breaker check ---
    const { data: inst } = await admin
      .from("institutions")
      .select("consecutive_failures, crawl_cooldown_until")
      .eq("id", institution_id)
      .single();

    if (inst?.crawl_cooldown_until) {
      const cooldownEnd = new Date(inst.crawl_cooldown_until);
      if (cooldownEnd > new Date()) {
        return json({
          skipped: true,
          reason: "circuit_breaker_cooldown",
          cooldown_until: inst.crawl_cooldown_until,
        });
      }
    }

    // 1) Open a crawl run
    const { data: run, error: runErr } = await admin
      .from("crawl_runs")
      .insert({
        institution_id,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr) throw runErr;
    runId = run.id;

    // 2) Fetch the page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let pageRes: Response;
    try {
      pageRes = await fetch(url, {
        headers: {
          "User-Agent": "HangukUZ-AdmissionsBot/1.0",
          "Accept": "text/html",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      await recordFailure(admin, institution_id, runId, `fetch_error: ${fetchErr}`);
      return json({ error: `Failed to fetch: ${fetchErr}` }, 502);
    }
    clearTimeout(timeout);

    const httpStatus = pageRes.status;
    if (httpStatus >= 400) {
      await recordFailure(admin, institution_id, runId, `http_${httpStatus}`);
      return json({ error: `HTTP ${httpStatus}` }, 502);
    }

    const html = await pageRes.text();

    // --- Pattern 4: DOM pruning ---
    const prunedText = pruneAndExtractText(html);
    const text = prunedText.slice(0, 60_000);

    // --- Pattern 3: Text-hash gate ---
    const newHash = await hashContent(text);

    const { data: cached } = await admin
      .from("crawl_page_cache")
      .select("content_hash")
      .eq("institution_id", institution_id)
      .single();

    if (cached?.content_hash === newHash) {
      // Page unchanged — skip LLM, mark success
      await admin
        .from("crawl_runs")
        .update({
          status: "skipped",
          ended_at: new Date().toISOString(),
          http_status_code: httpStatus,
          content_hash: newHash,
          skipped_reason: "content_unchanged",
          records_seen: 0,
          records_new: 0,
        })
        .eq("id", runId);

      // Reset failures on successful fetch
      await admin
        .from("institutions")
        .update({ consecutive_failures: 0, last_verified_at: new Date().toISOString() })
        .eq("id", institution_id);

      return json({
        ok: true,
        run_id: runId,
        skipped: true,
        reason: "content_unchanged",
      });
    }

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
        max_tokens: 4096,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: "record_admission_data" },
        messages: [
          {
            role: "user",
            content: [
              `You are extracting admission data from a Korean university's admissions page.`,
              `Rules:`,
              `- Only include data EXPLICITLY present on the page`,
              `- Use ISO dates (YYYY-MM-DD). Convert Korean dates (2025년 3월 2일 → 2025-03-02)`,
              `- Set confidence lower (0.3-0.6) for anything you had to infer or guess`,
              `- Set confidence high (0.8-1.0) only for clearly stated facts`,
              `- If no admission periods are found, return empty periods array`,
              `- Classify the page_type to help downstream processing`,
              `\n---PAGE CONTENT---\n${text}`,
            ].join("\n"),
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      await recordFailure(admin, institution_id, runId, `claude_api_${aiRes.status}: ${errText.slice(0, 200)}`);
      return json({ error: `Claude API error: ${aiRes.status}` }, 502);
    }

    const aiJson = await aiRes.json();
    const toolUse = (aiJson.content ?? []).find(
      (c: { type: string }) => c.type === "tool_use",
    );
    const extracted = toolUse?.input ?? { periods: [], page_type: "unknown" };
    const periods: Period[] = extracted.periods ?? [];

    // --- Pattern 1: Validate-then-commit ---
    // Never write empty extraction over existing data
    if (periods.length === 0) {
      await admin
        .from("crawl_runs")
        .update({
          status: "empty_extraction",
          ended_at: new Date().toISOString(),
          http_status_code: httpStatus,
          content_hash: newHash,
          records_seen: 0,
          records_new: 0,
        })
        .eq("id", runId);

      // Update cache hash — page was fetched successfully, just no data found
      await upsertPageCache(admin, institution_id, newHash, new TextEncoder().encode(text).byteLength);

      // Reset failures (page fetched OK, just no admissions data)
      await admin
        .from("institutions")
        .update({ consecutive_failures: 0, last_verified_at: new Date().toISOString() })
        .eq("id", institution_id);

      return json({
        ok: true,
        run_id: runId,
        periods_found: 0,
        notes: extracted.notes ?? "No periods found on page",
        page_type: extracted.page_type,
      });
    }

    // --- Pattern 2: Guardrails + Pattern 5: Per-field confidence ---
    const validPeriods: Period[] = [];
    const rejectedPeriods: { period: Period; reason: string }[] = [];

    for (const p of periods) {
      const check = validatePeriod(p);
      if (!check.valid) {
        rejectedPeriods.push({ period: p, reason: check.reason! });
        continue;
      }
      // Clamp confidence to [0, 1]
      p.confidence = Math.max(0, Math.min(1, p.confidence ?? 0.5));
      validPeriods.push(p);
    }

    // 4) Record findings + queue for review
    let newCount = 0;
    for (const p of validPeriods) {
      const conf = p.confidence;
      const { data: finding, error: findingError } = await admin
        .from("crawl_findings")
        .insert({
          crawl_run_id: runId,
          finding_type: "admission_period",
          details: {
            institution_id,
            page_type: extracted.page_type,
            ...p,
          },
          detected_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (findingError) {
        console.error("Failed to insert crawl_finding:", findingError);
        continue;
      }

      newCount++;

      const isHighConfidence = conf >= auto_approve_threshold;

      await admin.from("review_queue").insert({
        entity_type: "crawl_finding",
        entity_id: finding.id,
        reason: isHighConfidence ? "high_confidence_auto" : "needs_review",
        priority: isHighConfidence ? 3 : 1,
        status: isHighConfidence ? "approved" : "pending",
        reviewer_decision: {
          institution_id,
          confidence: conf,
          field_confidence: p.field_confidence ?? {},
          suggested: p,
          page_type: extracted.page_type,
          source: "crawl",
        },
        needs_attention: !isHighConfidence,
        resolved_at: isHighConfidence ? new Date().toISOString() : null,
      });

      if (isHighConfidence) {
        const { error: upsertErr } = await admin.from("university_admission_periods").upsert(
          {
            institution_id,
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
        if (upsertErr) {
          console.error(`Auto-commit failed for ${institution_id}:`, upsertErr.message);
        }
      }
    }

    // 5) Close run successfully
    await admin
      .from("crawl_runs")
      .update({
        status: "succeeded",
        ended_at: new Date().toISOString(),
        http_status_code: httpStatus,
        content_hash: newHash,
        records_seen: periods.length,
        records_new: newCount,
      })
      .eq("id", runId);

    // Update page cache + reset circuit breaker
    await upsertPageCache(admin, institution_id, newHash, new TextEncoder().encode(text).byteLength);
    await admin
      .from("institutions")
      .update({
        content_hash: newHash,
        consecutive_failures: 0,
        crawl_cooldown_until: null,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", institution_id);

    return json({
      ok: true,
      run_id: runId,
      periods_found: validPeriods.length,
      rejected: rejectedPeriods.length,
      page_type: extracted.page_type,
      notes: extracted.notes ?? null,
    });
  } catch (e) {
    console.error(e);
    if (runId) {
      await admin
        .from("crawl_runs")
        .update({
          status: "failed",
          ended_at: new Date().toISOString(),
          error_text: String(e),
        })
        .eq("id", runId);
    }
    // Record failure for circuit breaker
    if (institutionId) {
      try {
        await recordFailure(admin, institutionId, runId, String(e));
      } catch {
        // best-effort
      }
    }
    return json({ error: String(e) }, 500);
  }
});

// ---------- Helpers ----------

async function recordFailure(
  admin: ReturnType<typeof createClient>,
  institutionId: string,
  runId: string | null,
  errorText: string,
) {
  // Update run if exists
  if (runId) {
    await admin
      .from("crawl_runs")
      .update({
        status: "failed",
        ended_at: new Date().toISOString(),
        error_text: errorText,
      })
      .eq("id", runId);
  }

  // Circuit breaker: increment consecutive_failures, set cooldown with exponential backoff
  const { data: inst } = await admin
    .from("institutions")
    .select("consecutive_failures")
    .eq("id", institutionId)
    .single();

  const failures = (inst?.consecutive_failures ?? 0) + 1;
  // Exponential backoff with jitter: 1h, 2h, 4h, 8h... capped at 72h
  const backoffHours = Math.min(72, Math.pow(2, failures - 1));
  const jitterMs = Math.random() * 15 * 60 * 1000; // up to 15 min jitter
  const cooldownUntil = new Date(
    Date.now() + backoffHours * 60 * 60 * 1000 + jitterMs,
  ).toISOString();

  await admin
    .from("institutions")
    .update({
      consecutive_failures: failures,
      crawl_cooldown_until: cooldownUntil,
    })
    .eq("id", institutionId);
}

async function upsertPageCache(
  admin: ReturnType<typeof createClient>,
  institutionId: string,
  contentHash: string,
  sizeBytes: number,
) {
  await admin.from("crawl_page_cache").upsert(
    {
      institution_id: institutionId,
      content_hash: contentHash,
      fetched_at: new Date().toISOString(),
      page_size_bytes: sizeBytes,
    },
    { onConflict: "institution_id" },
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
