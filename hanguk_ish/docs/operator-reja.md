# Hanguk Ish — xodimlar orqali moslash (hanguk.uz) va 사장님 ilovasi 4 tilda

*Reja, 2026-11-11. Asrbekning so'rovi: «boshida xodimlarim ish topadi va foydalanuvchiga moslaydi — ish beruvchilar hali ilovadan tashqarida (asosan boshqa Telegram guruh va kanallardan topiladi), xodim ish beruvchi bilan gaplashib, ishni ishchiga qo'lda taklif qiladi; xodim buni hanguk.uz orqali qila olsin» va «사장님 profili ham 4 tilda bo'lsin — odamlar bir-biriga ham ish berishi mumkin».*

## 1. Jarayon

```
Telegram guruh/kanal ──► xodim ish beruvchi bilan gaplashadi
                               │
                               ▼
        hanguk.uz → CRM → «Hanguk Ish»: ish beruvchi + ish kiritiladi
                               │
                               ▼
        «Moslash»: mos ishchilar ro'yxati (bo'sh vaqti, masofa, til, TOPIK, ishonchlilik)
                               │  xodim tanlaydi → «Taklif yuborish»
                               ▼
        Ishchi ilovasi: A12 «Sizga ish taklif qilindi» → A05
              «Smenani olish» (ariza)        «Qiziqmayman»
                               │
                               ▼
        xodim ish beruvchiga qo'ng'iroq qiladi → CRM'da «확정»/rad
                               │
                               ▼
        ishchi: «Tasdiqlandi» (A06) → ish kuni → davomat:
              QR plakat (xodim ish beruvchiga yuboradi) yoki xodim qo'lda belgilaydi
                               │
                               ▼
        to'lov belgilanadi (BA5 dagidek), ishchining tarixida ko'rinadi
```

## 2. Qarorlar (men tanladim — o'zgartirish mumkin)

| # | Qaror | Nega |
|---|---|---|
| Q1 | Xodim hanguk.uz CRM'ida «Hanguk Ish» bo'limida ishlaydi; Hanguk Ish bazasiga **alohida kirish** (email + parol, bir marta, brauzer eslab qoladi). Bo'lim faqat CRM xodimlariga ko'rinadi. | Hanguk Ish — alohida Supabase loyiha (sizning qaroringiz). Ikki loyiha orasida bitta kirish keyin qilinadi. |
| Q2 | Xodim kiritgan ish beruvchi — «xodim boshqaradigan biznes»: 사업자등록번호 shart emas, 국세청 tekshiruvisiz. | Telegram'dan topilgan ish beruvchining raqami ko'pincha ma'lum emas. |
| Q3 | Bunday ish **faqat taklif bilan**: umumiy lentada, xaritada va «yaqinda yangi smena» xabarlarida chiqmaydi; faqat taklif olgan ishchi ko'radi va oladi. Xodim xohlasa umumiy qiladi. | Tashqi ish beruvchiga notanish odam yuborilmasin; xodim nazorat qiladi. |
| Q4 | Ish beruvchining telefoni, Telegram'i, manba (post havolasi), izohlar — **faqat xodimlarga**. Ishchi biznes nomi, joyi, vaqt, maosh, vazifalarni ko'radi. | Ishchi xodim orqali ishlaydi. |
| Q5 | Ishchi javobi: «Smenani olish» → ariza (kutilmoqda); «Qiziqmayman» → rad. Xodim ish beruvchi bilan gaplashgach CRM'da tasdiqlaydi yoki rad etadi — ishchiga odatdagi xabarlar boradi. | Mavjud ariza yo'li (A05, A06, A12) qayta ishlatiladi. |
| Q6 | Davomat: xodim QR plakatni CRM'dan yuklab ish beruvchiga yuboradi (ishchi QR bilan kiradi/chiqadi) **yoki** xodim qo'lda belgilaydi (ishladi + soat / kelmadi). Bunday ishlarda avtomatik «kelmadi» (−20) qo'yilmaydi — xodim belgilaydi. | Ish beruvchi QR'ni chop etmasa, ishchi nohaq jazolanmasin. |
| Q7 | Chat: bunday ishda ishchining chati xodimlarga boradi. | Xodim — ish beruvchining vakili. |
| Q8 | Xodim taklifni ilovadagi biznesning (사장님 ilovasi) smenasiga ham yubora oladi. | Ishchi topishga yordam. |

## 3. Bosqichlar

| # | Bosqich | Nima | Sinov |
|---|---|---|---|
| P39 | Backend | `staff_members`, `is_staff()`; biznesda `managed_by_staff`; `business_contacts`, `shift_notes` (faqat xodim); smenada `invite_only`; `job_offers`; RPC: `staff_save_business`, `staff_businesses`, `staff_save_shift`, `staff_board`, `staff_shift`, `staff_candidates` (bo'sh vaqti, masofa, vaqt to'qnashuvi, til, TOPIK, ishonchlilik), `staff_send_offers`, `staff_mark_attendance`; ishchiga `decline_job_offer`; lenta, xarita, moslik xabarlari va `shift_details` taklifsiz ishchidan yashirin; xodim boshqaradigan biznesda mavjud 사장님 funksiyalari (확정/거절, bekor qilish, QR, to'lov, chat) xodimga ochiq | SQL testlar: huquqlar (xodim emas — yo'q), RLS (kontakt va izoh faqat xodimga, taklifsiz ishchi ko'rmaydi), moslash tartibi, takliflar, davomat va pul, avtomatik «kelmadi» yo'q, tasodifiy yurishga yangi qadamlar |
| P40 | Ishchi ilovasi | A12 «Sizga ish taklif qilindi» (+ havola A05 ga), A05 da «Qiziqmayman», taklif holati; 4 tilda; demo taklif | unit/widget, ekran rasmlari, integratsiya (lokal Supabase): taklif → A12 → A05 → ariza → xodim tasdiqlaydi → A06 |
| P41 | hanguk.uz | CRM → «Hanguk Ish»: kirish; ishlar ro'yxati va formasi (Telegram matnini joylashtirib to'ldirish); ish beruvchilar; moslash jadvali (filtr, tanlash, taklif); ish sahifasi — takliflar, arizalar, tasdiq/rad, davomat, to'lov, QR yuklab olish; uz/ru/en/ko | vitest + Testing Library (soxta Supabase), TypeScript, eslint |
| P42 | To'liq yo'l | CI'da lokal Supabase: CRM ma'lumot qatlami (haqiqiy supabase-js) → ishchi ilovasi → xodim | integratsiya testi (Node + Dart) |
| P43 | 사장님 ilovasi 4 tilda | barcha matnlar (BA0–BA5, 알림, xatolar, CSV, QR plakat) uz/ru/en/ko; BA0 da til tanlash (A01 dagidek), BA1 dan almashtirish; telefon tili bo'yicha boshlanadi; profilga saqlanadi | 4 tilda sifat testi (360×640, ×1,2 — toshib chiqish), ARB testi, koreyschada prototip bilan solishtirish o'zgarmaydi |

## 4. Ochiq savollar (oxirida)
- Xodim orqali topilgan ishda Hanguk qancha oladi (ish beruvchidan / ishchidan) va to'lov kim orqali o'tadi?
- Ishchi tasdiqdan oldin ish beruvchining nomini ko'rsinmi (ishchi to'g'ridan-to'g'ri bog'lanib ketishi mumkin)?
- CRM'da kim taklif yubora oladi: hamma xodimmi yoki tanlanganlar?
- Hanguk Ish loyihasi (Supabase) yaratilgach xodim akkauntlarini kim ochadi?
