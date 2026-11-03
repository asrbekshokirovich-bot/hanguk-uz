#!/usr/bin/env bash
# Hanguk kamera — VPS (Ubuntu 24.04 LTS): Caddy (HTTPS) + WireGuard tunnel.
#
#   1) sudo bash setup.sh --domain cam.hanguk.uz
#        → VPS kaliti chiqadi; ofisda: install.sh --vps-endpoint <VPS_IP>:51820 --vps-pubkey <shu kalit>
#   2) sudo bash setup.sh --domain cam.hanguk.uz --office-pubkey <ofis kaliti>
#        → ofis serveri ulanadi
#
# VPS'da kamera kodi ham, GATE_SECRET ham saqlanmaydi: u faqat HTTPS va tunnel.
# SSH boshqa portda bo'lsa: --ssh-port <port> (aks holda ulanish uzilib qolishi mumkin).
set -euo pipefail

DOMAIN=""
OFFICE_PUBKEY=""
WG_PORT=51820
SSH_PORT=22
ROOT=""
SKIP_SYSTEM=0
WG_IF=hanguk-cam
VPS_WG_ADDR=10.8.0.1
OFFICE_WG_ADDR=10.8.0.2

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}
while [ $# -gt 0 ]; do
  case "$1" in
  --domain) DOMAIN="${2:?}" && shift 2 ;;
  --office-pubkey) OFFICE_PUBKEY="${2:?}" && shift 2 ;;
  --wg-port) WG_PORT="${2:?}" && shift 2 ;;
  --ssh-port) SSH_PORT="${2:?}" && shift 2 ;;
  --root) ROOT="${2:?}" && shift 2 ;;       # sinov uchun: /etc o'rniga boshqa papka
  --skip-system) SKIP_SYSTEM=1 && shift ;; # sinov uchun: apt, ufw, systemd yo'q
  -h | --help) usage 0 ;;
  *) echo "Noma'lum parametr: $1" && usage 1 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() {
  printf '\nXATO: %s\n' "$*" >&2
  exit 1
}

[ "$SKIP_SYSTEM" = 1 ] || [ "$(id -u)" = 0 ] || die "sudo bilan ishga tushiring"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "--domain kerak, masalan cam.hanguk.uz"
[ -z "$OFFICE_PUBKEY" ] || [[ "$OFFICE_PUBKEY" =~ ^[A-Za-z0-9+/]{42,43}=?$ ]] || die "--office-pubkey WireGuard kaliti emas"
[[ "$WG_PORT" =~ ^[0-9]+$ && "$SSH_PORT" =~ ^[0-9]+$ ]] || die "port raqam bo'lsin"

WG_DIR="$ROOT/etc/wireguard"
CADDY_DIR="$ROOT/etc/caddy"

if [ "$SKIP_SYSTEM" = 0 ]; then
  say "1/4 Paketlar: Caddy, WireGuard, ufw"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy wireguard-tools ufw >/dev/null
fi

say "2/4 WireGuard ($WG_IF, UDP $WG_PORT)"
install -d -m 700 "$WG_DIR"
if command -v wg >/dev/null; then
  [ -f "$WG_DIR/$WG_IF.key" ] || (umask 077 && wg genkey >"$WG_DIR/$WG_IF.key")
  VPS_PUB="$(wg pubkey <"$WG_DIR/$WG_IF.key")"
elif [ "$SKIP_SYSTEM" = 1 ]; then
  [ -f "$WG_DIR/$WG_IF.key" ] || (umask 077 && echo "SINOV_KALITI_SINOV_KALITI_SINOV_KALITI_SIN=" >"$WG_DIR/$WG_IF.key")
  VPS_PUB="SINOV_OCHIQ_KALIT"
else
  die "wg topilmadi (wireguard-tools)"
fi
(
  umask 077
  {
    echo "# Hanguk kamera tunneli (VPS tomoni). deploy/camera/vps/setup.sh yozgan."
    echo "[Interface]"
    echo "Address = $VPS_WG_ADDR/24"
    echo "ListenPort = $WG_PORT"
    echo "PrivateKey = $(cat "$WG_DIR/$WG_IF.key")"
    if [ -n "$OFFICE_PUBKEY" ]; then
      echo
      echo "[Peer]"
      echo "# ofis serveri"
      echo "PublicKey = $OFFICE_PUBKEY"
      echo "AllowedIPs = $OFFICE_WG_ADDR/32"
    fi
  } >"$WG_DIR/$WG_IF.conf"
)

say "3/4 Caddy: https://$DOMAIN → ofisdagi camera-gate ($OFFICE_WG_ADDR:8080)"
install -d -m 755 "$CADDY_DIR"
cat >"$CADDY_DIR/Caddyfile" <<EOF
# Hanguk kamera — deploy/camera/vps/setup.sh yozgan.
# HTTPS sertifikatini Caddy o'zi oladi (DNS: $DOMAIN → shu VPS IP).
# So'rovlar jurnali yoqilmagan: havolalarda 5 daqiqalik kalit bor.
$DOMAIN {
	reverse_proxy $OFFICE_WG_ADDR:8080
	header -Server
}
EOF

if [ "$SKIP_SYSTEM" = 0 ]; then
  say "4/4 Xavfsizlik devori va xizmatlar"
  ufw allow "$SSH_PORT/tcp" >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow "$WG_PORT/udp" >/dev/null
  ufw --force enable >/dev/null
  systemctl enable "wg-quick@$WG_IF" >/dev/null
  systemctl restart "wg-quick@$WG_IF"
  systemctl enable caddy >/dev/null
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

cat <<EOF

Tayyor.
  VPS kaliti (ofisdagi install.sh ga --vps-pubkey):  $VPS_PUB
  VPS manzili (--vps-endpoint):                       <shu VPS IP>:$WG_PORT
  DNS (Billur): $DOMAIN → A yozuv → shu VPS IP
EOF
if [ -z "$OFFICE_PUBKEY" ]; then
  echo "  Ofis serveri hali ulanmagan: install.sh dan keyin --office-pubkey bilan qayta ishga tushiring."
else
  echo "  Tekshirish: sudo wg show $WG_IF   (latest handshake ko'rinishi kerak)"
fi
