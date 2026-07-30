# Android Release — Google Play

How to ship a new version of the student app to Google Play. Referenced from
`hanguk_app/android/app/build.gradle.kts` and
`hanguk_app/android/key.properties.template`.

App: **Hanguk** · package `com.hanguk.studentapp.hanguk_app`

---

## 0. One-time: the upload keystore

Every update must be signed with the **same** key as the version already on
Play. A different key means Play rejects the upload outright — there is no way
to change it afterwards without Play's key-reset process.

`android/key.properties` is gitignored, so a fresh clone does not have it. Check:

```powershell
Test-Path android\key.properties
```

`False` → copy `android/key.properties.template` to `android/key.properties` and
fill in the real keystore path and passwords.

> **This failure is silent.** `build.gradle.kts` does not stop when
> `key.properties` is missing — it falls back to **debug signing** and only
> prints a warning in the Gradle log. The build succeeds, and Play then refuses
> the artifact ("signed in debug mode"). Always confirm the file exists before
> building.

Back up the keystore file and its passwords somewhere durable. Losing them means
losing the ability to update this listing.

---

## 1. Bump the version

`hanguk_app/pubspec.yaml`:

```yaml
version: 1.0.19+2032
#        ^^^^^^ versionName    ^^^^ versionCode
```

- **versionCode** (after `+`) must be **higher than any code ever uploaded**.
  Play rejects a duplicate. This is the number that matters.
- **versionName** (before `+`) is what users see. Bump the patch for a fix, the
  minor for a feature.

Nothing else holds the version — the `1.0.18+2031` strings in
`lib/features/updater/data/version_compare.dart` are doc-comment examples.

---

## 2. Build the bundle

```powershell
cd hanguk_app
flutter build appbundle --release --dart-define=STORE_BUILD=true
```

**`--dart-define=STORE_BUILD=true` is mandatory for store builds.** Without it
`kIsStoreBuild` stays `false` (see `lib/core/config/build_config.dart`) and the
app keeps its self-updater active — the flow that downloads and installs an APK
from Supabase Storage. That violates Google Play's policy on distributing
apps outside the store. The flag is the primary defence; do not omit it.

Optional defines:

| Define | Effect if omitted |
|---|---|
| `SENTRY_DSN=...` | Crash reporting no-ops cleanly. Safe to omit. |
| `KAKAO_JS_KEY=...` | Falls back to the key compiled into `AppConfig`. |
| `VOICE_ID_*` | Falls back to the defaults in `AppConfig`. |

Output:

```
hanguk_app\build\app\outputs\bundle\release\app-release.aab
```

Build an APK instead (`flutter build apk`) only for sideloading — Play needs the
`.aab`.

---

## 3. Check what you built

```powershell
# Confirm the version and target SDK that actually landed in the bundle
flutter build appbundle --release --dart-define=STORE_BUILD=true -v 2>&1 | Select-String "versionCode|targetSdk"
```

Better: install the release build on a real device before uploading. A release
build differs from `flutter run` in ways debug testing cannot reveal — R8
shrinking, obfuscation, and the `STORE_BUILD` flag are all release-only.

```powershell
flutter build apk --release --dart-define=STORE_BUILD=true
adb install -r build\app\outputs\flutter-apk\app-release.apk
```

If install fails with a signature error, uninstall the Play copy first:

```powershell
adb uninstall com.hanguk.studentapp.hanguk_app
```

---

## 4. Upload to Play Console

1. [Play Console](https://play.google.com/console) → select **Hanguk**.
2. Pick a track. Recommended order for anything non-trivial:
   **Internal testing** → **Closed/Open testing** → **Production**.
   Internal testing reaches your own testers within minutes and costs nothing
   if the build is broken.
3. **Create new release**.
4. Upload `app-release.aab`.
5. **Release notes** — what changed, in the languages your listing supports.
   Play shows these to users on the update screen.
6. **Review release** → resolve any errors it lists (warnings are usually fine).
7. **Start rollout**.

For Production, consider a **staged rollout** (10–20% first). If crash reports
spike you can halt it before it reaches everyone.

---

## 5. Target API level

Play requires the target API level to stay within one year of the latest Android
release, or updates stop being accepted.

`targetSdk` is pinned in `android/app/build.gradle.kts` — deliberately, because
it is what opts the app into a platform release's behaviour changes, and that
should be a reviewed step rather than something a Flutter upgrade does silently.

| Current | Next deadline |
|---|---|
| 36 (Android 16) | raise to 37 before **Aug 31, 2027** |

Before raising it, read Google's behaviour-changes page for that API level and
check what applies. For the 36 bump the relevant ones were edge-to-edge
enforcement, large-screen orientation locks, and foreground-service rules — see
the comment above `targetSdk` for how each was resolved.

---

## Common rejections

| Play says | Cause |
|---|---|
| Signed in debug mode | `android/key.properties` was missing — see §0. |
| Version code already used | `versionCode` not bumped — see §1. |
| Target API level too low | `targetSdk` behind — see §5. |
| Deceptive / unauthorised app installation | Built without `STORE_BUILD=true`, leaving the APK self-updater live — see §2. |
| Permission not declared | `REQUEST_INSTALL_PACKAGES` and the media permissions in `AndroidManifest.xml` need a declaration in the Console's App content section. |
