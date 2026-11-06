// dispatch-comm-jobs
// ----------------------------------------------------------------------------
// Drains the comm_processing_jobs queue: picks pending (and not-yet-exhausted
// errored) jobs and invokes the matching worker. Idempotent and safe to call
// repeatedly — intended for a pg_cron schedule, a manual "process pending"
// action, or one-off backfills.
//
// Internal-only: present the secret key on `apikey` (or, during the
// transition, the legacy service_role key as a Bearer token).
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { internalFunctionHeaders, serviceKey as getServiceKey } from "../_shared/keys.ts";
import { isServiceRequest } from "../_shared/caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORKERS: Record<string, { fn: string; param: string; passRefTable?: boolean }> = {
  call_transcribe_analyze: { fn: "process-call-recording", param: "call_id" },
  document_extract: { fn: "process-document", param: "document_id" },
  student_track_infer: { fn: "infer-student-track", param: "student_id" },
};

// Job types that are still recognised but deliberately NOT dispatched.
//
// content_embed: the live v49 routed these to `embed-content` (hybrid-retrieval
// embeddings, ref_table + ref_id). `embed-content` was retired on 2026-11-05
// (security audit: unused and unauthenticated) and is now a 410 stub, so
// calling it would only burn attempts and flip the jobs to "error". The jobs
// (~16k pending, none processed since June) are left untouched as "pending"
// and are excluded from the claim query below, so they do not block the
// other job types. If embeddings come back, add a worker here with
// `passRefTable: true` (the worker needs ref_table to know which source table
// ref_id belongs to).
const RETIRED_JOB_TYPES: Record<string, string> = {
  content_embed: "embed-content retired 2026-11-05 (410 stub)",
};
let retiredLogged = false;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceKey = getServiceKey();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // Server callers only: sb_secret_ key on `apikey` (or the legacy service_role key).
  if (!isServiceRequest(req)) {
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
    .select("id, job_type, ref_table, ref_id, attempts, max_attempts, status")
    .in("status", ["pending", "error"])
    .not("job_type", "in", `(${Object.keys(RETIRED_JOB_TYPES).join(",")})`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  if (!retiredLogged) {
    retiredLogged = true;
    console.log(
      "dispatch-comm-jobs: skipping retired job types (left pending):",
      JSON.stringify(RETIRED_JOB_TYPES),
    );
  }

  const claimable = (jobs ?? []).filter((j: any) => (j.attempts ?? 0) < (j.max_attempts ?? 3));
  const results: any[] = [];

  for (const jobRow of claimable) {
    if (RETIRED_JOB_TYPES[jobRow.job_type]) {
      // Defensive: the query already excludes these. Leave the row as is.
      results.push({ id: jobRow.id, skipped: "retired" });
      continue;
    }
    const w = WORKERS[jobRow.job_type];
    if (!w) {
      results.push({ id: jobRow.id, skipped: "no_worker" });
      continue;
    }
    try {
      const payload: Record<string, unknown> = { [w.param]: jobRow.ref_id };
      if (w.passRefTable) payload.ref_table = jobRow.ref_table;
      const res = await fetch(`${supabaseUrl}/functions/v1/${w.fn}`, {
        method: "POST",
        headers: internalFunctionHeaders(),
        body: JSON.stringify(payload),
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
