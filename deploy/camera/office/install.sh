#!/usr/bin/env bash
# Hanguk kamera serveri — ofis kompyuteriga o'rnatish (Ubuntu Server 24.04 LTS).
#
#   VPS bilan (tavsiya):    sudo bash install.sh --vps-endpoint <VPS_IP>:51820 --vps-pubkey <VPS_KALITI>
#   VPS'siz (ofisda oq IP): sudo bash install.sh --no-wireguard
#
# Qayta ishga tushirish xavfsiz: mavjud kalitlar, secrets/*.env va cameras.yaml o'zgartirilmaydi.
# Batafsil: deploy/camera/README.md
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" # deploy/camera
DIR=/opt/hanguk-camera
WG_DIR=/etc/wireguard
WG_IF=hanguk-cam
WG_ADDR=10.8.0.2
VPS_WG_ADDR=10.8.0.1
VPS_ENDPOINT=""
VPS_PUBKEY=""
USE_WG=1
SKIP_SYSTEM=0

usage() {
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}
while [ $# -gt 0 ]; do
  case "$1" in
  --vps-endpoint) VPS_ENDPOINT="${2:?}" && shift 2 ;;
  --vps-pubkey) VPS_PUBKEY="${2:?}" && shift 2 ;;
  --no-wireguard) USE_WG=0 && shift ;;
  --dir) DIR="${2:?}" && shift 2 ;;
  --wg-dir) WG_DIR="${2:?}" && shift 2 ;;
  --skip-system) SKIP_SYSTEM=1 && shift ;; # faqat fayllar (sinov uchun): apt, docker, systemd yo'q
  -h | --help) usage 0 ;;
  *) echo "Noma'lum parametr: $1" && usage 1 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() {
  printf '\nXATO: %s\n' "$*" >&2
  exit 1
}
rand() { head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

[ "$SKIP_SYSTEM" = 1 ] || [ "$(id -u)" = 0 ] || die "sudo bilan ishga tushiring"
if [ "$USE_WG" = 1 ]; then
  [ -n "$VPS_ENDPOINT" ] && [ -n "$VPS_PUBKEY" ] ||
    die "--vps-endpoint va --vps-pubkey kerak (VPS'dagi setup.sh chiqargan qiymatlar) yoki --no-wireguard"
  [[ "$VPS_ENDPOINT" =~ ^[A-Za-z0-9.:-]+:[0-9]+$ ]] || die "--vps-endpoint IP:port ko'rinishida bo'lsin"
  [[ "$VPS_PUBKEY" =~ ^[A-Za-z0-9+/]{42,43}=?$ ]] || die "--vps-pubkey WireGuard kaliti emas"
fi

if [ "$SKIP_SYSTEM" = 0 ]; then
  say "1/5 Paketlar: Docker, WireGuard"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 wireguard-tools ca-certificates >/dev/null
  systemctl enable --now docker >/dev/null
fi

say "2/5 Fayllar: $DIR"
install -d -m 755 "$DIR" "$DIR/gate"
install -d -m 700 "$DIR/secrets"
install -m 644 "$SRC/office/docker-compose.yml" "$SRC/office/go2rtc.yaml" "$SRC/office/cameras.yaml.example" "$DIR/"
for f in main.ts gate.ts config.ts token.ts deno.json; do install -m 644 "$SRC/gate/$f" "$DIR/gate/$f"; done
[ -f "$DIR/cameras.yaml" ] || install -m 644 "$SRC/office/cameras.yaml.example" "$DIR/cameras.yaml"
[ -f "$DIR/secrets/cameras.env" ] || install -m 600 "$SRC/office/cameras.env.example" "$DIR/secrets/cameras.env"
NEW_SECRETS=0
if [ ! -f "$DIR/secrets/gate.env" ]; then
  listen="127.0.0.1:8080"
  [ "$USE_WG" = 1 ] && listen="$WG_ADDR:8080"
  (
    umask 077
    cat >"$DIR/secrets/gate.env" <<EOF
# camera-gate sozlamasi. GATE_SECRET va HEALTH_KEY Supabase secrets'ga ham yoziladi:
#   CAMERA_GATE_SECRET = GATE_SECRET,  CAMERA_HEALTH_KEY = HEALTH_KEY
GATE_SECRET=$(rand 48)
HEALTH_KEY=$(rand 32)
# cameras.yaml dagi nomlar, vergul bilan
CAMERAS=kirish,zal
# VPS bilan: WireGuard manzili; VPS'siz: 127.0.0.1:8080
GATE_LISTEN=$listen
GO2RTC_URL=http://127.0.0.1:1984
GATE_ORIGINS=https://hanguk.uz,https://www.hanguk.uz
EOF
  )
  NEW_SECRETS=1
fi
chmod 600 "$DIR"/secrets/*.env

OFFICE_PUB=""
if [ "$USE_WG" = 1 ]; then
  say "3/5 WireGuard: $WG_ADDR → VPS $VPS_ENDPOINT"
  install -d -m 700 "$WG_DIR"
  if command -v wg >/dev/null; then
    [ -f "$WG_DIR/$WG_IF.key" ] || (umask 077 && wg genkey >"$WG_DIR/$WG_IF.key")
    OFFICE_PUB="$(wg pubkey <"$WG_DIR/$WG_IF.key")"
  elif [ "$SKIP_SYSTEM" = 1 ]; then
    [ -f "$WG_DIR/$WG_IF.key" ] || (umask 077 && echo "SINOV_KALITI_SINOV_KALITI_SINOV_KALITI_SIN=" >"$WG_DIR/$WG_IF.key")
    OFFICE_PUB="SINOV_OCHIQ_KALIT"
  else
    die "wg topilmadi (wireguard-tools)"
  fi
  (
    umask 077
    cat >"$WG_DIR/$WG_IF.conf" <<EOF
# Hanguk kamera tunneli (ofis tomoni). deploy/camera/office/install.sh yozgan.
[Interface]
Address = $WG_ADDR/32
PrivateKey = $(cat "$WG_DIR/$WG_IF.key")

[Peer]
# VPS
PublicKey = $VPS_PUBKEY
Endpoint = $VPS_ENDPOINT
AllowedIPs = $VPS_WG_ADDR/32
PersistentKeepalive = 25
EOF
  )
  if [ "$SKIP_SYSTEM" = 0 ]; then
    systemctl enable "wg-quick@$WG_IF" >/dev/null
    systemctl restart "wg-quick@$WG_IF"
  fi
else
  say "3/5 WireGuard: o'tkazib yuborildi (--no-wireguard)"
fi

say "4/5 Xizmatlar: go2rtc va camera-gate"
if [ "$SKIP_SYSTEM" = 0 ]; then
  (cd "$DIR" && docker compose pull -q && docker compose up -d)
fi

say "5/5 Keyingi qadamlar"
cat <<EOF
  1. Kameralar:   sudo nano $DIR/cameras.yaml          (IP va nomlar)
                  sudo nano $DIR/secrets/cameras.env   (kodlar)
                  sudo nano $DIR/secrets/gate.env      (CAMERAS= nomlar)
     So'ng:       cd $DIR && sudo docker compose up -d --force-recreate
  2. Holat:       sudo docker compose -f $DIR/docker-compose.yml logs --tail 30
EOF
if [ "$NEW_SECRETS" = 1 ]; then
  cat <<EOF
  3. Supabase secrets (Edge Functions → Secrets) — qiymatlar: sudo cat $DIR/secrets/gate.env
       CAMERA_GATE_SECRET = GATE_SECRET
       CAMERA_HEALTH_KEY  = HEALTH_KEY
EOF
fi
if [ "$USE_WG" = 1 ]; then
  cat <<EOF
  4. VPS'da ofisni ulang:
       sudo bash setup.sh --domain cam.hanguk.uz --office-pubkey $OFFICE_PUB
EOF
fi
