# Screenshots pushed to the App Store

This directory is **assembled at release time and gitignored** — the captures
themselves live once, in `store/listings/screenshots/captured/iphone-6.9/`,
where the capture tool writes them. The Fastfile copies them here and renames
the locale (`en` on the app side is `en-US` on the store side), so there is no
second copy of four megabytes of PNGs to drift out of date with the first.

What lands here is then the whole truth: `upload_to_app_store` runs with
`overwrite_screenshots: true`, so every screenshot in App Store Connect that is
not here is deleted on each release.

That is deliberate. The 2026-08-12 rejection was a stale iPad asset sitting in
a slot that only appears under "View All Sizes in Media Manager" — invisible in
the normal list, and swept twice by hand without actually being removed. An
empty slot cannot fail guideline 2.3.3; a forgotten one does.

## Rules

* **iPhone 6.9" only** — 1320 × 2868. deliver infers the device from the pixel
  size, so the dimensions must be exact.
* **No iPad sizes here, ever.** The app is `TARGETED_DEVICE_FAMILY = "1"`.
* **Real frames only**, captured from a running build with
  `tools/store/capture_screenshots.cjs`. No bezels, no gradient captions, no
  text that does not appear in the app — that is the 2.3.3 case Apple rejects.
* **No splash, welcome or sign-in screens.** Apple counts those as "the app is
  not shown in use".
* Files sort alphabetically into the order the store displays them, hence the
  `01-`, `02-` prefixes.
* `ko` and `ru` have no captures yet, so those locales are pushed empty: a
  localization with no screenshots inherits the primary language's, which is
  better than shipping a stale set.

## Still missing

Three of the six frames exist (Explore, Map, Compare). The university detail
page, Documents, Study Plan and the AI interview are not captured yet.
