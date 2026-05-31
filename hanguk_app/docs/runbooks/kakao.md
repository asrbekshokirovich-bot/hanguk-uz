# Kakao integration runbook

Closes audit P1 items K9/M23 and K16 from
`docs/audits/kakaotalk_audit_2026-05-11.md` and
`docs/audits/map_walkaround_audit_2026-05-11.md`.

Scope: every place in `hanguk_app` that touches Kakao, how to operate
it, and what the next person needs to know before they touch it.

## What ships today

Two WebView surfaces and one (dead) Edge Function.

  - `lib/features/map/presentation/widgets/university_map_html.dart` —
    Kakao Maps JS SDK + Leaflet/OSM fallback. Loads markers from
    `v_institutions_for_map` via the universities provider.
  - `lib/features/map/presentation/widgets/roadview_html.dart` —
    Kakao Roadview (street view) inside `UniversityRoadviewScreen`.
    Radius is **200 m** with no auto-expand (audit M5) — if no
    panorama is within 200 m we surface a localized empty state.
  - `supabase/functions/kakao-roadview-proxy` — scrapes
    `rv.map.kakao.com` internal JSON. **Not called by anything**.
    K6/M12 leaves it deployed-but-orphan (decision deferred per
    operator note 2026-05-12).

Nothing else. No Kakao Login, no Kakao Share, no Channel, no AlimTalk.
See audit §1.6 and §2.2–2.5 for what perfect would look like; K11–K14
are deferred until a paid Korean partner triggers them.

## App keys

Three Kakao key types matter for us:

  - **JavaScript key (CLIENT, OK in WebViews)** — read at compile time
    from `--dart-define=KAKAO_JS_KEY=...`, defaulted in
    `lib/core/config/app_config.dart`. Currently
    `c695b428933e192ca1d8582e3aab14a4`. **Domain allowlist** in the
    Kakao Developers console must include the origins below.
  - **Native app key (Android/iOS)** — NOT currently in use. We
    deleted the orphan `com.kakao.sdk.AppKey` manifest entry under
    audit K3. If we ever ship Kakao Login, gate adoption on K10
    (`flutter_secure_storage`) first.
  - **REST API + Admin keys** — never appear in the client. Reserved
    for server-side use (Edge Functions hitting Kakao Local Search,
    AlimTalk send). None deployed today.

To rotate the JS key:

  1. In Kakao Developers Console, generate a new JavaScript key.
  2. Confirm the new key's **Web** platform allowlist contains every
     domain in the list below.
  3. Pass `--dart-define=KAKAO_JS_KEY=<new>` on the next build.
  4. After 2 release-cycles with no telemetry regressions, delete the
     old key in the Console.

## Required JavaScript SDK domain allowlist

