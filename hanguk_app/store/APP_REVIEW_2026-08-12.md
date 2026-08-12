# App Review rejection — 2026-08-12

Submission `3c58bd49-edd3-4679-9173-308569b3bc9a`, **version 1.0 (2042)**,
reviewed on iPad Air 11-inch (M3). Fourth message on this submission.

Guideline cited: **2.3.3 — Performance, Accurate Metadata.**

> The 13-inch iPad screenshots do not show the actual app in use in the
> majority of the screenshots.

This is the same guideline as the 2026-08-05 rejection, and it is **not a
code defect**. Nothing in this repository can clear it — the offending
assets live in App Store Connect. What follows is the exact cause and the
exact sequence that closes it.

---

## 1. Why an iPhone-only app is still being asked for iPad screenshots

Two facts have to be read together.

**Fact A — the binary under review is the old one.** Apple reviewed
**1.0 (2042)**. That is the same build they reviewed on 2026-08-07, and it
predates the device-family fix. `pubspec.yaml` is now `1.0.27+2044`.

**Fact B — the fix is in the tree and is correct.** Verified against the
working tree on this branch:

- `ios/Runner.xcodeproj/project.pbxproj` — `TARGETED_DEVICE_FAMILY = "1"`
  in all three build configurations (lines 357, 483, 536: Profile, Debug,
  Release). Not one config is left at `"1,2"`.
- `ios/Runner/Info.plist` — carries `UISupportedInterfaceOrientations`
  only. There is no `UISupportedInterfaceOrientations~ipad` key, which is
  what an iPad-eligible target would need.

So the repository already builds an iPhone-only app. Build 2042 does not.
While an iPad-eligible binary is the one attached to the submission, App
Store Connect keeps every iPad screenshot slot live, review keeps running
on an iPad (hence the iPad Air 11-inch review device), and the stale
marketing set sitting in the 13-inch iPad slot keeps failing 2.3.3.

**The 13-inch slot is the one nobody has opened.** The previous round
cleaned up what was visible on the default size. Apple's own note names
the trap: *"some screenshots may only be viewed and updated by selecting
'View All Sizes in Media Manager'."* An old marketing set survives on a
size you never expanded, and that alone re-triggers this rejection.

---

## 1b. Where the failing screenshots came from

Found while capturing replacements, and it explains all three rejections
rather than just this one.

`public/screenshots/` held twelve files that every store doc pointed at as
*the* screenshot set. They were **AI-generated marketing art, not this
app**: a phone bezel drawn around an invented blue-and-white interface,
a headline over a gradient, and body text that is not real words —
"Futtless Tracks", "Prqdnaction", "Ersen's Listles ilea Ltaid". The real
app is dark navy and lime. They were also JPEGs carrying a `.png`
extension, sized 1024×1920 and 1088×1920, which is not a size any iPhone
has.

Worse, `STORE_METADATA.md` and `STORE_DEPLOYMENT.md` both recommended a
screenshot order that **opened with Welcome and Login** — the two screens
Apple names explicitly as not counting as the app in use.

So anyone following this repository's own instructions would upload
marketing renders led by a login screen, and draw guideline 2.3.3 again.
That is what happened three times.

Fixed on this branch: the twelve files are deleted, and both documents now
carry the real capture list, the real sizes, and an explicit rule that
Welcome and Login must not appear at all.

## 2. What to do, in order

Step 1 is what actually removes the iPad slots. Step 2 is the belt to
step 1's braces — do it anyway, because the slot can persist on the
submission until the new build is attached, and Apple re-checks the
metadata before it re-checks the binary.

### Step 1 — attach a build that is iPhone-only

Build and upload `1.0.27+2044` (or later). Before uploading, verify the
archive the way `docs/RELEASE.md` describes:

```bash
/usr/libexec/PlistBuddy -c "Print :UIDeviceFamily" \
  build/ios/iphoneos/Runner.app/Info.plist   # must print [1]
```

If that prints `[1, 2]`, stop — the archive is not the fixed one, and
uploading it repeats this rejection verbatim.

Then in App Store Connect, on the version, set **Build** to the newly
uploaded build. Attaching it is a separate action from uploading it; a
build that finished processing but was never selected leaves 2042 under
review.

### Step 2 — empty the iPad screenshot slots

