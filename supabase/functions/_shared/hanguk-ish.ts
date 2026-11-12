// Hanguk Ish (hanguk_ish/) shares this Supabase project. Its apps sign in with
// an anonymous account on the phone (P49, «Allow anonymous sign-ins»), and
// anyone can open one with the publishable key. hanguk.uz's functions are not
// for such accounts: they spend AI credits, HeyGen and TURN minutes and write
// push tokens. Each function that lets any signed-in account through refuses
// them (P53); the database keeps them out of hanguk.uz's tables
// (supabase/migrations/20261112140000_hanguk_ish_no_anonymous.sql).
// hanguk.uz's own people are never anonymous: staff, students and guests
// (guest-test-session) sign in with an e-mail or a phone number.

/** Supabase Auth's anonymous account (`is_anonymous` on the user and in its JWT). */
export function isAnonymousAccount(user: { is_anonymous?: boolean | null } | null | undefined): boolean {
  return user?.is_anonymous === true;
}
