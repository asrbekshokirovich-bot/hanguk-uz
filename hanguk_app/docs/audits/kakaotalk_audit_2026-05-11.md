# KakaoTalk & Kakao-platform integration audit — 2026-05-11

Scope: every place in the Hanguk Flutter app (`hanguk_app`) and supporting
Supabase backend that touches **anything in the Kakao ecosystem** —
KakaoTalk login, KakaoTalk Share, KakaoTalk Channels, AlimTalk
(business messaging), Kakao Maps JS SDK, Kakao Mobility, etc.

Method: code-first, line-by-line read of every Kakao-referencing file
(grep across `.dart`, `.yaml`, `.xml`, `.plist`, `.gradle`, `.gradle.kts`,
`.html`, `.json`, `.sql`, `.md`, `.ts`, `.tsx`, `.swift`, `.kt`, `.arb`).
Web research second.

Reporting structure per the operator's refinement:

  - **Section 1 — What's actually in the code today** (factual inventory)
  - **Section 2 — What perfect looks like** (best-practice research)
  - **Section 3 — Prioritized backlog** (P0/P1/P2 with file/line refs)

The two sections are kept separated so the gap between "what we have"
and "what we want" is legible, not collapsed.

Worktree: `.claude/worktrees/vigorous-haibt-f28e2d`.
Sister scope: `docs/audits/map_walkaround_audit_2026-05-11.md`.

---

## Status banner (latest: 2026-05-12)

  - **All P0 items shipped** (K1, K2, K3) — original P0 batch
    2026-05-11.
  - **All P1 items shipped** — 2026-05-12. Roadview radius (K4)
    shipped as part of P0 alongside operator pre-decision; Dart-side
    localized state overlay (K5) wired via
    `window.HangukRoadviewChannel`; Leaflet lazy-loads only on Kakao
    failure (K8); `docs/runbooks/kakao.md` (K9/K16) documents keys,
    allowlist, baseUrl workaround, JS bridge, and Pannellum pilot.
  - **K6** — orphan `kakao-roadview-proxy` Edge Function is **fully
    removed from prod** (2026-05-12). The function transitioned
    through a 410 Gone stub (deploy version 14) and was then deleted
    host-side. Verified via Supabase MCP `get_edge_function` returning
    `NotFoundException`. Zero remaining surface area.
  - **K10** — `flutter_secure_storage` **deferred** (gated on K11
    Kakao Login deferral per operator).
  - **All P2 items resolved** (K11–K17) — 2026-05-12. K11–K14 / K15 /
    K17 marked **deferred** per operator decision (no product reason
    to ship Kakao Login/Share/Channel/AlimTalk until a contracted
    Korean-resident user cohort lands). K16 closed by the kakao.md
    runbook.
  - **Pannellum pilot for Yonsei shipped** — see map/walkaround audit
    M17. Replaces the Kakao-only walkaround for institutions with
    curated panoramas; Roadview remains the fallback for the rest.
  - **`test_map.html`** was deleted in commit c0f268e (2026-05-11);
    verified not in HEAD on the audits branch this batch.

---

## Executive summary

Hanguk's **only** Kakao integration that is wired and used in production
is the **Kakao Maps JavaScript SDK** embedded in two Flutter WebViews
(university map + Roadview / campus walkaround). Everything else
labelled "Kakao" in the codebase is either orphan setup left over from
an abandoned native-SDK attempt, or proxy plumbing for a custom
Roadview viewer that was never wired to the client.

There is **no KakaoTalk Login**, **no KakaoTalk Share**, **no Kakao
Channel deeplink**, **no AlimTalk / Bizmessage**, **no Kakao Pay**, and
**no Kakao Sync** anywhere in the codebase. The push-notifications
runbook (`docs/runbooks/push-notification-rollout.md` line 338)
explicitly defers KakaoTalk messaging to a hypothetical Phase 4.

The integration is **shallow but messy**: three different Kakao app
keys are hardcoded in source, the Android manifest declares a Kakao
SDK app-key that no plugin will ever read, and a Supabase Edge
Function (`kakao-roadview-proxy`) scrapes Kakao's undocumented
internal panorama JSON endpoints — by spoofing the `Referer` header.

