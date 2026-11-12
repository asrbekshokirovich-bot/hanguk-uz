#!/usr/bin/env bash
# On a running Android emulator (ish-smoke.yml): installs each release APK,
# starts it, checks that it draws its first screen and answers a tap, and
# that nothing crashed. Screenshots and logcat go to build/smoke/.
#
#   tool/smoke.sh <folder with the APKs>
#
# The folder holds <variant>-<app>-<abi>.apk, e.g. demo-worker-x86_64.apk:
#   demo     — no database (the builds sent to Asrbek today);
#   backend  — a database address that answers nothing: the Supabase client
#              starts in a release build (the sign-in screens need no network).
# arm64 builds (the ones sent to phones) run only if the emulator translates
# ARM code; otherwise they are noted and skipped.
#
# Then a longer walk through each demo app as a person would (P33): sign-in,
# A02, taking a shift, A06, the working day (demo QR in and out), A08, the
# language kept after a restart; BA0, BA1, BA3's QR and BA5's CSV handed to
# Android's share sheet. Screens: build/smoke/walk-*.png.
set -uo pipefail
cd "$(dirname "$0")/.."
apks=$1
out=build/smoke
mkdir -p "$out"
ui() { python3 tool/smoke_ui.py "$@"; }
failed=0
adb shell getprop ro.product.cpu.abilist | tee "$out/abilist.txt"
# The emulator's own apps (Pixel Launcher) stop answering under load, and
# their «isn't responding» box covers ours and eats the taps. No error boxes:
# a crash or an ANR of ours is still caught in logcat (finish).
adb shell settings put global hide_error_dialogs 1 >/dev/null 2>&1 || true

# Installs and starts it; 2 when this emulator cannot run it.
launch() {
  local apk=$1 pkg=$2 name=$3
  adb uninstall "$pkg" >/dev/null 2>&1 || true
  if ! adb install -r "$apk" >"$out/$name-install.txt" 2>&1; then
    cat "$out/$name-install.txt"
    return 2
  fi
  adb logcat -c
  adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
}

# Still running, nothing fatal in the log; the screen as it is.
finish() {
  local pkg=$1 name=$2
  adb exec-out screencap -p >"$out/$name.png" || true
  adb logcat -d >"$out/$name-logcat.txt" 2>&1 || true
  if ! adb shell pidof "$pkg" >/dev/null 2>&1; then
    echo "::error::$name: the app is not running any more"
    failed=1
  fi
  if grep -E "FATAL EXCEPTION|Fatal signal" "$out/$name-logcat.txt" >/dev/null; then
    echo "::error::$name: crashed (build/smoke/$name-logcat.txt)"
    grep -E -A15 "FATAL EXCEPTION|Fatal signal" "$out/$name-logcat.txt" | head -60
    failed=1
  fi
  if grep -F "ANR in $pkg" "$out/$name-logcat.txt" >/dev/null; then
    echo "::error::$name: stopped answering (ANR, build/smoke/$name-logcat.txt)"
    grep -F -A10 "ANR in $pkg" "$out/$name-logcat.txt" | head -30
    failed=1
  fi
  # Dart errors the app caught or not: listed for review, not fatal here.
  if grep -E "E/flutter" "$out/$name-logcat.txt" >/dev/null; then
    echo "::warning::$name: Dart errors in the log"
    grep -E "E/flutter" "$out/$name-logcat.txt" | head -20
  fi
}

worker() {
  local name=$1-worker-$2
  launch "$apks/$name.apk" uz.hanguk.ish "$name"
  case $? in
    2) echo "::notice::$name: this emulator cannot install it (skipped)"; return ;;
  esac
  # A01 «Boshlash» (P49: no SMS): the demo opens A02; with the backend that
  # answers nothing, it says the connection is missing.
  local next='Profil · 1 / 3'
  [ "$1" = backend ] && next='Internet aloqasi'
  if ui wait 'Boshlash' 90 && ui tap 'Boshlash' && ui wait "$next" 30; then
    echo "$name: A01 → «Boshlash» → $next"
  elif [ "$1" = backend ] && ui wait '=Boshlash' 5; then
    # The connection message is a 4-second snack bar, and a busy emulator's
    # screen dump can miss it. Still on A01 and alive (finish checks for a
    # crash or an ANR): it answered.
    echo "::notice::$name: back on A01, the connection message not caught"
  else
    echo "::error::$name: A01 «Boshlash» did not answer"
    failed=1
  fi
  finish uz.hanguk.ish "$name"
}

