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
| `tests/` | SQL testlar (`run.sh`), oddiy PostgreSQL uchun Supabase o'rnini bosuvchi `supabase_shim.sql` |
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