The JS SDK enforces an origin allowlist (up to 10 entries). Our
`loadHtmlString` / `srcdoc` WebViews report their origin as one of
these — the allowlist MUST include all of them or the SDK will
silently fail in production.

  - `hanguk.uz` (web build origin and the `baseUrl` used by the
    mobile WebView in `map_view/map_mobile.dart`).
  - `hanguk-uz.com` (alternate domain).
  - `localhost` (debug builds; the SDK accepts http://localhost).
  - The staff CRM Vercel preview domain (`*.vercel.app` — Kakao
    requires the canonical preview URL pinned, not the wildcard).

If a build starts showing "blocked" telemetry (`sdk_blocked` state
from `HangukRoadviewChannel`) on a fresh release, the first place to
look is **whether a new domain is missing from the allowlist**.

## The `baseUrl: 'https://hanguk.uz'` workaround

`map_view/map_mobile.dart:53` uses
`loadHtmlString(html, baseUrl: 'https://hanguk.uz')`. Without that
baseUrl the WebView has no origin and Kakao's domain check fails. The
load-bearing piece is that **`hanguk.uz` is registered in the JS-key
allowlist** (see above). If you ever change the baseUrl, change the
Console allowlist in the same PR.

## The Roadview JS bridge

`roadview_html.dart` posts one of these strings through
`window.HangukRoadviewChannel`:

  - `loading` (default, before any other message)
  - `ready` — panorama loaded successfully
  - `no_pano` — no panorama within 200 m
  - `sdk_blocked` — Kakao JS loaded but `kakao.maps` is undefined
  - `network` — `script.onerror` (SDK failed to load)
  - `init_error` — exception during Roadview construction

`UniversityRoadviewScreen` attaches the channel, runs the state
through a sealed enum, and renders a localized overlay (English,
Korean) on top of the WebView for everything except `ready`. The HTML
also carries inline English fallback copy in case the channel isn't
attached (defensive).

## Tightened Roadview radius (audit M5)

The original radius was 2 km, which almost always returned a panorama
but rarely one on campus — usually the nearest motor road. The
operator decision (recorded in audit §3 P0 M5 and reaffirmed
2026-05-12) is **200 m, no auto-expand**. If no panorama is in 200 m,
show the "no street view here" empty state; expanding defeats the
purpose because it re-introduces the drive-by panorama. Don't tweak
this without a UX call.

The audit-suggested alternative is a curated panorama tour
(`virtual_tour` JSONB column on `institutions`, rendered via Pannellum
in a separate WebView). That pilot ships for Yonsei this batch; see
`lib/features/map/presentation/widgets/virtual_tour_*` and
`assets/virtual_tour/pannellum.html`. Roadview remains the fallback.

## Things to never do

  - **Don't hardcode any Kakao key** in source. Use `AppConfig` +
    `--dart-define`.
  - **Don't add Kakao Login or Share without K10 first.** OAuth
    tokens require `flutter_secure_storage`, which only lands in
    pubspec when K10 ships. Currently K10 is in pubspec but unused.
  - **Don't wire `kakao-roadview-proxy` from the client.** It scrapes
    undocumented internal endpoints and can break any week. If we
    need raw Kakao panoramas, talk to the operator first.
  - **Don't switch the map to Naver.** Naver Street View is gated to
    enterprise NCloud customers; Kakao is free under our load.

## Telemetry to watch

If we ever add usage events (audit M20), the metrics that matter:

  - `map_marker_click` (volume + which institution_id)
  - `walkaround_open` (volume + which institution_id)
  - `walkaround_no_pano` rate — if this rises after a release, the
    radius decision may need revisiting
  - `walkaround_sdk_blocked` rate — should be 0; nonzero means the
    JS-key allowlist needs an update
  - `virtual_tour_open` (Pannellum pilot — see the Pannellum runbook
    section below)

## Pannellum tour pilot

  - Panoramas hosted in Supabase Storage public bucket `virtual-tours/`
    under `virtual-tours/{institution_slug}/scene_{n}.jpg`.
  - Per-institution metadata lives in
    `institutions.virtual_tour` (JSONB) — see migration
    `supabase/migrations/20260512120000_institutions_virtual_tour.sql`.
  - Viewer is a single `assets/virtual_tour/pannellum.html` page +
    `pannellum.js` (CC0/MIT, 21 KB). The Dart side injects the tour
    spec via a JavaScript channel.
  - When `virtual_tour` is non-null, the institution detail sheet
    surfaces a **"Virtual Tour"** button (curated) instead of /
    alongside the **"Virtual Walkaround"** button (Kakao Roadview).
  - Yonsei is the seed — initial scenes use Pannellum CC0 example
    panoramas with a `TODO: replace with real Yonsei imagery` marker
    in the migration's seed JSON.

## Sources

  - Kakao Developers — App keys: https://developers.kakao.com/docs/latest/en/getting-started/app
  - Kakao Developers — Security guideline: https://developers.kakao.com/docs/latest/en/getting-started/security-guideline
  - Kakao Maps Web API: https://apis.map.kakao.com/web/documentation/
  - Kakao Roadview JS sample: https://apis.map.kakao.com/web/sample/basicRoadview/
  - Audit: `docs/audits/kakaotalk_audit_2026-05-11.md`
  - Audit: `docs/audits/map_walkaround_audit_2026-05-11.md`
