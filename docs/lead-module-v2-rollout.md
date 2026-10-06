# Lead module v2 — rollout runbook

For whoever switches it on. Read `docs/lead-module-v2.md` first (what it is), this file is **how to ship it safely**.
Nothing in the repo has been applied to the live project; every step below is yours to run.

## 0. What changes for people the day it goes live
- The three old pages (Yangi lid, Bugungi lidlar, Lidlar) disappear from the sidebar. A new **Lidlar** group appears: **Ish stoli** first (red count), Barcha lidlar, Yo'qotilgan, Hisobot (senior/boss), Baza, Sozlamalar (admin).
- **Operators stop seeing each other's leads** (pool + their own + Baza). The boss and `lead_senior` see all.
- The old 10-minute alert (Mon–Sat 09:40–18:00, only phone leads) is **replaced** by the new one (every day 09:00–22:00, every conversation, repeating every 10 minutes to everyone). Expect many more Telegram messages on day one — that is the point, but tell the team first.
- All ~800 existing leads become **Baza** (`crm_generation='old'`); the desk starts empty.
- Operators need **individual logins** with the `call_operator` role (only one exists today) — ownership and the report work per login.

## 1. Before anything: check production against the repo
`supabase/README.md`: the repo can lag the live database. Run read-only catalog queries first (dashboard SQL editor):

```sql
-- the four functions v2 redefines: compare their bodies with the repo
select proname, prosrc from pg_proc
 where proname in ('fn_after_hours_reply_texts','fn_after_hours_reply_text','fn_queue_after_hours_reply','fn_is_automatic_outgoing');
-- triggers on leads and messages (v2 drops two, adds five)
select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where c.relname in ('leads','messages') and not t.tgisinternal order by 1, 2;
-- the policies on leads (v2 replaces all four)
select policyname, cmd, qual from pg_policies where tablename = 'leads';
-- cron jobs and the vault secret the jobs need
select jobname, schedule from cron.job order by 1;
select name from vault.secrets where name = 'uni_db_service_role_jwt';
-- columns v2 adds must not exist yet (a hand-made one with the same name would clash)
select column_name from information_schema.columns
 where table_name = 'leads' and column_name in ('stage','owner_id','due_at','crm_generation','timer_kind','answered_at');
-- the live app_role enum (is 'lead_senior' free? is 'investor' there?)
select enum_range(null::public.app_role);
```
If a function body differs from the repo, **merge the live change into the migration file first**, then apply.

For every edge function listed as *changed* in `docs/lead-module-v2.md` §5, read the live source (dashboard → Edge Functions, or MCP `get_edge_function`) and diff it with the repo copy **before merging to `main`** — merging deploys it.

## 2. Secrets and settings to prepare
| What | Where | Needed for |
|---|---|---|
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` | Supabase function secrets | `meta-leadgen-webhook` (+ Meta App: leadgen webhook on the Page, `leads_retrieval`) |
| `TV_LEAD_KEY` | function secret; also typed once on the office TV (`#lk=`) | TV warning |
| `CRM_BASE_URL` (optional, default `https://hanguk.uz`) | function secret | links inside Telegram alerts |
| `GEMINI_API_KEY` (exists) | function secret | `lead-brief` |
| `TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID` (exist) | function secrets | dispatch, reports |
| vault secret `uni_db_service_role_jwt` (exists) | Vault | the cron jobs that call edge functions |
| Telegram recipients | each person presses **Start** on the HANGUK bot, then Sozlamalar → *Telegram qabul qiluvchilar* | escalation, boss alerts, reports |
| Logins | create staff accounts; give `call_operator` / `lead_senior` | ownership, report |

## 3. Apply order (one maintenance window, ~30 minutes, ideally outside 09:00–22:00)
The order is **SQL 1–3 → deploy the code → SQL 4 → SQL 5**: the new pages and functions call RPCs that only exist after SQL 3, and the
jobs and the old-lead move should only start once the code that serves them is live.

