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
# Android's share sheet. Screens: build/smoke/walk-*.png. Last, the backend
# builds with no server behind them: asking for a code must say there is no
# connection.
set -uo pipefail
cd "$(dirname "$0")/.."
apks=$1
out=build/smoke
mkdir -p "$out"
ui() { python3 tool/smoke_ui.py "$@"; }
# Every adb call has a deadline: an emulator that stops answering fails the
# run in minutes instead of holding it to the job's limit. (--foreground: only
# adb itself is stopped, never anything else in its process group.)
adb() {
  local limit=60
  case "${1:-}" in install) limit=300 ;; esac
  timeout --foreground "$limit" adb "$@"
}
failed=0
adb shell getprop ro.product.cpu.abilist | tee "$out/abilist.txt"
adb shell getprop ro.build.version.sdk | tee "$out/sdk.txt"

# The whole log as it happens, so the last lines before an emulator goes away
# are kept (each app's own log is taken at its end, finish below).
command adb logcat -v threadtime >"$out/logcat-stream.txt" 2>&1 &
logcat_pid=$!
trap 'kill "$logcat_pid" 2>/dev/null || true' EXIT

# The system settles before the first app (the emulator starts from a
# settled snapshot, ish-smoke.yml).
timeout 120 adb shell am wait-for-broadcast-idle >/dev/null 2>&1 || true

