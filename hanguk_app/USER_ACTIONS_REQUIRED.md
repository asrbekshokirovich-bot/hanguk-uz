# User actions required — store launch

Last updated 2026-05-12 (after P0 + P1 + P2 audit sweeps).

Flat tick-list of every step a human must perform to get Hanguk live on
the Apple App Store and Google Play Store. Code-side fixes are done;
this is what remains. Detailed runbooks per item are in
`store/SUBMISSION_CHECKLIST.md`. Sub-section numbers below point into
that file.

**Quick legend:** 🚨 = launch-blocker. ⚠️ = strongly recommended before launch. ⏳ = post-launch / can defer.

---

## Console enrollment & identity (1-3 days)

- [ ] 🚨 Enroll in **Apple Developer Program** — USD 99/yr. Individual or Organization (Org requires D-U-N-S number, 1-5 day wait). 2FA on the Apple ID. (SUBMISSION_CHECKLIST § 1a)
- [ ] 🚨 Enroll in **Google Play Console** — USD 25 one-time. Identity verification (gov ID + selfie), 1-3 day wait. 2FA on the Google account. (§ 1b)
- [ ] 🚨 Complete Apple App Store Connect **agreements, banking, tax** forms (required even for free apps).
- [ ] 🚨 Complete Play Console **payments profile, tax, banking** (required even for free apps).
- [ ] 🚨 Create app shells in both consoles with the bundle IDs from the repo:
      iOS `com.hanguk.studentapp.hangukApp`, Android `com.hanguk.studentapp.hanguk_app`.

## Signing & secrets (half a day)

- [ ] 🚨 Generate the upload keystore once (`keytool` command in § 2). **Back up the `.jks` plus both passwords to TWO encrypted locations** (password manager + encrypted drive). Loss = permanent lockout from Play.
- [ ] 🚨 Copy `android/key.properties.template` → `android/key.properties`, fill in the four values. (Already gitignored.)
- [ ] 🚨 Create a **Sentry** organization + project (platform: Flutter). Copy the DSN. Pass via `--dart-define=SENTRY_DSN=...` on every release build. (§ 12)
- [ ] 🚨 **Rotate both Kakao keys** (JS + Native) at <https://developers.kakao.com>. Restrict origins. Pass the new JS key via `--dart-define=KAKAO_JS_KEY=...`. (§ 14)
- [ ] ⚠️ Add SPF / DKIM / DMARC TXT records on the `hanguk.uz` DNS zone so magic-code emails don't go to spam. (§ 13)

## Backend deployment (half a day)

- [ ] 🚨 Apply the 4 new Supabase migrations to production via `supabase db push --include-all`:
      1. `20260512120000_account_deletion_rpc.sql`
      2. `20260512121000_legal_bucket.sql`
      3. `20260512122000_enable_rls_audit.sql`
      4. `20260512123000_profile_age_consent_fields.sql`
      Verify in psql afterwards: every `public.*` table has `rowsecurity = true`, and `fn_delete_my_account` exists in `pg_proc`. (§ 15)
- [ ] 🚨 Deploy the data-export Edge Function: `supabase functions deploy export-my-data`. (§ 16)
- [ ] ⚠️ Create an Apple-review test account in production Supabase (`apple-review@hanguk.uz` + long random password). Pre-populate with at least one application draft and one finished interview. Enter the credentials in App Store Connect → App Review Information. (§ 11)

## Legal review (parallel — start early)

- [ ] 🚨 **Have a lawyer review** `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md`. Replace the "DRAFT — legal review pending" markers at the top with the reviewed-and-approved date. (§ 7 step 1)
- [ ] 🚨 Upload the reviewed markdown files to the Supabase Storage `legal` bucket (Dashboard → Storage → `legal` → Upload). Confirm both public URLs load in a browser. (§ 7 steps 2-4)
- [ ] ⚠️ Optionally also host on `https://hanguk.uz/privacy` and `/terms` (rendered HTML) so reviewers don't see raw storage URLs.
- [ ] ⏳ Consider negotiating **Data Processing Agreements** with Vapi and ElevenLabs (PIPA + GDPR sub-processor obligations).

## Branding & visual assets (2-3 days)

- [ ] 🚨 Produce the **1024 × 1024 PNG** app icon (no alpha, no rounded corners) → `store/listings/app-icon/ios-1024.png`. (§ 3)
- [ ] 🚨 Produce the **512 × 512 PNG** Play icon → `store/listings/app-icon/play-512.png`.
- [ ] 🚨 Regenerate the Android launcher / adaptive icons:
      `flutter pub run flutter_launcher_icons:main`.
- [ ] 🚨 Produce the Play **feature graphic** (1024 × 500 PNG, no transparency) → `store/listings/feature-graphic/play-1024x500.png`. (§ 5)
- [ ] 🚨 Capture **5+ screenshots per locale per device class** (EN, KO, UZ × 3 iPhone sizes + 3 Android sizes ≈ 90 PNGs total). Save under `store/listings/screenshots/<store>/<device>/<locale>/`. (§ 4)
- [ ] ⏳ Run a **trademark / brand check** on the name "Hanguk" before launch (common-word app names sometimes get challenged on similarity grounds).

## Store listing content (1 day — copy already drafted)

