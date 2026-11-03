#!/usr/bin/env bash
# Haqiqiy go2rtc bilan to'liq sinov: soxta kamera → go2rtc (ishlab chiqarishdagi go2rtc.yaml) → camera-gate.
# Kerak: Linux, ffmpeg (libx264), deno, go2rtc 1.9.15.
#   GO2RTC_BIN=/yo'l/go2rtc DENO_BIN=/yo'l/deno bash deploy/camera/test/e2e.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAM="$(cd "$HERE/.." && pwd)"
GO2RTC_BIN="${GO2RTC_BIN:-go2rtc}"
DENO_BIN="${DENO_BIN:-deno}"
WORK="$(mktemp -d)"
PIDS=()

cleanup() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

for bin in ffmpeg "$GO2RTC_BIN" "$DENO_BIN"; do
  command -v "$bin" >/dev/null || { echo "topilmadi: $bin"; exit 1; }
done

rand() { head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
SECRET="$(rand 48)"
HEALTH="$(rand 24)"

# 1) Soxta kamera (EZVIZ o'rnida)
(cd "$WORK" && exec "$GO2RTC_BIN" -c "$HERE/fake-camera.yaml") >"$WORK/fake.log" 2>&1 &
PIDS+=($!)
# 2) Ishlab chiqarishdagi go2rtc.yaml + sinov kameralari (kod — env orqali, xuddi serverdagidek)
(cd "$WORK" && KIRISH_KOD=ABCDEF exec "$GO2RTC_BIN" -c "$CAM/office/go2rtc.yaml" -c "$HERE/cameras.e2e.yaml") \
  >"$WORK/go2rtc.log" 2>&1 &
PIDS+=($!)
# 3) camera-gate
GATE_LISTEN=127.0.0.1:18080 GATE_SECRET="$SECRET" HEALTH_KEY="$HEALTH" CAMERAS=kirish,zal \
  "$DENO_BIN" run --allow-net --allow-env "$CAM/gate/main.ts" >"$WORK/gate.log" 2>&1 &
PIDS+=($!)

for _ in $(seq 1 100); do
  if curl -fsS -o /dev/null -H "x-health-key: $HEALTH" http://127.0.0.1:18080/health 2>/dev/null; then break; fi
  sleep 0.1
done

status=0
E2E_GATE_URL=http://127.0.0.1:18080 E2E_GO2RTC_URL=http://127.0.0.1:1984 \
  E2E_SECRET="$SECRET" E2E_HEALTH_KEY="$HEALTH" \
  "$DENO_BIN" test --allow-net --allow-env "$CAM/gate/e2e_test.ts" || status=$?

if [ "$status" != 0 ] || [ "${E2E_VERBOSE:-0}" = 1 ]; then
  for f in fake go2rtc gate; do
    echo "----- $f.log -----"
    tail -n 40 "$WORK/$f.log" || true
  done
fi
exit "$status"
