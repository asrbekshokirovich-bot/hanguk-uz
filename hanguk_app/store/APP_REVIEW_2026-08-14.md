# App Review rejection — 2026-08-14

Submission `3c58bd49-edd3-4679-9173-308569b3bc9a`, **version 1.0 (2042)**,
reviewed on iPad Air 11-inch (M3), iPadOS 26.6. Fifth message on this
submission.

Guideline cited: **2.1(a) — Performance, App Completeness.**

> The app exhibited one or more bugs that would negatively impact users.
> Bug description: Specifically, we are unable to log in and an error message
> is displayed.

Unlike 2026-08-05 and 2026-08-12, this one **is** a code defect, and it is
diagnosed rather than guessed. What follows is what the server recorded while
the reviewer was in the app.

---

## 1. What actually happened

The reviewer entered the demo Magic Code twice, and it was the right code.
From `edge_logs` and `function_logs` on the project (`lysjdtyanhdfphqyijsr`):

| UTC | Event |
| --- | --- |
| 19:46:10 | `GET /rest/v1/profiles?...&magic_code=eq.QR6ZUBDZ` → **522** |
| 19:47:40 | `student-login-v2` logs `CODE_LOOKUP_FAILED`, answers **500** |
| 19:47:45 | second attempt, same lookup → **522** |
| 19:49:16 | `student-login-v2` logs `CODE_LOOKUP_FAILED`, answers **500** |

`QR6ZUBDZ` is the row `DEMO — Google Play Reviewer (do not delete)`. It
exists, it carries no staff role, and its auth user is present — verified
against the database. Nothing was wrong with the credentials in App Store
Connect.

**522 is Cloudflare for "the origin did not answer".** PostgREST sits behind
Cloudflare, so the failure arrived at the Edge Function as a 20 KB HTML error
page in `error.message`. `student-login-v2` treated any `error` from the
profile lookup as `CODE_LOOKUP_FAILED` and returned 500; the Dart client maps
that code to *"Server error while verifying your code. Please contact your
counsellor."* The reviewer saw a hard failure with no way forward, and
rejected under 2.1(a). Correctly — that is exactly what a user would have
seen.

The outage was not caused by the app. It ran roughly **18:30–20:00 UTC** and
took everything down with it, at request volumes of 4–10 per five minutes:

```
18:00  12 × 522      19:00  27 × 522, 34 × 5xx      20:00  clean
```

`v_institutions_for_map` (the university map), `app_versions`,
`staff_presence` and `auth/v1/token` were all timing out in the same window,
and the auth log carries a matching `request_timeout` / 504 on `/token`. The
review landed inside a ~90-minute window in which the project was
intermittently unreachable.

### Why the origin could not answer

Not the nightly crawl. That was the first guess — the window is 23:00–01:00
Asia/Tashkent and the guideline crawl runs at 00:00 / 02:00 — and the database
says otherwise. Checkpoints through the whole window wrote **5 buffers (0.0%)**;
there was no write load at all.

`postgres_logs` names the failure instead. From 18:35 to 20:08, a steady
stream of:

```
ERROR: canceling statement due to statement timeout
  query: BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE
  query: SET client_encoding = 'UTF8'
  query: ABORT
  user:  authenticator (PostgREST 14.4)
```

`BEGIN` and `SET client_encoding` are microsecond statements. Hitting a
**120-second** `statement_timeout` means those backends were not getting CPU
at all. No OOM, no shutdown, no restart, no "too many connections" — the
database was alive and starved.

**What was starving it: pg_cron job 1, `uni-db-notify-tracked-changes`,
scheduled `* * * * *`.**

```
2026-08-14 18:34:00  failed   10.0 s  job startup timeout   <- 522s start here
2026-08-14 18:38:00  failed   99.0 s  job startup timeout
2026-08-14 18:59:31  failed  472.1 s  job startup timeout
2026-08-14 19:23:53  failed  564.5 s  job startup timeout
2026-08-14 19:40:03  failed  544.5 s  job startup timeout   <- review at 19:47
2026-08-14 20:07:12  failed   13.6 s  job startup timeout
```

`job startup timeout` is pg_cron failing to launch a background worker. This
instance is Nano: `shared_buffers` 224 MB, `max_connections` 60, and
**`max_worker_processes` 6** — shared between pg_cron, pg_net, and parallel
workers. The job fires every minute regardless of whether the last one
finished, so once slots are contended the attempts stack, each burning
10–560 seconds, and everything else queues behind them.

It is not a one-off. Failures per day for job 1:

