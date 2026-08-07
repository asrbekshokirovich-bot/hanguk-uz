# Hanguk — Store Submission Checklist

Last updated 2026-05-12 (after P0 + P1 + P2 sweeps).

This is the full operational walkthrough for shipping the first public
release of Hanguk to the **Apple App Store** and **Google Play Store**.
Start at § 1 if you have never published an app before; otherwise skip
to whichever step you are on.

> **Where this stands.** The one-time setup in this file — enrollment, bundle
> ID, keystore, listing creation — is done and does not need repeating.
> Google Play is live. The **App Store submission is still in review rounds**:
> rejected 2026-08-05 (device family, demo account) and again 2026-08-07
> (Support URL, inaccurate metadata). Open rejections and what each needs:
> `APP_REVIEW_2026-08-05.md`, `APP_REVIEW_2026-08-07.md`.
>
> For the build-and-submit mechanics, use the per-store release guides:
> `docs/RELEASE_IOS.md` (App Store) and `docs/RELEASE.md` (Google Play).

Companion files:
- Audit (every gap and why it matters): `docs/audits/store_readiness_audit_2026-05-12.md`
- Closure logs (every fix the agent made): `docs/audits/store_p0_closure_log_2026-05-12.md`, `store_p1_closure_log_2026-05-12.md`, `store_p2_closure_log_2026-05-12.md`
- Flat tick-list of personal/human steps: `USER_ACTIONS_REQUIRED.md` (repo root)
- Data Safety answer sheet: `docs/store/play-data-safety.md`
- Legal drafts (need lawyer review): `docs/legal/PRIVACY_POLICY.md`, `docs/legal/TERMS_OF_SERVICE.md`
- Store listing copy (EN/KO/UZ): `store/listings/`

---

## § 0. Overview & time estimate

End-to-end: **5-10 calendar days** of focused founder time, plus
**1-7 days of review wait** per store. Day-by-day:

- Day 1: Console enrollment + D-U-N-S + 2FA.
- Day 2: Keystore, app icon, feature graphic.
- Day 3: Screenshots in EN + KO + UZ.
- Day 4: Privacy Policy / Terms hosted; copy + Data Safety + age rating.
- Day 5: Build + upload AAB to Play Internal Testing.
- Day 6: Build + upload IPA to TestFlight.
- Day 7: Internal-testing pass with 2-3 friends.
- Day 8: Submit Apple + Play to review.
- Days 9-15: Review wait. Be ready for one rejection round on each.
- Day 16: Live.

---

## § 1. Console enrollment

### 1a. Apple Developer Program

