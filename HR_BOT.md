# HR bot (Telegram)

Ishga qabul qilish to'liq Telegram chatida ishlaydi: sayt ham, CRM sahifasi ham yo'q.
Nomzodlar anketani bot bilan chatda to'ldiradi, HR adminlar esa arizalarni shu
botning o'zida ko'rib chiqadi.

- Kod: `supabase/functions/hr-bot/index.ts`
- Jadvallar: `supabase/migrations/20260925090000_hr_bot.sql` (`hr_candidates`, `hr_admins`)

## Nomzod nimani ko'radi

1. `/start` bosadi va salomlashuv xabarini oladi.
2. **Ism va familiya** yozadi (kamida 2 so'z bo'lishi kerak).
3. **Telefon raqami** yuboradi: "📱 Raqamni yuborish" tugmasi bilan yoki qo'lda yozib.
4. **Toshkent shahridagi tumanini** tanlaydi (12 ta tuman tugma ko'rinishida).
5. **O'qiysizmi yoki ishlaysizmi?** savoliga "O'qiyman", "Ishlayman", "Ikkalasi ham" yoki "Yo'q" deb javob beradi.
   - "Yo'q"dan boshqa javob tanlansa, bot **o'qish yoki ish vaqtini** so'raydi.
6. "Arizangiz qabul qilindi" xabarini oladi. Ariza shu zahoti barcha adminlarga yuboriladi.

## Admin nimani ko'radi

Admin bo'lish uchun botga `/admin PAROL` yuboriladi. Parol `HR_ADMIN_PASSWORD`
qiymati bo'lib, xabar chatdan darhol o'chiriladi. Adminlikdan chiqish uchun `/chiqish` yuboriladi.

Har bir yangi ariza admin chatiga karta ko'rinishida keladi. Kartadagi tugmalar:

| Tugma | Nima qiladi |
|---|---|
| ⭐ Tanlash | Nomzodni "Tanlanganlar" ro'yxatiga qo'shadi. Nomzodga xabar yuborilmaydi |
| 📅 Suhbatga chaqirish | Bot kun, vaqt va manzilni so'raydi. Admin bitta xabarda yozadi, bot taklifni nomzodga yuboradi |
| ❌ Rad etish | Tasdiqlash so'raladi, keyin nomzodga muloyim rad javobi yuboriladi |

Taklif olgan nomzod **"✅ Kelaman"** yoki **"🔄 Boshqa vaqt kerak"** tugmasini bosadi.
Ikkinchisini tanlasa, o'ziga qulay vaqtni yozadi. Nomzodning javobi adminlarga keladi.
Shundan so'ng admin "📅 Qayta chaqirish" tugmasi bilan yangi vaqt yuborishi mumkin.

Pastki menyu tugmalari: **🆕 Yangi arizalar**, **⭐ Tanlanganlar**,
**📅 Suhbatga chaqirilganlar**, **📊 Statistika**. Suhbat vaqtini kiritishni bekor qilish uchun `/bekor` yuboriladi.

## O'rnatish (bir marta)

1. **Bot yaratish.** Telegram'da @BotFather'ga `/newbot` yuboring, botga nom va username bering, keyin tokenni oling.
2. **Secrets.** Supabase → Project Settings → Edge Functions → Secrets bo'limiga uchta qiymat qo'shing:
   - `HR_BOT_TOKEN`: BotFather bergan token.
   - `HR_BOT_WEBHOOK_SECRET`: tasodifiy uzun satr (faqat harf, raqam, `_` va `-`), masalan `openssl rand -hex 32` natijasi.
   - `HR_ADMIN_PASSWORD`: adminlar kiritadigan parol. Uzun va taxmin qilib bo'lmaydigan bo'lsin.
3. **Jadvallar.** Migratsiyani production'ga `apply_migration` orqali qo'llang (`supabase/README.md`ga qarang, `db push` qilinmaydi).
4. **Deploy.** `main`ga merge qilingandan keyin CI funksiyani o'zi deploy qiladi.
5. **Webhook.** Brauzerda bir marta quyidagi manzilni oching:
   `https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/hr-bot?action=setup`
   Javobda `"ok": true` chiqishi kerak. Holatni tekshirish uchun `?action=status` manzilini oching.
6. **Adminlar.** Har bir HR xodimi botni ochib, `/admin PAROL` yuboradi.

Bot ishlayotganini tekshirish uchun admin bo'lmagan boshqa Telegram akkauntdan `/start` bosing.
