import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const INSTAGRAM_ACCESS_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
const GRAPH_API_VERSION = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") || "v21.0";
const GRAPH_API_HOST = Deno.env.get("INSTAGRAM_GRAPH_API_HOST") || "graph.instagram.com";
const GRAPH_BASE = `https://${GRAPH_API_HOST}/${GRAPH_API_VERSION}`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Only authenticated CRM staff may trigger an Instagram send. The anon key
  // resolves to no user, so this rejects unauthenticated / public callers.
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization token" }, 401);
  }
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  if (!INSTAGRAM_ACCESS_TOKEN) {
    return jsonResponse(
      { error: "Instagram is not configured. Set the INSTAGRAM_ACCESS_TOKEN secret." },
      500,
    );
  }

  let payload: { recipient_id?: string; igsid?: string; recipient?: string; text?: string; message?: string };
  try {
    payload = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const recipientId = payload.recipient_id || payload.igsid || payload.recipient;
  const text = payload.text ?? payload.message;

  if (!recipientId || !text) {
    return jsonResponse({ error: "recipient_id and text are required" }, 400);
  }

  try {
    const res = await fetch(`${GRAPH_BASE}/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INSTAGRAM_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Instagram Send API error:", res.status, result);
      return jsonResponse(
        { error: result?.error?.message || `Instagram Send API returned ${res.status}`, details: result },
        502,
      );
    }

    return jsonResponse({ ok: true, message_id: result.message_id ?? null, result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("send-instagram error:", error);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
