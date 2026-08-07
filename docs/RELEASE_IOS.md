# iOS Release — Apple App Store

How to ship a new version of the student app to the App Store. Companion to
`docs/RELEASE.md` (Google Play). Referenced from
`hanguk_app/ios/Runner.xcodeproj/project.pbxproj` and
`hanguk_app/ios/Runner/Info.plist`.

App: **Hanguk** · bundle ID `com.hanguk.studentapp.hangukApp`

Status: **live on the App Store** since 2026-08-07 (first public release,
`1.0.26+2043`, approved after the 2026-08-05 rejection round — see
`hanguk_app/store/APP_REVIEW_2026-08-05.md`).

---

## 0. One-time: what Apple already holds

Unlike Play, there is no keystore to lose here — signing certificates and
provisioning profiles live in your Apple Developer account and can be
regenerated. Two things *are* fixed for the life of the listing:

- **Bundle ID** `com.hanguk.studentapp.hangukApp`. It cannot be changed after
  the first release; a different one is a different app.
- **The app record** in App Store Connect (name, SKU, primary language).

Requirements for building: a Mac with Xcode 15+, Flutter, and an Apple
Developer Program membership (USD 99/yr) with the agreements signed.

---

## 1. Bump the version

`hanguk_app/pubspec.yaml` — the same line that drives the Android release:

```yaml
version: 1.0.26+2043
#        ^^^^^^ CFBundleShortVersionString   ^^^^ CFBundleVersion
```

Flutter feeds both into Xcode as `$(FLUTTER_BUILD_NAME)` and
`$(FLUTTER_BUILD_NUMBER)`; `Info.plist` reads them through
`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`. Do not hand-edit the plist.

- **Build number** (after `+`) must be higher than any build ever uploaded for
  the same version string. App Store Connect rejects a duplicate outright.
- **Version string** (before `+`) is what users see on the listing.

Keeping the Android and iOS numbers in step is deliberate — one `pubspec.yaml`
version means a bug report naming `1.0.26 (2043)` identifies the same code on
both stores.

---

## 2. Build the archive

```bash
cd hanguk_app
flutter build ipa --release --dart-define=STORE_BUILD=true
```

**`--dart-define=STORE_BUILD=true` is mandatory for store builds.** Without it
`kIsStoreBuild` stays `false` (see `lib/core/config/build_config.dart`) and the
app keeps its self-updater active — downloading and installing a build from
Supabase Storage. That is a policy violation on both stores; Apple reads it as
distributing code outside the App Store.

The optional defines are the same as the Android build (`SENTRY_DSN`,
`KAKAO_JS_KEY`, `VOICE_ID_*`); each falls back to the value compiled into
`AppConfig` when omitted.

Output:

```
hanguk_app/build/ios/ipa/*.ipa
```

If the build stops at code signing, open
`hanguk_app/ios/Runner.xcworkspace` in Xcode → **Runner → Signing &
Capabilities**, pick the team, and let Xcode create the profile; then re-run
the command.

---

## 3. Check what you built

The device family is the setting that got 1.0 (2039) rejected, so verify it
rather than assume it:

```bash
/usr/libexec/PlistBuddy -c "Print :UIDeviceFamily" \
  build/ios/iphoneos/Runner.app/Info.plist
```

Expected: `[1]` — iPhone only. A `2` in that array makes it an iPad app again,
which puts review on an iPad and makes App Store Connect demand a 13" iPad
screenshot set. It comes from `TARGETED_DEVICE_FAMILY` in
`ios/Runner.xcodeproj/project.pbxproj`, which must stay `"1"` in **all three**
build configurations.

Also confirm the version actually in the bundle:

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" \
  build/ios/iphoneos/Runner.app/Info.plist
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" \
  build/ios/iphoneos/Runner.app/Info.plist
```

Then install the release build on a real iPhone before uploading. A release
build differs from `flutter run` — the `STORE_BUILD` flag and tree-shaking are
release-only, and the Magic Code sign-in has to work from a clean install.

---

## 4. Upload

Either **Xcode → Product → Archive → Distribute App → App Store Connect**, or
from the CLI:

```bash
xcrun altool --upload-app -f build/ios/ipa/hanguk_app.ipa \
  -t ios -u <apple-id> -p <app-specific-password>
```

Use an **app-specific password** from <https://appleid.apple.com>, not your
Apple ID password. Do not commit it.

Processing takes 10–30 minutes before the build appears in App Store Connect.
If it disappears instead, check the email Apple sends — missing usage strings
and non-public API symbols are rejected at this stage, before review.

---

## 5. TestFlight

Always take a build through TestFlight before submitting. Internal testing
(up to 100 members of your team) needs no review and is available as soon as
processing finishes.

Test on a clean install, signed out, using the exact demo Magic Code you will
give App Review. This is the check that failed in the 2026-08-05 round: a code
that works on your already-signed-in device tells you nothing.

---

## 6. Submit for review

App Store Connect → **Hanguk → + Version** → fill in:

- **What's New** — per language. Users see it on the update screen.
- **Build** — select the processed build.
- **Screenshots** — 6.9" iPhone (1320 × 2868), captured from a signed-in
  session of *this* build. Capture list and rules:
  `hanguk_app/store/listings/screenshots/README.md`.
  Splash, welcome and Magic Code frames are not "the app in use" (2.3.3), and
  marketing frames are rejected. Check **View All Sizes in Media Manager** and
  clear leftovers from every size, not just the one you uploaded.
- **App Review Information** — the demo Magic Code in both the user name and
  password fields, plus a note explaining the single-field login (2.1(a)).
  Wording: `hanguk_app/store/APP_REVIEW_2026-08-05.md` § 2.
  Never commit the code itself; paste it into App Store Connect.

Then **Add for Review → Submit**.

---

## 7. After submission — what the statuses mean

| Status | Meaning |
|---|---|
| Waiting for Review | Queued. Usually under 24 h. |
| In Review | A reviewer has it. Hours to a couple of days. |
| Pending Developer Release | Approved, waiting for you — **Manual release** is set. Release it from the version page. |
| Ready for Distribution | Live. The listing can take a few more hours to show the new version. |
| Rejected | Read the Resolution Center message, fix, upload a new build number, reply in the same thread. |
| Metadata Rejected | Listing text or screenshots only — fix in App Store Connect, no rebuild needed. |

**Phased release** (version page → Phased Release for Automatic Updates) rolls
an update out over 7 days and is the iOS equivalent of a staged Play rollout.
It can be paused from the same panel. Use it for anything beyond a copy fix.

A rejection is not unusual and does not penalise the account — the first
submission was rejected once on device family and demo credentials, and both
were fixed inside a day.
