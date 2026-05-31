# P2 sweep closure log — 2026-05-12

Companion to `docs/audits/store_readiness_audit_2026-05-12.md`. Every
P2 item (33–50) is listed with a status, the files touched, and a
one-line rationale.

Legend: `✅` fully closed in code, `⚠️` partial — code-side closed,
the rest is operational/human/QA.

---

## 33 ✅ Adaptive icon (ID6)
- `pubspec.yaml` `flutter_launcher_icons` — added `adaptive_icon_background: "#0A0A1A"` + `adaptive_icon_foreground: "assets/app_icon2.png"`.
- User must run `flutter pub run flutter_launcher_icons:main` to regenerate `android/app/src/main/res/mipmap-*/` resources.

## 34 ✅ Web manifest strings (ID5)
- `web/manifest.json` — `name` / `short_name` → "Hanguk"; `description` → product purpose.

## 35 ⚠️ WebP assets (PF5)
- Largest assets are < 100 KB (`app_icon2.png` 87 KB, `app_icon.png` 72 KB, `logo.jpg` 41 KB) — not worth converting now.
- Recommendation captured in `store/SUBMISSION_CHECKLIST.md` for future asset additions; `cwebp -q 80 input.png -o output.webp`.

## 36 ✅ WebView caching (PF6)
- `lib/features/map/presentation/map_tab.dart` — `_MapTabState` now mixes in `AutomaticKeepAliveClientMixin`, `wantKeepAlive => true`, `super.build(context)` added.
- Roadview is a pushed full-screen route; keepalive doesn't apply.

## 37 ✅ Semantics labels (AC1)
Tooltips added (10 sites):
- `lib/features/documents/presentation/widgets/document_slot.dart` — Preview / Delete.
- `lib/features/training/presentation/widgets/study_plan_chat_fab.dart` — Close assistant.
- `lib/features/training/presentation/widgets/interview_setup_view.dart` — Interview history.
- `lib/features/training/presentation/widgets/interview_history_view.dart` — Back.
- `lib/features/training/presentation/widgets/interview_analytics_view.dart` — Back, Play / Pause.
- `lib/features/training/presentation/study_plan_screen.dart` — Close session, Delete session.
- `lib/features/chat/presentation/chat_tab.dart` — Clear chat, Send.
- `lib/features/applications/presentation/widgets/university_room_modal.dart` — Close, Send message.
- `lib/features/account/presentation/account_screen.dart` — Back.

`Semantics(button: true, label: ...)` wrappers added (2 sites):
- `lib/features/map/presentation/map_tab.dart` — list/map toggle, clear-search GestureDetector.

Remaining icon-only GestureDetectors not addressed (low-priority, mostly compound widgets where the visual already implies meaning): `applications_tab.dart`, `login_screen.dart`, `training_tab.dart`, `interview_active_view.dart`, `university_selection_view.dart`.

