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
- Kontrakt narxi oralig'i (eng arzon–eng qimmat fakultet) va davri
- Fakultetlar soni

Universitet ustiga bosilganda o'ng tomondan panel ochiladi: **Umumiy**,
**Muddatlar**, **Fakultetlar** (EN + 한국어, qidiruv va track filtri bilan),
**Hujjatlar**.

## Excel shabloni

Bitta fayl = bitta qabul (`guideline_id`). Ya'ni 2027-bahor bakalavr va
2027-kuz magistratura — ikki alohida fayl.

Shablonni yuklab olish: bo'limdagi **Shablon** tugmasi yoki
[`public/templates/universitet-guideline-shablon.xlsx`](../public/templates/universitet-guideline-shablon.xlsx).

Fayl ichida 5 ta varaq bor, sayt shundan 4 tasini o'qiydi:

| Varaq | Nima yoziladi | Qatorlar |
| --- | --- | --- |
| `universitet` | Universitet va qabulning umumiy ma'lumoti | doim 1 ta |
| `muddatlar` | Har bir bosqich uchun 11 ta etap (online ariza → vizaga hujjat topshirish) | bosqich × 11 |
| `fakultetlar` | Fakultet nomi (EN + KR), track, til talabi, kontrakt | har bir fakultet |
| `hujjatlar` | Talab qilinadigan hujjatlar cheklisti | har bir hujjat |
| `qollanma` | Ustunlar ta'rifi va ruxsat etilgan qiymatlar — **faqat odam uchun**, sayt o'qimaydi | — |

Asosiy qoidalar (to'lig'i `qollanma` varag'ida):

- 1-qator — ustun nomlari, ma'lumot 2-qatordan. Birlashtirilgan katak bo'lmasin.
- **Bo'sh katak** = guideline'da ko'rsatilmagan. **`yoq`** = guideline'da aniq
  "yo'q" deb yozilgan. Bu ikkisi bir xil emas.
- Sanalar — matn, `YYYY-MM-DD`. Vaqt — matn, `HH:MM`, Koreya vaqti (KST).
- Pul va til ballari — faqat raqam; valyuta alohida ustunda.
- `univ_kod` — rasmiy domenning birinchi qismi kichik harflarda
  (`jbnu.ac.kr` → `jbnu`). Fayl shu kod orqali universitetga bog'lanadi.
- Fayl nomi: `guideline_id.xlsx`.

Format o'zgarsa `format_versiya` oshiriladi. Sayt hozir **v2** ni kutadi;
boshqa versiya kelsa import to'xtamaydi, lekin ogohlantirish chiqadi.

## Yuklash

Ikki yo'l bor, ikkalasi ham faqat admin uchun:

1. **Yuqoridagi "Excel yuklash"** — fayl `univ_kod` bo'yicha o'zi tegishli
   universitetni topadi.
2. **Universitet panelidagi "Excel yuklash"** — aynan o'sha universitetga
   yoziladi.

Yuklashdan oldin fayl brauzerda tekshiriladi. Xato bo'lsa import boshlanmaydi
va oyna qaysi varaqning qaysi qatorida nima xato ekanini ko'rsatadi, masalan:

```
universitet 2-qator, semestr: "yoz" — ruxsat etilgan qiymatlar: bahor, kuz
fakultetlar 14-qator, kontrakt_summa: "tekin" — raqam emas
```

Fayl to'g'ri bo'lsa hammasi bitta tranzaksiyada yoziladi: yarim import bo'lishi
mumkin emas. Bir xil `guideline_id` bilan qayta yuklansa — eski ma'lumot
butunlay almashtiriladi.

## Bazadagi jadvallar

Migratsiya: `supabase/migrations/20260921090000_university_catalog.sql`

```
university_guidelines            -- universitet varag'i (+ katalog uchun xulosa)
  university_guideline_rounds    -- muddatlar
  university_guideline_faculties -- fakultetlar
  university_guideline_docs      -- hujjatlar
```

Katalog kartasi uchun kerak bo'lgan `kontrakt_min`, `kontrakt_max`,
`kontrakt_davri` va `fakultet_soni` import paytida hisoblanib
`university_guidelines` qatoriga yoziladi — shuning uchun ro'yxat ikkita
yengil so'rov bilan ochiladi, fakultetlar faqat universitet ochilganda
tortiladi.

**Ruxsatlar (RLS):** investordan boshqa har qanday xodim o'qiy oladi; yozish
faqat `owner` va `admin` uchun. Import `import_university_guideline(payload)`
RPC'si orqali ketadi va rolni o'zi ham tekshiradi.

## Kod

| Fayl | Vazifasi |
| --- | --- |
| `src/lib/xlsxReader.ts` | jszip ustida minimal .xlsx o'quvchi (katak matnlari) |
| `src/lib/universityGuidelineExcel.ts` | Shablon qoidalari, tekshirish, RPC uchun JSON |
| `src/hooks/useUniversityCatalog.ts` | Katalog, detal, import va universitet qo'shish |
| `src/components/crm/pages/UniversityCatalogContent.tsx` | Bo'limning o'zi |
| `src/components/crm/pages/university-catalog/` | Karta, detal paneli, formatlash |

> `/crm/admin/institutions` — bu boshqa sahifa: uni_db bazasini boshqarish
> (hamkor/xarita bayroqlari, guideline PDF yuklash). Xodimlar ishlatadigan
> katalog — shu hujjatdagi bo'lim.
