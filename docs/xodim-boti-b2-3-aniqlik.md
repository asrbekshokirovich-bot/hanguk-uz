# Xodim boti 2.0 — B2-3: AI guruh tahlili aniqligini o'lchash

Sana: 2026-11-06. Manba: prod `bot_analyses` jadvali (faqat SELECT, `scripts/bot-analyses-accuracy.sql`).

## Muhim cheklov: namuna hajmi

Reja 100+ yozuvni tanlab baholashni so'ragan edi, ammo tekshirish vaqtida prod'dagi `bot_analyses` jadvalida jami **7 ta yozuv** bor edi — barchasi 2026-11-06 kuni (funksiya shu kuni ishga tushgan, `mode='shadow'`). Demak hozircha 100 tadan baholash **mumkin emas**: tahlil tizimi hali bir necha soat/kun ishlagan, guruhda xabar trafigi kam bo'lgan.

Shu sababli bu hisobot:
1. Barcha 7 ta mavjud yozuvni to'liq qo'lda baholadi (metodika pastda, 100 ta uchun ham xuddi shunday ishlaydi — faqat ko'proq ma'lumot kerak).
2. Metodika va vosita (`scripts/bot-analyses-accuracy.sql`) tayyor — jadval katta hajmga yetganda (reja: 1–2 hafta guruh ishlatilgandan keyin) xuddi shu skriptni qayta ishga tushirib, 100+ yozuvli to'liq o'lchovni olish mumkin.
3. Dastlabki 7 ta namunadan ko'rinadigan tendentsiyalar va xavf nuqtalari ko'rsatilgan — ular D4 maqsadini (≥90%/≥80% aniqlik) tasdiqlash yoki rad etish uchun YETARLI EMAS, faqat signal sifatida.

## Metodika

1. `scripts/bot-analyses-accuracy.sql` — `bot_analyses`ni `staff_group_messages`ga `chat_id`+`message_id` bo'yicha bog'lab, xabar matni + AI natijasini (kind, confidence, reason) bitta jadvalda chiqaradi.
2. Har bir qatorni qo'lda o'qib, xabar matnidan **aniq ko'rinadigan** holatlar uchun "kutilgan kind" belgilandi: `new_task` | `close_task` | `update_task` | `question` | `decision` | `none`.
   - Matndan aniq ko'rinmaydigan (kontekstga, oldingi xabarlarga bog'liq, ikki xil talqin mumkin) holatlar "noaniq" deb belgilanadi va umumiy aniqlikka kiritilmaydi (reja shartiga mos — faqat aniq holatlar hisoblanadi).
3. Umumiy aniqlik (accuracy) = to'g'ri topilganlar / aniq belgilangan jami.
4. Har `kind` bo'yicha precision/recall — namuna hajmi (7 ta, ko'pi `none`) statistik ahamiyatga ega emas, shunchaki hisoblash usuli ko'rsatilgan.

## Baholash jadvali (barcha 7 yozuv)

| # | Xabar matni (qisqartirilgan) | AI kind | AI conf. | Kutilgan kind | To'g'ri? | Izoh |
|---|---|---|---|---|---|---|
| 1 | "Bugun pastroq modellarda yoki kamroq efforda ishlatilar claudni" | decision | 0.60 | decision | ✅ | Jamoa uchun umumiy qoida/yo'riqnoma — decision to'g'ri |
| 2 | "aka vazifa juda ko'p menda tugadishim kerak tezroq aka" | none | 0.90 | none | ✅ | Holat haqida xabar, yangi vazifa emas |
| 3 | "Claudeni ishlatmelar demadm" | none | 0.90 | none | ✅ | Oldingi gapga izoh/tuzatish |
| 4 | "Pastroq model yoki effortga qo'yib ishlatilar dedim" | none | 0.90 | noaniq | — | #1 bilan bir xil mazmunni takrorlaydi — "decision" ham, "none" (takror) ham oqlanadi; kontekstsiz aniq emas |
| 5 | "🔴 Yangi lidga 10 daqiqadan beri aloqa chiqarilmagan!..." (avtomatik CRM xabari) | none | 0.90 | none | ✅ | Avtomatik bildirishnoma, vazifa emas |
| 6 | "Abet qilyapsilami yoki madina hali ham kelmadimi?" | question | 0.70 | question | ✅ | Jamoadan javob so'ralmoqda |
| 7 | "Xo'jam bu chatniyam davom ettirib tugatib qo'y" | none (conf. 0.3, lekin `assignee_user_id` topilgan) | 0.30 | **new_task** | ❌ | Bu aniq birovga ("Xo'jam") ish topshirig'i — "...tugatib qo'y" buyruq shakli. Model o'zi `assignee_user_id`ni to'g'ri topgan, lekin `kind`ni "none" deb belgilagan — past confidence (0.3) buni to'g'ri "ishonchsiz" deb ko'rsatgan, ammo B5-1 shadow→on o'tishda bu holat **o'tkazib yuboriladi** (chegara 0.8+ bo'lsa), yoki agar chegara past bo'lsa noto'g'ri kind bilan taklif yaratiladi |

