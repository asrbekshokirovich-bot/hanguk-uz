# Store-readiness P1 closure log — 2026-05-12

> Chronological closure record for the 19 P1 items (14-32) in
> `docs/audits/store_readiness_audit_2026-05-12.md`. Companion to
> `store_p0_closure_log_2026-05-12.md`. The orchestrator reads this to
> know what to `git add`.

Closure sweep run in the build sandbox. Every item is closed in code;
the human-gated portions (DNS records, Kakao key rotation, Sentry DSN
provisioning, deploying the Edge Function) are tracked in
`store/SUBMISSION_CHECKLIST.md`'s "USER ACTIONS appendix".

---

## P1 #14 — Localization restore (L1-L6)

**Decision implemented:** Copied the training-pass ARB + generated
localization files from `.claude/worktrees/vigorous-haibt-f28e2d/lib/l10n`
into `lib/l10n/` on main and wired them into `MaterialApp.router`.

Files touched:

- `lib/l10n/app_{en,ko,uz,ru,vi}.arb` (new) — ARB sources.
- `lib/l10n/app_localizations.dart` + `app_localizations_{en,ko,uz,ru,vi}.dart`
  (new) — generated outputs copied directly so the build doesn't need
  to re-run `flutter gen-l10n` before first compile.
- `l10n.yaml` (new) — `arb-dir`, `template-arb-file`,
  `output-localization-file` so the next `flutter pub get`/`gen-l10n`
  re-generates cleanly.
- `pubspec.yaml` — added `flutter_localizations` and `flutter:\n
  generate: true`.
- `lib/main.dart` — added `AppLocalizations.delegate`,
  `GlobalMaterialLocalizations.delegate`,
  `GlobalWidgetsLocalizations.delegate`,
  `GlobalCupertinoLocalizations.delegate` to `localizationsDelegates`
  and `AppLocalizations.supportedLocales` to `supportedLocales`.

Migrations: none.

Deferred: full ko/uz translation of every user-facing string. The
ARB contains the training-tab + walkaround strings plus a starter set;
expanding coverage to every screen is L4 in the audit and remains a
v1.1 task.

---

## P1 #15 — Crash reporting via Sentry (Q4)

**Decision implemented:** `sentry_flutter` SDK pinned at `^8.0.0`;
`SentryFlutter.init(...)` wraps `runApp` in `lib/main.dart`. DSN read
from `--dart-define=SENTRY_DSN`. Empty DSN → SDK runs but never sends.

Files touched:

- `pubspec.yaml` — added `sentry_flutter: ^8.0.0`.
- `lib/main.dart` — `SentryFlutter.init` block with `tracesSampleRate
  = 0.1`, `attachStacktrace = true`, `enableAutoNativeBreadcrumbs =
  true`, `sendDefaultPii = false`.
- `store/SUBMISSION_CHECKLIST.md` — USER ACTIONS appendix documents
  DSN setup.

Migrations: none.

---

## P1 #16 — Age gate at sign-up (C1)

**Decision implemented:** DOB picker on sign-up; under-14 blocked
client-side with a clear message; 14-18 must tick a parental-consent
checkbox AND supply a parent's email. Server-side trigger
`trg_profiles_enforce_min_age` prevents bypass.

Files touched:

- `lib/features/auth/presentation/login_screen.dart` — `SignUpFields`
  widget (public, currently parked behind the "Coming Soon"
  maintenance banner) handles DOB picker, age computation, parental-
  consent block, and the under-14 hard stop.
- `supabase/migrations/20260512123000_profile_age_consent_fields.sql`
  (new) — adds `profiles.dob date`, `parental_consent boolean default
  false`, `parental_email text`. Defines
  `public.fn_enforce_min_age()` and attaches it as a row-level
  trigger.

Migrations: 1.

Notes: the public sign-up portal is currently in maintenance mode
(`_buildPublicAuthPortal` shows "Coming Soon"). `SignUpFields` is
already wired with all consent + age fields so re-enabling sign-up is
a one-line swap. The magic-code login path doesn't ask for DOB
because counsellor-provisioned accounts already have age recorded in
the CRM; the trigger still enforces the floor on any profile write.

---

## P1 #17 — Marketing-vs-service consent split (C2)

**Decision implemented:** Two independent checkboxes on every consent
surface — `_LegalConsentRow` (required, blocks submit) and
`_MarketingConsentRow` (optional, defaults OFF). Both magic-code
login and the parked sign-up form show the marketing toggle.

