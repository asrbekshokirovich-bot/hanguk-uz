# Hanguk App — Release Runbook

This document is the source of truth for producing signed Android release
APKs. Lose this file and the keystore it points at, and you can never
update the production app again — Android refuses to install an APK over
an existing app if the signing certificate differs.

## One-time setup: generate the upload keystore

You only do this **once for the lifetime of the app**. After that, the same
keystore signs every release forever.

```bash
# Pick a directory OUTSIDE the repo. ~/keys/ is conventional.
mkdir -p ~/keys
cd ~/keys

# Generate the keystore. RSA 4096, valid 25,000 days (~68 years).
# When prompted, set a strong store password and key password.
# Use the SAME password for both fields to keep things simple, OR
# different ones if you want belt-and-braces.
keytool -genkey -v \
  -keystore hanguk-upload.jks \
  -keyalg RSA \
  -keysize 4096 \
  -validity 25000 \
  -alias hanguk-upload

# Verify it.
keytool -list -v -keystore hanguk-upload.jks -alias hanguk-upload
```

You should now have `~/keys/hanguk-upload.jks`. **Back this file up to two
separate offline locations** (encrypted USB, password manager, secrets
vault). If you lose it, the app is dead.

## Wire the keystore into the build

Copy the template:

```bash
cp android/key.properties.template android/key.properties
# Edit android/key.properties with your real values:
#   storeFile=/Users/yourname/keys/hanguk-upload.jks
#   storePassword=<the password you set>
#   keyAlias=hanguk-upload
#   keyPassword=<the key password you set>
```

`android/key.properties` is in `.gitignore`. **Never commit it.**

## Verify a signed release build

```bash
flutter build apk --release

# Inspect the signing certificate. It should NOT say "Android Debug" — it
# should show your name / organisation from the keystore generation.
%ANDROID_HOME%\build-tools\<latest>\apksigner.bat verify --print-certs \
  build\app\outputs\flutter-apk\app-release.apk
# Linux/Mac:
$ANDROID_HOME/build-tools/<latest>/apksigner verify --print-certs \
  build/app/outputs/flutter-apk/app-release.apk
```

If you see `CN=Android Debug, O=Android, C=US`, you've fallen back to debug
signing — check that `android/key.properties` exists and is well-formed.
The Gradle build prints a `[hanguk] WARNING:` line if it falls back.

## CI / restoring the keystore on another machine

For GitHub Actions / Codemagic / etc.:

1. Encrypt the `.jks` file:
   ```bash
   gpg --symmetric --cipher-algo AES256 hanguk-upload.jks
   # → produces hanguk-upload.jks.gpg
   ```
2. Commit `hanguk-upload.jks.gpg` to the **secrets repo**, not this repo.
3. In CI, set secrets:
   - `KEYSTORE_GPG_PASSWORD` (the GPG passphrase)
   - `KEYSTORE_PASSWORD` (the keystore store password)
   - `KEY_PASSWORD` (the key password)
4. Restore in CI before `flutter build apk`:
   ```bash
   gpg --batch --quiet --yes --decrypt --passphrase "$KEYSTORE_GPG_PASSWORD" \
     --output ~/keys/hanguk-upload.jks hanguk-upload.jks.gpg
   cat > android/key.properties <<EOF
   storeFile=/home/runner/keys/hanguk-upload.jks
   storePassword=$KEYSTORE_PASSWORD
   keyAlias=hanguk-upload
   keyPassword=$KEY_PASSWORD
   EOF
   ```

Alternative: Google **Play App Signing** lets Google manage the upload key.
You generate a separate "upload key" that's used only to sign the APK you
hand to Play; Google re-signs with the real app key it owns. Recommended
for projects on the Play Store. Not applicable to self-hosted-APK
distribution.

## Cutting a release

1. Bump `pubspec.yaml` — increment both the version (`x.y.z`) AND the
   build number after `+`. Build number must be monotonically increasing
   for Android to accept the update.
2. Build:
   ```bash
   flutter build apk --release --obfuscate \
     --split-debug-info=./debug-info/$(date +%Y%m%d-%H%M%S)/
   ```
   `--obfuscate` enables Dart obfuscation. Keep the `--split-debug-info`
   directory locally — don't commit it. You'll need it to symbolicate
   crash reports against the obfuscated build.
3. Verify the signature (see "Verify a signed release build" above).
4. Compute the SHA-256:
   ```bash
   sha256sum build/app/outputs/flutter-apk/app-release.apk
   ```
5. Upload the APK to Supabase Storage `releases/` bucket.
6. Insert/update the `app_versions` row:
   ```sql
   update public.app_versions
     set latest_version = '1.0.19+2032',
         download_url = 'https://lysjdtyanhdfphqyijsr.supabase.co/storage/v1/object/public/releases/hanguk_app_v1.0.19_2032.apk',
         sha256 = '<sha256 from step 4>',
         size_bytes = <byte size>,
         release_notes = 'Fix orphan magic-code login. Add real progress UI.',
         force_update = false,
         rollout_percentage = 25  -- start with 25% canary; bump to 100 after monitoring
     where id = 'android' and channel = 'stable';
   ```
7. Monitor `select * from version_distribution` and Edge Function error
   rates. If the new version's adoption stalls or error rate spikes,
   roll back:
   ```sql
   update public.app_versions
     set rollout_percentage = 0
     where id = 'android' and channel = 'stable';
   ```

## Custody policy

- Two people minimum should know the keystore passwords.
- Passwords stored only in the team password manager — never in chat,
  never in this repo, never in plaintext on disk.
- The keystore file lives in: (1) the password-manager attachment, (2)
  one offline encrypted USB, (3) a secondary cloud secrets vault.
- If a custodian leaves the team, rotate by generating a new upload key
  AND submitting a key-rotation request to Play (or, for self-hosted,
  cutting a forced full-reinstall release using `force_full_reinstall=true`).
