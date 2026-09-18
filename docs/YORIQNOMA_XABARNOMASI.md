# Yangi qabul yo'riqnomasi haqida xabar — sozlash yo'riqnomasi

Bu hujjat **dasturchi bo'lmagan odam uchun** yozilgan. Maqsad: Janubiy Koreya
universitetlaridan birortasi yangi qabul yo'riqnomasini (모집요강) e'lon qilsa,
Telegram'ga xabar kelishi.

---

## 1. Hozir nima ishlayapti (va nima ishlamaydi)

Tizimning katta qismi allaqachon qurilgan va ishlayapti:

| Nima | Holati |
|---|---|
| 408 ta universitet ro'yxati bazada | ✅ ishlayapti |
| Har kecha ularning saytlarini tekshirish | ✅ ishlayapti |
| Yangi PDF topilsa yuklab olish | ✅ ishlayapti (30 kunda 98 ta hujjat topilgan) |
| PDF ichidan ma'lumot ajratish (narx, muddat, TOPIK) | ✅ ishlayapti |
| **Sizga xabar yuborish** | ❌ **yo'q edi — shu yerda qo'shildi** |

Ya'ni tizim yangiliklarni **topayotgan edi, lekin hech kimga aytmayotgan edi.**
Ma'lumot bazaga tushardi va kimdir o'zi kirib qaramaguncha shundoq turardi.

---

## 2. Siz nima qilishingiz kerak — 4 qadam

Hammasi ~10 daqiqa. Kod yozish shart emas.

### 1-qadam. Telegram'da yangi bot yasang

1. Telegram'da **@BotFather** ni toping.
2. `/newbot` deb yozing.
3. Bot nomini so'raydi → masalan `Hanguk Alerts`.
4. Username so'raydi → masalan `hanguk_alerts_bot` (oxiri `bot` bo'lishi shart).
5. BotFather sizga **token** beradi — `123456789:AAH...` ko'rinishida.
   **Shu tokenni nusxa oling va hech kimga bermang.**

> ⚠️ **Muhim:** mavjud mijozlar botidan foydalanmang. U bot bilan yozishgan
> har bir odamni avtomatik "lead" (potensial mijoz) qilib CRM'ga yozadi —
> ya'ni o'zingiz o'zingizni mijoz qilib qo'yasiz. Shuning uchun **alohida**
> bot kerak.

### 2-qadam. O'zingizning chat ID raqamingizni oling