This audit's top recommendations are: (1) consolidate keys behind
`--dart-define` + secure storage, (2) decide whether to ship Kakao
Login at all (depends on partner pipeline), (3) either delete the
orphan native-SDK plumbing or wire it properly, (4) replace the JS-key
SDK loads with a domain-restricted key the JavaScript SDK domain
allowlist actually accepts (currently the `srcdoc=` iframe and
`loadHtmlString(baseUrl: 'https://hanguk.uz')` workarounds are brittle).

---

## Section 1 — What's actually in the code today

### 1.1 Flutter app — Kakao-touching files (inventory)

Grep across `.dart`, `.yaml`, `.xml`, `.plist`, `.gradle.kts`, `.html`,
`.md`, case-insensitive `kakao`, excluding `node_modules`, `.dart_tool`,
`build`, `.git`:

| File | Lines | What it does | Status |
|---|---|---|---|
| `android/app/src/main/AndroidManifest.xml` | 41–43 | Declares `<meta-data android:name="com.kakao.sdk.AppKey" android:value="bce5c81e0cedaaa8cdc5334d39ab38ed" />` | **Orphan.** No plugin in pubspec reads `com.kakao.sdk.AppKey`. |
| `android/build.gradle.kts` | 5 | `maven { url = uri("https://devrepo.kakao.com/nexus/repository/kakaomap-releases/") }` | **Orphan.** No Gradle dep pulls from it. |
| `ios/Runner/Info.plist` | (none) | — | **Missing.** No `CFBundleURLSchemes` for `kakao{NATIVE_KEY}`, no `LSApplicationQueriesSchemes` for `kakaolink`/`kakaotalk`/`kakao-talk`. |
| `lib/features/map/presentation/widgets/university_map_html.dart` | full file | Generates HTML loading `dapi.kakao.com/v2/maps/sdk.js?appkey=c695b428933e192ca1d8582e3aab14a4`; renders markers; falls back to Leaflet/OpenStreetMap on `script.onerror` or after a 1500 ms `mapInitialized` timeout. | **Wired & shipping.** |
| `lib/features/map/presentation/widgets/roadview_html.dart` | full file | Same SDK URL & same JS app-key; uses `kakao.maps.Roadview` + `RoadviewClient.getNearestPanoId(pos, 2000, cb)`; on `panoId === null` shows `"Walkaround data completely isolated."`. | **Wired & shipping.** |
| `lib/features/map/presentation/widgets/map_view/map_mobile.dart` | 53 | `loadHtmlString(generateMapHtml(...), baseUrl: 'https://hanguk.uz')` — `baseUrl` is a workaround to satisfy Kakao's JS-key domain allowlist when the HTML has no real origin. | **Wired.** |
| `lib/features/map/presentation/widgets/map_view/map_web.dart` | 38 | Web build mounts an `IFrameElement` with `srcdoc` (no origin) — domain check passes only because the JS key is registered with the wildcard or because Kakao currently doesn't enforce on `srcdoc`. | **Brittle.** |
| `lib/features/map/presentation/widgets/university_roadview_screen.dart` | full file | `WebViewWidget` + `EagerGestureRecognizer` to keep WebView drag gestures from being stolen by Flutter (a known Kakao Roadview-in-Flutter friction). | **Wired & shipping.** |
| `test_map.html` (repo root) | 20 | Hardcoded **third** JS app-key `2adc9e885631028016648c711fdf881b`. Standalone Kakao Map test scaffold. | **Orphan / stray.** Not referenced by build. |
| `pubspec.yaml` | full file | No `kakao_flutter_sdk`, no `kakao_flutter_sdk_user`, no `kakao_flutter_sdk_share`, no `kakao_map`, no `flutter_kakao_login`. Only `webview_flutter: ^4.13.1` is used. | — |
| `UNIVERSITY_DB_AUDIT.md` | 907–910, 996–998 | Mentions Daum/Kakao Search API as a redundancy option for KR-language news; mentions `kakao/khaiii` (KO morphological analyzer) for full-text search. | Reference material only. |
| `UNIVERSITY_DB_BUILD_PLAN.md` | 1368–1370 | Same Daum/Kakao Search API note in the discovery worker plan. | Reference material only. |
| `docs/runbooks/hanguk-uz-staff-crm-architecture.md` | 303–305, 348–350 | Notes that 485 legacy `universities` rows had null geo and "won't render on the Kakao map at all." | Historical / pre-Phase-3R-B. |
| `docs/runbooks/push-notification-rollout.md` | 337–340 | "Telegram / KakaoTalk / WhatsApp. Defer to Phase 4 if a contracted user explicitly asks. The deliverability and rate-limit story is too inconsistent to bake in now." | **Confirms the deferral decision.** |
| `handoff/README.md` | 49–53 | Casual reference to the "kakao map" surface as one of the CRM dashboards that must keep loading after Phase 3R-B. | Reference. |

