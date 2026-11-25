# HanPyol — backend (Supabase)

HanPyol'ning bazasi hanguk.uz'ning Supabase loyihasida
(`lysjdtyanhdfphqyijsr`, Seul), alohida **`ish` sxemasida** (P48). hanguk.uz'ning
`public` sxemasida hech narsa yaratilmaydi va ruxsatlari o'zgarmaydi. Yagona
istisno — repo ildizidagi `supabase/migrations/20261111150000_hanguk_ish_skip_main_profile.sql`:
hanguk.uz'ning `public.handle_new_user` triggeri HanPyol ilovalaridan
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
| `migrations/…_ish_open_business.sql` | P50: BA0 «시작하기» — `open_business()` sajangnim biznesini darhol, raqamsiz va tekshiruvsiz (`verified`) ochadi; bitta akkauntga bitta biznes |
| `migrations/…_ish_app_business_oversight.sql` | P52: tekshiruvsiz ochilgan bizneslar ustidan xodim nazorati — `staff_app_businesses()` ro'yxat, `staff_update_app_business()` haqiqiy nom va manzil, `staff_set_app_business_blocked()` to'xtatish (`rejected`: smenalar lentadan chiqadi, ariza berib bo'lmaydi) / qayta yoqish; `staff_reports()` / `staff_set_report_status()` — ishchilar shikoyatlari (A11) va ularning holati; ilovadan bitta biznes 24 soatda ko'pi bilan 30 smena (`TOO_MANY_REQUESTS`); xodim yozgan o'zbekcha nom koreyscha nom o'zgarganda yo'qolmaydi |
| `migrations/…_ish_translations.sql` | P55: mashina tarjimasi — yozilgan xabar, smena va biznes `translation_queue` ga tushadi (matni o'zgarsa qaytadan), baza `ish-translate` ni chaqiradi (pg_net, vault'dagi `secret_key`; pg_cron `ish-translate` har daqiqa); `translation_claim` (har urinish keyingisini 1, 2, 4 … 60 daqiqaga suradi, 10 urinish), `translation_save` (asl matn o'zgarmagan bo'lsagina yozadi; xodim yozgan nom qoladi), `translation_fail` — faqat service role |
| `migrations/…_ish_staff_alerts.sql` | P57: sajangnim ilovasida ochilgan biznes va ishchi shikoyati — `staff_alerts` ga, baza `ish-staff-alerts` ni chaqiradi (Telegram: hanguk.uz'ning ogohlantirish boti va chati); yetmagan xabar 1, 2, 4 … 60 daqiqada qayta (8 urinish, pg_cron `ish-staff-alerts`); xodim boshqaradigan biznes — xabarsiz. Faqat service role |
| `migrations/…_ish_staff_admin.sql` | P58: xodimlar ro'yxati CRM'da — HanPyol admini (`staff_members.role = 'admin'`) `staff_people()` (xodimlar va qo'shish mumkin bo'lgan hanguk.uz CRM akkauntlari: `public.user_roles` — owner, admin, call_operator, document_handler, university_staff), `staff_add()` (HanPyol profili bilan), `staff_set_role()`, `staff_remove()`; o'zini o'zgartirish/olib tashlash — `SELF` |
| `migrations/…_ish_push.sql` | P56: push — bildirishnoma (`ish.notifications`) uni ko'rsatadigan ilovada telefoni ro'yxatdan o'tgan odamga bo'lsa `push_queue` ga tushadi, baza `ish-push` ni chaqiradi (FCM); o'qilgan yoki 30 daqiqadan eski bildirishnoma yuborilmaydi; urinishlar 1, 2, 4, 8, 16 daqiqa (5 ta, pg_cron `ish-push`); FCM bilmaydigan token o'chiriladi (`push_drop_token`). Qaysi ilova: sajangnim turlari va biznesga yozilgan chat — sajangnim ilovasiga, qolgani — ishchi ilovasiga. Faqat service role |
| `migrations/…_ish_market_wage.sql` | `market_wage(business)`: BA2 «O'rtacha» tugmasi va «Jozibador / Odatiy» belgisi uchun — oxirgi 90 kunda tasdiqlangan bizneslar qo'ygan smenalar soatlik maoshining o'rtachasi (100 won ga yaxlitlangan), avval o'sha tuman bo'yicha (kamida 5 smena), bo'lmasa hammasi bo'yicha, bo'lmasa `null` (ilova chiziqcha ko'rsatadi, o'ylab topilgan son emas); faqat biznes a'zosi so'raydi |
| `migrations/…_ish_coins.sql` | Puyl hamyoni: `coin_wallets` (balans ≥ 0) va `coin_ledger` (sabab: `staff`, `unlock`, `topup`, `bonus`). Puylni xodim qo'shadi/oladi (`staff_add_coins`, CRM «Puyl»; `staff_coin_workers` qidiruv). `my_coins` — balans va tarix. Ilova pul saqlamaydi, faqat son. Yetmasa `NO_COINS`. Sarflangan puyl qaytmaydi |
| `migrations/…_ish_puyl_offers.sql` | «10 qadam»: xodim ishni 3–4 kishiga shaxsan yuboradi (`staff_send_offers`, 4 tadan ko'p tirik taklif — `TOO_MANY`), taklif 30 daqiqa yashaydi. `staff_job_details` — jami to'lov va «ish beruvchi bilan gaplashildi» vaqti. `my_offers` — telefon va manzil yashirin (`010-••••-••••`), narx: ≥150k→20, ≥110k→16, ≥80k→13, ≥50k→10, aks holda 7 P. `unlock_offer` — puyl bilan ochadi, ish ishchiga biriktiriladi (tasdiqlangan ariza), joy to'lsa boshqalarga yopiladi; qayta ochish bepul. `my_jobs`, `set_job_step` (Ochildi → Qo'ng'iroq qildim → Ishga chiqdim), `rate_job` (★ ish beruvchiga). `offers_tick` (cron `ish-offers`, har daqiqa): tugashiga 5 daqiqa qolganda bir marta eslatma, muddati o'tganini yopadi |
| `migrations/…_ish_fix_unlock_and_leaks.sql` | (2026-11-24) Puyl va maxfiylik tuzatishlari. Yangi narx: 5 soatdan qisqa yoki <80 000 ₩ → 20 P, ≤150 000 ₩ → 30 P, undan ko'p → 40 P (`unlock_price`, `shift_unlock_price`); doimiy ish — 300 P (`monthly_unlock_price`). Taklifli (`invite_only`) ishga bepul ariza yo'q (`USE_UNLOCK`), faqat `unlock_offer`. To'lamaguncha nom, aniq manzil va nuqta yashirin (`can_see_place`, `business_brief`, `shift_card`: `place_hidden`, nuqta ~1 km yaxlitlangan). `staff_send_offers`: `NOT_INVITE_ONLY`, `NO_CONTACT_PHONE`, `SHIFT_FULL`. RLS: invite-only va xodim yuritadigan bizneslar jadvaldan o'qilmaydi; ish beruvchi ishchining profilini o'qimaydi. `monthly_jobs` jadvali yopiq: `public_monthly_jobs` (kompaniya, manzil, telefon yashirin), `staff_monthly_jobs`, `unlock_monthly_job` (300 P → `contact_phone`) |
| `migrations/…_ish_refunds_and_paid_jobs.sql` | Qaytarish: `refund_unlock` (bir arizaga bir marta), ish bekor bo'lsa puyl qaytadi (`cancel_shift`, `staff_cancel_shift`), `staff_refund_unlock` (izoh shart), ishchi 12 soatdan oldin bekor qilsa qaytadi. To'langan ishchi bor ishda maosh kamaytirilmaydi, manzil o'zgarmaydi (`HAS_PAID_WORKER`). Taklif muddati doim bor (30 daqiqa) |
| `migrations/…_ish_pyol_plan.sql` | Sotuv rejasi: ro'yxatdan o'tganda 90 P (bir telefonga bir marta), har oy 1-sanada 90 gacha to'ldirish (cron `ish-monthly-bonus`), taklif kodi (do'stiga +30, taklif qilganga +60 birinchi ishdan keyin), paketlar 30/100/300 P = 3 300/9 900/24 000 ₩ (`pyol_packs`), to'lov so'rovi (`request_topup`) → xodim tasdiqlaydi (`staff_approve_topup`), to'lov rekvizitlari (`staff_set_payment_setting`, `payment_details`), `staff_add_coins` kuniga 1 000 P gacha, doimiy ishga olish va 2 haftadan keyin 50 000 ₩ komissiya (`staff_mark_hired`, `staff_confirm_two_weeks`, `staff_mark_fee_paid`), `staff_pyol_report` |
| `migrations/…_ish_free_dates.sql` | «Bo'sh kunlarim»: ishchi qaysi kunlari va qayerda ishlay olishini yozadi (`set_free_dates`, 31 kungacha), xodim kechqurun ko'radi (`staff_free_dates_summary`, `staff_free_workers`) va taklif yuboradi |
| `migrations/…_ish_alert_privacy.sql` | Ish xabarnomasi (`notification_card`): to'lamaguncha nuqta yaxlitlangan, `unlock_price` bor; push matnida soatbay maosh |
| `migrations/…_ish_notification_fixes.sql` | Kechasi yuborilgan taklif 30 daqiqada o'chib ketardi: endi ish boshlanishidan 2 soat oldingacha (30 daqiqa – 12 soat) yoki xodim tanlagan daqiqa (`staff_send_offers`, `p_minutes`). Yangi xabarlar: `coins_added` (to'ldirish, oylik bepul, taklif mukofoti, sovg'a, qaytarish) va `topup_rejected` |
| `migrations/…_ish_referral_code_unique.sql` | Taklif kodi takrorlanmaydi (trigger, 6 belgi, 0/O/1/I yo'q) — eski md5 kodi 20 000 ishchida to'qnashib, profil saqlanmay qolardi |
| `migrations/…_ish_cards_and_employer_invite.sql` | (2026-11-25) Sariq/qizil kartochka. Ishchi: 1-kelmaslik sariq, 2-qizil (14 kun yangi ish yo'q), 3-blok; 5 ta bajarilgan ish bir pog'ona tushiradi; xodim izoh bilan olib tashlaydi (`staff_clear_card`). Ish beruvchi: band ishni bekor qilsa yoki xodim bersa (`staff_give_business_card`); qizil/blok — ish joylay olmaydi (`BUSINESS_CARD`). `my_trust.card`, `staff_cards`. Ish beruvchi taklif kodi (`set_business_invite`): biznesning birinchi bajarilgan ishidan keyin ishchiga 200 P |
| `migrations/…_ish_store_purchases.sql` | Puyl ilova ichida Google Play / App Store orqali sotiladi (`puyl_30/100/300` = 3 300 / 9 900 / 24 000 ₩). `ish-iap` funksiyasi xaridni do'kon bilan tekshirib, `iap_credit` bilan bir marta qo'shadi (`store_purchases`, tranzaksiya takrorlanmaydi); hisobotda so'm (₩) ham hisoblanadi |
| `../../supabase/functions/ish-iap/` | Xaridni tekshirish. Sirlar: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (Play Console'da huquq berilgan service account), `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY` (.p8), ixtiyoriy `ISH_ANDROID_PACKAGE`, `ISH_IOS_BUNDLE_ID` |
| `functions/ish-business-register/` | 사업자등록번호 tekshiruvi (nazorat raqami + 국세청 holati) va biznesni ro'yxatdan o'tkazish (P50 dan BA0 chaqirmaydi; BA1 raqamli kutayotgan biznesni qayta so'raydi); `keys.ts` — loyiha kalitlari; `*_test.ts` — Deno testlari |
| `tests/` | SQL testlar (`run.sh`), oddiy PostgreSQL uchun Supabase o'rnini bosuvchi `supabase_shim.sql`; `json_samples.sh` — ilovalar oladigan javoblar namunasi (Dart testlari uchun) |
| `config.toml` | lokal stack (`supabase start --workdir hanguk_ish`): telefon orqali kirish (P54), test raqamlar qat'iy kod bilan |

## Qoidalar (bazada tekshiriladi)

- Tasdiqlanganlar soni o'rindan oshmaydi (smena qatori qulflanadi).
- Ishchi vaqti kesishgan ikki smenani ololmaydi.
- Soatlik maosh — smena sanasidagi eng kam ish haqidan kam emas (2026: 10 320 ₩, 2027: 10 700 ₩; `minimum_wages` jadvali).
- QR: kirish boshlanishdan 30 daqiqa oldin ochiladi, tugashda yopiladi; chiqish tugashdan 2 soat keyin yopiladi; 1 daqiqadan kech — 지각 (T6).
- Maosh: QR bo'yicha haqiqiy vaqt, rejadan oshmaydi (T7).
- Ishonchlilik: bajarilgan +1 (100 gacha), 24 soatdan kam qolganda bekor −5, kelmaslik −20 (T5).
- NTS «01 계속사업자» bo'lsa biznes darhol tasdiqlanadi (T8). P50 (Asrbek qarori): BA0 dagi biznes raqamsiz va tekshiruvsiz darhol tasdiqlangan holda ochiladi.
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

Holat (2026-11-12): 21 migratsiya prod'da (P48), sxema test bazasi bilan bir xil;
`ish` API'da; funksiya joylangan; xodim (Asrbek) qo'shilgan. P50
(`…_ish_open_business.sql`) prod'da. P52 (`…_ish_app_business_oversight.sql`) —
prod'da (2026-11-12, Asrbek ruxsati bilan; 8 funksiya md5 bo'yicha test bazasi
bilan bir xil). P53 ildiz migratsiyasi prod'da. P54 (telefon + SMS kod):
Phone/Twilio Verify yoqildi; P54 ildiz migratsiyasi — prod'ga Asrbek ruxsati bilan.

1. Migratsiyalar, nom tartibida, Supabase MCP `apply_migration` bilan (yoki
   «Supabase apply migrations» workflow — u faqat `main` dagi fayllarni oladi):
   - `hanguk_ish/supabase/migrations/*.sql` (hammasi `ish` sxemasida);
   - repo ildizidagi `supabase/migrations/20261111150000_hanguk_ish_skip_main_profile.sql`
     va `20261111180000_hanguk_ish_skip_anonymous.sql` (P49).
   - Shular bilan pg_cron ishlari (6 ta, `ish-…`), Realtime (`ish.notifications`,
     `ish.messages`, `ish.applications`) va «ish-avatars» bucket ham o'rnatiladi.
2. Dashboard → Project Settings → Data API → **Exposed schemas**: `ish` ni qo'shish
   (bo'lmasa API `ish` ga javob bermaydi).
3. Kirish (P54): Authentication → Sign In / Providers → **Phone** yoqiq, SMS
   provayderi **Twilio Verify** (Account SID, Auth Token, Verify Service SID —
   Asrbek 2026-11-12 da kiritdi). «Allow anonymous sign-ins» kerak emas (o'chiq).
   Telefon akkauntini istalgan odam ochishi mumkin, hanguk.uz esa telefon
   akkauntlarisiz qurilgan (2026-11-12: 352 akkauntdan 0 tasida telefon) — uning
   jadvallari «har kim o'z qatorini» yozishiga, bir qancha funksiyalari (AI
   intervyu, study plan, universitet qidiruvi, HeyGen, TURN, push token) har
   qanday kirgan akkauntga ochiq. Shuning uchun ilovalar telefon bilan kirishidan
   oldin, tartib bilan:
   - `20261112140000_hanguk_ish_no_anonymous.sql` (P53): hanguk.uz'ning barcha
     `public` jadvallari va bucket'lariga restrictive policy;
   - `20261112160000_hanguk_ish_phone_accounts.sql` (P54): emailsiz (telefon
     yoki anonim) har bir akkaunt ochilganda `app_metadata.app = 'hanguk_ish'`
     bilan belgilanadi (belgi qayta yozilsa ham qaytadi), P53 policy'lari
     belgilangan akkauntni ham ushlaydi, hanguk.uz profili ochilmaydi;
   - funksiyalar (`supabase/functions/_shared/hanguk-ish.ts`
     `isHangukIshAccount`: anonim yoki belgilangan akkauntga 403; main'ga
     birlashganda `supabase-deploy.yml` o'zi joylaydi).
   Keyin yaratiladigan hanguk.uz jadvaliga shu policy o'z migratsiyasida
   qo'shiladi (namunasi P54 migratsiyasi ichida).
   Authentication → Rate Limits → SMS: soatiga kichik chegara (har SMS pullik).
4. Edge funksiya `ish-business-register`: `supabase functions deploy ish-business-register
   --workdir hanguk_ish --project-ref lysjdtyanhdfphqyijsr` (yoki MCP
   `deploy_edge_function`: `index.ts`, `keys.ts`, `nts.ts`, verify_jwt yoqiq);
   sir: `NTS_SERVICE_KEY`. Kalitsiz yangi bizneslar `pending` bo'lib qoladi.
   Kalitlar hanguk.uz'ning yangilari (`SUPABASE_SECRET_KEYS` /
   `SUPABASE_PUBLISHABLE_KEYS`), bo'lmasa eski anon / service_role (`keys.ts`).
   Tarjima (P55): avval `ish-translate` joylanadi (PR `main` ga birlashganda
   `supabase-deploy.yml`), keyin `…_ish_translations.sql` migratsiyasi. Yangi
   sir kerak emas: Hanguk AI provayderlari kalitlari va vault'dagi `secret_key`
   (hanguk.uz'ning pg_cron ishlari ishlatadigan) bor.
   Xodimlarga Telegram (P57): `ish-staff-alerts` joylanadi, keyin
   `…_ish_staff_alerts.sql` (P55 dan keyin: `ish.ask_function` shunda).
   Sirlar bor (`TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID`).
   Push (P56): `ish-push` joylanadi, keyin `…_ish_push.sql` (P55 dan keyin).
   Sir bor: `FCM_SERVICE_ACCOUNT_JSON` (Firebase `hanguk-consulting`, talaba
   ilovasining push'lari). Ilovalar shu loyihada ro'yxatdan o'tgach
   (`google-services.json`) telefonlar token yozadi; ungacha navbat bo'sh.
5. CI APK'lari shu bazaga ulanadi: `ish-check.yml` da hanguk.uz'ning manzili va
   publishable kaliti (ochiq, saytda ham bor). GitHub secrets `ISH_SUPABASE_URL`,
   `ISH_SUPABASE_PUBLISHABLE_KEY` berilsa — boshqa loyihaga.
6. Xodimlar: hanguk.uz CRM akkaunti bilan — P58 dan CRM → HanPyol →
   «Xodimlar» yorlig'ida (admin qo'shadi; `hanguk_ish/README.md`, «Xodimlar»).
   Birinchi admin (Asrbek) prod'da bor.
7. Tekshiruv:
   - `bash tests/verify.sh "<prod database url>"` — faqat o'qiydi: migratsiyalar
     (nomi bo'yicha), hanguk.uz triggeri HanPyol'ni o'tkazib yuborishi, RLS,
     huquqlar, 6 ta pg_cron ishi, Realtime jadvallari, «ish-avatars» limitlari,
     eng kam ish haqi, indekslar. Hammasi «ok» bo'lishi kerak (CI'da lokal
     stack'da ham ishlaydi);
   - ikkala APK'da telefon bilan kirish, bitta smena joylash va olish, QR bilan
     kirish va chiqish; hanguk.uz'da odatdagi kirish va talaba ro'yxatdan o'tishi.

### 2026-11-24 migratsiyalari (hali prod'da emas)

Asrbekning ruxsati bilan, shu tartibda: `20261124100000_ish_fix_unlock_and_leaks`,
`20261124110000_ish_refunds_and_paid_jobs`, `20261124120000_ish_pyol_plan`,
`20261124130000_ish_free_dates`, `20261124140000_ish_alert_privacy`,
`20261124150000_ish_notification_fixes`, `20261124160000_ish_referral_code_unique`. Keyin:
`ish-push` funksiyasini qayta joylash; CRM va hanguk.uz/ish bir vaqtda
(`monthly_jobs` jadvali endi to'g'ridan o'qilmaydi). Xodim CRM «Puyl va bo'sh
kunlar» yorlig'ida to'lov rekvizitlarini kiritadi — busiz ilova «Puyl sotib
olish»da «hali sozlanmagan» deydi.

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
| `ish-translate` (repo ildizida: `supabase/functions/ish-translate/`, `main` ga birlashganda `supabase-deploy.yml` joylaydi) | baza o'zi (pg_net: har yozuvdan keyin va pg_cron har daqiqa, navbatda biror narsa kutayotgan bo'lsa); faqat server kaliti, `verify_jwt = false` | navbatdagi qatorlarni oladi, Hanguk AI provayderlari bilan (`hanguk-ai-chat/llm.ts`, o'sha kalitlar) tarjima qiladi, javob shaklini tekshirib yozadi. Model javob bermasa — qatorlar keyingi urinishini kutadi |
| `ish-staff-alerts` (repo ildizida, `supabase-deploy.yml` joylaydi) | baza o'zi (pg_net va pg_cron, `ish-translate` kabi); faqat server kaliti | xodimlarga Telegram: yangi ilova biznesi («Ilovadagi bizneslar» havolasi bilan), shikoyat (mavzu, ishchi, biznes, smena, matn; «Shikoyatlar» havolasi). `TELEGRAM_BOT_TOKEN` + `ALERT_TELEGRAM_CHAT_ID` (bor); `ISH_ALERT_CHAT_ID` berilsa — o'sha chatga |
| `ish-push` (repo ildizida, `supabase-deploy.yml` joylaydi) | baza o'zi (pg_net va pg_cron, `ish-translate` kabi); faqat server kaliti | FCM HTTP v1 (`FCM_SERVICE_ACCOUNT_JSON`): A12 / 알림 sarlavhasi va qatori, o'quvchining tilida (`texts.json` — ilovalarning ARB fayllaridan `hanguk_ish/tool/push_texts.py`; ajralib ketsa `texts_test.ts` yiqiladi). Eslatma — smena boshlanguncha saqlanadi (TTL), qolgani bir kun. Bir partiya (20 ta) birga ketadi; bir yugurish 40 soniya |
| `ish-business-register` | sajangnim ilovasi: raqamli, hali kutayotgan biznes (BA1 qayta so'raydi). P50 dan BA0 chaqirmaydi | 사업자등록번호 nazorat raqami → 국세청 holati: «계속사업자» darhol tasdiqlanadi (T8), «휴업자» kutadi, «폐업자» rad etiladi; kalit bo'lmasa — `pending` (odam tekshiradi). Xato kodlari: BIZ_NO_INVALID, BIZ_NO_UNKNOWN, BIZ_NO_TAKEN, BUSINESS_CLOSED, TOO_MANY_REQUESTS |

Sirlar (dashboard → Edge Functions → Secrets): `NTS_SERVICE_KEY` — data.go.kr «국세청_사업자등록정보 진위확인 및 상태조회 서비스», «Decoding» kalit.

BA0 da do'kon nomi so'ralmaydi (prototipda yo'q): yangi biznes nomi vaqtincha `사업장 123-45-67891` bo'ladi — nomi va manzili keyin admin yoki sozlamalar ekrani orqali o'rnatiladi (savol ochiq).

```sh
cd supabase/functions && deno test --allow-env --allow-net
```

