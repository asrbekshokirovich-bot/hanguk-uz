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
| iPad Pro 13" (M4) | 2064 × 2752 | Not required. | `TARGETED_DEVICE_FAMILY = "1"` (iPhone only) since the 2026-08-05 rejection, so App Store Connect no longer asks for an iPad set and review runs on iPhone. |

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

Capture six screenshots in each locale, in this order. Every one of them
must be a real frame captured from a signed-in session — see "Rejected
2026-08-05" below for why.

1. **Home** — signed in, greeting + the four-tab bottom nav populated with
   real data (`features/home/presentation/seoul_home_tab.dart`).
2. **Map** — Kakao Maps zoomed on Seoul with a university detail sheet open
   (`features/map/presentation`).
3. **Institution detail / compare** — a university's programme, tuition and
   requirements (`features/uni_db/presentation/institution_detail_screen.dart`
   or `institution_compare_screen.dart`).
4. **Documents** — the list of uploaded application documents
   (`features/documents/presentation/documents_tab.dart`).
5. **Study Plan** — the plan with its generated steps
   (`features/training/presentation/study_plan_screen.dart`).
6. **Interview practice** — an active session with a live transcript bubble
   (`features/training/presentation/interview_screen.dart`).

Avoid: real PII, leaked phone numbers, real consultant names. Use the
review demo account (see `store/APP_REVIEW_2026-08-05.md`).

### Rejected 2026-08-05 — guideline 2.3.3

Apple rejected submission `3c58bd49-edd3-4679-9173-308569b3bc9a` because
"the screenshots still do not show the actual app in use in the majority
of the screenshots". Hard rules that follow from that:

- **No splash screen, no login/Magic Code screen, no welcome screen.**
  Apple explicitly does not count those as the app in use.
- **No marketing frames** — no device bezels wrapped around a rendering, no
  headline-over-gradient slides, no text that isn't in the app's own UI.
- The majority of the set must be **core feature screens** — map, institution
  data, documents, study plan, interview practice.
- Re-check every size in App Store Connect via **"View All Sizes in Media
  Manager"**; an old marketing set can survive there on a size you never
  opened, and that alone re-triggers this rejection.
