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
set -uo pipefail
cd "$(dirname "$0")/.."
apks=$1
out=build/smoke
mkdir -p "$out"
ui() { python3 tool/smoke_ui.py "$@"; }
failed=0
adb shell getprop ro.product.cpu.abilist | tee "$out/abilist.txt"

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
exit $failed
