// instagram-send — outbound Instagram actions for CRM staff.
// Actions: connect | status | send_dm | reply_comment | private_reply | hide_comment | refresh_token
// Auth: staff JWT (owner/admin/call_operator). Tokens live in instagram_accounts (service-role only).
//
// RECOVERED FROM PRODUCTION 2026-09-03 — deployed live, never committed.
//
// NOTE ON THE TWO NAMES. There is also a `send-instagram` function, and it is
// the one the CRM inbox actually calls (see MessagesContext). This one is the
// richer, comments-aware surface: connecting the account, replying under a
// post, private-replying to a commenter, hiding a comment. Two functions with
// reversed names doing overlapping jobs is a trap for whoever edits the wrong
// one; they should be merged, but not in the same change that is trying to
// stop the repo and production disagreeing.
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

async function getCaller(req: Request): Promise<{ userId: string | null; isStaff: boolean }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data } = await userClient.auth.getUser();
  const userId = data?.user?.id ?? null;
  if (!userId) return { userId: null, isStaff: false };
  const { data: roles, error } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (error) return { userId, isStaff: true }; // fail open to authenticated user if roles table shape differs
  const isStaff = (roles ?? []).some((r: any) => STAFF_ROLES.includes(String(r.role)));
  return { userId, isStaff };
}

async function getConfig(): Promise<any> {
  const { data } = await admin.from("instagram_app_config").select("*").eq("id", "main").maybeSingle();
  return data ?? {};
}

async function getAccount(): Promise<any | null> {
  const { data } = await admin.from("instagram_accounts").select("*").eq("active", true).order("connected_at").limit(1).maybeSingle();
  return data ?? null;
}

// Refresh long-lived token if it expires within 10 days.
async function ensureFreshToken(account: any): Promise<any> {
  if (!account?.token_expires_at) return account;
  const msLeft = new Date(account.token_expires_at).getTime() - Date.now();
  if (msLeft > 10 * 24 * 3600 * 1000) return account;
  try {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(account.access_token)}`);
    const j = await r.json();
    if (r.ok && j?.access_token) {
      const expiresAt = new Date(Date.now() + (j.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();
      await admin.from("instagram_accounts").update({ access_token: j.access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("id", account.id);
      return { ...account, access_token: j.access_token, token_expires_at: expiresAt };
    }
    console.error("token refresh failed:", JSON.stringify(j));
  } catch (e) { console.error("token refresh error:", e); }
  return account;
}

async function graphPost(ver: string, path: string, token: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; json: any }> {
  const r = await fetch(`https://graph.instagram.com/${ver}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let j: any = null;
  try { j = await r.json(); } catch { /* empty */ }
  return { ok: r.ok, status: r.status, json: j };
}