| Aug 11 | Aug 12 | Aug 13 | **Aug 14** | Aug 15 | Aug 16 | Aug 17 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 122 | 561 | **266** | 454 | 0 | 0 |

Four consecutive bad days, and review landed in the middle of them. 2 105
failed runs since 2026-06-20.

### The job was doing nothing

Every reply in `net._http_response` is the same:

```json
{"ok":true,"skipped":"push_disabled"}
```

And `change_event_outbox` — the queue this job exists to drain — holds 299
rows, oldest **2026-05-23**, every one `pending`, **0 with `sent_at`, 0
attempts, 0 errors**. The consumer has never claimed a row. Push is off, the
edge function returns immediately, and the schedule has been paying
worker-slot rent for three months for nothing. Eleven events were queued in
the last 24 hours; the per-minute cadence is not carrying any load either.

Two tables are unpruned on the back of it: `cron.job_run_details` at 116 906
rows / 21 MB (nothing has ever cleaned it — job 1 alone adds 1 440 rows a
day), and `net._http_response` at 41 MB for 361 live rows.

`hanguk_app/supabase/migrations/20260920000000_cron_notify_backoff_and_run_details_gc.sql`
backs the schedule off to `*/5` and adds the missing retention job. That
lowers the pressure; it does not remove it. **The structural fix is moving off
Nano** — a production app serving students, plus an AI extraction pipeline,
on 0.5 GB and six worker slots, will keep finding this edge.

---

## 2. The code defect, and the fix

The outage is infrastructure. Turning a 90-second blip into a permanent dead
end was the app's own doing, in three places — all fixed on this branch.

**a. No retry.** One failed lookup ended the sign-in. Every Supabase call on
the login path now goes through `withRetry` in
`supabase/functions/student-login-v2/index.ts`: three attempts, 300 ms then
900 ms, and only for the transient class. Non-transient errors are returned
untouched on the first attempt, so a wrong code still fails immediately.

**b. Infrastructure was reported as a verdict on the code.** A 522 was
`CODE_LOOKUP_FAILED` / 500, and the student was told to contact their
counsellor about a code that was correct. There is now a `SERVICE_UNAVAILABLE`
code returning **503**, and both it and the legacy `CODE_LOOKUP_FAILED` map to
*"We could not reach the server. Please check your connection and tap sign in
again."*

**c. The fallback could spend a real credential on a network blip.** When the
one-time-token mint failed for any reason — including "GoTrue was unreachable
for one second" — the function fell through to the legacy path, which
authenticates by **rewriting** the student's stored password (Bug F, see the
comment in the function). `mintSessionWithoutPassword` now retries the
transient class and raises `TransientUpstreamError` instead of falling
through. Unreachable and unsupported are no longer the same thing.

Client-side, `hanguk_app/lib/features/auth/data/auth_repository.dart` retries
the whole exchange twice more (400 ms, 1200 ms) on the transient class, so a
blip of this length never reaches the student at all. `isTransientBackendFailure`
is the classifier, covered by `test/features/auth/auth_repository_test.dart`.

Also fixed: the function no longer logs a full Cloudflare error page. Both
failed attempts on 2026-08-14 wrote ~20 KB of HTML into `detail`, which is why
a two-line diagnosis took a log query to find. `summarize()` replaces HTML
bodies with their `<title>` and caps everything else at 300 characters.

### Retry math

Worst case a student now waits ~1.2 s inside the function and ~1.6 s in the
app before seeing an error — under three seconds total, against a failure mode
that previously cost an App Store submission. A wrong code is still rejected on
the first attempt, because `CODE_NOT_FOUND` is not transient.

---

## 3. What to do, in order

### Step 0 — stop the database starving itself

The retries in §2 are a seatbelt. They do not stop the outage, and a long
enough one still fails a review. Apply the migration:

```bash
supabase db push   # or apply 20260920000000_cron_notify_backoff_and_run_details_gc.sql
```

Then reclaim the bloat. `VACUUM FULL` takes an ACCESS EXCLUSIVE lock, so run
it when nobody is signed in — it is seconds on tables this size:

```sql
vacuum (full, analyze) net._http_response;   -- 41 MB holding 361 live rows
vacuum (full, analyze) cron.job_run_details; -- after the first GC run prunes it
```

Confirm it took, a day later:

```sql
select count(*) filter (where status = 'failed') as failed, count(*) as total
  from cron.job_run_details
 where jobid = 1 and start_time > now() - interval '24 hours';
-- expect failed = 0 and total ≈ 288 (was 1 440)
```

