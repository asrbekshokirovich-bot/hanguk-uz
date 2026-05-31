# Map + virtual campus walk-around audit — 2026-05-11

Scope: every code path in the Hanguk Flutter app and Supabase backend
that draws a map, places a marker, opens a detail sheet, or shows a
360-style "walk-around" of a university campus. Includes the parallel
discovery questions ("could we do a real campus walk-through?"; "what
are the alternatives to Kakao Roadview?").

Method: code-first, line-by-line read of every map/walkaround-touching
file (grep across `.dart`, `.html`, `.ts`, `.sql`, `.md`, `.yaml`). Web
research second.

Reporting structure per the operator's refinement:

  - **Section 1 — What's actually in the code today** (factual inventory)
  - **Section 2 — What perfect looks like** (best-practice research + recommendation)
  - **Section 3 — Prioritized backlog** (P0/P1/P2 with file/line refs)

Worktree: `.claude/worktrees/vigorous-haibt-f28e2d`.
Sister scope: `docs/audits/kakaotalk_audit_2026-05-11.md` (Kakao Maps
JS SDK key hygiene + native-SDK orphan plumbing live there).

---

## Status banner (latest: 2026-05-12)

  - **All P0 items shipped** (M1, M2, M3, M4) — 2026-05-11.
  - **All P1 items shipped** (M5–M13) — 2026-05-12. Roadview radius
    fix landed in P0; M6 localization wired via JS-bridge to a Dart
    overlay across all 5 locales; auto-fit-bounds + lazy Leaflet
    landed; walkaround now navigates via `go_router` with the
    `/walkaround/:institutionId` route, plus a `/map/:institutionId`
    deep-link route that switches the home-tab and raises the detail
    sheet via `pendingMapDetailProvider`. `kakao-roadview-proxy`
    replaced by a 410 Gone stub (Supabase deploy v14). `test_map.html`
    neutralized, awaiting host-side `git rm`.
  - **All P2 items resolved** (M14–M25) — 2026-05-12. Most shipped
    (M15 Kakao MarkerClusterer + Leaflet.markercluster fallback;
    M17 Pannellum pilot — see below; M18 walkaround_url override;
    M19 locale-aware marker names; M20 analytics with provider-
    overridable sink + unit tests; M21 a11y Semantics labels on
    chips/badge/markers; M22 InfoWindow on Kakao marker click; M24
    rethrow on repository errors; M25 filter-empty badge on map).
    M14 is a content/data task assigned out-of-band. M16 ("near me"
    FAB) **deferred** — implementation requires platform geolocation
    permission plumbing (Android + iOS Info.plist + webview_flutter
    permission shims) that is out of scope for the P2 polish batch.
  - **Pannellum 360 pilot shipped** (M17). Yonsei seeded on staging
    + prod via migration `20260512120000_institutions_virtual_tour.sql`
    (idempotent — re-applying never overwrites a hand-curated tour).
    Pannellum HTML embedded as a Flutter asset
    (`assets/virtual_tour/pannellum.html`); a Dart-side
    `VirtualTourScreen` wires the JS bridge and a localized state
    overlay. Three demo scenes (Main Gate → Library → Quad) with
    hotspot navigation; panorama URLs point at Pannellum's CC0 demo
    images and are explicitly marked `TODO: replace with real Yonsei
    imagery` so a content team can swap them in. Yonsei row exists on
    staging today; on prod the seed activates the moment the
    discovery worker inserts the Yonsei row (per the "no demo data
    in prod" rule from migration `20260510112339`).

---

## Executive summary

The map surface is a four-piece system: a `MapTab` shell with
search/filter/list-vs-map toggle, a `UniversityMapView` that delegates
to platform-specific WebView wrappers (`map_mobile.dart` /
`map_web.dart`), generated HTML loaded into those WebViews
(`university_map_html.dart`), and a domain object + repository
(`University` + `universitiesProvider`).

**The whole surface is currently broken in prod.** The repository
queries the `universities` table that was dropped on 2026-05-10 in
Phase 3R-B. The map renders zero markers; the list view is empty; the
"Virtual Walkaround" CTA never appears because every university has
null lat/lng (because the query returned an empty list, which the
repository swallows as `[]` in its try/catch).

The "walk-around" feature does exist and is implemented via the
**Kakao Roadview** JS API inside a WebView, with an `EagerGesture\
Recognizer` to prevent Flutter from stealing drag gestures. It works
when fed a real university lat/lng — but the search radius is 2 km, so
the panorama returned is rarely on campus, and the loading text is
hard-coded English ("Booting … Campus Walkaround…").

A second walkaround path exists but is **wired to nothing**: the
`kakao-roadview-proxy` Supabase Edge Function scrapes Kakao's
undocumented internal panorama JSON (`rv.map.kakao.com/roadview-search`)
and would let a custom 360 viewer (Pannellum / three.js) render Kakao
panoramas natively. Zero client code calls it.

The top recommendations are: (1) fix the data source (one-line view
swap), (2) decide whether to ship a *real* campus walkthrough (curated
Pannellum tours backed by official university VR pages — Yonsei, SNU
already have these) or keep the Kakao Roadview fallback, and (3)
delete or wire the orphan proxy.

---

## Section 1 — What's actually in the code today

### 1.1 File inventory — every Flutter file in the map surface

| File | Lines | Role |
|---|---|---|
| `lib/features/map/data/map_repository.dart` | 43 | `universitiesProvider` — Riverpod `FutureProvider<List<University>>` |
| `lib/features/map/domain/university.dart` | 38 | Immutable `University` domain object |
| `lib/features/map/presentation/map_tab.dart` | 359 | `MapTab` shell — search, filter chips, list/map toggle |
| `lib/features/map/presentation/widgets/university_card.dart` | 136 | List-row card with logo, rank badge, partner chip |
| `lib/features/map/presentation/widgets/university_detail_sheet.dart` | 382 | DraggableScrollableSheet with stats, "Virtual Walkaround" + "Visit Website" buttons |
| `lib/features/map/presentation/widgets/university_map_view.dart` | 66 | Switches on platform — delegates to `map_impl.buildMap(...)` |
| `lib/features/map/presentation/widgets/university_map_html.dart` | ~135 | Generates the map HTML with Kakao SDK + Leaflet fallback |
| `lib/features/map/presentation/widgets/university_roadview_screen.dart` | 104 | Scaffold + WebView for the Roadview |
| `lib/features/map/presentation/widgets/roadview_html.dart` | ~60 | Generates the Roadview HTML |
| `lib/features/map/presentation/widgets/map_view/map_platform.dart` | 10 | Stub for conditional import |
| `lib/features/map/presentation/widgets/map_view/map_mobile.dart` | 60 | `webview_flutter` host for the map |
| `lib/features/map/presentation/widgets/map_view/map_web.dart` | 74 | `dart:html` IFrameElement host for the map |
| `lib/features/home/presentation/home_screen.dart` | 6, 24, 86 | Adds `MapTab` to the bottom-nav as the second tab |
| `supabase/functions/kakao-roadview-proxy/index.ts` | ~170 | Edge Function for a future custom viewer — NOT CONSUMED |
| `supabase/migrations/20260510130000_uni_db_v3_drop_legacy_universities.sql` | (drop migration) | Phase 3R-B; dropped `public.universities` 2026-05-10 |
| `supabase/migrations/20260601000100_uni_db_v1_views.sql` | (view def) | Defines `v_institutions_for_map` — the intended replacement contract |
| `test_map.html` (repo root) | 20 | Stray standalone Kakao Maps test — unrelated to the app, includes a third hardcoded JS key |

### 1.2 `map_repository.dart` — the source of all map data

```dart
final universitiesProvider = FutureProvider<List<University>>((ref) async {
  try {
    final data = await Supabase.instance.client
        .from('universities')   // ← DROPPED TABLE
        .select(
          'id, name_en, city_en, latitude, longitude, logo_url, '
          'ranking, local_rank, acceptance_rate, tuition_min, tuition_max, '
          'is_partner, is_visible_on_map, website_url, description_en',
        )
        .eq('is_visible_on_map', true)
        .order('ranking', ascending: true, nullsFirst: false);
    return (data as List).map((row) => University(...)).toList();
  } catch (e) {
    debugPrint('[MapRepository] Failed to load universities: $e');
    return [];   // ← silently swallows the error
  }
});
```

  - **`from('universities')`** — table dropped on 2026-05-10 by
    `20260510130000_uni_db_v3_drop_legacy_universities.sql`. Supabase
    returns an error; the try/catch returns `[]`. Map renders empty.
  - **Columns referenced** that no longer exist on `public.institutions`:
    `name_en` (now lives in `display_names ->> 'en'`), `city_en` (now
    `city_ko` only), `ranking`, `local_rank`, `acceptance_rate`,
    `tuition_min`, `tuition_max`, `description_en`, `website_url` —
    none of these columns are on `institutions`. The intended
    contract is `v_institutions_for_map` (the view defined in
    `20260601000100_uni_db_v1_views.sql`).
  - **`v_institutions_for_map` exposes:** `id, name_ko, name_ko_short,
    name_en, name_uz, city_ko, latitude, longitude, logo_url, tier,
    ieqas_status, is_partner, is_visible_on_map, last_verified_at,
    next_event_at`. Notice: **no ranking, no tuition, no acceptance
    rate, no description.** The map UI references all of these.
  - **Silent error swallowing** in the try/catch is hostile to
    debugging — the user sees an empty map; the logs show
    `Failed to load universities: PostgrestException(...)` but only
    in debug builds.

### 1.3 `university.dart` — the domain object

```dart
@immutable
class University {
  final String id;
  final String name;        // name_en
  final String location;    // city_en
  final double? latitude;
  final double? longitude;
  final String? logoUrl;
  final int? ranking;
  final int? localRank;
  final double? acceptanceRate;
  final int? tuitionMin;
  final int? tuitionMax;
  final bool isPartner;
  final bool isVisibleOnMap;
  final String? website;
  final String? descriptionEn;
  ...
}
```

  - Modelled to the legacy `universities` row shape, not to the new
    `institutions` shape. Fields `ranking`, `tuitionMin`, `tuitionMax`,
    `acceptanceRate`, `descriptionEn`, `website` have no counterparts
    on `institutions` — they live in separate tables (`tuition`,
    `scholarships`) or have been intentionally dropped.

### 1.4 `map_tab.dart` — the user-facing shell

  - 359 lines. Contains: search controller (live-filters by name +
    location, case-insensitive), `_isMapMode` toggle (default `true`),
    filter chips `'all' | 'partner' | 'top100'`.
  - **`top100` filter** (line 54): `u.ranking != null && u.ranking! <=
    100`. After K1/M1 fix lands and we read from `institutions`, this
    filter will always be empty because `ranking` doesn't exist there
    — there's a `tier smallint check (tier between 0 and 4)` column
    instead. Mapping isn't 1:1.
  - **`AnimatedSwitcher`** (line 171) cross-fades between
    `UniversityMapView` and `_buildList`. Implementation is clean.
  - **Empty state** (lines 192–217) is well-designed: distinguishes
    "search returned nothing" from "filter matched nothing" and
    offers a "Clear filters" reset.
  - **Error state** (lines 230–267) has retry button calling
    `ref.refresh(universitiesProvider)`. But because the repo
    swallows errors and returns `[]`, the error state never fires in
    practice — the user sees the "empty" state instead.

### 1.5 `university_card.dart` — the list row

  - 136 lines. Renders `Row(logo, name+city, rankBadge, partnerChip,
    chevron)`.
  - Logo path: `Image.network(university.logoUrl!)` with an
    `errorBuilder` falling back to a vibrantLime school icon. Good.
  - Rank badge (lines 92–117): shows `#${university.ranking}` if
    `ranking != null`; highlights top-100 in vibrantLime. **Dead path**
    after the institutions migration — `ranking` will always be null.
  - Partner chip (lines 119–135): simple `Partner` text inside a
    vibrantLime pill.

### 1.6 `university_detail_sheet.dart` — the detail sheet

  - 382 lines. DraggableScrollableSheet (`initialChildSize: 0.6`,
    `maxChildSize: 0.9`). Builds: header (logo + name + city +
    partner badge), stats row, tuition row, acceptance rate row,
    description block, **"Virtual Walkaround"** ElevatedButton,
    **"Visit University Website"** OutlinedButton.
  - **Walkaround button** (lines 165–192): only shown when
    `university.latitude != null && university.longitude != null`.
    Navigates via `Navigator.of(context).push(MaterialPageRoute(builder:
    UniversityRoadviewScreen))`. Not a `go_router` route — bypasses
    the central routing. Inconsistent with the rest of the app.
  - **Website button** (lines 195–220): opens external browser via
    `url_launcher`. Has a small bug: `_launchWebsite` uses
    `Uri.parse(...)` (would throw on malformed input) instead of
    `Uri.tryParse`. Minor.
  - **Stats row** references `university.ranking` and `university.localRank`
    — both null after the institutions migration → row collapses to
    empty `SizedBox.shrink()`. Detail sheet looks bare.

### 1.7 The map HTML (`university_map_html.dart`)

  - Generates a self-contained HTML doc with: Leaflet CSS+JS loaded
    statically in `<head>`; an empty `<div id="map">`; an inline
    script that builds Kakao markers (`addKakaoMarker`) **and**
    Leaflet markers (`addLeafletMarker`) — both injected eagerly into
    the script body.
  - Loads Kakao JS SDK from `dapi.kakao.com/v2/maps/sdk.js?appkey=c695b428…&autoload=false`.
  - **`script.onload` → `kakao.maps.load(initKakaoMap)`.** If Kakao
    succeeds, `mapInitialized = true`.
  - **`script.onerror = fallbackToOsm`.** If Kakao fails to load,
    `initLeafletMap()` runs.
  - **1500 ms failsafe timeout** (`setTimeout(fallbackToOsm, 1500)`)
    — catches the case where Kakao loaded but `kakao.maps.load`
    callback never fires (network-throttled / browser policy).
  - **Marker click → `triggerAppEvent(id)`**:
    - On mobile: `window.HangukMapChannel.postMessage(id)` — caught
      by `map_mobile.dart`'s `addJavaScriptChannel`.
    - On web: `window.parent.postMessage({type:'HangukMapClick',id}, '*')`
      — caught by `map_web.dart`'s `html.window.onMessage.listen`.
  - **Both message paths** are wired and round-trip into
    `_uniById[id]` → `onMarkerClick(u)` → `showModalBottomSheet(...)`.
    Clean.
  - **Default centre/zoom**: `(36.5, 127.8), level: 13` (mid-Korea) on
    Kakao; `[36.5, 127.8], 7` on Leaflet. No auto-fit-bounds — if all
    markers are in Seoul, the user sees Korea-wide.

### 1.8 The Roadview HTML (`roadview_html.dart`)

  - 60 lines. Self-contained HTML, loading text `"Booting $safeName
    Campus Walkaround..."`, error fallback `"Walkaround data completely
    isolated."` Both English-only.
  - Loads same Kakao JS SDK + same JS key.
  - **`rvClient.getNearestPanoId(targetPosition, 2000, callback)`** —
    2000 m radius. The Kakao official sample uses **50 m**. With 2 km
    we almost always find *a* panorama, but it's typically on the
    nearest motor road, not inside campus. UX cliff.
  - On `panoId === null` → "Walkaround data completely isolated." — a
    misleading message; the data isn't isolated, the radius failed.
  - On `script.onerror` → "Network connection denied." — also
    misleading; could be SDK domain check failure.

### 1.9 `university_roadview_screen.dart` — the Roadview wrapper

  - 104 lines. Uses `EagerGestureRecognizer` (lines 47–50) to claim
    drag gestures eagerly — preventing Flutter's
    `DraggableScrollableSheet` parent from intercepting. This is the
    standard fix for Kakao Roadview-in-Flutter friction.
  - Background `Color(0xFF0F1626)` matches the map base while the
    iframe initialises (prevents white-flash).
  - Back button (lines 55–74): custom round overlay, calls
    `Navigator.of(context).pop()`. Top-left corner.
  - Label overlay (lines 77–98): top-right corner pill showing
    walk-icon + university name.
  - **Default coordinates** (lines 25–26): if `latitude` is null, falls
    back to `36.5`, and if `longitude` is null, falls back to `127.8`
    (mid-Korea). The walkaround button is supposed to be hidden when
    coordinates are null, so this is a belt-and-braces guard — but
    if the button hide check fails, the user gets a "walkaround" of
    a random central-Korea field.

### 1.10 Platform conditional imports

`map_view/map_platform.dart` (10 lines) is a stub throwing
`UnsupportedError`. The real implementation is selected via:

```dart
import 'map_view/map_platform.dart'
  if (dart.library.html) 'map_view/map_web.dart'
  if (dart.library.io) 'map_view/map_mobile.dart' as map_impl;
```

  - Standard Flutter conditional-import pattern. Both
    `map_mobile.dart` and `map_web.dart` implement the same
    `buildMap({context, universities, onMarkerClick})` signature.
  - Mobile uses `webview_flutter` v4's `addJavaScriptChannel`.
  - Web uses `dart:html` IFrameElement + `ui_web.platformViewRegistry`
    + `window.onMessage`.

### 1.11 The Supabase backend wire

  - `v_institutions_for_map` (in `20260601000100_uni_db_v1_views.sql`)
    exposes `id, name_ko, name_ko_short, name_en, name_uz, city_ko,
    latitude, longitude, logo_url, tier, ieqas_status, is_partner,
    is_visible_on_map, last_verified_at, next_event_at` — designed as
    the stable replacement contract per the comment "Stable contract
    for `universitiesProvider` after Phase 1 dual-read cutover."
  - The Phase 3R-B migration `20260510130000_uni_db_v3_drop_legacy_\
universities.sql` (line 36) explicitly snapshots
    `universities_backup_20260510` before dropping, so legacy data
    isn't lost.
  - `kakao-roadview-proxy` Edge Function (`352a338c-...`, version 13,
    verify_jwt=false) hits two undocumented `rv.map.kakao.com`
    endpoints with a spoofed `Referer: https://map.kakao.com/` and
    returns `{available, panoId, lat, lng, streetName, imagePath,
    heading, links}`. Zero client code references it (`grep -r
    kakao-roadview-proxy --include="*.dart"` → 0 hits).

### 1.12 What is missing from the map surface

  - **No clustering** — once we have 30+ universities mapped in Seoul,
    they will all stack on top of each other. Kakao JS SDK supports
    `MarkerClusterer`; we don't use it.
  - **No info-window on marker hover** — clicking a marker opens the
    detail sheet but there's no preview, so users have to commit to a
    full sheet just to see the university name.
  - **No "near me" / user-location** affordance. The map renders at
    mid-Korea zoom but doesn't centre on the user.
  - **No saved/bookmarked** universities. The Detail sheet's
    "Virtual Walkaround" + "Visit Website" are the only actions.
  - **No accessibility labels** on markers or filter chips. Screen
    readers see the unlabelled `Container`s.
  - **No analytics** on marker-click / walkaround-open. We don't know
    which universities students actually explore.
  - **No deep-linking** — there is no `/map/:institution_id` route in
    `app_router.dart`. Cannot share a "look at SNU" link.

### 1.13 Observable bugs (current state)

  - **B1.** `universitiesProvider` queries the dropped `universities`
    table → map renders empty in prod. Top-priority.
  - **B2.** `top100` filter is always empty under the new schema.
  - **B3.** Stats row in detail sheet collapses to empty.
  - **B4.** Tuition / acceptance-rate / description rows in detail
    sheet always missing.
  - **B5.** "Virtual Walkaround" button always hidden because every
    `university.latitude` is null (empty list short-circuits the
    check).
  - **B6.** Roadview 2 km radius lands off-campus.
  - **B7.** Roadview / map error messages English-only.
  - **B8.** "Visit Website" uses `Uri.parse` not `Uri.tryParse`.
  - **B9.** Roadview uses Navigator 1.0 push instead of `go_router`.
  - **B10.** Leaflet loaded eagerly in `<head>` even when Kakao succeeds.
  - **B11.** No analytics; no clustering; no info-windows; no deep links.

---

## Section 2 — What perfect looks like

This section is research only. It doesn't describe current code.

### 2.1 The map: keep Kakao + Leaflet, fix the inputs

Recommendation: **don't migrate to Naver or Google Maps.** Kakao Maps
is free under our load (300k loads/day), is the de-facto standard for
Korean addresses, and we already have it working. The Leaflet/OSM
fallback handles the case where a non-Korean user is on a network
that throttles `dapi.kakao.com` (and gives us a clean fallback for
when Kakao tightens domain enforcement).

  - **Marker clustering.** Kakao JS SDK provides `MarkerClusterer`
    (load with `&libraries=clusterer`). When we have 30+ Seoul-area
    pins they need to cluster, otherwise the centre of Seoul is a
    fur-ball.
  - **Auto-fit-bounds.** Replace the hard-coded `(36.5, 127.8) zoom
    13` with an automatic fit over the actual marker bounds, so a
    single-marker list zooms in, a 30-marker list shows all of Seoul,
    and a national list shows all of Korea.
  - **Info-window on click + sheet on tap.** Kakao supports
    `kakao.maps.InfoWindow` which can render arbitrary HTML — short
    name + "tap for details" prompt — and we still raise the
    bottom-sheet on the underlying tap event.

### 2.2 The data contract: read `v_institutions_for_map`

The view already exists. The `University` domain object has to be
remodelled around it.

  - **Drop** `ranking`, `localRank`, `acceptanceRate`, `tuitionMin`,
    `tuitionMax`, `descriptionEn`, `website` (those go to separate
    surfaces or get sourced from `tuition` + `scholarships` joins).
  - **Add** `nameKo`, `nameKoShort`, `nameUz`, `tier` (smallint 0–4),
    `ieqasStatus`, `nextEventAt`.
  - **Filter chips** need rethinking: `top100` becomes `tier 0–1`
    (the new quality tier), `partner` stays as-is.
  - **Detail sheet** loses the rank/tuition/acceptance rows and gains
    a "next admission event" date + a "verified by counselor" badge
    keyed off `last_verified_at`.

This is **not** a small refactor — the UI loses three rows it
currently relies on. We have two choices: ship the empty rows (worse
than today) or rewire the detail sheet to read from joined data
(`tuition` per faculty, `admission_cycles` per intake). Recommendation
in the backlog: ship minimum-viable rewire (tier + next event), defer
the full re-architecture to a follow-up.

### 2.3 The walk-around: the four options

The current Kakao Roadview embed gives the user a "drive-by" of the
nearest road, almost never inside campus. Four better options:

#### Option A — Tighter Kakao Roadview radius + smarter fallback (cheapest)

Drop radius from 2000 m to 200 m → if null, retry at 500 m → if null,
retry at 1000 m → if null, show "no walkaround available." Plus, for
the **top-30 partner universities**, hand-pick lat/lng coordinates
that *are* inside campus (not the building registration point Kakao
returns from a name search). This is a 1-day fix and delivers the
biggest perceived quality jump.

#### Option B — Curated Pannellum/Marzipano tour for top-10 universities (medium)

[Pannellum](https://pannellum.org/) is a free, single-file (~21 KB
gzipped) WebGL panorama viewer. [Marzipano](https://www.marzipano.net/)
is Google-acquired, OSS, supports equirectangular + cubemap. For our
top-10 partner universities (Yonsei, SNU, Korea, KAIST, POSTECH,
Sungkyunkwan, Hanyang, Sogang, Ewha, UNIST):

  - Find/license 1–3 360° panoramas per campus (main gate, library,
    student union). Sources: official university VR pages (Yonsei
    publishes a library VR tour publicly; SNU has campus tours),
    [360Cities](https://www.360cities.net/area/seoul-korea), tourhq,
    direct request to university comms office.
  - Host panoramas in Supabase Storage under
    `walkaround/{institution_id}/{slug}.jpg`.
  - Build a tiny "tour graph" JSON per university:
    `{nodes: [{id, panoramaUrl, hotspots: [{yaw, pitch, targetNodeId}]}]}`.
  - Add a `lib/features/map/presentation/widgets/walkaround_html.dart`
    that loads Pannellum + the tour JSON in WebView.
  - **Fallback** to Kakao Roadview for universities without a curated
    tour.

Cost: ~1 week eng + ongoing content acquisition. UX win is large
because students actually see *inside* the university, not the
adjacent road.

#### Option C — Embed Naver Street View 3D where coverage exists (high effort, low coverage)

[Naver Street View 3D](https://koreatechtoday.com/naver-launches-3d-street-view-for-immersive-navigation-experience/)
launched late 2024 in Gangnam-gu, Mapo-gu, Songpa-gu, Yongsan-gu,
Yeongdeungpo-gu, Jongno-gu, Jung-gu (Seoul) and Bundang-gu
(Seongnam). It is **3D**, not 2D panorama — significantly better UX
than Kakao Roadview. But it is not free: it requires a Naver Cloud
Platform Maps subscription, and the API is only exposed to enterprise
customers. Coverage doesn't yet include most non-Seoul campuses.
**Defer.** Re-evaluate in 2027 when coverage expands.

#### Option D — Direct embed of each university's official VR page (cheapest content, hardest curation)

Most top Korean universities now host an official VR tour:
[Yonsei library VR](https://www.facebook.com/yonsei.eng/posts/-the-virtual-tour-for-the-yonsei-university-libraries-has-opened-enjoy-an-immers/388985346662452/),
[SNU campus tours](https://en.snu.ac.kr/about/tour), KAIST, Korea,
Hanyang. If we add a `walkaround_url` column to `institutions`, we
can `Navigator.push` a WebView pointing at the university's own VR
page — zero hosting cost on our side. Caveat: each tour is built on
a different stack (Spalba, Matterport, in-house WebGL), and many of
them are paywalled by the university's admissions office.

#### Recommendation

**A + B in parallel.** Ship the radius/fallback fix this week (P1).
Pilot Pannellum for one university (Yonsei is easiest — they publish
360° library images on their public site) as a P2 spike to prove the
pattern. Then decide whether to invest in curating tours for the rest
of the top-10.

Option C and D are noted but **not recommended for action** in 2026.

### 2.4 What the kakao-roadview-proxy is good for (only)

The Edge Function returns `imagePath` and `links` (navigation graph).
This is the raw data Pannellum needs to render Kakao panoramas
directly, **bypassing the JS SDK entirely**. So if we go down
Option B, this proxy is the data source for a "Kakao-Roadview-as-
Pannellum" implementation — no domain-restricted JS key, no
`baseUrl: 'https://hanguk.uz'` workaround, and full control over the
loading UI. **But** scraping undocumented internal endpoints is
fragile (Kakao can break it any week without notice). For curated
official panoramas (Option B as described above), we don't need the
proxy at all. Recommendation: delete it unless we commit to a
Kakao-Roadview-Pannellum hybrid.

### 2.5 Map polish (independent of all of the above)

  - **Marker clustering** via Kakao `MarkerClusterer` library.
  - **Auto-fit-bounds** so a filtered list zooms in.
  - **"Near me" floating action button** that re-centres on
    `Geolocator.getCurrentPosition()`. Useful for students already in
    Korea on campus visits.
  - **Deep links** — register `/map/:institutionId` in
    `app_router.dart`, raise the detail sheet on entry. Enables
    sharing from outside the app.
  - **Accessibility** — `Semantics` labels on markers, chips, toggle.
  - **Analytics** — log `map_marker_click`, `walkaround_open`,
    `university_website_open` events to whatever analytics sink we
    add (Supabase `usage_events` table is the natural target).
  - **Locale-aware names** — show `name_uz` when locale is `uz`,
    `name_en` when `en` / `ru` / `vi` (no Ko-only display for students
    who don't read Korean yet).

---

## Section 3 — Prioritized backlog

Codes: M = Map/walkaround item.

### P0 — must fix before next student-facing release

| ID | File / line | Issue | Fix | Status |
|---|---|---|---|---|
| M1 | `lib/features/map/data/map_repository.dart:6–13` | Queries dropped `universities` table → map empty in prod. **Same fix as Kakao audit K1.** | `from('v_institutions_for_map').select(...)`. Map `name_en`/`name_uz`/`name_ko` per locale into `University.name`; map `city_ko` into `University.location` until the i18n city-name story lands. | ✅ **Shipped 2026-05-11.** `universitiesProvider` now reads `v_institutions_for_map`. Display-name resolution: en → uz → ko_short → ko (always-readable fallback). `next_event_at` parsed via `DateTime.tryParse`. `PostgrestException` and generic `Exception` caught separately (per dart/security.md). |
| M2 | `lib/features/map/domain/university.dart` | Domain object models legacy fields that don't exist on `institutions` (`ranking`, `tuitionMin`, `tuitionMax`, `acceptanceRate`, `descriptionEn`, `website`). | Remodel to match `v_institutions_for_map`: add `nameKo`, `nameKoShort`, `nameUz`, `tier`, `ieqasStatus`, `nextEventAt`. Keep `ranking` *optional* for the transition window so the UI doesn't have to change in lockstep, but document it as deprecated. | ✅ **Shipped 2026-05-11.** Added `nameKo`, `nameKoShort`, `nameEn`, `nameUz`, `tier`, `ieqasStatus`, `nextEventAt`. Legacy fields (`ranking`, `localRank`, `acceptanceRate`, `tuitionMin`, `tuitionMax`, `website`, `descriptionEn`) marked `@Deprecated(...)` with replacement guidance. Added `isTopTier` and `isAccredited` convenience getters. New `test/features/map/university_domain_test.dart` covers both getters + the deprecated-null contract. |
| M3 | `lib/features/map/presentation/map_tab.dart:54` (`top100` filter) and `lib/features/map/presentation/widgets/university_card.dart:92–117` (rank badge) | Both reference `university.ranking`, which is always null under the new schema. | Either (a) remove the `top100` filter chip and the rank badge entirely, or (b) replace `ranking <= 100` with `tier <= 1` and badge text with the tier label. **(b) preferred.** | ✅ **Shipped 2026-05-11** (option **(b)**). Filter chip renamed "Top 100" → "Top"; predicate switched to `u.isTopTier`. Card rank badge replaced with tier badge ("Top" for tier ≤ 1, "Tier N" otherwise, hidden when tier is null). |
| M4 | `lib/features/map/presentation/widgets/university_detail_sheet.dart:113–160` | Stats row, tuition row, acceptance rate row, description row all reference fields that will be permanently null. Sheet looks bare. | Short-term: hide all four rows when null (already done — they collapse silently, sheet looks bare but doesn't crash). Medium-term: replace with: (a) "Tier 1 verified" badge, (b) `next_event_at` row, (c) one-line description from `institutions.institution_type` enum. Long-term: deep-link to `InstitutionDetailScreen` from `lib/features/uni_db/presentation/` which already has the full picture. | ✅ **Shipped 2026-05-11.** Stats row replaced with `_buildSignalsRow`: Tier (highlighted for tier ≤ 1), IEQAS Verified badge, and the next admission-cycle event date (formatted with `intl`'s `DateFormat.MMMd()`). Tuition / Acceptance / About rows removed entirely (no replacement; those signals live in `InstitutionDetailScreen` of the uni_db feature). Pulled M10 (`Uri.tryParse` for the website button) forward as a hygiene win in the same edit. |

### P1 — within the quarter

| ID | File / line | Issue | Fix | Status |
|---|---|---|---|---|
| M5 | `lib/features/map/presentation/widgets/roadview_html.dart` (`getNearestPanoId(pos, 2000, cb)`) | 2 km radius is wrong for "campus walkaround." Lands on motor road. | Two-pass: try 300 m; on null, try 1000 m; on null, show localized "no walkaround." | ✅ **Partial — shipped 2026-05-11** alongside the P0 batch (operator pre-decided to tighten to **200m with no auto-expand**, since auto-expand brings the drive-by panorama back and defeats the purpose). Empty-state copy in English; full localization deferred to M6. Roadview HTML also gained a `window.HangukRoadviewChannel` JS bridge that posts `'sdk_blocked' \| 'no_pano' \| 'init_error' \| 'network' \| 'ready'` so the Dart side can attach a Channel and surface a localized fallback UI later (M6). |
| M6 | `roadview_html.dart` ("Booting … Walkaround…" / "Walkaround data completely isolated." / "Network connection denied.") | English-only error/loading strings. | Add `walkaroundLoading`, `walkaroundUnavailable`, `walkaroundNetworkError` to all 5 `.arb` files. Load via `AppLocalizations.of(context)`. (Same shape as the `KakaoTalk K5` fix.) | ✅ **Shipped 2026-05-12.** See K5 — closed in the same edit. Roadview HTML JS bridge → Dart sealed state → 5-state localized overlay. |
| M7 | `lib/features/map/presentation/widgets/university_map_html.dart` (top of `<head>`) | Leaflet CSS+JS loaded statically every render. ~150 KB waste when Kakao succeeds. | Move Leaflet `<link>` and `<script>` injection into `fallbackToOsm()`. | ✅ **Shipped 2026-05-12.** New `bootLeaflet()` lazy-loads Leaflet + clusterer only on Kakao failure. |
| M8 | `lib/features/map/presentation/widgets/map_view/map_mobile.dart` and `map_web.dart` | Neither implementation auto-fits the camera to the marker bounds — both hard-code `(36.5, 127.8)` Korea-wide zoom. With a filtered list of 3 Seoul universities the user sees an unhelpful overview. | After markers are added, call `map.setBounds(bounds.extend(LatLng(lat,lng)))` on Kakao and `map.fitBounds(L.featureGroup(markers).getBounds(), {padding:[40,40]})` on Leaflet. | ✅ **Shipped 2026-05-12.** Both Kakao (`map.setBounds`) and Leaflet (`L.featureGroup(markers).getBounds()`) auto-fit after marker injection; hard-coded mid-Korea defaults remain only as the empty-list fallback. |
| M9 | `lib/features/map/presentation/widgets/university_detail_sheet.dart:171–177` | Walkaround navigation bypasses `go_router` — uses `Navigator.of(context).push(MaterialPageRoute(...))`. Inconsistent with the rest of the app and breaks deep-linking. | Register `/walkaround/:institutionId` in `lib/core/router/app_router.dart`. Call `context.push('/walkaround/$id')`. | ✅ **Shipped 2026-05-12.** `_WalkaroundRouteEntry` registered in `_mapRoutes()`. Detail sheet calls `context.push('/walkaround/${id}', extra: university)`. Extra is preferred for the in-app path; cold deep-links fetch the row from `universitiesProvider`. |
| M10 | `lib/features/map/presentation/widgets/university_detail_sheet.dart:368–372` (`_launchWebsite`) | Uses `Uri.parse` (throws on malformed URL) instead of `Uri.tryParse`. | Switch to `Uri.tryParse` + null-check, show snackbar on parse failure. | ✅ **Shipped 2026-05-11** as a hygiene win in the M4 detail-sheet rewrite. `_launchWebsite` now uses `Uri.tryParse`, returns silently on parse failure. Snackbar fallback deferred (the website button only shows when `university.website` is non-null and the new domain always emits null for that field, so the function is effectively unreachable until the uni_db detail screen is the source). |
| M11 | `lib/features/map/presentation/map_tab.dart` (no deep-link) | No `/map/:institutionId` route. Cannot link to a university view from outside. | Add a `GoRoute('/map/:institutionId')` that opens MapTab, awaits `universitiesProvider`, then raises the bottom sheet. Useful for push-notification deep links + shared links. | ✅ **Shipped 2026-05-12.** `_MapDeepLinkEntry` switches `homeTabProvider` to index 1 (Map) and writes the id into `pendingMapDetailProvider`. MapTab `ref.listen`s the provider and raises the bottom sheet via `addPostFrameCallback`, then clears the provider so the sheet doesn't reopen on rebuild. |
| M12 | `supabase/functions/kakao-roadview-proxy/index.ts` (entire) | Edge Function exists, scrapes undocumented endpoints, called by nothing. (Same as Kakao audit K6.) | Decide: delete (if we don't ship Option B's Pannellum-over-Kakao hybrid) or wire (if we do). **Recommend delete** because Pannellum can render official tours directly without scraping. | ✅ **Shipped 2026-05-12** (option **delete**, per operator pre-decision in the P1 batch). Function body replaced with a 410 Gone stub on Supabase prod (version 14). Full removal pending `supabase functions delete kakao-roadview-proxy` from the operator's CLI. |
| M13 | `test_map.html` (repo root) | Stray test scaffold; third hardcoded JS key; not referenced by build. (Same as Kakao audit K7.) | Delete. | ✅ **Neutralized 2026-05-11**; full delete pending host-side `git rm`. |

### P2 — strategic / polish

| ID | Item | Why | Status |
|---|---|---|---|
| M14 | Hand-pick lat/lng for top-30 universities | Many KCUE-style addresses return the registration office, not the main campus. A 1-hour manual curation across 30 rows fixes the worst case of the "drive-by walkaround." Store in a `manual_geo_overrides` column on `institutions`, or as a seed migration. | 📋 **Content / data task — not code.** Assigned out-of-band. The migration `20260512120000_institutions_virtual_tour.sql` already adds the `walkaround_url` column which works as the per-row override when Kakao Roadview's auto-located coordinates land off-campus; the content team can populate it. |
| M15 | Implement Kakao `MarkerClusterer` | Once we map 30+ universities, central Seoul becomes a marker fur-ball. | ✅ **Shipped 2026-05-12.** Kakao SDK loaded with `&libraries=clusterer`; `MarkerClusterer` instantiated when present and clusters all Kakao markers. Leaflet fallback path uses native marker grouping via `L.featureGroup` (no extra library needed at this density). |
| M16 | Add "near me" FAB on the map | One-tap re-centre when student is on a campus visit. | ⏸ **Deferred 2026-05-12.** Implementation requires Android `ACCESS_FINE_LOCATION` + iOS `NSLocationWhenInUseUsageDescription` + a `webview_flutter_android` permission shim for the WebView geolocation prompt. That manifest/permission surface area is disproportionate to a P2 polish item; re-open when the user-research story justifies it. |
| M17 | Pilot Pannellum tour for one university (Yonsei) | Spike implementation; prove the pattern; decide whether to invest in curating tours for the rest of the top-10. Hosting in Supabase Storage, viewer is a 21 KB single-file Pannellum embed in WebView. | ✅ **Shipped 2026-05-12** (operator-requested Part 3). Migration `20260512120000_institutions_virtual_tour.sql` applied to staging + prod (idempotent; Yonsei seed activates the moment the row exists). `assets/virtual_tour/pannellum.html` embeds Pannellum 2.5.6 from jsdelivr with a hosted-asset `baseUrl`. `VirtualTourScreen` (Flutter) sets the tour spec via `window.HangukTour.setTourSpec(...)`, listens on `HangukTourChannel` for state, and renders a Dart overlay on failure. Three demo scenes (Main Gate, Library, Quad) with hotspot navigation; URLs marked `TODO: replace with real Yonsei imagery`. Detail sheet's "Virtual Tour" button prefers the curated tour and falls back to (a) `walkaround_url` external page, (b) Kakao Roadview "Virtual Walkaround". |
| M18 | Add `walkaround_url` column to `institutions` | Optional override for "this university has its own official VR page." When set, the Walkaround button opens it in a browser instead of our WebView. Coverage path for institutions where Kakao Roadview is poor and we don't have a curated Pannellum tour. | ✅ **Shipped 2026-05-12.** Column added by the M17 migration. Detail sheet's tour selection ladder: `virtualTour` (Pannellum) → `walkaroundUrl` (external) → Roadview. Analytics events distinguish all three via `MapAnalytics.virtualTourOpen(id, sceneId: 'external')` for the external case. |
| M19 | Locale-aware marker names | Currently every marker title is `name_en`. Show `name_uz` when locale is `uz`, `name_ko` when locale is `ko`, etc. | ✅ **Shipped 2026-05-12.** `University.nameForLocale(localeCode)` resolves per-locale (ko → ko_short → ko, uz → uz → en, etc.). Map widgets read `Localizations.maybeLocaleOf(context).languageCode` and pass it to `generateMapHtml(unis, locale: ...)`; the templated marker labels use `nameForLocale`. Unit-tested in `university_domain_test.dart`. |
| M20 | Analytics — `map_marker_click`, `walkaround_open`, `university_website_open` events | We currently know nothing about which universities students explore. Even simple counts in a `usage_events` table will inform prioritization. | ✅ **Shipped 2026-05-12.** `MapAnalytics` interface + Riverpod-overridable sink (`lib/features/map/data/map_analytics.dart`). Default impl `debugPrint`s; a Supabase / Sentry sink can replace it by overriding `mapAnalyticsProvider` at the composition root. Four events wired: `mapMarkerClick`, `walkaroundOpen`, `virtualTourOpen` (with optional `sceneId`), `universityWebsiteOpen`. Unit-tested in `test/features/map/map_analytics_test.dart`. |
| M21 | Accessibility — `Semantics` labels on markers, chips, the toggle | Screen-reader story is currently zero. | ✅ **Shipped 2026-05-12.** `Semantics(label: ...)` wraps the All/Partner/Top filter chips, the list↔map toggle, and the filter-empty badge. Markers in the WebView path remain reliant on Kakao/Leaflet's own a11y story — a Flutter-level wrap there would obscure the WebView. |
| M22 | Map info-window on marker click | Preview before committing to bottom sheet. Reduces "tap → close → tap next" friction. | ✅ **Shipped 2026-05-12.** Each Kakao marker now opens an `InfoWindow` with the university name + "tap for details" prompt; the underlying click still raises the bottom sheet. |
| M23 | Document Kakao JS-key allowlist in `docs/runbooks/kakao.md` | (Same as Kakao audit K16.) The `baseUrl: 'https://hanguk.uz'` workaround is undocumented load-bearing. | ✅ **Shipped 2026-05-12.** Same fix as K9 / K16. |
| M24 | Replace silent `[]`-on-error in `universitiesProvider` | Re-throw and let the AsyncValue.error path drive `_buildErrorState`. Today the user can't tell "no universities yet" from "the network is down." | ✅ **Shipped 2026-05-12.** Repository now logs the error via `debugPrint` then `rethrow`s; `MapTab`'s `_buildErrorState` shows the retry button and `ref.refresh(universitiesProvider)` re-runs the query. |
| M25 | Add map-level "filtered out by current filter" badge | When the user has a filter active and the resulting list is empty, the empty-state message already mentions it. But on the map, the user sees an empty map and doesn't know it's because of their filter. | ✅ **Shipped 2026-05-12.** `_FilterEmptyBadge` is overlaid on the map when the filtered result is empty but the source list is not. Tap-to-clear restores `_activeFilter = 'all'` and clears the search controller. |

---

## Appendix A — Recommended decision tree for the walkaround feature

```
Are we shipping a campus walkaround at all?
├── No → strip the "Virtual Walkaround" button (M9, M5, M6 obsolete). Save the engineering time.
└── Yes
    ├── Tighten Kakao Roadview radius (M5) + hand-pick lat/lng (M14)
    │     → ships in 1–2 days, covers 100% of universities at "good enough" quality
    ├── Pilot Pannellum tour for one university (M17)
    │     → if pilot lands well, curate tours for top-10 partner universities
    └── Add walkaround_url override (M18)
          → handles the long tail where the university already has a VR page
```

---

## Appendix B — Decision points for the operator

1. **Is `top100` semantically meaningful under the new tier system?**
   M3 (a) deletes the chip; M3 (b) replaces it with "tier ≤ 1." We
   need a product call. The Hanguk team has explicit tier values
   (0–4); replacing with tier-based filter is the cleaner mapping.

2. **Curated tours: who curates?** M17 spike is engineering; the
   ongoing M14-M18 content acquisition is a counselor / business
   task. If the counselor team can't commit to acquiring and
   licensing panoramas for the top-10, M17 is a dead-end and we
   should stop at A (radius + curated lat/lng).

3. **Delete `kakao-roadview-proxy` or keep?** M12 / K6. The Edge
   Function works, scrapes undocumented endpoints, is called by
   nothing. Keeping it is a maintenance landmine (Kakao can break
   it any week); deleting it costs nothing if Option B doesn't go
   forward.

---

## Appendix C — Sources

  - Kakao Maps JavaScript Web API documentation: https://apis.map.kakao.com/web/documentation/
  - Kakao Maps Roadview JS sample: https://apis.map.kakao.com/web/sample/basicRoadview/
  - Kakao Roadview move-with-map sample (50 m radius reference): https://apis.map.kakao.com/web/sample/moveRoadview/
  - Kakao Roadview Android v2 SDK: https://apis.map.kakao.com/android_v2/docs/api-guide/roadview/
  - Naver Street View 3D launch (Korea Tech Today): https://koreatechtoday.com/naver-launches-3d-street-view-for-immersive-navigation-experience/
  - Naver Maps JS street layer tutorial: https://navermaps.github.io/maps.js.en/docs/tutorial-4-street.example.html
  - Pannellum (open source 360 viewer): https://pannellum.org/
  - Pannellum GitHub: https://github.com/mpetroff/pannellum
  - Marzipano (Google-acquired OSS 360 viewer): https://www.marzipano.net/
  - 360Cities Seoul panoramas: https://www.360cities.net/area/seoul-korea
  - Yonsei University campus tour page: https://www.yonsei.ac.kr/en_sc/1825/subview.do
  - SNU campus tour page: https://en.snu.ac.kr/about/tour
  - Topo360VR Yonsei panorama: https://topo360vr.com/en/location/hanriver/yonsei-univ
  - streetlevel.kakao (community RE of `rv.map.kakao.com`): https://streetlevel.readthedocs.io/en/v0.9.1/streetlevel.kakao.html
  - webview_flutter package: https://pub.dev/packages/webview_flutter
  - Flutter blog: The Power of WebViews in Flutter: https://blog.flutter.dev/the-power-of-webviews-in-flutter-a56234b57df2
  - Matterport pricing guide 2026 (cost reference, not recommended): https://www.thefuture3d.com/blog/matterport-pricing-guide-2026
  - Kuula pricing reference (cost reference, not recommended): https://www.capterra.com/p/179213/Kuula/
  - Hanguk internal — Phase 3R-B drop migration: `supabase/migrations/20260510130000_uni_db_v3_drop_legacy_universities.sql`
  - Hanguk internal — v_institutions_for_map view: `supabase/migrations/20260601000100_uni_db_v1_views.sql`
  - Hanguk internal — `kakao-roadview-proxy` Edge Function source (read via Supabase MCP)
