-- Universitetlar katalogi: "HANGUK — Ro'yxatdan chiqariladiganlar 1–360" (07.10.2026)
-- bo'yicha yopilgan, birlashgan, D-2 bermaydigan, chet ellik qabul qilmaydigan,
-- faqat diniy va moliyaviy/viza xavfi bor oliygohlar katalogdan yashiriladi.
-- Qatorlar o'chirilmaydi: is_active = true qilib qaytarish mumkin.
--
-- Ro'yxatdan farqi:
--   #23 동원대학교 (115) — bazada ikkita haqiqiy kollej (tw.ac.kr va dist.ac.kr — 동원과학기술대, 양산), qoldirildi.
--   #87 서영대학교 — 17 ta ariza va yuklangan Excel bor, "Qaror sizniki" — egasi hal qiladi, qoldirildi.
--   #24 수도국제대학원대학교 — "bittasini qoldiring": joriy nom (수도국제) qoladi, eski nom 국제신학대학원대학교 yashiriladi.
--
-- "Faqat bakalavr / faqat magistratura" yozuvlarida universitet qoladi,
-- faqat o'sha daraja katalogda ko'rinmaydi (institutions.hidden_levels).

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS hidden_levels text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.institutions.hidden_levels IS
  'Katalogda shu universitetda ko''rsatilmaydigan darajalar (bakalavr, magistratura, kasbiy)';

