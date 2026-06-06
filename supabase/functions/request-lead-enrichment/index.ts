// request-lead-enrichment — staff trigger to AI-enrich lead(s). Verifies staff,
// then invokes enrich-lead with the service key. One lead or a backfill batch.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const STAFF_ROLES = ["owner", "admin", "call_operator", "document_handler"];

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
    const invokeOne = async (leadId: string) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/enrich-lead`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ lead_id: leadId }),
      });
      return res.ok;
    };

    if (body.lead_id) {
      const ok = await invokeOne(body.lead_id);
      return json({ ok }, ok ? 200 : 502);
    }

    const limit = Math.max(1, Math.min(10, Number(body.limit) || 5));
    const { data: leads } = await admin.from("leads").select("id").is("enriched_at", null).order("created_at", { ascending: false }).limit(limit);
    let processed = 0;
    for (const l of leads ?? []) { if (await invokeOne(l.id)) processed++; }
    const { count: remaining } = await admin.from("leads").select("*", { count: "exact", head: true }).is("enriched_at", null);
    return json({ ok: true, processed, remaining: remaining ?? 0 });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
