# University Admissions — Comprehensive Fixing Plan

**Date:** 2026-06-01 · **Companion to:** `docs/university-admissions-audit.md`
**Scope:** Every issue in the audit (16 systemic + all 51 universities), mapped to a concrete,
file‑level fix, phased by impact and risk.
**Status (2026‑06‑01):** *Planning only — no code/DB changes applied yet.* Decisions locked:
schools kept **with warning labels** (not hidden); Korea‑proxy **recommendation ready** — Vultr Seoul
VPS ≈ $5–6/mo + browser headers + mirror‑on‑first‑fetch (Phase 2).

---

## Guiding principles

1. **Durable, not throwaway.** Identity/source fixes go into **seed migrations + code**, not ad‑hoc
   DB pokes, so a re‑seed or a new container can't undo them. Migrations live in
   `hanguk_app/supabase/migrations/` (`YYYYMMDDHHMMSS_<desc>.sql`).
2. **Reparse ≠ re‑fetch — pick the right one.**
   - **Reparse** (`uni-db reparse`, `reparse_worker`) re‑extracts an **already‑stored PDF**. Use it
     for the `pending` backlog and for extractor/prompt fixes.
   - **Re‑fetch** (`uni-db ingest-direct` / `run-pipeline`, `direct_ingest_worker` / `fetch_worker`)
     downloads a **new/corrected URL**. **Every URL correction and stale‑doc refresh needs this** —
     reparse alone will not pick up a new link.
3. **The proxy is the keystone.** Korean `.ac.kr` PDFs 403 from non‑Korean IPs (audit §11). Until the
   fetch client has a **Korea egress**, the no‑document and stale tiers cannot be re‑fetched at all.
   So Phase 2 unblocks much of Phase 1's value.
4. **Schema already supports most of this.** `institutions.institution_type` allows
   `cyber | junior_college | specialized | education_university` (plus governance values), institutions
   are keyed by `primary_domain` (multi‑campus‑safe), and `admission_cycles` already separate
   `applicant_category` (외국인 vs 재외국민). Most "modeling" fixes are **data**, not new structure.

---

## Phase 0 — DB corrections (safe, reversible, no crawl needed)

*High impact, near‑zero risk. One migration + the app filter. Do first.*

### 0.1 Fix corrupted names + backfill English/romanization
- **What:** correct `name_ko`, set `name_en` + `display_names.en`, add `romanization` (51 missing).
  - 일반대학→**부산대학교** (pusan), 일반대학→**상지대학교** (sangji), 학년도대학→**국립군산대학교** (kunsan),
    한세대학→**한세대학교** (hansei), 항공대→**한국항공대학교 / Korea Aerospace University** (kau),
    건국대학교→**건국대학교 글로컬캠퍼스** (kku) + the ~15 missing English names.
- **How:** new migration `…_uni_db_v2_fix_institution_identity.sql` with `UPDATE … WHERE primary_domain=…`.
  Safe because `get_or_create_institution` (`direct_ingest_worker.py:71‑92`) only sets a name on
  **CREATE**, so it will never re‑overwrite a corrected existing row.
- **Effort:** S · **Risk:** very low (idempotent UPDATEs).

### 0.2 Merge the Cheongju duplicate
- **What:** `chongju.ac.kr` (legacy Wade‑Giles alias) and `cju.ac.kr` are the same school.
- **How:** repoint child rows (`announcement_sources`, `guideline_documents`, `admission_cycles`,
  `scholarships`, `university_admission_periods`, `user_tracked_universities`) from the chongju id to
  the cju id, then delete the chongju institution. **Keep Konkuk Seoul (`konkuk.ac.kr`) and GLOCAL
  (`kku.ac.kr`) — they are genuinely distinct campuses.**
- **Effort:** S · **Risk:** low (wrap in a transaction; verify child counts before delete).

### 0.3 Correct institution_type (schema already supports it)
- Hanyang Cyber (hycu) → **`cyber`**; Dongnam Health (dongnam) + Daedong → **`junior_college`**;
  ACTS (acts) → **`specialized`**. (All currently mislabeled `private` by governance.)
- **How:** same migration, `UPDATE institutions SET institution_type=… WHERE primary_domain=…`.
- **Effort:** S · **Risk:** very low.