# Installs and starts it; 2 when this emulator cannot run it.
launch() {
  local apk=$1 pkg=$2 name=$3
  adb uninstall "$pkg" >/dev/null 2>&1 || true
  if ! adb install -r "$apk" >"$out/$name-install.txt" 2>&1; then
    cat "$out/$name-install.txt"
    return 2
  fi
  # Android finishes an install with broadcasts; on a slow emulator they can
  # land seconds later and restart the activity under the first tap. Start
  # only once they are through.
  timeout 90 adb shell am wait-for-broadcast-idle >/dev/null 2>&1 || true
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
  # A01, then T1.
  if ui wait 'Telefon raqam bilan' 90 && ui tapto 'Telefon raqam bilan' 'Telefon raqamingiz'; then
    echo "$name: A01 → T1"
  else
    echo "::error::$name: A01 → T1 did not happen"
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
  # BA0 with nothing filled in: it says what is missing.
  if ui wait '시작하기' 90 && ui tapto '시작하기' '모두 입력해 주세요'; then
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
take_confirmed() {
  local attempt
  for attempt in 1 2 3 4 5; do
    ui tap '=Olish' 30 0 || return 1
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
  step 'A01' ui wait 'Telefon raqam bilan' 90 &&
    step 'A01 → T1' ui tapto 'Telefon raqam bilan' 'Telefon raqamingiz' &&
    step 'T1: number' ui field 0 01012345678 &&
    step 'T1 → T2' ui tap '=Kod olish' &&
    step 'T2 opens' ui wait 'Kodni kiriting' &&
    step 'T2: code' ui type 123456 &&
    step 'T2 → A02' ui wait 'Profil · 1 / 3' &&
    shot a02-1 &&
    step 'A02-1: first name' ui field 0 Dilnoza &&
    step 'A02-1: last name' ui field 1 Testova &&
    ui hidekb &&
    step 'A02-1 → 2' ui tap '=Davom etish' &&
    step 'A02-2 opens' ui wait 'Profil · 2 / 3' &&
    step 'A02-2: Uzbek' ui tap "=O'zbekcha" &&
    step 'A02-2: Korean' ui tap '=Koreyscha' &&
    step 'A02-2: TOPIK 3' ui tapbelow 'TOPIK' '=3' &&
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
    step 'A03 feed' ui wait '=Olish' 30 &&
    shot a03-feed &&
    step 'A05: a shift confirmed at once' take_confirmed &&
    shot a05-taken &&
    step 'back to the feed' ui tap '=Lentaga qaytish' &&
    step 'A06' ui tap '=Mening smenalarim' &&
    step 'A06: the shift' ui wait '=Tasdiqlangan' &&
    shot a06 &&
    step 'A06 → A07' ui tap '=Tasdiqlangan' &&
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
    step 'after a restart: still Russian' ui wait 'По номеру телефона' 60 &&
    shot a01-ru-restarted &&
    echo "$name: A01 → T1 → T2 → A02 ×3 → A03 → A05 → A06 → A07 in/out → A08 → A11 → Русский → restart" ||
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
  step 'BA0 opens' ui wait '시작하기' 90 &&
    step 'BA0: phone' ui field 0 01012345678 &&
    step 'BA0: business number' ui field 1 1234567891 &&
    ui hidekb &&
    step 'BA0 → code' ui tap '=시작하기' &&
    step 'code opens' ui wait '인증번호 입력' &&
    step 'code' ui type 123456 &&
    step 'BA1' ui wait '오늘의 근무' 30 &&
    shot ba1 &&
    step 'BA1: a shift' ui scrollto '마감 정리 보조' &&
    step 'BA1 → BA3' ui tap '마감 정리 보조' &&
    step 'BA3: QR button' ui scrollto 'QR 인쇄·공유' &&
    shot ba3 &&
    step 'BA3: QR' ui tap 'QR 인쇄·공유' &&
    step 'BA3: the QR picture goes to the share sheet' shared &&
    shot ba3-share &&
    adb shell input keyevent 4 &&
    step 'back in BA3' ui wait 'QR 인쇄·공유' &&
    adb shell input keyevent 4 &&
    step 'BA5' ui tap '=리포트' &&
    step 'BA5: CSV button' ui scrollto 'CSV 다운로드' &&
    shot ba5 &&
    step 'BA5: CSV' ui tap 'CSV 다운로드' &&
    step 'BA5: the CSV goes to the share sheet' shared &&
    shot ba5-share &&
    adb shell input keyevent 4 &&
    step 'back in BA5' ui wait 'CSV 다운로드' &&
    echo "$name: BA0 → code → BA1 → BA3 → QR share → BA5 → CSV share" ||
    { shot failed-employer; failed=1; }
  finish "$pkg" "$name"
}

# The «backend» builds with a server that is not there: asking for a code
# must say «no connection», not hang or crash (release error handling).
offline_worker() {
  local pkg=uz.hanguk.ish name=offline-worker
  launch "$apks/backend-worker-x86_64.apk" "$pkg" "$name" || return
  step 'A01' ui wait 'Telefon raqam bilan' 90 &&
    step 'A01 → T1' ui tapto 'Telefon raqam bilan' 'Telefon raqamingiz' &&
    step 'T1: number' ui field 0 01012345678 &&
    step 'T1: ask for the code' ui tap '=Kod olish' &&
    step 'T1 says there is no connection' ui wait "Internet aloqasi yo'q" 45 &&
    shot t1-offline &&
    echo "$name: T1 → «Internet aloqasi yo'q»" ||
    { shot failed-offline-worker; failed=1; }
  finish "$pkg" "$name"
}

offline_employer() {
  local pkg=uz.hanguk.ish.biz name=offline-employer
  launch "$apks/backend-employer-x86_64.apk" "$pkg" "$name" || return
  step 'BA0 opens' ui wait '시작하기' 90 &&
    step 'BA0: phone' ui field 0 01012345678 &&
    step 'BA0: business number' ui field 1 1234567891 &&
    ui hidekb &&
    step 'BA0: ask for the code' ui tap '=시작하기' &&
    step 'BA0 says there is no connection' ui wait '인터넷 연결을 확인해 주세요' 45 &&
    shot ba0-offline &&
    echo "$name: BA0 → «인터넷 연결을 확인해 주세요»" ||
    { shot failed-offline-employer; failed=1; }
  finish "$pkg" "$name"
}

walk_worker arm64
walk_employer arm64
offline_worker
offline_employer
exit $failed