Files touched:

- `lib/features/auth/presentation/login_screen.dart` — split widget
  hierarchy. The marketing flag is persisted via
  `_persistMarketingConsent()` on login success / sign-up; failures
  are best-effort and don't block auth.
- `supabase/migrations/20260512123000_profile_age_consent_fields.sql`
  — adds `profiles.marketing_consent boolean default false` and
  `marketing_consent_at timestamptz`.

Migrations: same migration as #16.

---

## P1 #18 — Android backup config (AN9)

**Decision implemented:** XML rule files in both the legacy and
Android-12+ formats; manifest references both.

Files touched:

- `android/app/src/main/res/xml/backup_rules.xml` (new) — `full-backup-
  content` with `sharedpref/database/file:flutter_secure_storage`
  excluded.
- `android/app/src/main/res/xml/data_extraction_rules.xml` (new) —
  same exclusions split into `<cloud-backup>` and `<device-transfer>`
  branches.
- `android/app/src/main/AndroidManifest.xml` — added
  `android:fullBackupContent="@xml/backup_rules"` and
  `android:dataExtractionRules="@xml/data_extraction_rules"`.

Migrations: none.

---

## P1 #19 — Kakao key rotation / move to dart-define (S4)

**Decision implemented:** Both Kakao keys removed from source.

Files touched:

- `lib/core/config/app_config.dart` — added
  `static const kakaoJsKey = String.fromEnvironment('KAKAO_JS_KEY',
  defaultValue: '')`.
- `lib/features/map/presentation/widgets/university_map_html.dart` —
  reads `AppConfig.kakaoJsKey`; empty key short-circuits to the
  Leaflet/OSM fallback (the map tab still works in dev / unprovisioned
  builds).
- `lib/features/map/presentation/widgets/roadview_html.dart` —
  reads `AppConfig.kakaoJsKey`; empty key returns a friendly "service
  unavailable" HTML payload.
- `android/app/src/main/AndroidManifest.xml` — `com.kakao.sdk.AppKey`
  value changed from the literal to `${KAKAO_NATIVE_KEY}` manifest
  placeholder.
- `android/app/build.gradle.kts` — `defaultConfig.manifestPlaceholders["KAKAO_NATIVE_KEY"] = System.getenv("KAKAO_NATIVE_KEY") ?: ""`.
- `store/SUBMISSION_CHECKLIST.md` — USER ACTIONS appendix walks
  through rotating both keys via the Kakao Developers console.

Migrations: none.

USER ACTION REQUIRED: rotate keys on Kakao Developers console; the
old values were public in git history.

---

## P1 #20 — WebView origin allowlist (S5)

**Decision implemented:** `NavigationDelegate.onNavigationRequest`
allowlist on both campus-map and roadview WebView controllers.

Files touched:

- `lib/features/map/presentation/widgets/map_view/map_mobile.dart` —
  `_allowedMapHosts` (dapi.kakao.com, map.kakao.com, t1.daumcdn.net,
  dmaps.daum.net, hanguk.uz, unpkg.com, tile.openstreetmap.org); the
  Leaflet fallback needs the OSM hosts so we include them. `about:`
  and `data:` schemes pass.
- `lib/features/map/presentation/widgets/university_roadview_screen.dart`
  — allowlist for `dapi.kakao.com, map.kakao.com, t1.daumcdn.net,
  dmaps.daum.net, hanguk.uz`.

Both controllers `debugPrint` the blocked URL in debug mode for
diagnostics.

Migrations: none.

---

## P1 #21 — print → debugPrint (Q2)

**Decision implemented:** Six production-source `print(` calls
swapped for `debugPrint(`. Test files were out of scope per the
audit.

Files touched:

- `lib/util/web_js_helper_impl.dart` — also added
  `package:flutter/foundation.dart` import; removed a duplicate
  `import 'dart:js' show allowInterop;`.
- `lib/features/training/presentation/widgets/interview_active_view.dart`
  — three sites (`[TEST RESULT]`, `[VAPI] Call ended`, `[VAPI STATUS
  UPDATE]`); `material.dart` re-exports `debugPrint` so no extra
  import needed.
- `lib/features/training/data/study_plan_repository.dart` — three
  sites; added explicit `package:flutter/foundation.dart` import.

