// send-instagram — adapter for the CRM UI (MessagesContext.sendMessage).
// Body: { recipient_id, text?, media_path?, media_mime?, message_id? }.
// Auth: staff JWT (owner/admin/call_operator).
//
// RECOVERED FROM PRODUCTION 2026-09-03. The copy that was in this repo was
// version 1 of this function — no attachments, no delivery tracking, no
// duplicate guard — while production had been on version 9 for weeks. Nothing
// deployed from the repo, so nobody noticed; the first CI deploy of the repo
// copy would have silently removed all three features from a working inbox.
// That is why the deploy workflow ships an explicit allowlist rather than
// "deploy everything".
//
// v7: attachment support. The CRM uploads the file to the private `chat-media`
// bucket and passes media_path/media_mime; this function mints a signed URL
// and sends it as an IG attachment (image/video/audio — the only types the
// Instagram Send API accepts). A send carries either text OR an attachment,
// never both: IG DMs have no captions, so the CRM sends a caption as a
// separate text message.
// v6: delivery_status tracking + retry support. The CRM inserts the outgoing
// row with delivery_status='sending' and passes its id as message_id; this
// function stamps 'sent' (+ external_id) on success or 'failed'
// (+ delivery_error) on failure. On failure the dedupe entry is cleared so an
// immediate Retry from the UI is not swallowed by the duplicate guard.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const STAFF_ROLES = ["owner", "admin", "call_operator"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Removes the duplicate UI row when a send is deduped. A retry of a FAILED row
// is not a duplicate — the guard clears its dedupe entry on failure — so any
// row hit here is a genuine double-send.
async function deleteExtraUiRow(igsid: string, messageId: string | null) {
  if (messageId) {
    await admin.from("messages").delete().eq("id", messageId).is("external_id", null);
    return;
  }
  const { data: rows } = await admin.from("messages")
    .select("id").eq("source", "instagram").eq("sender_id", igsid)
    .eq("direction", "outgoing").is("external_id", null)
    .order("created_at", { ascending: false }).limit(1);
  if (rows?.[0]?.id) await admin.from("messages").delete().eq("id", rows[0].id).is("external_id", null);
}

