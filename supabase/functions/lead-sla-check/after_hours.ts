// The automatic reply to a new chat that arrives outside working hours
// (Mon–Sat 09:40–18:00 Tashkent) — see 20260929120000_lead_after_hours.sql.
//
// fn_after_hours_reply_claim hands out each such lead once, already stamped,
// with the text to send. The reply goes out on the channel the person wrote
// on, the way the CRM inbox sends a staff reply (send-telegram /
// send-instagram): an outgoing messages row first, so it shows in the chat,
// then the send, then the row is stamped with the Telegram / Instagram id so
// the echo coming back is not stored twice. The reply trigger recognises the
// text and does not treat it as an answer, so the lead stays in "Yangi lid".
// deno-lint-ignore-file no-explicit-any
/** The service-role client lead-sla-check already holds. */
type Admin = any;

interface Claimed {
  id: string;
  source: string;
  source_id: string;
  reply_text: string;
}

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
/** Same switch as send-telegram: replies go out as the account (userbot). */
const SEND_VIA_USERBOT = (Deno.env.get("TELEGRAM_SEND_VIA_USERBOT") ?? "").trim() === "1";
/** Same as send-telegram: a heartbeat older than this means the userbot is down. */
const USERBOT_STALE_MINUTES = 5;

export async function sendAfterHoursReplies(
  supabase: Admin,
  dry: boolean,
): Promise<{ claimed: number; sent: number; leads?: Claimed[] }> {
  const { data, error } = await supabase.rpc("fn_after_hours_reply_claim", { p_dry: dry });
  if (error) {
    console.error("lead-sla-check: after-hours claim:", error.message);
    return { claimed: 0, sent: 0 };
  }
  const leads = (data ?? []) as Claimed[];
  if (dry) return { claimed: leads.length, sent: 0, leads };

  let sent = 0;
  for (const lead of leads) {
    try {
      const ok = lead.source === "instagram"
        ? await sendInstagram(supabase, lead)
        : await sendTelegram(supabase, lead);
      if (ok) sent++;
    } catch (e) {
      console.error(`lead-sla-check: after-hours reply to lead ${lead.id} failed:`, e);
    }
  }
  if (leads.length) {
    console.log(`lead-sla-check: ${leads.length} after-hours lead(s), ${sent} reply(ies) sent`);
  }
  return { claimed: leads.length, sent };
}

/** The outgoing row the chat shows, before the send, as the CRM inbox does. */
async function insertRow(supabase: Admin, lead: Claimed): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      source: lead.source,
      sender_id: lead.source_id,
      content: lead.reply_text,
      direction: "outgoing",
      status: "replied",
      replied_at: now,
      delivery_status: "sending",
      client_msg_id: crypto.randomUUID(),
      metadata: { auto_reply: "after_hours" },
    } as any)
    .select("id")
    .single();
  if (error || !data) {
    console.error(`lead-sla-check: after-hours row for lead ${lead.id}:`, error?.message);
    return null;
  }
  return String((data as any).id);
}

async function markFailed(supabase: Admin, rowId: string | null, reason: string): Promise<void> {
  console.error(`lead-sla-check: after-hours reply failed: ${reason}`);
  if (!rowId) return;
  await supabase
    .from("messages")
    .update({ delivery_status: "failed", delivery_error: reason.slice(0, 500) })
    .eq("id", rowId)
    .is("external_id", null);
}

/** Stamp the row with the channel's message id, unless its echo got there first. */
async function stampSent(supabase: Admin, source: string, rowId: string, externalId: string): Promise<void> {
  const { data: echo } = await supabase
    .from("messages")
    .select("id")
    .eq("source", source)
    .eq("external_id", externalId)
    .maybeSingle();
  if (echo) {
    await supabase.from("messages").delete().eq("id", rowId).is("external_id", null);
    return;
  }
  const { error } = await supabase
    .from("messages")
    .update({ external_id: externalId, delivery_status: "sent", delivery_error: null })
    .eq("id", rowId);
  if (error && (error as { code?: string }).code === "23505") {
    await supabase.from("messages").delete().eq("id", rowId).is("external_id", null);
  } else if (error) {
    console.error(`lead-sla-check: could not stamp after-hours row ${rowId}:`, error.message);
  }
}

