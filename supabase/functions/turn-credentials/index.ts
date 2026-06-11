import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Public STUN servers — always offered alongside TURN, and used as the safe
// fallback when no TURN relay has been configured yet.
const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Mint time-limited TURN credentials using coturn's REST API ("use-auth-secret")
 * scheme, so the long-term secret never leaves the server:
 *
 *   username   = <unix-expiry-timestamp>
 *   credential = base64( HMAC-SHA1( TURN_SECRET, username ) )
 *
 * Configure coturn with:  use-auth-secret  +  static-auth-secret=<TURN_SECRET>
 */
async function makeTurnCredentials(secret: string, ttlSeconds: number) {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = String(expiry);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(username));
  const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return { username, credential };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  try {
    // Only authenticated staff may mint TURN credentials — this prevents anyone
    // on the internet from using (and billing) your relay.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const turnUrls = (Deno.env.get("TURN_URLS") ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    const turnSecret = Deno.env.get("TURN_SECRET") ?? "";
    const ttlSeconds = Number.parseInt(Deno.env.get("TURN_TTL") ?? "3600", 10) || 3600;

    // No TURN configured yet → return STUN only. Calls still work for users who
    // can connect peer-to-peer; this is a safe, non-breaking default.
    if (turnUrls.length === 0 || !turnSecret) {
      return json({ iceServers: STUN_SERVERS });
    }

    const { username, credential } = await makeTurnCredentials(turnSecret, ttlSeconds);
    return json({
      iceServers: [
        ...STUN_SERVERS,
        { urls: turnUrls, username, credential },
      ],
      ttl: ttlSeconds,
    });
  } catch (err) {
    console.error("[turn-credentials] error", err);
    // Fail open to STUN so a credential error never fully breaks calling.
    return new Response(
      JSON.stringify({ iceServers: STUN_SERVERS, error: "credential_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
