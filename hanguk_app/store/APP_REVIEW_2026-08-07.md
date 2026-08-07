# App Review rejection — 2026-08-07

Submission `3c58bd49-edd3-4679-9173-308569b3bc9a`, **version 1.0 (2042)**,
reviewed on iPad Air 11-inch (M3). Third message on this submission. Two new
guidelines cited — neither is a crash, and neither is fixed by rebuilding
alone.

This supersedes `APP_REVIEW_2026-08-05.md` (device family + demo account);
those two items were not cited again, but see § 3 — the build reviewed here
predates the device-family fix, so 2.3.3 may simply not have been re-checked.

---

## 1. Guideline 1.5 — Safety (Support URL)

**What Apple said.** The Support URL in App Store Connect,
`https://yuhakway.uz`, does not lead to a page where users can ask questions
and request support.

**Fixed in this branch.** `src/pages/Support.tsx` + the `/support` route in
`src/App.tsx`: a public page — no account, no login — with

- every channel the company actually answers on (email, Telegram direct,
  Telegram channel, Instagram, phone), kept in step with
  `hanguk_app/lib/core/config/contact_links.dart`,
- working hours,
- an FAQ led by the Magic Code sign-in, because a user who cannot get in is
  exactly the user who needs the support page,
- links to the Privacy Policy and Terms.

It renders in EN / UZ / RU / KO off the app's current locale, like
`Privacy.tsx` and `Terms.tsx`.

**Still to do by hand.**

1. Deploy the branch so `/support` is live on the domain you intend to submit.
2. In App Store Connect → **App Information → Support URL**, replace
   `https://yuhakway.uz` with that URL — `https://hanguk.uz/support` if the
   app site is the one you list. `STORE_METADATA.md` now records
   `/support` as the Support URL.
3. Open the URL in a private window before submitting. Apple checks that it
   loads and that it carries support information; a domain that parks, 404s or
   redirects to a landing page fails this guideline again.
4. Set the same URL on the Play listing so the two stores agree.

---

## 2. Guideline 2.3 — Accurate Metadata

**What Apple said.** They could not locate the feature described as
"Compare programs, tuition, location, and scholarship eligibility".

**They are right, and it is a metadata problem, not a missing feature.**
Checked against the code:

- `lib/features/guest/presentation/guest_compare_screen.dart` — the compare
  screen a user can actually reach (guest shell → Compare). Its rows are city,
  tier, IEQAS accreditation, partner status and the official domain. Its own
  doc comment explains why: `v_institutions_for_map` has no rank, no tuition
  and no TOPIK requirement, so the prototype's tuition row was dropped rather
  than rendered blank.
- `lib/features/uni_db/presentation/institution_compare_screen.dart` —
  the richer compare screen, on route `/institutions/compare?ids=a,b`. It does
  not carry tuition or scholarship rows either, **and nothing in the app
  navigates to it.** Same for `/institutions/:id`, which is where tuition rows
  (`domain/tuition_row.dart`) and scholarships (`domain/scholarship_row.dart`)
  do exist. Both routes are deep-link-only, so a reviewer tapping through the
  app cannot reach them by any path.

So there is no screen in the shipped app that compares tuition or scholarship
eligibility, and the screens that hold that data are unreachable. Apple's
instruction is to either point them at the feature or remove the claim.
**Remove the claim** — pointing them at a route only a deep link opens invites
a 2.1 follow-up.

**Fixed in this branch.** `STORE_METADATA.md`: the compare bullet in all four
languages now says what the app does — browse on the map, compare two
institutions on city, tier, IEQAS accreditation and partner status — and the
file carries a warning that the App Store Connect copy must not be wider than
it is.

**Still to do by hand (App Store Connect).**

1. **Description** — delete the "Compare programs, tuition, location, and
   scholarship eligibility" line and anything else naming tuition or
   scholarship comparison. Replace it with the corrected bullet from
   `STORE_METADATA.md`. Do this in **every** localisation, not just English.
2. **Promotional text** and **What's New** — same sweep.
3. **Screenshots** — no frame may be captioned with a feature the app does not
   have. A caption is metadata for this guideline.
4. Re-read the remaining bullets one by one and open each feature in the build
   you are submitting. The safe test: could a reviewer with the demo code find
   it in under a minute, without a deep link?

**The longer-term fix** is to give `/institutions/:id` and
`/institutions/compare` an entry point in the UI — the tuition and scholarship
data is already modelled and queried. That is a product change, not a review
fix, and it is not in this branch.

---

## 3. The build they reviewed is not the fixed build

Review ran on **1.0 (2042)** on an **iPad Air**. The
`TARGETED_DEVICE_FAMILY = "1"` fix from 2026-08-05 landed after that build
(current `pubspec.yaml` is `1.0.26+2043`). Two consequences:

- Do not read "2.3.3 was not cited again" as "the screenshot issue is closed".
  It was reviewed on the old, iPad-eligible binary.
- Upload a build that contains the fix before resubmitting, and verify it the
  way `docs/RELEASE_IOS.md` § 3 describes:

  ```bash
  /usr/libexec/PlistBuddy -c "Print :UIDeviceFamily" \
    build/ios/iphoneos/Runner.app/Info.plist   # must print [1]
  ```

  When the attached build is iPhone-only, review stops running on an iPad and
  the iPad screenshot slots stop being requested.

---

## 4. Reply to send in App Store Connect

Send this **after** the Support URL is live and the description is corrected —
not before. Apple re-checks both.

> Hello,
>
> Thank you for the review. We have addressed both items.
>
> Guideline 1.5: the Support URL has been updated to
> https://hanguk.uz/support. It is a public page with our email, Telegram,
> Instagram and phone contacts, our working hours, and answers to the
> questions we are asked most — including how the Magic Code sign-in works.
> No account is needed to view it.
>
> Guideline 2.3: the description was inaccurate and we have corrected it in
> every language. The app does not compare tuition or scholarship
> eligibility, and that claim has been removed. What the app does offer is an
> interactive map of Korean universities and a side-by-side comparison of two
> institutions on city, tier, IEQAS accreditation and partner status; the
> description now says exactly that.
>
> We have also attached a new build, which is built for iPhone only
> (UIDeviceFamily = 1) — the previous review ran on build 2042, which predates
> that change.
>
> Please let us know if anything else is needed.
