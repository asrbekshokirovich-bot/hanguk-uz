// crawl-dispatcher
//
// Reconfigurable, self-gated dispatcher for the AI admissions-crawl pipeline.
// Reads public.ai_crawl_config every invocation and DOES NOTHING unless
// `enabled = true` AND the configured interval has elapsed. This means the
// pipeline ships fully built but inert: flipping `enabled` (and tuning
// interval_hours / batch_size) from the monitoring UI is all that's needed to
// turn it on — no redeploys.
//
// When active it picks the next batch of institutions due for a refresh and
// invokes `crawl-worker` for each. It never writes admissions data itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface CrawlConfig {
  enabled: boolean;
  interval_hours: number;
  batch_size: number;
  model: string;
  auto_approve_threshold: number;
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
      .select("enabled, interval_hours, batch_size, model, auto_approve_threshold, last_run_at")
      .eq("id", "singleton")
      .single();

    if (cfgErr) throw cfgErr;
    const cfg = config as CrawlConfig;

    // 2) Gate: disabled → no-op
    if (!cfg.enabled) {
      return json({ skipped: true, reason: "disabled" });
    }

    // 3) Gate: interval not elapsed → no-op (unless forced)
    const force = new URL(req.url).searchParams.get("force") === "true";
    if (!force && cfg.last_run_at) {
      const elapsedMs = Date.now() - new Date(cfg.last_run_at).getTime();
      const intervalMs = cfg.interval_hours * 60 * 60 * 1000;
      if (elapsedMs < intervalMs) {
        return json({ skipped: true, reason: "interval_not_elapsed", elapsedMs, intervalMs });
      }
    }

    // 4) Pick the batch of institutions most overdue for a refresh.
    const { data: institutions, error: instErr } = await admin
      .from("institutions")
      .select("id, name_ko, primary_admissions_url_ko, last_verified_at")
      .not("primary_admissions_url_ko", "is", null)
      .order("last_verified_at", { ascending: true, nullsFirst: true })
      .limit(cfg.batch_size);

    if (instErr) throw instErr;

    // 5) Mark run start
    await admin
      .from("ai_crawl_config")
      .update({ last_run_at: new Date().toISOString(), last_run_status: "running", updated_at: new Date().toISOString() })
      .eq("id", "singleton");

    // 6) Fan out to worker (fire-and-forget per institution)
    const dispatched: string[] = [];
    for (const inst of institutions ?? []) {
      try {
        await admin.functions.invoke("crawl-worker", {
          body: { institution_id: inst.id, url: inst.primary_admissions_url_ko, model: cfg.model, auto_approve_threshold: cfg.auto_approve_threshold },
        });
        dispatched.push(inst.id);
      } catch (e) {
        console.error("dispatch failed for", inst.id, e);
      }
    }

    // 7) Schedule next run + finish
    const next = new Date(Date.now() + cfg.interval_hours * 60 * 60 * 1000).toISOString();
    await admin
      .from("ai_crawl_config")
      .update({ next_run_at: next, last_run_status: `dispatched ${dispatched.length}`, updated_at: new Date().toISOString() })
      .eq("id", "singleton");

    return json({ ok: true, dispatched: dispatched.length, institutions: dispatched });
  } catch (e) {
    console.error(e);
    await admin
      .from("ai_crawl_config")
      .update({ last_run_status: `error: ${String(e)}`, updated_at: new Date().toISOString() })
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
