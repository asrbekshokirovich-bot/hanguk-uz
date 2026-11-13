/// Where Hanguk Ish is in hanguk.uz's Supabase project (P48). Plain names,
/// so the JSON readers can use them without the Supabase client.
library;

/// The apps' tables and functions are the schema `ish`, not `public`
/// (hanguk.uz's own).
const ishSchema = 'ish';

/// Hanguk Ish's Storage buckets (hanguk.uz has an `avatars` of its own).
const ishAvatarsBucket = 'ish-avatars';
const ishBusinessesBucket = 'ish-businesses';

/// The edge function that checks a 사업자등록번호 with 국세청 and files it (BA0).
const ishBusinessRegisterFunction = 'ish-business-register';

/// The edge function that deletes the caller's own account (A11 → Yordam →
/// «Akkauntni o'chirish»; hanguk.uz/ish/delete-account).
const ishDeleteAccountFunction = 'ish-delete-account';

/// What a sign-up from these apps carries (user_metadata): hanguk.uz's
/// sign-up leaves the account alone, and Hanguk Ish makes its profile.
const ishSignUpData = {'app': 'hanguk_ish'};
