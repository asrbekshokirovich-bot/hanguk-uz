#!/usr/bin/env bash
# Collect the seven values the iOS release workflow needs, on the Mac that has
# the Apple Developer account.
#
# WHY THIS SCRIPT EXISTS
#
# The person who holds the Apple account does not have access to this
# repository, and the person who holds the repository does not have access to
# the Apple account. Neither can complete the setup alone, so the handoff is
# one message: this script prints exactly what goes in it, and nothing else.
#
# It reads three files you already have and encodes them. It does not upload
# anything, does not contact Apple, and does not keep a copy — the output goes
# to your terminal and, if you pass -o, to one file you control and delete.
#
# USAGE
#
#   ./collect_apple_secrets.sh \
#       --p8      ~/Downloads/AuthKey_ABC1234XYZ.p8 \
#       --p12     ~/Desktop/Certificates.p12 \
#       --profile ~/Desktop/Hanguk_AppStore.mobileprovision \
#       [-o ~/Desktop/hanguk-secrets.txt]
#
# Then send the output to whoever administers the repository, over a channel
# you would send a password over. Every value in it can be revoked later from
# App Store Connect and developer.apple.com without touching your Apple ID.

set -euo pipefail

P8=""; P12=""; PROFILE=""; OUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --p8)      P8="$2";      shift 2 ;;
    --p12)     P12="$2";     shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -o|--out)  OUT="$2";     shift 2 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }

[ -n "$P8" ]      || die "--p8 is required (the AuthKey_XXXXXXXX.p8 from App Store Connect)"
[ -n "$P12" ]     || die "--p12 is required (the Apple Distribution certificate exported from Keychain Access)"
[ -n "$PROFILE" ] || die "--profile is required (the App Store provisioning profile)"

for f in "$P8" "$P12" "$PROFILE"; do
  [ -f "$f" ] || die "No such file: $f"
done

# ── Sanity checks, so a wrong file is caught here and not forty minutes into
#    a build on a 10x-priced macOS runner ────────────────────────────────────

grep -q "BEGIN PRIVATE KEY" "$P8" \
  || die "$P8 does not look like an App Store Connect .p8 key."

# The Key ID is in the filename Apple gives you: AuthKey_<KEYID>.p8
KEY_ID="$(basename "$P8" | sed -n 's/^AuthKey_\(.*\)\.p8$/\1/p')"
if [ -z "$KEY_ID" ]; then
  echo "Could not read the Key ID from the filename '$(basename "$P8")'."
  printf "Type the Key ID (App Store Connect -> Users and Access -> Integrations): "
  read -r KEY_ID
fi

security cms -D -i "$PROFILE" >/dev/null 2>&1 \
  || die "$PROFILE is not a readable provisioning profile."

PLIST="$(security cms -D -i "$PROFILE")"
PROFILE_NAME="$(printf '%s' "$PLIST" | plutil -extract Name raw - 2>/dev/null || echo "?")"
TEAM="$(printf '%s' "$PLIST" | plutil -extract TeamIdentifier.0 raw - 2>/dev/null || echo "?")"
APP_ID="$(printf '%s' "$PLIST" | plutil -extract Entitlements.application-identifier raw - 2>/dev/null || echo "?")"
EXPIRY="$(printf '%s' "$PLIST" | plutil -extract ExpirationDate raw - 2>/dev/null || echo "?")"

case "$APP_ID" in
  *com.hanguk.studentapp.hangukApp)
    ;;
  *)
    die "This profile is for '$APP_ID', not com.hanguk.studentapp.hangukApp."
    ;;
esac

# A profile without get-task-allow is a distribution profile; a development
# profile has it, and produces a build App Store Connect silently refuses.
if printf '%s' "$PLIST" | grep -q "<key>get-task-allow</key>[[:space:]]*<true/>"; then
  die "This is a development profile (get-task-allow is true). The App Store needs a distribution profile."
fi

printf "Password for %s (the one typed when exporting it): " "$(basename "$P12")"
read -rs P12_PASS
echo

# openssl proves the password AND that the private key travelled with the
# certificate. A .p12 exported without the key imports fine and then fails to
# sign, which is a confusing failure an hour later.
openssl pkcs12 -in "$P12" -passin "pass:$P12_PASS" -nokeys -clcerts -out /dev/null 2>/dev/null \
  || die "Could not open the .p12 with that password."
openssl pkcs12 -in "$P12" -passin "pass:$P12_PASS" -nocerts -nodes 2>/dev/null | grep -q "PRIVATE KEY" \
  || die "That .p12 has no private key in it. Re-export from Keychain Access selecting BOTH the certificate and the key under it."

CERT_SUBJECT="$(openssl pkcs12 -in "$P12" -passin "pass:$P12_PASS" -nokeys -clcerts 2>/dev/null \
                | openssl x509 -noout -subject 2>/dev/null || echo '?')"
CERT_EXPIRY="$(openssl pkcs12 -in "$P12" -passin "pass:$P12_PASS" -nokeys -clcerts 2>/dev/null \
                | openssl x509 -noout -enddate 2>/dev/null | sed 's/notAfter=//' || echo '?')"

printf "Issuer ID (the long UUID above the key list in App Store Connect): "
read -r ISSUER_ID
[ -n "$ISSUER_ID" ] || die "The Issuer ID is required."

printf "The App Review demo Magic Code (8 characters): "
read -r DEMO_CODE
[ -n "$DEMO_CODE" ] || die "The demo code is required — App Review cannot sign in without it."

# ── Output ─────────────────────────────────────────────────────────────────

emit() {
  cat <<TXT
================================================================
 GitHub repository secrets for hanguk-uz
 Settings -> Secrets and variables -> Actions -> New repository secret
 Create each one with the name in CAPITALS and the value under it.
================================================================

--- ASC_KEY_ID ---
$KEY_ID

--- ASC_ISSUER_ID ---
$ISSUER_ID

--- ASC_KEY_P8 ---
$(base64 < "$P8" | tr -d '\n')

--- IOS_DIST_CERT_P12 ---
$(base64 < "$P12" | tr -d '\n')

--- IOS_DIST_CERT_PASSWORD ---
$P12_PASS

--- IOS_PROVISIONING_PROFILE ---
$(base64 < "$PROFILE" | tr -d '\n')

--- DEMO_MAGIC_CODE ---
$DEMO_CODE

================================================================
 Checked before printing:
   profile      $PROFILE_NAME
   app id       $APP_ID
   team         $TEAM
   profile ends $EXPIRY
   certificate  $CERT_SUBJECT
   cert ends    $CERT_EXPIRY
   private key  present
================================================================
 Send this over a channel you would send a password over, and
 delete your copy afterwards. Every value here can be revoked
 from App Store Connect / developer.apple.com without touching
 your Apple ID.
================================================================
TXT
}

if [ -n "$OUT" ]; then
  ( umask 077; emit > "$OUT" )
  echo "Written to $OUT (readable only by you)."
  echo "Send it, then: rm '$OUT'"
else
  emit
fi
