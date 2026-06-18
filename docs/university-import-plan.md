# Koreya universitetlarini bazaga import qilish — REJA (namuna)

> Bu hujjat faqat **reja va namuna**. Hech narsa bazaga qo'shilmagan.

## 1. Hozirgi holat

- Bazada **117** muassasa bor (deyarli barcha 4-yillik universitetlar).
- To'ldirilgan ustunlar: `name_ko`, `name_en`, `institution_type`, `primary_domain`, koordinatalar (`latitude`/`longitude`), `is_visible_on_map`.
- BO'SH ustunlar (hech kim uchun to'ldirilmagan): `kcue_code`, `tier`, `city_ko`, `region_code`, `name_ko_short`.
- Faqat **12** muassasada `primary_admissions_url_ko` bor (AI crawl shulardan boshlaydi).

## 2. Yetishmayotgani

| Toifa | Koreyada jami | Bazada | Yetishmayapti |
|---|---|---|---|
| 4-yillik universitet (대학교) | ~190 | ~110 | ~70–80 |
| Junior college (전문대학) | ~130 | 2 | ~128 |
| Graduate/maxsus | ~40 | bir nechta | ko'p |

Asosiy bo'shliq — **junior college'lar** va bir nechta kichik/maxsus universitetlar.

## 3. Manbalar (rasmiy, ishonchli)

1. **대학알리미 (academyinfo.go.kr)** — Ta'lim vazirligining rasmiy oshkoralik portali. Barcha akkreditatsiyalangan muassasalar: nom, tur, manzil, veb-sayt. CSV/Excel eksport bor.
2. **KCUE (한국대학교육협의회)** — universitet kodlari (`kcue_code`) uchun.
3. **Wikidata** — koordinata, logo, `wikidata_id` uchun (bizda allaqachon ustun bor).

## 4. Ustunlar moslashtirilishi (manba → baza)

| Baza ustuni | Manba | Izoh |
|---|---|---|
| `name_ko` | academyinfo | Majburiy |
| `name_en` | academyinfo / wikidata | |
| `institution_type` | academyinfo turi → bizning enum | `private/national/public/junior_college/...` ga map |
| `primary_domain` | academyinfo veb-sayt | `https://` siz, faqat domen |
| `city_ko`, `region_code` | academyinfo manzil | Hozirgi 117 da bo'sh — ixtiyoriy |
| `latitude`/`longitude` | Wikidata / Kakao geocoding | Xarita uchun |
| `kcue_code` | KCUE | Ixtiyoriy, dedup uchun foydali |
| `is_visible_on_map` | — | **Yangi qatorlar uchun `false`** (tekshirilgunча yashirin) |

## 5. Dublikatlardan saqlanish

Import paytida har bir qator uchun:
- `name_ko` yoki `name_en` yoki `kcue_code` bo'yicha mavjudligi tekshiriladi.
- Mavjud bo'lsa — `ON CONFLICT` bilan o'tkazib yuboriladi yoki yangilanadi (overwrite qilinmaydi).

## 6. Bosqichlar

1. academyinfo'dan toza CSV tayyorlash (~280 qator).
2. Turlarni bizning enum'ga map qilish.
3. Migration yoki bir martalik skript bilan **`is_visible_on_map = false`** qilib yuklash.
4. Koordinatalarni Wikidata/Kakao orqali to'ldirish.
5. Siz tekshirib, guruh-guruh `is_visible_on_map = true` qilib yoqasiz.
6. AI crawl (tayyor, o'chiq) `primary_admissions_url_ko` bo'lganlarni avtomatik to'ldiradi.

## 7. Muhim eslatma — baza umumiy

Test va asosiy sayt **bitta Supabase bazadan** o'qiydi. Shu sababli yangi qatorlar **`is_visible_on_map = false`** bilan qo'shiladi — aks holda asosiy saytda darhol ko'rinib qoladi.
