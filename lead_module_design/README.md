# Lead moduli — dizayn paketi

Lead ro'yxati va lead ma'lumotlarini to'ldirish oynasining to'liq dizayni
(Design Code eksporti). Hanguk CRM ranglari va tipografiyasi, oq/qorong'i
rejim bilan.

## Nima bor
- **`Lead-Module-Preview.dc.html`** — dizaynning o'zi. Brauzerda ochiladi,
  internetsiz ishlaydi. Yuqori o'ng burchakdan **Oq / Qorong'i** rejimni
  almashtirish, qatorga bosib to'ldirish oynasini ochish mumkin.
- **`support.js`** — preview'ni ishlatuvchi runtime (Design Code).
- **`_ds/`** — Hanguk dizayn tizimi: ranglar, tipografiya, komponent uslublari.
- **`reference/`** — asl skrinshot.

## Dizayn nimani ko'rsatadi

### 1. Leadlar ro'yxati (jadval)
Ustunlar: **O'quvchi · Telefon · Kanal · Shahar · Manba · Yo'nalish ·
Semestr · Sertifikat · Yosh · Holat**.
- Har qatorda avatar (bosh harflar), ism, "qachon qo'shilgan" izohi va agar
  belgilangan bo'lsa **"Qayta aloqa: …"** satri.
- Holat ustuni: **To'ldirilgan** (yashil chip) yoki **To'liq emas** (kulrang chip).
  Lead barcha majburiy maydonlar to'lganda "To'ldirilgan" hisoblanadi.
- Qatorga bosilganda to'ldirish oynasi ochiladi; yuqorida **+ Yangi lead** tugmasi.

### 2. To'ldirish oynasi (to'liq ekran)
To'rt bo'limga bo'lingan:

| Bo'lim | Maydonlar |
|---|---|
| **Shaxsiy ma'lumotlar** | Ism, Familiya, Telefon raqami, Yoshi, Yashash shahri (13 ta shahar) |
| **Ta'lim** | Til sertifikati (TOPIK 1–6, IELTS, TOEFL, Yo'q), Ta'lim yo'nalishi (Kasbiy ta'lim / Bakalavr / Magistr / GKS), Semestr (joriy va keyingi yilning bahorgi/kuzgi) |
| **Bog'lanish manbasi** | Kanal (Instagram, Telegram, Telefon, WhatsApp, Ofisga keldi, Sayt formasi) va "Bizni qanday topdi?" (8 variant). Tavsiya / tadbir / boshqa tanlansa qo'shimcha **Aniqlashtirish** maydoni chiqadi |
| **Izoh** | Erkin izoh (majburiy emas) + **Qayta aloqa sanasi** (sana tanlagich, "Ertaga" va "1 haftadan keyin" tezkor tugmalari, "Bugun / ertaga / N kundan keyin / N kun kechikdi" ko'rinishidagi izoh) |

### 3. Validatsiya
- Izohdan boshqa hamma maydon majburiy.
- Telefon: kamida 9 ta raqam. Yosh: 15–45 oralig'ida.
- Xato bo'lganda maydon tagida qizil izoh, pastda "Barcha maydonlarni to'ldiring".

### 4. Rejimlar
- **Oq**: oq fon (#EFF2F5), asosiy rang to'q ko'k #1A3A6C.
- **Qorong'i**: ko'kdan qorag'a gradient fon, shishasimon kartalar, asosiy
  tugma va urg'u rangi yashil-limon #D4E94C.

## Amaldagi ma'lumot modeli bilan bog'liqligi
Dizayndagi maydonlar `src/contexts/LeadsContext.tsx` dagi `Lead` interfeysiga
quyidagicha tushadi:

| Dizayn | Kod |
|---|---|
| Ism + Familiya | `full_name` |
| Telefon | `phone` |
| Shahar | `city` |
| Yosh | `birth_date` (yoki alohida yosh maydoni) |
| Ta'lim yo'nalishi | `education_level` |
| Til sertifikati | `korean_level` / `english_level` |
| Semestr | `preferred_start_date` |
| Kanal | `source` |
| Bizni qanday topdi? + Aniqlashtirish | `how_heard` |
| Izoh | `notes` |
| Qayta aloqa sanasi | `next_follow_up` |

Yangi maydonlar (semestr, sertifikat, aniq yosh) kerak bo'lsa migratsiya
qilinadi — buni implementatsiya bosqichida hal qilinadi.

## Holati: qurib bo'lindi ✅

Dizayn amaldagi ilovaga ko'chirildi. Kod:

| Nima | Qayerda |
|---|---|
| Sahifa (ro'yxat + oyna orkestratsiyasi) | `src/components/crm/pages/LeadsContent.tsx` |
| Jadval | `src/components/crm/leads/intake/LeadsTable.tsx` |
| To'ldirish oynasi | `src/components/crm/leads/intake/LeadIntakeScreen.tsx` |
| Qoidalar (validatsiya, to'liqlik, sana) | `src/components/crm/leads/intake/intakeForm.ts` |
| Javob ro'yxatlari (shahar, sertifikat, kanal, manba) | `src/components/crm/leads/intake/options.ts` |
| Yangi ustunlar | `supabase/migrations/20260814110000_leads_intake_fields.sql` |
| Testlar | `src/components/crm/leads/intake/__tests__/` |

Oq/qorong'i rejim alohida qilinmadi — ilovaning mavjud tokenlari (`--primary`
#1A3A6C, `--accent` #D4E94C) allaqachon dizayndagi ranglar, shuning uchun
ikkala rejim ham o'zidan kelib chiqadi.

Bu papka **manba dizayn** sifatida qoladi: keyingi o'zgarishlarda solishtirish
uchun `Lead-Module-Preview.dc.html` ni brauzerda ochish mumkin.
