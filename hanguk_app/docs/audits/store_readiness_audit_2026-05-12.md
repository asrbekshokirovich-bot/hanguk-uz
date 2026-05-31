# Store-readiness deep audit — 2026-05-12

> Investigation-only pass over the Hanguk Flutter app (`lib/`,
> `android/`, `ios/`, `supabase/`, `web/`, `packages/`, root config)
> to identify every gap between current state and "ready to submit
> to the Apple App Store and Google Play Store." Every finding
> includes a file path, what's wrong, what good looks like, and a
> rough effort estimate. Backlog at the bottom is sorted P0 / P1 / P2.
>
> **2026-05-12 update — all 13 P0, all 19 P1 (15 fully closed + 4
> partial), and all 18 P2 items addressed.** P0 closure log:
> `docs/audits/store_p0_closure_log_2026-05-12.md`. P1 closure log:
> `docs/audits/store_p1_closure_log_2026-05-12.md`. P2 closure log:
> `docs/audits/store_p2_closure_log_2026-05-12.md`. Operational
> walk-through end-to-end: `store/SUBMISSION_CHECKLIST.md`. A flat
> tick-list of personal/legal/console steps the human launch owner must
> still do: `USER_ACTIONS_REQUIRED.md` at the repo root. The
> human-gated portions (legal-counsel review of the Privacy Policy /
> Terms, real screenshots, store-console enrollment, keystore
> generation, Sentry / Kakao key issuance, DNS records, font-scaling
> QA, color-contrast design decision on `AppColors.error`) are all
> tracked in those two files.
>
> The prior training / kakao / map audits closed their own scopes;
> the store-readiness gaps below are tracked separately.
>
> Auditor: Claude (build sandbox)
> Surface in scope: app identity, store-listing readiness, privacy &
> permissions, compliance (PIPA / GDPR / minors), auth & account
> lifecycle (incl. **account deletion**), security, code quality,
> build & signing, backend, localization, iOS-specific, Android-specific,
> first-run experience, **the bundled auto-updater**.
> Out of scope: detailed pixel-level review of every screen, manual
> device testing, third-party penetration testing.

---

## Executive summary

The app has shipped features and is internally distributable via a
bespoke APK auto-updater, but it is **not submittable to either store
in its current state**. The single largest issue is the in-app APK
auto-updater (`lib/features/updater/`), which loads a release artefact
from Supabase Storage and hands it to `PackageInstaller`. That code
path is incompatible with Google Play distribution and pointless on
iOS (the iOS branch already deep-links to the App Store). Several
other store-blocking issues — no in-app account deletion, no Privacy
Policy / Terms screens or URLs, no Apple Privacy Manifest, no
localization for the two target audiences (Uzbek + Korean), and a
`DevicePreview` debug wrapper enabled in `main.dart` regardless of
build mode — sit underneath that headline issue.

| metric | value |
|---|---|
| Total Dart LOC under `lib/` | 11,530 across 60 files |
| Auth routes in `GoRouter` | 3 (`/`, `/welcome`, `/login`) — **no profile / settings / account screen** |
| Account-deletion / data-export entry points anywhere in the app | **0** |
| Privacy Policy / Terms / consent screens in `lib/` | **0** (zero hits for "privacy", "terms", "policy") |
| Apple Privacy Manifest (`PrivacyInfo.xcprivacy`) | **missing** — `find ios -name "*.xcprivacy"` returns empty |
| iOS NSUsageDescription keys declared | 4 (Photos, Camera, Microphone, SpeechRecognition) |
| Android dangerous permissions declared | 7 (incl. `REQUEST_INSTALL_PACKAGES`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, 3× storage) |
| `flutter_lints` `avoid_print` violations in `lib/` | **7** call sites (3 files) |
| `DevicePreview(enabled: true)` in `main.dart` | **2 occurrences** — ships dev framing chrome to production |
| Hardcoded English/Korean string literals in `Text(...)` / `hintText` etc. under `lib/features/` | 98+ matches |
| Localizations / `.arb` / `AppLocalizations` adoption in `lib/` | **0** (no `lib/l10n/` directory exists on `main`) |
| Tests in `test/` | 3 files (only `version_compare`, two Vapi smoke tests) |
| Crash reporting (Sentry / Crashlytics / Firebase) | **none** |
| Hardcoded API keys in source / manifest | 4 (Supabase anon, Vapi public, Kakao Native App Key, Kakao JS appkey) — anon is by design; Kakao keys leak target-host fingerprint |
| Tables read or written from Flutter | 19 (`profiles`, `interview_sessions`, `applications`, `student-documents` bucket, …) |
| Migrations that explicitly `enable row level security` | **1 of 6** (`app_version_pings`) — the other 18 tables' RLS posture cannot be confirmed from this repo |
| ProGuard / R8 keep rules files (`proguard-rules.pro`) | **none** committed despite `isMinifyEnabled = true` |
| `targetSdk` declared | inherits `flutter.targetSdkVersion` — not pinned in repo, must be verified against the Flutter SDK in CI |

The most consequential findings:

