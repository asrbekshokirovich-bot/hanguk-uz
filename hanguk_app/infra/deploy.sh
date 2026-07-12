#!/usr/bin/env bash
# deploy.sh — push local source to the VPS, install/refresh the venv,
# drop systemd units, restart workers.
#
# Usage:
#   infra/deploy.sh <vps-ipv4>
#
# Idempotent. Does NOT touch /etc/uni_db/env — that file is hand-managed
# (or set up via the Gemini deploy prompt in Phase D).

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <vps-ipv4>" >&2
  exit 1
fi

VPS="$1"
SSH_TARGET="root@${VPS}"

# Sanity: confirm we can reach the VPS first
echo "[deploy] checking ssh..."
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  "$SSH_TARGET" 'echo ok' >/dev/null

# 1. Push the Python service
echo "[deploy] rsync services/uni_db/ -> /opt/uni_db/services/uni_db/"
rsync -az --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.venv' \
  --exclude='.pytest_cache' \
  --exclude='.staging-secrets.txt' \
  --exclude='.prod-db-url.txt' \
  --exclude='.env' \
  services/uni_db/ \
  "${SSH_TARGET}:/opt/uni_db/services/uni_db/"

# 2. Push systemd unit files
echo "[deploy] copy systemd units"
rsync -az infra/systemd/ "${SSH_TARGET}:/etc/systemd/system/"

# 3. Install/refresh the venv on the VPS
echo "[deploy] venv install on VPS"
ssh "$SSH_TARGET" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/uni_db/services/uni_db
chown -R uni-db:uni-db /opt/uni_db
if [[ ! -d .venv ]]; then
  sudo -u uni-db python3.12 -m venv .venv
fi
sudo -u uni-db .venv/bin/pip install --quiet --upgrade pip
sudo -u uni-db .venv/bin/pip install --quiet -e ".[heavy]"
REMOTE

# 4. Reload systemd, enable the scheduled timers
echo "[deploy] systemd reload + enable timers"
ssh "$SSH_TARGET" 'bash -s' <<'REMOTE'
set -euo pipefail
systemctl daemon-reload
# The board-polling guideline crawl (uni-db-sync -> run_discovery_once +
# run-pipeline) has been RETIRED: the cloud Claude Routine (find-guidelines)
# is now the guideline crawler. Disable the retired units (and the older
# per-stage units) if an earlier deploy enabled them. This box now only runs
# the weekly Adiga admissions-calendar fetch.
systemctl disable --now \
  uni-db-sync.timer \
  uni-db-sync.service \
  uni-db-discovery-poll.timer \
  uni-db-extract.service \
  uni-db-translate.service 2>/dev/null || true
# Enable the weekly Adiga calendar fetch.
systemctl enable --now uni-db-adiga-calendar.timer
REMOTE

# 5. Smoke check — show the timer schedule + the first cycle's logs
echo "[deploy] post-deploy status"
ssh "$SSH_TARGET" 'bash -s' <<'REMOTE'
echo "--- timers ---"
systemctl list-timers 'uni-db-*' --no-pager || true
echo "--- last uni-db-adiga-calendar run ---"
journalctl -u uni-db-adiga-calendar -n 40 --no-pager
REMOTE

echo "[deploy] done."
