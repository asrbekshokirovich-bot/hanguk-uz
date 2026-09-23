// Shared identity resolution for every communication channel.
//
// The "spine" is the communication_identities table: one row per
// (channel, identifier) pointing at a student or a lead. Webhooks call
// resolveIdentity() to answer "whose conversation is this?" — and, when they
// discover a new match by phone, they persist it so the link is reused next
// time (and is visible/editable by staff).
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Channel = "phone" | "telegram" | "instagram" | "whatsapp" | "email";

export interface ResolvedIdentity {
  studentId: string | null;
  leadId: string | null;
  displayName: string | null;
  confidence: "confirmed" | "inferred" | "unverified" | null;
}

type SupabaseAdmin = ReturnType<typeof createClient>;

/**
 * Canonicalise a phone number. MUST stay in lock-step with the SQL
 * normalize_phone() function so a number keyed in TypeScript and a number
 * keyed in Postgres resolve to the same identity row. Uzbek-first.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let n = phone.replace(/\D/g, "");
  if (!n) return null;
  if (n.startsWith("998")) {
    n = "+" + n;
  } else if (n.startsWith("9") && n.length === 9) {
    n = "+998" + n;
  }
  return n;
}

/**
 * Pull a phone number a customer typed into a free-text message, e.g. an
 * Instagram DM. MUST stay in lock-step with the SQL extract_uz_phone()
 * function (supabase/migrations/20260922120000_lead_profile.sql) — both
 * exist so the same "did they type a number?" check can run in a webhook,
 * at the moment a message arrives, and in a periodic SQL sweep over history.
 * A false-positive extraction (a date, a price) is harmless here: it is
 * only ever used to look an EXISTING lead up by exact phone, never to
 * create or overwrite one, so a bogus digit string just fails to match.
 */
export function extractPhoneFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  const m = digits.match(/(?:998)?((?:9[0-9]|88|77|33|20)\d{7})/);
  return m ? m[1] : null;
}

/**
 * Pull an @handle a customer typed into free text — e.g. "telegramim
 * @asilbek123" inside an Instagram DM. Telegram usernames are 5–32 chars,
 * start with a letter; this is deliberately strict (must start with @) so
 * it does not snag an unrelated word. Returns the handle WITHOUT the @.
 */
export function extractHandleFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/@([A-Za-z][A-Za-z0-9_]{3,31})\b/);
  return m ? m[1] : null;
}

const EMPTY: ResolvedIdentity = {
  studentId: null,
  leadId: null,
  displayName: null,
  confidence: null,
};

/**
 * Resolve a (channel, identifier) to a student/lead.
 *
 * 1. Exact hit in communication_identities — the authoritative map, including
 *    anything staff attached by hand.
 * 2. For phone numbers only: fall back to matching profiles/leads directly and,
 *    on a hit, persist a new identity row so future lookups are O(1) and the
 *    link surfaces in the UI.
 */
