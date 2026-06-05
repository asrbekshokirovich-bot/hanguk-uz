import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Meta / Instagram credentials (set as Supabase function secrets)
const INSTAGRAM_VERIFY_TOKEN = Deno.env.get("INSTAGRAM_VERIFY_TOKEN");
const INSTAGRAM_ACCESS_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET");
const GRAPH_API_VERSION = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") || "v21.0";
const GRAPH_API_HOST = Deno.env.get("INSTAGRAM_GRAPH_API_HOST") || "graph.instagram.com";
const GRAPH_BASE = `https://${GRAPH_API_HOST}/${GRAPH_API_VERSION}`;

type MessageType = "text" | "image" | "file" | "voice";

interface IgAttachment {
  type?: string;
  payload?: { url?: string };
}

interface IgMessage {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  is_deleted?: boolean;
  attachments?: IgAttachment[];
}

interface IgMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: IgMessage;
}

interface IgEntry {
  id?: string;
  time?: number;
  messaging?: IgMessagingEvent[];
}

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw body using the app
 * secret. Returns true when the signature matches. When no app secret is
 * configured we skip verification (best-effort) and log a warning.
 */
async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!INSTAGRAM_APP_SECRET) {
    console.warn("INSTAGRAM_APP_SECRET not set — skipping webhook signature verification");
    return true;
  }
  if (!signatureHeader) return false;

  const expected = signatureHeader.replace(/^sha256=/i, "").trim();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(INSTAGRAM_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const actual = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (actual.length !== expected.length) return false;
  // constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) {
    mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Map an Instagram attachment to a CRM message type + human-readable summary. */
function describeAttachment(att: IgAttachment): { content: string; type: MessageType } {
  switch ((att.type || "").toLowerCase()) {
    case "image":
      return { content: "📷 [Image]", type: "image" };
    case "audio":
      return { content: "🎤 [Voice message]", type: "voice" };
    case "video":
      return { content: "🎬 [Video]", type: "file" };
    case "file":
      return { content: "📎 [File]", type: "file" };
    case "share":
      return { content: "🔗 [Shared post]", type: "file" };
    case "story_mention":
      return { content: "📖 [Story mention]", type: "file" };
    case "reel":
    case "ig_reel":
      return { content: "🎞️ [Reel]", type: "file" };
    case "like_heart":
      return { content: "❤️", type: "text" };
    default:
      return { content: "[Attachment]", type: "file" };
  }
}

/**
 * Look up the Instagram user's display name / username / avatar so the CRM
 * shows a real person instead of a numeric ID. Best-effort: any failure just
 * leaves us with a generic name and no avatar.
 */
async function fetchSenderProfile(
  igsid: string,
): Promise<{ name: string | null; avatar: string | null }> {
  if (!INSTAGRAM_ACCESS_TOKEN) return { name: null, avatar: null };
  try {
    const url = `${GRAPH_BASE}/${igsid}?fields=name,username,profile_pic&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Profile lookup for ${igsid} failed: ${res.status} ${await res.text()}`);
      return { name: null, avatar: null };
    }
    const profile = await res.json();
    const name = profile.name || (profile.username ? `@${profile.username}` : null);
    return { name, avatar: profile.profile_pic || null };
  } catch (e) {
    console.warn("Profile lookup error:", e);
    return { name: null, avatar: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // --- GET: webhook verification handshake + status ---
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Meta verification: echo the challenge back as plain text when the token matches.
    if (mode === "subscribe" && token) {
      if (INSTAGRAM_VERIFY_TOKEN && token === INSTAGRAM_VERIFY_TOKEN) {
        console.log("Instagram webhook verified");
        return new Response(challenge ?? "", {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      console.error("Instagram webhook verification failed: token mismatch");
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Plain status probe (used by the CRM Settings → Integrations panel).
    return new Response(
      JSON.stringify({
        message: "Instagram webhook endpoint",
        verify_token_configured: !!INSTAGRAM_VERIFY_TOKEN,
        access_token_configured: !!INSTAGRAM_ACCESS_TOKEN,
        app_secret_configured: !!INSTAGRAM_APP_SECRET,
        configured: !!(INSTAGRAM_VERIFY_TOKEN && INSTAGRAM_ACCESS_TOKEN),
        graph_base: GRAPH_BASE,
        setup_instructions:
          "In the Meta App dashboard, add this URL as the Instagram webhook callback, set the Verify Token to match INSTAGRAM_VERIFY_TOKEN, subscribe to the 'messages' field, and set INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_APP_SECRET secrets.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // --- POST: incoming messaging events ---
  const rawBody = await req.text();

  // Validate the payload really came from Meta before trusting it.
  const signatureOk = await verifySignature(rawBody, req.headers.get("x-hub-signature-256"));
  if (!signatureOk) {
    console.error("Instagram webhook signature verification failed");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { object?: string; entry?: IgEntry[] };
  try {
    body = JSON.parse(rawBody);
  } catch (_e) {
    // Not JSON — ack so Meta doesn't disable the webhook; nothing to process.
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    // Cache profile lookups within a single webhook delivery.
    const profileCache = new Map<string, { name: string | null; avatar: string | null }>();

    for (const entry of entries) {
      const events = Array.isArray(entry.messaging) ? entry.messaging : [];

      for (const event of events) {
        const message = event.message;
        if (!message) continue; // read receipts, reactions, postbacks — ignore

        // Skip echoes (messages the business account sent) and deletions —
        // CRM-originated replies are already stored when staff send them.
        if (message.is_echo || message.is_deleted) {
          console.log("Skipping echo/deleted message", message.mid);
          continue;
        }

        const igsid = event.sender?.id;
        if (!igsid) continue;
        const recipientId = event.recipient?.id ?? null;
        const mid = message.mid ?? null;

        // Idempotency: Meta retries deliveries. Don't double-store / double-count.
        if (mid) {
          const { data: existing } = await supabase
            .from("messages")
            .select("id")
            .eq("source", "instagram")
            .eq("external_id", mid)
            .maybeSingle();
          if (existing) {
            console.log("Duplicate message ignored", mid);
            continue;
          }
        }

        // Resolve content + type from text or the first attachment.
        let content = message.text ?? "";
        let messageType: MessageType = "text";
        const attachments = Array.isArray(message.attachments) ? message.attachments : [];
        if (!content && attachments.length > 0) {
          const described = describeAttachment(attachments[0]);
          content = described.content;
          messageType = described.type;
        }
        if (!content) content = "[Empty message]";

        // Enrich the sender so staff see a real name/avatar, not an IGSID.
        let profile = profileCache.get(igsid);
        if (!profile) {
          profile = await fetchSenderProfile(igsid);
          profileCache.set(igsid, profile);
        }
        const senderName = profile.name || `Instagram user ${igsid.slice(-6)}`;

        // Atomic thread upsert + unread increment (shared with Telegram).
        const { error: threadError } = await supabase.rpc("increment_thread_unread", {
          p_source: "instagram",
          p_sender_id: igsid,
          p_sender_name: senderName,
        });
        if (threadError) console.error("Thread upsert error:", threadError);

        // Persist the avatar on the thread when we have one.
        if (profile.avatar) {
          await supabase
            .from("message_threads")
            .update({ sender_avatar: profile.avatar })
            .eq("source", "instagram")
            .eq("sender_id", igsid);
        }

        const createdAt = event.timestamp
          ? new Date(event.timestamp).toISOString()
          : new Date().toISOString();

        const { error: msgError } = await supabase.from("messages").insert({
          source: "instagram",
          external_id: mid,
          sender_id: igsid,
          sender_name: senderName,
          sender_avatar: profile.avatar,
          content,
          message_type: messageType,
          direction: "incoming",
          status: "unread",
          created_at: createdAt,
          metadata: {
            instagram_igsid: igsid,
            instagram_recipient_id: recipientId,
            instagram_message_id: mid,
            attachments,
          },
        });
        if (msgError) {
          console.error("Message insert error:", msgError);
          continue;
        }

        console.log(`Stored Instagram message from ${senderName} (${igsid})`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing Instagram webhook:", error);
    // Ack 200 so Meta doesn't auto-disable the subscription on transient errors.
    return new Response(JSON.stringify({ ok: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
