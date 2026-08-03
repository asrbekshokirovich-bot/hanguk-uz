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

### 4.1 Pick a track first

The `.aab` is uploaded into a **track**, not to "the store" directly. Which
track decides who gets it:

| Track | Who sees it | Review | Use it for |
|---|---|---|---|
| Internal testing | Up to 100 email addresses you list | Minutes, usually no full review | Every release. Catch a broken build here. |
| Closed testing | A tester list or Google Group | Reviewed | Wider pre-release checks |
| Open testing | Anyone with the opt-in link | Reviewed | Public beta |
| Production | All users | Reviewed, can take days | The real thing |

Recommended: **Internal testing → Production.** A build that is broken in a way
`flutter run` did not show costs nothing in internal testing and costs a bad
review in production.

Internal testing needs a tester list once: **Testing → Internal testing →
Testers** tab → add your own Google account, save. You then install through the
opt-in link shown on that page.

### 4.2 Create the release

Play Console → select **Hanguk** → left sidebar → **Testing → Internal testing**
(or **Release → Production**) → **Create new release**.

### 4.3 Upload the bundle

Drag `app-release.aab` into the App bundles box, or use **Upload**.

Play validates it here. What it checks and what it means:

- **Version code already used** — bump the version, rebuild (§1).
- **Signed in debug mode / wrong signing key** — `key.properties` problem (§0).
- **Target API level** — `targetSdk` behind (§5).
- Warnings about unused permissions or missing symbol files are usually fine.

If **Google Play App Signing** is on (default for new apps), you upload with your
*upload key* and Google re-signs with the app signing key it holds. The keystore
in §0 is the upload key — it still must be the same one every time.

### 4.4 Release name and notes

- **Release name** — internal only, users never see it. Defaults to the version
  code; `1.0.19 (2032)` is a fine convention.
- **Release notes** — users *do* see these on the update screen, per language.
  Write them for each language the listing supports. Keep the `<uz-UZ>` style
  language tags Play generates and put the text inside them.

### 4.5 Review and roll out

**Next** / **Save** → **Review release**. Play lists errors and warnings; errors
must be cleared. Then **Start rollout to <track>** and confirm.

For **Production**, use a **staged rollout** — start at 10–20%. If crash-free
rate drops on the **Release → Production** dashboard you can **Halt rollout**
before it reaches everyone, then fix and ship a new version code.

### 4.6 After rollout — what the statuses mean

| Status | Meaning |
|---|---|
| Draft | Created but never submitted. Nothing is live. |
| In review | Google is reviewing. Hours to several days. |
| Pending publication | Approved, waiting — usually because **managed publishing** is on. Publish it from **Publishing overview**. |
| Available / Live | Users can update. Store listing can take a few more hours to show the new version. |
| Rejected | Read the policy email; fix, bump the version code, re-upload. |

### 4.7 Promoting instead of rebuilding

Once a build passes internal testing, do **not** rebuild for production. Open the
release in the tested track → **Promote release → Production**. The same
reviewed artifact moves across, so what users get is exactly what was tested.

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

## 6. Building in CI instead

`.github/workflows/android-release.yml` runs §2 on a GitHub runner, so a
release does not depend on which laptop has Flutter and the keystore on it.
Actions tab → **Android release bundle** → **Run workflow**. It produces the
`.aab` (and, by default, a release APK for on-device testing) as workflow
artifacts. Uploading to Play is still manual — §4 is unchanged.

CI checks two things a local build only warns about:

- the keystore's SHA-1 must equal the upload key certificate in Play Console,
  asserted before the build and again against the finished bundle's signer;
- the signing secrets must all be present, so the debug-signing fallback in
  §0 can never quietly produce an artifact.

`EXPECTED_UPLOAD_KEY_SHA1` in the workflow holds that fingerprint. It is a
public certificate, not a secret. **If the upload key is ever reset, update it
in the same commit as the new secret** — otherwise every build fails the assert.

### One-time secret setup

On the machine that holds the keystore, base64 it:

```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\hanguk-upload.jks")) | Set-Clipboard
```

```bash
# macOS / Linux
base64 -w0 ~/keys/hanguk-upload.jks | pbcopy   # or | xclip -selection clipboard
```

Then **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the base64 string above |
| `ANDROID_KEYSTORE_PASSWORD` | `storePassword` from `key.properties` |
| `ANDROID_KEY_ALIAS` | `keyAlias` |
| `ANDROID_KEY_PASSWORD` | `keyPassword` |

Optional, both with working defaults in `AppConfig` — omit and the build still
succeeds: `SENTRY_DSN`, `KAKAO_JS_KEY`.

This puts the upload key in GitHub's secret store. Anyone who can push a
workflow to this repo can then sign builds with it, so treat write access as
equivalent to holding the key. Keep the original `.jks` and its passwords backed
up offline regardless — GitHub secrets are write-only and cannot be read back.

---

## Common rejections

| Play says | Cause |
|---|---|
| Signed in debug mode | `android/key.properties` was missing — see §0. |
| Version code already used | `versionCode` not bumped — see §1. |
| Target API level too low | `targetSdk` behind — see §5. |
| Deceptive / unauthorised app installation | Built without `STORE_BUILD=true`, leaving the APK self-updater live — see §2. |
| Permission not declared | `REQUEST_INSTALL_PACKAGES` in `AndroidManifest.xml` needs a declaration in the Console's App content section. |
| Use alternative system pickers for photos / videos | The bundle holds `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`. Blocked 2040. They are stripped with `tools:node="remove"` in `AndroidManifest.xml` — the app picks files through SAF, which needs no permission. If this reappears, a plugin has started merging them back in; check the merged manifest under `build/app/intermediates/merged_manifests/`. |
