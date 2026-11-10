# Hanguk Ish — backend (Supabase)

Alohida Supabase loyihasi «hanguk-ish» (Seul). Hozircha yaratilmagan —
«Alicargo» tashkilotidagi to'lanmagan hisob tufayli; kod va testlar shu
papkada, CI'da lokal bazada sinaladi.

## Tarkibi

| Fayl | Nima |
|---|---|
| `migrations/…_ish_core.sql` | jadvallar, turlar, triggerlar (eng kam ish haqi, QR siri, tarjimani yangilash) |
| `migrations/…_ish_rls.sql` | RLS siyosatlari va ustun darajasidagi huquqlar |
| `migrations/…_ish_rpc.sql` | ilovalar chaqiradigan funksiyalar: smena olish/bekor qilish, tasdiqlash, QR kirish/chiqish, baho, hisobotlar |
| `migrations/…_ish_employer.sql` | ish beruvchi ilovasi o'qishlari (`business_board`, `employer_shift`, `business_workers`) va smenani tahrirlash qoidalari (`shifts_guard`) |
| `migrations/…_ish_app_reads.sql` | ilovalar ekranlari uchun JSON: lenta kartalari (`shift_feed`, `shift_details`), `my_shifts`, `my_notifications`, `my_profile` / `save_worker_profile`, `my_businesses`; biznesning mahalla/qavat/tarjima/logo ustunlari; chat xabari bildirishnomasi; «avatars» bucket |
| `migrations/…_ish_upkeep.sql` | smena eslatmasi (2 soat oldin) va pg_cron: kelmaganlar / muddati o'tgan arizalar har 10 daqiqada |
| `migrations/…_ish_matching.sql` | yangi smena yaqindagi (5 km), o'sha vaqtda bo'sh ishchilarga xabar beriladi (kuniga ≤3); har kuni 18:00 da 3 km ichidagi smenalar yig'masi |
| `functions/business-register/` | BA0: 사업자등록번호 tekshiruvi (nazorat raqami + 국세청 holati) va biznesni ro'yxatdan o'tkazish; `nts_test.ts` — Deno testlari |
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

## Testlar

```sh
# lokal PostgreSQL 15+:
PGHOST=… PGPORT=… PGUSER=postgres bash tests/run.sh
# yoki Supabase stack'da:
supabase start --workdir hanguk_ish && supabase db reset --local --workdir hanguk_ish
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash tests/run.sh
```

## Edge funksiyalar

| Funksiya | Kim chaqiradi | Nima qiladi |
|---|---|---|
| `business-register` | sajangnim ilovasi, BA0 dan keyin (kirgan foydalanuvchi) | 사업자등록번호 nazorat raqami → 국세청 holati: «계속사업자» darhol tasdiqlanadi (T8), «휴업자» kutadi, «폐업자» rad etiladi; kalit bo'lmasa — `pending` (odam tekshiradi). Xato kodlari: BIZ_NO_INVALID, BIZ_NO_UNKNOWN, BIZ_NO_TAKEN, BUSINESS_CLOSED |

Sirlar (dashboard → Edge Functions → Secrets): `NTS_SERVICE_KEY` — data.go.kr «국세청_사업자등록정보 진위확인 및 상태조회 서비스», «Decoding» kalit.

BA0 da do'kon nomi so'ralmaydi (prototipda yo'q): yangi biznes nomi vaqtincha `사업장 123-45-67891` bo'ladi — nomi va manzili keyin admin yoki sozlamalar ekrani orqali o'rnatiladi (savol ochiq).

```sh
cd supabase/functions && deno test --allow-env --allow-net
```