## Natija

- Aniq belgilangan holatlar: 6 (#4 noaniq deb chetlashtirildi)
- To'g'ri: 5, Xato: 1 → **umumiy aniqlik ≈ 83% (5/6)**, n=6 juda kichik — ishonch intervali juda keng (Wilson 95%: taxminan 44%–97%). Bu raqamni rejadagi D4 maqsadi (≥90%/≥80%) bilan solishtirib **xulosa chiqarish mumkin emas** — namuna hajmi talab darajasidan ~17 marta kichik.
- Kind bo'yicha (faqat kuzatilgan hodisalar, statistik ahamiyatsiz):
  - `none`: 4/4 to'g'ri (aniq belgilanganlardan)
  - `question`: 1/1 to'g'ri
  - `decision`: 1/1 to'g'ri
  - `new_task`: 0/1 — yagona holat ham xato (recall=0% shu bitta misolda)
  - `close_task`, `update_task`: hali kuzatilmagan (0 namuna)

## Xato namunasi va taklif (#7)

Yagona xato — yashirin vazifa topshirig'i ("X, bu ishni tugatib qo'y" tipidagi buyruq jumlalari) `none` deb belgilandi, garchi model o'zi to'g'ri shaxsni (`assignee_user_id`) va vazifa belgilarini topgan bo'lsa ham. Ehtimoliy sabab: prompt kind-tanlashda buyruq fe'li ("tugatib qo'y", "qilib ber", "yubor") ustiga yetarlicha urg'u bermaydi — model buni "noaniq ishora" deb emas, "aniq topshiriq belgilari to'liq emas" deb baholagan bo'lishi mumkin, chunki jumlada vazifa nomi/mavzusi ("bu chat") noaniq.

Taklif (B5-1/prompt tuning uchun, kod o'zgartirilmadi — bu PR faqat hujjat):
1. `analysis.ts` promptiga 1–2 ta aniq misol qo'shish: ism/lavozim + buyruq fe'li (qo'y, ber, tayyorla, tugatib qo'y) birikmasi — hatto predmet noaniq bo'lsa ham — `new_task` deb belgilanishi kerak, past `confidence` bilan (masalan 0.3–0.5), lekin `kind != none`.
2. Past-confidence `none` holatlarini ham B5-1 "taklif kartasi" oqimida (juda past chegarada, masalan owner uchun "ehtimol vazifa" signali sifatida) ko'rsatish variantini ko'rib chiqish — hozirgi reja faqat yuqori ishonchli `new_task`/`close_task`/`update_task` uchun taklif yaratishni nazarda tutadi, past-confidence `none`lar butunlay yo'qoladi.
3. 1–2 hafta ko'proq ma'lumot to'plangandan keyin shu skriptni qayta ishga tushirib, kamida 100 ta yozuv bilan haqiqiy precision/recall hisoblash — faqat shundan keyin D4 maqsadiga erishilgan/erishilmagan deb aytish mumkin.

## Keyingi qadam

- Bu PR kod o'zgartirmaydi: faqat `scripts/bot-analyses-accuracy.sql` (yordamchi SQL) va shu hujjat.
- Jadval hajmi o'sgach (`select count(*) from bot_analyses` 100+ bo'lganda), xuddi shu skriptni qayta ishlatib, yuqoridagi jadvalni to'liq 100+ qatorga kengaytirish va D4 maqsadi bo'yicha yakuniy xulosa chiqarish kerak — bu ishni keyingi iteratsiyada davom ettirish tavsiya etiladi.