1. Visit <https://developer.apple.com/programs/enroll/>. Click "Start Your Enrollment".
2. Sign in with your Apple ID. If you don't have one or have not enabled **2FA**, do that first at <https://appleid.apple.com>.
3. Choose **Individual** (sole-founder) or **Organization** (LLC). Organization requires a **D-U-N-S number** — free from Dun & Bradstreet at <https://developer.apple.com/enroll/duns-lookup/>; takes 1-5 business days.
4. Pay the **USD 99/yr** fee. Membership is activated within 48 hours.
5. Once activated, complete the **agreements, banking, tax** forms inside App Store Connect (<https://appstoreconnect.apple.com>). Without banking, paid apps won't ship — Hanguk is free, but free apps still need the agreement signed.
6. In App Store Connect → "My Apps" → "+" → **New App**:
   - Platform: iOS
   - Name: **Hanguk**
   - Primary language: English (U.S.)
   - Bundle ID: select `com.hanguk.studentapp.hangukApp` (must be registered as an App ID in Certificates, Identifiers & Profiles first; the bundle ID matches `ios/Runner/Info.plist`).
   - SKU: any string, e.g. `hanguk-v1`.
   - User Access: Full Access.

### 1b. Google Play Console

1. Visit <https://play.google.com/console/signup>.
2. Sign in with your Google account; enable **2FA** if not already.
3. Choose **Personal** or **Organization**. Pay **USD 25 one-time**.
4. Complete account details: developer name (will appear on store listing), email, website, phone. Google requires identity verification — upload government ID and a selfie. 1-3 day review.
5. Inside the console: **Setup → Payments profile, tax, banking**. Hanguk is free but tax info is still required.
6. **Create app**: Apps → Create app.
   - App name: **Hanguk**
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
   - Declarations: confirm Play guidelines + US export laws.
7. Open the app shell. Note your **package name** must be `com.hanguk.studentapp.hanguk_app` (matches `android/app/build.gradle.kts`).

---

## § 2. Keystore (Android — one-time, **DO THIS CAREFULLY**)

The keystore signs your AAB. **If you lose it, you can never publish
an update to your app on Play.** Treat it like a master password.

```bash
# 1. Generate ONCE. Use a strong password and keep it.
keytool -genkey -v -keystore ~/upload-keystore.jks \
    -keyalg RSA -keysize 2048 -validity 10000 -alias upload

# 2. Move into the repo (gitignored — confirm with `git status`).
mv ~/upload-keystore.jks android/upload-keystore.jks

# 3. Copy the template and fill in passwords:
cp android/key.properties.template android/key.properties
#  edit android/key.properties:
#    storePassword=<the keystore password>
#    keyPassword=<the key password>
#    keyAlias=upload
#    storeFile=upload-keystore.jks

# 4. Back up the keystore to AT LEAST TWO places:
#    - your password manager (1Password / Bitwarden — encrypted attachment)
#    - an encrypted external drive
#    The .jks file plus both passwords must survive a laptop loss.
```

`android/key.properties` and `*.jks` are already in `.gitignore`. Do **not** commit them.

---

## § 3. App icon production

### Apple (App Store)

- One **1024 × 1024 PNG**, **no alpha channel**, **no rounded corners** (Apple rounds it for you), **no transparency**.
- Save as `store/listings/app-icon/ios-1024.png`.
- Brief: see `store/listings/app-icon/README.md`.

### Google Play

- One **512 × 512 PNG**, 32-bit, alpha allowed.
- Save as `store/listings/app-icon/play-512.png`.
- **Adaptive icon** (Android 8+): background `#0A0A1A`, foreground = the existing `assets/app_icon2.png`. The `pubspec.yaml` is already wired (P2 #33). Regenerate Android launcher icons with:
  ```bash
  flutter pub run flutter_launcher_icons:main
  ```
- This writes `android/app/src/main/res/mipmap-*/launcher_icon.png` and the adaptive XML.

---

## § 4. Screenshots

You need **5 screenshots minimum per locale per device class**. For
Hanguk you ship in en, ko, uz across both stores, so:

- Apple: 6.7" iPhone (e.g. iPhone 15 Pro Max simulator, 1290 × 2796), 6.5" iPhone (1242 × 2688), iPad Pro 12.9" (2048 × 2732). Three sizes × three locales × five shots ≈ **45 PNGs**.
- Play: phone (1080 × 1920 minimum), 7" tablet, 10" tablet. ≈ **45 PNGs**.

Apple specs: <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/>.
Play specs: <https://support.google.com/googleplay/android-developer/answer/9866151>.

How to capture:

```bash
# iOS Simulator:
#   1. Boot the right simulator (Xcode → Window → Devices and Simulators).
#   2. flutter run --device-id "<simulator-id>"
#   3. Cmd-S inside the simulator window saves a PNG to Desktop.

# Android emulator:
#   1. Create an AVD that matches the target screen.
#   2. flutter run -d <emulator-id>
#   3. Click the camera icon in the emulator toolbar.
```

Each locale: change the simulator/emulator language (Settings → General
→ Language & Region on iOS; Settings → System → Languages on Android),
then re-launch the app so it picks up the locale.

Save under `store/listings/screenshots/<store>/<device>/<locale>/01.png`,
`02.png`, etc.

---

## § 5. Feature graphic (Play only)

- **1024 × 500 PNG**, no transparency. Used as the banner at the top
  of the Play listing.
- Save as `store/listings/feature-graphic/play-1024x500.png`. Brief
  in `store/listings/feature-graphic/README.md`.

---

## § 6. Store listing copy

The agent already drafted EN + KO + UZ copy under `store/listings/`.
Walk:

- **Apple**: open App Store Connect → your app → App Information.
  - For each locale (English, Korean): paste copy from
    `store/listings/app-store/<locale>/`:
    - `description.md` → "Description"
    - `keywords.md` → "Keywords" (Apple imposes a 100-char total budget)
    - `promotional.md` → "Promotional Text"
    - `whats-new.md` → "What's New in This Version" (per-release; first release: "Initial launch.")
  - Category: **Education** (primary), **Productivity** (secondary).
  - Age rating: open the questionnaire (see § 9).

- **Play**: open Play Console → your app → Grow → Store presence → Main store listing.
  - Languages: add Korean and Uzbek. Per locale paste from
    `store/listings/play-store/<locale>/`:
    - `short-description.md` → "Short description" (80 chars max)
    - `long-description.md` → "Full description" (4000 chars max)
  - Category: **Education**. Tags: per the Play console picker.

---

## § 7. Privacy Policy + Terms hosting

Apple and Play both require a **public URL** for the Privacy Policy
(and Play requires one for Terms of Service). The agent shipped a
Supabase Storage bucket migration plus the markdown drafts.

1. **Have a lawyer review** `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md`. The drafts have "DRAFT — legal review pending" markers at the top — replace those before publishing.
2. Apply the bucket migration:
   ```bash
   supabase db push --include-all
   # or, against a specific project:
   psql $DATABASE_URL -f supabase/migrations/20260512121000_legal_bucket.sql
   ```
3. Upload the reviewed markdown files to the `legal` bucket (Supabase Dashboard → Storage → `legal` → Upload):
   - `privacy_policy.md`
   - `terms_of_service.md`
4. Note the public URLs (Supabase exposes them at `https://<project-ref>.supabase.co/storage/v1/object/public/legal/<filename>`). Confirm both load in a browser.
5. Update `lib/core/config/app_config.dart` with the real URLs if they differ from the placeholder.
6. Paste the **Privacy Policy URL** into:
   - App Store Connect → App Privacy → Privacy Policy URL
   - Play Console → App content → Privacy policy → URL
7. **Optional but recommended**: also host on `https://hanguk.uz/privacy` and `/terms` (just an HTML page that displays the markdown) so the URL doesn't look like a raw storage URL to reviewers.

---

## § 8. Apple Privacy Manifest (already in code)

- `ios/Runner/PrivacyInfo.xcprivacy` shipped in P0 #4 with the 4 Required Reason APIs and the collected-data declarations.
- Confirm it's in your Xcode target: open `ios/Runner.xcworkspace` → Runner → Build Phases → Copy Bundle Resources → `PrivacyInfo.xcprivacy` should be listed. If missing, drag the file in.

---

## § 9. Age rating questionnaire

### Apple

Open App Store Connect → your app → App Information → **Age Rating** → Edit.

Answer (Hanguk has no objectionable content but does host user-generated text from interview transcripts):

- Cartoon or Fantasy Violence: None
- Realistic Violence: None
- Sexual Content or Nudity: None
- Profanity or Crude Humor: None
- Alcohol, Tobacco, or Drug Use or References: None
- Mature/Suggestive Themes: None
- Horror/Fear Themes: None
- Medical/Treatment Information: None
- Gambling: None
- **Unrestricted Web Access**: **YES** (Kakao Maps WebView)
- **User-Generated Content**: **YES** (interview transcripts, study plan drafts, applications)
- Contests: None
- Result: typically **12+**.

### Play / IARC

Play Console → Policy → App content → **Content rating** → Start questionnaire.

- Category: **Reference, News, or Educational**
- Violence, sexuality, language, controlled substances: No
- User interaction: **Yes** (users can submit text via AI chat / interview / drafts)
- Personal info sharing: **No**
- Location sharing: **No** (we display map tiles but don't share user location)
- Result: typically **PEGI 12, ESRB Teen** — driven by the AI-generated-text declaration.

---

## § 10. Play Data Safety form

Use `docs/store/play-data-safety.md` as the source of truth — every
question on the Play form has its answer there.

Play Console → App content → **Data safety** → Start. Walk top-to-bottom. Common answers:
- Does your app collect or share user data? **Yes**.
- Is all user data encrypted in transit? **Yes** (HTTPS to Supabase).
- Do you provide a way to request deletion? **Yes** — link to in-app delete (§ 14) and to the Privacy Policy URL.

Submit. Play will show a "Data safety" card on the listing.

---

## § 11. App Store Review Information (Apple)

Apple wants a working demo account so reviewers can sign in.

1. On the production Supabase project, create a **reviewer test
   account**:
   - Email: `apple-review@hanguk.uz`
   - Password: a long random string
   - Pre-populate with one application draft and one finished interview
     so the reviewer can see real screens.
2. App Store Connect → your app → App Review Information:
   - Sign-in required: **Yes**
   - Username: `apple-review@hanguk.uz`
   - Password: the random string
   - Notes: "Phone-based magic-code auth is the primary path; the
     password sign-in is provided for App Review only. Test account is
     pre-populated. Microphone access is required for the Training tab
     → AI Interview. Mock data only — no real personal info."
3. Contact info: your phone + email.

---

## § 11b. Play App Access — reviewer demo account (Google)

Google Play rejects the app with **"Login credentials are incorrect"**
whenever the magic code entered under **App content → App access** does
not resolve to a live student profile. This happened once because the
code that was submitted belonged to a student profile that had since
been deleted — the login screen then shows *"We don't recognise this
code."*

To prevent this recurring, a **permanent demo student** exists purely
for review. **Do not delete it.**

- Magic code (access code): **`QR6ZUBDZ`**
- Profile name in CRM: **`DEMO — Google Play Reviewer (do not delete)`**
- It has **no staff role** (so the magic-code login is not blocked) and
  is enrolled in the default intake so it renders like a real student.
- It carries **no real personal data** — safe to hand to reviewers.

Where to put it in Play Console:

1. Play Console → your app → **App content → App access**.
2. Select **"All or some functionality is restricted"**.
3. Add an instruction row:
   - Name: `Student login (magic code)`
   - Instructions: *"On the welcome screen tap **I have a Magic Code**,
     enter the access code below, then tap **Login manually with Access
     Code**. No phone/SMS needed."*
   - Username: *(leave blank — not used)*
   - Password / access code: **`QR6ZUBDZ`**
4. Save, then re-submit from **Publishing overview**.

**Verify before every submission** that the code still logs in — either
run through the app, or hit the Edge Function directly:

```bash
curl -sS -X POST \
  'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/student-login-v2' \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "apikey: <ANON_KEY>" \
  -H 'Content-Type: application/json' \
  -d '{"magicCode":"QR6ZUBDZ"}'
# Expect: {"success":true,"session":{...}}  (HTTP 200)
# CODE_NOT_FOUND / 401 → the demo profile was deleted; recreate it (below).
```

**If the demo account was deleted, recreate it** (SQL editor, production):

```sql
INSERT INTO profiles (
  user_id, full_name, magic_code, parental_consent,
  language_track, language_track_source, preferred_language,
  office_location, birth_date
) VALUES (
  gen_random_uuid(),
  'DEMO — Google Play Reviewer (do not delete)',
  'QR6ZUBDZ', true,
  'korean', 'manual', 'en', 'Demo', DATE '2000-01-01'
);
-- Enroll in the default intake so it appears in the CRM roster:
INSERT INTO student_intakes (student_id, intake_id)
SELECT p.user_id, i.id
FROM profiles p
CROSS JOIN LATERAL (
  SELECT id FROM intakes WHERE is_default = true ORDER BY year DESC LIMIT 1
) i
WHERE p.magic_code = 'QR6ZUBDZ'
ON CONFLICT (student_id, intake_id) DO NOTHING;
```

The first login mints the auth user and repairs `profiles.user_id`
automatically (see `student-login-v2`), so no extra auth setup is needed.

---

## § 12. Sentry project (crash reporting)

1. Sign up at <https://sentry.io> (free tier covers Hanguk's volume).
2. Create a project: platform **Flutter**, name `hanguk-prod`.
3. Copy the **DSN** string (it looks like `https://abc@o123.ingest.sentry.io/456`).
4. Add the DSN to every release build command:
   ```
   --dart-define=SENTRY_DSN=https://abc@o123.ingest.sentry.io/456
   ```
   The SDK is wired in `lib/main.dart` (P1 #15); empty DSN → SDK no-ops.
5. After first deploy, trigger a deliberate test crash and confirm it
   shows in Sentry within 60 s.

---

## § 13. DNS records for `hanguk.uz`

Required so Supabase Auth's magic-code emails reach inboxes (not spam).

Publish these on the `hanguk.uz` DNS zone:

```
# SPF — authorize Supabase to send mail on behalf of hanguk.uz
hanguk.uz.        IN TXT   "v=spf1 include:_spf.supabase.co ~all"

# DKIM — copy the CNAME value from Supabase → Auth → Email → Custom SMTP
supabase._domainkey.hanguk.uz.  IN CNAME  supabase._domainkey.supabase.co.

# DMARC — quarantine policy with reporting
_dmarc.hanguk.uz.  IN TXT   "v=DMARC1; p=quarantine; rua=mailto:postmaster@hanguk.uz; pct=100"
```

If you use a non-Supabase SMTP provider (SendGrid / Postmark / SES),
swap `_spf.supabase.co` for that provider's SPF include.

Verify with `dig +short TXT hanguk.uz` and by triggering a magic-code
email to a Gmail address and checking the headers show `dkim=pass`.

---

## § 14. Kakao key rotation

The Kakao JS + Native keys were committed to git history during early
development and must be rotated before launch.

1. Log into <https://developers.kakao.com> → your Hanguk app → **App Keys**.
2. **Rotate both** the JS key and the Native key.
3. JS key: restrict origins to `https://hanguk.uz` (production) and `http://localhost:8080` (dev).
4. Native key: set the allowed-package list to `com.hanguk.studentapp.hanguk_app`.
5. Build with the new JS key:
   ```
   --dart-define=KAKAO_JS_KEY=<new-js-key>
   ```
6. (No native key needed; P2 #43 dropped the manifest meta-data.)

---

## § 15. Supabase migrations to apply

Apply these in order to production before the release build:

```bash
supabase link --project-ref <your-prod-ref>
supabase db push --include-all
```

The migrations created by the audit sweep:

1. `supabase/migrations/20260512120000_account_deletion_rpc.sql` — P0 #2
2. `supabase/migrations/20260512121000_legal_bucket.sql` — P0 #3
3. `supabase/migrations/20260512122000_enable_rls_audit.sql` — P0 #8
4. `supabase/migrations/20260512123000_profile_age_consent_fields.sql` — P1 #16

After applying, verify in psql or the SQL editor:

```sql
-- Every public table should have rowsecurity = true
select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- The account-deletion RPC should exist
select proname from pg_proc where proname = 'fn_delete_my_account';
```

---

## § 16. Edge Function deployment

```bash
supabase functions deploy export-my-data --project-ref <your-prod-ref>
```

The function reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` (set by
default on the project). Test from the Account screen "Download my
data" button on a real device — the resulting JSON should land in the
share sheet.

---

## § 17. Final pre-flight checklist

```
[ ] flutter analyze --fatal-infos     # clean on release commit
[ ] flutter test                      # all green
[ ] lib/core/config/build_config.dart exposes kIsStoreBuild
[ ] lib/main.dart does NOT import device_preview
[ ] android/app/proguard-rules.pro referenced from build.gradle.kts
[ ] ios/Runner/PrivacyInfo.xcprivacy in Xcode bundle resources
[ ] android/key.properties has real values (gitignored)
[ ] android/upload-keystore.jks backed up TWICE
[ ] Supabase migrations applied + RLS verified
[ ] export-my-data Edge Function deployed
[ ] Privacy Policy + Terms URLs live
[ ] Sentry DSN issued
[ ] Kakao keys rotated
[ ] DNS records (SPF/DKIM/DMARC) live
[ ] Adaptive launcher icons regenerated (`flutter pub run flutter_launcher_icons:main`)
```

---

## § 18. Build commands

### Direct-APK (self-host distribution) — *not for stores*

```
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk`. The bundled
auto-updater (Supabase Storage + APK install) is active in this build.
**Do not upload this APK to Play** — the auto-updater violates Play
policy. Use the App Bundle path below for Play.

### Play Store (App Bundle)

```
flutter build appbundle --release \
    --dart-define=STORE_BUILD=true \
    --dart-define=SENTRY_DSN=<sentry-dsn> \
    --dart-define=KAKAO_JS_KEY=<rotated-js-key> \
    --obfuscate \
    --split-debug-info=build/symbols/android
```

Output: `build/app/outputs/bundle/release/app-release.aab`. Keep the
`build/symbols/android/` directory — without it, Sentry crash reports
won't symbolicate.

### App Store (.ipa)

```
flutter build ipa --release \
    --dart-define=STORE_BUILD=true \
    --dart-define=SENTRY_DSN=<sentry-dsn> \
    --dart-define=KAKAO_JS_KEY=<rotated-js-key> \
    --obfuscate \
    --split-debug-info=build/symbols/ios
```

Output: `build/ios/ipa/Runner.ipa`. Upload via **Xcode Transporter**
(easier) or `xcrun altool --upload-app -f Runner.ipa -u <apple-id> -p <app-specific-password>`.

---

## § 19. Upload to Play (Internal Testing first)

1. Play Console → your app → Testing → **Internal testing** → Create
   new release.
2. Upload `app-release.aab`. Play will lint it — note any warnings.
3. Release name: `1.0.18 (2031)` to match `pubspec.yaml` `version: 1.0.18+2031`.
4. Release notes: paste from `store/listings/play-store/en/whats-new.md`.
5. Save → Review → Start rollout to Internal testing.
6. Add your own Google account + 2-3 friends as internal testers.
7. Once approved (usually within hours), install via the opt-in link
   and run through every flow (§ 21).

After internal testing passes:

8. Promote to **Production**: same release flow, but on the Production
   track. This is what kicks off Play's full review.

---

## § 20. Upload to App Store Connect

1. Open **Xcode → Transporter** (free in the Mac App Store) or use Xcode itself.
2. Sign in with your Apple ID.
3. Drag `Runner.ipa` in. Transporter validates and uploads.
4. In App Store Connect → your app → TestFlight: the build will
   appear in 10-30 minutes as "Processing", then "Ready to Test".
5. Add yourself + friends as **Internal Testers** (App Store Connect
   users → Testflight).
6. Run through every flow on TestFlight (§ 21).
7. After TestFlight passes: App Store Connect → your app → **App Store** tab → Prepare for Submission.
   - Confirm screenshots / copy / privacy / age rating / review info
     all filled.
   - Click **Submit for Review**.

---

## § 21. Internal testing pass (do this for both stores)

Install the test build on a **real Android phone** and a **real iPhone**, then walk through every flow:

```
[ ] Cold launch → splash → welcome screen renders
[ ] Magic-code sign-up: phone → code received → consent checkboxes (both required) → enter app
[ ] Marketing-consent checkbox is OFF by default
[ ] DOB picker rejects DOB < 14 years ago
[ ] Resend code shows 30 s cooldown
[ ] Password sign-up requires ≥ 8 chars + a digit
[ ] Home screen → all 5 tabs render (Applications / Documents / Training / Chat / Map)
[ ] Map tab loads Kakao map without HTTPS error
[ ] Map tab → tap a pin → roadview opens
[ ] Switching to another tab and back doesn't fully reload the map (P2 #36 keepalive)
[ ] Documents tab → upload a PDF → preview works → delete works
[ ] Training tab → Interview → mic permission rationale shows BEFORE the OS prompt (Android 13+)
[ ] Training tab → Interview → start a 30-second call → recording is saved → analytics show
[ ] Chat tab → send a message → AI replies
[ ] Account screen reachable from home AppBar
[ ] Account screen → "Download my data" → JSON file lands in the share sheet
[ ] Account screen → "Delete account" → type DELETE → confirm → user signed out → re-login fails ("Invalid phone number or password")
[ ] Privacy Policy link from sign-up opens in the OS browser
[ ] Terms link from sign-up opens in the OS browser
[ ] Auto-updater dialog does NOT appear in store builds (kIsStoreBuild short-circuits it)
[ ] On Play store build with a newer version on Play: Play In-App Updates prompt appears (§ P2 #48)
[ ] Dynamic font scale 130 / 150 / 200 % — no clipping on login, home, training, account, map (P2 #39 — manual)
[ ] System color is "Light" and "Dark" — no contrast collapse (P2 #38)
[ ] Try a friend's phone in Korean and another in Russian/Uzbek — locale strings render
```

Any failure: fix, bump `pubspec.yaml` build number (`+2031` → `+2032`),
re-build, re-upload.

---

## § 22. Submit for review

- **Apple**: typically 24-48 hours. Rejections common on first
  submission: missing screenshots for an iPad size, missing privacy
  manifest entries, an emoji-rich app description. If rejected, fix
  and resubmit — Apple usually re-reviews within 24 h.
- **Play**: typically 1-7 days for a first submission (longer because
  of identity verification). Common rejections: a Data Safety form
  inconsistent with the manifest (e.g. declaring "we don't collect
  location" while declaring `ACCESS_FINE_LOCATION` — not our issue,
  but check anyway), an unsigned bundle, or an unrotated debug
  Application ID.

If a rejection mentions a policy URL, paste it back to me and I'll
diagnose. Common ones documented at the bottom of this file.

---

## § 23. Post-launch monitoring

```
[ ] Sentry inbox checked daily for the first week
[ ] Supabase Dashboard → Logs → Auth: watch for sign-in failure spikes
[ ] Supabase Dashboard → Logs → Edge Functions: watch export-my-data error rate
[ ] app_version_pings table: track upgrade adoption — if > 30 % of
    users are stuck on the previous version after 14 days, the
    auto-updater (or Play In-App Updates) isn't reaching them.
[ ] Play Console → Statistics → Crash rate (ANR). Stays < 1 %.
[ ] App Store Connect → Analytics → Crash counts.
[ ] Respond to App Store / Play reviews within 7 days (review-response is a quality signal for both stores' ranking).
```

---

## § 24. Common rejection reasons (and fixes)

| Reject reason | Fix |
|---|---|
| Apple 4.0 — Design (placeholder screens) | Ensure every screen has real content; remove debug pages. The audit P0 + P1 sweeps did this. |
| Apple 5.1.1(v) — Account deletion required | Already implemented (P0 #2). Make sure the App Review notes mention how to reach the Account screen. |
| Apple Privacy Manifest missing required reason | Verify `ios/Runner/PrivacyInfo.xcprivacy` is in the build (P0 #4 + § 8). |
| Apple 2.5.2 — App contains code to update itself | Our bundled APK updater is OFF in store builds (P0 #1 `kIsStoreBuild`). If Apple flags it, point to `lib/features/updater/data/updater_repository.dart` — the install path throws `UnsupportedError` when `kIsStoreBuild` is true. |
| Play — Data safety / Manifest mismatch | Re-check `docs/store/play-data-safety.md` against the declared permissions in `AndroidManifest.xml`. |
| Play — Account deletion required (`13327111`) | Implemented in P0 #2; ensure the listing form's "Account deletion" section links to the in-app `/account` screen and the email `support@hanguk.uz`. |
| Play — Sensitive permissions justification | `RECORD_AUDIO` for interview practice; cite this in the Play Console's permissions declaration. |
| Play — "Login credentials are incorrect" | The magic code under App access no longer resolves to a live student (usually the demo profile was deleted). Recreate the demo account and re-enter code `QR6ZUBDZ` — see § 11b. |

---

## USER ACTIONS appendix — all sweep items

The flat tick-list version lives in `USER_ACTIONS_REQUIRED.md` at the
repo root. The detailed runbooks for each P1 closure item that needs
human action follow.

### Sentry DSN (P1 #15) — see § 12 above.

### Kakao key rotation (P1 #19) — see § 14 above.

### Email deliverability — DNS records (P1 #29) — see § 13 above.

### Data-export Edge Function deploy (P1 #31) — see § 16 above.

### Profile age / consent fields (P1 #16 / #17)

```bash
supabase db push --include-all
# or, against a specific branch:
psql $DATABASE_URL -f supabase/migrations/20260512123000_profile_age_consent_fields.sql
```

After applying, the `profiles` table rejects inserts/updates for users
under 14 (trigger `trg_profiles_enforce_min_age`).

### CI runner secrets (P1 #24)

When you re-enable the build job in `.github/workflows/ci.yml`, add:

- `KAKAO_JS_KEY`
- `SENTRY_DSN`
- `ANDROID_KEYSTORE_BASE64` (base64 of `upload-keystore.jks`)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`

The current `ci.yml` runs `flutter analyze` + `flutter test`, which
need no secrets.

### Adaptive icon regeneration (P2 #33)

```bash
flutter pub run flutter_launcher_icons:main
```

Re-run any time `pubspec.yaml`'s `flutter_launcher_icons:` block changes.

### WebP asset conversion (P2 #35) — currently optional

Largest asset is 87 KB so WebP isn't needed today. If you add a
large hero PNG/JPG later:

```bash
cwebp -q 80 input.png -o output.webp
```

Flutter supports WebP natively (Android API 14+, iOS 14+).

### Dynamic font-scaling QA (P2 #39)

On a real device, change system font scale to 130 %, 150 %, 200 %.
Re-walk login, home, training, account, map. Note any clipping. File
fixes per screen.

### Color-contrast decision (P2 #38)

`AppColors.error` `#DC2626` on `backgroundNavy` is 4.13:1 — passes
3:1 for large/headline text but fails 4.5:1 for body text. Either
restrict its usage to large/headline or recolor (e.g. `#E64C4C`).

### Repo-root cleanup (P2 #41)

The `.gitignore` was extended to cover all the scratch files. Now
remove them from the index without deleting on disk:

```bash
git rm --cached -r \
    analyze_*.txt analysis*.txt analyzer_out.txt apps_out.txt \
    errors*.txt build_err*.txt build_error*.txt build_log.txt \
    build_errors.txt build_output.txt out.txt out2.txt out3.txt \
    output.txt res.txt test_res.txt emulators.txt devices*.txt \
    hanguk_report.html dump.json identity_dump.json \
    tmp_query.cjs test_chrome.js test_map.html \
    test_vapi.dart test_vapi.mjs test_vapi_web.js \
    run_flutter_web.cjs serve_flutter.cjs serve_flutter_detached.cjs \
    get_vapi_error.dart get_vapi_error.exe \
    check_db.dart check_schema.dart db_schema.dart find_fk.dart print_db.dart \
    flutter_run.log auto_deploy_log.txt \
    package.json package-lock.json
```