### 0.4 Add `is_women_only` flag
- **What:** new boolean column; set `true` for Ewha, Duksung, Dongduk.
- **How:** `ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS is_women_only boolean NOT NULL DEFAULT false;`
  then UPDATE the three. (No existing column fits; this is the one genuinely new field.)
- **Effort:** S · **Risk:** very low.

### 0.5 Make the app honor type/flags — *labels, not hiding* (decided)
- **What:** in the student browser (`StudentUniversities` + detail sheet, PR #20), **keep every school
  but badge it clearly** so students aren't misled:
  - `institution_type='cyber'` → badge **"Online university — not eligible for a D‑2 student visa"**.
  - `junior_college` → badge **"Vocational college — 2–3yr associate degree (not a bachelor's)"**.
  - `specialized` → badge **"Specialized institution (theology seminary)"**.
  - `is_women_only` → badge **"Women‑only admission"** (and, where the student's gender is known,
    de‑prioritize for male students rather than hard‑hiding).
- **How:** add `institution_type, is_women_only` to the `v_institution_content_counts` view / query and
  render a badge + one‑line explainer in the card and detail sheet.
- **Effort:** M · **Risk:** low (read‑only display logic).

---

## Phase 1 — Correct the source documents (re‑fetch the right 2026 PDFs)

*Depends on Phase 2 for the 403‑blocked ones. Each item updates the source URL, then re‑ingests.*

### 1.1 Replace navigation/notice pages with the real PDF
| University | Wrong stored "doc" | Correct 2026 source |
|---|---|---|
| Korea University | `oku.korea.ac.kr` index | `oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Freshman(ENG).pdf` |
| KAIST | HTML notice board | `univapply.kaist.ac.kr` guideline PDF |
| Inha | `MENU_ID=170` index | `internationalcenter.inha.ac.kr/…/164765` (Spring) & `…/164768` (Fall) |
| Yonsei | `notice.asp` listing | `www2.yonsei.ac.kr/entrance/2026/intl/…/Fall 2026 Application Guide…(Eng).pdf` |

### 1.2 Replace wrong, department‑specific documents
| University | Wrong (department) doc | Correct university‑wide source |
|---|---|---|
| Kyung Hee | `sports.khu.ac.kr` (PE college) | `…/khu-bucket/…/2026_01_foreignerAdmission.pdf` |
| Pusan National | `ie.pusan.ac.kr` (Industrial Eng dept) | `international.pusan.ac.kr/…/download.do` |
| Chungbuk National | `software.cbnu.ac.kr` (Software college) | `ipsi.chungbuk.ac.kr/kor/international/…` + `oia.cbnu.ac.kr` |

### 1.3 Refresh stale guidelines (replace with current cycle)
Chodang (2017), Dong‑A (2020 — **and mark the 특별전형 suspended 2024–26; use the rolling
`global.donga.ac.kr` route**), Kyungsung (2022), Konkuk‑GLOCAL (2023), Hansei (2024), Hanyang
(2023 doc), Daejin (~2024 → `…/1709/329325/`), Hongik (`97369` → `~137200`), Duksung (`bn=694` →
`bn=5306`), Dong‑eui (`39089` → `76282`), Cheongju (`cts811_file.pdf` → `cts811_file250619.pdf`).

### 1.4 Fix wrong‑track / wrong‑subdomain sources (외국인 vs 재외국민)
- **Myongji** — `bn=29020` is the **재외국민** (overseas‑Korean) track → switch to the **외국인** route
  (`international.mju.ac.kr`).
- **SKKU** — stored source is the **재외국민** track → use **`admission-global.skku.edu`** (foreign‑national).
- **Dongduk** — wrong subdomain `ipsi.` → **`intl2.dongduk.ac.kr`**.
- **Kookmin / Jeonbuk / Kangwon** — stored the **domestic** board → use the international office
  (`iat.kookmin.ac.kr`, `ioffice.jbnu.ac.kr`, `oiaknu.kangwon.ac.kr`).

### 1.5 Capture the missing documents (no‑doc tier — URLs now known, needs Phase‑2 proxy)
SNU (`en.snu.ac.kr` Fall `bbsidx=164704` / Spring `155596`), SKKU (`admission-global`), Jeju
(`ibsi.jejunu.ac.kr/files/ibsi/menu/202507/…pdf`), Chung‑Ang (`oia.cau.ac.kr` `tbl=k_bbs61`),
Konkuk Seoul (`enter.konkuk.ac.kr`), Kangwon (`oiaknu`), Jeonbuk (`ioffice`).

- **How (1.1–1.5):** update `announcement_sources.url_ko` (seed migration), mark the superseded
  `guideline_documents` rows, then run **`uni-db ingest-direct` / `run-pipeline`** so the corrected
  URL is fetched into a fresh `guideline_documents` row and extracted. (For board pages,
  `direct_ingest_worker.resolve_to_pdf()` extracts the PDF link.)
- **Effort:** M (data) + the re‑ingest run · **Risk:** medium (verify each new doc parses to real
  content before publish; old rows superseded, not deleted).

---

## Phase 2 — Crawler root cause: Korea egress *(research‑backed recommendation)*

*The single highest‑leverage fix — unblocks the entire 403 tier (no‑doc + many empty parses).*

**Diagnosis (a free test settles the cost).** `.ac.kr` 403s are *mostly a plain GeoIP country block* —
**any** Korean IP, even a cheap Seoul **datacenter** VPS, passes. Only a minority are bot/ASN blocks
needing a Korean *residential/ISP* IP, and some are just missing‑header bot detection. So spend cheap‑first:

- **2.0 Free first move — headers + probe.** Add browser‑like headers to the fetch client (the worker
  already sets `Referer` per request): `User-Agent: Mozilla/5.0 …Chrome…`,
  `Accept-Language: ko-KR,ko;q=0.9`, `Referer: https://www.google.co.kr/`. Then probe one blocked PDF
  from a Seoul VPS with `curl`; a 200 ⇒ pure geo block ⇒ Step 2 suffices. Costs nothing.
- **2.1 Code wiring.** Add `http_proxy_url` to `config.py` (`:106‑113`) and pass it to the **bare**
  `httpx.AsyncClient(...)` at `cli.py:316‑320` + `:433‑437` and `attachment_downloader.py:46‑52`
  (`proxy=settings.http_proxy_url or None`); SOCKS needs `pip install httpx[socks]`.
  *(Zero‑code alternative: httpx auto‑honors `HTTPS_PROXY`/`ALL_PROXY` env vars — set them in the
  Actions job and skip the config change.)* Store the endpoint as secret `UNI_DB_HTTP_PROXY`.

**2.2 Recommended provider — cheapest‑first:**
1. **Headers only (free)** — clears the missing‑header subset.
2. **Vultr Seoul VPS ≈ $5–6/mo** (1 vCPU/1 GB, true Seoul region) as an **SSH SOCKS5 tunnel** or tinyproxy
   → fixes ~90% of `.ac.kr` (the geo‑block majority), ~30 min to stand up. *(Free alt: Oracle Cloud Seoul
   Always‑Free ARM = $0, but Seoul capacity is often exhausted — only if you can wait.)*
3. **Fallback — Korean *datacenter* proxy** (Webshare KR ≈ $0.029/IP): Korean ASN, cheap, passes simple geo+ASN checks.
4. **Last resort (Cloudflare‑backed sites) — Korean *ISP/residential*** (Oxylabs ISP ≈ $2.10/IP·mo, IPRoyal ≈ $7/GB). Few KR universities need this.

| Option | ~Cost | Type | Reliability for .ac.kr | Setup |
|---|---|---|---|---|
| Browser headers only | $0 | — | clears header‑gated subset | trivial |
| **Vultr Seoul VPS + SSH SOCKS5** | **$5–6/mo** | KR datacenter | High (geo‑block bypass) | low |
| Oracle Cloud Seoul Always‑Free | $0 | KR datacenter | High *if provisioned* | medium (capacity) |
| AWS ap‑northeast‑2 t4g.nano | ~$4/mo | KR datacenter | High | low |
| Webshare KR datacenter proxies | ~$5–15/mo | KR DC proxy | Medium‑High | very low |
| Oxylabs ISP / IPRoyal residential | ~$2.10/IP·mo / ~$7/GB | KR residential | Highest | very low |

**2.3 Architecture — mirror once, then drop the proxy dependency.** The pipeline **already stores every
fetched PDF as a blob** (`storage/supabase_storage.store_blob`) and `reparse` re‑reads stored blobs
offline. So the proxy is needed **only at first fetch**: run discovery+fetch through the KR egress once
(or per new cycle), the PDFs mirror to Supabase Storage, and all downstream extraction/reparse needs no
proxy. Add a `HEAD`/`ETag`/`Last‑Modified` check to re‑fetch only when a guideline actually changes.

**2.4 Legal/ops.** Public admission guides are Korean government works (Copyright Act Art. 7) → low‑risk
to fetch/mirror for informational use; honor `robots.txt`; avoid PII pages (admission *results*).
GitHub‑hosted runners use US Azure IPs (always non‑KR), so the tunnel is required in CI.

- **Effort:** S (headers + wiring) + ~30 min ops (VPS) · **Risk:** low.
  **Recommendation: headers + a $5–6/mo Vultr Seoul VPS via SSH SOCKS5, mirror PDFs on first fetch.**

---

## Phase 3 — Pipeline correctness (extraction / publish / modeling)

### 3.1 De‑dup `documents_required` (fixes 30+ over‑counts)
- **Where:** `publish_worker.py:364‑380` (`_publish_documents`) inserts every payload row with **no**
  `ON CONFLICT` (unlike `university_admission_periods` at `:400`).
- **Fix:** add a unique index on `(cycle_id, document_type, applicant_category)` + `ON CONFLICT DO
  NOTHING`, or `DISTINCT ON` before insert. Then re‑publish.
- **Effort:** S · **Risk:** low.

### 3.2 Harden institution‑name extraction (prevent future corruption)
- **Where:** `direct_ingest_worker.py:63‑68` `korean_name_from_title()` — regex
  `[가-힣]{2,}(?:대학교|대학|대)` matches generic phrases ("일반대학", "…학년도대학").
- **Fix:** reject a known stop‑list of generic tokens, prefer a **canonical domain→name map**
  (new `discovery/canonical_institutions.py`, seeded from the audit) before falling back to the regex;
  keep auto‑created rows `is_visible_on_map=false` until verified (already the case, `:86`).
- **Effort:** M · **Risk:** low.

### 3.3 In‑page HTML guidelines (Kyungwoon, Mokwon)
- **Where:** `extract_orchestrator.py:48‑75` is **PDF‑only** (PyMuPDF). In‑page HTML guidelines never
  reach extraction.
- **Fix (choose):** (a) add a BeautifulSoup/lxml HTML→text path for the handful of in‑page schools, or
  (b) mark them `needs_attention` for manual entry. Recommend (b) short‑term, (a) if more schools need it.
- **Effort:** M (a) / S (b) · **Risk:** low.

### 3.4 Model multi‑campus where admission differs
- **What:** Hanyang (Seoul/ERICA), Dongguk (Seoul/WISE — our doc is **WISE**), Yonsei (Seoul/Wonju),
  Hongik (Seoul/Sejong), Kyonggi (Suwon/Seoul), Kangwon (Chuncheon/Samcheok).
- **How:** institutions are keyed by `primary_domain`; create a per‑campus institution where the
  campus has its own admissions domain/quota, link each campus's source, and group them in the app by a
  shared parent name. (Konkuk already correctly modeled this way.)
- **Effort:** M · **Risk:** medium (UX grouping + avoid double‑counting).

### 3.5 Model rolling / multi‑round / two‑intake admissions
- **What:** CAU (4×/yr), Hansei/Dong‑eui/Dongduk (rounds), most schools (전기/후기). `admission_cycles`
  already has `round_number` + `intake_term`; ensure the extractor populates them and the app shows the
  **next open** round rather than one annual cycle.
- **Effort:** M · **Risk:** low‑medium.

---

## Phase 4 — Tuition & ongoing freshness

- **4.1 Tuition source.** Guidelines usually omit tuition, but **national universities list it**
  (GNU ≈ ₩1.6–2.2M/yr). Wire the already‑scaffolded `upstream/data_go_kr.py` / `adiga.py` to populate
  `tuition`, and extract national‑uni guideline tuition tables. **Effort:** L · **Risk:** medium.
- **4.2 Staleness detection.** Flag any `guideline_documents` whose detected cycle‑year < current as
  `needs_attention` so stale docs surface automatically (complements the pending‑drain already shipped).
  **Effort:** S.
- **4.3 Seasonal re‑fetch.** Ensure the 6‑h cron re‑fetches each source each new cycle (registry cadence
  already seasonal, `registry.py:71‑86`); add cycle‑aware re‑fetch so new‑year guidelines replace old.
  **Effort:** S–M.

---

## Per‑university coverage (all 51 → primary action)

> Grouped by the dominant fix so every institution is explicitly accounted for. Most also inherit the
> Phase‑2 proxy and Phase‑3 dedup.

- **Name/identity (P0):** Pusan, Sangji, Kunsan, Korea Aerospace, Hansei, Konkuk‑GLOCAL (+ ~15 English‑name backfills across the list).
- **Merge (P0):** Cheongju (chongju→cju).
- **Type/flag (P0):** Hanyang Cyber→cyber; Dongnam, Daedong→junior_college; ACTS→specialized; Ewha, Duksung, Dongduk→women‑only.
- **Nav‑page→PDF (P1):** Korea University, KAIST, Inha, Yonsei.
- **Wrong‑department doc (P1):** Kyung Hee, Pusan, Chungbuk.
- **Stale refresh (P1):** Chodang, Dong‑A, Kyungsung, Konkuk‑GLOCAL, Hansei, Hanyang, Daejin, Hongik, Duksung, Dong‑eui, Cheongju.
- **Wrong track/subdomain (P1):** Myongji, SKKU, Dongduk, Kookmin, Jeonbuk, Kangwon.
- **No‑doc capture (P1, needs P2 proxy):** SNU, SKKU, Chung‑Ang, Konkuk‑Seoul, Kookmin, Jeju, Jeonbuk, Kangwon.
- **Multi‑campus split (P3):** Hanyang, Dongguk, Yonsei, Hongik, Kyonggi, Kangwon.
- **In‑page HTML (P3):** Kyungwoon, Mokwon.
- **Pending reparse (already fixed in PR #20 — needs a run):** Dongguk, Hongik, Kyonggi, Chungbuk, Daejin, Daedong, Kyungwoon, Kunsan, Sangji, Hansei, Mokwon.
- **Verify‑then‑keep (current doc already 2026):** Ewha (add EN PDF), Hanseo, Kumoh, Korea Sport, Konyang, Myongji, Halla, Hanbat, GNU, Daegu Catholic, ACTS.
- **Tuition (P4) applies to all national universities:** SNU, Pusan, Chungbuk, Kangwon, Jeju, Jeonbuk, GNU, Kunsan, Hanbat, Kumoh, Korea Aerospace, Korea Sport, KAIST.

---

## Recommended sequence

1. **Phase 0** (migration + app filter) — ship immediately; safe, visible student‑safety win.
2. **Phase 3.1** (documents_required dedup) — cheap correctness fix; re‑publish.
3. **Phase 2** (proxy code + secret) — unblock the crawler.
4. **Phase 1** (re‑fetch corrected/missing/stale sources **through the proxy**) — the bulk content win.
5. **Phase 3.2–3.5** (name hardening, HTML, multi‑campus, rounds) — robustness.
6. **Phase 4** (tuition + freshness) — completeness.

**Per‑phase verification:** unit tests for code changes; for each re‑fetched university, confirm the new
`guideline_documents` row parses to non‑empty content and spot‑check 2–3 facts against the audit before
the publish step flips it live.

---

## Open decisions

1. ✅ **Vocational/cyber/seminary/women‑only** — *keep with a warning label* (decided 2026‑06‑01); baked into 0.5.
2. ✅ **Execution scope** — *planning only for now* (decided 2026‑06‑01); nothing applied yet.
3. ✅ **Korea proxy** (Phase 2): *recommendation made* — browser headers + a **$5–6/mo Vultr Seoul VPS (SSH SOCKS5)**, mirror PDFs on first fetch; residential proxy only as a per‑site fallback. **Needs your go‑ahead + the `UNI_DB_HTTP_PROXY` secret.**
4. **Multi‑campus** (Phase 3.4): split into separate per‑campus records now, or annotate one record per university for v1? — **still open.**
