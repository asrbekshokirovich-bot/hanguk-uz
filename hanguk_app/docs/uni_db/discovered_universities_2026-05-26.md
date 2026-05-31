# Discovered Korean universities — 2026-05-26

Auto-discovery found **151 genuine admission pages across 71 universities**
(44 junk + 7 unclear were excluded). **Nothing here is live yet** — they are all
waiting in `proposed_sources` for your approval.

**Entries marked `FOREIGN` are foreign / overseas-Korean applicant pages
(재외국민·외국인) — your priority. They are listed first.** The rest are domestic
수시/정시, transfer (편입학), graduate, or results-announcement pages.

### How to approve
Tell me which universities (e.g. *"approve Yonsei, Korea, Hanyang, Inha"*) and
I'll do it for you. Or, in Supabase → SQL Editor:

```sql
update public.proposed_sources set status = 'approved'
 where url_ko = 'PASTE_URL_HERE';
```

---

## Foreign / overseas-applicant pages (재외국민·외국인) — priority

- **[cha.ac.kr]** CHA University — 2026학년도 재외국민과 외국인 특별전형 모집요강
  https://admission.cha.ac.kr/재외국민-외국인/재외국민-공지사항/?mod=document&uid=2711
- **[cju.ac.kr]** Cheongju University — 공지사항-재외국민/외국인-수시모집 (국제교류처)
  https://intl.cju.ac.kr/ipsi/selectBbsNttList.do?bbsNo=84&key=813
- **[cu.ac.kr]** Daegu Catholic University — 외국인(신·편입학) 모집요강
  https://www.cu.ac.kr/plaza/notice/notice?mode=view&mv_data=aWR4PTE0ODI4...
- **[donga.ac.kr]** Dong-A University — 수시·정시·편입학·재외국민
  https://ent.donga.ac.kr/admission/html/rolling/notice.asp
- **[dongduk.ac.kr]** Dongduk Women's University — 재외국민 > 모집요강
  https://ipsi.dongduk.ac.kr/ipsi/contents/overseas-viewer.do?gotoMenuNo=overseas-viewer
- **[dongguk.ac.kr]** Dongguk University (WISE) — 재외국민과 외국인 특별전형 안내
  https://ipsi.dongguk.ac.kr/page/3
- **[eulji.ac.kr]** Eulji University — 재외국민/외국인 > 모집요강
  https://admission.eulji.ac.kr/?menuno=7197
- **[hanyang.ac.kr]** Hanyang University (ERICA) — 재외국민 | 모집요강
  https://goerica.hanyang.ac.kr/ADMISSION/HTML/abroad/guide.asp
- **[hongik.ac.kr]** Hongik University — 재외국민 모집요강
  https://www.hongik.ac.kr/kr/admission/recruitment-foreign.do
- **[inha.ac.kr]** Inha University — 재외국민 | 모집요강
  https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160
- **[jnu.ac.kr]** Chonnam National University — 재외국민과 외국인 < 신입학
  https://admission.jnu.ac.kr/Foreigner/Viewer
- **[joongbu.ac.kr]** Joongbu University — 외국인전형 안내 | 일반대학원
  https://www.joongbu.ac.kr/menu.es?mid=a70108010100
- **[kau.ac.kr]** Korea Aerospace University — 재외국민 | 모집요강
  https://ibhak.kau.ac.kr/admission/html/abroad/guide.asp
- **[khu.ac.kr]** Kyung Hee University — 2026학년도 재외국민특별전형 모집요강
  https://iphak.khu.ac.kr/detail.do?board_seq=14335
- **[khu.ac.kr]** Kyung Hee University — 2027학년도 재외국민특별전형 시행계획(안)
  https://iphak.khu.ac.kr/detail.do?board_seq=14139
- **[kongju.ac.kr]** Kongju National University — 외국인 모집요강 (International Admission Guide)
  https://ipsi.kongju.ac.kr/kor/58/pdfViewer/CAT076
- **[kongju.ac.kr]** Kongju National University — 재외국민 모집요강
  https://ipsi.kongju.ac.kr/kor/61/pdfViewer/CAT075
- **[kookmin.ac.kr]** Kookmin University — 외국인 신·편입학 특별전형 모집요강
  https://iat.kookmin.ac.kr/admission/community/notice/576