employer() {
  local name=$1-employer-$2
  launch "$apks/$name.apk" uz.hanguk.ish.biz "$name"
  case $? in
    2) echo "::notice::$name: this emulator cannot install it (skipped)"; return ;;
  esac
  # BA0 with nothing filled in: it says what is missing. The app opens in the
  # phone's language (P43): English on the emulator.
  if ui wait 'Get started' 90 && ui tap 'Get started' && ui wait 'Enter the business number' 30; then
    echo "$name: BA0 answers"
  else
    echo "::error::$name: BA0 did not answer the tap"
    failed=1
  fi
  finish uz.hanguk.ish.biz "$name"
}

for variant in demo backend; do
  worker "$variant" x86_64
  employer "$variant" x86_64
done
worker demo arm64
employer demo arm64

# --- The longer walks -------------------------------------------------------

shot() { adb exec-out screencap -p >"$out/walk-$1.png" 2>/dev/null || true; }
# step <what> <command…>: runs it; on failure says what did not happen.
step() {
  local what=$1
  shift
  if "$@"; then
    return 0
  fi
  echo "::error::walk: $what"
  return 1
}

# Takes shifts from the top of the feed until one is confirmed at once
# (some wait for the business).
# A03 → A05 → «Smenani olish» → confirm, card by card until one is
# confirmed at once (auto-confirm). A feed card reads as one line (its own
# «Olish» is inside the card's node), so the card opens A05, whose button
# is a node of its own.
take_confirmed() {
  local card
  for card in 0 1 2; do
    ui tap ' soat' 30 "$card" || return 1
    ui tap '=Smenani olish' 30 || return 1
    ui tap '=Tasdiqlash' 15 || return 1
    if ui wait 'Smena olindi!' 10; then
      return 0
    fi
    ui tapif '=Lentaga qaytish' 5
  done
  return 1
}

walk_worker() {
  local apk=$apks/demo-worker-$1.apk pkg=uz.hanguk.ish name=walk-worker
  launch "$apk" "$pkg" "$name" || return
  # Sinchon, Seoul: the demo shifts are around it.
  adb emu geo fix 126.9368 37.5559 >/dev/null 2>&1 || true
  step 'A01 → A02' ui tap 'Boshlash' 90 &&
    step 'A02 opens' ui wait 'Profil · 1 / 3' &&
    shot a02-1 &&
    step 'A02-1: first name' ui field 0 Dilnoza &&
    ui hidekb &&
    step 'A02-1: last name' ui field 1 Testova &&
    ui hidekb &&
    step 'A02-1 → 2' ui tap '=Davom etish' &&
    step 'A02-2 opens' ui wait 'Profil · 2 / 3' &&
    step 'A02-2: Uzbek' ui tap "=O'zbekcha" &&
    step 'A02-2: Korean' ui tap '=Koreyscha' &&
    step 'A02-2: TOPIK 3' ui tap '=3' &&
    step 'A02-2: district row' ui scrollto '=Tuman' &&
    step 'A02-2: district list' ui tapbelow '=Tuman' '=Tanlang' &&
    step 'A02-2: search' ui field 0 Mapo &&
    step 'A02-2: Mapo-gu' ui tap 'Mapo-gu, Seul' &&
    ui hidekb &&
    shot a02-2 &&
    step 'A02-2 → 3' ui tap '=Davom etish' &&
    step 'A02-3 opens' ui wait 'Profil · 3 / 3' &&
    step 'A02-3: Saturday row' ui scrollto '=Shanba, Ertalab' &&
    step 'A02-3: Saturday morning' ui tap '=Shanba, Ertalab' &&
    step 'A02-3 → feed' ui tap '=Saqlash va boshlash' &&
    ui tapif 'While using the app' 10 &&
    step 'A03 feed' ui wait ' soat' 30 &&
    shot a03-feed &&
    step 'A05: a shift confirmed at once' take_confirmed &&
    shot a05-taken &&
    step 'back to the feed' ui tap '=Lentaga qaytish' &&
    step 'A06' ui tap '=Mening smenalarim' &&
    step 'A06: the shift' ui wait 'Tasdiqlangan' &&
    shot a06 &&
    step 'A06 → A07' ui tapbelow 'Smenalar holati' ' · ' &&
    step 'A07 check-in' ui wait 'Ishga kirish' 30 &&
    shot a07-in &&
    step 'A07: the printed code (demo)' ui tap '=QR kodni skanerlash' &&
    step 'A07 at work' ui wait 'Ish kuni' 30 &&
    shot a07-at-work &&
    step 'A07: to check-out' ui tap 'Chiqish — QR skanerlash' &&
    step 'A07 check-out' ui wait 'Chiqish uchun QR kodni skanerlang' 30 &&
    step 'A07: the printed code again' ui tap '=QR kodni skanerlash' &&
    step 'A07 result' ui wait 'Smena yakunlandi' 30 &&
    shot a07-result &&
    step 'A08' ui tap 'Ish beruvchini baholash' &&
    step 'A08: five stars' ui tap '=5 yulduz' &&
    step 'A08: send' ui tap '=Bahoni yuborish' &&
    step 'A08 sent' ui wait 'Bahoingiz yuborildi' 15 &&
    step 'A11' ui tap '=Profil' &&
    step 'A11: the name' ui wait 'Dilnoza Testova' &&
    step 'A11: language row' ui scrollto 'Ilova tili' &&
    step 'A11: language list' ui tap 'Ilova tili' &&
    step 'A11: Russian' ui tap '=Русский' &&
    step 'A11 in Russian' ui wait '=Профиль' &&
    shot a11-ru &&
    adb shell am force-stop "$pkg" &&
    adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 &&
    step 'after a restart: still Russian' ui wait '=Начать' 60 &&
    shot a01-ru-restarted &&
    echo "$name: A01 → A02 ×3 → A03 → A05 → A06 → A07 in/out → A08 → A11 → Русский → restart" ||
    { shot failed-worker; failed=1; }
  finish "$pkg" "$name"
}