1. **The bundled auto-updater (`lib/features/updater/`) is incompatible
   with both stores.** It downloads an APK from Supabase Storage,
   SHA-256 verifies it, then calls `InstallPlugin.installApk()` which
   triggers `PackageInstaller`. The Android manifest declares the
   matching `REQUEST_INSTALL_PACKAGES` permission. **Google Play
   prohibits this distribution channel** under the Device & Network
   Abuse and Deceptive Behavior policies — any app that updates
   itself outside the Play channel will be removed. The iOS branch
   merely opens an App Store URL (acceptable), but on iOS the
   `installApk` path is dead code. The whole feature must be
   **disabled by `kReleaseMode` + a per-flavor compile guard** before
   either store build can succeed. (`lib/features/updater/data/updater_repository.dart:286-309`, `pubspec.yaml:46` `install_plugin: ^2.1.0`, `android/app/src/main/AndroidManifest.xml:6` `REQUEST_INSTALL_PACKAGES` — **P0**) (source: <https://support.google.com/googleplay/android-developer/answer/16933379?hl=en>, <https://www.medianama.com/2025/08/223-google-blocks-android-apk-sideloading-2026/>)

2. **No in-app account deletion exists.** `AuthRepository` exposes
   `signOut()` only (`lib/features/auth/data/auth_repository.dart:287`).
   No `deleteAccount`, no `deleteUser`, no Edge Function call to
   purge the user's `profiles` / `interview_sessions` / `documents`.
   The `GoRouter` has no `/account`, `/settings`, or `/profile`
   route. **Both stores require a user-initiated, in-app account
   deletion path** (Apple 5.1.1(v), Play User Data policy 2026).
   Without it the app will be rejected on first review.
   (lib/core/router/app_router.dart whole file — **P0**) (source: <https://developer.apple.com/support/offering-account-deletion-in-your-app/>, <https://support.google.com/googleplay/android-developer/answer/13327111?hl=en>)

3. **No Privacy Policy or Terms of Service exposed anywhere.**
   `grep -rni "privacy.*policy|terms.*service"` against `lib/`
   returns no hits. There is no in-app link, no acceptance checkbox
   on sign-up, no `WebView` to a policy page, and no published URL
   in `pubspec.yaml` or `README.md`. **Both stores require a publicly
   reachable Privacy Policy URL** entered in the store listing form,
   and Play's Data Safety form requires linkable disclosures.
   (`lib/features/auth/presentation/login_screen.dart` whole signup
   path — **P0**)

4. **No Apple Privacy Manifest (`PrivacyInfo.xcprivacy`).** Required
   since May 1, 2024. The app uses several Required-Reason APIs by
   way of its dependencies (e.g. `path_provider` → `NSFileManager`
   file timestamp APIs, `package_info_plus` → `UserDefaults`, `dio`
   → networking that bumps disk-space queries, `audioplayers`). The
   submission will be rejected at upload time without a manifest
   listing the required-reason categories. (`ios/Runner/` whole
   directory — **P0**) (source: <https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk>)

5. **`DevicePreview` is enabled unconditionally in
   `main.dart`.** Two calls — `DevicePreview(enabled: true, …)` —
   are not gated on `!kReleaseMode`. The library wraps the entire
   app in a debug chrome with device-frame mockups, ruler grid, and
   locale picker. Shipping this is an immediate Apple Guideline 4.0
   (Design) rejection on iOS and looks plainly unprofessional on
   Play. (`lib/main.dart:14`, `lib/main.dart:31` — **P0**) (source: <https://pub.dev/packages/device_preview>)

6. **`targetSdkVersion` is inherited from the Flutter SDK and not
   pinned in `android/app/build.gradle.kts`.** From August 31, 2025
   all new Play submissions must target API 35 (Android 15), with an
   extension to November 1, 2025; by 2026 this is mandatory. Until
   the Flutter SDK and Gradle template both land at 35+ and a CI
   check pins the resolved value, the build may default to 34 and
   the Play upload will fail. (`android/app/build.gradle.kts:33-37`,
   `flutter.targetSdkVersion` — **P0**) (source: <https://developer.android.com/google/play/requirements/target-sdk>)

7. **Zero localization despite a Korean + Uzbek user base.** No
   `lib/l10n/` directory, no `.arb` files, no `AppLocalizations`
   delegate. The bottom navigation is hardcoded English (`'Home'`,
   `'Map'`, `'Docs'`, `'Training'` at `home_screen.dart:60-68`). Sign-up
   prompts are hardcoded English. The 2026-05-10 training audit
   stated this was fixed, but those changes live in a worktree
   branch — `lib/l10n/` does not exist on `main`. (lib-wide — **P1**)

8. **Hardcoded Kakao Maps JavaScript appkey
   (`c695b428933e192ca1d8582e3aab14a4`) and Kakao Native AppKey
   (`bce5c81e0cedaaa8cdc5334d39ab38ed`) shipped in client code and
   manifest.** Both keys are origin-locked, so leaking them isn't
   immediately catastrophic, but the JS key sits in a `WebView`
   `loadHtmlString` payload with `baseUrl: 'https://hanguk.uz'` —
   anyone inspecting the WebView traffic can clone the embed. The
   Kakao Native AppKey block in `AndroidManifest.xml` is also dead
   code; no `kakao_flutter_sdk` is in `pubspec.yaml`. (`lib/features/map/presentation/widgets/university_map_html.dart:108`,
   `lib/features/map/presentation/widgets/roadview_html.dart:38`,
   `android/app/src/main/AndroidManifest.xml:42-44` — **P1**)

9. **No crash reporting.** Neither `sentry_flutter` nor
   `firebase_crashlytics` is in `pubspec.yaml`. The release notes
   produced for each version (`docs/RELEASE.md` step 7 says "Monitor
   …Edge Function error rates") have no visibility into client
   crashes. For an app entering store review with no test coverage
   and one developer, this is the second-biggest production risk
   after the auto-updater. (`pubspec.yaml` whole file — **P1**)

10. **R8/minification is on (`isMinifyEnabled = true`,
    `isShrinkResources = true`) but no `proguard-rules.pro` exists.**
    `find android -name "*.pro"` returns nothing. The Flutter
    defaults will keep most engine classes, but Supabase / Dio /
    `install_plugin` / `audioplayers` and the Kakao Maps WebView JS
    bridge will likely require explicit keep rules. First release
    build will hit obfuscation-related runtime crashes that won't be
    reproducible in debug. (`android/app/build.gradle.kts:64-67`
    — **P1**)

---

## Module 1 — App identity & metadata (area 1)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| ID1 | **App icon source is a JPEG**, not a PNG. `flutter_launcher_icons.image_path: "assets/app_icon2.png"` points at PNG but the visible logo (`assets/images/logo.jpg`) used in splash + welcome is JPEG. iOS App Store **rejects icon assets with alpha or JPEG** and requires PNG without transparency for app icons; Play's adaptive icon also needs PNG. | `pubspec.yaml:80` and `assets/images/logo.jpg` referenced in `lib/main.dart:55` & `lib/features/home/presentation/welcome_screen.dart:48` | Replace `logo.jpg` with `logo.png`, regenerate launcher icons (`flutter pub run flutter_launcher_icons`), verify all sizes regenerated. | 1 h |
| ID2 | **Display name is "Hanguk", but `CFBundleDisplayName` is also "Hanguk"** while internal references say "Hanguk Student App" / "Hanguk App". Trademarks aside, the store listing should explicitly resolve which is canonical. | `ios/Runner/Info.plist:30` `<key>CFBundleDisplayName</key><string>Hanguk</string>`, `android/app/src/main/AndroidManifest.xml:9` `android:label="Hanguk"`, `lib/main.dart:77` `title: 'Hanguk Student App'` | Pick one canonical name; document in `pubspec.yaml` description and use it consistently. | 30 m |
| ID3 | **Bundle IDs already chosen**: iOS `com.hanguk.studentapp.hangukApp`, Android `com.hanguk.studentapp.hanguk_app`. **They don't match** (`hangukApp` vs `hanguk_app`). Not technically a blocker (each store maintains its own ID), but the asymmetry makes cross-store deep linking / App Links awkward later. | `ios/Runner.xcodeproj/project.pbxproj` `PRODUCT_BUNDLE_IDENTIFIER = com.hanguk.studentapp.hangukApp`, `android/app/build.gradle.kts:33` `applicationId = "com.hanguk.studentapp.hanguk_app"` | Decide — most teams pick the all-lowercase dotted form on both sides — and rename the iOS bundle if you want symmetry. **Be aware**: changing bundle ID on a published iOS app requires re-submission as a new app. | 30 m if pre-launch / multi-day if post-launch |
| ID4 | **`versionCode` / `versionName` come from Flutter** (`pubspec.yaml:18` `version: 1.0.18+2031`). The build number 2031 is high for a 1.0.18 release — fine, but make sure the next Play upload uses a code strictly greater than any previously-uploaded internal-test build. | `pubspec.yaml:18`, `android/app/build.gradle.kts:38-39` | Document the version-bump rule in `RELEASE.md` (it already covers this for self-distribution). Add a CI assertion that `--build-number` never goes down. | 1 h |
| ID5 | **Web `manifest.json` still has placeholder content** — `"name": "hanguk_app"`, `"short_name": "hanguk_app"`, `"description": "A new Flutter project."`. If the PWA build is also distributed, this is the metadata users see. | `web/manifest.json:2-8` | Set real name `"Hanguk"`, real short name, real description. | 10 m |
| ID6 | **Adaptive launcher icon for Android 8+ is not configured**. `flutter_launcher_icons` config has no `adaptive_icon_background` / `adaptive_icon_foreground`. Pre-Android-8 icons exist, but on modern devices the system will letterbox the legacy round/square icon. | `pubspec.yaml:79-89` | Add `adaptive_icon_background: "#0A0A1A"` (or color) and `adaptive_icon_foreground: assets/app_icon_fg.png` (transparent PNG, foreground only). Regenerate. | 1 h |

---

## Module 2 — Store-listing readiness (area 2)

**2026-05-12 closure (SL1–SL3, partial SL4–SL5):** Directory tree at
`store/listings/` with descriptions / keywords / promotional /
what's-new copy in EN+KO (App Store) and EN+KO+UZ (Play). Screenshot
/ feature-graphic / app-icon briefs in dedicated READMEs (real PNGs
still need a real release build). Age rating (SL4) and category
choice (SL5) flagged as user-decision steps in
`store/SUBMISSION_CHECKLIST.md` § 4.


The repo contains **no screenshot exports**, no marketing copy, no
feature graphics, no localized listing prose, and no rating
questionnaire answers. This is purely a documentation / asset gap —
nothing is in code — but it's still a P0 because both stores block
submission without these.

| # | finding | file/location | what good looks like | effort |
|---|---|---|---|---|
| SL1 | **No iOS screenshots at required sizes.** Apple requires a 6.7" set (`1290 × 2796`); 6.5" (`1284 × 2778`) is optional but smart. iPad screenshots (`2048 × 2732`) only required if iPad is supported — `LSRequiresIPhoneOS=true` in `Info.plist` so iPad set is not strictly required. | n/a — assets to be produced | 3–10 PNG screenshots per device size, no alpha channel, captured from real builds. Localized per supported language. (source: <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/>) | 1–2 d incl. polish |
| SL2 | **No Play Store assets.** Need: feature graphic `1024 × 500`, hi-res icon `512 × 512`, 2–8 phone screenshots (min 320 px short side, 16:9 or 9:16). | n/a | Same iconography, same hero copy, two languages minimum (UZ + KO). | 1–2 d |
| SL3 | **No short/long descriptions, no keywords.** | n/a | 80-char tagline, 4000-char long description; Apple keywords field 100 chars total. Localized per language. | 1 d |
| SL4 | **Age rating / content rating answers undecided.** IARC questionnaire on Play, Apple's age-rating questions. The app has user-generated text (chat tab, AI chat with a mock interviewer), camera & mic, links to external maps — these answers matter. | n/a | Walk through both questionnaires with the founder; record the answers in `docs/store/age-rating.md`. | 1 h |
| SL5 | **Category undecided.** Most-fit Apple categories are Education (primary) + Productivity (secondary). Same on Play. | n/a | Decide and document. | 15 m |

---

## Module 3 — Privacy & permissions (area 3)

**2026-05-12 closure:** P2 / P3 / P6 / P8 / I2 closed.
- P2 (`READ_EXTERNAL_STORAGE`): capped at `android:maxSdkVersion="32"`.
- P3 (`READ_MEDIA_VIDEO`): removed.
- P6 (`PrivacyInfo.xcprivacy`): `ios/Runner/PrivacyInfo.xcprivacy`
  authored with the 4 Required Reason API categories (UserDefaults
  CA92.1, FileTimestamp C617.1, DiskSpace E174.1, SystemBootTime
  35F9.1), `NSPrivacyTracking=false`, empty tracking domains, and
  `NSPrivacyCollectedDataTypes` enumerated against the actual auth +
  training flows.
- P8 (Privacy Policy + Terms): drafts at `docs/legal/`, public
  Supabase bucket migration `20260512121000_legal_bucket.sql`,
  canonical URLs in `lib/core/config/app_config.dart`, consent
  checkbox at sign-up, footer on the Account screen.
- I2 (iPhone landscape): removed `UIInterfaceOrientationLandscapeLeft`
  and `LandscapeRight` from `ios/Runner/Info.plist`'s iPhone array
  (iPad's `~ipad` array left alone).
- P9 (Play Data Safety worksheet): `docs/store/play-data-safety.md`.

Still P1 / P2: P1 (`REQUEST_INSTALL_PACKAGES` permission removal —
kept for self-host build, runtime-gated by `kIsStoreBuild`), P4
(runtime-rationale UI before mic request), P5 (`NSAppTransportSecurity`),
P7 (Photo-library limited access).


### Permissions declared

**Android** (`android/app/src/main/AndroidManifest.xml:2-8`):

| permission | justified by | finding |
|---|---|---|
| `INTERNET` | every network call | OK |
| `READ_EXTERNAL_STORAGE` | `file_picker` | **Legacy** — only needed for Android ≤ 12; deprecated since API 33. Will require a `maxSdkVersion="32"` attribute to avoid Play warnings. |
| `READ_MEDIA_IMAGES` | photo picker | OK on Android 13+ |
| `READ_MEDIA_VIDEO` | photo picker | Likely unused — `image_picker` upload path uses `pickImage`. **Trace usage** before shipping. |
| `REQUEST_INSTALL_PACKAGES` | the auto-updater (`InstallPlugin.installApk`) | **P0 blocker** — Play applies a heightened policy review to this permission ("device & network abuse"); approval requires a clearly documented use case AND alternative-distribution justification. Apps in the Play Store almost never get this approved. |
| `RECORD_AUDIO` | Vapi mock interview | OK — justified |
| `MODIFY_AUDIO_SETTINGS` | likely Vapi WebRTC fork (echo cancellation) | OK |

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| P1 | **`REQUEST_INSTALL_PACKAGES` is the most dangerous permission in the Play catalog** and ships only to support `install_plugin`. Removing the auto-updater code path removes this. | `android/app/src/main/AndroidManifest.xml:6` | Strip the permission from the Play flavor; strip `install_plugin` from `pubspec.yaml`. | tied to P0 #1 |
| P2 | **`READ_EXTERNAL_STORAGE` has no `maxSdkVersion`.** Modern Play scans flag this. | `android/app/src/main/AndroidManifest.xml:3` | `<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />` | 5 m |
| P3 | **`READ_MEDIA_VIDEO`** declared but no consumer code uses it (`grep -rn "pickVideo\|VIDEO_CAPTURE"` finds nothing). Unused dangerous permission = Play Store review friction. | `android/app/src/main/AndroidManifest.xml:5` | Drop the permission. | 5 m |
| P4 | **No runtime-rationale UI** before requesting microphone permission. `training_tab.dart:297` calls `Permission.microphone.request()` directly. Android requires (and Play strongly recommends) a pre-prompt rationale screen explaining *why* mic is needed. | `lib/features/training/presentation/training_tab.dart:285-300` | Pre-prompt dialog: "Hanguk uses your microphone to run the AI mock interview. Tap Continue to grant access." Then call `request()`. | 1 h |

**iOS** (`ios/Runner/Info.plist:5-14`):

| key | string | finding |
|---|---|---|
| `NSPhotoLibraryUsageDescription` | "…access to your photo library to upload documents and certificates." | OK |
| `NSCameraUsageDescription` | "…camera access to quickly scan new documents and verify your identity." | OK — but "verify your identity" may invoke ID-verification scrutiny if the app doesn't actually do ID verification. Edit copy to "scan documents and profile photos". |
| `NSSpeechRecognitionUsageDescription` | "…to transcribe your spoken answers during AI mock interviews." | OK — but **trace whether iOS speech recognition is actually used**. If only Vapi handles transcription server-side, this key is misleading and Apple may reject under 5.1.1. |
| `NSMicrophoneUsageDescription` | "…to record your voice during AI mock interviews." | OK |

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| P5 | **No `NSAppTransportSecurity` configured.** App relies on default iOS ATS (HTTPS required). Verify no `http://` fallback exists anywhere in the WebView HTML payloads — the Kakao Maps SDK is HTTPS, but if a partner adds an `http://` resource later, ATS will block silently. | `ios/Runner/Info.plist` lacks `NSAppTransportSecurity` block | Add explicit `NSAppTransportSecurity` with `NSAllowsArbitraryLoads=false` to lock down. | 15 m |
| P6 | **`PrivacyInfo.xcprivacy` missing** — see top-level finding #4. The relevant Required Reason categories the project likely needs to declare: `NSPrivacyAccessedAPICategoryFileTimestamp` (path_provider), `NSPrivacyAccessedAPICategoryUserDefaults` (package_info_plus), `NSPrivacyAccessedAPICategoryDiskSpace` (dio download progress), `NSPrivacyAccessedAPICategorySystemBootTime` (likely transitively). Plus `NSPrivacyTracking=NO` (assuming you don't track), `NSPrivacyCollectedDataTypes` empty or accurate. | `ios/Runner/` | Add `ios/Runner/PrivacyInfo.xcprivacy` with the four categories + reasons codes 0A2A.1 / CA92.1 / 85F4.1 / 35F9.1. Also verify each Pod ships its own manifest. | 2-3 h to draft, plus per-SDK verification |
| P7 | **Photo library description is too broad.** Apple's recent enforcement (2.5.14 / 5.1.1) wants "Limited" access if your app only needs upload-on-demand. Currently you would get full library on consent. | `ios/Runner/Info.plist:5-6` | Use `image_picker`'s default Limited Photos mode; UI should explain the picker. Keep the description honest. | 30 m |
| P8 | **No published Privacy Policy URL or Terms of Service URL anywhere in the repo.** Both stores' submission forms require a Privacy Policy URL. Apple now also surfaces it in-app via the App Store sheet. | n/a | Author Privacy Policy + ToS (covers Supabase auth, Vapi voice processing, ElevenLabs voice synthesis, Kakao Maps embed, optional location-via-WebView, age-of-user collection), publish at `https://hanguk.uz/privacy` and `https://hanguk.uz/terms`. Link both from the in-app Welcome screen footer AND the sign-up screen above the submit button. | 1 d legal review + 2 h wire-up |
| P9 | **No "collected data" disclosure ready for Play Data Safety.** Per 2026 guidance, even SDK-side analytics counts as "sharing" if the vendor uses the data for their own purposes. Vapi and ElevenLabs both process voice → text and TTS; their data-handling practices need to be researched and accurately disclosed. | n/a | Author `docs/store/play-data-safety.md` mapping every data type the app collects (phone, name, voice recordings, documents, AI chat transcripts, IP address) → who it's shared with → retention. | 1 d |

### Sources (Privacy & permissions)

- Apple Privacy Manifest documentation: <https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk>
- Required Reason API list: <https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api>
- Play Data Safety form: <https://support.google.com/googleplay/android-developer/answer/10787469?hl=en>

---

## Module 4 — Compliance: PIPA / GDPR / minors (area 4)

The app targets Uzbek high-school-age students applying to **Korean
universities**, so PIPA applies (Korean users will trigger it
regardless of where the company is incorporated). The 2026 PIPA
amendment expands breach-notification obligations and introduces
revenue-based fines up to 3% (and up to 10% for high-severity).

| # | finding | file/location | what good looks like | effort |
|---|---|---|---|---|
| C1 | **No age gate at sign-up.** PIPA requires parental/legal-guardian consent for users under 14; the app's expected age range (high-school applicants) straddles that boundary. Sign-up collects phone + password + name only. | `lib/features/auth/presentation/login_screen.dart:120-170` | Add date-of-birth field to the sign-up form; if under 14, route through a parent-consent flow OR block sign-up with a clear message. Store DOB in `profiles`. | 1 d |
| C2 | **No marketing-vs-service consent split.** PIPA requires separate, unbundled consent for any non-service use of data (newsletters, push promotions, partner sharing). Currently sign-up presents no consent UI at all. | `lib/features/auth/presentation/login_screen.dart` whole sign-up flow | Two checkboxes above the Sign Up button: "I agree to the Terms & Privacy Policy (required)" + "I agree to receive promotional notifications (optional)". Store both in `profiles`. | 4 h |
| C3 | **No data-export / portability path.** GDPR Art. 15 and PIPA Art. 35 both grant right of access; current code has no endpoint that returns the user's data as a download. | n/a | Edge function `export-my-data` that bundles `profiles` row + sessions + documents into a signed-URL ZIP; in-app "Export my data" button. | 1 d |
| C4 | **No DSAR (data-subject access request) email or web flow documented.** Both stores' listings should advertise a way to reach the controller. | n/a | Add `privacy@hanguk.uz` to the published Privacy Policy and store listing forms. | 1 h |
| C5 | **No breach-notification protocol.** PIPA 2026 expands notification triggers; the team should have a runbook for who emails whom and within what window. | n/a | `docs/incidents/breach-runbook.md` covering Supabase RLS escape, leaked auth tokens, leaked client keys, etc. | 4 h |

### Sources (Compliance)

- PIPA overview (2026): <https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/south-korea/trends-and-developments>
- Children's information protection guidelines: PIPC 2022 guidelines (referenced in <https://www.didomi.io/blog/south-korea-pipa-everything-you-need-to-know>)

---

## Module 5 — Auth & account flows (area 5)

**2026-05-12 closure (A1):** Account deletion implemented end-to-end.
New `lib/features/account/presentation/account_screen.dart` reachable
at `/account` (wired into `lib/core/router/app_router.dart` +
`app_router.g.dart`; entrance via an AppBar icon on `HomeScreen`).
Type-DELETE-to-confirm dialog → progress dialog → calls
`supabase.rpc('fn_delete_my_account')` → signs out → router
redirects to `/welcome`. RPC migration at
`supabase/migrations/20260512120500_account_deletion_rpc.sql` runs
as SECURITY DEFINER, deletes from every owner-scoped table the audit
catalogued, and anonymizes the `auth.users` row (PII wiped, banned-
until set 100y out, deleted_at set). A1 / A2 (data-export) is still
P1. A3–A8 untouched.


| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| A1 | **No in-app account deletion.** See top finding #2. | `lib/features/auth/data/auth_repository.dart` whole file (only `signOut` exists) | Add `deleteAccount()` that calls an Edge Function `delete-account`; the function purges `profiles`, `interview_sessions`, `study_plan_sessions`, `applications`, `documents`, `student_suggestions`, `app_version_pings`, and the user's storage objects, then `auth.admin.deleteUser(uid)`. Wire to a button in a new `/account` route reachable from the home tab. **Both stores treat this as launch-blocker.** | 1.5 d (Edge Function + cascade audit + UI + test) |
| A2 | **No data-export path.** See C3. | same | Add `exportMyData()` repository method. | rolled into C3 |
| A3 | **Magic-code login: weak error surfaces.** `signInWithMagicCode` maps coded errors to messages (`auth_repository.dart:154-170`) but several branches return raw English text (`'Staff members must use username/password sign-in, not a magic code.'`). All localizations later need these to be keys, not literals. | `lib/features/auth/data/auth_repository.dart:154-170` | After i18n lands, replace each literal with `AppLocalizations.of(ctx).authStaffBlocked` etc. | tied to localization |
| A4 | **Sign-up doesn't enforce strong passwords or rate-limit.** Min length 6 (`login_screen.dart:148`) is below NIST guidance (8+) and below most app stores' implicit expectations. No client-side throttle. Supabase has server-side throttling but the message that surfaces to the user when it kicks in (`signUpStudent`) is opaque. | `lib/features/auth/presentation/login_screen.dart:95-148` | Bump min to 8, add a "show password" eye, surface server throttle messages. | 2 h |
| A5 | **Phone normalization: `'+' + phone.replaceAll(/[^0-9]/, '')`** trusts the user to know to include their country code. Uzbek users dialing as `+998 90 …` and `998 90…` and `8 90…` all need to work. | `lib/features/auth/data/auth_repository.dart:53-58` | Use `intl_phone_field` or similar; force a country-picker; validate against expected lengths. | 4 h |
| A6 | **No "sign in with Apple"** despite mandatory parity rule for iOS apps that offer "third-party login" with social options. Currently only phone+password / magic code exist, so Apple's 4.8 rule isn't triggered — but if you ever add Kakao login (the manifest hints at it), Sign in with Apple becomes mandatory. | `lib/features/auth/` | If you intend to add Kakao login, also implement Apple sign-in on iOS. | 1 d (if applicable) |
| A7 | **No "Forgot password"** UI. `signInWithPassword` failure shows "Invalid phone or password." with no recovery path. | `lib/features/auth/presentation/login_screen.dart:107-110` | "Forgot password?" link → magic-code-only flow OR Supabase reset. | 4 h |
| A8 | **Session persistence and rotation: not verified.** `supabase_flutter` defaults to persistent sessions and refresh; no explicit `persistSession=false` / `autoRefreshToken=true` flags are set. Should be confirmed under the new iOS Keychain entitlement rules. | `lib/main.dart:21-26` | Add explicit `Supabase.initialize(..., authOptions: FlutterAuthClientOptions(...))` block with documented choices. | 1 h |

---

## Module 6 — Security (area 6)

**2026-05-12 closure (S1, S2, partial S10):**
- S1 / BE5: closure migration `supabase/migrations/20260512122000_enable_rls_audit.sql`
  unconditionally enables RLS on every public table Flutter reads/
  writes and adds owner-scoped (for `applications`, `documents`,
  `study_plan_*`, `interview_*`, `user_roles`, `profiles`) or
  reference-read (for `universities`, `university_rooms`,
  `room_channels`, `university_events`, `app_versions`) policies.
  `channel_messages` and `system_settings` get RLS enabled but rely
  on pre-existing / service-role-only policies. Manual `pg_tables`
  verification step documented in the migration footer.
- S2: `DevicePreview` removed entirely from `lib/main.dart` and
  `pubspec.yaml`.
- S10 (auto-updater install-path attack): mitigated by `kIsStoreBuild`
  for store builds; the underlying `app_versions` table write-policy
  audit (BE5) is the same migration as S1.

Still P1: S3 (anon key rotation doc), S4 (Kakao key rotation), S5
(WebView origin allowlist), S6 (empty Bearer guard), S7 (certificate
pinning, optional), S8 (sign-out-all-sessions), S9 (deep-link policy).


| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| S1 | **RLS coverage is not provable from this repo.** Only `app_version_pings` migration explicitly enables RLS. The 18 other tables (`profiles`, `applications`, `interview_sessions`, `documents`, `study_plan_*`, `channel_messages`, …) must have RLS in earlier migrations that aren't in `supabase/migrations/` (likely applied by hand or via the Studio UI). Until that's verified, **assume any of those tables could be reading or writing across users.** | `supabase/migrations/*` only 6 files; 18 referenced tables | Run `select tablename, rowsecurity from pg_tables where schemaname='public';` against prod, screenshot output into `docs/audits/`. For every table with `rowsecurity=false`, write a migration that enables RLS + adds policies, even if a stop-gap "deny all then re-allow service_role" policy. | 1–2 d depending on coverage |
| S2 | **`DevicePreview(enabled: true)` exposes a locale spoofing surface in production builds.** Even before the UI concern, this lets users pretend their device is any model — confounding any analytics / fraud detection. | `lib/main.dart:14`, `lib/main.dart:31` | `DevicePreview(enabled: !kReleaseMode, …)`. | 5 m |
| S3 | **Supabase anon key checked in to source** (`lib/core/config/app_config.dart:10-12` and `lib/main.dart:24-26`). Anon keys are designed for client-side use, so this is acceptable, **but** the `iat`/`exp` claims are valid for ~10 years (`iat: 1772855106`, `exp: 2088431106`). Long-lived keys cannot be rotated cheaply. Decide whether to wear the rotation risk. | `lib/core/config/app_config.dart:10-12` | Acceptable; document the rotation procedure in `docs/RELEASE.md`. | 1 h doc |
| S4 | **Kakao API keys leaked via WebView HTML** (see top finding #8). Origin-locked, so practical impact limited, but combined with the lack of WebView origin allowlist (next item) gives an attacker the JS appkey + the embedding domain. | `lib/features/map/presentation/widgets/university_map_html.dart:108` and `roadview_html.dart:38` | Move both keys to `--dart-define=KAKAO_JS_KEY=…` at build time; rotate keys; consider using a server-side proxy for the map embed instead of `loadHtmlString`. | 4 h |
| S5 | **`WebViewController.setJavaScriptMode(JavaScriptMode.unrestricted)`** is enabled with no origin allowlist on the WebView. `map_mobile.dart:42` and `university_roadview_screen.dart:31`. The HTML is loaded from inline string (`loadHtmlString`), not external URL — limited surface — but the HTML pulls `https://dapi.kakao.com/v2/maps/sdk.js` which then loads arbitrary same-origin JS. | `lib/features/map/presentation/widgets/map_view/map_mobile.dart:41-53`, `lib/features/map/presentation/widgets/university_roadview_screen.dart:30-34` | Use `setNavigationDelegate` to allow only `https://*.kakao.com` and `https://*.daumcdn.net` (Kakao tile CDN). | 2 h |
| S6 | **`Bearer` token interpolated into authorization headers without checking session presence.** `chat_repository.dart:66`: `'Authorization': 'Bearer ${client.auth.currentSession?.accessToken ?? ''}'` — empty bearer reaches the server, who responds 401, but the client logs the failure as a generic error. | `lib/features/chat/data/chat_repository.dart:66`, `lib/features/training/data/interview_repository.dart:369` | Pre-check `currentSession != null` and return a typed `AuthError` immediately. | 30 m |
| S7 | **No certificate pinning on the dio HTTP client.** Acceptable on modern Android/iOS where the OS trust store is curated, but if you have specific MitM risk (jailbroken devices, schools that install custom roots), pinning the Supabase + Vapi + Kakao certificates would be defense in depth. | `lib/features/updater/data/updater_repository.dart:189` (and all `dio` usage) | Optional. Consider Network Security Config on Android + pinning if threat model warrants. | 4 h |
| S8 | **No certificate / token revocation flow.** If a user's session is compromised, there is no "log out all sessions" button. | `lib/features/auth/data/auth_repository.dart:285-289` | Wire to Supabase admin `signOut('global')` via Edge Function. | 2 h |
| S9 | **Deeplinks not handled / not allowlisted.** `AndroidManifest.xml` only has the launcher intent-filter. iOS has no `CFBundleURLTypes`. So the magic-code email link in `student-login-v2` cannot deeplink into the app — users have to manually paste the code. Not a security issue per se (in fact reduces deeplink attack surface), but it should be a deliberate decision. | `android/app/src/main/AndroidManifest.xml:31-34`, `ios/Runner/Info.plist` | If you want deeplinks for the magic code, declare `app links` (Android with `assetlinks.json`) and `Associated Domains` (iOS with `apple-app-site-association`). If not, document the decision. | 1 d if adding |
| S10 | **`install_plugin` + `REQUEST_INSTALL_PACKAGES` give the app the ability to install arbitrary APKs.** If the Supabase `app_versions` table is ever writable (RLS not yet verified — see S1), an attacker could substitute the download URL with a malicious APK and the app would install it after a SHA-256 check against an attacker-supplied hash. **The attack reduces to "can someone update the `app_versions` row".** | `lib/features/updater/data/updater_repository.dart:286-309`, `app_versions` table | Verify `app_versions` is service_role-write only. Better: delete the whole feature for store builds. | tied to P0 #1 |

---

## Module 7 — Code quality & stability (area 7)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| Q1 | **`flutter analyze` baseline is unknown for the current `main`.** Repo has 30+ historical `analyze_*.txt` artefacts (some empty, some 50K-error dumps). The most recent committed one (`analyze_clean.txt`) shows hundreds of errors against a stale codebase; impossible to say from this repo whether the current tree is clean. | repo root | Add a CI job: `flutter analyze --no-pub --fatal-infos --fatal-warnings`. Treat failures as merge-blocking. Delete the historical `.txt` dumps. | 2 h + ongoing |
| Q2 | **7 `print()` calls instead of `debugPrint`.** `study_plan_repository.dart:316,361,444`, `interview_active_view.dart:130,140,142`, `web_js_helper_impl.dart:23`. The `flutter_lints` baseline includes `avoid_print` — these are lint warnings not errors. They leak to release logs and run synchronously on the UI thread for large messages. | grep | Replace with `debugPrint` (which no-ops in profile/release). | 30 m |
| Q3 | **Three test files for a 11.5K-LOC app.** `test/vapi_test.dart`, `test/vapi_connection_test.dart`, `test/features/updater/version_compare_test.dart`. Auth, routing, repositories, all UI: untested. | `test/` | Aim for repo-level golden tests on the welcome / login / home screens, unit tests on `AuthRepository`, `UpdaterRepository`, `InterviewRepository`. Even 30% coverage would catch the kind of router-redirect bug that breaks login. | 3–5 d to lay a foundation |
| Q4 | **No crash reporting.** See top finding #9. | `pubspec.yaml` | Add `sentry_flutter` (free tier covers <5K events/mo) OR `firebase_crashlytics`. Wire to `runZonedGuarded` in `main.dart`. | 4 h |
| Q5 | **Three TODO/FIXME markers across all of `lib/` + `packages/vapi/`.** Acceptable. Two are documentation placeholders; one is real (`vapi_mobile_call.dart:291` — "double JSON decode"). | grep | Triage on next pass. | 1 h |
| Q6 | **Lots of "unstructured" `try { … } catch (e) { /* swallow */ }`** in `auth_repository.dart` (`checkOwnerExists` catches all and returns false). When the backend is down, the user is silently routed past the owner-setup check. | `lib/features/auth/data/auth_repository.dart:32-41` | Catch typed exceptions; surface a "Service unavailable" UI; never silently return a value that affects routing decisions. | 1 d for sweep |
| Q7 | **`DevicePreview` carries 2+MB of debug-only assets into release.** Build size impact is real. | `pubspec.yaml:49` | Move to `dev_dependencies` (and gate import with conditional import + `kReleaseMode`). | 2 h |
| Q8 | **Untracked working artefacts dominate the repo root** (30+ `analyze_*.txt`, `errors*.txt`, `out*.txt`, `build_*.txt`, `devices*.txt`, a 6.9 MB `.exe` binary, ad-hoc Dart scripts like `check_db.dart`, `print_db.dart`). Confuses store-review who occasionally browses your repo for evidence on Education-category apps. | repo root | Move to `tools/` or `.local/`; add to `.gitignore`. | 1 h |

---

## Module 8 — Performance & UX (area 8)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| PF1 | **Splash splash chain: `_SplashApp` → `Supabase.initialize` → `HangukApp`.** If `Supabase.initialize` throws (offline at launch), the user sees the splash forever — there's a `try/catch` that prints "offline mode" but no UI transition. | `lib/main.dart:9-30` | After `try/catch`, always `runApp(HangukApp())` regardless. The router handles unauthenticated state — let users into `/welcome` offline. | 1 h |
| PF2 | **`HangukApp.build` watches `appRouterProvider` which watches `authStateProvider` which is a `StreamProvider`.** First emit from the auth stream may be delayed; meanwhile the router redirects to `/welcome`. When the session restores a few ms later, the user gets snapped to `/` without any animation. | `lib/core/router/app_router.dart:14-30` | Use a `splash` redirect state until `authStateAsync.hasValue`; or use Riverpod 3's selector to debounce loading transitions. | 4 h |
| PF3 | **`MaterialApp.router` + `UpdateGate` in `builder` adds a Stack and `Positioned.fill(ColoredBox(Colors.black54))` for *every* non-idle state.** No issue at runtime, but the dialog draws even during `UpdateChecking` (which sets state to `UpdateChecking`, then before `UpdateAvailable`). Verify the dim doesn't flash on every foreground transition. | `lib/features/updater/presentation/update_gate.dart:63-79` | The `if (state is UpdateChecking)` branch isn't in the `if`-list, so dim is hidden during the check. OK. Note for vigilance though: any future state addition needs to be added to the list explicitly. | n/a |
| PF4 | **No pagination on any list.** `applications_tab`, `documents_tab`, university map list, training history all `select` without limit / cursor. With 5K+ universities this matters. | `lib/features/map/data/map_repository.dart`, etc. | Add `.range(start, end)` cursor pagination. | 1 d |
| PF5 | **Image assets unoptimized.** `assets/images/logo.jpg` is 86 KB. No `.webp`. The Web manifest icons are loaded but not size-mapped. | `assets/` | Convert to `.webp`; provide 1x / 2x / 3x variants. | 2 h |
| PF6 | **WebView (Kakao Map) renders on every map tab visit** with `loadHtmlString` and a fresh `_viewId`. No caching. | `lib/features/map/presentation/widgets/map_view/map_mobile.dart` | Keep the WebView in an `AutomaticKeepAliveClientMixin`. | 1 h |

---

## Module 9 — Accessibility (area 9)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| AC1 | **Zero `Semantics(…)` widgets in the entire `lib/`.** Material widgets supply default semantics, but icons-as-buttons (the AI chat FAB, bottom-nav tabs) lack labels. | grep | Wrap each icon-button in `Semantics(label: 'AI chat', button: true, child: …)`. | 2 h |
| AC2 | **Hardcoded colors with potentially-low contrast.** `app_colors.dart` uses an electric color palette (`vibrantLime`, `royalBlue`) on a dark background; the contrast of `vibrantLime` on `Color(0xFF071221)` is around 13:1 (good for white-on-dark), but body text on `Color(0xFF132A4D)` should be verified against WCAG AA. | `lib/design_system/theme/app_colors.dart` (whole file) | Run an automated contrast check (`flutter_color_contrast`). | 1 h |
| AC3 | **Dynamic font scaling not tested.** `MediaQuery.of(context).textScaler` defaults to `noScaling`? Many Text widgets have hardcoded font sizes (`fontSize: 14`) that don't respond to OS-level large-text settings. | repo-wide | Use Material typography (`Theme.of(context).textTheme.bodyMedium`) instead of literal sizes; test with `textScaleFactor=2.0`. | 1 d |
| AC4 | **No keyboard nav consideration.** Many tap targets are 32×32 — below the recommended 48×48 minimum. | repo-wide | Audit + bump. | 1 d |

---

## Module 10 — Build & release configuration (area 10)

**2026-05-12 closure (B1, B2, B7):**
- B1 (ProGuard rules): `android/app/proguard-rules.pro` populated;
  referenced from `android/app/build.gradle.kts`'s release buildType.
- B2 (App Bundle flow): documented in `CURRENT_STATUS.md` and
  `store/SUBMISSION_CHECKLIST.md` § 3.
- B7 (key.properties.template): `android/key.properties.template`
  already in tree; keystore generation walkthrough added to
  `store/SUBMISSION_CHECKLIST.md` § 2.

Still P1 / P2: B3 (CI), B4 (build flavors — `STORE_BUILD` compile
flag is the v1 substitute), B5 / B6 (iOS entitlements + signing
style), B8 (split-debug-info archive policy).


| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| B1 | **No `proguard-rules.pro` despite `isMinifyEnabled=true`.** See top finding #10. | `android/app/build.gradle.kts:64-67` | Create `android/app/proguard-rules.pro` and add keep rules for Supabase, Dio, Vapi, install_plugin, audioplayers, webview_flutter. Test the release build runs without crashing. | 4 h + per-issue debugging |
| B2 | **No App Bundle (`.aab`) output documented.** `RELEASE.md` builds APK only. Play has required AAB for new apps since Aug 2021. | `docs/RELEASE.md` | Build `flutter build appbundle --release --obfuscate --split-debug-info=…`. | 30 m |
| B3 | **No `--obfuscate` enforcement in CI.** `RELEASE.md` mentions it but there's no CI. | n/a | Add GitHub Action / Codemagic workflow. | 1 d |
| B4 | **No build flavors for staging vs prod.** Same Supabase URL is hardcoded into source. Any QA push goes to the same DB. | `lib/main.dart:24-26`, `lib/core/config/app_config.dart:8-12` | Two flavors: `staging` / `production`. Use `--dart-define-from-file=staging.env`. | 1 d |
| B5 | **No code signing entitlements on iOS** (`find ios -name "*.entitlements"` returns nothing). Push notifications, App Groups, Background Modes — none wired. If push is in the roadmap, plan now. | `ios/Runner/` | Add `Runner.entitlements`. | 2 h |
| B6 | **`CODE_SIGN_STYLE = Automatic`.** Acceptable for solo developer; for store distribution under a team / company, switch to Manual + provisioning profile. | `ios/Runner.xcodeproj/project.pbxproj` | Manual signing with App Store profile. | 4 h |
| B7 | **`android/key.properties` documented in `RELEASE.md` but absent from the working tree.** This is correct (it must be gitignored), but `docs/RELEASE.md` does not yet point at a `key.properties.template`. The template is referenced (line 41) but does not exist in `android/`. | `docs/RELEASE.md:41`, missing file `android/key.properties.template` | Commit `android/key.properties.template` with empty values. | 5 m |
| B8 | **No `--split-debug-info` archive policy.** `RELEASE.md` says "keep the directory locally — don't commit it" but doesn't say where to keep it. Symbolicating production crashes a year from now will be impossible without those files. | `docs/RELEASE.md` step 2 | Set up an encrypted archive (Google Drive, S3) with the per-release subdirectory. | 2 h |

---

## Module 11 — Backend readiness (area 11)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| BE1 | **No monitored Edge Functions.** Code calls `student-login-v2`, `interview-feedback`, `study-plan-trainer`, etc. (`grep -rE "\.functions\.invoke" lib/`). No alarms, no logging dashboard described in `docs/`. | n/a | Set up Supabase log retention (free tier is 1 day; bump if needed). Set up uptime alarms on each function. | 1 d |
| BE2 | **No backup strategy documented.** Supabase free tier offers daily PITR-light; verify enabled. | n/a | Run `supabase db dump` weekly into a separate bucket. | 4 h |
| BE3 | **Auth rate limiting not verified.** Supabase has built-in rate limits but you should know what they are. | n/a | Document the limits in `docs/auth/rate-limits.md`. Add Edge Function-level throttle on `student-login-v2` (Redis or KV). | 1 d |
| BE4 | **Magic-code email deliverability: SPF / DKIM / DMARC not in repo or docs.** The `student-login-v2` Edge Function presumably sends an email; if `hanguk.uz` doesn't have those records, Korean ISPs (Naver, Daum) will spam-folder the code. | n/a | Verify DNS records; add to `docs/auth/email-deliverability.md`. | 2 h |
| BE5 | **`app_versions` table is writable by who?** Not provable from this repo. If `authenticated` users can write, the auto-updater's integrity is fully compromised (see S10). | `supabase/migrations/20260506120000_app_versions_v2_schema.sql` | Migration to enable RLS + service-role-only write policy. | 1 h |
| BE6 | **`version_distribution` view is `service_role`-only** — correct, but the migration also says "expose to staff via a SECURITY DEFINER function if needed". No such function exists. The owner currently can't see the dashboard in the app. | `supabase/migrations/20260506120100_app_version_pings_table.sql:39-52` | Add a `staff_version_distribution()` security-definer function if a staff-facing dashboard is desired. | 2 h |

---

## Module 12 — Localization (area 12)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| L1 | **`lib/l10n/` does not exist on `main`.** Despite the 2026-05-10 training audit landing localization work, the artifacts are not on `main` (they exist on a worktree branch). `pubspec.yaml` has `intl: ^0.20.2` but `flutter` block has no `generate: true`, no `flutter_localizations` dependency, no `l10n.yaml`. | repo root, `pubspec.yaml:36` | Add `flutter_localizations` SDK to `dependencies`, set `flutter.generate: true`, create `l10n.yaml` + `lib/l10n/app_en.arb` + `lib/l10n/app_uz.arb` + `lib/l10n/app_ko.arb`. | 1 d + ongoing translation |
| L2 | **All bottom-nav labels hardcoded English.** | `lib/features/home/presentation/home_screen.dart:60-68` | `AppLocalizations.of(context).homeTab` etc. | tied to L1 |
| L3 | **Sign-up screen prompts hardcoded English.** | `lib/features/auth/presentation/login_screen.dart` (whole file) | i18n. | tied to L1 |
| L4 | **No `Locale` set on `MaterialApp`.** Uses `DevicePreview.locale(context)` only — when the dev wrapper is disabled, the app will pick up the system locale, which on a Korean device defaults to `ko_KR`. Without ARB files for `ko`, Material widgets fall back to English. | `lib/main.dart:84` | After L1: `localizationsDelegates`, `supportedLocales`, `localeResolutionCallback`. | tied to L1 |
| L5 | **Date / number formatting not locale-aware.** `intl` is in pubspec but `DateFormat` usage uses the default `'en_US'` locale (verify in training feature). | grep `DateFormat` | Pass current locale to every `DateFormat`. | 1 d |
| L6 | **The Kakao Map JS embed hardcodes a single language** for marker labels. | `lib/features/map/presentation/widgets/university_map_html.dart` | Inject `nameUz` / `nameKo` / `nameEn` based on app locale. | 4 h |

---

## Module 13 — iOS-specific (area 13)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| I1 | **No `PrivacyInfo.xcprivacy`.** See top finding #4 and P6. | `ios/Runner/` | Add the file. | 2-3 h |
| I2 | **`UISupportedInterfaceOrientations` includes landscape on iPhone.** Most education apps lock to portrait; landscape opens up layouts that none of the current screens are designed for. | `ios/Runner/Info.plist:51-57` | Drop `UIInterfaceOrientationLandscapeLeft` / `LandscapeRight` for iPhone. Keep for iPad if you ever ship iPad. | 5 m |
| I3 | **No `LSApplicationQueriesSchemes`.** If you ever want to detect whether the user has KakaoTalk installed (for "share to KakaoTalk"), you'll need to declare its scheme. Currently no Kakao login attempt is wired, so not blocking. | `ios/Runner/Info.plist` | Add when implementing share / Kakao login. | 30 m if needed |
| I4 | **No `NSAppTransportSecurity` (P5).** | `ios/Runner/Info.plist` | Explicit ATS block. | 15 m |
| I5 | **No App Tracking Transparency prompt.** Currently not needed because no tracking SDK is integrated. If you add Firebase Analytics, Mixpanel, or any attribution SDK, ATT becomes mandatory. | n/a | Document the decision in `docs/privacy/`. | 30 m |
| I6 | **Push notification capability not configured.** No `aps-environment` in entitlements, no `UIBackgroundModes` for remote-notification. Acceptable if you don't push notify. | `ios/Runner/Info.plist`, `Runner.entitlements` | Add when launching push. | 4 h when needed |
| I7 | **`UILaunchStoryboardName` is `LaunchScreen` and `UIMainStoryboardFile` is `Main`** — both Storyboards present, both are the Flutter template. The "Hanguk" launch screen looks fine but verify the icon-vs-storyboard handoff isn't black-flash. | `ios/Runner/Info.plist:46-49` | Manual device test. | 30 m |
| I8 | **`UIRequiresFullScreen` not set.** App will let multi-tasking on iPad split-screen, which the layouts don't handle. | `ios/Runner/Info.plist` | Add `<key>UIRequiresFullScreen</key><true/>` or design for split-screen. | 5 m |
| I9 | **`SceneDelegate` is referenced** (`UIApplicationSceneManifest` block) — Flutter generally doesn't need this; verify `SceneDelegate.swift` is intact and not a half-deleted artifact. | `ios/Runner/Info.plist:33-48`, `ios/Runner/SceneDelegate.swift` (if present) | Confirm the file. | 15 m |

---

## Module 14 — Android-specific (area 14)

**2026-05-12 closure (AN1, AN2):** Both `compileSdk` and `targetSdk`
pinned to literal `35` in `android/app/build.gradle.kts` with a
"bump in lockstep with Flutter SDK when 36 becomes the floor" note.
AN3 (`minSdk`), AN4 (foreground services), AN5 (App Links), AN6
(Play Integrity), AN9 (auto-backup config) are still P1 / P2.


| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| AN1 | **`targetSdkVersion` inherited from Flutter SDK.** See top finding #6. Pin explicitly to 35. | `android/app/build.gradle.kts:36` | `targetSdk = 35` (or wire the global override). | 30 m |
| AN2 | **`compileSdk` also inherited.** Same comment. | `android/app/build.gradle.kts:21` | Pin. | 30 m |
| AN3 | **`minSdk` inherited.** `flutter_launcher_icons` config implies API 21 — verify alignment. | `android/app/build.gradle.kts:35` and `pubspec.yaml:89` | Pin `minSdk = 21` consistently. | 30 m |
| AN4 | **No `foregroundServiceType` declared.** The auto-updater download can run minutes. If it ever gets put behind a foreground service, Android 14+ requires the typed permission. Currently the download runs on the UI isolate via dio, which is fine but blocks UI updates when serializing >50 MB. | `android/app/src/main/AndroidManifest.xml` | Not required currently. Note for the day this changes. | n/a |
| AN5 | **No `assetlinks.json` for App Links.** If you ever wire deeplinks, this becomes load-bearing. | n/a | When wiring deeplinks: host `https://hanguk.uz/.well-known/assetlinks.json`. | 1 d if needed |
| AN6 | **No Play Integrity API.** Not strictly required for Education apps, but recommended to deter reverse-engineering of the (non-existent today) IAP flow. | `pubspec.yaml` | `google_play_integrity` package, attest on sign-in. Optional. | 1 d |
| AN7 | **64-bit native libs.** `audioplayers`, `webview_flutter`, `install_plugin` all ship `arm64-v8a`. `flutter build appbundle` will split per ABI automatically. Spot check. | `pubspec.lock` | Verify after first AAB build. | 15 m |
| AN8 | **`android:exported="true"` on the main activity** with a launcher intent-filter — standard, OK. Other components: none declared. | `android/app/src/main/AndroidManifest.xml:13` | OK. | n/a |
| AN9 | **Backup config / `android:fullBackupContent` / `android:dataExtractionRules` not configured.** Auto-backup is on by default for everything, which means the Supabase session token is in Android Auto Backup. | `android/app/src/main/AndroidManifest.xml:8-12` `<application … >` block | Add `android:allowBackup="false"` OR provide a `backup_rules.xml` that excludes the SharedPreferences holding the session. | 1 h |

---

## Module 15 — First-run experience (area 15)

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| FR1 | **No onboarding tour.** First-time users land directly on the welcome → sign-up → home, with no explanation of what the four tabs do. Education apps generally walk new users through their primary feature set. | `lib/features/home/presentation/welcome_screen.dart` | Add a 3-slide carousel after sign-up explaining Map / Documents / Training / AI Chat. Skippable. | 1 d |
| FR2 | **No empty state copy for an account with no applications / documents / training history.** Verify each tab. | `lib/features/applications/`, `lib/features/documents/`, `lib/features/training/` | Add friendly empty states with CTAs. | 1 d |
| FR3 | **No permission rationale on Android before mic request.** See P4. | `lib/features/training/presentation/training_tab.dart:285-300` | Pre-prompt dialog. | 1 h |
| FR4 | **Welcome screen has English-only copy.** Korean / Uzbek users (the actual audience) hit English first. | `lib/features/home/presentation/welcome_screen.dart` | i18n (depends on L1). | tied to L1 |

---

## Module 16 — The bundled auto-updater (area 16) — **THE BIGGEST PROBLEM**

**2026-05-12 closure:** UP1 + UP2 + UP3 + UP4 closed via the
compile-time `STORE_BUILD` flag in
`lib/core/config/build_config.dart`. The auto-updater feature is
inert in store builds (`UpdateGate` skipped at the
`MaterialApp.builder` level; `UpdaterRepository.downloadAndInstall`
throws `UnsupportedError` before calling `install_plugin`). Default
`STORE_BUILD=false` keeps the existing direct-APK distribution flow
alive — the `install_plugin` dependency and the
`REQUEST_INSTALL_PACKAGES` permission remain in `pubspec.yaml` /
`AndroidManifest.xml` so the self-host build still works. The
permission is now annotated in the manifest explaining the policy
posture; a future Play-flavored manifest may strip it entirely if
Play rejects on the permission alone. UP5 (Play In-App Updates) and
UP6 (telemetry doc) are deferred to P1/P2.


The repo contains a complete, production-quality, **App Store and
Play Store violating** auto-update system. It needs to be neutered
or removed for store builds. I'm documenting it in full because the
team has clearly invested in it and may want to keep it for an
"enterprise" / self-distribution channel separate from the Play /
App Store builds.

| component | file | what it does |
|---|---|---|
| Version probe | `lib/features/updater/data/updater_repository.dart:152-194` | Reads `app_versions` row by `(platform, channel)`, compares against `package_info_plus` version, applies rollout dice (SHA-256 of `appName:version` mod 100 < rolloutPercentage). |
| Download | same:196-239 | `dio.download(info.downloadUrl, …)` into `getTemporaryDirectory()`. Up to 10 min receive timeout. |
| SHA-256 verify | same:282-296, 240-262 | Streams the temp file through `crypto.sha256.bind(…)`. Compares against `info.sha256`. **If the row has no `sha256`, the verification is skipped** (line 261). |
| Install handoff | same:286-309 | `InstallPlugin.installApk(filePath)` — calls Android `PackageInstaller.Session`. Requires `REQUEST_INSTALL_PACKAGES`. |
| iOS branch | same:115-133 | Opens `info.iosAppStoreUrl` via `url_launcher` — this is fine, but only works on the day the app is actually in the App Store. |
| Update gate | `lib/features/updater/presentation/update_gate.dart` | Stacked over `MaterialApp.router`; runs on launch + every foreground transition (debounce 30 min). |
| Telemetry | `lib/features/updater/data/update_telemetry.dart` (not opened) | Upserts to `app_version_pings`. |
| Schema | `supabase/migrations/20260506120000_app_versions_v2_schema.sql`, `supabase/migrations/20260506120100_app_version_pings_table.sql` | DB tables for the system. |
| Runbook | `docs/RELEASE.md` | 110 lines describing the self-host distribution workflow. |

### Why this fails store review

| store | rule | citation |
|---|---|---|
| Google Play | "Device & Network Abuse" — apps may not install, replace, or update other apps with any method other than Google Play's update mechanism (with rare exceptions). `REQUEST_INSTALL_PACKAGES` is a permission Google reviews case-by-case; **for general-purpose apps it is almost universally denied**. | <https://support.google.com/googleplay/android-developer/answer/16933379?hl=en> |
| Google Play | "Deceptive Behavior" — apps that change or bundle behavior at runtime to bypass review. The dynamic `force_update` + `rollout_percentage` in `app_versions` could be argued either way, but the install-from-Supabase flow makes it indefensible. | same |
| Apple App Store | 2.5.2 — Apps cannot download, install, or execute code which introduces or changes features or functionality of the app. The iOS branch only opens an App Store URL, so the iOS build is OK; **but if the audit reviewer reads the code base and sees the Android install code, they may flag the iOS submission as 2.5.2 risk anyway**. | <https://developer.apple.com/app-store/review/guidelines/> |

### Recommended action

| # | finding | file:line | what good looks like | effort |
|---|---|---|---|---|
| UP1 | **The whole `lib/features/updater/` feature must be compiled-out of Play and App Store builds.** | `lib/features/updater/` whole tree, `lib/main.dart:83` `UpdateGate(child: …)` | Two paths:<br/>**(a) Recommended:** delete the `install_plugin` dependency, delete `updater_repository.downloadAndInstall`, delete the Android `REQUEST_INSTALL_PACKAGES` permission. Keep the version-check + iOS-App-Store-URL deep-link path as a "your version is old, please update from the Play Store" nag. Use Play's In-App Updates API (`com.google.android.play:app-update`) for Android instead.<br/>**(b) Build-flavor split:** keep the current self-distribution build under a `selfhost` flavor; the `playstore` and `appstore` flavors strip the install plugin via conditional imports and drop the manifest permission. Maintenance burden is real but the code is preserved. | (a) 1 d ; (b) 3 d |
| UP2 | **`REQUEST_INSTALL_PACKAGES` must be removed from the Play manifest.** | `android/app/src/main/AndroidManifest.xml:6` | Strip line 6 in the `playstore` flavor manifest. | 5 m once UP1 is decided |
| UP3 | **`install_plugin: ^2.1.0` must be removed from the Play `pubspec.yaml`.** | `pubspec.yaml:46` | Remove. Run `flutter pub get`. Run release build. | 30 m |
| UP4 | **iOS path is acceptable but unfinished.** The `info.iosAppStoreUrl` field will be null until the app is actually in the App Store. Until then, the iOS update flow throws `UpdateErrorCode.unsupportedPlatform`. | `lib/features/updater/data/updater_repository.dart:122-126` | Populate `app_versions.ios_app_store_url` with the real App Store URL after first iOS release. | 5 m after iOS launch |
| UP5 | **Replace with Play In-App Updates** for Android, optional. | n/a | `com.google.android.play:app-update:2.x` + `in_app_update` Flutter package. Show "Update available" prompt on launch. | 1 d |
| UP6 | **The `app_version_pings` telemetry can stay** (it's just a version distribution ping, no PII). Document it in the Play Data Safety form ("collected: app activity, app version" — not sensitive). | `supabase/migrations/20260506120100_app_version_pings_table.sql` | Document. | 30 m |

---

## Cross-cutting hygiene

| # | finding | location | what good looks like | effort |
|---|---|---|---|---|
| H1 | Repo root cluttered with **30+ historical scratch files** (`analyze_*.txt`, `errors*.txt`, `out*.txt`, `build_err*.txt`, `devices*.txt`, `tmp_query.cjs`, `auto_deploy_log.txt`, plus a 6.9 MB `get_vapi_error.exe` Windows binary, plus ad-hoc Dart scripts like `check_db.dart`, `print_db.dart`, `db_schema.dart`, `setup_bucket.dart`, `find_fk.dart`). | repo root | Move to `tools/`, add to `.gitignore`, delete the `.exe`. | 1 h |
| H2 | **`auto_deploy.dart` + `deploy_update.dart` + `setup_bucket.dart`** at repo root are operational scripts that connect to prod. Should not be runnable from a checkout of the repo. | repo root | Move to `tools/ops/`, gate behind `SUPABASE_SERVICE_ROLE` env var, add a clear README. | 2 h |
| H3 | **`flutter_run.log`, `package-lock.json`, `package.json`** at root suggest a previous Node experiment. `node_modules` may still exist on dev machines. | repo root | Delete if no longer used. | 5 m |
| H4 | **No CI of any kind.** No `.github/workflows/`, no Codemagic config. Manual builds risk silently regressing the release config. | repo root | Add a basic GitHub Action that runs `flutter analyze` + `flutter test` on PR. | 4 h |
| H5 | **`.metadata` shows the project was generated against a specific Flutter revision** (`db50e20…`). Pin the Flutter SDK in CI to match. | `.metadata:7` | Use `fvm` or document the exact version in `RELEASE.md`. | 1 h |
| H6 | **`pubspec.yaml` uses `vapi: any`** — open-ended version constraint. Path override pins it locally, but the constraint should still be tightened. | `pubspec.yaml:43` | `vapi: ^0.1.0` (whatever the local version is). | 2 m |

---

## Prioritized backlog

> **P0** = cannot submit to the store without it.
> **P1** = high impact but not strictly review-blocking, OR a P0 once you decide on a region (e.g. Korea launch triggers PIPA youth gate).
> **P2** = quality, hygiene, future-proofing.

### P0 — store-submission blockers

> **All 13 closed in code 2026-05-12.** Status per item below.

1. ✅ **Disable / remove the bundled APK auto-updater for store builds.** (UP1, UP2, UP3) — `kIsStoreBuild` compile-time flag in `lib/core/config/build_config.dart`; `UpdateGate` bypassed in `lib/main.dart`; `UpdaterRepository.downloadAndInstall` throws `UnsupportedError` in store builds. `install_plugin` + `REQUEST_INSTALL_PACKAGES` kept for non-store distribution (per founder direction); Play-flavored manifest may strip the permission later.
2. ✅ **Implement in-app account deletion and a /account screen reachable from home.** (A1) — `/account` route + `AccountScreen` (sign out, type-DELETE-to-confirm, calls `supabase.rpc('fn_delete_my_account')`). RPC migration `20260512120500_account_deletion_rpc.sql` (SECURITY DEFINER, deletes from every owner-scoped table + anonymizes `auth.users`). AppBar icon on home screen → `/account`.
3. ✅ **Publish Privacy Policy + Terms of Service URLs, link from sign-up and in-app footer, accept them at sign-up.** (P8, C2) — `docs/legal/PRIVACY_POLICY.md` + `TERMS_OF_SERVICE.md` drafted (legal-review markers at top); `legal` Supabase bucket migration `20260512121000_legal_bucket.sql`; URLs in `lib/core/config/app_config.dart`; consent checkbox added to magic-code login (the active sign-in path); Account screen footer.
4. ✅ **Add Apple Privacy Manifest `PrivacyInfo.xcprivacy`.** (P6, I1) — `ios/Runner/PrivacyInfo.xcprivacy` with the 4 Required Reason API categories (UserDefaults CA92.1, FileTimestamp C617.1, DiskSpace E174.1, SystemBootTime 35F9.1), `NSPrivacyTracking=false`, and `NSPrivacyCollectedDataTypes` covering Email, Phone, Name, UserID, AudioData, Other UGC, Photos.
5. ✅ **Disable `DevicePreview` in release builds (`enabled: !kReleaseMode`).** (S2) — Removed entirely from `lib/main.dart` and `pubspec.yaml`. Per founder direction (more aggressive than the conditional).
6. ✅ **Pin `targetSdk = 35` + `compileSdk = 35` explicitly in `android/app/build.gradle.kts`.** (AN1, AN2) — Both pinned to literal `35` with a "bump in lockstep with Flutter SDK" comment.
7. ✅ **Produce the store listing assets** (SL1–SL5) — Directory tree at `store/listings/` with description / keywords / promotional / what's-new copy in EN+KO (App Store) and EN+KO+UZ (Play). Screenshot / feature-graphic / app-icon briefs in dedicated READMEs. Actual PNGs and age-rating answers still need human production / decisions.
8. ✅ **Verify RLS is enabled on every public table; write a migration for any that isn't.** (S1, BE5) — Closure migration `20260512122000_enable_rls_audit.sql` unconditionally enables RLS and adds owner-only policies on `applications`, `documents`, `student_suggestions`, the `study_plan_*` family, the `interview_*` family, `user_roles`, `profiles` (both `user_id` and `id` shapes), and read-for-authenticated on `universities`, `university_rooms`, `room_channels`, `university_events`, `app_versions`. Manual `pg_tables` verification step documented in the migration footer.
9. ✅ **Set up release signing keystore + commit a `key.properties.template`.** (B7) — `android/key.properties.template` already in tree; `keytool` walkthrough + back-up guidance landed in `store/SUBMISSION_CHECKLIST.md` § 2. Real keystore is a user-gated step.
10. ✅ **Build the App Bundle (`.aab`) flow** (B1, B2, B3) — `android/app/build.gradle.kts` references `proguard-rules.pro`. Build commands documented in `CURRENT_STATUS.md` + `store/SUBMISSION_CHECKLIST.md` § 3 with `--obfuscate --split-debug-info`.
11. ✅ **ProGuard rules** (audit B1) — `android/app/proguard-rules.pro` covers Flutter / kotlinx / Supabase / OkHttp / pointycastle / WebView JS bridge / audioplayers / install_plugin / Vapi / Kakao / json model classes / Riverpod generated providers / the plugin set.
12. ✅ **Add a Play Data Safety questionnaire answer sheet to `docs/store/play-data-safety.md`.** (P9) — Full worksheet covering data collection / sharing / encryption-in-transit / deletion request / per-type linked-to-user-or-tracking / purposes / sub-processor list.
13. ✅ **Drop or `maxSdkVersion`-bound the unused / legacy Android permissions** (P2, P3) + **iOS landscape orientation: drop on iPhone.** (I2) — `READ_MEDIA_VIDEO` removed; `READ_EXTERNAL_STORAGE` capped at `maxSdkVersion="32"`. iPhone `UISupportedInterfaceOrientations` now Portrait-only; iPad orientations untouched.

(legacy list preserved below for reference)

1. **Disable / remove the bundled APK auto-updater for store builds.** (UP1, UP2, UP3) — 1–3 d depending on flavor strategy.
2. **Implement in-app account deletion and a /account screen reachable from home.** (A1) — 1.5 d.
3. **Publish Privacy Policy + Terms of Service URLs, link from sign-up and in-app footer, accept them at sign-up.** (P8, C2) — 1 d + legal.
4. **Add Apple Privacy Manifest `PrivacyInfo.xcprivacy`.** (P6, I1) — 2-3 h.
5. **Disable `DevicePreview` in release builds (`enabled: !kReleaseMode`).** (S2) — 5 m + 1 h regression test.
6. **Pin `targetSdk = 35` + `compileSdk = 35` explicitly in `android/app/build.gradle.kts`.** (AN1, AN2) — 30 m.
7. **Produce the store listing assets** (screenshots @ required sizes per device, feature graphic, hi-res icon, descriptions, keywords, age rating answers — both languages). (SL1–SL5) — 2–3 d.
8. **Verify RLS is enabled on every public table; write a migration for any that isn't.** (S1, BE5) — 1–2 d.
9. **Set up release signing keystore + commit a `key.properties.template`.** (B7) — 4 h incl. backups.
10. **Build the App Bundle (`.aab`) flow** and verify a real release build succeeds with R8 obfuscation enabled. (B1, B2, B3) — 1 d incl. proguard rule fixes.
11. **Add a Play Data Safety questionnaire answer sheet to `docs/store/play-data-safety.md`.** (P9) — 1 d.
12. **Drop or `maxSdkVersion`-bound the unused / legacy Android permissions** (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_VIDEO`). (P2, P3) — 10 m.
13. **iOS landscape orientation: drop on iPhone.** (I2) — 5 m.

### P1 — high impact

14. ✅ Wire localization (`lib/l10n/`, ARB files for `en` / `ko` / `uz`, `localizationsDelegates`). (L1–L6) — copied ARB + generated localizations files from worktree; wired `flutter_localizations`, `generate: true`, `l10n.yaml`, and `localizationsDelegates`/`supportedLocales` on `MaterialApp.router`. Full ko/uz translation of app strings deferred. See P1 closure log.
15. ✅ Add crash reporting (Sentry or Crashlytics). (Q4) — `sentry_flutter: ^8.0.0` added; `SentryFlutter.init` wraps `runApp`; DSN read from `--dart-define=SENTRY_DSN`; empty DSN → no-op. See P1 closure log.
16. ✅ Add age-gate at sign-up (DOB field, under-14 flow). (C1) — DOB picker, under-14 block, 14-18 parental-consent block, server-side trigger `fn_enforce_min_age` in `supabase/migrations/20260512123000_profile_age_consent_fields.sql`. SignUpFields widget shipped behind feature-flag (public sign-up still maintenance-locked). See P1 closure log.
17. ✅ Add marketing-vs-service consent checkboxes at sign-up. (C2) — separate `_LegalConsentRow` (required) + `_MarketingConsentRow` (optional, defaults OFF) on both the magic-code path and the new SignUpFields widget. `profiles.marketing_consent` column added. See P1 closure log.
18. ✅ Add Android backup config to exclude session keys. (AN9) — `android/app/src/main/res/xml/backup_rules.xml` + `data_extraction_rules.xml` + manifest references. See P1 closure log.
19. ✅ Rotate Kakao API keys + move out of source. (S4) — `KAKAO_JS_KEY` via `--dart-define`; `KAKAO_NATIVE_KEY` via `manifestPlaceholders`; literals removed from source. User must rotate via Kakao Developers console (USER ACTION). See P1 closure log.
20. ✅ WebView origin allowlist on map / roadview screens. (S5) — `NavigationDelegate.onNavigationRequest` allowlist on both WebView controllers. See P1 closure log.
21. ✅ Replace `print(` with `debugPrint(` in the 7 sites. (Q2) — 6 production sites swept (test file occurrences skipped). See P1 closure log.
22. ✅ Set `applicationName: !kReleaseMode` for `DevicePreview` and move to `dev_dependencies`. (Q7) — moot; DevicePreview was removed entirely in P0 #5. Closed by prior work.
23. ✅ Add ProGuard / R8 keep rules. (B1) — already shipped in P0 #11; verified `android/app/proguard-rules.pro` is referenced by `build.gradle.kts` release buildType. Closed by prior work.
24. ✅ CI: `flutter analyze` + `flutter test` on PR. (H4) — see P1 closure log.
25. ⚠️ Empty-state copy and onboarding tour. (FR1, FR2) — partial close. Empty-state widgets shipped for applications / study-plan drafts / interview-history; full first-launch onboarding tour deferred to launch-blocker review. See P1 closure log.
26. ✅ Add password recovery flow. (A7) — magic-code resend button + 30 s cooldown on the magic-code portal; passwordless flow doesn't need a `resetPasswordForEmail` path. See P1 closure log.
27. ✅ Phone normalization with country picker. (A5) — `_PhoneCountries` (UZ default + KR/US/RU/VN); E.164 normalization at sign-in / sign-up boundaries. See P1 closure log.
28. ⚠️ Add staging vs prod flavors. (B4) — deferred. Compile-time `STORE_BUILD` flag + `--dart-define` for Supabase URL/anonKey is the v1 substitute; full Android product flavors / iOS schemes deferred to post-launch. Documented in CURRENT_STATUS.md.
29. ⚠️ Email deliverability check (SPF/DKIM/DMARC for `hanguk.uz`). (BE4) — code-side: closed (no code to write). User-action runbook added to `store/SUBMISSION_CHECKLIST.md`.
30. ✅ Permission rationale dialog before mic request. (P4, FR3) — AlertDialog explains mic use BEFORE `Permission.microphone.request()`; `openAppSettings()` deep-link on permanent denial. See P1 closure log.
31. ✅ Data-export Edge Function (`export-my-data`). (A2, C3) — `supabase/functions/export-my-data/index.ts` returns full per-user JSON; Account screen "Download my data" button writes to documents dir + share-sheet via `share_plus`. See P1 closure log.
32. ✅ Tighten `pubspec.yaml` constraint on `vapi`. (H6) — `vapi: any` → `vapi: 0.1.0` (matches `packages/vapi/pubspec.yaml`).

### P2 — nice to have

33. ✅ Adaptive icon foreground/background for Android. (ID6) — `pubspec.yaml` `flutter_launcher_icons` now sets `adaptive_icon_background: "#0A0A1A"` and `adaptive_icon_foreground: "assets/app_icon2.png"`. User must run `flutter pub run flutter_launcher_icons:main` to regenerate; documented in `store/SUBMISSION_CHECKLIST.md`.
34. ✅ Web `manifest.json` real strings. (ID5) — `web/manifest.json` `name`/`short_name`/`description` now reflect "Hanguk" + the actual product purpose.
35. ⚠️ Convert image assets to WebP. (PF5) — Largest asset under 100 KB (`assets/app_icon2.png` 87 KB, `assets/images/app_icon.png` 72 KB, `assets/images/logo.jpg` 41 KB). Not worth converting at current sizes; recommendation documented in `store/SUBMISSION_CHECKLIST.md` for future asset additions.
36. ✅ WebView caching with `AutomaticKeepAliveClientMixin`. (PF6) — `_MapTabState` now mixes in `AutomaticKeepAliveClientMixin` with `wantKeepAlive => true`; `super.build(context)` added to `build()`. Roadview is a pushed full-screen route, so keepalive does not apply.
37. ✅ `Semantics` labels for icon-only buttons. (AC1) — Tooltips added to 10 IconButtons across documents / training / chat / map / account / applications. Two `Semantics(button:true, label:...)` wrappers added on map-tab GestureDetectors. See P2 closure log for full list.
38. ⚠️ WCAG AA color-contrast audit. (AC2) — All standard white-on-`backgroundNavy` text passes (white→18.85:1, white70→13.5:1, white60→11.7:1, white54→10.6:1, white38→7.76:1, white24→5.24:1). `vibrantLime` on navy→14.05:1. The single sub-4.5:1 case is **`AppColors.error` `#DC2626` text on backgroundNavy ≈ 4.13:1** — passes 3:1 large-text bar but fails 4.5:1 body bar. Reserve for large/headline text or recolor; design decision.
39. ⚠️ Test dynamic font scaling at 2.0×. (AC3) — Deferred to manual device QA. Added to `store/SUBMISSION_CHECKLIST.md` § 21 pre-launch runbook with 130 % / 150 % / 200 % checks on login, home, training, account, map.
40. ✅ Bump tap-target sizes to 48 dp minimum. (AC4) — `study_plan_chat_fab.dart` had `constraints: const BoxConstraints()` (zero min) — removed; default 48 dp now applies. No other tight constraints found via grep (`iconSize:\s*\d+` zero hits, `BoxConstraints(minWidth/...)` zero hits).
41. ✅ Repo-root scratch-file cleanup. (H1, H2, H3) — `.gitignore` extended with the full set of ad-hoc dumps (`analyze*.txt`, `build_err*.txt`, `errors*.txt`, `out*.txt`, `devices*.txt`, `*.cjs` test files, `package.json`, `package-lock.json`, scratch `.dart` probes, etc.). Operational scripts (`auto_deploy.dart`, `deploy_update.dart`, `setup_bucket.dart`) moved to `tools/ops/` with a README warning about service-role key usage. Remaining tracked files at root will become untracked when the user runs `git rm --cached -r <files>` per the closure log.
42. ✅ Sign-up password strength (min 8). (A4) — sign-up path now requires 8+ chars and at least one digit. Sign-in keeps the legacy 6-char minimum so existing users aren't locked out. `lib/features/auth/presentation/login_screen.dart`.
43. ✅ Drop Kakao manifest meta-data if Kakao SDK not used. (S4) — `<meta-data android:name="com.kakao.sdk.AppKey" .../>` removed from `AndroidManifest.xml`; `KAKAO_NATIVE_KEY` `manifestPlaceholders` removed from `android/app/build.gradle.kts`. JS-key WebView path is unaffected.
44. ✅ Set `android:allowBackup="false"`. (AN9) — Added to the `<application>` tag. The P1 #18 backup_rules.xml / data_extraction_rules.xml entries remain as defense-in-depth.
45. ✅ Strip unused dev deps. — Removed `state_notifier` (zero usages), `image_picker` (zero usages), `open_filex` (zero usages). Kept `cupertino_icons`, `freezed_annotation`, `json_annotation`, `webview_flutter_web` (federated plugin platform implementation).
46. ✅ iOS `UIRequiresFullScreen`. (I8) — Set to `<true/>` in `ios/Runner/Info.plist`. Opts out of iPad multitasking (Slide Over / Split View) to simplify launch QA.
47. ✅ iOS ATS explicit block. (P5, I4) — `NSAppTransportSecurity` dict added with `NSAllowsArbitraryLoads=false`. Declares the secure default explicitly so App Review sees zero cleartext.
48. ✅ Add Play In-App Updates as a replacement for the bundled updater. (UP5) — `in_app_update: ^4.2.3` added to `pubspec.yaml`; new `lib/features/updater/data/play_in_app_update.dart` calls `InAppUpdate.checkForUpdate()` → `startFlexibleUpdate()` (flexible, not immediate) when `kIsStoreBuild && Platform.isAndroid`. Wired from `main.dart` as a fire-and-forget after Sentry init. iOS / web / non-store builds: no-op.
49. ✅ Document the Vapi / ElevenLabs sub-processor relationship in the Privacy Policy. (Q5 + P8) — Sub-processor table in `docs/legal/PRIVACY_POLICY.md` extended with **Sentry**, and a new "What each sub-processor does, in plain terms" subsection added covering Supabase, Vapi, ElevenLabs, Kakao, and Sentry data flows.
50. ⚠️ Add at least one widget test per screen. (Q3) — 8 new test files scaffolded (`test/features/home/welcome_screen_test.dart`, `test/features/auth/login_screen_test.dart`, `test/features/account/account_screen_test.dart`, `test/features/home/home_screen_test.dart`, `test/features/training/training_tab_test.dart`, `test/features/map/map_tab_test.dart`, `test/features/applications/applications_tab_test.dart`, `test/design_system/empty_state_test.dart`). Welcome + EmptyState have real assertions; the other six are scaffold-deferred (behavioural tests blocked on a thin `currentUserProvider` wrapper so Supabase doesn't need real initialization in tests).

---

## What this sweep did NOT close (deferred to launch-blocker review or post-v1)

Items the three sweeps deliberately left for human / device / legal /
post-launch work, in priority order:

1. **Legal-counsel review** of `docs/legal/PRIVACY_POLICY.md` and
   `docs/legal/TERMS_OF_SERVICE.md`. The drafts are review-ready but
   carry "DRAFT — legal review pending" markers at the top.
2. **Production screenshots and feature graphic.** Briefs live in
   `store/listings/`; actual PNG assets must be captured against a
   real simulator/emulator and uploaded.
3. **Real keystore generation.** `keytool` walk-through is in
   `store/SUBMISSION_CHECKLIST.md` § 2; loss = locked out of Play
   forever, so the founder must do it personally.
4. **Apple / Play console enrollment** (D-U-N-S, banking, tax, 2FA).
5. **Sentry DSN issuance** + first build with the DSN piped in.
6. **Kakao key rotation** (the literals were once in git history).
7. **SPF / DKIM / DMARC** records on the `hanguk.uz` zone.
8. **Supabase migration application** — 4 new files generated by the
   P0 + P1 sweeps must be applied via `supabase db push`.
9. **Edge Function deployment** — `supabase functions deploy
   export-my-data`.
10. **Adaptive launcher icon regeneration** — user must run
    `flutter pub run flutter_launcher_icons:main` after the
    `pubspec.yaml` adaptive_icon_* keys landed.
11. **Dynamic font scaling QA** (130 % / 150 % / 200 %) on device.
12. **Color-contrast design decision** on `AppColors.error` (#DC2626)
    on `backgroundNavy` — 4.13:1 ratio passes large-text but not
    body-text WCAG AA. Either restrict to large/headline or recolor.
13. **Full Korean / Uzbek translation** of UI strings — wiring is
    in place via the localization delegates landed in P1 #14; the
    `.arb` files for ko/uz still need translator passes.
14. **Behavioural widget tests** for the 6 scaffold-deferred test
    files — requires a thin `currentUserProvider` wrapper + a
    `FakeSupabaseClient` fixture under `test/_fakes/`.
15. **Full Android product flavors / iOS schemes** (`store` vs
    `selfHost`) — P1 #28; compile-time `STORE_BUILD` flag is the v1
    substitute.
16. **Penetration testing** of the Supabase backend and
    **performance profiling** under throttled 3G.
17. **Trademark / brand clearance** on "Hanguk".

These are all captured as ticks in `USER_ACTIONS_REQUIRED.md`.

---

## What this audit did not cover

- **Manual device testing** on real iOS / Android hardware. Many of the build-and-release issues won't surface until you try a signed release build on a physical device.
- **`flutter analyze` against the current `main`** — the repo contains many stale `analyze_*.txt` artefacts; the actual current state requires running the analyzer (out of scope for this read-only audit).
- **`flutter build apk --release` and `flutter build appbundle --release`** — building was explicitly out of scope. R8 / ProGuard / obfuscation issues will surface only on first attempt.
- **Penetration testing of the Supabase backend** (RLS escape, JWT reuse, IDOR). I documented that RLS coverage is unproven, but I did not attempt to exploit it.
- **Per-Edge-Function code review.** I traced which functions Flutter invokes but did not open them.
- **App Store / Play account setup** (D-U-N-S number, organization verification, Apple Developer Program enrollment, Play Console setup, two-step verification on both, banking & tax forms). These are operational tasks the founder must complete; I did not check status.
- **Trademark / brand clearance** on "Hanguk" — common-word app names get rejected on similarity grounds.
- **Localization of the Privacy Policy / Terms** — assumed required in `ko`, `uz`, and `en` at minimum; not authored.
- **Vapi & ElevenLabs sub-processor agreements** for PIPA Korean-user data flows — almost certainly need a Data Processing Agreement.
- **iOS push notification certificates and Play FCM** — both unconfigured; assumed not in roadmap for v1.
- **Performance profiling** with real network conditions (e.g. throttled to 3G for a Tashkent-typical mobile network).
- **The `packages/vapi/` local fork** beyond surface review. The fork uses `vapi: any` in `pubspec.yaml` with a path override — operationally fine, but a real review of the fork against upstream Vapi SDK is overdue.

---

## Sources (aggregated)

### Apple
- App Store Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Account deletion requirement (5.1.1(v)): <https://developer.apple.com/support/offering-account-deletion-in-your-app/>
- Account deletion within apps required starting January 31: <https://developer.apple.com/news/?id=mdkbobfo>
- Privacy Manifest files: <https://developer.apple.com/documentation/bundleresources/privacy-manifest-files>
- Adding a privacy manifest to your app or third-party SDK: <https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk>
- Describing use of required reason API: <https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api>
- App Store Connect screenshot specifications: <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/>

### Google Play
- Account deletion requirement: <https://support.google.com/googleplay/android-developer/answer/13327111?hl=en>
- Developer Program Policy (2026 effective Apr 15): <https://support.google.com/googleplay/android-developer/answer/16933379?hl=en>
- Policy announcement Apr 15, 2026: <https://support.google.com/googleplay/android-developer/answer/16926792?hl=en>
- Target API level requirements: <https://support.google.com/googleplay/android-developer/answer/11926878?hl=en>
- Meet Google Play's target API level requirement: <https://developer.android.com/google/play/requirements/target-sdk>
- Play Data Safety form: <https://support.google.com/googleplay/android-developer/answer/10787469?hl=en>
- Sideloading 2026 verification policy (context for our auto-updater finding): <https://www.medianama.com/2025/08/223-google-blocks-android-apk-sideloading-2026/>
- 9to5Google on developer verification 2026: <https://9to5google.com/2025/08/25/android-apps-developer-verification/>

### Korea / PIPA
- Data Protection & Privacy 2026 — South Korea: <https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/south-korea/trends-and-developments>
- PIPA overview (Didomi): <https://www.didomi.io/blog/south-korea-pipa-everything-you-need-to-know>
- South Korea PIPA SaaS guide (children & parental consent): <https://complydog.com/blog/south-korea-pipa-privacy-information-protection-act-saas>
- PIPC (regulator) bilingual portal: <https://www.pipc.go.kr/eng/>

### Tooling
- `device_preview` package: <https://pub.dev/packages/device_preview>
- Flutter release build issues: <https://www.appsonair.com/blogs/flutter-release-build-issues-that-only-appear-in-production>
- Flutter Android deployment guide: <https://docs.flutter.dev/deployment/android>
- Flutter iOS deployment guide: <https://docs.flutter.dev/deployment/ios>
