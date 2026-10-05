# Lead module v2 — build notes and contract

Source of truth: the spec **"HANGUK Lid bo'limi TT" (v1, 2026-10-05)** — 36 decisions of the boss, nine rounds.
This file says **how the spec was built**: the database contract, what each piece owns, what was decided where the
spec was silent, and what still needs a human. Section numbers (§) refer to the spec.

> **Nothing here has been applied to the live Supabase project.** The migrations are files; see "Applying it" below.

## 1. Applying it (order matters)

`supabase/README.md` explains why: the live migration ledger and this folder share no versions, and `db push` is off
limits. Apply each file's SQL with the MCP `apply_migration` (or the dashboard SQL editor), in this order, and check the
catalog afterwards.

| # | File | What it does | Risk |
|---|------|--------------|------|
| 1 | `20261005160000_lead_v2_role_lead_senior.sql` | adds the `lead_senior` role | none |
| 2 | `20261005161000_lead_v2_schema.sql` | columns, tables, settings seed, **new RLS on `leads`** | operators stop seeing other operators' leads |
| 3 | `20261005162000_lead_v2_engine.sql` | triggers, RPCs, scan; **drops the old alert trigger**, retires `fn_lead_sla_scan`, redefines 4 after-hours functions | old "Yangi lid" alert stops; compare the 4 functions with live first |
| 4 | `20261005163000_lead_v2_jobs.sql` | SQL jobs + cron schedules (needs vault secret `uni_db_service_role_jwt`) | starts jobs that message the team |
| 5 | `20261005164000_lead_v2_migrate_old_leads.sql` | marks existing leads `crm_generation='old'`, maps stages / lost reasons, fills queues (all waiting) | data change, idempotent |

Do 1–3 together with deploying the new edge functions and the new frontend, **not** separately: once 3 is applied the
old CRM pages no longer alert, and until the new desk ships nobody sees the 10-minute timer.

Before step 3, diff the four redefined functions against production (`fn_after_hours_reply_texts`,
`fn_after_hours_reply_text`, `fn_queue_after_hours_reply`, `fn_is_automatic_outgoing`). The repo copy can lag the live one.

Tests: `npm run test:sql` runs all five files on an in-memory Postgres (PGlite) against a stand-in for the production
schema (`supabase/tests/lead_v2/pre_v2_stub.sql`). It proves the logic, **not** that the stand-in matches production.

## 2. The model in one page

**A lead is every conversation** (§1.2): a first message, a form, a comment, a call, an app signup — on any channel.
`leads` keeps its old columns; v2 adds the ones below. Old screens that still write `status` keep working: a trigger keeps
`stage` and `status` in step.