Migrations: none.

---

## P1 #22 — DevicePreview `applicationName` (Q7)

**Closed by prior work.** Removed entirely in P0 #5.

---

## P1 #23 — ProGuard rules (B1)

**Closed by prior work.** Already shipped in P0 #11. Verified
`android/app/proguard-rules.pro` is referenced by the release
buildType in `android/app/build.gradle.kts`.

---

## P1 #24 — CI: flutter analyze + flutter test (H4)

**Decision implemented:** Minimal GitHub Actions workflow on `pull_
request` + `push to main`. `flutter build` deliberately skipped (no
keystore in CI, build is ~10 min).

Files touched:

- `.github/workflows/ci.yml` (new) — `subosito/flutter-action@v2`,
  cache `~/.pub-cache`, run `flutter pub get`, `flutter analyze`,
  `flutter test`.

Migrations: none.

Deferred: release-build jobs, signed-AAB upload to Play, Fastlane lane
for App Store Connect. All require secrets to be provisioned first;
the USER ACTIONS appendix lists which.

---

## P1 #25 — Empty-state copy + onboarding tour (FR1, FR2)

**Partial close.** Empty-state widgets shipped for the three
highest-leverage surfaces. Full first-launch onboarding tour
deferred.

Files touched:

- `lib/design_system/adaptive/empty_state.dart` (new) — reusable
  icon + headline + subhead + optional CTA layout.
- `lib/features/applications/presentation/applications_tab.dart` —
  replaces the bare "You have no active applications yet." text with
  an `EmptyState` that nudges users to the Map tab.
- `lib/features/training/presentation/study_plan_screen.dart` —
  replaces "No previous drafts found." with an `EmptyState` whose
  CTA opens the create-session dialog.
- `lib/features/training/presentation/widgets/interview_history_view.dart`
  — replaces the inline placeholder with an `EmptyState` that
  navigates back to the Training tab.

Deferred: a first-launch product tour (FR2) and empty-states for the
Documents tab and any modal-internal lists (FR1 partial). Tracked
under "launch-blocker review" per the audit's scope-down note.

Migrations: none.

---

## P1 #26 — Magic-code resend (A7)

**Decision implemented:** "Didn't get the code? Resend" button on the
magic-code portal with a 30-second cooldown. Hanguk's "password
recovery" semantics are different from a typical email/password app:
the magic code is long-lived and provisioned by a counsellor, so
"resend" actually means "ping your counsellor" — the success message
explains this.

Files touched:

- `lib/features/auth/presentation/login_screen.dart` —
  `_resendMagicCode()` + `_tickCooldown()`; UI button below the
  magic-code submit.

Migrations: none.

Notes: if password-based sign-in is ever brought online (it's parked
behind the maintenance banner), a `supabase.auth.resetPasswordForEmail`
path will need to be added at the same time.

---

## P1 #27 — Phone normalization with country picker (A5)

**Decision implemented:** Country dropdown defaulting to Uzbekistan
(+998) on both sign-in and sign-up flows. Stored values are E.164.

Files touched:

- `lib/features/auth/presentation/login_screen.dart` —
  `_PhoneCountry` / `_PhoneCountries` (UZ, KR, US, RU, VN); the
  sign-in and sign-up flows both call `country.normalize(rawDigits)`
  before hitting the server.

Migrations: none.

Notes: hand-rolled a minimal list rather than pulling in
`intl_phone_field` to keep the dependency footprint small. Expanding
the list is one-line per country.

---

## P1 #28 — Build flavors (B4)

