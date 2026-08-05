# App Review rejection — 2026-08-05

Submission `3c58bd49-edd3-4679-9173-308569b3bc9a`, version 1.0 (2039),
reviewed on iPad Air 11-inch (M3). Two guidelines were cited. Neither is a
crash or a code defect — one is a build setting plus the screenshot set, the
other is the App Review Information form. This file is the checklist for the
resubmission.

---

## 1. Guideline 2.3.3 — screenshots do not show the app in use

**What Apple said.** The 6.5" iPhone and 13" iPad screenshots mostly do not
show the actual app; splash and login screens do not count as the app in use,
and marketing material that isn't the app's UI is not acceptable.

**Fixed in this branch.**

- `ios/Runner.xcodeproj/project.pbxproj`: `TARGETED_DEVICE_FAMILY` changed
  from `"1,2"` to `"1"` in all three build configurations. The app was being
  submitted as an iPad app — which is why review ran on an iPad Air and why
  App Store Connect demanded a 13" iPad set — even though every store doc in
  this repo assumed iPhone-only and `LSRequiresIPhoneOS` is `true`. It is now
  genuinely iPhone-only, so the iPad screenshot requirement disappears and
  review runs on iPhone.
- `ios/Runner/Info.plist`: dropped the now-dead
  `UISupportedInterfaceOrientations~ipad` block.
- `store/listings/screenshots/README.md`: capture list rewritten against the
  screens that actually exist, plus the hard rules Apple applied here.

**Still to do by hand (App Store Connect).**

1. Rebuild and archive so the new build carries `UIDeviceFamily = [1]`. The
   iPad size slots stop being requested once that build is attached.
2. Capture a fresh 6.9" iPhone set (1320 × 2868) from that build, signed in
   with the demo account, following the order in
   `store/listings/screenshots/README.md`. Nothing from the splash, welcome
   or Magic Code screens.
3. In **Previews and Screenshots → View All Sizes in Media Manager**, open
   *every* size — including 6.5" — and delete any leftover marketing frames.
   This is the step that was missed last round: the 6.9" set can look correct
   while an old set survives on a size the media manager never showed you.

---

## 2. Guideline 2.1(a) — demo account needed

**What Apple said.** They still cannot access all or part of the app and need
credentials that reach every feature for every account type. A demo *video*
is not accepted.

**Nothing to fix in code.** The app has exactly one student entry path —
the Magic Code screen (`lib/features/auth/presentation/login_screen.dart`),
which calls the `student-login-v2` Edge Function. A reviewer with no code
cannot get past it, and last submission left the App Review Information
section without working credentials.

**Can the Google Play demo account be reused for Apple?** Yes. The magic code
is looked up server-side against the student row on every sign-in — it is not
one-time and it does not expire (see `signInWithMagicCode` and
`supabase/functions/student-login-v2`). The same code authenticates
identically on iOS and Android, so one demo student serves both stores.
Before pasting it into App Store Connect, confirm three things:

- The student row is **not** a staff/CRM account — those are rejected with
  `STAFF_BLOCKED` and the reviewer would see a hard failure.
- The account is seeded with real content: at least one application, one
  uploaded document, a study plan, and a season membership. An account that
  logs in to empty tabs reads as "cannot access functionality" and gets the
  same rejection back.
- The code still signs in from a clean install of the exact build you submit.
  Test it yourself on TestFlight before replying.

**What to enter in App Store Connect → App Review Information.**

- *User name*: the demo magic code (the field is required, so put the code
  here as well as in the notes).
- *Password*: the same magic code.
- *Notes*: explain the single-field login, in English. Suggested text:

  > Hanguk uses a single-field "Magic Code" sign-in — there is no separate
  > username and password. On the first screen, type the code below into the
  > XXXX-XXXX field and tap the sign-in button.
  >
  > Magic Code: <PASTE CODE>
  >
  > This demo student has full access to every feature: university map and
  > detail pages, application tracker, document uploads, study plan and
  > interview practice. The code does not expire and can be reused for
  > repeated review passes. The app requires an internet connection.

Do not commit the actual code to this repository — paste it directly into
App Store Connect.

---

## 3. Reply to send in App Store Connect

> Hello,
>
> Thank you for the detailed feedback. We have addressed both items.
>
> Guideline 2.3.3: the app is now built for iPhone only
> (UIDeviceFamily = 1), so the iPad screenshot set no longer applies, and we
> have replaced the iPhone screenshots with frames captured from a signed-in
> session of this build. They show the university map, institution details,
> the document tracker, the study plan and interview practice. No splash,
> login or marketing frames remain in any size — we verified each one through
> "View All Sizes in Media Manager".
>
> Guideline 2.1(a): we have added demo credentials to the App Review
> Information section. Hanguk signs in with a single-field "Magic Code"
> rather than a username and password — please enter the code from that
> section into the code field on the first screen. The account has full
> access to every feature and the code does not expire.
>
> Please let us know if anything else is needed.
