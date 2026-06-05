# Phase 1 — re-fetch the correct 2026 documents (turnkey plan)

Runs once the `UNI_DB_HTTP_PROXY` secret is set (see `docs/runbooks/korea-proxy-setup.md`).
Targets are the verified 2026 URLs from `docs/university-admissions-audit.md`.

## Execution order
0. **Confirm the proxy** — trigger one `uni-db-sync` run (or a curl through the proxy) and check a
   `.ac.kr` PDF returns 200.
1. **Drain usable pending blobs (no proxy needed):** `uni-db reparse --pending-only --limit 25` —
   re-extracts documents already stored (Phase 0 pipeline fix).
2. **Re-fetch the corrected/missing/stale sources (needs proxy)** — for each target below: set it as
   the institution's source and run `uni-db ingest-direct` (board pages are auto-resolved to their
   PDF), then confirm the new `guideline_documents` row parses to **non-empty** content before publish.
3. **Publish:** `uni-db publish --limit 1000`.
4. **Verify + set links:** for each institution whose fetch succeeded, set `primary_admissions_url_ko`
   to the now-verified official page.

## A. Direct-PDF targets (highest confidence — fetch these first)
| University | domain | 2026 target URL |
|---|---|---|
| Inha | inha.ac.kr | internationalcenter.inha.ac.kr/bbs/internationalcenter/2491/164765/download.do (Spring) + …/164768/download.do (Fall) |
| Yonsei | yonsei.ac.kr | www2.yonsei.ac.kr/entrance/2026/intl/2026_9_docu/Fall 2026 Application Guide for International Students(Eng).pdf |
| Korea Univ | korea.ac.kr | oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Freshman(KOR).pdf |
| Kyung Hee | khu.ac.kr | kr.object.gov-ncloudstorage.com/khu-bucket/homepage/upload/notice/2026_01_foreignerAdmission.pdf |
| Hanyang | hanyang.ac.kr | oia.hanyang.ac.kr/files/attach/filebox/2026/01/22/84577760f898a555afede08054809e43.pdf (Seoul Fall) |
| Kyungsung | ks.ac.kr | kscms.ks.ac.kr/attach/EDITOR/FILE/2025/9/XKSAERZhmp9MevrZLDMi.pdf |
| Cheongju | cju.ac.kr | www.cju.ac.kr/DATA/download/ipsi/cts811_file250619.pdf |
| Hansei | hansei.ac.kr | hsiec.hansei.ac.kr/upload_rb/AX_1112656110.pdf |
| Jeju | jejunu.ac.kr | ibsi.jejunu.ac.kr/files/ibsi/menu/202507/1dc5fa4c2ff42313de7c8458a40dae28.pdf |
| Kunsan | kunsan.ac.kr | www.kunsan.ac.kr/board/download.kunsan?boardId=CNT_ATCHDOWN&dataSid=1361608&fileSid=169852 |
| Sangji | sangji.ac.kr | www.sangji.ac.kr/thumbnail/pdf/CMS_202508290136329541.pdf |
| Konkuk (Seoul) | konkuk.ac.kr | enter.konkuk.ac.kr/file/pdfDown.pdf?sfn=20250623103756937_5656.pdf |
| Jeonbuk | jbnu.ac.kr | ioffice.jbnu.ac.kr/sites/ioffice/file/2-2 Korean.pdf |
| Daejin | daejin.ac.kr | www.daejin.ac.kr/bbs/abroad/1709/329325/download.do |
| Pusan | pusan.ac.kr | international.pusan.ac.kr/international/2622/964787/download.do |
| SKKU | skku.edu | admission-global.skku.edu/bbs/filedown.php?bbsid=global_notice_re_eng&file_seq=11046 |
| Ewha (add EN) | ewha.ac.kr | isa.ewha.ac.kr/sites/oisa/file/ag_english.pdf |
| Kumoh (refresh) | kumoh.ac.kr | eng.kumoh.ac.kr/iplec/sub060201.do?mode=download&articleNo=535700&attachNo=157212 |

## B. Board pages (resolver extracts the PDF — medium confidence)
| University | domain | 2026 board/landing |
|---|---|---|
| Chungbuk | cbnu.ac.kr | ipsi.chungbuk.ac.kr/kor/international/doctrine/view.do  *(replaces software-college doc)* |
| Duksung | duksung.ac.kr | enter.duksung.ac.kr/notice/view.php?bn=5306 |
| Hongik | hongik.ac.kr | www.hongik.ac.kr/kr/admission/recruitment-is.do |
| Dong-eui | deu.ac.kr | deuhome.deu.ac.kr/exchange/sub06_01_03.do?mode=view&articleNo=76282 |
| Kookmin | kookmin.ac.kr | iat.kookmin.ac.kr/images/admission/program/department_en.pdf |
| Kangwon | kangwon.ac.kr | oiaknu.kangwon.ac.kr/oiaknu/index.do |
| SNU | snu.ac.kr | en.snu.ac.kr/admission/overview/notice?md=v&bbsidx=164704 |
| Chung-Ang | cau.ac.kr | oia.cau.ac.kr/bbs/board.php?tbl=k_bbs61 |
| Myongji (외국인 track) | mju.ac.kr | international.mju.ac.kr/foreign_application/application.php?sMenu=kor41 |
| Konkuk GLOCAL | kku.ac.kr | enter.kku.ac.kr/notice/?m_type=JEOEGUK |
| Kyonggi | kyonggi.ac.kr | www.kyonggi.ac.kr/international_kgu/contents.do?key=7538 |
| Dongduk | dongduk.ac.kr | intl2.dongduk.ac.kr/page/page23 |
| Dong-A (rolling) | donga.ac.kr | global.donga.ac.kr/global/CMS/Contents/Contents.do?mCode=MN036  *(special track suspended 24–26)* |
| KAIST | kaist.ac.kr | admission.kaist.ac.kr/intl-undergraduate/notice  *(may still time out from cloud; retry)* |

## C. Manual / in-page HTML (do separately — Phase 3.3 or hand-entry)
- **Chodang** (cdu.ac.kr) — no current foreign PDF indexed; retrieve from admission.cdu.ac.kr manually.
- **Kyungwoon** (ikw.ac.kr), **Mokwon** (mokwon.ac.kr) — guideline served as in-page HTML (no PDF);
  needs the Phase 3.3 HTML path or hand-entry.

## D. Reparse / keep (already current 2026 — just drain or leave)
Hanseo, Konyang, Halla, Hanbat, Gyeongsang (GNU), Daegu Catholic (cu), ACTS, Korea Sport (knsu),
Gimcheon, Kyungdong (kduniv — its stored URL is an index page; refetch if the drain yields nothing),
Daedong (vocational; low priority).

> Confidence is per the audit; every fetched doc is checked for non-empty content before publish, and
> the official link is only set after the fetch confirms the page resolves.