**Deferred (documented).** The compile-time `STORE_BUILD` flag
(introduced in P0 #1) plus `--dart-define` for Supabase URL/anonKey
covers the staging-vs-prod split for v1. Full Android product
flavors / iOS schemes are a post-launch refactor.

Files touched: documentation note added to
`docs/audits/store_readiness_audit_2026-05-12.md` P1 list.

Migrations: none.

---

## P1 #29 — Email deliverability (BE4)

**Code-side closed; human DNS action required.**

Files touched:

- `store/SUBMISSION_CHECKLIST.md` — USER ACTIONS appendix has the
  exact SPF / DKIM / DMARC records to publish on `hanguk.uz`.

Migrations: none.

---

## P1 #30 — Mic permission rationale (P4, FR3)

**Decision implemented:** AlertDialog explains mic use BEFORE the OS
prompt fires; if the user has permanently denied, a follow-up dialog
offers `openAppSettings()`.

Files touched:

- `lib/features/training/presentation/training_tab.dart` —
  `_showMicRationale(BuildContext)` and
  `_showMicPermanentlyDenied(BuildContext)` helpers, plus the call
  site in the Start Interview button gated on
  `Permission.microphone.isPermanentlyDenied`.

Migrations: none.

---

## P1 #31 — Data-export Edge Function (A2, C3)

**Decision implemented:** New `supabase/functions/export-my-data/` +
"Download my data" button on the Account screen.

Files touched:

- `supabase/functions/export-my-data/index.ts` (new) — Deno function
  that takes the caller's bearer token, derives `auth.uid()` via
  `client.auth.getUser()`, and `select *`s every public table that
  carries user-owned rows. Returns a single JSON blob.
- `lib/features/account/presentation/account_screen.dart` —
  `_exportMyData()` invokes the function, writes the response to a
  timestamped file in `getApplicationDocumentsDirectory()`, and hands
  it to `Share.shareXFiles`.
- `pubspec.yaml` — `share_plus: ^10.0.0` added.
- `store/SUBMISSION_CHECKLIST.md` — USER ACTIONS appendix shows the
  `supabase functions deploy export-my-data` command.

Migrations: none. (The function relies on the existing RLS posture
from P0 #8.)

---

## P1 #32 — Tighten vapi constraint (H6)

**Decision implemented:** `vapi: any` → `vapi: 0.1.0` (matches
`packages/vapi/pubspec.yaml`'s declared version).

Files touched:

- `pubspec.yaml`.

Migrations: none.

---

## Files-touched summary

- **New Dart files:** 3 — `lib/design_system/adaptive/empty_state.dart`,
  `lib/l10n/app_localizations*.dart` (6 files but they're generated /
  copies).
- **Modified Dart files:** 11 — `lib/main.dart`,
  `lib/core/config/app_config.dart`,
  `lib/features/auth/presentation/login_screen.dart`,
  `lib/features/account/presentation/account_screen.dart`,
  `lib/features/applications/presentation/applications_tab.dart`,
  `lib/features/training/presentation/training_tab.dart`,
  `lib/features/training/presentation/study_plan_screen.dart`,
  `lib/features/training/presentation/widgets/interview_history_view.dart`,
  `lib/features/training/presentation/widgets/interview_active_view.dart`,
  `lib/features/training/data/study_plan_repository.dart`,
  `lib/util/web_js_helper_impl.dart`.
- **New SQL migrations:** 1 —
  `supabase/migrations/20260512123000_profile_age_consent_fields.sql`.
- **New Edge Functions:** 1 — `supabase/functions/export-my-data/index.ts`.
- **New / modified Android configs:** 4 — `backup_rules.xml`,
  `data_extraction_rules.xml`, `AndroidManifest.xml` (modified),
  `build.gradle.kts` (modified).
- **New WebView HTML hardening:** 3 — `university_map_html.dart`,
  `roadview_html.dart`, `map_mobile.dart`, `university_roadview_screen.dart`.
- **New ARB / l10n source:** 11 — 5 ARB + 6 generated `.dart` files
  in `lib/l10n/`.
- **New configs:** 2 — `l10n.yaml`, `.github/workflows/ci.yml`.
- **New docs:** 1 — this file. Existing docs touched:
  `store/SUBMISSION_CHECKLIST.md` (USER ACTIONS appendix added),
  `docs/audits/store_readiness_audit_2026-05-12.md` (P1 backlog
  annotated with `✅` / `⚠️`).
- **pubspec.yaml** — added `flutter_localizations`, `sentry_flutter`,
  `share_plus`; pinned `vapi: 0.1.0`; enabled `flutter: generate:
  true`.

## What bled into P2

- **Empty-state coverage** for Documents tab / interview-history
  internal modals — P1 #25 was scoped down. Will re-surface in P2 #41
  ("repo-root cleanup") or its own line if the launch-blocker review
  flags it.
- **Full ko/uz translation** of every user-facing string — L4 in the
  audit, untouched by this sweep. The wiring exists; the content
  doesn't.
- **Onboarding tour** (FR2) — not started.
- **Custom DKIM domain** on Supabase Auth — needs Supabase Pro tier;
  not gated by code.