async function touchThread(supabase: Admin, lead: Claimed): Promise<void> {
  await supabase.rpc("upsert_message_thread", {
    p_source: lead.source,
    p_sender_id: lead.source_id,
    p_sender_name: null,
    p_sender_avatar: null,
    p_student_id: null,
    p_last_message_at: new Date().toISOString(),
    p_direction: "outgoing",
  });
}

/** Telegram: as the account through the userbot, else through the bot on the
 *  chat's Business connection — the same choice send-telegram makes. */
async function sendTelegram(supabase: Admin, lead: Claimed): Promise<boolean> {
  const rowId = await insertRow(supabase, lead);

  if (SEND_VIA_USERBOT) {
    const cutoff = new Date(Date.now() - USERBOT_STALE_MINUTES * 60_000).toISOString();
    const { data: live } = await supabase
      .from("telegram_userbot_status")
      .select("account_label")
      .gte("last_seen_at", cutoff)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (live) {
      const { error } = await supabase.from("telegram_outbox").insert({
        account_label: (live as any).account_label,
        chat_id: lead.source_id,
        text: lead.reply_text,
        message_id: rowId,
      });
      if (error) {
        await markFailed(supabase, rowId, error.message);
        return false;
      }
      await touchThread(supabase, lead);
      return true;
    }
    if (!TELEGRAM_BOT_TOKEN) {
      await markFailed(supabase, rowId, "Telegram userbot is not running — the reply was not sent");
      return false;
    }
  }

  if (!TELEGRAM_BOT_TOKEN) {
    await markFailed(supabase, rowId, "TELEGRAM_BOT_TOKEN is not configured");
    return false;
  }

  const { data: lastBusiness } = await supabase
    .from("messages")
    .select("metadata")
    .eq("source", "telegram")
    .eq("sender_id", lead.source_id)
    .not("metadata->>business_connection_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const connectionId = ((lastBusiness as any)?.metadata as { business_connection_id?: string } | null)
    ?.business_connection_id;

  let businessConnectionId: string | undefined;
  if (connectionId) {
    const { data: conn } = await supabase
      .from("telegram_business_connections")
      .select("is_enabled, can_reply")
      .eq("id", connectionId)
      .maybeSingle();
    if ((conn as any)?.is_enabled && (conn as any)?.can_reply) businessConnectionId = connectionId;
  }

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: lead.source_id,
      text: lead.reply_text,
      ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}),
    }),
  });
  const body = await res.json().catch(() => null) as any;
  if (!res.ok || !body?.ok) {
    await markFailed(supabase, rowId, body?.description || `Telegram API HTTP ${res.status}`);
    return false;
  }
  const sentId = body?.result?.message_id;
  if (rowId && sentId != null) await stampSent(supabase, "telegram", rowId, String(sentId));
  await touchThread(supabase, lead);
  return true;
}

/** Instagram: the connected account's Graph API send, as send-instagram does. */
async function sendInstagram(supabase: Admin, lead: Claimed): Promise<boolean> {
  const rowId = await insertRow(supabase, lead);

  const [cfgRes, accountRes] = await Promise.all([
    supabase.from("instagram_app_config").select("graph_version").eq("id", "main").maybeSingle(),
    supabase.from("instagram_accounts").select("access_token").eq("active", true).limit(1).maybeSingle(),
  ]);
  const ver = (cfgRes.data as any)?.graph_version || "v25.0";
  const token = (accountRes.data as any)?.access_token;
  if (!token) {
    await markFailed(supabase, rowId, "No Instagram account connected");
    return false;
  }

  const res = await fetch(`https://graph.instagram.com/${ver}/me/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: lead.source_id }, message: { text: lead.reply_text } }),
  });
  const body = await res.json().catch(() => null) as any;
  if (!res.ok) {
    await markFailed(supabase, rowId, body?.error?.message || `Graph API HTTP ${res.status}`);
    return false;
  }
  const mid = body?.message_id;
  if (rowId && mid) await stampSent(supabase, "instagram", rowId, String(mid));
  await touchThread(supabase, lead);
  return true;
}
