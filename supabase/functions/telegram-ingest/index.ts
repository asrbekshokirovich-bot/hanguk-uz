// telegram-ingest
// ----------------------------------------------------------------------------
// Ingestion endpoint for the personal-account Telegram userbot (MTProto). The
// userbot can't run in an Edge Function (it needs a persistent connection), so
// it runs off-platform and POSTs each mirrored message here. This function:
//   * resolves who the chat belongs to (identity spine; auto-links by the
//     student's known phone)
//   * upserts the thread (both directions, unread bookkeeping)
//   * stores the message, de-duplicated by a composite external id
//
// Auth: shared secret in the `x-ingest-secret` header (== TELEGRAM_INGEST_SECRET).
// Accepts a single event or a batch ({ events: [...] }) for backfill.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveIdentity } from "../_shared/identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

interface IngestEvent {
  account?: { staff_user_id?: string | null; label?: string | null };
  peer: {
    id: string | number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  };
  message: {
    id: string | number;
    text?: string | null;
    date?: number | null; // unix seconds
    out?: boolean;
    media_type?: string | null; // image | file | voice | video | ...
  };
}

const MEDIA_TO_TYPE: Record<string, string> = {
  image: "image",
  photo: "image",
  voice: "voice",
  audio: "voice",
  video: "file",
  document: "file",
  file: "file",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("TELEGRAM_INGEST_SECRET");
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const events: IngestEvent[] = Array.isArray(body?.events)
    ? body.events
    : body?.peer && body?.message
    ? [body as IngestEvent]
    : [];

  if (events.length === 0) return json({ error: "No events" }, 400);
  if (events.length > 500) return json({ error: "Batch too large (max 500)" }, 400);

  let stored = 0;
  let linked = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const ev of events) {
    try {
      const r = await ingestOne(supabase, ev);
      if (r.status === "stored") stored++;
      else skipped++;
      if (r.linked) linked++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return json({ ok: true, received: events.length, stored, skipped, linked, errors: errors.slice(0, 10) });
});

async function ingestOne(
  supabase: any,
  ev: IngestEvent,
): Promise<{ status: "stored" | "duplicate"; linked: boolean }> {
  const identifier = String(ev.peer.id);
  const username = ev.peer.username ? ev.peer.username.replace(/^@/, "") : null;
  const displayName =
    [ev.peer.first_name, ev.peer.last_name].filter(Boolean).join(" ").trim() ||
    (username ? `@${username}` : null) ||
    (ev.peer.phone ? `+${String(ev.peer.phone).replace(/^\+/, "")}` : null);
  const identifierLabel = username ? `@${username}` : ev.peer.phone ?? null;

  // Who is this? Exact telegram identity, else auto-link via known phone.
  const identity = await resolveIdentity(supabase, "telegram", identifier, {
    displayName,
    phone: ev.peer.phone ?? null,
    identifierLabel,
  });
  const linked = !!(identity.studentId || identity.leadId);

  const direction = ev.message.out ? "outgoing" : "incoming";
  const externalId = `${identifier}:${ev.message.id}`;
  const createdAt = ev.message.date
    ? new Date(ev.message.date * 1000).toISOString()
    : new Date().toISOString();

  // De-dupe: the userbot may re-send on reconnect / during backfill.
  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("source", "telegram")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existing) return { status: "duplicate", linked };

  // Thread bookkeeping (atomic; preserves a manual student link).
  const { error: threadErr } = await supabase.rpc("upsert_message_thread", {
    p_source: "telegram",
    p_sender_id: identifier,
    p_sender_name: displayName,
    p_sender_avatar: null,
    p_student_id: identity.studentId,
    p_last_message_at: createdAt,
    p_direction: direction,
  });
  if (threadErr) throw new Error(`thread upsert: ${threadErr.message}`);

  const messageType = ev.message.media_type
    ? (MEDIA_TO_TYPE[ev.message.media_type] ?? "file")
    : "text";
  const content = ev.message.text?.trim() || (ev.message.media_type ? `[${ev.message.media_type}]` : "[empty]");

  const { error: msgErr } = await supabase.from("messages").insert({
    source: "telegram",
    external_id: externalId,
    sender_id: identifier,
    sender_name: displayName,
    content,
    message_type: messageType,
    direction,
    status: direction === "incoming" ? "unread" : "read",
    student_id: identity.studentId,
    created_at: createdAt,
    metadata: {
      telegram_user_id: identifier,
      username,
      phone: ev.peer.phone ?? null,
      lead_id: identity.leadId,
      staff_label: ev.account?.label ?? null,
      staff_user_id: ev.account?.staff_user_id ?? null,
      out: !!ev.message.out,
      media_type: ev.message.media_type ?? null,
    },
  });
  if (msgErr) throw new Error(`message insert: ${msgErr.message}`);

  return { status: "stored", linked };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
