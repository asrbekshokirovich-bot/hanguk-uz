# Kickoff prompt — Lead modulini dizaynga moslashtirish

Quyidagini Claude Code'ga to'liq nusxalab bering.

---

Repoda `lead_module_design/` papkasi bor. Ichida Lead modulining tasdiqlangan
dizayni joylashgan:

- `lead_module_design/Lead-Module-Preview.dc.html` — dizaynning o'zi
  (markup, ranglar, holatlar, validatsiya mantiqi shu faylda).
- `lead_module_design/README.md` — dizayn nimani ko'rsatishi va maydonlarning
  amaldagi `Lead` modeliga qanday tushishi.
- `lead_module_design/_ds/` — Hanguk dizayn tizimi (rang, tipografiya).

**Vazifa:** amaldagi lead sahifasini shu dizaynga moslashtirish.

Ishni boshlashdan oldin:
1. `lead_module_design/Lead-Module-Preview.dc.html` va `README.md` ni o'qing.
2. Haqiqiy kodni o'qing: `src/contexts/LeadsContext.tsx`,
   `src/components/crm/leads/` (ayniqsa `LeadRow.tsx`, `LeadDetailPane.tsx`,
   `LeadsFilterStrip.tsx`, `worklistLogic.ts`, `qualification.ts`).
3. Qaysi maydonlar bazada bor, qaysilari yo'qligini aniqlang
   (`supabase/migrations/` dagi `leads` jadvali).
4. Reja tuzing va tasdiqlatib oling — keyin bosqichma-bosqich quring.

Muhim shartlar:
- Bu **vizual/UX qayta qurish**. Ma'lumot oqimi, RLS, autentifikatsiya va
  biznes mantiqni o'zgartirmang — mavjud hook va kontekstlarni qayta ishlating.
- Yangi ustun kerak bo'lsa alohida migratsiya yozing, mavjudlarini buzmang.
- Oq va qorong'i rejim ikkalasi ham dizayndagidek ishlashi kerak.
- Mavjud testlar (`src/components/crm/leads/__tests__/`) yashil qolsin;
  yangi mantiq qo'shsangiz testini ham yozing.
- Matnlar o'zbek tilida, dizayndagi so'zma-so'z formulirovkalar saqlansin.

Qabul mezonlari:
- Jadval ustunlari va chiplari dizayndagidek.
- To'ldirish oynasi to'rt bo'limga bo'lingan, validatsiya dizayndagi
  qoidalarga mos (telefon ≥ 9 raqam, yosh 15–45, izohdan boshqasi majburiy).
- "Bizni qanday topdi?" da tavsiya / tadbir / boshqa tanlansa
  "Aniqlashtirish" maydoni chiqadi.
- Qayta aloqa sanasi tezkor tugmalari ("Ertaga", "1 haftadan keyin") ishlaydi
  va sana nisbiy ko'rinishda yoziladi.
- Lead to'liq to'ldirilganda ro'yxatda "To'ldirilgan" chipi chiqadi.