function graphError(res: { status: number; json: any }): string {
  const e = res.json?.error;
  if (!e) return `Graph API HTTP ${res.status}`;
  let hint = "";
  if (e.code === 10 || /24 hour|outside.*window/i.test(e.message ?? "")) hint = " (24-hour reply window has likely expired — the user must message you again first)";
  return `${e.message ?? "Graph API error"} [code ${e.code}${e.error_subcode ? "/" + e.error_subcode : ""}]${hint}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller.userId) return json({ error: "Unauthorized" }, 401);
  if (!caller.isStaff) return json({ error: "Forbidden: staff role required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body?.action ?? "");
  const cfg = await getConfig();
  const ver = cfg?.graph_version || "v25.0";
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const webhookUrl = `${projectUrl}/functions/v1/instagram-webhook`;

  try {
    // ---- connect: register account with a long-lived token (paste from Meta App Dashboard) ----
    if (action === "connect") {
      const token = String(body?.access_token ?? "").trim();
      if (!token) return json({ error: "access_token is required" }, 400);
      const r = await fetch(`https://graph.instagram.com/${ver}/me?fields=user_id,username,name,account_type&access_token=${encodeURIComponent(token)}`);
      const me = await r.json();
      if (!r.ok || me?.error) return json({ error: `Token check failed: ${me?.error?.message ?? r.status}` }, 400);
      const igUserId = String(me.user_id ?? me.id);
      const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(); // long-lived ≈ 60 days
      const { error } = await admin.from("instagram_accounts").upsert({
        ig_user_id: igUserId, username: me.username ?? null, access_token: token,
        token_expires_at: expiresAt, active: true, updated_at: new Date().toISOString(),
      }, { onConflict: "ig_user_id" });
      if (error) return json({ error: `DB save failed: ${error.message}` }, 500);
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body?.app_id) updates.app_id = String(body.app_id);
      if (body?.app_secret) updates.app_secret = String(body.app_secret);
      await admin.from("instagram_app_config").update(updates).eq("id", "main");
      return json({ ok: true, ig_user_id: igUserId, username: me.username, account_type: me.account_type, webhook_url: webhookUrl, verify_token: cfg?.verify_token });
    }

    // ---- status ----
    if (action === "status") {
      const account = await getAccount();
      return json({
        ok: true,
        connected: !!account,
        username: account?.username ?? null,
        ig_user_id: account?.ig_user_id ?? null,
        token_expires_at: account?.token_expires_at ?? null,
        app_secret_set: !!(Deno.env.get("IG_APP_SECRET") || cfg?.app_secret),
        webhook_url: webhookUrl,
        verify_token: cfg?.verify_token ?? null,
        graph_version: ver,
      });
    }

    // ---- everything below needs a connected account ----
    let account = await getAccount();
    if (!account) return json({ error: "No Instagram account connected. Run action=connect first." }, 400);
    account = await ensureFreshToken(account);

    if (action === "refresh_token") {
      const before = account.token_expires_at;
      account = await ensureFreshToken({ ...account, token_expires_at: new Date().toISOString() });
      return json({ ok: true, token_expires_at: account.token_expires_at, changed: account.token_expires_at !== before });
    }

    // ---- send_dm: reply in a DM conversation ----
    if (action === "send_dm") {
      const igsid = String(body?.igsid ?? body?.recipient_id ?? "").trim();
      const text = String(body?.text ?? "").trim();
      if (!igsid || !text) return json({ error: "igsid and text are required" }, 400);
      if (new TextEncoder().encode(text).length > 1000) return json({ error: "Text exceeds 1000 bytes" }, 400);

      const res = await graphPost(ver, "me/messages", account.access_token, { recipient: { id: igsid }, message: { text } });
      if (!res.ok) return json({ error: graphError(res), graph: res.json }, 502);

      const mid = res.json?.message_id ?? null;
      const now = new Date().toISOString();
      await admin.rpc("upsert_message_thread", {
        p_source: "instagram", p_sender_id: igsid, p_sender_name: null, p_sender_avatar: null,
        p_student_id: null, p_last_message_at: now, p_direction: "outgoing",
      });
      await admin.from("messages").insert({
        source: "instagram", external_id: mid, sender_id: igsid, sender_name: account.username ? `@${account.username}` : "Instagram",
        content: text, message_type: "text", direction: "outgoing", status: "read",
        replied_by: caller.userId, replied_at: now, created_at: now,
        metadata: { igsid, mid, sent_via: "crm", account_ig_id: account.ig_user_id },
      });
      return json({ ok: true, message_id: mid });
    }

    // ---- reply_comment: public reply under a comment ----
    if (action === "reply_comment") {
      const commentId = String(body?.comment_id ?? "").trim();
      const text = String(body?.text ?? "").trim();
      if (!commentId || !text) return json({ error: "comment_id and text are required" }, 400);

      const res = await graphPost(ver, `${commentId}/replies`, account.access_token, { message: text });
      if (!res.ok) return json({ error: graphError(res), graph: res.json }, 502);

      await admin.from("instagram_comments").update({
        status: "replied", reply_comment_id: res.json?.id ?? null, reply_text: text,
        replied_by: caller.userId, replied_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("comment_id", commentId);
      return json({ ok: true, reply_id: res.json?.id ?? null });
    }

    // ---- private_reply: DM the author of a comment (once per comment, within 7 days) ----
    if (action === "private_reply") {
      const commentId = String(body?.comment_id ?? "").trim();
      const text = String(body?.text ?? "").trim();
      if (!commentId || !text) return json({ error: "comment_id and text are required" }, 400);

      const res = await graphPost(ver, "me/messages", account.access_token, { recipient: { comment_id: commentId }, message: { text } });
      if (!res.ok) return json({ error: graphError(res), graph: res.json }, 502);

      const now = new Date().toISOString();
      await admin.from("instagram_comments").update({
        status: "private_replied", reply_text: text, replied_by: caller.userId, replied_at: now, updated_at: now,
      }).eq("comment_id", commentId);

      // Log outgoing DM against the commenter's thread if we know who they are.
      const { data: c } = await admin.from("instagram_comments").select("from_ig_id, from_username").eq("comment_id", commentId).maybeSingle();
      if (c?.from_ig_id) {
        await admin.rpc("upsert_message_thread", {
          p_source: "instagram", p_sender_id: String(c.from_ig_id),
          p_sender_name: c.from_username ? `@${c.from_username}` : null, p_sender_avatar: null,
          p_student_id: null, p_last_message_at: now, p_direction: "outgoing",
        });
        await admin.from("messages").insert({
          source: "instagram", external_id: res.json?.message_id ?? null, sender_id: String(c.from_ig_id),
          sender_name: account.username ? `@${account.username}` : "Instagram", content: text,
          message_type: "text", direction: "outgoing", status: "read",
          replied_by: caller.userId, replied_at: now, created_at: now,
          metadata: { private_reply_to_comment: commentId, sent_via: "crm", account_ig_id: account.ig_user_id },
        });
      }
      return json({ ok: true, message_id: res.json?.message_id ?? null });
    }

    // ---- hide_comment ----
    if (action === "hide_comment") {
      const commentId = String(body?.comment_id ?? "").trim();
      const hide = body?.hide !== false;
      if (!commentId) return json({ error: "comment_id is required" }, 400);

      const res = await graphPost(ver, commentId, account.access_token, { hide });
      if (!res.ok) return json({ error: graphError(res), graph: res.json }, 502);

      await admin.from("instagram_comments").update({
        status: hide ? "hidden" : "new", updated_at: new Date().toISOString(),
      }).eq("comment_id", commentId);
      return json({ ok: true, hidden: hide });
    }

    return json({ error: `Unknown action: ${action}. Valid: connect, status, send_dm, reply_comment, private_reply, hide_comment, refresh_token` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("instagram-send error:", msg);
    return json({ error: msg }, 500);
  }
});
