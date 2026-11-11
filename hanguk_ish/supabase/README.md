# Hanguk Ish — backend (Supabase)

Hanguk Ish'ning bazasi hanguk.uz'ning Supabase loyihasida
(`lysjdtyanhdfphqyijsr`, Seul), alohida **`ish` sxemasida** (P48). hanguk.uz'ning
`public` sxemasida hech narsa yaratilmaydi va ruxsatlari o'zgarmaydi. Yagona
istisno — repo ildizidagi `supabase/migrations/20261111150000_hanguk_ish_skip_main_profile.sql`:
hanguk.uz'ning `public.handle_new_user` triggeri Hanguk Ish ilovalaridan
ro'yxatdan o'tganlarni (`user_metadata.app = 'hanguk_ish'`) o'tkazib yuboradi,
ularning profili `ish.profiles`. Kod va testlar shu papkada, CI'da lokal bazada
sinaladi (hanguk.uz'ga o'xshash ob'ektlar yonida: `tests/main_app_stub.sql`,
`tests/05_coexistence_test.sql`).

## Tarkibi

| Fayl | Nima |
|---|---|
| `migrations/…_ish_core.sql` | jadvallar, turlar, triggerlar (eng kam ish haqi, QR siri, tarjimani yangilash) |
| `migrations/…_ish_rls.sql` | RLS siyosatlari va ustun darajasidagi huquqlar |
| `migrations/…_ish_rpc.sql` | ilovalar chaqiradigan funksiyalar: smena olish/bekor qilish, tasdiqlash, QR kirish/chiqish, baho, hisobotlar |
| `migrations/…_ish_employer.sql` | ish beruvchi ilovasi o'qishlari (`business_board`, `employer_shift`, `business_workers`) va smenani tahrirlash qoidalari (`shifts_guard`) |
| `migrations/…_ish_app_reads.sql` | ilovalar ekranlari uchun JSON: lenta kartalari (`shift_feed`, `shift_details`), `my_shifts`, `my_notifications`, `my_profile` / `save_worker_profile`, `my_businesses`; biznesning mahalla/qavat/tarjima/logo ustunlari; chat xabari bildirishnomasi; «ish-avatars» bucket |
| `migrations/…_ish_upkeep.sql` | smena eslatmasi (2 soat oldin) va pg_cron: kelmaganlar / muddati o'tgan arizalar har 10 daqiqada |
| `migrations/…_ish_matching.sql` | yangi smena yaqindagi (5 km), o'sha vaqtda bo'sh ishchilarga xabar beriladi (kuniga ≤3); har kuni 18:00 da 3 km ichidagi smenalar yig'masi |
| `migrations/…_ish_realtime*.sql` | Realtime: bildirishnomalar, chat xabarlari va arizalar ochiq ekranlarga darhol yetadi (RLS bo'yicha) |
| `migrations/…_ish_limits.sql` | suiiste'molga qarshi cheklovlar (pastda) |
| `migrations/…_ish_storage_limits.sql` | «ish-avatars» bucket: faqat rasm, 2 MiB gacha — hosted loyihada ham (`config.toml` faqat lokal) |
| `migrations/…_ish_service_role.sql` | `ish` sxemasida service_role (edge funksiyalar) ruxsatlari |
| `functions/ish-business-register/` | BA0: 사업자등록번호 tekshiruvi (nazorat raqami + 국세청 holati) va biznesni ro'yxatdan o'tkazish; `nts_test.ts` — Deno testlari |
| `tests/` | SQL testlar (`run.sh`), oddiy PostgreSQL uchun Supabase o'rnini bosuvchi `supabase_shim.sql`; `json_samples.sh` — ilovalar oladigan javoblar namunasi (Dart testlari uchun) |
| `config.toml` | lokal stack (`supabase start --workdir hanguk_ish`), test SMS kodlari |

## Qoidalar (bazada tekshiriladi)

- Tasdiqlanganlar soni o'rindan oshmaydi (smena qatori qulflanadi).
- Ishchi vaqti kesishgan ikki smenani ololmaydi.
- Soatlik maosh — smena sanasidagi eng kam ish haqidan kam emas (2026: 10 320 ₩, 2027: 10 700 ₩; `minimum_wages` jadvali).
- QR: kirish boshlanishdan 30 daqiqa oldin ochiladi, tugashda yopiladi; chiqish tugashdan 2 soat keyin yopiladi; 1 daqiqadan kech — 지각 (T6).
- Maosh: QR bo'yicha haqiqiy vaqt, rejadan oshmaydi (T7).
- Ishonchlilik: bajarilgan +1 (100 gacha), 24 soatdan kam qolganda bekor −5, kelmaslik −20 (T5).
- NTS «01 계속사업자» bo'lsa biznes darhol tasdiqlanadi (T8).
- Cheklovlar (oshsa `TOO_MANY_REQUESTS`, ilovalar «urinishlar juda ko'p» deb tushuntiradi):
  - chat — daqiqasiga 20, kuniga 300 xabar;
  - arizalar — kuniga 30, bitta smenaga 3 marta;
  - shikoyat — kuniga 10;
  - «다시 요청» — har ishchi va smenaga bir marta;
  - BA0 ro'yxatdan o'tish — soatiga 10 urinish (edge funksiya, `business_register_attempts`).

## Prod'ga chiqarish ro'yxati

hanguk.uz loyihasida (`lysjdtyanhdfphqyijsr`), bir marta. Prod bazadagi har bir
o'zgarish Asrbekning ruxsati bilan. `supabase db push` ishlatilmaydi — prod
tarixi repo fayllari bilan mos emas (`.github/workflows/supabase-deploy.yml`).

1. Migratsiyalar, nom tartibida, Supabase MCP `apply_migration` bilan (yoki
   «Supabase apply migrations» workflow — u faqat `main` dagi fayllarni oladi):
   - `hanguk_ish/supabase/migrations/*.sql` (hammasi `ish` sxemasida);
   - repo ildizidagi `supabase/migrations/20261111150000_hanguk_ish_skip_main_profile.sql`.
   - Shular bilan pg_cron ishlari (3 ta, `ish-…`), Realtime (`ish.notifications`,
     `ish.messages`, `ish.applications`) va «ish-avatars» bucket ham o'rnatiladi.
2. Dashboard → Project Settings → Data API → **Exposed schemas**: `ish` ni qo'shish
   (bo'lmasa API `ish` ga javob bermaydi).
3. Auth → Providers → Phone: yoqish, SMS provayderi (Twilio Verify: Account SID,
   Auth Token, Verify Service SID); kod 6 raqam; Auth → Rate Limits: SMS chegarasi.
   hanguk.uz'ning email kirishi o'zgarmaydi. `config.toml` dagi test raqamlar
   prod'ga o'tmaydi.
4. Edge funksiya `ish-business-register`: `supabase functions deploy ish-business-register
   --workdir hanguk_ish --project-ref lysjdtyanhdfphqyijsr` (yoki MCP
   `deploy_edge_function`); sir: `NTS_SERVICE_KEY`. Kalitsiz yangi bizneslar
   `pending` bo'lib qoladi.
5. CI APK'lari shu bazaga: GitHub secrets `ISH_SUPABASE_URL`
   (`https://lysjdtyanhdfphqyijsr.supabase.co`), `ISH_SUPABASE_PUBLISHABLE_KEY`
   (hanguk.uz'ning publishable kaliti — u ochiq, saytda ham bor).
6. Xodimlar: hanguk.uz CRM akkaunti bilan, `ish.staff_members` ga qo'shiladi
   (`hanguk_ish/README.md`, «Xodimlar»).
7. Tekshiruv:
   - `bash tests/verify.sh "<prod database url>"` — faqat o'qiydi: migratsiyalar
     (nomi bo'yicha), hanguk.uz triggeri Hanguk Ish'ni o'tkazib yuborishi, RLS,
     huquqlar, 3 ta pg_cron ishi, Realtime jadvallari, «ish-avatars» limitlari,
     eng kam ish haqi, indekslar. Hammasi «ok» bo'lishi kerak (CI'da lokal
     stack'da ham ishlaydi);
   - ikkala APK'da telefon bilan kirish, bitta smena joylash va olish, QR bilan
     kirish va chiqish; hanguk.uz'da odatdagi kirish va talaba ro'yxatdan o'tishi.

## Testlar

```sh
# lokal PostgreSQL 15+ (oxirida tests/concurrency.sh: ikki sessiya bir vaqtda):
PGHOST=… PGPORT=… PGUSER=postgres bash tests/run.sh
# yoki Supabase stack'da:
supabase start --workdir hanguk_ish && supabase db reset --local --workdir hanguk_ish
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash tests/run.sh
# masshtab: 20 000 ishchi, 40 000 smena — har chaqiruv vaqti va chegarasi:
PGHOST=… PGPORT=… PGUSER=postgres bash tests/perf.sh
```

## Edge funksiyalar

| Funksiya | Kim chaqiradi | Nima qiladi |
|---|---|---|
| `ish-business-register` | sajangnim ilovasi, BA0 dan keyin (kirgan foydalanuvchi) | 사업자등록번호 nazorat raqami → 국세청 holati: «계속사업자» darhol tasdiqlanadi (T8), «휴업자» kutadi, «폐업자» rad etiladi; kalit bo'lmasa — `pending` (odam tekshiradi). Xato kodlari: BIZ_NO_INVALID, BIZ_NO_UNKNOWN, BIZ_NO_TAKEN, BUSINESS_CLOSED, TOO_MANY_REQUESTS |

Sirlar (dashboard → Edge Functions → Secrets): `NTS_SERVICE_KEY` — data.go.kr «국세청_사업자등록정보 진위확인 및 상태조회 서비스», «Decoding» kalit.

BA0 da do'kon nomi so'ralmaydi (prototipda yo'q): yangi biznes nomi vaqtincha `사업장 123-45-67891` bo'ladi — nomi va manzili keyin admin yoki sozlamalar ekrani orqali o'rnatiladi (savol ochiq).

```sh
cd supabase/functions && deno test --allow-env --allow-net
```

