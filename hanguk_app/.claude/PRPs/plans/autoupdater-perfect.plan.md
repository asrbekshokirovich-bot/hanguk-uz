# Plan: Make the Auto-Updater Production-Ready

## Summary
Take the current Android-only "open APK in browser" updater and turn it into a robust cross-platform update system: proper release signing, in-app download with progress + SHA-256 integrity verification, periodic background checks, staged rollouts with channels, real version telemetry, and per-platform behaviour (silent install on Android, App Store deep link on iOS, service-worker reload on web, OS-native installer prompts on desktop).

## User Story
As a Hanguk student running version 1.0.18 of the mobile app,
I want the app to detect new releases anywhere in my session, show me what changed, download the update with a real progress bar, verify it hasn't been tampered with, and install it without sending me through three confusing browser screens —
so that I'm always running the version my counsellor expects me to be on, with the new fixes the team just shipped.

As an owner / counsellor,
I want a dashboard view showing exactly how many students are on each app version, plus the ability to halt a bad release by rolling back the canary —
so that a buggy build doesn't lock 89 students out of the portal.

## Confirmed current state (audited just now)

**DB — `public.app_versions`:**
| column | type | nullable | default |
|---|---|---|---|
| id | text | NO | — (only `'android'` row exists) |
| latest_version | text | NO | — (`'1.0.18+2031'`) |
| download_url | text | NO | — (Supabase Storage public bucket) |
| force_update | bool | YES | `true` |

**Client** ([`lib/features/updater/data/updater_repository.dart`](../../../lib/features/updater/data/updater_repository.dart)):
- Hard-skips when `kIsWeb || !Platform.isAndroid` → iOS, web, desktop are dead
- Reads local version via `package_info_plus`, splits on `+` for `version+build`, compares semver-style
- On update: `launchUrl(externalApplication)` — opens browser, browser downloads APK, user manually opens APK, Android prompts to install. Three taps minimum. APK can fail at any step silently.
- No SHA verification. No size hint. No release notes. No retry.

**UI** ([`lib/features/updater/presentation/update_dialog.dart`](../../../lib/features/updater/presentation/update_dialog.dart)):
- Pops up only on login screen mount. Already-logged-in students stay on stale builds indefinitely.
- Has placeholder `_isDownloading` / `_progress` state but **never sets them** — the progress UI is dead code.
- `force_update=true` blocks dismissal via `PopScope`, but the user can still kill the app and bypass it.

**Build config** — *the actual shipping blocker*:
- `android/app/build.gradle.kts:35-37` says `signingConfig = signingConfigs.getByName("debug")` with a TODO. **Release builds are signed with debug keys.** Android refuses to install an APK over an existing app if the signing certificate differs, so any release-to-release update from a properly-signed build would BRICK existing installs. This must be fixed before any other update work has meaning.