- **[korea.ac.kr]** Korea University — 외국인 특별전형 모집요강 (PDF)
  https://oku.korea.ac.kr/attach/202108/1629946045681_0.pdf
- **[korea.ac.kr]** Korea University (Sejong) — 외국인 특별전형 모집요강
  https://oku.korea.ac.kr/sejong/cms/FR_CON/index.do?MENU_ID=480
- **[korea.ac.kr]** Korea University (Sejong) — 재외국민/새터민 모집요강
  https://oku.korea.ac.kr/sejong/cms/FR_CON/index.do?MENU_ID=440
- **[korea.ac.kr]** Korea University (Sejong) — 2026 후기(9월) 외국인특별전형 원서접수
  https://oku.korea.ac.kr/sejong/cms/FR_BBS_CON/BoardView.do?BBS_SEQ=1955
- **[kunsan.ac.kr]** Kunsan National University — 재외국민 Overseas Korean Admission
  https://www.kunsan.ac.kr/inter/index.kunsan?menuCd=DOM_000013303003000000
- **[kyonggi.ac.kr]** Kyonggi University — 재외국민 | 모집요강
  https://enter.kyonggi.ac.kr/cms/FR_CON/index.do?MENU_ID=180
- **[seoularts.ac.kr]** Seoul Institute of the Arts — 전문학사 외국인특별전형 모집요강
  https://www.seoularts.ac.kr/web/cop/bbsWeb/selectBoardList.do?bbsId=BBSMSTR_000000001497
- **[shu.ac.kr]** Sahmyook Health University — 재외국민 외국인 | 모집요강
  https://exam.shu.ac.kr/cms/FrCon/index.do?MENU_ID=130
- **[silla.ac.kr]** Silla University — 재외국민 > 수시모집
  https://ipsi.silla.ac.kr/ipsi/index.php?pCode=nationals
- **[sookmyung.ac.kr]** Sookmyung Women's University — 재외국민 | 모집요강
  https://admission.sookmyung.ac.kr/admission/html/abroad/guide.asp
- **[ssu.ac.kr]** Soongsil University — 재외국민 | 모집요강
  https://iphak.ssu.ac.kr/mojip/req.asp?flag=4&page_no=1_5_2
- **[swc.ac.kr]** Suwon Women's University — 재외국민 > 모집요강
  https://apply.swc.ac.kr/viewer/foreigner/list.do?mno=sub01_08
- **[syu.ac.kr]** Sahmyook University — 재외국민 | 모집요강
  https://ipsi.syu.ac.kr/2016_syu/pages/index.asp?p=24&mj=05
- **[wdu.ac.kr]** Wonkwang Digital University — 재외국민 및 외국인전형 | 신입학
  https://go.wdu.ac.kr/v/371
- **[wsu.ac.kr]** Woosong University — 재외국민/외국인 > 모집요강
  https://ent.wsu.ac.kr/board/index.jsp?code=foreign0201
- **[ycc.ac.kr]** Yeungjin Cyber College — 재외국민 및 외국인 모집요강
  https://www.ycc.ac.kr/ipsi/CMS/Contents/Contents.do?mCode=MN048
- **[yonsei.ac.kr]** Yonsei University (Mirae) — 재외국민 | 모집요강/서식
  https://admission.yonsei.ac.kr/mirae/admission/html/abroad/guide.asp
- **[yonsei.ac.kr]** Yonsei University (Seoul) — 재외국민 | 모집요강/서식
  https://admission.yonsei.ac.kr/seoul/admission/html/abroad/guide.asp
- **[yonsei.ac.kr]** Yonsei University — 2026 재외국민·외국인 편입학 전형 요강/서식
  https://admission.yonsei.ac.kr/seoul/admission/html/counsel/dataView.asp?BBS_NO=3379

> Korea University also has ~10 more `외국인 특별전형 모집요강` file-download links
> (same titles, different versions) under `oku.korea.ac.kr/ajaxfile/...` —
> approving any one is enough; the rest are older versions.

---

## Other admission pages (domestic 수시/정시, transfer, graduate, results)