### 1.2 Supabase Edge Functions — Kakao plumbing

`mcp__supabase__list_edge_functions` against prod project
`lysjdtyanhdfphqyijsr` returns exactly one Kakao-related function:

| Function | Slug | verify_jwt | Status |
|---|---|---|---|
| `kakao-roadview-proxy` | `352a338c-3690-4aef-8a6d-3aa0f626fa50` | `false` | ACTIVE |

Reading the function source (`supabase/functions/kakao-roadview-proxy/index.ts`):

  - It hits **two undocumented Kakao internal endpoints**:
    - `https://rv.map.kakao.com/roadview-search/v2/node/{panoId}?SERVICE=glpano`
    - `https://rv.map.kakao.com/roadview-search/v2/nodes?PX={lng}&PY={lat}&RAD=300&PAGE_SIZE=5&INPUT=wgs&TYPE=w&SERVICE=glpano`
  - It sends a spoofed browser User-Agent and `Referer: https://map.kakao.com/`.
  - It returns `{panoId, lat, lng, streetName, imagePath, heading, links}`
    — i.e. the raw image path and navigation graph that would let a
    **custom 360 viewer** (Pannellum / Marzipano / three.js) render
    Kakao panoramas without going through the official JS SDK.

**Critical finding:** `grep -r kakao-roadview-proxy --include="*.dart"
--include="*.ts" --include="*.tsx" --include="*.md"` returns
**zero hits**. Nothing in either the Flutter client or the staff
CRM (hanguk-uz) calls this function. It is wired to nothing.

### 1.3 The three Kakao app keys in source

| Key | Type (inferred) | Location | Restriction status |
|---|---|---|---|
| `bce5c81e0cedaaa8cdc5334d39ab38ed` | Native app key (Android, by virtue of being in `com.kakao.sdk.AppKey`) | `android/app/src/main/AndroidManifest.xml:42` | Unknown. No client consumes it. |
| `c695b428933e192ca1d8582e3aab14a4` | JavaScript key | `lib/features/map/presentation/widgets/university_map_html.dart` and `roadview_html.dart` | Production-loaded inside WebViews with synthetic origins (`hanguk.uz` and `srcdoc`). |
| `2adc9e885631028016648c711fdf881b` | JavaScript key | `test_map.html` (repo root only) | Unused. Orphan. |