export async function resolveIdentity(
  supabaseAdmin: SupabaseAdmin,
  channel: Channel,
  rawIdentifier: string | null | undefined,
  opts: { displayName?: string | null; phone?: string | null; identifierLabel?: string | null } = {},
): Promise<ResolvedIdentity> {
  if (!rawIdentifier) return EMPTY;

  const identifier = channel === "phone"
    ? normalizePhone(rawIdentifier)
    : String(rawIdentifier).trim();
  if (!identifier) return EMPTY;

  // 1. Authoritative map.
  const { data: existing } = await supabaseAdmin
    .from("communication_identities")
    .select("student_id, lead_id, display_name, confidence")
    .eq("channel", channel)
    .eq("identifier", identifier)
    .maybeSingle();

  if (existing) {
    return {
      studentId: (existing as any).student_id ?? null,
      leadId: (existing as any).lead_id ?? null,
      displayName: (existing as any).display_name ?? null,
      confidence: (existing as any).confidence ?? null,
    };
  }

  // 2. Phone fallback: match a known person, then remember the mapping.
  if (channel === "phone") {
    const variants = Array.from(new Set([identifier, rawIdentifier.trim()])).filter(Boolean);
    const orFilter = variants.map((v) => `phone.eq.${v}`).join(",");
    const orFilterAdditional = variants.map((v) => `additional_phone.eq.${v}`).join(",");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .or(`${orFilter},${orFilterAdditional}`)
      .maybeSingle();

    if (profile) {
      await upsertIdentity(supabaseAdmin, {
        channel,
        identifier,
        identifier_label: rawIdentifier.trim(),
        student_id: (profile as any).user_id,
        display_name: opts.displayName ?? (profile as any).full_name ?? null,
        confidence: "confirmed",
        source: "auto",
      });
      return {
        studentId: (profile as any).user_id,
        leadId: null,
        displayName: (profile as any).full_name ?? null,
        confidence: "confirmed",
      };
    }

    // A student can have several numbers (own, parent, …) in student_phones.
    const { data: phoneRow } = await supabaseAdmin
      .from("student_phones")
      .select("student_id, profiles!inner(full_name)")
      .eq("phone_norm", identifier)
      .maybeSingle();

    if (phoneRow) {
      const fullName = (phoneRow as any).profiles?.full_name ?? null;
      await upsertIdentity(supabaseAdmin, {
        channel,
        identifier,
        identifier_label: rawIdentifier.trim(),
        student_id: (phoneRow as any).student_id,
        display_name: opts.displayName ?? fullName,
        confidence: "confirmed",
        source: "auto",
      });
      return {
        studentId: (phoneRow as any).student_id,
        leadId: null,
        displayName: fullName,
        confidence: "confirmed",
      };
    }

    // Also check student_contacts (phone/whatsapp contacts added by staff).
    const scVariants = Array.from(new Set([identifier, rawIdentifier.trim()])).filter(Boolean);
    const scOrFilter = scVariants.map((v) => `value.eq.${v}`).join(",");
    const { data: scRow } = await supabaseAdmin
      .from("student_contacts")
      .select("student_id, label, owner, profiles!inner(full_name)")
      .in("type", ["phone", "whatsapp"])
      .or(scOrFilter)
      .maybeSingle();

    if (scRow) {
      const fullName = (scRow as any).profiles?.full_name ?? null;
      const ownerLabel = (scRow as any).owner === "parent"
        ? ((scRow as any).label || "Ota-ona")
        : (scRow as any).label || null;
      const display = ownerLabel ? `${ownerLabel} — ${fullName}` : fullName;
      await upsertIdentity(supabaseAdmin, {
        channel,
        identifier,
        identifier_label: ownerLabel,
        student_id: (scRow as any).student_id,
        display_name: opts.displayName ?? display,
        confidence: "confirmed",
        source: "staff",
      });
      return {
        studentId: (scRow as any).student_id,
        leadId: null,
        displayName: display,
        confidence: "confirmed",
      };
    }

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, full_name")
      .or(orFilter)
      .maybeSingle();

    if (lead) {
      await upsertIdentity(supabaseAdmin, {
        channel,
        identifier,
        identifier_label: rawIdentifier.trim(),
        lead_id: (lead as any).id,
        display_name: opts.displayName ?? (lead as any).full_name ?? null,
        confidence: "inferred",
        source: "auto",
      });
      return {
        studentId: null,
        leadId: (lead as any).id,
        displayName: (lead as any).full_name ?? null,
        confidence: "inferred",
      };
    }
  }

  // 3. Cross-channel link: a Telegram/Instagram contact whose phone we already
  //    know belongs to a student/lead. Resolve via the phone, then remember the
  //    channel→person mapping so future messages link with no lookup.
  if (channel !== "phone" && opts.phone) {
    const viaPhone = await resolveIdentity(supabaseAdmin, "phone", opts.phone, {
      displayName: opts.displayName,
    });
    if (viaPhone.studentId || viaPhone.leadId) {
      await upsertIdentity(supabaseAdmin, {
        channel,
        identifier,
        identifier_label: opts.identifierLabel ?? null,
        student_id: viaPhone.studentId,
        lead_id: viaPhone.leadId,
        display_name: opts.displayName ?? viaPhone.displayName ?? null,
        confidence: viaPhone.confidence ?? "inferred",
        source: "auto",
      });
      return viaPhone;
    }
  }

  return EMPTY;
}

/**
 * Cross-channel link via a handle the customer volunteered for ANOTHER
 * channel — e.g. "telegramim @asilbek123" typed into an Instagram DM.
 * Symmetric with the phone-based cross-channel step above, but keyed on
 * identifier_label instead of a phone: only ever attaches to a person we
 * already have a real identity for (one created from an actual message on
 * that other channel), never creates one. A handle that matches nothing
 * yet — the customer hasn't written to that channel through us before —
 * is not remembered anywhere; the link forms the day they do.
 */
export async function resolveByHandle(
  supabaseAdmin: SupabaseAdmin,
  otherChannel: Channel,
  handle: string,
): Promise<ResolvedIdentity> {
  const { data } = await supabaseAdmin
    .from("communication_identities")
    .select("student_id, lead_id, display_name, confidence")
    .eq("channel", otherChannel)
    .ilike("identifier_label", `@${handle}`)
    .maybeSingle();
  if (!data) return EMPTY;
  return {
    studentId: (data as any).student_id ?? null,
    leadId: (data as any).lead_id ?? null,
    displayName: (data as any).display_name ?? null,
    confidence: (data as any).confidence ?? null,
  };
}