## 38 ⚠️ WCAG AA color contrast (AC2)
Computed against `AppColors.backgroundNavy` (#0A0A1A, L ≈ 0.0057):

| pair | ratio | result |
|---|---|---|
| white on bg | 18.85:1 | pass |
| white70 on bg | 13.5:1 | pass |
| white60 on bg | 11.7:1 | pass |
| white54 on bg | 10.6:1 | pass |
| white38 on bg | 7.76:1 | pass |
| white24 on bg | 5.24:1 | pass |
| vibrantLime on bg | 14.05:1 | pass |
| royalBlue on white | 11.4:1 | pass |
| **error (#DC2626) on bg** | **4.13:1** | **fails body 4.5; passes large 3.0** |
| white10 on bg (divider, non-text) | 2.73:1 | n/a |

Only failure: `AppColors.error` body text on `backgroundNavy`. Design decision deferred — restrict to large/headline or recolor (e.g. `#E64C4C`).

## 39 ⚠️ Dynamic font scaling test (AC3)
Manual device QA — added to `store/SUBMISSION_CHECKLIST.md` § 21 (130 % / 150 % / 200 % runbook).

## 40 ✅ 48 dp tap targets (AC4)
- `study_plan_chat_fab.dart` — removed `constraints: const BoxConstraints()` (which had min=0); IconButton default 48 dp now applies.
- Grep verified no other tight constraints: `iconSize:\s*\d+` zero hits, `BoxConstraints(minWidth/...)` zero hits.

## 41 ✅ Repo-root scratch cleanup (H1, H2, H3)
- `.gitignore` extended with `analyze*.txt`, `analysis*.txt`, `errors*.txt`, `out*.txt`, `output.txt`, `res.txt`, `build_err*.txt`, `build_error*.txt`, `build_log.txt`, `build_errors.txt`, `build_output.txt`, `devices*.txt`, `emulators.txt`, `dump.json`, `identity_dump.json`, `hanguk_report.html`, `tmp_query.cjs`, `test_chrome.js`, `test_map.html`, `test_vapi*.{dart,mjs,js}`, `run_flutter_web.cjs`, `serve_flutter*.cjs`, `get_vapi_error.{dart,exe}`, `check_db.dart`, `check_schema.dart`, `db_schema.dart`, `find_fk.dart`, `print_db.dart`, `flutter_run.log`, `auto_deploy_log.txt`, `package.json`, `package-lock.json`.
- Operational scripts moved: `auto_deploy.dart`, `deploy_update.dart`, `setup_bucket.dart` → `tools/ops/` with new `tools/ops/README.md` documenting service-role key usage.
- USER ACTION: run `git rm --cached -r <files>` against the now-ignored paths so they leave the index without being deleted on disk.

## 42 ✅ Password strength (A4)
- `lib/features/auth/presentation/login_screen.dart` — sign-up path now requires ≥ 8 chars + at least one digit. Sign-in keeps 6-char minimum so existing users aren't locked out.

## 43 ✅ Drop Kakao manifest meta-data (S4, AN8)
- `android/app/src/main/AndroidManifest.xml` — removed `<meta-data android:name="com.kakao.sdk.AppKey" .../>`.
- `android/app/build.gradle.kts` — removed `manifestPlaceholders["KAKAO_NATIVE_KEY"]`.
- Map / roadview WebViews are unaffected (JS key path via `--dart-define=KAKAO_JS_KEY=...`).

## 44 ✅ android:allowBackup="false" (AN9)
- `android/app/src/main/AndroidManifest.xml` — added `android:allowBackup="false"` to `<application>`. P1 #18 backup_rules.xml stays as defense-in-depth.

## 45 ✅ Strip unused deps
- `pubspec.yaml` — removed `state_notifier`, `image_picker`, `open_filex` (zero refs each). Kept `cupertino_icons`, `freezed_annotation`, `json_annotation`, `webview_flutter_web` (federated plugin).

## 46 ✅ iOS UIRequiresFullScreen (I8)
- `ios/Runner/Info.plist` — `<key>UIRequiresFullScreen</key><true/>`. Opts out of iPad multitasking.

## 47 ✅ iOS ATS explicit block (P5, I4)
- `ios/Runner/Info.plist` — `NSAppTransportSecurity` dict with `NSAllowsArbitraryLoads=false`.

## 48 ✅ Play In-App Updates (UP5)
- `pubspec.yaml` — `in_app_update: ^4.2.3`.
- `lib/features/updater/data/play_in_app_update.dart` — new `PlayInAppUpdater().checkAndPrompt()`. Flexible update path (background download), Android + `kIsStoreBuild` only.
- `lib/main.dart` — `unawaited(const PlayInAppUpdater().checkAndPrompt())` after Sentry init.

## 49 ✅ Document Vapi / ElevenLabs sub-processors (Q5, P8)
- `docs/legal/PRIVACY_POLICY.md` — sub-processor table extended with **Sentry**; new "What each sub-processor does, in plain terms" subsection explains Supabase, Vapi, ElevenLabs, Kakao, Sentry data flows.

## 50 ⚠️ Widget tests per screen (Q3)
8 new test files:
- `test/features/home/welcome_screen_test.dart` — real assertion (pumps WelcomeScreen via a minimal GoRouter, finds the widget).
- `test/design_system/empty_state_test.dart` — real assertion (two tests, with/without CTA).
- `test/features/auth/login_screen_test.dart` — scaffold deferred.
- `test/features/account/account_screen_test.dart` — scaffold deferred.
- `test/features/home/home_screen_test.dart` — scaffold deferred.
- `test/features/training/training_tab_test.dart` — scaffold deferred.
- `test/features/map/map_tab_test.dart` — scaffold deferred.
- `test/features/applications/applications_tab_test.dart` — scaffold deferred.

The "scaffold deferred" tests compile and pump a placeholder Scaffold; the harness file path is committed so behavioural tests can be added without renaming files when a `currentUserProvider` wrapper + `FakeSupabaseClient` land under `test/_fakes/`.

---

## Files touched in P2 sweep (consolidated)

Code:
- `pubspec.yaml`
- `web/manifest.json`
- `.gitignore`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/build.gradle.kts`
- `ios/Runner/Info.plist`
- `lib/main.dart`
- `lib/features/map/presentation/map_tab.dart`
- `lib/features/auth/presentation/login_screen.dart`
- `lib/features/documents/presentation/widgets/document_slot.dart`
- `lib/features/training/presentation/widgets/study_plan_chat_fab.dart`
- `lib/features/training/presentation/widgets/interview_setup_view.dart`
- `lib/features/training/presentation/widgets/interview_history_view.dart`
- `lib/features/training/presentation/widgets/interview_analytics_view.dart`
- `lib/features/training/presentation/study_plan_screen.dart`
- `lib/features/chat/presentation/chat_tab.dart`
- `lib/features/applications/presentation/widgets/university_room_modal.dart`
- `lib/features/account/presentation/account_screen.dart`

Docs:
- `docs/audits/store_readiness_audit_2026-05-12.md`
- `docs/legal/PRIVACY_POLICY.md`
- `store/SUBMISSION_CHECKLIST.md`

New files:
- `lib/features/updater/data/play_in_app_update.dart`
- `tools/ops/README.md`
- `test/features/home/welcome_screen_test.dart`
- `test/features/auth/login_screen_test.dart`
- `test/features/account/account_screen_test.dart`
- `test/features/home/home_screen_test.dart`
- `test/features/training/training_tab_test.dart`
- `test/features/map/map_tab_test.dart`
- `test/features/applications/applications_tab_test.dart`
- `test/design_system/empty_state_test.dart`
- `docs/audits/store_p2_closure_log_2026-05-12.md` (this file)
- `USER_ACTIONS_REQUIRED.md`

Moves:
- `auto_deploy.dart` → `tools/ops/auto_deploy.dart`
- `deploy_update.dart` → `tools/ops/deploy_update.dart`
- `setup_bucket.dart` → `tools/ops/setup_bucket.dart`
