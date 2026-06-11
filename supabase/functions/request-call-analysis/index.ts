// request-call-analysis
// ----------------------------------------------------------------------------
// Staff-facing trigger that lets the CRM (re)run transcription + analysis for a
// single call. Verifies the caller is a staff member, then invokes the
// internal worker with the service-role key. Keeps the service key server-side.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = ["owner", "admin", "call_operator", "document_handler"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller from their JWT.
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (roles ?? []).some((r: any) => STAFF_ROLES.includes(r.role));
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const { call_id, force } = await req.json();
    if (!call_id) return json({ error: "Missing call_id" }, 400);

    // Invoke the worker server-side (it requires the service-role key).
    const res = await fetch(`${supabaseUrl}/functions/v1/process-call-recording`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ call_id, force: !!force }),
    });
    const out = await res.json().catch(() => ({}));
    return json({ ok: res.ok, ...out }, res.ok ? 200 : 502);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
