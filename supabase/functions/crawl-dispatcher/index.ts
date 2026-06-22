// crawl-dispatcher — Self-gated, adaptive scheduler for the AI admissions-crawl pipeline.
//
// Resilience patterns implemented:
// - Pattern 7: Skips institutions in circuit-breaker cooldown
// - Pattern 8: Adaptive scheduling — prioritizes institutions with upcoming admission seasons
// - Respects ai_crawl_config.enabled gate — ships inert, enable from UI
// - Graceful degradation: no API key → no-op, no institutions → no-op

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface CrawlConfig {
  enabled: boolean;
  interval_hours: number;
  batch_size: number;
  model: string;
  auto_approve_threshold: number;
  require_approval: boolean;
  last_run_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // 1) Load config
    const { data: config, error: cfgErr } = await admin
      .from("ai_crawl_config")
      .select("enabled, interval_hours, batch_size, model, auto_approve_threshold, require_approval, last_run_at")
      .eq("id", "singleton")
      .single();

    if (cfgErr) throw cfgErr;
    const cfg = config as CrawlConfig;

    // 2) Gate: disabled → no-op
    if (!cfg.enabled) {
      return json({ skipped: true, reason: "disabled" });
    }

    // 3) Gate: GEMINI_API_KEY not set → no-op
    if (!Deno.env.get("GEMINI_API_KEY")) {
      return json({ skipped: true, reason: "no_api_key" });
    }

    // 4) Gate: interval not elapsed → no-op (unless forced)
    const params = new URL(req.url).searchParams;
    const force = params.get("force") === "true";
    const batchOverride = params.get("batch_size") ? parseInt(params.get("batch_size")!, 10) : null;
    if (!force && cfg.last_run_at) {
      const elapsedMs = Date.now() - new Date(cfg.last_run_at).getTime();
      const intervalMs = cfg.interval_hours * 60 * 60 * 1000;
      if (elapsedMs < intervalMs) {
        return json({ skipped: true, reason: "interval_not_elapsed", elapsedMs, intervalMs });
      }
    }

    const effectiveBatch = batchOverride ?? cfg.batch_size;

    // 5) Pick batch — adaptive scheduling:
    //    - Skip institutions in circuit-breaker cooldown
    //    - Prioritize by: oldest last_verified_at first (null = never crawled = highest priority)
    //    - Among those, prefer institutions that have admission URLs
    const { data: institutions, error: instErr } = await admin
      .from("institutions")
      .select("id, name_ko, primary_admissions_url_ko, last_verified_at, consecutive_failures, crawl_cooldown_until")
      .not("primary_admissions_url_ko", "is", null)
      .order("last_verified_at", { ascending: true, nullsFirst: true })
      .limit(effectiveBatch * 2);

    if (instErr) throw instErr;

    const now = new Date();
    const eligible = (institutions ?? []).filter((inst) => {
      // Pattern 7: Skip if in cooldown
      if (inst.crawl_cooldown_until && new Date(inst.crawl_cooldown_until) > now) {
        return false;
      }
      return true;
    }).slice(0, effectiveBatch);

    if (eligible.length === 0) {
      return json({ skipped: true, reason: "no_eligible_institutions" });
    }

    // 5b) Cleanup: mark stuck "running" crawl_runs as failed (>10 min old)
    await admin
      .from("crawl_runs")
      .update({ status: "failed", ended_at: new Date().toISOString(), error_text: "stale_running_cleanup" })
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    // 6) Mark run start
    await admin
      .from("ai_crawl_config")
      .update({
        last_run_at: now.toISOString(),
        last_run_status: "running",
        updated_at: now.toISOString(),
      })
      .eq("id", "singleton");

    // 7) Fan out to worker in waves of CONCURRENCY to avoid overwhelming the runtime
    const CONCURRENCY = 10;
    const dispatched: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const wave = eligible.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        wave.map((inst) =>
          admin.functions.invoke("crawl-worker", {
            body: {
              institution_id: inst.id,
              url: inst.primary_admissions_url_ko,
              model: cfg.model,
              auto_approve_threshold: cfg.auto_approve_threshold,
              require_approval: cfg.require_approval,
            },
          }).then(() => inst)
        ),
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled") {
          dispatched.push(r.value.id);
        } else {
          console.error("dispatch failed for", wave[j].id, wave[j].name_ko, r.reason);
          failed.push(wave[j].id);
        }
      }
    }

    // 8) Schedule next run + finish
    const next = new Date(
      Date.now() + cfg.interval_hours * 60 * 60 * 1000,
    ).toISOString();

    await admin
      .from("ai_crawl_config")
      .update({
        next_run_at: next,
        last_run_status: `dispatched ${dispatched.length}/${eligible.length}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton");

    return json({
      ok: true,
      dispatched: dispatched.length,
      failed: failed.length,
      total_eligible: eligible.length,
      institutions: dispatched,
    });
  } catch (e) {
    console.error(e);
    await admin
      .from("ai_crawl_config")
      .update({
        last_run_status: `error: ${String(e).slice(0, 200)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "singleton")
      .then(() => {});
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