**Then decide about compute.** Nano gives this project 0.5 GB, 60 connections
and six worker slots, shared between the student app, the CRM, pg_net,
pg_cron and the extraction pipeline. Every fix above buys headroom inside
that envelope; none of them enlarges it. If the app is going to the App
Store, the instance should be one that does not fall over unattended for
ninety minutes.

If push is not shipping soon, consider unscheduling job 1 outright rather
than running it every five minutes — the outbox has not been drained since
May, so nothing is lost by pausing it, and it is one less thing competing for
a worker slot.

### Step 1 — deploy the Edge Function

```bash
supabase functions deploy student-login-v2 --project-ref lysjdtyanhdfphqyijsr
```

Then confirm the healthy path and the two error paths:

```bash
# correct demo code → 200 with a session
# a nonsense code   → 401 CODE_NOT_FOUND (fast, no retries)
curl -s -X POST \
  "https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/student-login-v2" \
  -H "Content-Type: application/json" -H "apikey: <ANON_KEY>" \
  -d '{"magicCode":"ZZZZZZZZ"}' -w '\n%{http_code}\n'
```

### Step 2 — attach a build that is iPhone-only

**This is the third rejection in a row on build 1.0 (2042).** 2026-08-05,
2026-08-07, 2026-08-12 and now 2026-08-14 all reviewed the same binary.
`pubspec.yaml` has been `1.0.27+2044` since 2026-08-07. Uploading a build and
selecting it on the version are two separate actions in App Store Connect, and
the second one has never been done.

Build with the store flag — without it the app keeps the self-updater path
that Play already blocked once:

```bash
flutter build ipa --release --dart-define=STORE_BUILD=true
/usr/libexec/PlistBuddy -c "Print :UIDeviceFamily" \
  build/ios/iphoneos/Runner.app/Info.plist   # must print [1]
```

Then in App Store Connect, on the version, set **Build** to the newly uploaded
build. If it still says 2042, review will run on 2042 again.

### Step 3 — the 2026-08-12 items, still open

Neither was cited this time, but neither has been re-reviewed on a corrected
build either. See `APP_REVIEW_2026-08-12.md` §2:

- Empty **every** iPad screenshot size, through *View All Sizes in Media
  Manager*, in **every** localisation (`en-US`, `ko`, `uz`).
- Confirm the iPhone set is real captures, no splash / login / marketing
  frames.
- Support URL live (guideline 1.5), description free of tuition and
  scholarship comparison claims (guideline 2.3).

### Step 4 — test the demo code on the build you are submitting

From a clean install of the exact TestFlight build, sign in with `QR6ZUBDZ`
and walk the six feature screens. The demo row must stay seeded — an account
that signs in to empty tabs draws 2.1(a) for a different reason.

---

## 4. Reply to send in App Store Connect

Send this **after** the function is deployed and the new build is attached.

> Hello,
>
> Thank you for the detail — it let us find the cause precisely.
>
> The sign-in code in App Review Information was correct. Our server logs
> show both of your attempts, at 19:47 and 19:49 UTC on August 14, and in
> both the app reached our backend but our database was briefly unreachable
> (a 90-minute infrastructure incident on our hosting provider that evening,
> which also affected our university map and other screens). Our sign-in
> endpoint reported that outage as a credential error, so the app showed you
> a failure message instead of retrying.
>
> We have fixed this. The sign-in path now retries a transient backend
> failure automatically, and a genuine connectivity problem is reported as
> "We could not reach the server — please try again" with the sign-in button
> still available, rather than as an error about the access code. We have
> verified sign-in with the demo code on a clean install of the attached
> build.
>
> We have also attached a new build. The one previously under review, 1.0
> (2042), predated both this fix and our iPhone-only device-family change.
>
> Please let us know if anything else is needed.

---

## 5. Two more rejections waiting, found while fixing this one

Both are fixed on this branch. Neither was cited by Apple yet, because on
2026-08-14 review never got past the sign-in screen.

### 5a. The microphone was compiled out — AI mock interview cannot hear anyone

`permission_handler_apple` 9.4.7 guards every permission strategy behind a
preprocessor macro, and `Classes/PermissionHandlerEnums.h` defaults **all
nineteen of them to 0**. Nothing is compiled in unless the Podfile says so:

```objc
// AudioVideoPermissionStrategy.m
} else if (permission == PermissionGroupMicrophone) {
    #if PERMISSION_MICROPHONE
    mediaType = AVMediaTypeAudio;
    #else
    completionHandler(PermissionStatusDenied);   // <- what shipped
    return;
    #endif
```

