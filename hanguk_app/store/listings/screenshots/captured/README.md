# Captured screenshots

Real frames, produced by `tools/store/capture_screenshots.cjs` driving a
release build of this commit. Nothing here is composited, mocked or
captioned — each PNG is what the app painted.

Format: 1320 × 2868, 8-bit RGB, no alpha channel. That is the 6.9" iPhone
size Apple requires, and flattened as both stores want.

## What is here

`iphone-6.9/en/` — three guest-mode screens:

| File | Screen | Shows |
|---|---|---|
| `01-guest-explore.png` | Explore | The searchable university list with city filters — 57 institutions, real names and IEQAS status. |
| `02-guest-map.png` | Map | The national map with 204 universities plotted. |
| `03-guest-compare.png` | Compare | Chung-Ang and KAIST side by side: city, tier, IEQAS, website, tuition, application window, TOPIK, interview and document counts. |

All three are core functionality with real data, and none is a splash,
welcome or login screen — the three things guideline 2.3.3 explicitly does
not count as the app in use.

## What is missing, and why

These are **guest-mode** screens. The signed-in half of the app — home,
applications, documents, study plan, interview practice — needs the demo
Magic Code, which is deliberately not stored in this repository (see
`store/APP_REVIEW_2026-08-05.md` § 2). Capture it with:

```bash
flutter build web --release --dart-define=STORE_BUILD=true
node tools/store/capture_screenshots.cjs --code XXXX-XXXX
```

Three guest screens are not a submittable set on their own. Apple's rule is
that the *majority* must show core functionality, and a set that never gets
past guest mode invites the "cannot access all of the app" finding under
2.1(a) instead. Treat these as the first three of six.

## Web-rendered, not device-captured

These frames come from a Flutter **web** build. Flutter paints its own
widgets, so the layout, type and colour are the same widget tree the iOS
build renders — but the iOS status bar, home indicator and safe-area insets
are not reproduced.

For the frames you actually upload, prefer the simulator route in
`tools/store/README.md`; it needs a Mac but produces genuine iOS frames.
Use these when no Mac is available, and expect a reviewer to be comparing
against the real thing.

## Locales

Only `en` so far. Apple wants `en-US`, `ko` and `uz`. Re-run with
`--locale ko` and `--locale uz` once the signed-in screens are captured.
