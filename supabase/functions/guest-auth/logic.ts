// Guest sign-up and sign-in for the site's "Ro'yxatdan o'tish" form.
//
// The form makes a lead (name + email) and a password to come back with. The
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
  insertLead(row: { full_name: string; email: string; now: string }): Promise<GuestLead>;
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
  input: { action?: unknown; email?: unknown; password?: unknown; fullName?: unknown },
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

    if (await db.findLeadByEmail(email)) {
      return fail("EMAIL_EXISTS", "Bu email allaqachon ro'yxatdan o'tgan.");
    }
    const created = await db.insertLead({ full_name: fullName, email, now });
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