1. Yangi yasagan botingizni Telegram'da oching va **`/start`** bosing
   (bu muhim — bot sizga birinchi o'zi yoza olmaydi).
2. Brauzerda quyidagi manzilni oching (`<TOKEN>` o'rniga 1-qadamdagi tokenni qo'ying):

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

3. Chiqqan matndan `"chat":{"id":123456789` qismini toping.
   **`123456789`** — bu sizning chat ID'ingiz. Nusxa oling.

### 3-qadam. Ikkala qiymatni GitHub'ga saqlang

1. Brauzerda repozitoriyani oching:
   `github.com/asrbekshokirovich-bot/hanguk-uz`
2. Yuqoridan **Settings** → chap menyudan **Secrets and variables** →
   **Actions** ni bosing.
3. **New repository secret** tugmasini bosing va ikkitasini alohida qo'shing:

   | Name (aynan shunday yozing) | Secret (qiymat) |
   |---|---|
   | `UNI_DB_TELEGRAM_BOT_TOKEN` | 1-qadamdagi token |
   | `UNI_DB_TELEGRAM_CHAT_ID` | 2-qadamdagi raqam |

### 4-qadam. Bir marta "eskisini o'qilgan deb belgilash"

Bazada allaqachon 263 ta hujjat bor. Ular "yangi" bo'lib ko'rinmasligi uchun
bir marta eskilarni belgilab qo'yish kerak, aks holda birinchi xabar eski
ma'lumot bilan to'lib ketadi.

1. GitHub'da **Actions** bo'limiga kiring.
2. Chap ro'yxatdan **uni-db notify new guidelines** ni tanlang.
3. O'ngdagi **Run workflow** tugmasini bosing.
4. **`mark_seen`** katagiga belgi qo'ying (✓) va **Run workflow** bosing.

Tamom. Shu paytdan boshlab faqat **haqiqatan yangi** topilmalar haqida
xabar keladi.

---

## 3. Xabar qanday ko'rinadi

```
🎓 Yangi qabul yo'riqnomasi: 2 ta

1. 연세대학교 (Yonsei University)
   📅 2027 bahor qabuli
   🔗 https://admission.yonsei.ac.kr/...

2. 한국과학기술원 (KAIST)
   📅 2027 bahor qabuli
   🔗 https://admission.kaist.ac.kr/...

Ma'lumotlar tasdiqlashni kutmoqda — CRM'da tekshiring.
```

Havola — universitetning **o'z sayti**, ya'ni bir bosishda asl manbani
tekshira olasiz.

---

## 4. Qanchalik tez-tez tekshiriladi

Bu yerda ikki xil ish bor, ularni aralashtirmaslik kerak:

| Ish | Qancha vaqtda | Nega shunday |
|---|---|---|
| **Xabar yuborish** (`uni-db-notify`) | **Har soatda** | Juda arzon: bazadan bitta so'rov. Hech narsa yuklab olinmaydi. |
| **Universitet saytlarini qidirish** | **Kecha, kuniga 1 marta** | Qimmat va og'ir: 408 ta sayt + sun'iy intellekt tahlili, ~20 daqiqa. |

**Nega 408 ta saytni har soatda tekshirmaymiz?**

Siz shuni so'ragan edingiz, lekin buni qilmaslikni maslahat beraman — uchta
sabab bor:

1. **Kerak emas.** Universitetlar yo'riqnomani yiliga 2 marta chiqaradi.
   Soat sayin tekshirish 24 barobar ko'p ish qilib, xuddi shu natijani beradi.
2. **Qimmat.** Har bir yurish sun'iy intellekt bilan PDF tahlil qiladi.
3. **Bir marta sistemani o'chirib qo'ygan.** 2026-yil 18-sentabrda aynan
   tez-tez ishlaydigan yurish Supabase limitini tugatib, butun loyihani
   ishdan chiqargan (kunlik ~270 GB). Shuning uchun u vaqtincha o'chirilgan.

Amalda natija bir xil: yo'riqnoma kechasi topiladi, ertalab qo'lingizda
bo'ladi. Xabar esa har soatda tekshirilgani uchun, kim yangi PDF qo'shsa
(masalan xodim qo'lda yuklasa) — bir soat ichida bilasiz.

Agar baribir kunda bir necha marta qidirishni xohlasangiz, eng xavfsiz yo'l:
kecha 1 marta **hamma** universitetni, kunduzi esa faqat **eng muhim 30 tasini**
tekshirish. Buni keyin qo'shish mumkin.

---

## 5. Tekshirish: ishlayaptimi?

**Xabar kelishini sinab ko'rish uchun:**

1. GitHub → **Actions** → **uni-db notify new guidelines** → **Run workflow**.
2. Hech narsaga belgi qo'ymang, shunchaki **Run workflow** bosing.
3. Yurish tugagach, ichiga kirib oxirgi qatorga qarang:

   - `found=0 sent=0` → yangilik yo'q, hammasi joyida.
   - `found=2 sent=2` → 2 ta yangilik topildi va yuborildi. Telegram'ni qarang.
   - `found=2 sent=0 (no Telegram channel configured)` → **3-qadam bajarilmagan.**
     Secret'larni qayta tekshiring (nom xato yozilgan bo'lishi mumkin).

---

## 6. Tez-tez uchraydigan muammolar

| Belgi | Sabab | Yechim |
|---|---|---|
| `no Telegram channel configured` | Secret qo'shilmagan yoki nomi xato | 3-qadamni qayta bajaring. Nomlar aynan `UNI_DB_TELEGRAM_BOT_TOKEN` va `UNI_DB_TELEGRAM_CHAT_ID` bo'lishi kerak |
| `Telegram refused the message: chat not found` | Botga `/start` bosilmagan yoki chat ID xato | 2-qadamni qayta bajaring |
| Bir xil xabar ikki marta keldi | Xabar ketgan, lekin belgilash uzilib qolgan | O'z-o'zidan tuzaladi; takrorlanaversa ayting |
| Umuman xabar kelmayapti | Kechalik qidiruv o'chirilgan bo'lishi mumkin | Pastdagi bo'limga qarang |

---

## 7. Kechalik qidiruv o'chirilgan bo'lsa

Kechalik qidiruvni GitHub emas, **Claude'ning rejalashtirilgan vazifasi**
(Routine) boshqaradi: *"Uni-DB guideline crawl (keyless) — 01:00 Tashkent"*.

2026-09-18 holatiga ko'ra u **o'chirilgan** (Supabase limiti muammosi
sababli). Ya'ni: xabarnoma tayyor, lekin xabar beradigan yangilik
kelmaydi, chunki hech kim qidirmayapti.

Uni qayta yoqish kerak — Claude'ga shunday deng:

> "Uni-DB guideline crawl Routine'ni qayta yoq"

Yoqishdan oldin Supabase limiti tiklanganiga ishonch hosil qiling
(`supabase.com` → loyiha → Usage).

---

## 8. Texnik qism (dasturchi uchun)

- Kod: `hanguk_app/services/uni_db/src/uni_db/workers/notify_worker.py`
- Buyruq: `uni-db notify-new [--dry-run] [--mark-seen] [--limit N] [--max-age-hours N]`
- Jadval: `public.guideline_notifications` — qaysi hujjat haqida xabar
  berilganining jurnali. Shu jadval xabar ikki marta ketmasligini kafolatlaydi.
- Xabar **avval yuboriladi, keyin** jurnalga yoziladi. Aksi bo'lsa, yuborish
  uzilganda yangilik butunlay yo'qolardi; bu tartibda esa eng yomoni —
  bitta xabar takrorlanadi.
- 48 soatlik oyna (`--max-age-hours`) noto'g'ri ishga tushirish butun eski
  bazani yuborib yuborishining oldini oladi.
- Testlar: `tests/unit/test_notify_worker.py` (15 ta).
