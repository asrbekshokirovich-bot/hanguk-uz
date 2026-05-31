# Store-readiness P0 closure log — 2026-05-12

> Chronological closure record for the 13 P0 items in
> `docs/audits/store_readiness_audit_2026-05-12.md`. The user's
> orchestrator reads this to know what to `git add`.

Closure sweep run by Claude in the build sandbox. All 13 P0 items
are at least partially closed in code; the human-gated portions
(legal-counsel review, real screenshots, keystore generation, store-
console enrollment) are tracked in `store/SUBMISSION_CHECKLIST.md`.

---

## P0 #1 — Auto-updater (UP1, UP2, UP3, UP4)

**Decision implemented:** Compile-time `STORE_BUILD` flag. Default
false keeps the existing direct-APK distribution flow alive.

Files touched:
- `lib/core/config/build_config.dart` (new) — defines `kIsStoreBuild`
  via `bool.fromEnvironment('STORE_BUILD')`.
- `lib/main.dart` — `MaterialApp.builder` now wraps in `UpdateGate`
  only when `!kIsStoreBuild`. Removed `device_preview` imports here
  (rolled in with P0 #5).
- `lib/features/updater/data/updater_repository.dart` — imports
  `build_config.dart`; `downloadAndInstall` throws
  `UnsupportedError` immediately when `kIsStoreBuild` is true. The
  `install_plugin` import stays alive for the non-store path.
- `CURRENT_STATUS.md` — documents the two build commands.
- `store/SUBMISSION_CHECKLIST.md` — also documents them.
- `android/app/src/main/AndroidManifest.xml` — `REQUEST_INSTALL_PACKAGES`
  kept (per user direction); commented to explain that the compile-time
  flag is the primary defense and a Play-flavored manifest may strip
  it later.

Migrations: none.

Deferred to P1/P2: Play In-App Updates integration
(`com.google.android.play:app-update`) — UP5 in the audit.

---

## P0 #2 — Account deletion (A1)

**Decision implemented:** New `/account` route + Supabase RPC
`fn_delete_my_account` (SECURITY DEFINER). Confirmation via
type-DELETE-to-confirm; re-auth uses the existing session bearer
(no password re-entry because the active auth path is magic-code).

Files touched:
- `lib/features/account/presentation/account_screen.dart` (new) —
  Account screen with "Sign out", "Delete account" (confirm dialog +
  progress dialog), and legal footer.
- `lib/core/router/app_router.dart` — added `AccountRoute` at `/account`.
- `lib/core/router/app_router.g.dart` — manually wrote the matching
  `$accountRoute` mixin so build_runner doesn't need to re-run.
- `lib/features/home/presentation/home_screen.dart` — added an
  AppBar action icon (`account_circle_outlined`) on the home tab
  that `context.push('/account')`.

Migration created:
- `supabase/migrations/20260512120500_account_deletion_rpc.sql` —
  `fn_delete_my_account()` runs as SECURITY DEFINER, validates
  `auth.uid()`, deletes from `applications`, `documents`,
  `student_suggestions`, `study_plan_*`, `interview_*`, `user_roles`,
  `profiles` (handles both `user_id` and `id` ownership columns),
  `storage.objects` (owner-scoped), anonymizes the `auth.users` row
  (PII wiped + banned-until set 100y out + deleted_at). Each delete
  wrapped in `exception when undefined_table` so missing tables
  don't abort.

Deferred: cannot fully delete the auth.users row from a SECURITY
DEFINER context without bringing service_role into client scope;
anonymization + perma-ban is the conservative equivalent. Document
this in the Privacy Policy (already done in §7 of the draft).

---

## P0 #3 — Privacy Policy + Terms (P8, C2)

**Decision implemented:** Markdown drafts at `docs/legal/`; canonical
URLs in a Supabase public bucket; consent checkbox at sign-up / magic-
code login; Privacy + Terms footer on the Account screen.

Files touched:
- `docs/legal/PRIVACY_POLICY.md` (new) — full Privacy Policy draft
  with PIPA / GDPR shape; lawyer-review header marker at top.
- `docs/legal/TERMS_OF_SERVICE.md` (new) — Terms draft; lawyer-review
  header marker at top.
- `lib/core/config/app_config.dart` — added `privacyPolicyUrl` and
  `termsOfServiceUrl` constants pointing at the `legal` bucket.
- `lib/features/auth/presentation/login_screen.dart` — added
  `_legalAccepted` state, `_LegalConsentRow` widget with tappable
  Privacy / Terms links, blocked both `_handleStudentLogin` and
  `_handleSignUp` on the consent flag.
- `lib/features/account/presentation/account_screen.dart` — has a
  bottom footer with Privacy + Terms links.

Migration created:
- `supabase/migrations/20260512121000_legal_bucket.sql` — creates the
  `legal` public-read Storage bucket and sets the read / service-role-
  write policies. After applying, upload the two markdown files
  manually (or via `supabase storage cp`).

Deferred: legal counsel review (flagged in the markdown headers);
publishing the policies at `https://hanguk.uz/privacy` and `/terms` if
the team prefers their own domain over the Supabase URL.

---

## P0 #4 — Apple Privacy Manifest (P6, I1)

**Decision implemented:** `ios/Runner/PrivacyInfo.xcprivacy` with the
four Required Reason API categories and the actual `NSPrivacyCollectedDataTypes`
matching `auth_repository.dart` + `profile`/training data flows.

Files touched:
- `ios/Runner/PrivacyInfo.xcprivacy` (new). API types declared:
  - `NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1`
  - `NSPrivacyAccessedAPICategoryFileTimestamp` reason `C617.1`
  - `NSPrivacyAccessedAPICategoryDiskSpace` reason `E174.1`
  - `NSPrivacyAccessedAPICategorySystemBootTime` reason `35F9.1`
  - `NSPrivacyTracking=false`, empty tracking domains
  - `NSPrivacyCollectedDataTypes`: Email, Phone, Name, User ID,
    Audio Data, Other User Content, Photos. All linked to user, none
    used for tracking, purposes are App Functionality and Account
    Management.

Migrations: none.

Deferred: per-Pod manifest verification (Apple wants each transitive
Pod's own `PrivacyInfo.xcprivacy`). Will surface at upload time;
Flutter plugins generally ship them.

---

## P0 #5 — DevicePreview (S2)

**Decision implemented:** Removed entirely.

Files touched:
- `lib/main.dart` — removed both `DevicePreview(enabled: true, ...)`
  wrappers, removed the `device_preview` import, and dropped the
  `DevicePreview.appBuilder` / `DevicePreview.locale(context)` calls.
- `pubspec.yaml` — removed `device_preview: ^1.3.1` from `dependencies`.

Migrations: none.

---

## P0 #6 — targetSdk = 35 (AN1, AN2)

**Decision implemented:** Pinned both `compileSdk` and `targetSdk` to
35 in `android/app/build.gradle.kts` with comments.

Files touched:
- `android/app/build.gradle.kts` — replaced `flutter.compileSdkVersion`
  and `flutter.targetSdkVersion` with literal `35`.

Migrations: none.

---

## P0 #7 — Store listing assets (SL1-SL5)

**Decision implemented:** Generated directory tree + description
copy in EN/KO/UZ. User uploads screenshots themselves.

Files created:
- `store/listings/app-store/en/{description,keywords,promotional_text,whats_new}.md`
- `store/listings/app-store/ko/{description,keywords,promotional_text,whats_new}.md`
- `store/listings/play-store/en-US/{short_description,full_description}.md`
- `store/listings/play-store/ko-KR/{short_description,full_description}.md`
- `store/listings/play-store/uz/{short_description,full_description}.md`
- `store/listings/screenshots/README.md` — required sizes per
  device class and per locale.
- `store/listings/feature-graphic/README.md` — Play feature graphic
  (1024×500 PNG) brief.
- `store/listings/app-icon/README.md` — iOS (1024×1024 no alpha) +
  Play (512×512) + adaptive icon notes.

Migrations: none.

Deferred: actual screenshots, feature graphic, app icon, age-rating
questionnaire answers (SL4) — these need real-build screenshots and
human decisions. Slot in `store/SUBMISSION_CHECKLIST.md`.

---

## P0 #8 — RLS audit (S1, BE5)

**Decision implemented:** Single closure migration that
unconditionally enables RLS + adds owner-scoped policies on every
public table Flutter touches, plus read-for-authenticated policies
on reference data.

Files touched:
- `supabase/migrations/20260512122000_enable_rls_audit.sql` (new).
  Uses helper `do$$ ... $$` blocks and `exception when undefined_table`
  guards so the migration is idempotent and safe to re-apply.

Tables already had RLS in this repo's migrations folder:
- `app_version_pings` (per `20260506120100_app_version_pings_table.sql`)

Tables touched by this migration (owner-scoped policies):
- `applications`, `documents`, `student_suggestions`,
  `study_plan_sessions`, `study_plan_drafts`, `study_plan_analyses`,
  `study_plan_chat_history`, `interview_sessions`, `interview_messages`,
  `interview_feedback`, `user_roles`, `profiles`

Tables touched by this migration (reference read-only):
- `universities`, `university_rooms`, `room_channels`, `university_events`,
  `app_versions`

Tables that need server-side verification:
- `channel_messages` — RLS enabled, but no blanket policy; relies on
  pre-existing policies from the chat feature.
- `system_settings` — RLS enabled, no client policies (service-role only).
- Any table the audit didn't enumerate but that exists on the server.

Verification step (in the migration footer): run
`select tablename, rowsecurity from pg_tables where schemaname = 'public'`
against prod and confirm every row is `t`.

---

## P0 #9 — Signing keystore template (B7)

**Decision implemented:** `android/key.properties.template` already
existed in the worktree; the keystore-generation walkthrough went
into `store/SUBMISSION_CHECKLIST.md` § 2.

Files touched:
- `android/key.properties.template` — verified contents match
  the documented schema (storePassword / keyPassword / keyAlias /
  storeFile).
- `store/SUBMISSION_CHECKLIST.md` — § 2 "Keystore (Android, one-time)"
  with the `keytool` command and back-up guidance.
- `.gitignore` — already had `android/key.properties` and `**/*.jks`.

Migrations: none.

---

## P0 #10 — App Bundle (.aab) flow + R8 sanity (B1, B2, B3)

**Decision implemented:** Build commands documented, ProGuard rule
file wired into `android/app/build.gradle.kts`.

Files touched:
- `android/app/build.gradle.kts` — added
  `proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")`
  to the release buildType.
- `CURRENT_STATUS.md` and `store/SUBMISSION_CHECKLIST.md` document the
  three build commands (apk for self-host, appbundle + ipa for store).

Migrations: none.

---

## P0 #11 — ProGuard rules

**Decision implemented:** `android/app/proguard-rules.pro` populated
with conservative keep rules for everything that R8 / minification
typically breaks.

Files touched:
- `android/app/proguard-rules.pro` (new). Covers: Flutter, kotlinx
  serialization + coroutines, Supabase / gotrue, OkHttp / dio /
  okio, pointycastle, WebView JavascriptInterface bridges,
  audioplayers, install_plugin, Vapi (`com.vapi.*` and `ai.vapi.*`),
  Kakao SDK, JSON model classes, Riverpod generated providers /
  notifiers, path_provider / package_info_plus / device_info_plus
  / permission_handler / file_picker / image_picker / webview_flutter
  / url_launcher.

Migrations: none.

Deferred: real R8-warning audit on first release build. Conservative
rules mean unused-rule warnings; wrong rules mean runtime crashes.
We chose unused warnings.

---

## P0 #12 — Play Data Safety doc (P9)

**Decision implemented:** `docs/store/play-data-safety.md` worksheet
with answers to every standard Data Safety question.

Files touched:
- `docs/store/play-data-safety.md` (new). Covers: collection / sharing
  / encryption-in-transit / deletion request mechanism, every data
  type Hanguk collects (Name, Email, Phone, User ID, Photos, Audio
  Data, Other UGC, App Performance), per-type linked-to-user /
  tracking / required-vs-optional / purposes, sub-processor list
  (Supabase, Vapi, ElevenLabs, Kakao), children's data note.

Migrations: none.

---

## P0 #13 — Permission trim + iOS orientation (P2, P3, I2)

**Decision implemented:** Dropped `READ_MEDIA_VIDEO` and bounded
`READ_EXTERNAL_STORAGE` with `android:maxSdkVersion="32"`; dropped
landscape orientations on iPhone (kept all four on iPad in case iPad
is shipped later).

Files touched:
- `android/app/src/main/AndroidManifest.xml` — removed
  `READ_MEDIA_VIDEO`, added `android:maxSdkVersion="32"` to
  `READ_EXTERNAL_STORAGE`, added comments explaining the
  `REQUEST_INSTALL_PACKAGES` policy posture.
- `ios/Runner/Info.plist` — removed
  `UIInterfaceOrientationLandscapeLeft` and `LandscapeRight` from the
  iPhone `UISupportedInterfaceOrientations` array. iPad's
  `~ipad` array is left as-is.

Migrations: none.

---

## Files-touched summary (count)

- **New Dart files:** 2 — `lib/core/config/build_config.dart`,
  `lib/features/account/presentation/account_screen.dart`.
- **Modified Dart files:** 6 — `lib/main.dart`,
  `lib/features/updater/data/updater_repository.dart`,
  `lib/core/router/app_router.dart`,
  `lib/core/router/app_router.g.dart`,
  `lib/core/config/app_config.dart`,
  `lib/features/auth/presentation/login_screen.dart`,
  `lib/features/home/presentation/home_screen.dart`.
- **New SQL migrations:** 3 —
  `supabase/migrations/20260512120500_account_deletion_rpc.sql`,
  `supabase/migrations/20260512121000_legal_bucket.sql`,
  `supabase/migrations/20260512122000_enable_rls_audit.sql`.
- **New manifests / configs:** 4 —
  `ios/Runner/PrivacyInfo.xcprivacy`,
  `android/app/proguard-rules.pro`,
  `android/app/build.gradle.kts` (modified),
  `android/app/src/main/AndroidManifest.xml` (modified),
  `ios/Runner/Info.plist` (modified),
  `pubspec.yaml` (modified).
- **New docs / listings:** 17 —
  `docs/legal/PRIVACY_POLICY.md`,
  `docs/legal/TERMS_OF_SERVICE.md`,
  `docs/store/play-data-safety.md`,
  `docs/audits/store_p0_closure_log_2026-05-12.md` (this file),
  `store/SUBMISSION_CHECKLIST.md`,
  `store/listings/app-store/en/*.md` (×4),
  `store/listings/app-store/ko/*.md` (×4),
  `store/listings/play-store/en-US/*.md` (×2),
  `store/listings/play-store/ko-KR/*.md` (×2),
  `store/listings/play-store/uz/*.md` (×2),
  `store/listings/screenshots/README.md`,
  `store/listings/feature-graphic/README.md`,
  `store/listings/app-icon/README.md`.
- **Updated docs:** `CURRENT_STATUS.md` (prepended a store-readiness
  section above the existing 2026-05-07 audit).

## P1 closure pointer

The 19 P1 items (audit IDs 14-32) were swept on the same date in a
separate pass. See `docs/audits/store_p1_closure_log_2026-05-12.md`
for the full record. Of the items called out below as "bled into P1",
every one is now closed except where explicitly marked `⚠️ partial`
in the audit doc.

## What bled into P1 / P2

- **Localization** (audit P1 #14 / L1) — not started. Account screen,
  login consent strings, store-listing copy are all currently EN-only
  in code (locale-specific copy lives in `store/listings/`).
- **Crash reporting** (audit P1 #15 / Q4) — not started. The
  `SENTRY_DSN` `--dart-define` is referenced in build commands as a
  placeholder; no Sentry SDK is wired in `pubspec.yaml`.
- **Age gate at sign-up** (audit P1 #16 / C1) — not started; flagged
  as a known gap in the Privacy Policy draft (§ 8) and the Play
  Data Safety worksheet.
- **Marketing-vs-service consent split** (audit P1 #17 / C2) — single
  consent checkbox only; deferred to the deeper P1 split.
- **Phone normalization + country picker** (audit P1 #27 / A5) — out
  of scope this sweep.
- **Build flavors** (audit P1 #28 / B4) — out of scope; the
  `STORE_BUILD` compile-time flag is the chosen substitute for v1.
- **Kakao key rotation** (audit P1 #19 / S4) — out of scope; the
  keys are origin-locked so risk is limited, but they should still
  be moved to `--dart-define`.
- **Repo-root cleanup** (audit P2 #41 / H1-H3) — out of scope.
