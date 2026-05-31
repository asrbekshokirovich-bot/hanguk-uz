# University onboarding worklist — beyond the first 12

_Date: 2026-05-24. Companion to the
[full-sync plan](./full_sync_and_automation_plan.md). Goal: extend coverage
from the 12 wired-up universities to the next tier that international (esp.
Central Asian / Uzbek) undergraduates actually apply to._

## Already wired up (12)

Seoul/Gyeonggi majors: SNU, KAIST, Korea, Yonsei, Sungkyunkwan, Hanyang,
Konkuk, Inha. Regional nationals: Chungbuk, Jeonbuk, Kangwon, Jeju.
(Each has an adapter in `services/uni_db/src/uni_db/discovery/adapters/configs/`.)

## The master list vs. reality

`korea_universities_master_list.md` lists **320+** institutions — the whole
sector (4-year + junior colleges + cyber + seminaries + military academies),
explicitly a *candidate* list to reconcile against the official registry
(data.go.kr 대학정보 / 대학알리미). It is **not** a seed list. The
student-relevant target is the subset that recruits international undergrads.

## What onboarding ONE university requires

Adding a university is not a config dump — each needs its website "taught" to
the system, the same way the first 12 were built (see the `_probe_*` scripts):

1. Its **international-admissions notice board URL** (`announcement_sources.url_ko`).
2. A small **adapter** tuned to that page — HTML list selectors
   (`configs/<uni>.py`), or a JSON-API/Playwright variant for JS-heavy sites.
3. A **PDF resolver** if posts link to a detail page rather than a direct PDF.
4. An **institution row** + a **live `announcement_sources` row** in the DB.

Steps 1–3 require *looking at the live site* — which needs network access to
the `*.ac.kr` domains (this dev environment is blocked from them, per the
master-list note). So adapters can't be mass-generated blind; guessed
selectors yield 0 rows.

## Priority batch (recommended next ~20)

Ranked by international-undergrad demand. `[JS?]` flags sites likely to need a
Playwright adapter (heavier).

### Tier 1 — Seoul private, high demand
1. 가천대학교 — Gachon University — Seongnam/Incheon  *(very high Uzbek/CIS intake)*
2. 경희대학교 — Kyung Hee University — Seoul/Yongin
3. 중앙대학교 — Chung-Ang University — Seoul
4. 세종대학교 — Sejong University — Seoul
5. 동국대학교 — Dongguk University — Seoul
6. 한국외국어대학교 — Hankuk University of Foreign Studies (HUFS) — Seoul
7. 서강대학교 — Sogang University — Seoul
8. 이화여자대학교 — Ewha Womans University — Seoul
9. 국민대학교 — Kookmin University — Seoul
10. 숭실대학교 — Soongsil University — Seoul
11. 홍익대학교 — Hongik University — Seoul

### Tier 2 — Gyeonggi / Incheon
12. 아주대학교 — Ajou University — Suwon
13. 단국대학교 — Dankook University — Yongin/Cheonan
14. 경기대학교 — Kyonggi University — Suwon
15. 인천대학교 — Incheon National University — Incheon

### Tier 3 — flagship regional nationals
16. 부산대학교 — Pusan National University — Busan
17. 경북대학교 — Kyungpook National University — Daegu
18. 전남대학교 — Chonnam National University — Gwangju
19. 충남대학교 — Chungnam National University — Daejeon
20. 서울시립대학교 — University of Seoul — Seoul (municipal)

## How to actually build them (pick a path)

- **A. Live-access pass (most reliable).** On a machine that can reach
  `*.ac.kr` (or the GitHub Actions runner, which can), run a probe per
  university to capture its notice-board structure, then commit a
  `configs/<uni>.py`. This is how the 12 were built. Fastest route to
  *correct* adapters.
- **B. Automated discovery (most scalable).** Set `NAVER_SEARCH_CLIENT_ID/SECRET`
  (and `DATA_GO_KR_APP_KEY` for the institution registry) and let the
  discovery layer's source-proposal find each university's board — less
  per-site hand-coding, broader reach.
- **C. Best-effort from research.** Draft `configs/<uni>.py` from public-web
  research of each admissions page; expect a verification pass (some will be
  JS-only and yield 0 rows until upgraded to a Playwright adapter).

Recommended: **A or B**. Seed the 20 institution rows first (so they can show
as "coming soon" in the app), then wire adapters in priority order.

## Path A is now wired up — the probe workflow

`.github/workflows/uni-db-probe.yml` + `scripts/probe_site.py` do the
live-site inspection on the GitHub runner (real Chrome, bypasses the bot-
filters/JS that block the dev sandbox). Loop per university:

1. **GitHub → Actions → uni-db probe → Run workflow** → paste the
   university's notice-board URL → Run.
2. Open the finished run; the log prints the board's row structure + a
   ready-to-paste `HtmlListSelectors(...)` snippet (and uploads the rendered
   HTML as a `probe-html` artifact for deeper looks).
3. Paste that output back here; it becomes `configs/<uni>.py` + a registry
   entry + a `live` source row.
4. The next `uni-db sync` run fetches that university's guides.

Candidate URLs gathered so far (verify on first probe):
- Gachon: `https://admission.gachon.ac.kr/admission/html/abroad/guide.asp`
  (admission site, JS) and `http://oia.gachon.ac.kr/international/a/m/foreignNoticeList.do`
  (intl-office egov board). Gachon bot-filters plain fetches → needs the
  real-browser probe.
- Kyung Hee / Chung-Ang: find each university's 외국인/재외국민 admission
  notice board, then probe it.