UPDATE public.institutions AS i
SET is_active = false, inactive_reason = v.reason
FROM (VALUES
  ('계약신학대학원대학교', 'kyeyak.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #1: Yopilgan — 2023-03-01 da yopilgan (폐교). Domenlari o''chgan; 한국사학진흥재단 폐교대학 diplom xizmati 02.05.2023 dan. ⚠️ Hozir ishlayotgan «계약신학연구원» (kyeyak.co.kr) — universitet emas, D-2 bera olmaydi'),
  ('광양보건대학교', 'gyhu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #2: Yopilgan — 31.08.2026 da yopilgan — 학교법인 sud orqali bankrot deb e''lon qilingan (19.06.2026), talabalar boshqa kollejlarga o''tkazilgan; 01.09.2026 dan 폐교대학 reyestrida'),
  ('동부산대학교', 'dpc.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #3: Yopilgan — 31.08.2020 da Ta''lim vazirligi buyrug''i bilan yopilgan (moliyaviy qoidabuzarlik); dpc.ac.kr domeni o''chgan'),
  ('벽성대학교', 'bs.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #4: Yopilgan — 2012-yilgi 폐쇄명령 → 28.02.2014 da yopilgan'),
  ('부산예술대학교', 'busanarts.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #5: Yopilgan — Ta''lim vazirligi 29.09.2026 da yopishni tasdiqladi — 28.02.2027 da yopiladi (+ 비자정밀심사 va 학자금 전부제한)'),
  ('성심외국어대학', 'sungsim.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #6: Yopilgan — 2002–2003 da 영산대ga qo''shilib yopilgan'),
  ('한국국제대학교', 'iuk.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #7: Yopilgan — 31.08.2023 da yopilgan'),
  ('한려대학교', 'hanlyo.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #8: Yopilgan — 28.02.2022 da yopilgan (폐교대학 xizmati 01.03.2022 dan)'),
  ('한중대학교', 'hanjung.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #9: Yopilgan — 2018-yilda yopilgan'),
  ('경남도립거창대학', 'gc.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #10: Birlashgan — eski nom — 01.03.2026 dan 국립창원대학교 tarkibida (거창캠퍼스). 창원대 2027 외국인 요강i faqat 창원캠퍼스 fakultetlarini qamraydi'),
  ('경남도립남해대학', 'namhae.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #11: Birlashgan — eski nom — 01.03.2026 dan 국립창원대학교 tarkibida (남해캠퍼스). Kampus darajasida chet ellik qabuli topilmadi'),
  ('경북도립대학교', 'gpc.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #12: Birlashgan — eski nom — 2025-03 dan 국립경국대학교 예천캠퍼스 (경국대 ro''yxatda alohida bor)'),
  ('부산교육대학교', 'bnue.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #13: Birlashgan — eski nom — 2027.03 dan 부산대 연제캠퍼스 bo''ladi; bundan tashqari 학부da faqat 농어촌/장애인/저소득층 정원외 — chet elliklar treki yo''q'),
  ('상지영서대학교', 'sy.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #14: Birlashgan — eski nom — 2020.03 da 상지대 bilan birlashgan'),
  ('서라벌대학교', 'sorabol.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #15: Birlashgan — eski nom — 2024.03 da 경주대 bilan → 신경주대 (u ham pastda — xavf)'),
  ('서울보건대학교', 'shjc.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #16: Birlashgan — eski nom — Hozir 을지대 성남캠퍼스'),
  ('적십자간호대학교', 'crc.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #17: Birlashgan — eski nom — 2011-yilda 중앙대 bilan birlashgan (중앙대 간호 — chet elliklar ro''yxatida yo''q)'),
  ('전남도립대학교', 'dorip.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #18: Birlashgan — eski nom — 2026.03 dan 국립목포대 담양캠퍼스'),
  ('탐라대학교', 'tnu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #19: Birlashgan — eski nom — 2012-yilda 제주국제대 bilan birlashgan (제주국제대 — pastda, xavf)'),
  ('한국복지대학교', 'knuw.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #20: Birlashgan — eski nom — 한경대 bilan birlashib 한경국립대 bo''lgan (308-raqam)'),
  ('광양대학교', 'gwangyang-c.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #21: Takror / topilmadi — Bunday universitet yo''q — 광양보건대ning 1998–2001 yillardagi eski nomi (46-raqam dublikati), u ham yopilgan'),
  ('국제사이버대학교', 'icu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #22: Takror / topilmadi — 58-raqam bilan bir xil (u ham kiber — pastda)'),
  ('국제사이버대학교', 'gjcu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #22: Takror / topilmadi — 58-raqam bilan bir xil (u ham kiber — pastda)'),
  ('국제신학대학원대학교', 'kits.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #24: Takror / topilmadi — = sobiq 국제신학대학원대 (51–60 partiyada ham bor) — bittasini qoldiring'),
  ('영동대학교', 'youngdong.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #25: Takror / topilmadi — = 유원대학교 (nomi o''zgargan, 유원대 ro''yxatda bor)'),
  ('예일신학대학원대학교', 'yaeil.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #26: Takror / topilmadi — = 예명대학원대학교 (nomi o''zgargan, ro''yxatda bor)'),
  ('정인대학교', 'jeongin.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #27: Takror / topilmadi — Bunday nomli muassasa topilmadi — to''g''ri nomini yuboring, bo''lmasa o''chiring'),
  ('청심신학대학원대학교', 'csgst.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #28: Takror / topilmadi — 2016-yildan 선학UP대학원대 — 171–200 partiyada bor'),
  ('한국침례신학대학교', 'kbtus2.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #29: Takror / topilmadi — 300 침례신학대학교 bilan bir xil maktab'),
  ('경희사이버대학교', 'khcu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #30: D-2 viza yo''q — Kiber-universitet (원격대학) — MOJ qoidasi bo''yicha D-2 talaba vizasi berilmaydi'),
  ('고려사이버대학교', 'cuk.edu', 'Ro''yxat 1–360 (07.10.2026) #31: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('국제사이버대학교', 'icu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #32: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('국제사이버대학교', 'gjcu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #32: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('글로벌사이버대학교', 'global.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #33: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('대구사이버대학교', 'dcu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #34: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('디지털서울문화예술대학교', 'scau.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #35: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('부산디지털대학교', 'bdu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #36: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('사이버한국외국어대학교', 'cufs.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #37: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('서울디지털대학교', 'sdu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #38: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('서울사이버대학교', 'iscu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #39: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('세계사이버대학교', 'world.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #40: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('세종사이버대학교', 'sjcu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #41: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('숭실사이버대학교', 'kcu.ac', 'Ro''yxat 1–360 (07.10.2026) #42: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('영남사이버대학교', 'yncu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #43: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('영진사이버대학', 'ycc.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #44: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('원광디지털대학교', 'wdu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #45: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('한국방송통신대학교', 'knou.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #46: D-2 viza yo''q — Masofaviy (방송대학) — D-2 berilmaydi'),
  ('한국복지사이버대학', 'kwcc.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #47: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('한국열린사이버대학교', 'ocu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #48: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('한국폴리텍I 서울', 'kopo.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #49: D-2 viza yo''q — 2022-yilgi MOJ 사증발급 지침 「야간대학, 원격대학 … 및 한국폴리텍대학 」ni D-2 dan chiqargan. ⚠️ Joriy (2026) 지침 matni tasdiqlanmadi; 2026-05 da 폴리텍 성남 공주대 bilan chet ellik talabalar bo''yicha MOU imzolagan — telefon bilan aniqlang'),
  ('한국폴리텍대학', 'kopo.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #50: D-2 viza yo''q — Yuqoridagi bilan bir xil sabab (MOJ 2022 지침); joriy holat telefon bilan tasdiqlansin'),
  ('한양사이버대학교', 'hycu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #51: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('화신사이버대학교', 'hscu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #52: D-2 viza yo''q — Kiber-universitet — D-2 berilmaydi'),
  ('경북과학대학교', 'kbsu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #53: Chet ellik qabuli yo''q — Menyuda faqat 수시/정시/자율/편입/전공심화 — 외국인전형 yo''q; 대학원 yo''q. Sayt hozir ochilmadi'),
  ('광주보건대학교', 'ghu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #55: Chet ellik qabuli yo''q — Qabul saytida (수시/정시/편입/전공심화) va 국제처 mikrosaytida chet ellik qabuli yo''q; 2027 요강 yo''q; 대학원 yo''q. ⚠️ 2026-02 da 한국어학당 ochdi va «학위과정 연계» deydi — kelajakda ochishi mumkin'),
  ('군산간호대학교', 'ksn.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #56: Chet ellik qabuli yo''q — 2027 수시 1·2차 요강ida faqat 일반, 지역고교, 특성화고, 간호조무사 + 정원외 전문대졸/기회균형/만학도 — 외국인 전형 yo''q ; 대학원 yo''q'),
  ('농협대학교', 'nonghyup.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #57: Chet ellik qabuli yo''q — Chet elliklar treki topilmadi (asosan 농협/농어촌 talabalari); sayt ochilmadi; 대학원 yo''q'),
  ('대동대학교', 'daedong.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #58: Chet ellik qabuli yo''q — 2027 수시1·2차, 정시 sahifalarida faqat 독자, 전문대졸, 만학도, 농어촌 — 외국인 ham, 재외국민 ham yo''q; 국제교류센터 faqat chiqib ketuvchi; 대학원 yo''q. PDF ichi o''qilmadi'),
  ('대구교육대학교', 'dnue.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #59: Chet ellik qabuli yo''q — Saytda 외국인/재외국민/정원외 bo''limi yo''q; hujjatlar faqat rasm-flipbook — ichi o''qilmaydi. 053-620-1299 ga qo''ng''iroq bilan tasdiqlang'),
  ('백제예술대학교', 'paekche.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #60: Chet ellik qabuli yo''q — O''z materiallarida chet elliklar degree qabuli topilmadi; sayt ochilmadi; 대학원 yo''q'),
  ('백석예술대학교', 'bau.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #61: Chet ellik qabuli yo''q — 전공대학 (평생교육법) — 고등교육법 universiteti emas, D-2 taklif qila olishi tasdiqlanmagan; sayt menyusida faqat ichki qabul'),
  ('연암공과대학교', 'yonam.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #63: Chet ellik qabuli yo''q — O''z 2027 수시 요강ida (PDF) chet elliklar treki yo''q — faqat «외국 소재 고교 출신» 일반고 ichida (koreyslar uchun); 대학원 yo''q'),
  ('정화예술대학교', 'jeonghwa.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #64: Chet ellik qabuli yo''q — 전공대학 (평생교육법) — D-2 ehtimol berilmaydi; xalqaro qabul menyusi yo''q; 대학원 yo''q'),
  ('광주가톨릭대학교', 'gjcatholic.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #68: Faqat diniy — Faqat 신학과 (45 o''rin): katolik ruhoniylikka nomzod + yepiskop tavsiyasi + suvga cho''mganiga 3 yil — barcha 전형da; 외국인 전형 yo''q'),
  ('대전가톨릭대학교', 'dcatholic.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #69: Faqat diniy — Faqat 신학과 (40 o''rin) — ruhoniylikka nomzod + 본당 신부 tavsiyasi; hujjatlarda 외국인 so''zi umuman yo''q'),
  ('대전신학대학교', 'djtu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #70: Faqat diniy — Faqat 신학과 (10 o''rin) — 「개신교 세례 + 담임목사 추천」 shart; 3 ta magistratura ham butunlay ilohiyot'),
  ('부산장신대학교', 'bpu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #71: Faqat diniy — 순수외국인 faqat 신학과 + 목회자평가서; 대학원da 외국인 전형 yo''q, 신대원 — 노회장/담임목사 tavsiyasi'),
  ('수원가톨릭대학교', 'suwoncatholic.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #74: Faqat diniy — Faqat ruhoniylik seminariyasi + 비자정밀심사 ro''yxatida'),
  ('아신대학교', 'acts.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #75: Faqat diniy — Barcha 학부 va 6 ta 대학원 dasturiga — suvga cho''mgan, cherkovga qatnaydigan nasroniy + pastor tavsiyasi'),
  ('원불교대학원대학교', 'wbgs.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #76: Faqat diniy — 원불교 교무 tayyorlash — 육영기관 tavsiyasi talab; chet elliklar treki yo''q'),
  ('인천가톨릭대학교', 'iccu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #77: Faqat diniy — Chet elliklar faqat 신학과ga (ruhoniylikka nomzod, 3 yillik cho''mdirish, yepiskop tavsiyasi); 조형예술대학ga chet ellik yo''li yo''q'),
  ('장로회신학대학교', 'puts.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #78: Faqat diniy — Faqat cherkov yo''nalishlari (신학, 기독교교육, 교회음악)'),
  ('중앙승가대학교', 'sangha.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #79: Faqat diniy — Faqat buddist rohiblar + 비자정밀심사 ro''yxatida'),
  ('총신대학교', 'chongshin.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #80: Faqat diniy — Barcha yo''nalishlarga suvga cho''mgan nasroniy + pastor tavsiyasi'),
  ('침례신학대학교', 'kbtus.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #81: Faqat diniy — Faqat ilohiyot/cherkov yo''nalishlari + 2027 학자금 지원 전부 제한'),
  ('한일장신대학교', 'hanil.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #82: Faqat diniy — Ilohiyot maktabi + 2027 학자금 지원 전부 제한'),
  ('합동신학대학원대학교', 'hapdong.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #83: Faqat diniy — Faqat ilohiyot, cherkov tavsiyasi + 비자정밀심사 ro''yxatida; bakalavr yo''q'),
  ('고구려대학교', 'koguryeo.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #84: Moliyaviy / viza xavfi — 2027 학자금 지원 전부 제한 (eng og''ir toifa) + 인증 yo''q + 2012-yildan surunkali sanksiya; yopilgan 광양보건 talabalarini qabul qilmoqda'),
  ('대구예술대학교', 'dgau.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #85: Moliyaviy / viza xavfi — 2027 학자금 전부 제한 (기관평가인증 yo''q); 7 yil ketma-ket 부실대학; 2025 yangi talaba to''ldirish 6% (300 dan 18); 1.76 mlrd won zarar'),
  ('부산경상대학교', 'bsks.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #86: Moliyaviy / viza xavfi — 비자정밀심사 ro''yxatida (학위과정) — D-2 berish qattiq tekshiriladi; saytlar yopiq'),
  ('송호대학교', 'songho.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #88: Moliyaviy / viza xavfi — 2027 학자금 전부 제한; sayt ochilmadi'),
  ('신경주대학교', 'gju.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #89: Moliyaviy / viza xavfi — 2027 학자금 전부 제한 + 인증 yo''q + 2026 boshida ~300 bangladeshlik talabaga viza berilmagan (세계일보). 2027-1 요강 chiqqan bo''lsa ham'),
  ('신경대학교', 'sgu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #90: Moliyaviy / viza xavfi — 2022 dan nomi 화성의과학대; 2027 학자금 전부 제한'),
  ('여주대학교', 'yit.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #91: Moliyaviy / viza xavfi — 2027 학자금 전부 제한; xalqaro doska bo''sh'),
  ('웅지세무대학교', 'woongji.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #92: Moliyaviy / viza xavfi — 2027 학자금 전부 제한. ⚠️ 2027.03 입시안내 chiqqan (TOPIK 2)'),
  ('예원예술대학교', 'yewon.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #93: Moliyaviy / viza xavfi — 2027 학자금 전부 제한 + 인증 yo''q. ⚠️ 2027.03 학부+대학원 요강 chiqqan'),
  ('제주국제대학교', 'jeju.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #94: Moliyaviy / viza xavfi — 2027 학자금 전부 제한; sayt TLS xatosi'),
  ('한국상담대학원대학교', 'kcgu.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #95: Moliyaviy / viza xavfi — 비자정밀심사 ro''yxatida; bakalavr yo''q'),
  ('한영대학교', 'hanyeong.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #96: Moliyaviy / viza xavfi — 비자정밀심사 ro''yxatida — D-2 olish qiyin; 대학원 yo''q'),
  ('협성대학교', 'uhs.ac.kr', 'Ro''yxat 1–360 (07.10.2026) #97: Moliyaviy / viza xavfi — 비자정밀심사 ro''yxatida. 2027 요강 hali yo''q; o''zbeklar uchun bank faqat KDB')
) AS v(name_ko, domain, reason)
WHERE i.name_ko = v.name_ko AND i.primary_domain = v.domain AND i.is_active;

UPDATE public.institutions AS i
SET hidden_levels = array(SELECT DISTINCT unnest(i.hidden_levels || ARRAY[v.level]))
FROM (VALUES
  ('경인교육대학교', 'ginue.ac.kr', 'bakalavr'),
  ('서울교육대학교', 'snue.ac.kr', 'bakalavr'),
  ('청주교육대학교', 'cje.ac.kr', 'bakalavr'),
  ('춘천교육대학교', 'cnue.ac.kr', 'bakalavr'),
  ('한국에너지공과대학교', 'kentech.ac.kr', 'bakalavr'),
  ('서울기독대학교', 'scu.ac.kr', 'magistratura'),
  ('서울장신대학교', 'sjs.ac.kr', 'magistratura')
) AS v(name_ko, domain, level)
WHERE i.name_ko = v.name_ko AND i.primary_domain = v.domain;
