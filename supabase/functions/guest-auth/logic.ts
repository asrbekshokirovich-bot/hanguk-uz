// Guest sign-up and sign-in for the site's "Ro'yxatdan o'tish" form.
//
// The form makes a lead (name, phone, email) and a password to come back with.
// Until 2026-11-12 it did not ask for a phone number: 16 people registered and
// nobody could call them — a lead with no number is not even shown to the
// operators (leads.qualified). With a number the lead is a "Yangi lid", timed
// like a request from the app (index.ts).
//
// The
// password used to be written into leads.password exactly as it was typed, and
// `select *` on leads sent it to every CRM browser. It is now a bcrypt hash in
// lead_credentials, a table only server code can read (migration
// 20261112090000_guest_credentials.sql); this function never holds anything
// but what was just typed.
//
// The database work is behind GuestDb so the rules can be tested without one.

export interface GuestLead {
  id: string;
  full_name: string | null;
  email: string | null;
  /** The legacy plaintext column — only ever read to move it out. */
  password?: string | null;
  login_count?: number | null;
  login_history?: string[] | null;
}

export type PasswordCheck = "ok" | "wrong" | "locked" | "none" | "missing";

export interface GuestDb {
  findLeadByEmail(email: string): Promise<GuestLead | null>;
  /** `phone`: as the CRM keeps it ("+998901234567"), or null from a browser that still has the old form. */
  insertLead(row: { full_name: string; email: string; phone: string | null; now: string }): Promise<GuestLead>;
  /** Stores the hash. "missing": the migration is not applied yet. */
  setPassword(leadId: string, password: string): Promise<"ok" | "missing">;
  checkPassword(leadId: string, password: string): Promise<PasswordCheck>;
  /** Writes (or clears, with null) the legacy plaintext column. */
  setLegacyPassword(leadId: string, password: string | null): Promise<void>;
  recordLogin(leadId: string, count: number, history: string[], now: string): Promise<void>;
}

export interface GuestReply {
  status: number;
  body: Record<string, unknown>;
}

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_PASSWORD = 200;

export const normalizeEmail = (email: unknown): string =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

/**
 * The number a visitor typed, as the CRM keeps it: "+998XXXXXXXXX" for an
 * Uzbek number however it was written (90 123 45 67, 8 90 123 45 67,
 * 998901234567), "+<digits>" for a number typed with another country's code.
 * null: not a phone number, or one that cannot be told apart without its
 * country code. Kept in step with src/lib/visitorPhone.ts.
 */
export function normalizeGuestPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const typed = raw.trim();
  const digits = typed.replace(/\D/g, "");
  if (typed.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 10 && digits.startsWith("8")) return `+998${digits.slice(1)}`;
  if (digits.length === 12 && (digits.startsWith("998") || digits.startsWith("996"))) return `+${digits}`;
  return null;
}

/** What the browser gets back: who they are, nothing the CRM keeps about them. */
export const publicLead = (lead: GuestLead) => ({
  id: lead.id,
  full_name: lead.full_name,
  email: lead.email,
});

const fail = (code: string, message: string, status = 200): GuestReply => ({
  status,
  body: { success: false, code, message },
});

export async function handleGuestAuth(
  db: GuestDb,
  input: { action?: unknown; email?: unknown; password?: unknown; fullName?: unknown; phone?: unknown },
  now: string,
): Promise<GuestReply> {
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  if (!email || !password) {
    return fail("MISSING_FIELDS", "Email and password are required", 400);
  }
  if (email.length > MAX_EMAIL || password.length > MAX_PASSWORD || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("INVALID_FIELDS", "Email or password is not valid", 400);
  }

  if (input.action === "signup") {
    const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
    if (!fullName) return fail("MISSING_NAME", "Full name is required", 400);
    if (fullName.length > MAX_NAME) return fail("INVALID_FIELDS", "Full name is too long", 400);

    // The form asks for a number; a page loaded before it did sends none and
    // is still let through. A number that was typed has to be one.
    const typedPhone = typeof input.phone === "string" ? input.phone.trim() : "";
    const phone = typedPhone ? normalizeGuestPhone(typedPhone) : null;
    if (typedPhone && !phone) return fail("INVALID_PHONE", "Phone number is not valid", 400);

    if (await db.findLeadByEmail(email)) {
      return fail("EMAIL_EXISTS", "Bu email allaqachon ro'yxatdan o'tgan.");
    }
    const created = await db.insertLead({ full_name: fullName, email, phone, now });
    if ((await db.setPassword(created.id, password)) === "missing") {
      // Before the migration: the only place there is.
      await db.setLegacyPassword(created.id, password);
    }
    return { status: 200, body: { success: true, lead: publicLead(created) } };
  }

  // Sign in.
  const lead = await db.findLeadByEmail(email);
  if (!lead) return fail("EMAIL_NOT_FOUND", "Email not found");

  let check = await db.checkPassword(lead.id, password);
  if (check === "locked") {
    return fail("TOO_MANY_ATTEMPTS", "Too many attempts. Try again later.");
  }
  if (check === "none" || check === "missing") {
    // An account from before the hashes: compare with what was typed then,
    // and on a match move it out of the leads table for good.
    const legacy = typeof lead.password === "string" ? lead.password : "";
    if (legacy !== "" && legacy === password) {
      if (check === "none" && (await db.setPassword(lead.id, password)) === "ok") {
        await db.setLegacyPassword(lead.id, null);
      }
      check = "ok";
    } else {
      check = "wrong";
    }
  }
  if (check !== "ok") return fail("INVALID_PASSWORD", "Invalid email or password");

  const count = (lead.login_count || 0) + 1;
  const history = [now, ...(lead.login_history || [])].slice(0, 20);
  await db.recordLogin(lead.id, count, history, now);
  return { status: 200, body: { success: true, lead: publicLead(lead) } };
}
