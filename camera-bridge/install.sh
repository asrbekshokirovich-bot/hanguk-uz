#!/usr/bin/env bash
#
# One-command setup for the office camera bridge.
#
# Run this ON THE OFFICE COMPUTER — the one on the same network as the camera.
# It cannot run in the cloud: the Xiaomi video path is local-only.
#
#   bash install.sh
#
# Safe to re-run. It never overwrites config you have already filled in.

set -euo pipefail

cd "$(dirname "$0")"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[33m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[31mStopped: %s\033[0m\n\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- 1. Docker
say "1/5  Checking Docker"

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker is not installed."
  if [ "$(uname -s)" != "Linux" ]; then
    die "Install Docker Desktop manually, then run this again."
  fi
  read -r -p "  Install Docker now? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "Docker is required."
  curl -fsSL https://get.docker.com | sh
  info "Docker installed."
fi

if ! docker info >/dev/null 2>&1; then
  die "Docker is installed but the daemon is not running (try: sudo systemctl start docker), or your user is not in the docker group (sudo usermod -aG docker \$USER, then log out and back in)."
fi

if ! docker compose version >/dev/null 2>&1; then
  die "The 'docker compose' plugin is missing. Install docker-compose-plugin."
fi
info "Docker is ready."

# ---------------------------------------------------------------- 2. Config
say "2/5  Preparing config files"

for pair in ".env.example:.env" \
            "go2rtc/go2rtc.yaml.example:go2rtc/go2rtc.yaml" \
            "frigate/config.yml.example:frigate/config.yml"; do
  src="${pair%%:*}"; dst="${pair##*:}"
  if [ -f "$dst" ]; then
    info "$dst already exists — left untouched."
  else
    cp "$src" "$dst"
    info "created $dst"
  fi
done

# ------------------------------------------------------------ 3. Secret key
say "3/5  Supabase key"

# Read the current value without sourcing .env (it may contain characters
# that a shell would interpret).
current_key="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2- || true)"

if [ -z "$current_key" ]; then
  info "The agent needs the Supabase SERVICE ROLE key to write events."
  info "Find it at: Supabase dashboard > Project settings > API > service_role"
  warn "This key bypasses all security rules. It stays on this computer only."
  read -r -s -p "  Paste the service role key (input hidden): " key
  echo
  [ -n "$key" ] || die "No key entered."
  tmp="$(mktemp)"
  grep -v '^SUPABASE_SERVICE_ROLE_KEY=' .env > "$tmp"
  printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$key" >> "$tmp"
  mv "$tmp" .env
  chmod 600 .env
  info "Saved to .env (readable only by you)."
else
  info "Key already set in .env — left untouched."
fi

# --------------------------------------------------------------- 4. Storage
say "4/5  Recording storage"

rec_path="$(grep -E '^RECORDINGS_PATH=' .env | cut -d= -f2- || true)"
rec_path="${rec_path:-./recordings}"
mkdir -p "$rec_path"

if command -v df >/dev/null 2>&1; then
  avail_gb="$(df -BG --output=avail "$rec_path" 2>/dev/null | tail -1 | tr -dc '0-9' || echo '')"
  if [ -n "$avail_gb" ]; then
    info "Free space at $rec_path: ${avail_gb} GB"
    # Roughly 1 TB per camera-month of continuous 2K footage.
    if [ "$avail_gb" -lt 200 ]; then
      warn "That is tight for 30-day retention. Lower record.retain.days in"
      warn "frigate/config.yml, or point RECORDINGS_PATH at a bigger disk."
    fi
  fi
fi

# ----------------------------------------------------------------- 5. Start
say "5/5  Starting the stack"

docker compose up -d
sleep 3
docker compose ps

ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
ip="${ip:-<this-computer-ip>}"

cat <<EOF

------------------------------------------------------------------
Running. Two things left, both in the browser:

1. Pair the camera
   Open:  http://$ip:1984
   Click: Add -> Xiaomi -> log in with the Mi Home account that owns
          the camera -> select it. Name the stream: office

   Use a separate Mi account with the camera shared to it. The password
   is stored on this computer in plain text.

   Check it works: http://$ip:1984/stream.html?src=office

2. Register the camera in the CRM
   Run this in the Supabase SQL editor:

     insert into public.cameras (name, location, model, stream_key)
     values ('Ofis', 'Reception', 'mxiang.camera.c301', 'office');

   Then set VITE_CAMERA_BRIDGE_URL=http://$ip:1984 in the CRM
   environment and open /crm/cameras.

Recordings appear in: $rec_path
Logs:                 docker compose logs -f
Stop:                 docker compose down
------------------------------------------------------------------

EOF