In App Store Connect → the version → **Previews and Screenshots**:

1. Open the device-size dropdown and select **View All Sizes in Media
   Manager**. Do not skip this — the sizes that fail are the ones the
   default view hides.
2. Walk **every** size in the list, not just the flagged one. Check at
   minimum:
   - iPad 13" (2064 × 2752 / 2048 × 2732)
   - iPad 12.9" (2048 × 2732)
   - iPad 11" (1668 × 2388)
   - every iPhone size that holds assets
3. In each **iPad** size, delete every screenshot. Leave the iPad sizes
   completely empty — an iPhone-only app is not required to have them,
   and an empty slot cannot fail 2.3.3. Do not try to fix the iPad set by
   re-cropping the iPhone captures; a stretched iPhone frame is the
   "does not reflect the UI of the app" case Apple lists.
4. Repeat for **every localisation** — `en-US`, `ko`, `uz`. The Media
   Manager is per-locale, and a stale set in `ko` fails the same way as
   one in `en-US`.

### Step 3 — confirm the iPhone sets still pass on their own terms

The iPhone screenshots are what review will see once the iPad slots are
gone, so they must satisfy 2.3.3 by themselves. The standing rules from
`listings/screenshots/README.md`:

- No splash screen, no login / Magic Code screen, no welcome screen.
  Apple does not count those as the app in use.
- No device bezels wrapped around a rendering, no headline-over-gradient
  slides, no text that is not in the app's own UI.
- The **majority** must be core feature screens — map, institution
  detail, documents, study plan, interview practice — captured from a
  real signed-in session on the demo account.

If the current iPhone set does not clear that bar, recapture it against
the six-shot list in `listings/screenshots/README.md` before resubmitting.

### Step 4 — carry the earlier fixes forward

The 2026-08-07 items were not cited again, but they were also never
re-reviewed on a corrected build. Confirm before resubmitting:

- **Support URL** is live and public (guideline 1.5 — see
  `APP_REVIEW_2026-08-07.md` § 1).
- **Description** carries no tuition or scholarship comparison claim, in
  every localisation (guideline 2.3 — see § 2 of the same file).

---

## 3. Reply to send in App Store Connect

Send this **after** the new build is attached and the iPad slots are
empty. Apple re-checks both before reading the reply.

> Hello,
>
> Thank you for the review, and for pointing us at the 13-inch iPad
> screenshots specifically.
>
> Hanguk is an iPhone-only app. The build under review, 1.0 (2042),
> predates that change, which is why review ran on an iPad and why the
> iPad screenshot slots were still being requested. We have attached a
> new build that is built for iPhone only (UIDeviceFamily = 1).
>
> We have also removed every screenshot from all iPad sizes, checked
> through View All Sizes in Media Manager and in each localisation, so
> no iPad assets remain on the submission. The iPhone screenshots are
> real frames captured from a signed-in session and show the app's core
> features in use — the university map, an institution's detail page,
> uploaded documents, the study plan, and interview practice. None of
> them is a splash, login or marketing frame.
>
> Please let us know if anything else is needed.

---

## 4. Repository changes on this branch

- This file.
- `listings/screenshots/README.md` — the iPad row now says to leave the
  iPad slots empty and to sweep them per-locale in Media Manager, and a
  "Rejected 2026-08-12" section records why a stale hidden size is enough
  to fail on its own.
- **Deleted `public/screenshots/` (12 files)** — the AI-generated marketing
  renders described in § 1b.
- `STORE_METADATA.md` and `STORE_DEPLOYMENT.md` — asset paths, sizes and
  screenshot order corrected; Welcome and Login ruled out explicitly.
- `tools/store/capture_screenshots.cjs` + `tools/store/README.md` — a
  capture harness that drives a real build, so the set is photographed
  rather than assembled.
- `listings/screenshots/captured/` — the first three real frames
  (Explore, Map, Compare) at 1320×2868.
- `STORE_METADATA.md` compare bullet, all four languages — widened to
  match what Guest Compare actually renders since commit `0023a97`
  (tuition, application window, document deadline, TOPIK, English-taught,
  interview). Scholarship and rank stay out; they still do not exist.

No source change was needed for the rejection itself: the iPhone-only
configuration is already correct in `ios/`, and that half of the fix
reaches Apple by uploading a build, not by editing code.
