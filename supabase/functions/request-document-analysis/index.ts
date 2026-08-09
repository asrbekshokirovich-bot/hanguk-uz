// request-document-analysis — staff-facing trigger to extract document(s).
// Verifies the caller is staff, then invokes the internal worker with the
// service key. Supports a single document or draining a batch (for backfill).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const STAFF_ROLES = ["owner", "admin", "document_handler", "call_operator"];
// Mirrors comm_processing_jobs.max_attempts (table default). A job at this many
// attempts is permanently failed and no longer claimable.
const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => STAFF_ROLES.includes(r.role))) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const invokeOne = async (documentId: string, force?: boolean) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/process-document`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ document_id: documentId, force: !!force }),
      });
      return { ok: res.ok, out: await res.json().catch(() => ({})) };
    };

    if (body.document_id) {
      const r = await invokeOne(body.document_id, body.force);
      return json({ ok: r.ok, ...r.out }, r.ok ? 200 : 502);
    }

    const limit = Math.max(1, Math.min(12, Number(body.limit) || 6));

    // Optional: requeue documents that previously exhausted their retries so a
    // fresh "read everything" pass gives them one more chance. The client only
    // sets this on the first batch of a drain, never on the background auto-run.
    if (body.reset_errors) {
      await admin.from("comm_processing_jobs")
        .update({ status: "pending", attempts: 0, last_error: null })
        .eq("job_type", "document_extract").eq("status", "error");
    }

    // Claim jobs that are actually worth attempting: pending, or errored but
    // still under max_attempts (= MAX_ATTEMPTS). Filtering on attempts in SQL is
    // what keeps permanently-failed jobs from sitting at the front of the queue
    // and starving the rest — every backfilled job shares one created_at, so we
    // also add id as a stable tiebreak for deterministic ordering.
    const { data: jobs } = await admin.from("comm_processing_jobs")
      .select("ref_id")
      .eq("job_type", "document_extract").in("status", ["pending", "error"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .limit(limit);
    let processed = 0;
    for (const j of (jobs ?? [])) { const r = await invokeOne((j as any).ref_id); if (r.ok) processed++; }

    // Remaining counts only claimable jobs (excludes exhausted errors) so the
    // client's drain loop reaches 0 and terminates instead of spinning forever.
    const { count: remaining } = await admin.from("comm_processing_jobs")
      .select("*", { count: "exact", head: true })
      .eq("job_type", "document_extract").in("status", ["pending", "error"]).lt("attempts", MAX_ATTEMPTS);
    return json({ ok: true, processed, remaining: remaining ?? 0 });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
