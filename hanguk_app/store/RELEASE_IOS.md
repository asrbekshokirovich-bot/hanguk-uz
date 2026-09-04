# Releasing to the App Store

Everything that can be automated is. What follows is the part that cannot be.

There are two audiences here. **Setup** is done once, by whoever holds the
Apple Developer account. **Every release** is a button, and anyone with write
access to this repository can press it.

---

## Setup — once, by the account holder

Seven repository secrets. GitHub → Settings → Secrets and variables → Actions
→ *New repository secret*. Nothing below is stored in the repository, and
GitHub will not show any of them again once saved.

### App Store Connect API key — replaces signing in with an Apple ID

App Store Connect → **Users and Access** → **Integrations** → **App Store
Connect API** → generate a key with the **App Manager** role.

| Secret | Where it comes from |
|---|---|
| `ASC_KEY_ID` | the *Key ID* column next to the key you just made |
| `ASC_ISSUER_ID` | the *Issuer ID* shown above the key list |
| `ASC_KEY_P8` | the downloaded `AuthKey_XXXXXXXX.p8`, base64-encoded |

```sh
base64 -i AuthKey_XXXXXXXX.p8 | pbcopy
```

**Apple lets you download that .p8 exactly once.** If it is lost, revoke the
key and make a new one — it is a two-minute job, not a disaster.

This key is why nobody has to be at a Mac with a phone in hand: it does not
expire when a password changes, and it never asks for a two-factor code.

### Signing identity — the certificate that says the build is yours

| Secret | Where it comes from |
|---|---|
| `IOS_DIST_CERT_P12` | an **Apple Distribution** certificate exported from Keychain Access as `.p12` *with its private key*, base64-encoded |
| `IOS_DIST_CERT_PASSWORD` | the password typed during that export |
| `IOS_PROVISIONING_PROFILE` | the **App Store** provisioning profile for `com.hanguk.studentapp.hangukApp` from developer.apple.com → Profiles, base64-encoded |

```sh
base64 -i Certificates.p12         | pbcopy
base64 -i Hanguk_AppStore.mobileprovision | pbcopy
```

Both expire after a year. When they do the build fails with a signing error,
which is the correct behaviour — re-export and update the two secrets.

### The demo code

| Secret | Value |
|---|---|
| `DEMO_MAGIC_CODE` | the 8-character App Review Magic Code |

A secret rather than a file, because it is a working credential for a real
account. The release writes it to disk for the length of the upload and
deletes it again, so App Review always has a current code and the repository
never contains one.

---

## Every release

**Actions → iOS release to App Store Connect → Run workflow.**

| Field | Leave it alone unless |
|---|---|
| `lane` | `release` builds and uploads. `metadata` pushes only the listing text and screenshots, with no build — use it to fix a description in three minutes instead of forty. |
| `build_number` | blank uses the `+NNNN` from `pubspec.yaml`. Set it only when that number was already uploaded once, because App Store Connect refuses a repeat. |
| `flutter_version` | blank is latest stable. |

About forty minutes later:

* the build is uploaded **and attached to the version**,
* the description, keywords, promotional text, release notes and support URL
  are current in **en-US, ko and ru**,
* every iPad screenshot slot is empty and the iPhone 6.9" set matches this
  repository,
* the App Review notes and demo code are filled in.

Then open App Store Connect, read the page once, and press **Submit for
Review**. The workflow deliberately stops short of that: submitting is a
decision, not a build step.

---

## What is still manual, and why

**Screenshots.** Three of six exist (Explore, Map, Compare). The remaining
frames — university detail, Documents, Study Plan, AI interview — need a
capture run on a machine with Flutter:

```sh
cd hanguk_app
flutter build web --release
node tools/store/capture_screenshots.cjs --build build/web \
  --device iphone-6.9 --locale en --code <demo code>
```

The PNGs land in `store/listings/screenshots/captured/iphone-6.9/en/`. Commit
them there and you are done — the release assembles them into the layout the
App Store wants and pushes them every time.

**Testing on a real device.** The microphone permission sheet in the AI mock
interview cannot be verified by CI — it needs hardware and a person watching.
Do one TestFlight install before submitting.

**Deciding to submit.** On purpose.

---

## Why this exists

Six rejections between 5 August and 1 September 2026. Four of them were not
defects in the app:

| | What went wrong | Now |
|---|---|---|
| ×3 | The build was uploaded but never **attached** to the version, so three consecutive reviews examined an old binary. | `deliver` attaches the build it uploads. |
| ×1 | Stale iPad screenshots survived in slots only visible under *View All Sizes in Media Manager* — swept by hand twice, and still there. | `overwrite_screenshots: true` deletes anything not in this repository. |
| ×1 | The support URL pointed at a domain with no support page. | `support_url.txt`, pushed every release. |
| ×1 | The description was corrected in one language and left stale in another. | All three locales written on every run. |

The two remaining rejections (14 August, 1 September) were backend outages
during review, not submission mistakes. Those are addressed in the app itself —
sign-in now retries for 34 seconds and falls back to Guest Explorer — and in
the server work recorded alongside this document.

A checklist that a tired person follows at eleven at night is not a process.
This is the same checklist, executed by something that does not get tired.