- [ ] 🚨 Paste the drafted EN + KO copy from `store/listings/app-store/<locale>/` into App Store Connect → App Information → Description / Keywords / Promotional Text / What's New. Category: **Education** (primary), **Productivity** (secondary). (§ 6)
- [ ] 🚨 Paste the drafted EN + KO + UZ copy from `store/listings/play-store/<locale>/` into Play Console → Store presence → Main store listing. Category: **Education**. (§ 6)
- [ ] 🚨 Complete the **Apple age-rating questionnaire** (App Store Connect → App Information → Age Rating). Answers in § 9 (typically 12+; Unrestricted Web Access = YES; User-Generated Content = YES).
- [ ] 🚨 Complete the **Play content rating** questionnaire (Play Console → Policy → App content → Content rating). Answers in § 9 (typically PEGI 12 / ESRB Teen).
- [ ] 🚨 Complete the **Play Data Safety form** using `docs/store/play-data-safety.md` as the source of truth. Verify it's consistent with the declared `AndroidManifest.xml` permissions. (§ 10)
- [ ] 🚨 Enter the **Privacy Policy URL** in both App Store Connect (App Privacy → Privacy Policy URL) and Play Console (App content → Privacy policy).
- [ ] 🚨 In Play Console → App content → **Account deletion**, link to the in-app `/account` screen and provide `support@hanguk.uz` as the alternate channel.

## Translation (parallel — can defer for v1.0)

- [ ] ⚠️ Pass the `lib/l10n/app_uz.arb` and `lib/l10n/app_ko.arb` files to a Korean and Uzbek translator. Wiring landed in P1 #14; the keys still need real translations (currently English placeholders + `TODO: translate` markers).
- [ ] ⏳ Once translated, regenerate: `flutter gen-l10n`. Re-build.

## Build, upload, internal-test (1-2 days)

- [ ] 🚨 Run `flutter analyze --fatal-infos` and `flutter test` on the release commit. Both must be green. (Pre-flight in § 17)
- [ ] 🚨 Confirm `ios/Runner/PrivacyInfo.xcprivacy` is in the Xcode bundle (Build Phases → Copy Bundle Resources). (§ 8)
- [ ] 🚨 Build the **Play App Bundle** (§ 18 — note the four `--dart-define` flags + obfuscation + split-debug-info).
- [ ] 🚨 Build the **iOS IPA** (§ 18 — same flags).
- [ ] 🚨 Upload the AAB to Play Console → Internal Testing track. Add yourself + 2-3 friends as testers. (§ 19)
- [ ] 🚨 Upload the IPA via Xcode Transporter → App Store Connect → TestFlight. Add internal testers. (§ 20)
- [ ] 🚨 Walk the **22-item internal testing pass** on a real Android phone AND a real iPhone (§ 21). Every checkbox is launch-blocking.
- [ ] ⚠️ Have a Korean speaker and an Uzbek speaker review the localized strings on device.

## Submission & review (1-7 days wait)

- [ ] 🚨 Apple: App Store Connect → App Store tab → **Submit for Review**. Wait 24-48 h on average.
- [ ] 🚨 Play: promote Internal-testing release → Production track. **Submit for Review**. Wait 1-7 days (longer for first submission because of identity verification).
- [ ] ⚠️ Be ready for one rejection round on each store. Common reasons + fixes are in § 24.

## Quality items (defer post-launch unless time allows)

- [ ] ⏳ Decide on **`AppColors.error` (#DC2626) on `backgroundNavy`** — currently 4.13:1, fails WCAG AA body-text (4.5:1) but passes large-text (3:1). Either restrict usage to headlines or recolor (e.g. `#E64C4C` → ~4.7:1). (P2 #38)
- [ ] ⏳ Run **dynamic font scaling QA** at 130 % / 150 % / 200 % on a real device. Check login, home, training, account, map for clipping. (P2 #39)
- [ ] ⏳ Add **behavioural widget tests** for the 6 scaffold-deferred test files (`test/features/auth/login_screen_test.dart` and 5 others). Blocked on a thin `currentUserProvider` wrapper + a `FakeSupabaseClient` fixture under `test/_fakes/`. (P2 #50)
- [ ] ⏳ Set up **full Android product flavors** (`store` vs `selfHost`) and matching iOS schemes. The compile-time `STORE_BUILD` flag is the v1 substitute; flavors give cleaner separation. (P1 #28)
- [ ] ⏳ Run a **light penetration test** of the Supabase backend (RLS escape, JWT reuse, IDOR) before opening to the public.
- [ ] ⏳ **Performance profile** the app under throttled 3G to match a Tashkent-typical mobile network.

## Repo hygiene (5 minutes)

- [ ] ⚠️ Run the `git rm --cached -r` command in `store/SUBMISSION_CHECKLIST.md` § 24 (Repo-root cleanup) to remove scratch files from the index without deleting them on disk. The `.gitignore` already prevents them from being re-added.

## Post-launch monitoring (ongoing)

- [ ] Sentry inbox — check daily for the first week, then weekly.
- [ ] Supabase Auth logs — watch for sign-in failure spikes.
- [ ] Supabase Edge Function logs — watch `export-my-data` error rate.
- [ ] `app_version_pings` table — if > 30 % of users are stuck on the previous version after 14 days, Play In-App Updates isn't reaching them.
- [ ] Play Console → Statistics → Crash rate (ANR < 1 %).
- [ ] App Store Connect → Analytics → Crash counts.
- [ ] Respond to App Store / Play reviews within 7 days (a ranking signal on both stores).

---

## Companion files

- **Operational walkthrough** with every command: `store/SUBMISSION_CHECKLIST.md`
- **What was found and what was fixed**: `docs/audits/store_readiness_audit_2026-05-12.md` (with `✅` annotations) plus the three closure logs in `docs/audits/store_p{0,1,2}_closure_log_2026-05-12.md`
- **Legal drafts**: `docs/legal/PRIVACY_POLICY.md`, `docs/legal/TERMS_OF_SERVICE.md`
- **Data Safety form answers**: `docs/store/play-data-safety.md`
- **Store listing copy (EN/KO/UZ)**: `store/listings/`
- **Build flags reference**: `CURRENT_STATUS.md` at repo root

If a step here is unclear, point at the line and a follow-up sweep can expand it.
