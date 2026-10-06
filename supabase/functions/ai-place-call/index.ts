// ai-place-call
// ----------------------------------------------------------------------------
// Staff-facing trigger: ask the AI voice agent to place an OUTBOUND call.
// Verifies the caller is staff, resolves the destination number (from a phone,
// a leadId, or a studentId), then forwards { phone, goal, context } to the
// off-platform worker's /outbound endpoint (which owns the ACS + Realtime call).
//
// The worker URL + shared secret are server-side only:
//   AI_AGENT_URL     - the worker's public origin (e.g. https://agent.example.com)
//   AGENT_SECRET     - shared secret the worker requires on /outbound
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = ["owner", "admin", "call_operator"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify + authorize the caller.
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

    const agentUrl = Deno.env.get("AI_AGENT_URL");
    const agentSecret = Deno.env.get("AGENT_SECRET");
    if (!agentUrl || !agentSecret) return json({ error: "Voice agent not configured" }, 503);

    const { phone, leadId, studentId, goal, context } = await req.json();

    // Resolve the destination number + a display name for the greeting.
    let toPhone: string | null = phone ?? null;
    let displayName: string | null = null;

    if (!toPhone && leadId) {
      const { data: lead } = await supabaseAdmin
        .from("leads").select("phone, full_name").eq("id", leadId).maybeSingle();
      toPhone = (lead as any)?.phone ?? null;
      displayName = (lead as any)?.full_name ?? null;
    }
    if (!toPhone && studentId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("phone, full_name").eq("user_id", studentId).maybeSingle();
      toPhone = (profile as any)?.phone ?? null;
      displayName = (profile as any)?.full_name ?? null;
    }

    if (!toPhone) return json({ error: "No phone number to call" }, 400);

    // Hand off to the worker; it dials and runs the conversation.
    const res = await fetch(`${agentUrl.replace(/\/$/, "")}/outbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-secret": agentSecret },
      body: JSON.stringify({ phone: toPhone, goal: goal ?? null, context: context ?? null, displayName }),
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