# The share sheet is in front (another app's window, not ours).
shared() {
  sleep 3
  local front
  front=$(ui focus)
  echo "$front"
  case "$front" in
    *intentresolver* | *ChooserActivity* | *ResolverActivity* | *chooser*) return 0 ;;
  esac
  return 1
}

walk_employer() {
  local apk=$apks/demo-employer-$1.apk pkg=uz.hanguk.ish.biz name=walk-employer
  launch "$apk" "$pkg" "$name" || return
  # The app opens in the phone's language (P43, English here); the walk reads
  # Korean, so it switches first. P49: the business number only, no SMS.
  step 'BA0 opens' ui wait 'Get started' 90 &&
    step 'BA0: language' ui tap 'Language' &&
    step 'BA0: Korean' ui tap '=한국어' &&
    step 'BA0 in Korean' ui wait '시작하기' &&
    step 'BA0: business number' ui field 0 1234567891 &&
    ui hidekb &&
    step 'BA0 → BA1' ui tap '=시작하기' &&
    step 'BA1' ui wait '오늘의 근무' 30 &&
    shot ba1 &&
    step 'BA1 → BA3' ui tap '마감 정리 보조' 30 -1 &&
    step 'BA3: QR button' ui scrollto 'QR 인쇄·공유' &&
    shot ba3 &&
    step 'BA3: QR' ui tapend 'QR 인쇄·공유' 42 &&
    step 'BA3: the QR picture goes to the share sheet' shared &&
    shot ba3-share &&
    adb shell input keyevent 4 &&
    step 'back in BA3' ui wait 'QR 인쇄·공유' &&
    adb shell input keyevent 4 &&
    step 'BA5' ui tap '=리포트' &&
    step 'BA5: CSV button' ui scrollto 'CSV 다운로드' &&
    shot ba5 &&
    step 'BA5: CSV' ui tapx 'CSV 다운로드' 85 &&
    step 'BA5: the CSV goes to the share sheet' shared &&
    shot ba5-share &&
    adb shell input keyevent 4 &&
    step 'back in BA5' ui wait 'CSV 다운로드' &&
    echo "$name: BA0 → BA1 → BA3 → QR share → BA5 → CSV share" ||
    { shot failed-employer; failed=1; }
  finish "$pkg" "$name"
}

walk_worker arm64
walk_employer arm64
exit $failed
