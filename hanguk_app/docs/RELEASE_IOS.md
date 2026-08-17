# Hanguk App — iOS Release Runbook

Four files have pointed at `docs/RELEASE_IOS.md` since 2026-08-05 —
`SUBMISSION_CHECKLIST.md`, `APP_REVIEW_2026-08-05.md`,
`APP_REVIEW_2026-08-07.md`, `APP_STORE_CONNECT_2026-08-07.md` — and it did not
exist. This is that file.

It matters more than a missing doc usually would. **Build 1.0 (2042) was
reviewed four times** — 2026-08-05, 08-07, 08-12, 08-14 — because uploading a
build and *selecting* it on the version are two different actions in App Store
Connect and only the first one was ever done. Nothing wrote that down, so
nothing caught it. § 5 is that step, on its own, in bold.

The Play equivalent is `docs/RELEASE.md`.

---

## Facts you will need

| | |
| --- | --- |
| Bundle ID | `com.hanguk.studentapp.hangukApp` |
| Current version | `1.0.27+2044` (`pubspec.yaml`) — marketing `1.0.27`, build `2044` |
| Device family | iPhone only (`UIDeviceFamily = [1]`) |
| Minimum iOS | 15.0 — Flutter 3.47 enforces this and rewrites the project if it disagrees |
| Demo Magic Code | in App Store Connect → App Review Information. The row is `DEMO — Google Play Reviewer (do not delete)`; **do not commit the code to this repo** |

---

## § 0. What you need once

- Apple Developer Program membership (paid, active).
- A Mac with Xcode. **There is no way around this** — an iOS archive cannot be
  produced on Linux or in a container, and neither can the signing step.
- Signing set up in Xcode: Xcode → Settings → Accounts → your Apple ID, then
  the Runner target's *Signing & Capabilities* tab with "Automatically manage
  signing" and the correct Team.
- The app record already exists in App Store Connect. Do not create a second
  one.

---

## § 1. Before you build

CI does most of the checking now, so this list is short. Push your branch and
let `.github/workflows/ios-verify.yml` run — it builds the app on macOS and
asserts:

- `ios/Podfile` resolves and the app compiles,
- `PERMISSION_MICROPHONE=1` reaches the Pods project (without it the AI mock
  interview silently gets no microphone — see `APP_REVIEW_2026-08-14.md` § 5a),
- `UIDeviceFamily == [1]` in the built app,
- `NSMicrophoneUsageDescription` ships.

If that job is green, the build settings are not what will go wrong.

What CI cannot check, and you must:

1. **Bump the build number.** App Store Connect rejects a build number it has
   already seen. Edit `version:` in `pubspec.yaml` — the part after `+`.
2. **The demo Magic Code still signs in**, on a clean install of the exact
   build you are submitting. Not a previous build.
3. **The microphone prompt appears** when you start an AI mock interview on a
   real device. CI cannot see a permission sheet; only a human can.

---

## § 2. Build the archive

```bash
cd hanguk_app
flutter clean
flutter pub get
flutter build ipa --release --dart-define=STORE_BUILD=true
```

`--dart-define=STORE_BUILD=true` is not optional. Without it the build keeps
the self-updater path that Play already blocked once — see
`lib/core/config/build_config.dart`.

---

## § 3. Verify the archive before uploading

Two minutes here against two weeks of review.

```bash
/usr/libexec/PlistBuddy -c "Print :UIDeviceFamily" \
  build/ios/iphoneos/Runner.app/Info.plist          # must print [1]

/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" \
  build/ios/iphoneos/Runner.app/Info.plist          # must be higher than the last upload
```

If `UIDeviceFamily` prints `[1, 2]`, **stop**. An iPad-eligible binary makes
App Store Connect keep every iPad screenshot slot live and makes review run on
an iPad — that is the shape of both the 2026-08-05 and 2026-08-12 rejections.

---

## § 4. Upload

Either works:

- **Xcode** → Window → Organizer → select the archive → *Distribute App* →
  App Store Connect → Upload.
- **Transporter** (free, Mac App Store) → drag in
  `build/ios/ipa/*.ipa` → Deliver.

Then wait. Processing takes 5–30 minutes; you get an email when the build
appears in App Store Connect. **It is not attached to anything yet.**

---

## § 5. Attach the build to the version ⚠️

**This is the step that was missed four times.**

App Store Connect → your app → the version under *iOS App* (e.g. `1.0`) →
scroll to **Build** → click **+** or *Select a build before you submit* →
pick the build you just uploaded → **Save**.

Then re-read the page. The Build section must show the number you just
uploaded. If it still shows an older one, review will run on the older one and
every fix you just made is invisible to Apple.

> Uploading is not attaching. A build that finished processing but was never
> selected leaves the previous build under review.

---

## § 6. App Review Information

Same page, further down.

Hanguk has a single-field sign-in, which reviewers do not expect, so the notes
have to say so:

- **User name**: the demo Magic Code (the field is required).
- **Password**: the same Magic Code.
- **Notes**: explain the single field. Suggested text is in
  `store/APP_REVIEW_2026-08-05.md` § 2.

Before submitting, confirm the demo account still has real content — at least
one application, an uploaded document, a study plan. An account that signs in
to empty tabs draws guideline 2.1 for a different reason.

---

## § 7. Screenshots

`store/listings/screenshots/README.md` has the capture list. The rules that
have actually cost rejections:

- **Every iPad size must be empty.** Open the device dropdown →
  *View All Sizes in Media Manager* → walk every size → delete every iPad
  screenshot → repeat **per localisation** (`en-US`, `ko`, `uz`). The default
  view hides sizes; a stale asset on a size you never expanded fails 2.3.3 on
  its own. This is what the 2026-08-12 rejection was.
- **No splash, welcome or login frames.** Apple does not count them as the app
  in use.
- **No marketing renders.** Real captures from a signed-in session only.

---

## § 8. Metadata

Copy the description and keywords from `STORE_METADATA.md` — do not write new
copy in the App Store Connect box. That file is deliberately no wider than
what the app actually does, and it is wider copy that drew the 2026-08-07
guideline 2.3 rejection.

Keywords are capped at 100 characters including commas.

---

## § 9. Submit

*Add for Review* → *Submit to App Review*.

Then re-check, in this order, because each has failed at least once:

1. Build section shows the new build number.
2. iPad screenshot sizes are empty in every locale.
3. Support URL resolves (guideline 1.5, cited 2026-08-07).
4. Export compliance did not re-prompt — `ITSAppUsesNonExemptEncryption` is in
   `ios/Runner/Info.plist`, so it should not.

---

## § 10. If it is rejected

Write it down. `store/APP_REVIEW_YYYY-MM-DD.md`, one per rejection, with the
guideline, what Apple actually said, and what was changed. The four existing
ones are why the 2026-08-14 rejection took an hour to diagnose instead of a
week.

And check the server logs before assuming the app is at fault. On 2026-08-14
the reviewer was told their access code was wrong; the code was correct and
the database was unreachable for ninety minutes. That is in the logs, not in
the app.
