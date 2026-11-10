// vapi-fetch-recording — returns the Vapi recording URL of a mock-interview call.
//
// Security audit 2026-11-10: the live version only checked that an
// Authorization header existed, so anyone holding the public key and a call id
// could fetch any student's interview recording. Now:
//   * the caller must be a signed-in user (student or guest — guests take
//     mock interviews too: 19 of 65 recorded sessions on 2026-11-10);
//   * the call must belong to them: interview_sessions.vapi_call_id = callId
//     AND student_id = caller — or the caller is staff (fn_is_inbox_staff).
// Source brought into the repo from live v63; response shape unchanged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishableKey, serviceKey } from "../_shared/keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Authorization required" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, publishableKey(), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Invalid or expired token" }, 401);

    const body = await req.json().catch(() => ({}));
    const callId = typeof body?.callId === "string" ? body.callId.trim() : "";
    if (!callId) return json({ error: "callId is required" }, 400);
    if (!UUID_RE.test(callId)) return json({ error: "Invalid callId" }, 400);

    // Owner check with the service key (independent of RLS on interview_sessions).
    const admin = createClient(url, serviceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: own, error: ownError } = await admin
      .from("interview_sessions")
      .select("id")
      .eq("vapi_call_id", callId)
      .eq("student_id", user.id)
      .limit(1);
    if (ownError) {
      console.error("interview_sessions lookup", ownError);
      return json({ error: "Lookup failed" }, 500);
    }

    if (!own || own.length === 0) {
      const { data: isStaff } = await userClient.rpc("fn_is_inbox_staff");
      if (isStaff !== true) return json({ error: "Forbidden" }, 403);
    }

    const vapiPrivateKey = Deno.env.get("VAPI_PRIVATE_KEY");
    if (!vapiPrivateKey) return json({ error: "Server missing VAPI_PRIVATE_KEY secret" }, 500);

    const vapiResponse = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${vapiPrivateKey}`, "Content-Type": "application/json" },
    });

    if (!vapiResponse.ok) {
      console.error("VAPI error:", vapiResponse.status, await vapiResponse.text());
      const status = vapiResponse.status === 404 ? 404 : 502;
      return json({ error: `Failed to fetch from Vapi: ${vapiResponse.status}` }, status);
    }

    const vapiData = await vapiResponse.json();
    // As of August 2024, stereoRecordingUrl is deprecated. Use artifact.recordingUrl
    const recordingUrl = vapiData.artifact?.recordingUrl || vapiData.stereoRecordingUrl;
    if (!recordingUrl) return json({ error: `No recording URL found for call ${callId}` }, 404);

    return json({ recordingUrl });
  } catch (error) {
    console.error("Fetch recording error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
