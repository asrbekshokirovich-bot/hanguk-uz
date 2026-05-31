# Push notification rollout — Phase 3

> Audience: the engineer rolling out push notifications when Phase 3
> is implemented.
>
> Pair with [`PHASE_3_DESIGN.md` §4](../../services/uni_db/PHASE_3_DESIGN.md#4-notify-tracked-changes-edge-function--push-delivery)
> for the system shape and
> [`docs/credentials.md` §8](../credentials.md) for the per-platform
> credentials.
>
> The pipeline is **outbox + cron Edge Function**, not Supabase
> Realtime — see PHASE_3_DESIGN.md §4.3 for why. The outbox is the
> source of truth; if delivery fails we retry from there.

## 1. What ships in this rollout

- A `change_event_outbox` table that the existing review-decision
  flow writes to via trigger
- A cron-triggered Supabase Edge Function `notify-tracked-changes`
  that drains the outbox every minute
- Three platform clients: FCM (Android), APNs (iOS), VAPID web push
- A `user_push_tokens` table populated by the Flutter app at first
  launch / on token refresh
- An app-side `Settings → Notifications` panel that lets the user
  unsubscribe per category

The feature is gated behind `UNI_DB_PUSH_ENABLED=true` on the Edge
Function. Default off until rollout day.

## 2. Pre-rollout — credential gathering

Per `docs/credentials.md` §8:

| Platform | Credential | Notes |
|---|---|---|
| FCM (Android) | `firebase-adminsdk-*.json` service account JSON | Generate from Firebase Console → Project Settings → Service Accounts. Treat as secret-tier; goes in Edge Function secrets, not the Flutter client. |
| APNs (iOS) | `.p8` auth key + Key ID + Team ID | Apple Developer → Keys → "Create" with Apple Push Notifications service enabled. The `.p8` file is one-time download — re-create if lost. |
| Web push | VAPID keypair | Generate locally via `npx web-push generate-vapid-keys`. Public key ships to the client; private key stays in Edge Function secrets. |

Set the secrets on Supabase:

```bash
supabase secrets set \
  FCM_SERVICE_ACCOUNT_JSON="$(cat firebase-adminsdk.json)" \
  APNS_KEY_P8="$(cat AuthKey_XXXX.p8)" \
  APNS_KEY_ID=XXXX \
  APNS_TEAM_ID=YYYY \
  WEB_PUSH_VAPID_PRIVATE=... \
  WEB_PUSH_VAPID_PUBLIC=... \
  --project-ref nhjzbjzhmugcmzchzxlv     # staging first, prod after
```

## 3. Migrations

Two migrations, in order:

### 3.1 — `20260703000000_uni_db_v3_change_event_outbox.sql`

(See PHASE_3_DESIGN.md §4.4 for full sketch.)

```sql
-- change_event_outbox: durable per-event row, populated by trigger
create table public.change_event_outbox (
  id              uuid primary key default gen_random_uuid(),
  target_table    text not null,
  target_id       uuid not null,
  event_type      text not null,           -- enum (see §3.2)
  payload         jsonb not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'sending', 'sent', 'failed', 'dead')),
  attempts        int  not null default 0,
  queued_at       timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  sent_at         timestamptz,
  last_error      text
);

-- user_push_tokens: per-device registration table
create table public.user_push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  platform        text not null check (platform in ('android', 'ios', 'web')),
  token           text not null,
  app_version     text,
  device_label    text,                    -- "iPhone 14, en-US, iOS 18.1"
  enabled         boolean not null default true,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (platform, token)
);

create index idx_outbox_pending on public.change_event_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');
create index idx_user_push_tokens_user on public.user_push_tokens (user_id) where enabled;

-- Trigger: when a review_decision row lands as 'accepted' on a
-- recruitment-data row, enqueue the outbox event
create or replace function fn_emit_change_event() returns trigger as $$ ... $$ language plpgsql;
create trigger trg_emit_change_event after insert on public.review_decisions
  for each row when (new.action = 'accepted')
  execute function fn_emit_change_event();
```

RLS:

- `change_event_outbox` — service-role writes only; reviewer role can
  SELECT for debugging
- `user_push_tokens` — user can SELECT/INSERT/UPDATE/DELETE their own
  rows; service role can SELECT all for fan-out

### 3.2 — `20260704000000_uni_db_v3_notification_event_enum.sql`

The Hanguk app's existing `notification_event` enum (on prod) gets
extended with the four uni_db event types:

```sql
alter type public.notification_event add value if not exists 'recruitment_changed';
alter type public.notification_event add value if not exists 'correction_notice';
alter type public.notification_event add value if not exists 'deadline_within_7d';
alter type public.notification_event add value if not exists 'deadline_within_24h';
```

This migration is **gated on the real prod schema baseline being in
place** (per `MIGRATION_BASELINE_TODO.md`) because the enum lives on
prod and the staging shim doesn't have it. Don't apply 3.2 against
staging unless the baseline has been refreshed first.

## 4. Edge Function

`supabase/functions/notify-tracked-changes/index.ts` (Deno).

Cron trigger: every minute, set via `supabase functions deploy
notify-tracked-changes --schedule '* * * * *'`.

Rough shape:

```typescript
serve(async () => {
  const events = await sb.from('change_event_outbox')
    .update({ status: 'sending', attempts: sql`attempts + 1` })
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .select()
    .limit(100);                              // bounded fan-out per tick

  for (const event of events) {
    const recipients = await fetchSubscribedUsers(event);
    const results = await Promise.allSettled(
      recipients.map((r) => dispatchToPlatform(r, event))
    );
    const ok = results.every((x) => x.status === 'fulfilled');
    await sb.from('change_event_outbox')
      .update(ok
        ? { status: 'sent', sent_at: new Date().toISOString() }
        : nextRetryFor(event))
      .eq('id', event.id);
  }
});

function nextRetryFor(event) {
  const backoff = Math.min(60, 2 ** event.attempts);     // 2,4,8,16,32,60 minutes
  if (event.attempts >= 8) return { status: 'dead' };
  return {
    status: 'failed',
    next_attempt_at: new Date(Date.now() + backoff * 60_000).toISOString(),
  };
}
```

`dispatchToPlatform` switches on `recipient.platform` to FCM / APNs /
web-push. Each provider call has its own timeout + retry semantics
inside the function — but the outer outbox status is the durable
fallback.

## 5. Token registration flow

```
App boot (or push-permission grant)
  ↓
Flutter requests platform token
  - Android: FirebaseMessaging.getToken()
  - iOS: APNs token via firebase_messaging
  - Web: navigator.serviceWorker.pushManager.subscribe()
  ↓
POST /functions/v1/register-push-token { platform, token, device_label }
  ↓
Edge function upserts public.user_push_tokens
  - On (platform, token) conflict → set last_seen_at, enabled=true
  - Stale tokens (last_seen_at > 90 days ago) get GC'd weekly
```

Re-register on every app boot — keeps `last_seen_at` fresh, handles
platform-issued token rotations.

## 6. Per-platform notes

### 6.1 FCM (Android)

- Use **data messages**, not notification messages. Data messages
  give us full control of the rendered UI; notification messages let
  the OS decide quiet hours and stacking, which is wrong for an
  admission tool.
- Set `priority: 'high'` only for `correction_notice` and
  `deadline_within_24h`. Use `'normal'` for the others to avoid
  triggering FCM rate limits.
- Localized title/body via `title_loc_key` / `body_loc_key` references
  to ARB strings.

### 6.2 APNs (iOS)

- Use the HTTP/2 binary token API via the `apns2` SDK.
- Topic = the iOS app bundle ID (look it up from Apple Developer; do
  NOT hardcode in the function — set it via an Edge Function secret
  `APNS_BUNDLE_ID`).
- `apns-push-type: 'alert'` for visible notifications;
  `'background'` for silent updates is out of scope for Phase 3.
- Rich payloads: include `category` so the app can register custom
  actions (e.g. "Mark as read", "View university").

### 6.3 Web push (VAPID)

- Subscription endpoint and keys live on the client side; we just
  store the JSON encoding in `user_push_tokens.token`.
- Payload size limit ~4 KB. We never get close — payloads are tiny
  ("recruitment_changed at SNU, deadline pushed to Oct 15").
- Browser doesn't support background-only push reliably; treat web
  push as a "notification icon flash plus localized text" and don't
  ship critical state in the payload — re-fetch on tap.

## 7. Quiet hours, frequency caps, dedup

Implemented in `dispatchToPlatform` before each provider call:

| Rule | Trigger | Action |
|---|---|---|
| Quiet hours | Recipient timezone 22:00 – 08:00 | Defer non-`deadline_within_24h` events to 08:01 local |
| Frequency cap | Same `(user_id, target_id)` already pushed in last 30 min | Drop the duplicate (don't re-push) |
| Cohort cap | More than 50 events to the same user in 24h | Hold the rest for 24h, summarise as a digest |
| Test notifications | App launched with `--test-mode` | Route to a separate `change_event_outbox_test` table |

The user-facing `Settings → Notifications` panel exposes:

- Master on/off
- Per-event-type opt-out (e.g. opt out of `recruitment_changed`,
  keep `correction_notice`)
- Quiet-hours custom range (default 22:00-08:00 local)

User preferences are stored in `public.profiles.notification_prefs jsonb`.

## 8. Localisation

Push payloads are localised at build time inside the Edge Function,
not on the device. The function knows each user's locale via
`profiles.locale` and selects the right ARB string via
`firebase-admin`'s `title_loc_key`.

For Phase 3:

- English — primary
- Korean — for any Korean-speaking staff who happen to be on the
  internal cohort (rare but possible)
- Uzbek — only after the ADR-004 reversal trigger fires (native
  reviewer hired)

If a user's locale is missing translation, fall back to English.
`Phase 3 → Phase 4` is when the Vietnamese / Mongolian fallbacks land.

## 9. Staged rollout

| Stage | Audience | UNI_DB_PUSH_ENABLED | Duration |
|---|---|---|---|
| 0 — internal | Engineering devices only (test users) | `true` on staging Edge Function only | 3 days |
| 1 — canary | 5% of contracted students (random sample) | `true` on prod, with `PUSH_CANARY_PCT=5` | 3 days |
| 2 — half | 25% | `PUSH_CANARY_PCT=25` | 4 days |
| 3 — full | 100% | `PUSH_CANARY_PCT=100` | ongoing |

Roll back at any stage by setting `UNI_DB_PUSH_ENABLED=false` on the
prod function. The outbox keeps growing harmlessly while disabled;
turning the function back on drains it.

## 10. Observability

Daily checks during rollout:

```sql
-- Outbox health
select status, count(*) from public.change_event_outbox
group by 1 order by 2 desc;

-- Send rate (last hour)
select event_type, count(*)
from public.change_event_outbox
where sent_at > now() - interval '1 hour'
group by 1;

-- Failure rate by event type
select event_type,
       count(*) filter (where status = 'failed') as failed,
       count(*) filter (where status = 'dead') as dead,
       count(*) filter (where status = 'sent') as sent
from public.change_event_outbox
where queued_at > now() - interval '24 hours'
group by 1;

-- Top users by recent push count (frequency cap sanity)
select u.email, count(*)
from public.change_event_outbox o
join public.user_push_tokens t on /* recipient join */
join auth.users u on u.id = t.user_id
where o.sent_at > now() - interval '24 hours'
group by 1 order by 2 desc limit 20;
```

Edge Function logs (Supabase Studio → Edge Functions → Logs) carry
per-tick traces.

## 11. Rollback

- **Soft rollback:** flip `UNI_DB_PUSH_ENABLED=false`. Outbox keeps
  accruing. Re-enable when ready.
- **Hard rollback:** flip the env, then `update change_event_outbox
  set status='dead' where status in ('pending','failed','sending')` —
  this is destructive of pending events but never of `sent` rows.
  Only run hard rollback if pending events are themselves the bug
  (e.g. trigger emitting wrong payloads).
- **Schema rollback:** drop `change_event_outbox` and
  `user_push_tokens`, then drop the trigger. The migration files are
  forward-only; manual revert SQL lives in the migration's header
  comment.

## 12. What's intentionally NOT in this rollout

- **Email notifications.** Out of scope. The Hanguk app is mobile-
  and web-first; email is for admin notifications only and uses the
  existing transactional-email path.
- **SMS.** Cost too high for the contracted-student cohort to be
  worth it.
- **Telegram / KakaoTalk / WhatsApp.** Defer to Phase 4 if a
  contracted user explicitly asks. The deliverability and rate-limit
  story is too inconsistent to bake in now.
- **Marketing pushes.** ADR-007 makes this an internal tool; there's
  no marketing surface to push to.

## 13. Sign-off checklist before flipping prod

- [ ] Migrations 20260703000000 + 20260704000000 applied to prod
- [ ] Edge Function secrets set on prod project ref
- [ ] `notify-tracked-changes` deployed with cron schedule
- [ ] FCM, APNs, web-push all tested at Stage 0
- [ ] Outbox query (§10) returns sane numbers from staging
- [ ] App-side `Settings → Notifications` panel ships in the same
      release that registers tokens
- [ ] Quiet hours and frequency caps verified on at least one device
      per platform
- [ ] On-call rotation knows where the Edge Function logs and outbox
      query live
- [ ] Hanguk admin briefed on the staged rollout cadence

Once all ticked, flip `UNI_DB_PUSH_ENABLED=true` on prod and let
Stage 1 run.
