# Universitetlar katalogi

CRM'dagi **Asosiy → Universitetlar** bo'limi (`/crm/universities`). Xodim
Janubiy Koreyadagi 400+ oliygohni katalog ko'rinishida ko'radi, kerakligini
qidiruvdan topadi va ustiga bosib qabul haqidagi hamma ma'lumotni oladi.

Ma'lumot ikki manbadan yig'iladi:

| Manba | Nimani beradi |
| --- | --- |
| `public.institutions` (uni_db) | Universitetlar ro'yxati: koreyscha va inglizcha nom, shahar, domen, hamkorlik bayrog'i |
| Guideline Excel fayli | Qabul tafsilotlari: muddatlar, fakultetlar, kontrakt narxi, til talablari, hujjatlar |

Excel yuklanmagan universitet ham katalogda turadi — kartasida "Excel
yuklanmagan" deb yoziladi.

## Kartada nima ko'rinadi

- Nomi ingliz va koreys tilida
- Shahri
- Qabul: yil · semestr · daraja
- TOPIK / IELTS / TOEFL talabi
- Grant: kirishdagi TOPIK / IELTS grantining foizlar oralig'i ("Grant: 30–100%")
- Kontrakt narxi oralig'i (eng arzon–eng qimmat fakultet) va davri
- Fakultetlar soni

Universitet ustiga bosilganda o'ng tomondan panel ochiladi: **Umumiy**,
**Grantlar**, **Muddatlar**, **Fakultetlar** (EN + 한국어, qidiruv va track
filtri bilan), **Hujjatlar**.

## Grantlar

