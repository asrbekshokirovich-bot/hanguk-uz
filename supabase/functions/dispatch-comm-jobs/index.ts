// dispatch-comm-jobs
// ----------------------------------------------------------------------------
// Drains the comm_processing_jobs queue: picks pending (and not-yet-exhausted
// errored) jobs and invokes the matching worker. Idempotent and safe to call
// repeatedly — intended for a pg_cron schedule, a manual "process pending"
// action, or one-off backfills.
//
// Internal-only: present the service-role key as a Bearer token.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORKERS: Record<string, { fn: string; param: string }> = {
  call_transcribe_analyze: { fn: "process-call-recording", param: "call_id" },
  document_extract: { fn: "process-document", param: "document_id" },
  student_track_infer: { fn: "infer-student-track", param: "student_id" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("authorization") || "";
  if (auth.replace(/^Bearer\s+/i, "").trim() !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let limit = 5;
  try {
    const body = await req.json();
    if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(25, body.limit));
  } catch (_e) { /* default */ }

  // Pick claimable jobs: pending, or errored but still under max_attempts.
  const { data: jobs, error } = await supabase
    .from("comm_processing_jobs")
    .select("id, job_type, ref_id, attempts, max_attempts, status")
    .in("status", ["pending", "error"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  const claimable = (jobs ?? []).filter((j: any) => (j.attempts ?? 0) < (j.max_attempts ?? 3));
  const results: any[] = [];

  for (const jobRow of claimable) {
    const w = WORKERS[jobRow.job_type];
    if (!w) {
      results.push({ id: jobRow.id, skipped: "no_worker" });
      continue;
    }
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${w.fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ [w.param]: jobRow.ref_id }),
      });
      const out = await res.json().catch(() => ({}));
      results.push({ id: jobRow.id, ok: res.ok, status: res.status, out });
    } catch (e) {
      results.push({ id: jobRow.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ ok: true, dispatched: results.length, results });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
