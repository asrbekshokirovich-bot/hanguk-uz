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
| 📅 Suhbatga chaqirish | Suhbat taklifi bosqichma-bosqich tuziladi (pastga qarang) va nomzodga yuboriladi |
| ❌ Rad etish | Tasdiqlash so'raladi, keyin nomzodga muloyim rad javobi yuboriladi |

### Suhbatga chaqirish qanday ishlaydi

1. **Kun.** Keyingi 10 kun tugma ko'rinishida chiqadi (Bugun, Ertaga, ...). Boshqa sana kerak bo'lsa, `03.10` deb yoziladi.
2. **Vaqt.** 09:00 dan 19:00 gacha har 30 daqiqalik tugmalar chiqadi. Bugungi kun tanlansa, o'tib ketgan vaqtlar ko'rsatilmaydi. Boshqa vaqt kerak bo'lsa, `15:45` deb yoziladi.
3. **Manzil.** Uch xil usulda yuborish mumkin:
   - manzilni matn bilan yozish;
   - 📎 → **Location** orqali xaritadan joy belgilash;
   - "📍 Hozirgi joylashuvimni yuborish" tugmasini bosish (admin ofisda turgan bo'lsa qulay).

   Matn yuborilsa, bot xarita joylashuvini ham so'raydi. Xarita yuborilsa, manzil matnini ham so'raydi. Ikkalasini ham "⏭ O'tkazib yuborish" mumkin. Oldingi taklifdagi manzil "♻️ Oldingi manzil" tugmasi sifatida eslab qolinadi.
4. **Tasdiqlash.** Bot nomzodga boradigan xabarni ko'rsatadi: "✅ Yuborish", "✏️ Qaytadan" yoki "❌ Bekor qilish".

Nomzod xaritadagi joylashuvni (agar yuborilgan bo'lsa) va sana, vaqt, manzil yozilgan taklifni oladi.
Jarayon davomida menyu tugmasi bosilsa yoki `/bekor` yozilsa, taklif bekor qilinadi.

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
