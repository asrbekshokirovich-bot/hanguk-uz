#!/usr/bin/env bash
# Google Play uchun release AAB. Bayroqlarni qo'lda yozmang —
# har doim shu skriptni ishlating.
set -euo pipefail

cd "$(dirname "$0")/.."

# Sirlarni muhitdan oling, skriptga yozmang:
#   export SENTRY_DSN="https://...@sentry.io/..."
#   export KAKAO_JS_KEY="..."
# Eslatma: KAKAO_JS_KEY ning eski default qiymati kodda hardcode
# qilingan (lib/core/config/app_config.dart) — bu yerda YANGI
# (rotatsiya qilingan) kalitni bering.
: "${SENTRY_DSN:?SENTRY_DSN o'rnatilmagan}"
: "${KAKAO_JS_KEY:?KAKAO_JS_KEY o'rnatilmagan}"

flutter clean
flutter pub get

flutter build appbundle \
  --release \
  --flavor store \
  --dart-define=STORE_BUILD=true \
  --dart-define=SENTRY_DSN="$SENTRY_DSN" \
  --dart-define=KAKAO_JS_KEY="$KAKAO_JS_KEY"

AAB=build/app/outputs/bundle/storeRelease/app-store-release.aab
MAP=build/app/outputs/mapping/storeRelease/mapping.txt

echo
echo "── Nazorat tekshiruvlari ──────────────────────────"

# 1. AAB yaratildimi
[ -f "$AAB" ] && echo "OK   AAB: $AAB" \
             || { echo "XATO AAB topilmadi"; exit 1; }

# 2. ProGuard qoidalari qo'llandimi
[ -f "$MAP" ] && echo "OK   mapping.txt mavjud" \
             || echo "OGOHLANTIRISH: mapping.txt yo'q — proguardFiles ulanmaganmi?"

# 3. Taqiqlangan ruxsat yo'qmi
if unzip -p "$AAB" base/manifest/AndroidManifest.xml \
     | strings | grep -q INSTALL_PACKAGES; then
  echo "XATO REQUEST_INSTALL_PACKAGES hali ham AAB ichida"
  exit 1
else
  echo "OK   REQUEST_INSTALL_PACKAGES yo'q"
fi

echo
echo "Play Console'ga yuklashga tayyor."
echo "mapping.txt ni ham yuklashni unutmang: $MAP"
