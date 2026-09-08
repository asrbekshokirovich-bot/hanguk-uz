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
