# Screenshot requirements

Both stores require localized screenshots captured from a real release
build. Do NOT shop these — Apple rejects mockup-style screenshots that
don't show the actual UI. Do NOT include alpha channels or transparency;
both stores want flattened PNGs.

## Apple App Store

| Device class | Pixel size | Required? | Notes |
|---|---|---|---|
| 6.9" iPhone (iPhone 16 Pro Max) | 1320 × 2868 | **Required** for any submission. | 3–10 screenshots. |
| 6.7" iPhone (iPhone 14 Pro Max / 15 Plus / etc.) | 1290 × 2796 | Strongly recommended fallback for older devices. | Auto-scaled from 6.9" if absent. |
| 6.5" iPhone (iPhone 11 Pro Max / Xs Max) | 1284 × 2778 | Optional. | Auto-scaled. |
| iPad Pro 13" (M4) | 2064 × 2752 | Required only if iPad is supported. | LSRequiresIPhoneOS = true, so currently skip. |

Locales: at minimum `en-US`, `ko`, `uz` (Apple uses `uz` not `uz-UZ`).
File each set in a localized subfolder: `app-store/<locale>/screenshots/`.

## Google Play

| Asset | Pixel size | Notes |
|---|---|---|
| Phone screenshots | min 320 px, max 3840 px on short side; 16:9 or 9:16 | 2–8 PNG / JPEG, ≤8 MB each. |
| 7" tablet | 1024 × 600 or 1280 × 800 | Optional. |
| 10" tablet | 1920 × 1200 or 2560 × 1600 | Optional. |
| Feature graphic | **1024 × 500** | Required — see `../feature-graphic/`. |
| Hi-res icon | **512 × 512** | Required — see `../app-icon/`. |

Locales: `en-US`, `ko-KR`, `uz`.

## What to capture

Capture six screenshots in each locale, in this order:

1. **Welcome / home** — clean, no debug overlay, shows the four-tab bottom nav.
2. **Map** — Kakao Maps view zoomed on Seoul with a university callout open.
3. **Documents** — a list of uploaded application documents.
4. **Study Plan builder** — Step 2 of the wizard, showing AI suggestions.
5. **Personal statement workspace** — text being written with inline grammar squiggles.
6. **Interview practice** — active session with a live transcript bubble.

Avoid: real PII, leaked phone numbers, real consultant names. Use a
seeded test account.