1. Apply with the MCP `apply_migration` (or the SQL editor), one file at a time, checking the result of each:
   1. `20261005160000_lead_v2_role_lead_senior.sql`
   2. `20261005161000_lead_v2_schema.sql`
   3. `20261005162000_lead_v2_engine.sql`  ← from here the old alert is OFF
2. Merge the branch to `main`: CI deploys the edge functions; your usual hosting deploys the frontend. Check the function logs.
3. `20261005163000_lead_v2_jobs.sql` — starts the cron jobs (needs the vault secret; it warns and skips the HTTP jobs if it is missing).
4. `20261005164000_lead_v2_migrate_old_leads.sql` — moves every existing lead to Baza; idempotent; prints a notice with the counts
   (compare with the 554 active leads and the 379 + 84 lost).
5. Give the new role to the senior operator; add the Telegram recipients in Sozlamalar.

Keep the rollback ready (§5).

## 4. Acceptance — spec §17 (F1)
Run each once, in production, with a test account / test Instagram and Telegram profile:
- [ ] A test Instagram DM → within 5 s a row in **HOZIR** with a timer; after 10 minutes with no answer, a Telegram alert reaches the whole recipient list, and repeats every 10 minutes; answering stops it.
- [ ] A Meta test form → a lead with phone and campaign name (not through DM).
- [ ] "Ko'tarmadi" → 15 minutes later the lead is back in HOZIR; pressed at 21:50 → tomorrow 09:00.
- [ ] "Gaplashildi" cannot be saved without the 5 fields; saved → stage Aloqada or higher.
- [ ] The same phone on IG and Telegram → one card, both channels in one timeline.
- [ ] A lead taken by operator A is invisible to operator B; the senior sees both.
- [ ] The 554 old leads are in Baza, the desk is empty, `crm_generation` is right.
- [ ] The auto-reply goes once per conversation and does not count as an answer.
Also: a message "direktor" in a chat reaches the boss; a discount request reaches the boss; the TV shows the red warning; the 09:30 report arrives next morning.

```sql
-- sanity after step 5
select crm_generation, stage, count(*) from public.leads where merged_into_id is null group by 1, 2 order by 1, 2;
select queue_key, status, count(*) from public.reactivation_queues group by 1, 2 order by 1, 2;
select jobname, schedule, active from cron.job where jobname like 'lead-%' order by 1;
select count(*) as pending_alerts from public.lead_alert_outbox where sent_at is null;
```

## 5. Rollback
`supabase/rollback/lead_v2_rollback.sql` (tested): stops the v2 jobs, drops the v2 triggers, restores the old triggers, the old SLA scan,
the old after-hours functions and the old `leads` policies. It keeps all data and the new columns. Then redeploy the previous
`lead-sla-check` from `main`'s history (it must call `fn_lead_sla_scan` again) and revert the frontend. Leads that arrived while v2 was
live have no `new_lead_at`; the script's header has the query to find the unanswered ones.

## 6. Things to know / watch in the first week
- **Comments become leads** (spec §3.1): once Meta approves comment permissions, every comment starts a 10-minute timer. A viral reel will page the whole team. If it is too noisy, answer from the Izohlar panel (stops the timer) or ask for a filter (e.g. only comments containing a question) — not built.
- **No SMS** (Q61) and **no Messenger** (Q63): both need external approvals. The ladder prepares a DM draft from attempt 2; nothing is sent by itself.
- **Reactivation queues never start by themselves for migrated leads.** A senior presses *Navbatni boshlash* in Yo'qotilgan → Navbatlar; then up to 15 leads a day land in BUGUN (Q66). NO RISK queue is refused until `no_risk_announced` is true in Sozlamalar.
- **AI brief overwrites `ai_summary`** of a card the first time the client writes (the 05.10 analysis is saved in the lead's event log).
- The bot's first reply now asks the direction, not the phone (spec §6.1). Check the Telegram funnel for a week: fewer phones in the first minute is expected, more answered questions too.
- Old pages and `LeadsContext` are still in the code (unmounted). Remove them in a follow-up once the new desk has run a week.