**`hanguk_app/ios/Podfile` did not exist in this repository.** It is not
gitignored — check `ios/.gitignore`, it is simply absent — so `flutter build
ipa` generated one from the Flutter template on whichever machine built the
archive, and the macro configuration lived only there.

Without `PERMISSION_MICROPHONE=1`, `Permission.microphone.request()` in
`packages/vapi/lib/src/platform/mobile/vapi_mobile_client.dart` returns
`denied` immediately and **no iOS permission dialog is ever shown**. The
method retries once, gets `denied` again, and returns silently — its
`openAppSettings()` escape only fires on `permanentlyDenied`, which this never
is. The interview then starts with no microphone.

That is a headline feature, one of the six store screenshots, and a
deterministic 2.1(a) failure — harder than the login one, because it does not
need an outage to reproduce.

`ios/Podfile` is now committed, with `PERMISSION_MICROPHONE=1` and the other
eighteen macros stated explicitly at 0. `Permission.microphone` is the only
permission the codebase requests — `grep -rn "Permission\." lib/ packages/`
returns exactly the two calls above — and every handler left off is one fewer
Apple-privacy API linked without a purpose string.

> **Verify on the first build after this lands.** If the build machine already
> had a working Podfile, this replaces it. Confirm the microphone prompt
> appears when starting an interview on a device, and that `pod install` still
> resolves.

### 5b. The compare feature is described but mostly empty

The store description led with tuition and TOPIK comparison. The screen
renders those rows; the data behind them does not exist for most
universities. Measured against production on 2026-08-17:

| | count |
| --- | --- |
| institutions visible on the map | **204** |
| with any approved admission record | 53 |
| with an interview answer | 50 |
| with a TOPIK level | 31 |
| **with tuition** | **4** |

A reviewer picking two universities off the map sees tuition on both in about
one pair in two thousand. Guideline 2.3 turns on exactly this distinction —
accurate about the screen, misleading about the app — and this submission has
already been rejected twice on metadata.

`STORE_METADATA.md` now splits the bullet in all four locales: the fields that
are always present stay in the first line, and tuition, application window,
document deadline, TOPIK, English track and interview move to a second line
scoped to *"universities whose admission guideline we have already
published."* True as written, and it stops being a limitation the moment
`.github/workflows/uni-db-drain-backlog.yml` drains the ~490 failed field
extractions.

Two smaller things went with it:

- **`scholarship` removed from the keyword list** in all four locales. The
  file's own note says scholarship eligibility "is still absent, still not to
  be claimed" — a keyword for a feature that does not exist is guideline
  2.3.7. Replaced with `TOPIK`, which the app does show.
- **Keyword lines brought under Apple's 100-character limit.** English was
  111 and Russian 117; App Store Connect will not accept either. Spaces after
  the commas are dead weight — Apple counts them and documents comma-separated
  without them — so removing them fixed English (96) and Uzbek (84) outright,
  and Russian needed `обучение за рубежом` shortened to `учеба за рубежом`
  (99). Korean is 33.

---

## 6. Repository changes on this branch

- `supabase/functions/student-login-v2/index.ts` — `withRetry`,
  `isTransientFailure`, `summarize`, the `SERVICE_UNAVAILABLE` / 503 code, and
  `TransientUpstreamError` guarding the password-rewrite fallback.
- `hanguk_app/lib/features/auth/data/auth_repository.dart` — client-side
  retry of the transient class, `isTransientBackendFailure`, and the message
  for `SERVICE_UNAVAILABLE` / `CODE_LOOKUP_FAILED` that no longer sends a
  student to their counsellor over a network blip.
- `hanguk_app/test/features/auth/auth_repository_test.dart` — classification
  tests, including the exact 2026-08-14 response shape.
- `hanguk_app/supabase/migrations/20260920000000_cron_notify_backoff_and_run_details_gc.sql`
  — the per-minute notify cron backed off to `*/5`, and the retention job
  `cron.job_run_details` never had.
- `hanguk_app/ios/Podfile` — new. `PERMISSION_MICROPHONE=1` and the other
  eighteen macros at 0, so the microphone strategy is compiled in and the
  configuration is version-controlled rather than local to a build machine
  (§5a).
- `STORE_METADATA.md` — compare bullet split per locale, `scholarship`
  dropped from the keywords, keyword lines brought under 100 characters
  (§5b).
- This file.

No change to the Magic Code screen itself: the failure was never in the UI,
and the sign-in button was already live after an error.
