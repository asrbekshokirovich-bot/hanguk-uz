// Hanguk Ish (hanguk_ish/) shares this Supabase project. Its apps sign in by
// phone and SMS code (P54, Twilio Verify); before that with an anonymous
// account (P49). Anyone can open either with the publishable key.
// hanguk.uz's functions are not for such accounts: they spend AI credits,
// HeyGen and TURN minutes and write push tokens. Each function that lets any
// signed-in account through refuses them (P53/P54); the database keeps them
// out of hanguk.uz's tables (supabase/migrations/20261112140000_hanguk_ish_no_anonymous.sql,
// 20261112160000_hanguk_ish_phone_accounts.sql).
//
// A Hanguk Ish account is anonymous, or carries app_metadata.app =
// 'hanguk_ish' — set by the database when the account is made (any
// phone-only or anonymous sign-up, or one marked by the apps); only the
// service key can change app_metadata, so the account cannot drop it.
// hanguk.uz's own people (staff, students, guests) sign in with an e-mail and
// carry neither.

type AuthUser = {
  is_anonymous?: boolean | null;
  app_metadata?: Record<string, unknown> | null;
} | null | undefined;

/** A Hanguk Ish account (anonymous, or marked by the database): not for hanguk.uz's functions. */
export function isHangukIshAccount(user: AuthUser): boolean {
  if (!user) return false;
  return user.is_anonymous === true || user.app_metadata?.app === "hanguk_ish";
}

/** @deprecated The name from P53; it now also covers phone accounts (P54). */
export const isAnonymousAccount = isHangukIshAccount;
