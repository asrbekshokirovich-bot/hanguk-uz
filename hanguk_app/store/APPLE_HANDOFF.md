# For the person with the Apple Developer account

You do not need access to the code repository, and you will not be asked to
install anything. This is one session at your Mac, about fifteen minutes, done
once. After it, releases stop going through you: whoever maintains the app
presses a button and the build appears in App Store Connect, correctly attached
to the version, with the listing and screenshots already updated.

The app is **Hanguk** — `com.hanguk.studentapp.hangukApp`.

---

## What you are producing

Seven values. Three of them come out of files you already have; the script at
the end reads those files and prints everything in one block for you to send.

### 1. An App Store Connect API key

This is what replaces "sign in with the Apple ID and type the code from my
phone" in an automated release. It is scoped, revocable in one click, and it
cannot be used to sign in as you.

1. App Store Connect → **Users and Access** → **Integrations** → **App Store
   Connect API**
2. **+** to generate a key. Name it something like `Hanguk CI`. Access:
   **App Manager**.
3. Download the `AuthKey_XXXXXXXX.p8`. **Apple allows this download once.** If
   it is ever lost, revoke the key and make another — it takes two minutes.
4. Note the **Issuer ID**, the long UUID shown above the list of keys.

### 2. A distribution signing identity

The certificate that says a build came from your team.

1. **Keychain Access** → *My Certificates* → find **Apple Distribution:
   \<your team\>**.
2. Expand the triangle so the private key underneath is selected too, then
   right-click → **Export 2 items…** → save as `.p12` and set a password.
   *(Exporting only the certificate produces a file that imports fine and then
   fails to sign — the script below checks for this.)*
3. developer.apple.com → **Certificates, Identifiers & Profiles** → **Profiles**
   → the **App Store** profile for `com.hanguk.studentapp.hangukApp` →
   Download.

### 3. The App Review demo code

The 8-character Magic Code that App Review uses to sign in. It is stored as a
secret, never in the code, and is written into the review notes on every
release.

---

## Run this

In Terminal, from the project folder (or wherever you saved the script):

```sh
./hanguk_app/scripts/collect_apple_secrets.sh \
  --p8      ~/Downloads/AuthKey_XXXXXXXX.p8 \
  --p12     ~/Desktop/Certificates.p12 \
  --profile ~/Desktop/Hanguk_AppStore.mobileprovision \
  -o        ~/Desktop/hanguk-secrets.txt
```

It asks for the .p12 password, the Issuer ID and the demo code, checks that the
profile really is a distribution profile for this app and that the private key
travelled with the certificate, and writes one block of text.

Send that file to whoever administers the repository, over a channel you would
send a password over, then `rm ~/Desktop/hanguk-secrets.txt`.

That is the whole handoff.

---

## What this changes for you

Six App Store rejections between 5 August and 1 September 2026. Four of them
were not defects in the app — they were steps somebody had to remember, and
every one of them is now done by the machine:

| | What kept happening | After this |
|---|---|---|
| ×3 | The build was uploaded but never **attached** to the version, so three consecutive reviews examined an old binary. | The upload attaches it. |
| ×1 | Stale iPad screenshots survived in slots only visible under *View All Sizes in Media Manager*. | Every slot not in the repository is deleted on each release. |
| ×1 | The support URL pointed at a domain with no support page. | Pushed from the repository every release. |
| ×1 | The description was fixed in one language, left stale in another. | All locales written every run. |

The release stops **before** Submit for Review. Submitting stays a decision a
person makes, and you can keep making it.

---

## If you would rather not hand over a certificate

Reasonable. Two alternatives, both fine:

* **Give the API key only** (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`) and
  keep the signing to yourself. The `metadata` lane then runs without you —
  listing text, screenshots, review notes, support URL, all the things that
  caused four of the six rejections — and you keep building and uploading the
  binary the way you do now. That removes most of the risk and none of your
  control.
* **Be added to the repository** as a collaborator and run the workflow
  yourself, with the secrets in your own hands.

Either is better than the current arrangement, where the checklist lives in a
person's memory at eleven at night.
