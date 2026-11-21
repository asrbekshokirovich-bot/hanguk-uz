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
# A02, «Ishlar» (an offer opened with puyl), «Mening ishlarim», Profil, the
# language kept after a restart; BA0, BA1, BA3's QR and BA5's CSV handed to
# Android's share sheet. Screens: build/smoke/walk-*.png.
set -uo pipefail
cd "$(dirname "$0")/.."
apks=$1
out=build/smoke
mkdir -p "$out"
# One screen command never waits longer than its own 90 s, nor one adb call
# for a picture or the log: an emulator that stops answering would otherwise
# hold the whole run until the job's limit (it did, twice, after a walk had
# already failed).
ui() { timeout 150 python3 tool/smoke_ui.py "$@"; }
adbt() { timeout 60 adb "$@"; }
failed=0
stream=
adb shell getprop ro.product.cpu.abilist | tee "$out/abilist.txt"
# The emulator's own apps (Pixel Launcher) stop answering under load, and
# their «isn't responding» box covers ours and eats the taps. No error boxes:
# a crash or an ANR of ours is still caught in logcat (finish).
adb shell settings put global hide_error_dialogs 1 >/dev/null 2>&1 || true
# P54: the sign-in screens take a phone number and a code. Typing with the
# on-screen keyboard up has taken the emulator down (adb gone right after);
# with every input method off, `input text` still reaches the focused field
# and no keyboard opens.
for ime in $(adbt shell ime list -s 2>/dev/null | tr -d '\r'); do
  adbt shell ime disable "$ime" >/dev/null 2>&1 || true
done
# The code fields ask for SMS one-time-code autofill and the phone fields for
# a phone number (useful on a phone). On the emulator the autofill service
# answering them is suspected of taking the device down as the code screen
# opens; the smoke turns autofill off.
adbt shell settings put secure autofill_service null >/dev/null 2>&1 || true
# The whole device log, kept on the runner as it comes: when the emulator
# itself goes down, the per-app logcat afterwards has nothing.
(adb logcat -v time '*:W' > "$out/live-logcat.txt" 2>&1 &)

# Installs and starts it; 2 when this emulator cannot run it.
launch() {
  local apk=$1 pkg=$2 name=$3
  adbt uninstall "$pkg" >/dev/null 2>&1 || true
  if ! timeout 300 adb install -r "$apk" >"$out/$name-install.txt" 2>&1; then
    cat "$out/$name-install.txt"
    return 2
  fi
  # Android finishes an install with broadcasts; on a slow emulator they can
  # land seconds later and restart the activity under the first tap (P31).
  timeout 90 adb shell am wait-for-broadcast-idle >/dev/null 2>&1 || true
  adbt logcat -c
  # The log as it comes, for when the emulator itself goes away: finish's
  # dump needs a device that still answers.
  adb logcat -v threadtime >"$out/$name-stream.txt" 2>&1 &
  stream=$!
  adbt shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
}

