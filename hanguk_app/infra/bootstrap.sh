#!/usr/bin/env bash
# bootstrap.sh — idempotent first-boot hardening for a fresh Hetzner CX22.
#
# Usage:
#   ssh root@<vps-ipv4> 'bash -s' < infra/bootstrap.sh
#
# Or via deploy.sh which uploads then runs.
#
# Companion docs:
#   docs/runbooks/hetzner-provisioning.md  (human-readable steps)
#   ADR-003                                (why Hetzner)

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "bootstrap.sh must run as root (got uid=$(id -u))" >&2
  exit 1
fi

echo "[bootstrap] base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get -y -qq upgrade
apt-get -y -qq install \
  python3.12 python3.12-venv python3-pip \
  build-essential git curl rsync \
  ufw fail2ban unattended-upgrades \
  ca-certificates jq

echo "[bootstrap] uni-db service account"
if ! id -u uni-db >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /opt/uni_db \
    --shell /usr/sbin/nologin uni-db
fi
install -d -o uni-db -g uni-db /opt/uni_db
install -d -o uni-db -g uni-db /var/cache/uni_db
install -d -o uni-db -g uni-db /var/log/uni_db
install -d -o root -g uni-db -m 0750 /etc/uni_db

echo "[bootstrap] firewall"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
yes | ufw enable >/dev/null

echo "[bootstrap] fail2ban"
systemctl enable --now fail2ban

echo "[bootstrap] unattended-upgrades"
# Force-enable the security updates origin without an interactive
# dpkg-reconfigure (so this script is non-interactive).
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo "[bootstrap] sshd hardening"
sed -i \
  -e 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' \
  -e 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' \
  -e 's/^#*KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' \
  /etc/ssh/sshd_config
systemctl restart ssh

echo "[bootstrap] done. Next: deploy.sh"