**App version**: `1.0.18+2031` ([pubspec.yaml:16](../../../pubspec.yaml#L16)) — matches DB row, so the existing 71 logged-in students are at the latest version.

## Problem → Solution

**Current state.** Single-platform, browser-launched, no integrity check, no progress, no telemetry, no staged rollout, signed with debug keys. Works for "1 of 1" students on Android Wi-Fi. Falls over for everyone else.

**Desired state.** Per-platform update flow that:
- Knows what platform + arch the device is on and fetches the matching artifact
- Verifies the downloaded artifact against a server-published SHA-256
- Shows a real progress bar tied to actual byte counts
- Prompts for install via the right OS API (PackageManager.Session on Android, App Store deep-link on iOS, browser on desktop, service-worker reload on web)
- Reports version + platform back to a `app_version_pings` table on every app start for telemetry
- Supports release channels (stable / beta) via student opt-in
- Supports staged rollout by `rollout_percentage` with deterministic per-device dice
- Has a `min_supported_version` floor — anything below it is force-updated regardless of `force_update` flag

## Metadata
- **Complexity**: Large (cross-platform, signing setup, telemetry infra, server schema)
- **Source PRD**: User request: "make autoupdater system perfectly"
- **PRD Phase**: Major upgrade
- **Estimated Files**: ~10 Dart + 1 SQL migration + Android/iOS/web/desktop config + Edge Function for telemetry
- **Estimated Effort**: 14–22h

## Decisions you need to confirm before code

| # | Decision | Recommended | Why |
|---|---|---|---|
| **A** | Cross-platform scope: which platforms must work in v1? | **Android (full silent install) + iOS (App Store deep-link) + Web (service-worker reload). Skip desktop.** | The Hanguk app is mobile-first; Windows/macOS/Linux desktop have ~0 users. Adding desktop balloons effort 2× for ~0% audience. |
| **B** | Release-signing strategy | **Generate a real upload keystore now, store it as Play App Signing or as a Supabase secret encrypted with sops/age, restore in CI** | Without this, all of part 1 is theatre — production updates can't actually install on top of the current debug-signed build. |
| **C** | Distribution channel for Android | **Stay with self-hosted APK in Supabase Storage** (no Play Store) | The app appears to be distributed outside Play Store. Adding Play Store now is a separate decision (review process, account setup, etc.). The plan optimises self-hosted but flags Play Store as a future option. |
| **D** | Install permission model on Android | **Request `REQUEST_INSTALL_PACKAGES`** + use `install_plugin` or `flutter_app_installer` for one-tap silent install | Without it the user has to enable "Install unknown apps" per-app. With it, one prompt. |
| **E** | Telemetry granularity | **`app_version_pings(user_id, platform, version, build, locale, last_seen_at)` upserted on every app launch** | Lets the CRM see exactly how many students are on which version without per-event log volume. |

## Risk Register

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Release keystore not yet generated** — debug-signed → real-signed transition will brick existing installs | Every currently-installed app on a student's phone is debug-signed (1.0.18+2031). Switching to a real keystore changes the certificate. Android refuses install on cert mismatch. **The first proper-signed release wipes-and-reinstalls every existing student's app, losing local cache.** | Plan ships v1 of the proper signing alongside a `force_full_reinstall` flag in `app_versions`. The dialog explicitly tells the user "you'll need to log in again". The 71 existing logged-in students get a one-time disruption; from that release forward, normal updates are seamless. |
| **APK install permission UX on Android 13+** | Some OEMs (Samsung, Xiaomi) bury the "install unknown apps" toggle in 4 settings menus | Detect via `permission_handler` + show a help screen with screenshots when the prompt is denied. Keep "Update via browser" as a secondary fallback. |
| **iOS can't actually self-install** | Apple sandbox + no enterprise cert | Plan does NOT pretend to. iOS path = "version mismatch detected" → tap → opens App Store deep-link to the Hanguk listing. (Requires a real App Store listing — flag as separate decision if not present yet.) |
| **Force-update lock-out** | If a new version is broken AND force-update is on, students cannot use the app at all | `min_supported_version` row + dashboard kill-switch query. Owner can revert `app_versions` in seconds. Build a 1-line SQL hot-fix into the runbook. |
| **Update during interview / payment / critical flow** | Showing an update dialog mid-WebRTC interview is jarring | Update checks throttle to once per app foreground transition, defer the dialog if `interviewProvider.status == 'active'` or any modal is open |
| **Bandwidth on metered cellular** | APK is ~50MB+. Auto-downloading on cell can burn data | Default to "Wi-Fi only" for auto-download with a clear UI toggle to override |
| **Tampered APK download** | Self-hosted APK with no integrity check is a supply-chain attack vector | Server publishes `sha256` per release; client verifies the downloaded file matches before invoking install |
| **Service worker stale on web** | PWA visitors on the web target are stuck on the cached build forever | New SW version → `skipWaiting` + `clients.claim` + reload prompt with a "Reload to update" toast |
| **App Store deep-link wrong on iOS** | Wrong URL = sends user to a random unrelated app | `iosAppStoreUrl` is a server-published field, validated by the client before navigating |
| **Background-check battery drain** | Naïve periodic polling drains battery | Use `WidgetsBindingObserver.didChangeAppLifecycleState` (free) plus an optional `workmanager` task that runs at most once per 24h |

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | [`lib/features/updater/data/updater_repository.dart`](../../../lib/features/updater/data/updater_repository.dart) | Current entire updater logic — 113 lines |
| P0 | [`lib/features/updater/presentation/update_dialog.dart`](../../../lib/features/updater/presentation/update_dialog.dart) | Current UI; the dead progress-bar fields (`_isDownloading`, `_progress`) need replacing |
| P0 | [`lib/features/auth/presentation/login_screen.dart:62-72`](../../../lib/features/auth/presentation/login_screen.dart#L62) | The single trigger point that calls `_checkForUpdates()` today |
| P0 | [`android/app/build.gradle.kts`](../../../android/app/build.gradle.kts) | Release signing config — currently using debug keys, **must be fixed first** |
| P0 | [`pubspec.yaml`](../../../pubspec.yaml) | Adds `install_plugin`, `dio` (resumable downloads), `workmanager`, `crypto`, `device_info_plus` |
| P1 | [`web/index.html`](../../../web/index.html) and [`web/flutter_service_worker.js` (generated by Flutter)](../../../web/) | Service-worker update model |
| P1 | [`ios/Runner/Info.plist`](../../../ios/Runner/Info.plist) | App Store URL hint, version display string |
| P2 | [Android docs — REQUEST_INSTALL_PACKAGES](https://developer.android.com/reference/android/Manifest.permission#REQUEST_INSTALL_PACKAGES) | Permission required for one-tap install |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Android `PackageInstaller.Session` | developer.android.com | The right API for silent install in 2026; replaces the deprecated `ACTION_INSTALL_PACKAGE` intent |
| `install_plugin` | pub.dev/packages/install_plugin | Wraps PackageInstaller. Supports Android 7+ |
| `dio` resumable download | pub.dev/packages/dio | `dio.download(url, path, onReceiveProgress: ..., options: Options(headers: {'range': ...}))` |
| Flutter web service-worker update | flutter.dev/docs | `flutter_service_worker.js` includes a manifest hash; bumping `version: x.y.z+N` in pubspec triggers a SW reload prompt |
| App Store deep-link format | developer.apple.com | `https://apps.apple.com/app/idXXXXXXXXX` — the `id` is a numeric Apple ID assigned at App Store Connect signup |
| Play App Signing | developer.android.com | Lets Google manage the upload key; the app key never leaves Play servers. Optional but recommended for keystore safety. |

## Patterns to Mirror

### `auth_repository.dart` typed-error pattern (just shipped)
The magic-code login fix introduced `_messageFor(code, detail)` to map server error codes to user-facing strings. Mirror this in `UpdaterRepository` for the various failure modes (`NETWORK_ERROR`, `HASH_MISMATCH`, `INSTALL_DENIED`, `STORAGE_FULL`, etc.).

### Riverpod Notifier with sealed state
```dart
sealed class UpdateState {
  const UpdateState();
}
final class UpdateIdle extends UpdateState { const UpdateIdle(); }
final class UpdateAvailable extends UpdateState { const UpdateAvailable(this.info); final AppVersionInfo info; }
final class UpdateDownloading extends UpdateState {
  const UpdateDownloading({required this.bytesDownloaded, required this.totalBytes});
  final int bytesDownloaded;
  final int totalBytes;
  double get progress => totalBytes > 0 ? bytesDownloaded / totalBytes : 0;
}
final class UpdateInstalling extends UpdateState { const UpdateInstalling(); }
final class UpdateFailed extends UpdateState {
  const UpdateFailed(this.code, this.detail);
  final String code; final String? detail;
}
```
Forces exhaustive switch in the UI so we can't forget to handle a state.

### Single update-check choke point
All call sites (login screen, app resume, periodic) call `ref.read(updaterProvider.notifier).check()` with debouncing built in. No raw API calls scattered around.

## Files to Change

| File | Action | Why |
|---|---|---|
| `android/app/build.gradle.kts` | UPDATE | **Wire a real release signing config** (keystore from `key.properties`); remove the debug-keys TODO |
| `android/app/src/main/AndroidManifest.xml` | UPDATE | Add `REQUEST_INSTALL_PACKAGES` permission |
| `android/app/key.properties.template` + `.gitignore` rule | CREATE | Template for the keystore properties (real `key.properties` + `.jks` are gitignored) |
| `pubspec.yaml` | UPDATE | Add `install_plugin: ^2.x`, `dio: ^5.x`, `crypto: ^3.x`, `workmanager: ^0.5.x`, `device_info_plus: ^11.x`. Bump app version to `1.0.19+2032` |
| `lib/features/updater/data/updater_repository.dart` | REWRITE | Sealed `UpdateState`, per-platform branches, dio download with progress, SHA-256 verify, install_plugin invocation, telemetry ping |
| `lib/features/updater/data/app_version_info.dart` | CREATE (extracted) | Move `AppVersionInfo` to its own file, add `sha256`, `sizeBytes`, `releaseNotes`, `minSupportedVersion`, `iosAppStoreUrl`, `channel`, `rolloutPercentage`, `forceFullReinstall` fields |
| `lib/features/updater/data/version_compare.dart` | CREATE | Pure-Dart semver+build comparator with thorough test coverage (the inline parser in v1 has edge-case bugs) |
| `lib/features/updater/data/update_telemetry.dart` | CREATE | One-shot ping on app launch: upserts `(user_id, platform, version, build, last_seen_at)` |
| `lib/features/updater/presentation/update_dialog.dart` | REWRITE | Real progress bar, release-notes section, "Wi-Fi only" toggle, sealed-state-driven UI |
| `lib/features/updater/presentation/update_gate.dart` | CREATE | Wrap `MaterialApp` so update checks fire on app resume + at startup, not just login |
| `lib/main.dart` or wherever the app root is | UPDATE | Wrap with `UpdateGate`; register `WorkmanagerCallbackDispatcher` for daily background check |
| `web/index.html` + `web/service_worker_update_handler.js` | CREATE/UPDATE | Listen for `controllerchange`, show "new version available — reload" toast |
| `supabase/migrations/<ts>_app_versions_v2_schema.sql` | CREATE | Add columns: `sha256 text`, `size_bytes bigint`, `release_notes text`, `min_supported_version text`, `ios_app_store_url text`, `channel text not null default 'stable'`, `rollout_percentage int not null default 100`, `force_full_reinstall bool default false`. Backfill the existing android row. Compose primary key: `(id, channel)`. |
| `supabase/migrations/<ts>_app_version_pings_table.sql` | CREATE | `app_version_pings(user_id uuid pk, platform text, version text, build int, locale text, channel text, last_seen_at timestamptz, raw_user_agent text)` + RLS so users can only upsert their own row |
| `(functions repo) supabase/functions/version-ping/index.ts` | CREATE | Receives ping JSON, validates with auth JWT, upserts the row. Exists to enforce write-only-your-own-row even if RLS is wrong. |
| `(views) public.version_distribution view` | CREATE | Materialised view: `select platform, version, count(*) from app_version_pings group by …` for the CRM dashboard |
| `test/features/updater/**` | CREATE | 80%+ coverage on `version_compare`, `updater_repository` (mocked dio), and `UpdateGate` widget tests |

## NOT Building
- Hot Dart code updates / CodePush — App Store policy violation, fragility.
- iOS sideloading — Apple sandbox prevents it. iOS path is App Store deep-link only.
- Desktop platforms (Windows/macOS/Linux) — ~0 users; defer.
- Differential / delta updates — interesting but outside scope; Phase 2.
- Auto-rollback on crash — needs crash-loop detection + signed previous-APK retention; Phase 2.
- A/B testing framework — different feature.
- Background "silent update while user sleeps" — battery drain, Doze mode complications, OEM behaviour drift; defer.
- Play Store distribution — separate business decision (account, review process, feature gating differences); defer.

---

## Step-by-Step Tasks

### Task 0 — **(BLOCKER)** Generate the release keystore and wire it
Without this the rest of the plan can't actually update existing installs.

```bash
# Generate
keytool -genkey -v -keystore ~/keys/hanguk-upload.jks -keyalg RSA -keysize 4096 -validity 25000 -alias hanguk-upload

# Save in repo (gitignored): android/key.properties
storePassword=...
keyPassword=...
keyAlias=hanguk-upload
storeFile=/absolute/path/to/hanguk-upload.jks
```

Update `android/app/build.gradle.kts` to load `key.properties` and use it for `signingConfigs.release`. Remove the `signingConfig = signingConfigs.getByName("debug")` line.

Push the new keystore to a Supabase project secret (encrypted via sops/age) so CI can rebuild signed APKs. Document the keystore custody process in `docs/RELEASE.md` (lose this file = you can never update the app again).

**ACCEPTANCE**: `flutter build apk --release` produces an APK whose `apksigner verify --print-certs` shows the upload-key cert, NOT the Android debug cert.

### Task 1 — DB schema upgrade for `app_versions`

```sql
alter table public.app_versions
  add column if not exists sha256 text,
  add column if not exists size_bytes bigint,
  add column if not exists release_notes text,
  add column if not exists min_supported_version text,
  add column if not exists ios_app_store_url text,
  add column if not exists channel text not null default 'stable',
  add column if not exists rollout_percentage int not null default 100
    check (rollout_percentage between 0 and 100),
  add column if not exists force_full_reinstall bool not null default false;

-- Existing primary key was (id). Replace with (id, channel) so we can have
-- separate stable+beta rows per platform.
alter table public.app_versions drop constraint app_versions_pkey;
alter table public.app_versions add primary key (id, channel);

-- Backfill the existing android row's sha256 by computing it on the
-- already-uploaded artifact (one-shot manual step, see runbook).
```

Then a `app_version_pings` table:
```sql
create table public.app_version_pings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  platform text not null,
  version text not null,
  build int,
  locale text,
  channel text not null default 'stable',
  raw_user_agent text,
  last_seen_at timestamptz not null default now()
);
alter table public.app_version_pings enable row level security;
create policy "users upsert own ping" on public.app_version_pings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index app_version_pings_platform_version_idx
  on public.app_version_pings (platform, version);
```

And the dashboard view:
```sql
create or replace view public.version_distribution as
select platform, version, channel, count(*) as device_count,
       max(last_seen_at) as latest_ping
from public.app_version_pings
group by 1,2,3
order by platform, version desc;
```

### Task 2 — Re-architect `updater_repository.dart` around sealed state

The new repository:
1. On app launch + foreground transitions → `check()`
2. Reads platform via `Platform.operatingSystem` + `kIsWeb`
3. Queries `app_versions WHERE id = <platform> AND channel = <user's channel>`
4. Applies rollout dice: `hash(deviceId + version) % 100 < rollout_percentage` else treat as no update
5. Compares versions with the new `version_compare.dart`
6. Emits `UpdateAvailable(info)` if newer
7. Tracks `min_supported_version`: if local < min, escalate to force-update regardless of `force_update` flag

Per-platform install flow:
- **Android**: `dio.download` to `/tmp/hanguk_app_<version>.apk` with `onReceiveProgress` → `UpdateDownloading` state. After download, compute SHA-256 and compare to `info.sha256`. On mismatch → `UpdateFailed('HASH_MISMATCH')`. On match → `install_plugin.installApk(filePath, packageName)` → handoff to OS.
- **iOS**: skip download; `launchUrl(info.iosAppStoreUrl, mode: externalApplication)`.
- **Web**: don't download; trigger `window.location.reload(true)` after the service worker has updated.
- **Desktop** (out of scope per Decision A): no-op.

### Task 3 — Real progress UI

Rewrite `update_dialog.dart` to switch on `UpdateState`:
- `UpdateAvailable`: show version, size in MB, release notes, "Update Now" / "Later" (latter hidden if force or below min)
- `UpdateDownloading`: show `LinearProgressIndicator(value: state.progress)` and "X.X MB / Y.Y MB"
- `UpdateInstalling`: spinner + "Verifying and installing…"
- `UpdateFailed(code, detail)`: human message, retry button, optional "Open in browser" fallback

Add a "Wi-Fi only" toggle that persists in `SharedPreferences` so cellular students aren't surprised.

### Task 4 — Lifecycle-aware update gate

Create `UpdateGate` widget that wraps `MaterialApp.builder`. It:
- Subscribes to `WidgetsBinding.lifecycleListenable` for foreground transitions
- Calls `check()` at most once per foreground (debounced)
- Defers showing the dialog if the active route is interview-active or any other "do-not-interrupt" screen (registered list)

Replace `_checkForUpdates()` call in `login_screen.dart:62` with a no-op (gate handles it).

### Task 5 — Telemetry ping

On app start, after auth is resolved, call `update_telemetry.dart` which upserts:
```dart
final pkg = await PackageInfo.fromPlatform();
final dev = await DeviceInfoPlugin().deviceInfo;
await supabase.from('app_version_pings').upsert({
  'user_id': supabase.auth.currentUser!.id,
  'platform': Platform.operatingSystem,
  'version': pkg.version,
  'build': int.tryParse(pkg.buildNumber),
  'locale': PlatformDispatcher.instance.locale.toLanguageTag(),
  'channel': await _userChannelOrDefault(),
  'raw_user_agent': dev.toString(),
  'last_seen_at': DateTime.now().toIso8601String(),
});
```
Wrap in try/catch; never let a telemetry failure bubble to the UI.

### Task 6 — Periodic background check (Android only)

Register a `workmanager` task that wakes once every 24h (battery-friendly: PERIODIC, not exact alarm) and pings the version endpoint. If an update is available + non-force → show a system notification. iOS background tasks are too constrained to be worth it; defer.

### Task 7 — Web service-worker update path

Flutter web's generated `flutter_service_worker.js` already supports update detection. Add a small JS shim in `web/index.html` that:
- Listens for `navigator.serviceWorker.controller` changes
- Posts a custom event into Flutter via `window.dispatchEvent`
- Flutter listens via `dart:html` and emits `UpdateAvailable` with `forceUpdate: false`
- Dialog says "New version detected — reload to update", on tap → `window.location.reload(true)`

### Task 8 — Tests
- `version_compare_test.dart`: 30+ cases (`1.0.0+1` vs `1.0.0+2`, `1.0.0` vs `1.0.0+1`, equal, dotted, weird inputs)
- `updater_repository_test.dart`: mocked dio + supabase; covers each `UpdateState` transition + each typed error
- `update_dialog_test.dart`: golden tests for each state; tap-handler coverage
- `update_gate_test.dart`: simulate lifecycle transitions, verify debounce
- Manual matrix on real device:
  - Android emulator: install old build → DB row updated → app foreground → dialog → tap update → progress → SHA verify → install prompt → new version
  - iOS simulator: dialog shows "Update via App Store" → tap → opens App Store deep link
  - Web (Chrome): bump pubspec → reload → SW updates → toast → reload → new version

## Validation Commands
```bash
# Static
dart format --set-exit-if-changed lib/features/updater/
dart analyze lib/features/updater/ --fatal-infos

# Tests
flutter test test/features/updater/

# Verify release-signed APK (Task 0)
flutter build apk --release
%ANDROID_HOME%\build-tools\<ver>\apksigner.bat verify --print-certs build\app\outputs\flutter-apk\app-release.apk

# Verify SHA-256 of uploaded artifact matches DB
sha256sum build/app/outputs/flutter-apk/app-release.apk
# Compare to: select sha256 from public.app_versions where id='android' and channel='stable';

# Smoke test the version-ping
curl -X POST https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/version-ping \
  -H "Authorization: Bearer <user-jwt>" -H "Content-Type: application/json" \
  -d '{"platform":"android","version":"1.0.19","build":2032}'
```

## Acceptance Criteria
- [ ] **Task 0 done**: release APK signed with the upload keystore, NOT the debug key. `apksigner verify` confirms the production cert.
- [ ] DB has the new schema with `(id, channel)` PK, `sha256`, `size_bytes`, `release_notes`, `min_supported_version`, `ios_app_store_url`, `rollout_percentage`, `force_full_reinstall`.
- [ ] `app_version_pings` rows accumulate at >=1/student/day. Owner can run `select * from version_distribution` and see the live distribution.
- [ ] On Android: real progress bar tied to byte counts, SHA-256 verified before install, one-tap install via `install_plugin`.
- [ ] On iOS: detected version mismatch → "Update via App Store" → opens App Store deep-link to the listing.
- [ ] On Web: new build deployed → service worker triggers → user sees "Reload to update" toast → clicks → on new version.
- [ ] `min_supported_version` correctly force-updates devices below the floor regardless of `force_update`.
- [ ] `rollout_percentage` correctly gates updates by deterministic per-device dice.
- [ ] Update check happens at: app start, app foreground (debounced 1/hour), and once per 24h via `workmanager` on Android.
- [ ] No update dialog ever interrupts an active interview / payment flow.
- [ ] If a release is bad, owner can hot-fix by `update app_versions set rollout_percentage = 0 where id = 'android' and channel = 'stable';` — devices stop seeing it within one foreground cycle.
- [ ] All five `UpdateState` branches have a UI representation and a test.
- [ ] `dart analyze` clean, `flutter test test/features/updater/` passes, golden tests committed.
