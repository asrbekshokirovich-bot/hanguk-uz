// Who signs in from Telegram, and with which HanPyol account.
//
// 1. The Telegram account was here before: its own account.
// 2. New here: the mini app first asks for the phone number. Shared, and a
//    HanPyol account (made in the phone app) has that number: that account,
//    so the person keeps their profile, puyl and jobs. Otherwise a new account
//    (with the number, when given).
// The answer is a one-time sign-in token the app trades for a session.
import { telegramEmail, type TelegramUser } from "./telegram.ts";

export interface SignInToken {
  token_hash: string;
  /** The Supabase OTP type the token is verified as. */
  type: "magiclink" | "recovery";
  /** The account (kept on the server: its Telegram notices). */
  userId?: string;
}

export class AuthError extends Error {
  constructor(readonly code: "MISMATCH" | "SERVER") {
    super(code);
  }
}

export interface Accounts {
  /** A token for this e-mail's account, or null when there is none. The
   * account must belong to [telegramId] (app_metadata) — else MISMATCH. */
  existing(email: string, telegramId: number): Promise<SignInToken | null>;
  /** The HanPyol account with this phone number (digits), if any, and its e-mail. */
  byPhone(digits: string): Promise<{ id: string; email: string } | null>;
  /** Gives an account the Telegram e-mail and id. */
  attach(userId: string, email: string, telegramId: number): Promise<void>;
  /** A new HanPyol account. */
  create(email: string, user: TelegramUser, phone: string | null): Promise<void>;
  /** A token for this e-mail's account (it exists). */
  link(email: string): Promise<SignInToken>;
}

export type SignInResult = SignInToken | { need_contact: true };

/**
 * [contact]: undefined — not asked yet; null — asked, not shared (or not the
 * person's own); a string — the number's digits.
 */
export async function signIn(accounts: Accounts, user: TelegramUser, contact: string | null | undefined): Promise<SignInResult> {
  const email = telegramEmail(user.id);
  const known = await accounts.existing(email, user.id);
  if (known) return known;
  if (contact === undefined) return { need_contact: true };
  if (contact) {
    const owner = await accounts.byPhone(contact);
    // A phone account with no e-mail is the person's own: it is joined to
    // Telegram. One that already has an e-mail (another Telegram account,
    // hanguk.uz staff) is left alone.
    if (owner && !owner.email) {
      await accounts.attach(owner.id, email, user.id);
      return await accounts.link(email);
    }
    await accounts.create(email, user, owner ? null : contact);
    return await accounts.link(email);
  }
  await accounts.create(email, user, null);
  return await accounts.link(email);
}
