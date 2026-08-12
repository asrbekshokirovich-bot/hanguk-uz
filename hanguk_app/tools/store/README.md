# Store screenshot capture

`capture_screenshots.cjs` drives a real build of the app and photographs
what it renders. It exists because Apple rejected this app twice under
guideline 2.3.3 — "the screenshots do not show the actual app in use" —
and the only durable fix is to stop hand-assembling the set.

The script never composites, never adds a bezel, and never draws a
caption. Whatever it saves is a frame the app actually painted.

## The two capture routes

**Pixel-true (preferred, needs a Mac).** Apple's own device is the
gold standard, and it is the only route that produces a genuine iOS
frame — real status bar, real safe-area insets, real system font
fallback:

```bash
xcrun simctl boot "iPhone 16 Pro Max"
flutter run --release --dart-define=STORE_BUILD=true
xcrun simctl io booted screenshot 01-home.png   # 1320 x 2868
```

Drive the app by hand through the six screens listed in
`../../store/listings/screenshots/README.md` and shoot each one.

**Web (this script, works anywhere).** Flutter paints its own widgets, so
a web build of the same commit renders the same widget tree at the same
logical size. What it does *not* reproduce is the iOS status bar, the
home indicator, or safe-area insets. Use it to iterate quickly, to
capture from Linux or CI, or when no Mac is available — but prefer the
simulator for the frames you actually upload.

## Usage

```bash
flutter build web --release --dart-define=STORE_BUILD=true

# Guest screens only — no credential needed
node tools/store/capture_screenshots.cjs

# Full set, including the signed-in screens
node tools/store/capture_screenshots.cjs --code XXXX-XXXX --locale en
```

If `playwright` is installed globally rather than in the project, point
Node at it:

```bash
NODE_PATH=$(npm root -g) node tools/store/capture_screenshots.cjs
```

Options: `--build` (default `build/web`), `--out`, `--locale`
(`en`/`ko`/`uz`), `--code`, `--port`, `--device`
(`iphone-6.9` → 1320×2868, `iphone-6.5` → 1242×2688), `--keep-open`.

## The Magic Code

Sign-in is a single-field Magic Code, so `--code` is the whole
credential. **Never commit it** — see `store/APP_REVIEW_2026-08-05.md`
§ 2. Without it the script captures only the guest shell (Explore, Map,
Compare) and says so. Those three are real screens, but they are not
enough on their own: Apple's rule is that the *majority* of the set must
show core functionality, and the signed-in screens are where most of it
lives.

## Before you upload

The script is a camera, not a reviewer. Check every frame by eye:

- No splash, welcome or Magic Code screen — Apple does not count those
  as the app in use.
- No empty states. A tab that renders "no documents yet" reads as
  "cannot access functionality" and draws the same rejection.
- No real personal data — names, phone numbers, consultant details.
- No caption claiming a feature the app does not have; a caption is
  metadata under guideline 2.3.

Then follow the upload and Media Manager sweep in
`../../store/APP_REVIEW_2026-08-12.md`.