async function markFailed(messageId: string | null, error: string, igsid?: string, textHash?: string) {
  if (igsid && textHash) {
    // Unblock an immediate retry of this exact send.
    await admin.from("instagram_send_dedupe").delete().eq("igsid", igsid).eq("text_hash", textHash);
  }
  if (!messageId) return;
  await admin.from("messages")
    .update({ delivery_status: "failed", delivery_error: error.slice(0, 500) })
    .eq("id", messageId).is("external_id", null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // --- staff auth ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id ?? null;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const igsid = String(body?.recipient_id ?? body?.igsid ?? "").trim();
  const text = String(body?.text ?? "").trim();
  const mediaPath = body?.media_path ? String(body.media_path) : null;
  const mediaMime = body?.media_mime ? String(body.media_mime) : "";
  const messageId = body?.message_id ? String(body.message_id) : null;
  if (!igsid || (!text && !mediaPath)) return json({ error: "recipient_id and text or media_path are required" }, 400);
  if (text && new TextEncoder().encode(text).length > 1000) {
    await markFailed(messageId, "Text exceeds 1000 bytes");
    return json({ error: "Text exceeds 1000 bytes" }, 400);
  }

  // The IG Send API only accepts these attachment types.
  let attachmentType: "image" | "video" | "audio" | null = null;
  if (mediaPath) {
    attachmentType = mediaMime.startsWith("image/") ? "image" : mediaMime.startsWith("video/") ? "video" : mediaMime.startsWith("audio/") ? "audio" : null;
    if (!attachmentType) {
      await markFailed(messageId, "Instagram only supports image, video or audio attachments");
      return json({ error: "Instagram only supports image, video or audio attachments" }, 400);
    }
  }

  // --- parallel lookups: roles, config, account, dedupe hash ---
  const [rolesRes, cfgRes, accountRes, textHash] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin.from("instagram_app_config").select("graph_version").eq("id", "main").maybeSingle(),
    admin.from("instagram_accounts").select("*").eq("active", true).limit(1).maybeSingle(),
    sha256hex(mediaPath ? `media:${mediaPath}` : text),
  ]);

  if (!rolesRes.error) {
    const isStaff = (rolesRes.data ?? []).some((r: any) => STAFF_ROLES.includes(String(r.role)));
    if (!isStaff) return json({ error: "Forbidden: staff role required" }, 403);
  }
  const ver = cfgRes.data?.graph_version || "v25.0";
  let account = accountRes.data;
  if (!account) {
    await markFailed(messageId, "No Instagram account connected");
    return json({ error: "No Instagram account connected" }, 400);
  }

  // --- duplicate-send guard: same recipient + same payload within ~10-20s ---
  const bucket = Math.floor(Date.now() / 10000);
  const { data: recentDup } = await admin.from("instagram_send_dedupe")
    .select("bucket").eq("igsid", igsid).eq("text_hash", textHash).gte("bucket", bucket - 1).limit(1);
  if (recentDup && recentDup.length > 0) {
    await deleteExtraUiRow(igsid, messageId);
    return json({ ok: true, deduped: true });
  }
  const { error: dedupeErr } = await admin.from("instagram_send_dedupe").insert({ igsid, text_hash: textHash, bucket });
  if (dedupeErr && (dedupeErr as any).code === "23505") {
    await deleteExtraUiRow(igsid, messageId);
    return json({ ok: true, deduped: true });
  }
  // opportunistic prune of old dedupe rows (>1 day)
  admin.from("instagram_send_dedupe").delete().lt("bucket", bucket - 8640).then(() => {});

  // --- token refresh if <10 days left ---
  if (account.token_expires_at && new Date(account.token_expires_at).getTime() - Date.now() < 10 * 24 * 3600 * 1000) {
    try {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(account.access_token)}`);
      const j = await r.json();
      if (r.ok && j?.access_token) {
        const expiresAt = new Date(Date.now() + (j.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();
        await admin.from("instagram_accounts").update({ access_token: j.access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("id", account.id);
        account = { ...account, access_token: j.access_token };
      }
    } catch (e) { console.error("token refresh error:", e); }
  }

  // --- build the message payload (attachment needs a URL Meta can fetch) ---
  let messagePayload: Record<string, unknown>;
  if (mediaPath && attachmentType) {
    const { data: signed, error: signErr } = await admin.storage.from("chat-media").createSignedUrl(mediaPath, 3600);
    if (signErr || !signed?.signedUrl) {
      await markFailed(messageId, "Could not create a URL for the attachment", igsid, textHash);
      return json({ error: "Could not create a URL for the attachment" }, 500);
    }
    messagePayload = { attachment: { type: attachmentType, payload: { url: signed.signedUrl } } };
  } else {
    messagePayload = { text };
  }

  // --- send via Graph API ---
  const r = await fetch(`https://graph.instagram.com/${ver}/me/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: igsid }, message: messagePayload }),
  });
  let j: any = null;
  try { j = await r.json(); } catch { /* empty */ }
  if (!r.ok) {
    const e = j?.error;
    let hint = "";
    let windowExpired = false;
    if (e?.code === 10 || /24 hour|outside.*window/i.test(e?.message ?? "")) {
      hint = " (24-hour reply window expired — the user must message you again first)";
      windowExpired = true;
    }
    console.error("graph send failed:", JSON.stringify(j));
    await markFailed(messageId, `${e?.message ?? `Graph API HTTP ${r.status}`}${hint}`, igsid, textHash);
    return json({ error: `${e?.message ?? `Graph API HTTP ${r.status}`}${hint}`, window_expired: windowExpired, graph: j }, 502);
  }
  const mid = j?.message_id ?? null;
  const now = new Date().toISOString();

  // --- stamp the UI-inserted outgoing row so the echo webhook dedupes.
  // Race-safe: if the echo webhook already inserted a row with this mid, drop
  // the redundant UI row instead of stamping (unique index on (source, external_id)).
  if (mid) {
    let uiRowId = messageId;
    if (!uiRowId) {
      const { data: uiRows } = await admin.from("messages")
        .select("id").eq("source", "instagram").eq("sender_id", igsid)
        .eq("direction", "outgoing").is("external_id", null)
        .order("created_at", { ascending: false }).limit(1);
      uiRowId = uiRows?.[0]?.id ?? null;
    }
    const { data: echoRow } = await admin.from("messages").select("id").eq("source", "instagram").eq("external_id", mid).maybeSingle();

    if (uiRowId && !echoRow) {
      const { error: upErr } = await admin.from("messages")
        .update({ external_id: mid, delivery_status: "sent", delivery_error: null })
        .eq("id", uiRowId);
      if (upErr && (upErr as any).code === "23505") {
        await admin.from("messages").delete().eq("id", uiRowId).is("external_id", null);
      }
    } else if (uiRowId && echoRow) {
      await admin.from("messages").delete().eq("id", uiRowId).is("external_id", null);
    } else if (!uiRowId && !echoRow) {
      await admin.from("messages").insert({
        source: "instagram", external_id: mid, sender_id: igsid,
        sender_name: account.username ? `@${account.username}` : "Instagram",
        content: text, message_type: attachmentType === "image" ? "image" : mediaPath ? "file" : "text",
        direction: "outgoing", status: "replied",
        delivery_status: "sent",
        replied_by: userId, replied_at: now, created_at: now,
        metadata: { igsid, mid, sent_via: "crm_ui", ...(mediaPath ? { media_path: mediaPath, media_mime: mediaMime } : {}) },
      });
    }
  }

  // keep the thread fresh
  await admin.rpc("upsert_message_thread", {
    p_source: "instagram", p_sender_id: igsid, p_sender_name: null, p_sender_avatar: null,
    p_student_id: null, p_last_message_at: now, p_direction: "outgoing",
  });

  return json({ ok: true, message_id: mid });
});