### Stages (§4.1) — `leads.stage`
`new → contacted (Aloqada) → interested (Qiziqdi) → offer (Taklif) → contract (Shartnoma) → student (Talaba)`, plus
`waiting` (Kutish) and `lost` (Yo'qotildi). The furthest stage wins on merge; a stage is never lowered by a call.

### The 10-minute rule (§4) — `timer_kind`, `timer_start_at`, `due_at`
One clock per lead. `due_at` is the breach time; the row shows in HOZIR when `timer_start_at <= now()`.

| `timer_kind` | starts | visible in HOZIR from | `due_at` |
|---|---|---|---|
| `first` | first message / form / comment / call | at once (off hours: from 09:00) | +10 min (off hours: 09:10) |
| `reply` | the client writes to an answered lead | **only when the 10 minutes are gone** (quiet in BUGUN until then) | message + 10 min |
| `ladder` | after a missed call (§9) | 10 min **before** it is due | the planned call time |
| `callback` | the client named a time ("Band / keyin"), or the operator set one after a talk | 10 min before | that time |

Working hours (§1.3): 09:00–22:00 **every day**, Tashkent. Outside them a new lead waits for 09:00 and gets `due_at = 09:10`
(`fn_lead_due_at` carries any overflow past 22:00 into the next morning: 21:55 → 09:05). Hours, ladder steps and the window
are in `lead_settings`; the helper functions read them.

### What stops the clock — "answered" (§1.4)
- a finished call (`lead_record_call(..., 'talked')`), or
- a missed call **followed by a chat message** (answer_kind `call_attempt+chat`), or
- for a lead **without a phone**: a human chat message (bot / auto-reply / Meta `[template]` echo do not count), or
- for a comment: a public reply (`lead_comment_answer`), or
- a missed call with **no chat channel at all** (answer_kind `call_attempt` — the spec is silent; nothing else is possible).

A lead *with* a phone is not answered by chat alone ("operators call first"). `lead_settings.chat_answers_phone_leads`
flips that. Messages older than 30 minutes (backfill) never start a timer.

### The ladder (§9)
Attempt 1 = the first call. Each miss → +15 min → +2 h → tomorrow 10:00 → +2 days 10:00; shifted into working hours
(21:50 + 15 min → tomorrow 09:00). The 5th miss closes the lead as `no_contact` and queues it (+14 d DM, +45 d call).
From attempt 2 a "we called" draft is prepared. A client message ends the ladder (`ladder_state='stopped'`) and starts a
`reply` timer. An operator cannot edit the ladder times.

### Escalation (§4, §6.3/9.1)
`fn_lead_timer_scan()` (cron, every 30 s, working hours only) writes to `lead_alert_outbox` for every lead past `due_at`:
audience `everyone`, repeating every 10 min until answered. Boss-only alerts use the same outbox: `promise` (discount
asked), `keyword` ("direktor", "qaytar", … from `lead_settings.boss_alert_words`), `contract` (became a student),
`student` (a student's phone wrote in). **SQL only enqueues; the edge function `lead-alert-dispatch` delivers.**

### One person, one card (§5, §3.4)
`fn_lead_try_merge` merges by the last 9 digits of the phone and by @username (Instagram/Telegram); the older card
survives, empty fields are filled, full ones are not overwritten, the earliest deadline stands, related rows move over.
The dropped card stays as a hidden tombstone (`merged_into_id`). Same name only → a row in `lead_merge_suggestions`.
A phone that belongs to a student sets `matched_student_id`: no timer, the boss is told. When a new contact turns out to
be a known card, `fn_lead_reengage` gives the survivor the right timer.

### Visibility (§2.4, §13) — RLS on `leads`
`call_operator`: the pool (`owner_id is null`) + own leads + Baza (old) + **any lead past its deadline**.
`lead_senior`, `owner`, `admin`: everything. `document_handler`: only students. The first operator who calls or replies
owns a lead (`owner_id`); `lead_claim` takes a pool or breached lead; `lead_reassign` / `lead_pin` are senior+.

### Old leads → Baza (§16)
`crm_generation = 'old'` for everything that existed. Stages from `status`; lost reasons from the `Rad etildi:` line;
queues filled **but waiting** (`due_at null`) until a senior presses "Navbatni boshlash". Old cards never reach the desk
unless the person writes again (then they show in HOZIR and stay `old`).

## 3. RPC contract (what the browser may call)

All are `security definer`, check the role inside, and are granted to `authenticated`. Errors are short codes in the
message (`missing_fields:goal,decider`, `next_action_required`, `not_allowed`, …) — `explainError()` in
`src/components/crm/lead-desk/copy.ts` turns them into Uzbek.

| RPC | Who | Notes |
|---|---|---|
| `lead_desk()` | staff | rows with `bucket` = hozir / bugun / keyin; runs under RLS |
| `lead_desk_counts()` | staff | `{hozir, breached, barcha, yoqotilgan, baza, comments}` |
| `lead_timeline_v2(lead, limit)` | staff | messages (all channels) + calls + events + comments, newest first |
| `lead_record_call(lead, result, payload)` | staff | the popup (§7). `talked` needs the 5 fields + objection + competitor + a next action (or a stage `waiting`/`lost`) |
| `lead_save_fields(lead, fields)` | staff | whitelisted card fields |
| `lead_set_stage(lead, stage, payload)` | staff | `contacted / interested / offer / contract`; `offer` needs `product_fit` |
| `lead_wait(lead, date, reason)` | staff | Kutish: future date + reason; only after a talk |
| `lead_lose(lead, reason, competitor?, note?)` | staff | reason from `lead_settings.lost_reasons`; fills queues |
| `lead_reopen / lead_claim` | staff | |
| `lead_reassign / lead_pin(lead, bool)` | senior+ | |
| `lead_request_promise` / `lead_decide_promise` | staff / **boss only** | discount or special terms (§11) |
| `lead_start_queue(key)` | senior+ | `no_risk` refused until `no_risk_announced` |
| `lead_merge_confirm / lead_merge_dismiss(suggestion)` | staff | |
| `lead_create_manual(name, phone, origin, ref_type, ref_name, fields)` | staff | "+ Lid" |
| `lead_comment_answer(comment, reply)` | staff | records a public reply, stops the timer |
| `lead_report(from, to)` | senior+ | results only (§14) |
| `lead_reengage(lead, at)` | service role | for webhooks |

Direct table access is allowed where RLS says so: `lead_contacts` (rw), `lead_drafts` (read + mark sent/skipped),
`social_comments` (read), `lead_settings` (read all staff; write boss, templates also senior), `lead_alert_recipients`
(boss), `reactivation_queues`, `lead_promises`, `lead_events`, `call_attempts` (read).

## 4. Settings (`lead_settings`, §3.7)
`work_hours`, `timer_minutes`, `escalation_repeat_minutes`, `ladder`, `auto_reply{uz,ru}`, `forbidden_words`,
`boss_alert_words`, `queue_daily_limit` (15, Q66), `chat_answers_phone_leads`, `control_line_10min` (Q64), `tv_warning`,
`hanbox_group_date`, `hanbox_announced`, `no_risk_announced`, `lost_reasons`, `objections`, `competitors`, `offers`
(allowed-offer card, §11; prices for kasbiy/GKS are still "Narx — rahbardan", Q65), `templates` (uz/ru).
Telegram recipients: `lead_alert_recipients` (`escalate`, `boss_alerts`, `reports_daily`, `reports_weekly`).

## 5. Edge functions

| Function | Status | Job |
|---|---|---|
| `lead-alert-dispatch` | new | every 30 s: claim `lead_alert_outbox` rows (`fn_lead_alert_claim`), send Telegram to the right recipients, `fn_lead_alert_done` |
| `lead-reports` | new | 09:30 daily, Monday weekly: `fn_lead_report` → Telegram (§14) |
| `lead-brief` | new | every 2 min: AI brief for leads with a new client message (§10, §7.1), AI reply draft into `lead_drafts` (kind `ai_reply`) |
| `meta-leadgen-webhook` | new | Meta lead form → lead (phone, campaign, ad, form) (§5) |
| `tv-lead-alerts` | new | feeds the office TV warning (`fn_lead_tv_warnings`) |
| `lead-sla-check` | changed | keeps only the after-hours auto-reply sender; the old SLA scan and watchdogs are gone |
| `telegram-poll` | fixed | position saved before media downloads; bounded downloads (the 30.09 outage) |
| `telegram-webhook` | changed | the bot never opens with "raqam yozing" (§6.1) |
| `instagram-webhook` | changed | comments → `social_comments` + lead (F2) |
| role lists | changed | `lead_senior` added wherever `owner/admin/call_operator` is hard-coded |

Every function that is new or changed is listed in `.github/workflows/supabase-deploy.yml` and `supabase/config.toml`.
**Merging to `main` deploys them.** Before merging, diff each changed function against the live source (README §"Deploying a function").

## 6. Frontend map — `src/components/crm/lead-desk/`
`types.ts` · `api.ts` (all RPC / table access) · `copy.ts` (Uzbek labels, stored-value lists, `explainError`) ·
`time.ts` (Tashkent clock, countdown, urgency) · `forbidden.ts` · `useLeadSettings.ts`.
Pages (lazy, mounted in `CRMPortal.tsx`): `pages/LeadDeskContent.tsx` (Ish stoli), `AllLeadsContent.tsx`,
`LostLeadsContent.tsx`, `LeadReportContent.tsx`, `LeadBazaContent.tsx`, `LeadSettingsContent.tsx`.
Routes: `/crm/desk` (default, first item), `/crm/leads` (Barcha lidlar), `/crm/leads/lost`, `/crm/leads/report`,
`/crm/leads/baza`, `/crm/leads/settings`. The old `/crm/new-leads`, `/crm/today-leads` redirect to the desk.
Copy is Uzbek-only on purpose (desktop-only module, Uzbek spec); the i18n bundles are not touched.

## 7. Decisions where the spec was silent
- `stage` is text + CHECK, not an enum; `lead_identities` is a view over `communication_identities`.
- A missed call on a lead with no chat channel counts as the answer (`call_attempt`); otherwise it could never leave HOZIR.
- `reply` timers are quiet in BUGUN for their first 10 minutes (spec §3.1 puts them there), HOZIR after.
- A talked call must set a next action (date, or "kuzatuv" = the 1/3/7 follow-up drafts), or go to Kutish / Yo'qotildi.
- Reactivation queues never start by themselves for migrated leads; time-based queues of *new* losses flow by their date.
  Hanbox and NO RISK queues need a senior to press "Navbatni boshlash" (Hanbox = next group announced; NO RISK = condition on the card).
- Telegram alerts link to the CRM card; one-tap approve/reject from Telegram (§11) is not built — the boss opens the card.
- Open boss questions use these defaults until answered: Q59 senior = whoever is given `lead_senior`; Q60 auto-reply text as in
  the spec, Sunday is a normal working day; Q61 SMS **not built** (DM drafts only); Q62 bot stays a source; Q64 control line on;
  Q66 limit 15; Q67 the 38 old callback dates stay on the old cards (not on the desk).

## 8. Not built (needs something outside the code)
- **F3 telephony** (GoIP + FreePBX, click-to-call, auto call log): needs the PBX. `call_attempts.pbx_call_id/duration_seconds` are ready.
- **SMS** (Q61): needs a provider and credentials.
- **Meta comments / Messenger permissions** (Q63): `instagram_manage_comments` and `pages_manage_engagement` need Meta App Review;
  the code for them is in, it does nothing until Meta approves.
- **Meta leadgen**: needs the Page subscription, `leads_retrieval`, and `META_PAGE_ACCESS_TOKEN` / `META_APP_SECRET` / `META_VERIFY_TOKEN`.
- **Individual operator logins** (§13): create the accounts and give them `call_operator` / `lead_senior`.
- **Telegram recipients**: each person presses Start on the bot, then an admin adds their chat id in Sozlamalar.