# Still running, nothing fatal in the log; the screen as it is.
finish() {
  local pkg=$1 name=$2
  adbt exec-out screencap -p >"$out/$name.png" || true
  if adbt logcat -d >"$out/$name-logcat.txt" 2>&1; then
    rm -f "$out/$name-stream.txt" # the dump has it all
  fi
  kill "$stream" 2>/dev/null || true
  stream=
  if ! adbt shell pidof "$pkg" >/dev/null 2>&1; then
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
  # A01 «Telefon raqam bilan» (P54): T1 opens — no network needed, the
  # same in the demo and with the backend.
  # The terms box starts unticked: tick it (its box is the row's left end).
  if ui wait 'Telefon raqam bilan' 90 && ui tapleft 'Foydalanish shartlariga roziman' 30 &&
    ui tapto 'Telefon raqam bilan' 'Telefon raqamingiz' 40; then
    echo "$name: A01 → «Telefon raqam bilan» → T1"
  else
    echo "::error::$name: A01 «Telefon raqam bilan» did not answer"
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
  # First launch: the language (언어 · Til · Язык · Language) — English.
  # BA0 (P54): «Get started» with no number says so — no network and no
  # typing, the same in the demo and with the backend (typing and the code
  # screen are walked in walk_employer).
  if ui tap '=English' 90 && ui tapto '=Continue' 'Get started' 40 &&
    ui wait 'Get started' 30 && ui tapto '=Get started' 'Enter your phone number' 40; then
    echo "$name: BA0 «Get started» without a number → asks for it"
  elif ui wait '=Get started' 5; then
    # A 4-second snack bar a busy emulator's screen dump can miss. Still on
    # BA0 and alive (finish checks for a crash or an ANR): it answered.
    echo "::notice::$name: still on BA0, the message not caught"
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

shot() { adbt exec-out screencap -p >"$out/walk-$1.png" 2>/dev/null || true; }
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

walk_worker() {
  local apk=$apks/demo-worker-$1.apk pkg=uz.hanguk.ish name=walk-worker
  launch "$apk" "$pkg" "$name" || return
  # The «10 qadam» design: sign-in, A02, «Ishlar» (an offer opened with
  # puyl), «Mening ishlarim» (the steps and the stars), Profil and its
  # language kept after a restart.
  step 'A01: terms box' ui tapleft 'Foydalanish shartlariga roziman' 30 &&
    step 'A01 → T1' ui tap 'Telefon raqam bilan' 90 &&
    step 'T1: number' ui field 0 01012345678 &&
    ui hidekb &&
    step 'T1 → T2' ui tap '=Kod olish' &&
    step 'T2 opens' ui wait 'Kodni kiriting' 30 &&
    step 'T2: code (the demo takes any six digits)' ui type 123456 &&
    step 'A02 opens' ui wait 'Profil · 1 / 3' 30 &&
    shot a02-1 &&
    step 'A02-1: first name' ui field 0 Dilnoza &&
    ui hidekb &&
    step 'A02-1: last name' ui field 1 Testova &&
    ui hidekb &&
    step 'A02-1 → 2' ui tap '=Davom etish' &&
    step 'A02-2 opens' ui wait 'Profil · 2 / 3' &&
    step 'A02-2: Uzbek' ui tap "=O'zbekcha" &&
    step 'A02-2: Korean' ui tap '=Koreyscha' &&
    step 'A02-2: region row' ui scrollto '=Shahar yoki viloyat' &&
    step 'A02-2: region list' ui tapbelow '=Shahar yoki viloyat' '=Tanlang' &&
    step 'A02-2: search' ui field 0 Mapo &&
    step 'A02-2: Mapo-gu' ui tap 'Mapo-gu, Seul' &&
    ui hidekb &&
    shot a02-2 &&
    step 'A02-2 → 3' ui tap '=Davom etish' &&
    step 'A02-3 opens' ui wait 'Profil · 3 / 3' &&
    step 'A02-3: Saturday row' ui scrollto '=Shanba, Kunduzi' &&
    step 'A02-3: Saturday daytime' ui tap '=Shanba, Kunduzi' &&
    step 'A02-3 → start' ui tap '=Saqlash va boshlash' &&
    ui tapif 'Keyinroq' 10 &&
    ui tapif 'While using the app' 5 &&
    step 'Ishlar: an offer and its timer' ui wait 'Shaxsiy taklif' 30 &&
    shot ishlar &&
    # The card reads as one node (its words); the button is a node of its own.
    step 'Ishlar: open the phone and address' ui tap '=Telefon va manzilni ochish · 10 P' 30 &&
    step 'the sheet' ui wait 'Ish sizga biriktiriladi' 15 &&
    shot unlock-sheet &&
    step 'open with puyl' ui tap '=10 puyl bilan ochish' &&
    step 'opened' ui wait 'Ochilgan' 15 &&
    shot ishlar-opened &&
    step 'Mening ishlarim' ui tap '=Mening ishlarim' &&
    step 'Mening ishlarim: the phone' ui wait '010-4821' 15 &&
    step 'Ishga chiqdim' ui tap '=Ishga chiqdim' &&
    step 'the stars' ui wait 'Ish beruvchini baholang' 15 &&
    step 'five stars' ui tap '=5 yulduz' &&
    shot mening-ishlarim &&
    step 'Profil' ui tap '=Profil' &&
    step 'Profil: the name' ui wait 'Dilnoza T.' 15 &&
    shot profil &&
    step 'Profil: language row' ui scrollto 'Русский' &&
    step 'Profil: Russian' ui tap 'Русский' &&
    step 'Profil in Russian' ui wait '=Профиль' &&
    shot profil-ru &&
    adb shell am force-stop "$pkg" &&
    adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 &&
    step 'after a restart: still Russian' ui wait '=По номеру телефона' 60 &&
    shot a01-ru-restarted &&
    echo "$name: A01 → A02 ×3 → Ishlar → ochish → Mening ishlarim → baho → Profil → Русский → restart" ||
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
  # The first launch asks the language; the walk reads Korean. P54: the phone and an SMS code; P50: no
  # business number.
  step 'first launch: the language' ui wait 'Language' 90 &&
    step 'Korean' ui tap '=한국어' &&
    # The button reads in the language just picked (다음) or still in English.
    { ui tapif '=다음' 5; ui tapif '=Continue' 5; } &&
    step 'BA0 in Korean' ui wait '시작하기' &&
    step 'BA0: phone' ui field 0 01012345678 &&
    ui hidekb &&
    step 'BA0 → code' ui tap '=시작하기' &&
    step 'code opens' ui wait '인증번호 입력' 30 &&
    step 'code (the demo takes any six digits)' ui type 123456 &&
    step 'BA1' ui wait '오늘의 근무' 30 &&
    shot ba1 &&
    step 'BA5' ui tap '=리포트' &&
    step 'BA5: CSV button' ui scrollto 'CSV 다운로드' &&
    shot ba5 &&
    step 'BA5: CSV' ui tapx 'CSV 다운로드' 85 &&
    step 'BA5: the CSV goes to the share sheet' shared &&
    shot ba5-share &&
    adbt shell input keyevent 4 &&
    step 'back in BA5' ui wait 'CSV 다운로드' &&
    step 'BA5 → BA1' ui tap '=홈' &&
    step 'BA1 again' ui wait '오늘의 근무' 30 &&
    step 'BA1 → BA3' ui tap '마감 정리 보조' 30 -1 &&
    step 'BA3: QR button' ui scrollto 'QR 인쇄·공유' &&
    shot ba3 &&
    step 'BA3: QR' ui tapend 'QR 인쇄·공유' 42 &&
    step 'BA3: the QR picture goes to the share sheet' shared &&
    shot ba3-share &&
    echo "$name: BA0 → BA1 → BA5 → CSV share → BA1 → BA3 → QR share" ||
    { shot failed-employer; failed=1; }
  # The QR's share sheet stays open to the end. Closing it, the emulator
  # itself (not the app) has gone away now and then on the very next step —
  # adb «device offline», whether that step went back to BA1 or to BA5 — and
  # the walk has seen what it came for.
  finish "$pkg" "$name"
}

walk_worker arm64
walk_employer arm64
exit $failed