2027 qabul guideline'larining stipendiya bo'limlari o'qib chiqilgan va ikki
marta tekshirilgan (2026-10-20): qaysi TOPIK / IELTS (TOEFL, TEPS, til kursi
...) darajasiga necha foiz grant beriladi. Har bir daraja — alohida qator:
talab, grant (foiz yoki summa va nimadan — kontrakt, kirish to'lovi ...),
muddati, davom etish sharti, guideline sahifasi va asl matn.

**Grantlar** yorlig'ida: tepada xulosa, keyin **Kirishda** (kimlar uchun —
yangi qabul, transfer, Korean / English track — bo'yicha guruhlangan) va
**O'qish davomida** grantlari, tilga bog'liq bo'lmagan boshqa grantlar, izoh
va manba.

Grant holati (`grant_holat`):

| Qiymat | Ma'nosi | Kartada |
| --- | --- | --- |
| `kirishda` | Kirishda TOPIK / IELTS darajasiga qarab grant bor | Grant: 30–100% |
| `oqish_davomida` | Til granti faqat o'qish davomida | Grant: o'qish davomida |
| `aniq_emas` | Tilga oid grant bor, lekin TOPIK / IELTS jadvali yo'q | Grant bor |
| `tilga_bogliq_emas` | Grantlar bor, lekin tilga bog'liq emas | Grant bor |
| `malumot_yoq` | Guideline'da grant haqida ma'lumot yo'q | — |

Kartadagi oraliqqa faqat kontraktdan foizlar kiradi; kontraktning bir qismiga
(수업료1/2) tegishli yoki qat'iy summali darajalar kirmaydi — bitta foiz
qolsa "100% gacha" deb yoziladi. Saralash panelidagi **Granti borlar** va
**Granti kattasi birinchi** ham shu ma'lumotga qaraydi (tanlangan daraja
bo'yicha).

Ma'lumot `supabase/data/university_grants_2027.json` faylida. Yangilash:
faylni o'zgartirib push qilish, keyin Supabase SQL editor'da
`supabase/data/load_university_grants.sql` skriptini qadamma-qadam ishlatish
(fayl GitHub'dan `net.http_get` bilan olinadi, fayldagi guideline'larning eski
qoidalari bitta tranzaksiyada almashtiriladi).

### Excel'dan grantlar (shablon v4)

v4 shablonda 5-varaq — `grantlar`: har bir daraja / ball alohida qator
(`mezon_turi` = topik, ielts, toefl_ibt, gpa, hammaga ...; `mezon_min` /
`mezon_max`; `grant_foiz` yoki `grant_summa` + `grant_valyuta`). Sayt varaqni
tekshiradi (`src/lib/universityGuidelineGrants.ts`), qatorlarni yuqoridagi
jadval shakliga keltiradi va xulosani (`grant_holat`, foizlar oralig'i)
hisoblaydi:

- `topik` / `ielts` / `toefl_ibt` → mezon `TOPIK` / `IELTS` / `TOEFL`, ball
  `topik_min`/`topik_max`, `ielts_min`, `toefl_ibt_min` ustunlariga — ilova
  (`app_grant_tiers`) grantni shundan hisoblaydi;
- qolgan mezonlar (GPA, TOEIC, CEFR, hammaga ...) → `boshqa`; GPA — o'qish
  davomida;
- kartadagi foizlar oralig'iga va ilovaga faqat kontraktdan foizlar kiradi
  (`nimaga` = kontrakt, kontrakt_va_kirish yoki bo'sh) — kirish to'lovi,
  yotoqxona, naqd stipendiya kirmaydi;
- grantlar varag'i bor faylda guideline'ning grantlari **to'liq
  almashtiriladi**. v2/v3 faylda (varaq yo'q) grantlarga tegilmaydi — qo'lda
  yuklangan grantlar saqlanadi.

## Darajalar

Bo'lim tepasidagi filtr: **Barcha darajalar · Bakalavr · Magistr · Kasbiy
ta'lim · Til kursi**. Har bir daraja Excel'i alohida yuklanadi va panelda
alohida yorliqda turadi.

| Daraja | `daraja` (Excel) | Filtrda qaysi universitetlar |
| --- | --- | --- |
| Bakalavr | `bakalavr` | 4 yillik universitetlar |
| Magistr | `magistratura` | 4 yillik universitetlar va 대학원대학교 |
| Kasbiy ta'lim | `kasbiy` | kollejlar (전문대학) |
| Til kursi | `til_kursi` | til kursi (어학당) Excel'i yuklanganlar (har bir xodimga bir xil) |

Ro'yxat bo'yicha yashirilgan daraja (`institutions.hidden_levels`, masalan
교육대학교 bakalavri) katalogda ko'rinmaydi. Lekin o'sha darajaga Excel
yuklansa — daraja bor deb ko'rinadi (Excel isbot). Excel yuklay oladigan xodim
yashirilgan darajaning yorlig'ini **yashirilgan** belgisi bilan ko'radi:
ro'yxat xato bo'lsa (서울장신대 magistraturasi, 2026-10-21), Excel'ni shu
yerdan yuklaydi.

Qaysi universitetda til kursi borligi oldindan ma'lum emas, shuning uchun
"Til kursi" filtri — til kursi Excel'i yuklangan universitetlar, har bir
xodimga bir xil: xodimlar til kursi bor universitetlarni shu bilan ajratadi
(egasi, 2026-10-28). Excel yuklay oladigan xodimga panelda "Til kursi"
yorlig'i hamma universitetda ochiq: ro'yxatda yo'q universitetga birinchi
faylni "Barcha darajalar"dan ochib, shu yorliqdan yuklaydi (filtr ostida shu
haqida yozuv bor). Qolganlar til kursini Excel yuklangandan keyin ko'radi.

Til kursi Excel'i shu shablonda to'ldiriladi:

- `semestr` — termi: `bahor` (mart), `yoz` (iyun, 여름학기), `kuz`
  (sentabr), `qish` (dekabr, 겨울학기). `yoz` va `qish` faqat til kursiga
  ruxsat etiladi. Har bir term — alohida fayl.
- `fakultetlar` varag'iga kurslar yoziladi (masalan, Regular Korean Language
  Program), narxi — `kontrakt_summa`, davri — `term`. Panelda bu yorliq
  **Kurslar** deb ataladi.

"Barcha darajalar"da kartada universitetning o'qish darajasi (bakalavr,
magistr, kasbiy ta'lim) ma'lumoti ko'rinadi; til kursi faqat boshqa Excel
bo'lmasa ko'rsatiladi — uning narxi term uchun, saralashni buzmasin.

## Excel shabloni

Bitta fayl = bitta qabul (`guideline_id`). Ya'ni 2027-bahor bakalavr va
2027-kuz magistratura — ikki alohida fayl.

Shablon: [`public/templates/universitet-guideline-shablon.xlsx`](../public/templates/universitet-guideline-shablon.xlsx).

Fayl ichida 6 ta varaq bor, sayt shundan 5 tasini o'qiydi:

| Varaq | Nima yoziladi | Qatorlar |
| --- | --- | --- |
| `universitet` | Universitet va qabulning umumiy ma'lumoti | doim 1 ta |
| `muddatlar` | Har bir bosqich uchun 11 ta etap (online ariza → vizaga hujjat topshirish) | bosqich × 11 |
| `fakultetlar` | Fakultet nomi (EN + KR), track, til talabi, kontrakt | har bir fakultet |
| `hujjatlar` | Talab qilinadigan hujjatlar cheklisti | har bir hujjat |
| `grantlar` | TOPIK / IELTS / ... darajasiga qarab grantlar | har bir daraja |
| `qollanma` | Ustunlar ta'rifi va ruxsat etilgan qiymatlar — **faqat odam uchun**, sayt o'qimaydi | — |

Asosiy qoidalar (to'lig'i `qollanma` varag'ida):

- 1-qator — ustun nomlari, ma'lumot 2-qatordan. Birlashtirilgan katak bo'lmasin.
- `muddatlar`: har bir bosqichda 11 ta etap, nomlari `qollanma`dagidek.
- **Bo'sh katak** = guideline'da ko'rsatilmagan. **`yoq`** = guideline'da aniq
  "yo'q" deb yozilgan. Bu ikkisi bir xil emas.
- Sanalar — matn, `YYYY-MM-DD`. Vaqt — matn, `HH:MM`, Koreya vaqti (KST).
- Pul va til ballari — faqat raqam; valyuta alohida ustunda.
- `univ_kod` — rasmiy domenning birinchi qismi kichik harflarda
  (`jbnu.ac.kr` → `jbnu`). Fayl shu kod orqali universitetga bog'lanadi.
- Fayl nomi: `guideline_id.xlsx`.

Sayt **faqat shu shablonni (v4)** qabul qiladi (egasi, 2026-10-29):

- 5 ta varaq — `universitet`, `muddatlar`, `fakultetlar`, `hujjatlar`,
  `grantlar` — hammasi bo'lishi shart. `qollanma` bo'lmasa ham bo'ladi,
  boshqa varaq bo'lmasin.
- Har bir varaqda ustunlar shablondagidek: nomi ham, tartibi ham. Ortiqcha,
  yetishmaydigan yoki nomi o'zgargan ustun bo'lsa fayl o'qilmaydi.
- `format_versiya` = `4`. Eski (v2/v3) fayllar qabul qilinmaydi — ma'lumotni
  yangi shablonga ko'chirib yuklash kerak. Bazadagi eski yuklamalar o'z
  joyida qoladi.

Fayl shablonga mos kelmasa, yuklash oynasida xato bilan birga **"Shablonni
yuklab olish"** havolasi chiqadi. `grantlar` varag'i bo'sh bo'lsa, bazadagi
grantlar o'zgarmaydi. Guideline'da grant yo'q bo'lsa, bitta qator yoziladi:
`grant_nomi` = "Guideline'da yo'q.".

Format o'zgarsa `format_versiya` oshiriladi, sayt kodi va shablon birga
yangilanadi.

## Yuklash

Excel universitet panelidan yuklanadi: daraja yorlig'ini tanlab, **"Excel
bakalavr / magistr / kasbiy ta'lim / til kursi yuklash"** tugmasini bosiladi.
Fayl aynan o'sha universitetga yoziladi. Fayldagi `daraja` bosilgan tugmaga
mos kelishi shart — masalan, til kursi yorlig'idan bakalavr fayli yuklanmaydi.

Yuklashdan oldin fayl brauzerda tekshiriladi. Xato bo'lsa import boshlanmaydi
va oyna qaysi varaqning qaysi qatorida nima xato ekanini ko'rsatadi, masalan:

```
universitet 2-qator, semestr: "yanvar" — ruxsat etilgan qiymatlar: bahor, yoz, kuz, qish
fakultetlar 14-qator, kontrakt_summa: "tekin" — raqam emas
```

Fayl to'g'ri bo'lsa hammasi bitta tranzaksiyada yoziladi: yarim import bo'lishi
mumkin emas. Bir xil `guideline_id` bilan qayta yuklansa — eski ma'lumot
butunlay almashtiriladi.

## Bazadagi jadvallar

Migratsiya: `supabase/migrations/20260921090000_university_catalog.sql`
(keyin: `..._university_guidelines_kasbiy.sql` — `kasbiy` darajasi,
`..._university_guidelines_til_kursi.sql` — `yoz` va `qish` semestrlari,
`..._university_guideline_grants.sql` — grantlar)

```
university_guidelines            -- universitet varag'i (+ katalog uchun xulosa, grant_* ustunlari)
  university_guideline_rounds    -- muddatlar
  university_guideline_faculties -- fakultetlar
  university_guideline_docs      -- hujjatlar
  university_guideline_grants    -- TOPIK / IELTS grantlari (har bir daraja — qator)
```

Katalog kartasi uchun kerak bo'lgan `kontrakt_min`, `kontrakt_max`,
`kontrakt_davri` va `fakultet_soni` import paytida hisoblanib
`university_guidelines` qatoriga yoziladi — shuning uchun ro'yxat ikkita
yengil so'rov bilan ochiladi, fakultetlar faqat universitet ochilganda
tortiladi.

**Ruxsatlar (RLS):**

| Kim | Katalogni ko'radi | Excel yuklaydi |
| --- | --- | --- |
| `owner`, `admin` | ha | ha |
| `document_handler` | ha | ha |
| `call_operator`, `university_staff` | ha | yo'q |
| `investor` | yo'q | yo'q |

O'qish `is_non_investor_staff()`, yozish `can_edit_university_catalog()`
funksiyasi orqali hal qilinadi — yozish qoidasi o'zgarsa, faqat o'sha
funksiyani tahrirlash kifoya, katalog jadvallarining yozish siyosatlari va RPC
uni ishlatadi. Import
`import_university_guideline(payload)` RPC'si orqali ketadi va rolni o'zi ham
tekshiradi. Yangi funksiyalar `anon` rolidan yopilgan — tizimga kirmagan
foydalanuvchi ularni chaqira olmaydi.

Interfeysda ham shu qoida: yuklash va "Universitet qo'shish" tugmalari
`useUserRole().isDocumentHandler` ostida (u admin'ni ham qamraydi).

## Kod

| Fayl | Vazifasi |
| --- | --- |
| `src/lib/xlsxReader.ts` | jszip ustida minimal .xlsx o'quvchi (katak matnlari) |
| `src/lib/universityGuidelineExcel.ts` | Shablon qoidalari, tekshirish, RPC uchun JSON |
| `src/lib/universityGuidelineGrants.ts` | grantlar varag'i: tekshirish, jadval shakli, xulosa |
| `src/hooks/useUniversityCatalog.ts` | Katalog, detal, import va universitet qo'shish |
| `src/components/crm/pages/UniversityCatalogContent.tsx` | Bo'limning o'zi |
| `src/components/crm/pages/university-catalog/` | Karta, detal paneli, formatlash, grantlar (`grants.ts`) |

> `/crm/admin/institutions` — bu boshqa sahifa: uni_db bazasini boshqarish
> (hamkor/xarita bayroqlari, guideline PDF yuklash). Xodimlar ishlatadigan
> katalog — shu hujjatdagi bo'lim.
