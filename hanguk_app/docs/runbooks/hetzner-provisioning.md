# Hetzner VPS provisioning — uni_db worker host

> Audience: the engineer who provisions the always-on VPS that runs the
> uni_db crawler / extractor / OCR / translation workers.
>
> Pair this with [ADR-003](../decisions/003-worker-placement.md) for
> the rationale, and with
> [`PHASE_3_DESIGN.md` §3](../../services/uni_db/PHASE_3_DESIGN.md#3-hetzner-vps-provisioning)
> for the systems shape this runbook produces.
>
> **Cost:** €5.83/mo for CX22, billed monthly. Bumping to CX32 (€11/mo)
> is a one-click resize if the workload outgrows the smaller box.

## 1. Why we host this ourselves

ADR-003 picked a long-lived VPS over Cloudflare Workers because the
extractor stack (PyMuPDF + EasyOCR + Playwright) doesn't fit a 30-second
serverless execution cap. The VPS itself is **stateless** — losing it is
recoverable in 10 minutes by re-running this runbook against a fresh
CX22.

Nothing on the VPS is irreplaceable:

- Source code: pulled from the Hanguk repo
- Dependencies: rebuilt via `make install`
- Configuration: in `/etc/uni_db/env` (regenerated from the secrets
  vault)
- Caches: `/var/cache/uni_db/` is local-only and rebuildable
- The Korean PDFs / state: live in Supabase, not on the VPS

Treat the VPS as cattle, not pet.

## 2. Before you start — checklist

| Item | Where | Action |
|---|---|---|
| Hetzner Cloud account | <https://www.hetzner.com/cloud> | Sign up; add a payment method |
| SSH keypair | Your laptop | `ssh-keygen -t ed25519 -C "uni-db-deploy"` if you don't already have one |
| Hetzner project | Cloud Console | Create a project named `hanguk-uni-db` |
| Project SSH key | Cloud Console → Security → SSH Keys | Upload your `~/.ssh/id_ed25519.pub` |
| Phase 3 secrets gathered | (from `docs/credentials.md`) | Anthropic, Supabase service-role, Naver Papago, FCM/APNs etc. — you'll write these to `/etc/uni_db/env` later |
| Repo access | Local clone or rsync source | The bootstrap copies code from a known-good checkout, not git directly — see §5 |

## 3. Create the CX22

In Hetzner Cloud Console → **Add Server**:

| Field | Value |
|---|---|
| Location | **Helsinki (hel1)** preferred; Falkenstein (fsn1) second choice |
| Image | **Ubuntu 24.04** |
| Type | **CX22** (2 vCPU, 4 GB RAM, 40 GB disk, €5.83/mo) |
| Networking | **IPv4 enabled** (yes — Naver Cloud and some `.ac.kr` hosts still don't have IPv6 records); IPv6 also on |
| SSH Keys | tick the key you uploaded in §2 |
| Firewalls | None at create time — we'll harden via `ufw` on the VM itself |
| Backups | **Off** (the host is stateless; backups would only protect rebuildable caches) |
| Cloud config (user data) | Leave blank — we run the bootstrap from the cold-boot SSH session |
| Name | `uni-db-prod-1` |
| Labels | `env=prod`, `service=uni-db` |

Click **Create & Buy now**. Wait ~30 seconds for the provisioning email
with the public IPv4.

## 4. First-login hardening

```bash
# From your laptop:
ssh root@<public-ipv4>
```

You're root. The first session is the only one that should be — every
subsequent login goes through the `uni-db` service account.

Run the bootstrap commands (these are also captured as
`infra/bootstrap.sh` in the planned tree from `PHASE_3_DESIGN.md` §3.4
— this runbook is the human-readable version):

```bash
# 4.1 — base packages
apt-get update
apt-get -y upgrade
apt-get -y install \
  python3.12 python3.12-venv python3-pip \
  build-essential git curl rsync \
  ufw fail2ban unattended-upgrades \
  ca-certificates

# 4.2 — service account (no shell login by default)
useradd --system --create-home --home-dir /opt/uni_db \
  --shell /usr/sbin/nologin uni-db
mkdir -p /etc/uni_db /var/cache/uni_db /var/log/uni_db
chown -R uni-db:uni-db /opt/uni_db /var/cache/uni_db /var/log/uni_db
chmod 750 /etc/uni_db    # secrets dir, root-only by default

# 4.3 — firewall (deny everything inbound except SSH)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable

# 4.4 — fail2ban for SSH
systemctl enable --now fail2ban

# 4.5 — automatic security updates
dpkg-reconfigure --priority=low unattended-upgrades
# Choose Yes when prompted.

# 4.6 — disable password SSH (keys only)
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh
```

Verify before you log out:

```bash
# In a SECOND terminal, confirm you can still SSH:
ssh root@<public-ipv4>
```

Don't proceed until the second login works.

## 5. Deploy the source

Two paths — pick one. **rsync from the dev machine** is recommended
for first deploy because it doesn't require git credentials on the
VPS. Once running, switch to git pulls via a deploy key if you want
faster iteration.

### 5.1 — rsync from a known-good checkout

```bash
# From your laptop, in the worktree root:
rsync -av --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.venv' \
  --exclude='.pytest_cache' \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='.dart_tool' \
  services/uni_db/ \
  root@<public-ipv4>:/opt/uni_db/services/uni_db/

# Also push the planned infra/ directory once it exists:
rsync -av infra/ root@<public-ipv4>:/opt/uni_db/infra/
```

### 5.2 — install the venv on the VPS

```bash
# Back on the VPS (as root, then drop to uni-db):
cd /opt/uni_db/services/uni_db
sudo -u uni-db python3.12 -m venv .venv
sudo -u uni-db .venv/bin/pip install --upgrade pip
sudo -u uni-db .venv/bin/pip install -e ".[heavy]"   # heavy includes EasyOCR + torch (~2 GB)
```

**Heads up:** `pip install -e .[heavy]` pulls torch with no GPU
support; on a CX22 the install peaks around 1.5 GB resident and ~2 GB
on disk. If the box runs out of memory during pip resolution, add a
1 GB swapfile temporarily:

```bash
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
# (you can remove the swapfile after install completes if you want)
```

## 6. Write the env file

```bash
# Still as root on the VPS:
cat > /etc/uni_db/env <<'EOF'
SUPABASE_URL=https://lysjdtyanhdfphqyijsr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste from secrets vault>
ANTHROPIC_API_KEY=<paste>
NAVER_PAPAGO_CLIENT_ID=<paste>
NAVER_PAPAGO_CLIENT_SECRET=<paste>
UNI_DB_LIVE_APIS=true
UNI_DB_LIVE_CRAWL=false
UNI_DB_OCR_PROVIDER=easyocr
UNI_DB_BLOB_STORAGE=supabase_storage
UNI_DB_TRANSLATION_LANGUAGES=en
EOF
chmod 640 /etc/uni_db/env
chown root:uni-db /etc/uni_db/env
```

Mode 640 + group `uni-db` means root can edit, the worker can read,
nobody else can do either.

**Do not commit `/etc/uni_db/env` or its contents to git, ever.** The
file lives only on the VPS plus your secrets vault.

## 7. systemd units

Drop the four planned units (the templates live at
`infra/systemd/uni-db-*.service` per `PHASE_3_DESIGN.md` §3.4) into
`/etc/systemd/system/`. The `EnvironmentFile=/etc/uni_db/env` line in
each unit picks up the secrets above.

```bash
# Once the unit files exist on disk:
systemctl daemon-reload
systemctl enable --now uni-db-discovery-poll.timer
systemctl enable --now uni-db-extract.service
systemctl enable --now uni-db-translate.service
systemctl enable --now uni-db-ocr.service
```

## 8. Verify

```bash
# 8.1 — units up
systemctl status uni-db-extract uni-db-translate uni-db-ocr
systemctl list-timers uni-db-*

# 8.2 — recent logs (no errors expected; lots of poll/no-work messages)
journalctl -u uni-db-extract -n 50 --no-pager
journalctl -u uni-db-translate -n 50 --no-pager

# 8.3 — DB sanity from the VPS (connects to Supabase via the env)
sudo -u uni-db /opt/uni_db/services/uni_db/.venv/bin/python -c \
  "from uni_db.cli import review_digest; review_digest()"
```

If the workers are healthy and idle, the digest prints something like:

```
review_queue: 0 pending, 0 overdue
extraction_queue: 0 pending
translation_queue: 0 pending
ocr_queue: 0 pending
```

## 9. Operational targets

Per [`PHASE_3_DESIGN.md` §3.6](../../services/uni_db/PHASE_3_DESIGN.md#36-operational-targets):

| Metric | Target | Where to read it |
|---|---|---|
| Discovery polling | every 6 hours per source | `systemctl list-timers uni-db-discovery-poll.timer` |
| Extraction queue depth | < 50 items | the `review_digest` query above |
| OCR throughput | ≥ 20 pages/min on CPU | `journalctl -u uni-db-ocr` (each page logs duration) |
| Translation queue lag | < 30 min | digest query (`max(now() - queued_at)`) |
| Memory headroom | ≥ 1 GB free | `free -h` |
| Disk usage | < 25 GB | `df -h /` |

If any threshold trips persistently:

1. **Memory or CPU saturation** — resize CX22 → CX32 in Cloud Console
   (one click, ~30 sec downtime). Same shape, double the cores and
   memory.
2. **OCR throughput drop** — usually means EasyOCR fell back to
   single-thread; restart `uni-db-ocr.service`. If recurring, check
   for torch-version drift after `apt upgrade`.
3. **Disk growing** — clear `/var/cache/uni_db/` (caches are
   regeneratable). Set up `tmpreaper` to auto-clear older than 7 days
   if the problem persists.

## 10. Routine maintenance

| Cadence | Action |
|---|---|
| Daily | `journalctl --since=yesterday -p err -u 'uni-db-*'` — scan for errors |
| Weekly | `apt list --upgradable` — kernel/package upgrades land via unattended-upgrades but kernel upgrades need a reboot |
| Monthly | Resize check — if CX22 averages > 70% CPU or > 70% memory across the month, resize to CX32 |
| Quarterly | Rotate secrets in `/etc/uni_db/env` and the secrets vault |

## 11. If the VPS dies

The Hetzner Console shows it as down. Either:

1. **Restore in place** — Cloud Console → Reboot. Most issues resolve
   here.
2. **Recreate** — Cloud Console → Delete the broken instance, then
   redo §3–§8 against a fresh CX22. Total recovery time on a familiar
   hand: 10–15 minutes.

There's no data to migrate. `extraction_queue` / `translation_queue` /
`ocr_queue` rows in Supabase will start being picked up again as soon
as the new VPS's workers connect.

## 12. What's intentionally NOT on this VPS

| Component | Where it lives instead | Why |
|---|---|---|
| Edge Functions (`get-pdf-url`, `notify-tracked-changes`) | Supabase Edge runtime | Closer to users, edge-cached |
| Korean PDF blobs | Supabase Storage `guideline-blobs` bucket | ADR-009 |
| `review_queue` / decision history | Supabase Postgres | Single source of truth |
| Flutter web/mobile builds | Hanguk's existing CI/CD | Not the VPS's job |
| Anthropic / Papago client libraries' caches | Per-process in /tmp | We don't pin these to disk on purpose |

Keeping the VPS narrow is the whole point — it does the four
long-running poll loops and nothing else.

## 13. Decommissioning checklist

When (if) we move off Hetzner:

- [ ] Drain queues: stop the workers (`systemctl stop uni-db-*`); wait
      for queue depth to hit zero or move workers to the new host first
- [ ] Delete `/etc/uni_db/env` (the secrets file) before destroying
      the VM, OR rely on Hetzner's disk wipe — the VM destroy issues
      one. Either way, rotate the secrets in the vault afterwards.
- [ ] Remove the SSH key from Hetzner project Security
- [ ] Delete the project if no other Hanguk infrastructure uses it
- [ ] Archive the last 30 days of `journalctl` output to S3-compat
      storage if you'll need it for incident review

That's the whole runbook. About 90 minutes end-to-end the first time;
faster on a re-provision because most of these steps will be in
`infra/bootstrap.sh`.
