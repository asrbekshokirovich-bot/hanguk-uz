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

### Why the window is suspicious rather than random

18:00–20:00 UTC is 23:00–01:00 Asia/Tashkent, and the nightly guideline crawl
is scheduled at **00:00 / 02:00 Asia/Tashkent** — owned by a Claude Routine,
not by `.github/workflows/uni-db-auto-crawl.yml` (that file is
`workflow_dispatch`-only precisely so the two do not double-run). That
pipeline connects over `UNI_DB_SUPABASE_DB_URL`, i.e. **direct Postgres, not
PostgREST**, so its load never appears in `edge_logs` — which matches what the
logs show: almost no HTTP traffic, and an origin that could not answer any of
it.

This is correlation, not proof; the crawl's own run log is the place to
confirm it. Either way the sequence to check is the same, and it is listed in
§3.

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

### Step 0 — confirm the outage is understood, not just survived

Read the 2026-08-14 run log of the nightly crawl Routine. If it was running
18:00–20:00 UTC, the fix is to throttle its connection use or move it off the
hours when review is likely to run; the retries above are a seatbelt, not a
substitute. If it was **not** running, the origin failed on its own and the
project's compute size is the thing to look at.

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

## 5. Repository changes on this branch

- `supabase/functions/student-login-v2/index.ts` — `withRetry`,
  `isTransientFailure`, `summarize`, the `SERVICE_UNAVAILABLE` / 503 code, and
  `TransientUpstreamError` guarding the password-rewrite fallback.
- `hanguk_app/lib/features/auth/data/auth_repository.dart` — client-side
  retry of the transient class, `isTransientBackendFailure`, and the message
  for `SERVICE_UNAVAILABLE` / `CODE_LOOKUP_FAILED` that no longer sends a
  student to their counsellor over a network blip.
- `hanguk_app/test/features/auth/auth_repository_test.dart` — classification
  tests, including the exact 2026-08-14 response shape.
- This file.

No change to the Magic Code screen itself: the failure was never in the UI,
and the sign-in button was already live after an error.
