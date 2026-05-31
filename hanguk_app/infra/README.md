# `infra/` — uni_db worker host provisioning

Source-of-truth files for the always-on Hetzner CX22 host that runs
the uni_db crawler / extractor / OCR / translation workers. The
operator runbook is at
[`docs/runbooks/hetzner-provisioning.md`](../docs/runbooks/hetzner-provisioning.md).

## Layout

```
infra/
├── README.md
├── bootstrap.sh         # idempotent first-boot hardening
├── deploy.sh            # rsync from local checkout + venv install + restart
├── env.example          # /etc/uni_db/env template
└── systemd/
    ├── uni-db-sync.service        # one-shot full cycle: discovery -> fetch+parse -> translate
    ├── uni-db-sync.timer          # fires the cycle hourly (self-throttled by source cadence)
    ├── uni-db-adiga-calendar.service
    ├── uni-db-adiga-calendar.timer
    └── uni-db-ocr.service         # optional EasyOCR tier for image-only PDFs
```

`uni-db-sync` is the scheduler that keeps the database fresh. It runs the
three stages in order via their real entry points
(`scripts/run_discovery_once.py`, `uni-db run-pipeline`,
`scripts/run_translate_once.py`); each is best-effort so one bad PDF can't
stall the cycle. It supersedes the earlier per-stage `discovery-poll` /
`extract` / `translate` units (those pointed at module paths with no
runnable entry point); `deploy.sh` disables them if a prior deploy enabled
them.

## Conventions

- Service account: `uni-db` (system, no shell)
- Repo on host: `/opt/uni_db/`
- venv: `/opt/uni_db/services/uni_db/.venv/`
- Caches: `/var/cache/uni_db/`
- Logs: journald (no app-level logfiles)
- Secrets: `/etc/uni_db/env` (mode 640, group `uni-db`)
- systemd unit naming: `uni-db-*.{service,timer}`

## Why the host has no application state

By design — losing the VM is recoverable in 10 minutes via this
directory plus the runbook. Everything stateful lives in Supabase
Postgres + Storage. See ADR-003.