- [acts.ac.kr] 대학원 신·편입학 안내 — https://www.acts.ac.kr/modules/board/bd_view.asp?id=grad_adm_notice&no=761
- [ansan.ac.kr] 일반편입학 모집요강 — https://iphak.ansan.ac.kr/iphak/ipsi_guideline/91
- [bhu.ac.kr] 수시모집 충원합격 발표 (Busan Health Univ) — https://ipsi.bhu.ac.kr/ipsi/boardview/2/257
- [cbnu.ac.kr] 정시모집 모집요강 (Chungbuk Nat'l) — https://ipsi.cbnu.ac.kr/kor/regular/doctrine/view.do
- [chongju.ac.kr] 추가모집-정시모집 (Cheongju Univ alt domain) — http://www.chongju.ac.kr/ipsi/selectBbsNttList.do?bbsNo=84&key=3645
- [cju.ac.kr] 모집요강 수시/정시/편입학 — https://www.cju.ac.kr/ipsi/contents.do?key=783
- [cnue.ac.kr] 정시모집요강 (Chuncheon Nat'l Univ of Education) — https://www.cnue.ac.kr/enter/jungsi/guide.do
- [daegu.ac.kr] 편입학 모집요강 (Daegu University) — https://ipsi.daegu.ac.kr/kor/27/pdfViewer/CAT075
- [donga.ac.kr] 수시모집 모집요강 — https://ent.donga.ac.kr/admission/html/rolling/guide.asp
- [dongnam.ac.kr] 편입학 모집요강 (Dongnam Health Univ) — https://www.dongnam.ac.kr/ipsi/1567/subview.do
- [dongseo.ac.kr] 모집요강 > 추가모집 (Dongseo Univ) — https://ipsi.dongseo.ac.kr/ipsi/index.php?pCode=1613634019
- [dsu.ac.kr] 편입학 모집요강 정정공고 (Dongshin Univ) — https://ipsi.dsu.ac.kr/ipsi/?pCode=notice&mode=view&idx=10722
- [duksung.ac.kr] 신·편입학 기출문제 (Duksung Women's) — https://enter.duksung.ac.kr/data/view.php?bn=5369
- [dyu.ac.kr] 추가모집요강 (Dongyang Univ) — https://ipsi.dyu.ac.kr/chuga/chuga_01/
- [ewha.ac.kr] 편입학 모집요강 (Ewha Womans Univ) — https://admission.ewha.ac.kr/admission/html/transfer/guide.asp
- [gnu.ac.kr] 모집요강 수시/정시/편입학 (Gyeongsang Nat'l) — https://www.gnu.ac.kr/new/cm/cntnts/cntntsView.do?cntntsId=2820&mi=4928
- [halla.ac.kr] 수시모집 충원합격 (Halla Univ) — https://ipsi.halla.ac.kr/community/data01.php?no=8228578
- [hanbat.ac.kr] 모집요강 수시/정시 (Hanbat Nat'l) — https://www.hanbat.ac.kr/admission/sub01_01.do
- [hansei.ac.kr] 융합치료대학원 모집요강 — https://graduate.hansei.ac.kr/graduated/2560/subview.do
- [hanseo.ac.kr] 수시모집 모집요강 (Hanseo Univ) — https://helper.hanseo.ac.kr/html/kr/sub1/sub1_0101.html
- [hanyang.ac.kr] ERICA 수시/정시 모집요강 — https://goerica.hanyang.ac.kr/ADMISSION/HTML/rolling/guide.asp
- [hongik.ac.kr] 수시/정시/편입학 모집요강 — https://www.hongik.ac.kr/kr/admission/recruitment.do
- [hycu.ac.kr] 편입학 모집요강 (Hanyang Cyber Univ) — https://go.hycu.ac.kr/user/trAdms/go/normal/index.do
- [inha.ac.kr] 편입학 | 모집요강 — https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=620
- [jejunu.ac.kr] 2026 수시 모집요강 변경공고 (Jeju Nat'l) — https://ibsi.jejunu.ac.kr/10000048?mode=view&bbs_seq=1999
- [jnu.ac.kr] 정시/약학 편입학 (Chonnam Nat'l) — https://admission.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?key=1778
- [joongbu.ac.kr] 수시/편입학 모집요강 — https://www.joongbu.ac.kr/menu.es?mid=a60101000000
- [kbsu.ac.kr] 수시모집 합격자발표 — https://www.kbsu.ac.kr/admission/info/02_04.htm
- [kduniv.ac.kr] 편입학 모집요강 (Kyungdong Univ) — https://www.kduniv.ac.kr/iphak/CMS/Contents/Contents.do?mCode=MN036
- [khu.ac.kr] 후기 신·편입학전형 모집요강 (대학원) — http://gsm.khu.ac.kr/bbs/board.php?bo_table=notice&wr_id=4075
- [kku.ac.kr] 편입학 충원합격/추가모집 (Konkuk GLOCAL) — https://enter.kku.ac.kr/notice/view.php?bn=275
- [knsu.ac.kr] 정시모집요강 (Korea Nat'l Sport Univ) — https://pe.knsu.ac.kr/ipsi/regular/jungsi.do
- [kongju.ac.kr] 수시/정시 모집요강 — https://ipsi.kongju.ac.kr/kor/56/pdfViewer/CAT006
- [konyang.ac.kr] 수시/정시/편입학 모집요강 (Konyang Univ) — https://www.konyang.ac.kr/prog/info/ipsi/sub01_01/susi/list.do
- [korea.ac.kr] 세종캠퍼스 정시모집 모집요강 — https://oku.korea.ac.kr/sejong/cms/FR_CON/index.do?MENU_ID=430
- [koreatech.ac.kr] 수시/대학원 모집요강 (KOREATECH) — https://www.koreatech.ac.kr/menu.es?mid=a40101010100
- [ks.ac.kr] 수시/정시/편입학 모집요강 (Kyungsung Univ) — https://www.ks.ac.kr/ipsi/CMS/Contents/Contents.do?mCode=MN025
- [kumoh.ac.kr] 수시모집 충원합격 (Kumoh Nat'l Inst of Tech) — https://mse.kumoh.ac.kr/ipsi/sub0601.do?articleNo=337959
- [kyonggi.ac.kr] 편입학/대학원 모집요강 — https://enter.kyonggi.ac.kr/cms/FR_CON/index.do?MENU_ID=160
- [mju.ac.kr] 계약학과 신·편입학 모집요강 (Myongji Univ) — https://iphak.mju.ac.kr/pages/?bn=29597&m=read
- [mokwon.ac.kr] 정시모집 모집요강 (Mokwon Univ) — https://enter.mokwon.ac.kr/enter/html/sub03/0301.html
- [nambu.ac.kr] 정시모집 충원합격 (Nambu Univ) — https://www.nambu.ac.kr/board/IPSI_BOARD_007/boardView.do?bdId=BD_00000000000092181
- [pusan.ac.kr] 수시모집 충원합격 (Pusan Nat'l) — https://go.pusan.ac.kr/college_2016/pages/index.asp?bn=44785&m=read
- [sangji.ac.kr] 추가모집 모집요강 (Sangji Univ) — https://www.sangji.ac.kr/go/sub09_21.do
- [semyung.ac.kr] 수시모집 모집요강 (Semyung Univ) — https://www.semyung.ac.kr/prog/info/ipsi/sub01_01/MJ01/list.do
- [seoultech.ac.kr] 대학원 신·편입학 합격자 발표 (SeoulTech) — https://www.seoultech.ac.kr/service/info/graduate/?bidx=553306
- [snjc.ac.kr] 편입학 모집요강 (Seoul Women's College of Nursing) — https://ipsi.snjc.ac.kr/public_2017/ipsi/sub/transferred/transferred_application.jsp
- [sookmyung.ac.kr] 수시/정시/편입학 모집요강 — https://admission.sookmyung.ac.kr/admission/html/rolling/guide.asp
- [suwon.ac.kr] 정시모집 충원합격 (Univ of Suwon) — https://ipsi.suwon.ac.kr/board/notice/read/3886
- [syu.ac.kr] 수시/정시 모집요강 (Sahmyook Univ) — https://ipsi.syu.ac.kr/2016_syu/pages/index.asp?mj=01&p=8
- [ulsan.ac.kr] 수시모집 충원합격 (Univ of Ulsan) — https://iphak.ulsan.ac.kr/main/25?action=view&no=15717
- [wsi.ac.kr] 수시모집 충원합격 (Woosong Info College) — https://ent.wsi.ac.kr/board/read.jsp?id=222133&code=ent0501
- [yonsei.ac.kr] 편입학 | 모집요강/서식 — https://admission.yonsei.ac.kr/seoul/admission/html/transfer/guide.asp
- [yu.ac.kr] 정시/편입학 모집요강 (Yeungnam Univ) — https://ibsi.yu.ac.kr/page/guide/guide.htm?etc1=2
