# Go live: sync all universities and keep it running

Plain, step-by-step instructions to (A) catch up the backlog so **all
universities** appear for staff, and (B) turn on **automatic** syncing so it
stays fresh on its own.

> Background: today the robot only has data for 2 universities because the
> fetch+read stage was run by hand a few times and nothing runs it on a
> schedule. See [`docs/uni_db/pipeline_coverage_audit_2026-05-24.md`](../uni_db/pipeline_coverage_audit_2026-05-24.md).

You need three secrets before starting (from
[`docs/credentials.md`](../credentials.md)):

| Secret | What it's for |
|---|---|
| `SUPABASE_DB_URL` | the production database connection string |
| `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_URL`) | uploading the downloaded PDFs to storage |
| `ANTHROPIC_API_KEY` | the AI that reads the PDFs (this is the paid part) |

Money note: reading PDFs uses the paid AI. A full run of ~12 universities is
a few US dollars, one time. Ongoing hourly runs are cheap because each run
only re-checks universities that are "due".

---

## Part A — one-time catch-up (see all universities today)

This runs the whole pipeline once, from any computer that has the repo and
the three secrets (your laptop is fine). It does **not** need the server.

1. **Get the code and a Python environment.**
   ```bash
   cd services/uni_db
   python3.12 -m venv .venv
   .venv/bin/pip install -e ".[heavy]"
   ```

2. **Add the secrets.** Copy the template and edit it:
   ```bash
   cp .env.example .env
   ```
   In `.env`, set these (leave the rest as-is):
   ```
   UNI_DB_LIVE_APIS=true
   UNI_DB_LIVE_CRAWL=true
   SUPABASE_DB_URL=postgresql://postgres:...        # from docs/credentials.md
   SUPABASE_URL=https://lysjdtyanhdfphqyijsr.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...                     # from docs/credentials.md
   ANTHROPIC_API_KEY=...                             # from docs/credentials.md
   ```

3. **Run the three stages** (each line prints a summary when it finishes):
   ```bash
   # 1) visit each university site and list the posts (re-labels them too)
   .venv/bin/python scripts/run_discovery_once.py --since 30

   # 2) download the admission guide PDFs and read them  <-- the paid AI step
   .venv/bin/uni-db run-pipeline --limit 100

   # 3) translate the results for the review screen
   .venv/bin/python scripts/run_translate_once.py --limit 200
   ```

4. **Check it worked.** Either open the staff review site, or run:
   ```bash
   .venv/bin/uni-db review-digest
   ```
   You should now see items for many universities, not just Inha + KAIST.

If a university still shows nothing, it usually means its guideline PDF
genuinely isn't published yet, or its page needs a small adapter tweak —
note which ones and we can look.

---

## Part B (recommended) — turn on automatic syncing with GitHub Actions

No server to manage. A scheduled workflow (`.github/workflows/uni-db-sync.yml`)
runs the same three stages every 6 hours on GitHub's runners. **All you do is
paste 4 secrets into the repo once.**

1. **Add the secrets.** In GitHub → your repo → **Settings → Secrets and
   variables → Actions → New repository secret**, add (values from
   [`docs/credentials.md`](../credentials.md)):

   | Secret name | Value |
   |---|---|
   | `UNI_DB_SUPABASE_DB_URL` | the production database URL |
   | `UNI_DB_SUPABASE_URL` | `https://lysjdtyanhdfphqyijsr.supabase.co` |
   | `UNI_DB_SUPABASE_SERVICE_ROLE_KEY` | the service-role key (for PDF storage) |
   | `UNI_DB_ANTHROPIC_API_KEY` | the AI key (the paid part) |
   | `UNI_DB_DEEPL_API_KEY` *(optional)* | for the translate stage |

2. **Merge this branch to `main`.** GitHub only runs *scheduled* workflows
   from the default branch, so the timer starts after the PR is merged. (The
   live flags `UNI_DB_LIVE_CRAWL` / `UNI_DB_LIVE_APIS` are already set to
   `true` inside the workflow — no env file to edit.)

3. **Do the one-time catch-up with one click.** GitHub → **Actions** tab →
   **uni-db sync** → **Run workflow** → set `fetch_limit` to `100` → Run.
   This processes the backlog so all universities appear. (This replaces
   Part A — you don't need a laptop run once the workflow is on `main`.)

4. **Confirm.** The **Actions** tab shows each run (scheduled + manual) with
   green/red status and full logs. After that it runs itself every 6 hours.

Notes: GitHub may start a scheduled run 10–30 min late under load (fine for
admissions). It also pauses scheduled workflows after **60 days of zero repo
activity** — this repo is active, so not a concern in practice.

### Alternative — Hetzner server (`infra/`)

If you'd rather run a dedicated always-on box (ADR-003), the systemd units +
deploy script are in [`infra/`](../../infra/); follow
[`hetzner-provisioning.md`](./hetzner-provisioning.md) to create the CX22,
put the secrets in `/etc/uni_db/env` (set `UNI_DB_LIVE_CRAWL=true`), then run
`infra/deploy.sh <server-ip>` (it enables the hourly `uni-db-sync.timer` and
runs one cycle immediately). Verify with
`ssh root@<ip> 'systemctl list-timers uni-db-*'`. This is more setup than
GitHub Actions; most teams won't need it.

That's it — once Part B is done, the staff queue stays current on its own.

---

## Handy checks (read-only)

Count what's in the database right now (run in the Supabase SQL editor):
```sql
select count(*) filter (where guideline_document_id is not null) as fetched,
       count(*) as discovered
from public.announcements;

select i.name_en, count(g.id) as guides
from public.institutions i
left join public.guideline_documents g on g.institution_id = i.id
group by 1 order by guides desc;
```

## If something looks wrong

- **`run-pipeline` says it's refusing:** `UNI_DB_LIVE_CRAWL` and
  `UNI_DB_LIVE_APIS` must both be `true`, and `SUPABASE_DB_URL` must be set.
- **A stage failed but others ran:** that's by design (best-effort). Check
  the logs for the reason — the **Actions** tab (GitHub Actions) or
  `journalctl -u uni-db-sync` (Hetzner) — and re-run.
- **Costs higher than expected:** lower `--limit` on `run-pipeline`, or check
  for a university re-fetching the same PDF (dedup is by file hash, so this
  is rare).