/**
 * Resolve, and when nobody is on the other end, create the lead ourselves.
 *
 * resolveIdentity() answers "who is this?" and returns nothing when the answer
 * is "we have never seen them". For a channel that carries no phone number
 * that is the answer for *everybody*: Instagram gave us 226 conversations and
 * zero links, because an IGSID matches no profile, no student_phones row and
 * no lead, and there was nothing else to try.
 *
 * A person who writes to the school is a lead whether or not they typed a
 * phone number, so this creates one. The lead is keyed on (source, source_id)
 * — the same key telegram-webhook's upsertLead uses — so a second message from
 * the same account finds the existing lead instead of making another, and the
 * identity row makes every later lookup a single indexed read.
 *
 * The link is recorded as `unverified`: we know this account wrote to us, we
 * do not know that the human behind it is who the display name claims. Staff
 * confirming it through the CRM overwrites that with `confirmed`.
 */
export async function ensureIdentity(
  supabaseAdmin: SupabaseAdmin,
  channel: Channel,
  rawIdentifier: string | null | undefined,
  opts: {
    displayName?: string | null;
    phone?: string | null;
    identifierLabel?: string | null;
    /** A handle the customer gave us for ANOTHER channel in this same
     *  message, e.g. { channel: "telegram", handle: "asilbek123" }. Tried
     *  after the phone, before giving up and creating a new lead. */
    crossHandle?: { channel: Channel; handle: string } | null;
    /** Extra columns for the lead, e.g. { contact_channel: "instagram" }. */
    leadFields?: Record<string, unknown>;
  } = {},
): Promise<ResolvedIdentity> {
  const resolved = await resolveIdentity(supabaseAdmin, channel, rawIdentifier, opts);
  if (resolved.studentId || resolved.leadId) return resolved;
  if (!rawIdentifier) return EMPTY;

  const identifier = channel === "phone"
    ? normalizePhone(rawIdentifier)
    : String(rawIdentifier).trim();
  if (!identifier) return EMPTY;

  const displayName = opts.displayName?.trim() || opts.identifierLabel?.trim() ||
    `${channel} ${identifier.slice(-6)}`;

  // A handle for another channel, typed right into this message, beats
  // creating a brand-new lead exactly the way a typed phone does.
  if (opts.crossHandle) {
    const viaHandle = await resolveByHandle(supabaseAdmin, opts.crossHandle.channel, opts.crossHandle.handle);
    if (viaHandle.studentId || viaHandle.leadId) {
      await upsertIdentity(supabaseAdmin, {
        channel,
        identifier,
        identifier_label: opts.identifierLabel ?? null,
        student_id: viaHandle.studentId,
        lead_id: viaHandle.leadId,
        display_name: opts.displayName ?? viaHandle.displayName ?? null,
        confidence: viaHandle.confidence ?? "inferred",
        source: "auto",
      });
      return viaHandle;
    }
  }

  // Reuse a lead this account already created (the identity row may be missing
  // even when the lead is not — e.g. rows written before this function existed).
  const { data: existingLead } = await supabaseAdmin
    .from("leads")
    .select("id, full_name")
    .eq("source", channel)
    .eq("source_id", identifier)
    .maybeSingle();

  let leadId = (existingLead as any)?.id ?? null;

  if (!leadId) {
    const { data: created, error } = await supabaseAdmin
      .from("leads")
      .insert({
        full_name: displayName,
        source: channel,
        source_id: identifier,
        status: "new",
        ...(opts.phone ? { phone: normalizePhone(opts.phone) } : {}),
        ...(opts.leadFields ?? {}),
      })
      .select("id")
      .single();

    if (error || !created) {
      console.error("ensureIdentity: lead insert failed:", error?.message);
      return EMPTY;
    }
    leadId = (created as any).id;
  }

  await upsertIdentity(supabaseAdmin, {
    channel,
    identifier,
    identifier_label: opts.identifierLabel ?? null,
    lead_id: leadId,
    display_name: displayName,
    confidence: "unverified",
    source: "auto",
  });

  return { studentId: null, leadId, displayName, confidence: "unverified" };
}

/** Insert-or-ignore an identity mapping (unique on channel+identifier). */
async function upsertIdentity(
  supabaseAdmin: SupabaseAdmin,
  row: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("communication_identities")
    .upsert(row, { onConflict: "channel,identifier", ignoreDuplicates: true });
  if (error) {
    console.error("upsertIdentity failed:", error.message);
  }
}