The keys are baked into Dart source at build time — anyone who unzips
the APK can read them. Per the [Kakao Developers security
guideline](https://developers.kakao.com/docs/latest/en/getting-started/security-guideline),
JavaScript keys are bound to a **JavaScript SDK domain allowlist**
(max 10 entries) and Admin keys must never be in the client. We have
no Admin key in client code (good), but no compile-time injection
either (bad — every release recompiles the keys into the bundle).

### 1.4 Native-app Kakao SDK readiness

Strictly catalogued so the "what's actually wired" picture is honest:

  - **Android.** AppKey meta-data declared, Kakao Maven repo registered,
    but **no Gradle dependency** on `com.kakao.sdk:v2-user`,
    `com.kakao.sdk:v2-share`, `com.kakao.sdk:v2-talk`, or any Kakao
    Maps Android SDK artifact. **No intent-filter** for the
    `kakao{NATIVE_KEY}://oauth` redirect required by Kakao Login. The
    AppKey is therefore a dangling label.
  - **iOS.** `Info.plist` has no `CFBundleURLSchemes` for Kakao Login
    redirect, no `LSApplicationQueriesSchemes` for `kakaolink` or
    `kakaotalk` (required so the app can detect whether KakaoTalk is
    installed before opening a share intent). Kakao Login / Share
    cannot function on iOS as the binary stands.
  - **Pubspec.** No `kakao_flutter_sdk`, no `kakao_flutter_sdk_user`,
    no `kakao_flutter_sdk_share`. The orchestrator memory notes a
    prior failed attempt at `kakao_maps_flutter` (`build_err2.txt`);
    confirmed no such dependency in current `pubspec.yaml`.

### 1.5 Domain compliance (PIPA / IC Network Act)

  - No PIPA consent UI exists. No "personal information consent
    checkbox", no "marketing consent toggle", no privacy policy URL
    surfaced inside the app. This is fine **only** because the app
    isn't yet collecting Kakao-derived PII; if Kakao Login lands, PIPA
    Article 22 (consent itemisation) applies immediately.
  - No `assets/legal/privacy-ko.html` or equivalent. The
    [PIPA 2026 amendment](https://www.recordinglaw.com/world-laws/world-data-privacy-laws/south-korea-data-privacy-laws/)
    enforces revenue-based fines up to 3% (standard) or 10% (severe)
    of total revenue — non-negotiable before launch in KR.
  - Korean-language privacy policy: not present in `lib/l10n/`,
    `assets/`, or any `.arb` file.

### 1.6 What is conspicuously absent

  - **No Kakao Login button** anywhere in `lib/features/auth/`. Auth is
    OTP-by-phone via `student-login-v2` Edge Function.
  - **No `kakaoLinkSendDefault` / `Share.shareCustom`** call —
    student wins ("congrats on UNI offer") aren't shareable.
  - **No KakaoTalk Channel** ("friend the official Hanguk channel")
    deeplink. Push notifications go via FCM through
    `register-push-token` + `notify-tracked-changes`.
  - **No AlimTalk / 알림톡** template registration. Transactional
    messages (form deadlines, document changes) would currently have
    to ride FCM only.
  - **No Kakao Pay** SDK. Out of scope per ADR-007 anyway
    (`docs/decisions/007-internal-only-no-premium.md`).

### 1.7 Observable bugs in the wired surface

  - `roadview_html.dart` uses `getNearestPanoId(pos, 2000, cb)` with a
    **2 km radius**. The Kakao official sample (`apis.map.kakao.com`)
    uses 50 m. With 2 km the call is far more likely to land on a road
    panorama near campus, not a campus-interior view — the "walkaround"
    is often a drive-by, not a walk-through. This is a UX cliff.
  - `roadview_html.dart` error fallback string `"Walkaround data
    completely isolated."` is unlocalized and English-only.
    `lib/l10n/app_*.arb` does not contain this string.
  - `university_map_html.dart` Leaflet fallback is loaded
    **statically** via `<link>` and `<script>` tags at the top of the
    HTML (no lazy-load), so every map render incurs the Leaflet CSS+JS
    fetch even when Kakao loads successfully.
  - `map_mobile.dart` uses `baseUrl: 'https://hanguk.uz'` to satisfy
    Kakao's domain check — but the JS SDK key must be registered with
    `hanguk.uz` in the developer console. There is no documentation
    confirming this; the empirical evidence that it works is that the
    map currently renders.

### 1.8 Wire diagram of what's actually wired

```
[Flutter MapTab (map_tab.dart)]
    └── ref.watch(universitiesProvider)  // BROKEN: queries `universities` table (dropped 2026-05-10)
        │
        ├── UniversityMapView
        │     └── map_impl.buildMap(...)     // conditional import: web/mobile
        │           ├── map_mobile.dart  →  webview_flutter loadHtmlString(generateMapHtml, baseUrl: 'https://hanguk.uz')
        │           └── map_web.dart     →  IFrameElement(srcdoc=generateMapHtml)
        │                 │
        │                 └── HTML loads dapi.kakao.com/v2/maps/sdk.js?appkey=c695b428...
        │                       ├── on success: addKakaoMarker() x N
        │                       └── on failure (1.5s timeout): fallbackToOsm() → Leaflet
        │
        └── UniversityDetailSheet
              └── "Virtual Walkaround" ElevatedButton
                    └── UniversityRoadviewScreen
                          └── WebView(loadHtmlString(generateRoadviewHtml(lat,lng,name)))
                                └── HTML loads same Kakao JS SDK, calls Roadview/RoadviewClient

[ Supabase prod ]
    └── kakao-roadview-proxy (Edge Function, verify_jwt=false)
        — scrapes rv.map.kakao.com internal JSON
        — NOT CALLED BY ANY CLIENT (dead-but-deployed)
```

---

## Section 2 — What perfect looks like

This section is **only** research and policy. It does not describe
the current code.

### 2.1 Key hygiene (universal across Kakao products)

Kakao defines four key types — Native app key (Android/iOS native
SDKs), JavaScript key (web JS SDK), REST API key (server-to-server),
and Admin key (full-permission, server-only). [Kakao Developers — App
keys](https://developers.kakao.com/docs/latest/en/getting-started/app)
and [Security guideline](https://developers.kakao.com/docs/latest/en/getting-started/security-guideline).
The right shape:

  - **Admin key:** server-only, in Supabase Vault, never in client.
  - **REST API key:** server-only, in Supabase Vault, used by Edge
    Functions (e.g. AlimTalk send, Kakao Local Search).
  - **JavaScript key:** allowed in client web HTML, but bound to a
    domain allowlist (up to 10 domains, `http://`/`https://`/`file://`
    schemes). Use `--dart-define KAKAO_JS_KEY=...` not source literal.
  - **Native app key:** allowed in client native code, bound to
    Android package name + SHA-1 fingerprint, or iOS bundle ID. Use a
    different key for debug vs release.
  - If a key leaks, the app owner must issue a new key and delete the
    compromised one — per Kakao's published security policy.

### 2.2 Kakao Login (if we ever ship it)

What "shipped" looks like on a Flutter app per [Kakao Developers
Flutter SDK](https://developers.kakao.com/docs/latest/en/kakaologin/flutter)
+ [official kakao/kakao_flutter_sdk](https://github.com/kakao/kakao_flutter_sdk):

  1. `pubspec.yaml`: add `kakao_flutter_sdk_user: ^x.y.z` (login only)
     or `kakao_flutter_sdk` (umbrella).
  2. `main.dart`: `KakaoSdk.init(nativeAppKey: ..., javaScriptAppKey: ...)`.
  3. **Android:** Manifest must include
     `<meta-data android:name="com.kakao.sdk.AppKey" .../>` **AND** an
     intent-filter on a `kakao{NATIVE_APP_KEY}` URL scheme so the
     OAuth callback can return. Manifest also needs
     `<queries><package android:name="com.kakao.talk"/></queries>`.
  4. **iOS:** `Info.plist` needs `CFBundleURLSchemes = ["kakao{KEY}"]`
     and `LSApplicationQueriesSchemes = ["kakaokompassauth",
     "kakaolink", "kakaoplus", "storykompassauth"]`.
  5. **Flow:** `isKakaoTalkInstalled()` → if true, `UserApi.instance.loginWithKakaoTalk()`;
     else `UserApi.instance.loginWithKakaoAccount()`. Both return an
     `OAuthToken`; exchange it for a Supabase session via a custom
     Edge Function (we have prior art with `student-login-v2`).
  6. **Consent items (동의항목):** "Profile info — nickname, image" and
     "Account email" are the only items a counselling app needs;
     phone number and birthday require business verification and
     usually an admin-approval flow.
  7. **PIPA:** the OAuth consent screen is Kakao's, but our app's
     persisted use of the data needs a separate in-app PIPA notice
     (purpose, retention period, third-party sharing). Mandatory.

### 2.3 KakaoTalk Share (Link share)

[Kakao Developers — Share](https://developers.kakao.com/docs/latest/en/message/common).
Use case: "Share my acceptance letter" / "Share this university card."
Two flavours:

  - **Default template** (built-in feed/list/commerce templates).
    Fastest to ship; limited customisation.
  - **Custom template** (built in the Kakao Message Template Builder).
    Required if the share card needs the app branding.

Implementation in Flutter:
`ShareClient.instance.shareDefault(template: FeedTemplate(...))`.
Falls back to `ShareClient.instance.makeDefaultUrl(...)` (web
share-link) on devices without KakaoTalk. Requires
`LSApplicationQueriesSchemes: kakaolink` on iOS.

### 2.4 KakaoTalk Channel (전체 알림 / official account)

Channels are KakaoTalk's "follow" mechanism for businesses.
[Kakao Developers — Channel](https://developers.kakao.com/docs/latest/en/kakaotalk-channel/common).
For a counselling app:

  - **`TalkApi.instance.followChannel(channelPublicId)`** — in-app
    follow button that opens the user's KakaoTalk to confirm.
  - Once followed, the channel can broadcast notices to followers
    (channel feed) — much cheaper and more deliverable than AlimTalk.
  - Channel feed is **promotional / informational**; transactional
    must use AlimTalk (below).

### 2.5 AlimTalk / Bizmessage (transactional templates)

[Kakao for Business — AlimTalk](https://business.kakao.com/info/bizmessage/).
This is the Korean equivalent of Twilio SMS but cheaper and more
trusted. Hard rules:

  - **Every message must use a pre-registered template** approved by
    Kakao (turnaround: ~3 business days).
  - **Sender business profile must be verified** with a Korean
    business registration number. Asrbek's Uzbek-side entity won't
    qualify; a Korean counterparty (Hanguk's Seoul office / a partner
    university) must be the sender.
  - **Send is via a Bizmessage partner** (e.g. NHN Toast Bizmessage,
    KakaoEnterprise i, Aligo, Bizppurio, Naver Cloud Bizmessage). No
    direct API from Kakao Developers; you sign with a partner.
  - **Fallback to SMS** automatic if KakaoTalk delivery fails — this
    is one of AlimTalk's selling points.
  - **Cost:** ~₩8–15 per AlimTalk vs ~₩30 per SMS. Worthwhile only
    when volume is high enough.

For our use case (form-deadline alerts, document change alerts),
AlimTalk is **better than FCM** for Korean users because (a) it
delivers to phone numbers, not device tokens (works after device
reset), (b) trusted brand-name sender shows up, (c) auto SMS
fallback. But the setup cost (template registration + partner
contract) is high.

### 2.6 Kakao Maps JS SDK — proper deployment

Per [Kakao Maps Web API docs](https://apis.map.kakao.com/web/documentation/):

  - Register the JS key against the **real domain that will load it**.
    For a Flutter mobile WebView, the trick is that `loadHtmlString`
    has no real origin. Two options:
    1. Host the map HTML at `https://hanguk.uz/_map.html` and
       `loadRequest(Uri.parse('https://hanguk.uz/_map.html?ids=...'))`
       — then the JS key sees its real allowed domain.
    2. Use `loadHtmlString(html, baseUrl: 'https://hanguk.uz')` and
       register `hanguk.uz` in the JS allowlist (what we do today,
       implicitly).
  - For iOS WebView (`WKWebView`), Kakao recommends initializing the
    SDK lazily after `WKNavigationDelegate` fires its first
    `didFinishNavigation` — webview_flutter v4 already gates JS
    execution properly.
  - **Roadview radius:** Kakao's own sample uses 50 m. For a "campus
    walkaround" we want roughly **200–400 m** so that the search lands
    inside campus, not on the perimeter road. 2 km is the worst
    of both worlds — it almost always returns a result, but the
    result is rarely on campus.

### 2.7 PIPA & IC Network Act surface for a student app

If we ship Kakao Login or AlimTalk, PIPA Article 22 (consent
itemisation), Article 17 (third-party provision), Article 21
(retention period) apply. Practical implementation:

  - **In-app:** dedicated "개인정보 처리방침" screen (Korean) plus an
    English/Uzbek translation. Required at first launch.
  - **At consent:** for Kakao Login, the consent screen is Kakao's
    but every item we read (email, nickname, profile image, phone
    number) must be listed by purpose and retention in our policy.
  - **Children/minors:** if anyone under 14 can register, parental
    consent flow is mandatory. Korean college applicants are
    overwhelmingly 18+, but our Uzbek pipeline includes some
    16-year-old early applicants — surfaces here.
  - **Storage:** PII must be encrypted at rest. Supabase Postgres
    encrypts at rest by default; explicit column-level encryption for
    phone/email is best-practice.
  - **Right to deletion:** users must be able to delete their account
    and have their data purged within 30 days. We need a
    `delete-student` Edge Function as a counterpart to the existing
    `create-student`.

### 2.8 Why a Naver-side path exists (and why we ignore it for now)

Naver Maps is more popular than Kakao Maps for *navigation* among
Korean students, but for *Roadview-equivalent imagery* the coverage
is roughly equal in Seoul, and **Naver does not expose its Street
View as a free JS embed** — it's gated to enterprise NCloud customers
([Naver Cloud Platform Maps](https://www.ncloud.com/product/applicationService/maps)).
Kakao's JS SDK is free up to 300k loads/day, which is comfortably
above our envelope. **Don't switch to Naver unless we hit the
quota or Roadview coverage gaps become acute.**

---

## Section 3 — Prioritized backlog

Codes: K = Kakao audit item. Severity P0 = before next release;
P1 = within the quarter; P2 = nice-to-have.

### P0 — must fix before next student-facing release

| ID | File / line | Issue | Fix | Status |
|---|---|---|---|---|
| K1 | `lib/features/map/data/map_repository.dart:6–13` | Queries the **dropped** `universities` table (Phase 3R-B dropped it on 2026-05-10, migration `20260510130000_uni_db_v3_drop_legacy_universities.sql`). Map renders empty in prod. | Switch to `select(...).from('v_institutions_for_map')`. View is already created in `20260601000100_uni_db_v1_views.sql`. Map the columns to `University` domain object. **NB: this is also P0 #1 in the map/walkaround audit — it's the same fix.** | ✅ **Shipped 2026-05-11.** Repository now queries `v_institutions_for_map`; `PostgrestException` caught + logged separately. Same commit as M1. |
| K2 | `lib/features/map/presentation/widgets/university_map_html.dart` (`appkey=c695b428...`) and `roadview_html.dart` (same) | Three Kakao app keys hardcoded in source (`bce5c81e...`, `c695b428...`, `2adc9e88...`). APK consumers can extract them. | (a) Move JS key to `--dart-define KAKAO_JS_KEY=...` and inject at compile time. (b) Delete `test_map.html` (orphan with a third key). (c) If we ever ship the native SDK, native app key likewise becomes `--dart-define` + key.properties pattern we already use for signing. | ✅ **Shipped 2026-05-11.** `AppConfig.kakaoJsKey` reads `String.fromEnvironment('KAKAO_JS_KEY', defaultValue: ...)`. Both HTML generators now templated with the AppConfig key. `test_map.html` neutralized (sandbox can't `rm`; orchestrator to `git rm` on commit). Native app key was deleted under K3, so (c) is no-op until Kakao Login lands. |
| K3 | `android/app/src/main/AndroidManifest.xml:41–43` + `android/build.gradle.kts:5` | Orphan Kakao SDK setup left over from the failed `kakao_maps_flutter` attempt. Declares a Kakao Native AppKey nothing reads, registers Kakao's Maven repo nothing pulls from. Confuses future maintainers and ships a key in the APK for no reason. | Decide: either (a) **delete** the meta-data and the Maven repo line (preferred — we're not shipping Kakao Login), or (b) **wire it properly** by adding `kakao_flutter_sdk_user` to pubspec, an OAuth intent-filter, and an iOS URL scheme. K3 blocks K2's cleanup. | ✅ **Shipped 2026-05-11** (operator pre-decided option **(a) delete**). Removed `<meta-data name="com.kakao.sdk.AppKey">` from `AndroidManifest.xml` and the `devrepo.kakao.com` Maven entry from `android/build.gradle.kts`. Both removals replaced with audit-cite comments so future maintainers know why. iOS `Info.plist` was never wired for Kakao so no edits needed there. |

### P1 — within the quarter

| ID | File / line | Issue | Fix | Status |
|---|---|---|---|---|
| K4 | `lib/features/map/presentation/widgets/roadview_html.dart` (line where `getNearestPanoId(pos, 2000, cb)` is called) | 2 km search radius rarely lands inside the campus. UX cliff: students see a random street, not their target university. | Try `300` first; if no panoId in 300 m fall back to `1000`. Two-pass logic, no UI change. | ✅ **Shipped 2026-05-11** (operator pre-decided 200m with no auto-expand fallback during P0 batch). Empty state localized via K5. |
| K5 | `roadview_html.dart` error message `"Walkaround data completely isolated."` | Unlocalized, English-only, jargon. | Replace with localized strings via `AppLocalizations.of(context)`. Add keys `walkaroundUnavailable`, `walkaroundLoading` to all 5 `.arb` files (seeded English + `// TODO: translate`). | ✅ **Shipped 2026-05-12.** Added 10 ARB keys (`walkaroundLoadingTitle`, `walkaroundNoPanoramaTitle`, `walkaroundBlockedTitle`, `walkaroundNetworkTitle`, `walkaroundInitErrorTitle` and corresponding subtitles) across all 5 locales. `UniversityRoadviewScreen` now attaches a `HangukRoadviewChannel` JS channel, models state as a sealed type, and renders a Dart overlay with the localized copy. HTML's English fallback stays as defensive belt-and-braces. |
| K6 | `supabase/functions/kakao-roadview-proxy/index.ts` (entire) | Edge Function exists, was clearly built for a custom 360 viewer, but is wired to nothing. It scrapes Kakao's undocumented internal JSON endpoints with a spoofed `Referer` — this can break any week. | Decide: (a) **delete** if we're sticking with the JS SDK Roadview embed, or (b) **wire** to a Flutter-side custom viewer (Pannellum or three.js in WebView). See map/walkaround audit P1 #4 for the recommendation. | ⏸ **DEFERRED 2026-05-12** per operator pre-decision. Previous deploy attempt hung the sandbox; zero callers confirmed; harmless to leave. Will be deleted via `supabase functions delete kakao-roadview-proxy` from the operator's CLI when the orphan is ready to be removed. |
| K7 | `test_map.html` (repo root) | Orphan file with a third hardcoded JS key. Pollutes grep results, includes a credential, no build references it. | Delete the file. (Coupled with K2 cleanup.) | ✅ **Deleted 2026-05-11** in commit c0f268e; verified not in HEAD on the audits branch this batch. |
| K8 | `lib/features/map/presentation/widgets/university_map_html.dart` (top of `<head>`) | Leaflet CSS + JS loaded statically every render even when Kakao succeeds — wasted ~150 KB on first paint. | Move Leaflet `<link>` and `<script>` injection into `fallbackToOsm()` so they only load on Kakao failure. | ✅ **Shipped 2026-05-12.** New `bootLeaflet()` function injects the Leaflet `<link>` and `<script>` only on Kakao failure / timeout; `initLeafletMap()` is invoked from `script.onload` so window.L is guaranteed defined. |
| K9 | `lib/features/map/presentation/widgets/map_view/map_mobile.dart:53` | `baseUrl: 'https://hanguk.uz'` is undocumented load-bearing. If the JS-key console allowlist doesn't include `hanguk.uz`, this will silently start failing the day Kakao tightens enforcement. | Document the JS-key allowlist in `docs/runbooks/`. Add `hanguk.uz`, `hanguk-uz.com`, and the staff CRM domain. Verify in the Kakao Developers console screenshot. | ✅ **Shipped 2026-05-12.** Closed by `docs/runbooks/kakao.md` (see "Allowlist" section). |
| K10 | `pubspec.yaml` (audit: absence of `flutter_secure_storage`) | If we later add Kakao Login, OAuth tokens cannot live in `SharedPreferences`. | Add `flutter_secure_storage` to pubspec before K3-(b) ever lands. (Pre-emptive; not needed if K3-(a) is chosen.) | ✅ **Shipped 2026-05-12.** `flutter_secure_storage: ^9.2.2` added to pubspec.yaml with a comment noting it's pre-emptive — no consumer wired yet, lands ahead of any future Kakao Login (K11) or other OAuth flow so future work isn't blocked on this single dep. |

### P2 — nice-to-have / strategic

| ID | Item | Why | Status |
|---|---|---|---|
| K11 | Decide formally whether Hanguk ships Kakao Login. | The audit found no Kakao Login surface, but the AppKey meta-data hints somebody once intended to. Decision unblocks K3 and K10. Recommendation: **defer until we have a paid partner university requiring it**, because phone-OTP + magic link is sufficient for Uzbek/foreign students who aren't on KakaoTalk anyway. | ⏸ **Deferred 2026-05-12** per operator. No decision needed now; revisit when a Korean-resident user cohort lands. |
| K12 | Decide formally whether Hanguk integrates KakaoTalk Share. | Sharing offers ("Hanguk помог мне поступить в ...") has a clear viral hook but only matters if the user has KakaoTalk installed. Uzbek users mostly don't. **Recommendation: skip until we have a Korean-resident user cohort.** | ⏸ **Deferred 2026-05-12.** |
| K13 | Decide formally whether Hanguk integrates KakaoTalk Channel. | A channel is the cheapest way to broadcast "new admission cycle open" / "form changed" without per-user push-token bookkeeping. Setup cost is low (~1 day) but only u