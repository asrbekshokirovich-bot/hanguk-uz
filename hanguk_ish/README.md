# Hanguk Ish

Koreyada kunlik va qisqa smenali ishlar — talabalar va hamma uchun.
Bitta Flutter kod, ikki Android ilova:

| Ilova | Flavor | applicationId | Til | Kirish nuqtasi |
|---|---|---|---|---|
| «Hanguk Ish» (ishchi) | `worker` | `uz.hanguk.ish` | uz, ru, en, ko | `lib/main_worker.dart` |
| «Hanguk Ish 사장님» (ish beruvchi) | `employer` | `uz.hanguk.ish.biz` | ko | `lib/main_employer.dart` |

Dizayn: Claude Design prototipi (2026-11-10). Reja: loyiha hujjati
`claude/hanguk-ish-qurish-reja.md`.

Kirish (P54, 2026-11-12 — Asrbek qarori): telefon raqam va SMS kod (Supabase
Phone provayderi, Twilio Verify). Ishchi ilovasida A01 «Telefon raqam bilan» →
T1 (raqam) → T2 (6 xonali kod) → A02 yoki lenta; «Telegram bilan» hozircha «tez
orada» deydi. Sajangnim ilovasida BA0: telefon raqam → «시작하기» → kod →
biznes darhol, tekshiruvsiz ochiladi (P50: `ish.open_business`, nomi «사업장
XXXX», 사업자등록번호 yo'q). Telefon bilan ochilgan akkaunt bazada
`app_metadata.app = 'hanguk_ish'` bilan belgilanadi va hanguk.uz jadvallari
hamda funksiyalaridan ajratiladi (ildizdagi
`20261112160000_hanguk_ish_phone_accounts.sql`). P49–P50 dagi anonim kirish
olib tashlandi.

Tarjima (P55): chat xabari, smena matnlari (nomi, vazifalar, kiyim, manzil)
va biznes nomi/manzili avtomatik tarjima qilinadi — baza yozilganini
navbatga qo'yadi (`ish.translation_queue`), edge funksiya `ish-translate`
(repo ildizidagi `supabase/functions/`) Hanguk AI provayderlari bilan
tarjima qiladi va `translations` / `name_i18n` ga yozadi. Xabar va smena —
o'z tilidan boshqa 4 tilga (uz, ru, en, ko), biznes — uz, ru, en; xodim
yozgan nom almashtirilmaydi. A10 tarjimani ochiq chatda darhol ko'rsatadi
(Realtime: xabarning o'zgarishi). Yangi kalit kerak emas.

Xodimlarga Telegram (P57): sajangnim ilovasida yangi biznes ochilsa yoki
ishchi shikoyat yuborsa, hanguk.uz'ning ogohlantirish chatiga xabar boradi
(CRM'ning tegishli yorlig'i havolasi bilan: `/crm/ish?tab=appBusinesses`,
`?tab=reports`). Yetmasa — baza qayta yuboradi.

## Ishga tushirish

```sh
flutter pub get
flutter run --flavor worker   -t lib/main_worker.dart
flutter run --flavor employer -t lib/main_employer.dart
```

APK (arm64):

```sh
flutter build apk --release --flavor worker   -t lib/main_worker.dart   --target-platform android-arm64
flutter build apk --release --flavor employer -t lib/main_employer.dart --target-platform android-arm64
```

Test APK'lar `android/app/sideload-test.keystore` bilan imzolanadi (barqaror,
paroli ochiq, faqat sideload uchun).

Bazaga ulash: `--dart-define=SUPABASE_URL=… --dart-define=SUPABASE_PUBLISHABLE_KEY=…`
(berilmasa — demo ma'lumotlar). CI APK'lari hanguk.uz bazasiga ulanadi (pastda).

## Reliz (CI)

GitHub → Settings → Secrets and variables → Actions:

| Secret | Nima uchun |
|---|---|
| `ISH_SUPABASE_URL`, `ISH_SUPABASE_PUBLISHABLE_KEY` | ixtiyoriy. Berilmasa, CI APK'lari hanguk.uz loyihasiga ulanadi (`https://lysjdtyanhdfphqyijsr.supabase.co` va uning ochiq publishable kaliti, `ish-check.yml` da); Hanguk Ish undagi `ish` sxemasida (P48). Berilsa — o'sha loyihaga |
| `ISH_UPLOAD_KEYSTORE` | Play yuklash kaliti (`.jks`), base64: `base64 -w0 upload.jks` |
| `ISH_UPLOAD_KEYSTORE_PASSWORD`, `ISH_UPLOAD_KEY_ALIAS`, `ISH_UPLOAD_KEY_PASSWORD` | o'sha kalitning paroli va nomi |

Kalit bo'lsa, CI ikkala ilovaning Play uchun imzolangan `.aab` faylini ham
`hanguk-ish-ci` prerelease'iga qo'yadi. Versiya raqami — CI ishga tushish
raqami (har yuklashda oshadi). Lokal reliz: `android/key.properties`
(`storeFile`, `storePassword`, `keyAlias`, `keyPassword`; `storeFile`
`android/` papkasiga nisbatan) — commit qilinmaydi.

Kalit yaratish (bir marta; xavfsiz joyda saqlang — yo'qolsa, Play Console
orqali yangi yuklash kalitini so'rashga to'g'ri keladi):

```sh
keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

## Push (P56)

A12 (ishchi) va 알림 (sajangnim) bildirishnomalari ilova yopiq bo'lganda
telefonga keladi: Firebase Cloud Messaging, talaba ilovasining Firebase
loyihasi (`hanguk-consulting`) — server o'sha loyihaning kaliti bilan yuboradi
(`supabase/functions/ish-push`, `hanguk_ish/supabase/README.md`).

- Sozlash (bir marta): Firebase console → `hanguk-consulting` → Add app →
  Android: `uz.hanguk.ish` va `uz.hanguk.ish.biz`; so'ng `google-services.json`
  (ikkala ilova bitta faylda) → `android/app/google-services.json` (commit
  qilinadi, talaba ilovasidagi kabi). Fayl bo'lmasa ilovalar push'siz
  ishlaydi (Gradle plagini faqat fayl bo'lsa qo'llanadi).
- Kirgandan keyin (va har ochilishda kirgan bo'lsa) telefon tokeni
  `register_push_token` ga yoziladi, Firebase yangilasa — qayta; Android 13+
  ruxsati bir marta so'raladi. Chiqishdan oldin token akkauntdan olinadi.
- Matn — A12 / 알림 dagi sarlavha va qator, o'quvchining tilida
  (`profiles.language`). Ilova ochiq bo'lsa push ko'rsatilmaydi (ekranlar
  o'zi yangilanadi). Bosilsa — A12 / 알림 ochiladi.
- Bildirishnoma ikonkasi (status bar uchun oq, shaffof fonli belgi) dizayni
  hali yo'q: hozircha ilova ikonkasi.

## Xodimlar: hanguk.uz → CRM → «Hanguk Ish»

Ilovadan tashqaridagi (Telegram guruh va kanallaridan topilgan) ish
beruvchilar, ularning faqat taklif bilan ochiladigan ishlari, mos ishchilar,
takliflar, tasdiq, davomat va to'lov — hanguk.uz CRM'ida (`src/components/crm/ish/`,
`src/lib/ish/`). Reja: `docs/operator-reja.md`.

Hanguk Ish hanguk.uz'ning o'z Supabase loyihasida (`ish` sxemasi, P48): bo'lim
hanguk.uz'ning klienti va xodimning hanguk.uz sessiyasi bilan ishlaydi —
alohida kirish, SMS kod yoki Vercel o'zgaruvchisi kerak emas.

1. Xodim CRM'ga odatdagidek kiradi va «Hanguk Ish» bo'limini ochadi.
2. Hanguk Ish admini (P58; hozir Asrbek) uni **«Xodimlar»** yorlig'ida qo'shadi:
   ro'yxatdan hanguk.uz CRM xodimini tanlaydi (faqat CRM roli bor akkauntlar —
   talaba, investor yoki ilova akkaunti emas), rolini (Operator / Admin)
   belgilaydi. Hanguk Ish profili o'zi ochiladi (CRM'dagi ismi bilan). Rolini
   o'zgartirish va olib tashlash ham shu yerda; o'zini o'zgartirib yoki olib
   tashlab bo'lmaydi (har doim bitta admin qoladi). Olib tashlanganning profili
   va kiritgan ish beruvchi/ishlari qoladi. Yorliq faqat adminlarga ko'rinadi.
   Ro'yxatda bo'lmasa, bo'lim «Hanguk Ish xodimlari ro'yxatida yo'q» deydi.

«Ilovadagi bizneslar» yorlig'i (P52): sajangnim ilovasida tekshiruvsiz ochilgan
bizneslar (eng yangisi tepada) — holati, ochilgan kuni, smenalar soni (24 soatda
nechta). Xodim haqiqiy nom va manzilni qo'yadi («사업장 XXXX» nomlilar
belgilanadi) va shubhali biznesni to'xtatadi: uning smenalari ishchilar
lentasidan chiqadi, ariza berib bo'lmaydi, yangi smena qo'yilmaydi, sajangnim
BA1 da «Biznes to'xtatilgan» deb ko'radi. Tasdiqlangan ishchilar smenasida
qoladi — ular bilan xodim o'zi bog'lanadi. «Qayta yoqish» hammasini qaytaradi.

«Shikoyatlar» yorlig'i (P52): ishchilar ilovadan yuborgan shikoyatlar (A11) —
ochiqlari tepada, yorliqda ochiqlar soni. Kim yozgani (ismi, telefoni bo'lsa,
nechta smena ishlagani va kelmagani), mavzu va matn; xodim holatini belgilaydi:
Ochiq → Ko'rib chiqilmoqda → Yopilgan. Ishchi ilovada holatni ko'rmaydi; javob
kerak bo'lsa, xodim o'zi bog'lanadi.

## Tuzilma

```
lib/
  app/        ilova ildizi, flavor, router, ishga tushirish
  core/       KST vaqti, won formati, maska va boshqa umumiy mantiq
  design/     prototip tokenlari (rang, radius, soya), shriftlar, ikonlar, vidjetlar
  features/
    worker/   A01–A12 ekranlari
    employer/ BA0–BA5 ekranlari (koreyscha matnlar: employer/ko.dart)
  l10n/       ishchi ilova matnlari (app_uz.arb — shablon; ru, en, ko)
test/
  core/ l10n/ design/ features/   unit va widget testlar
  screens/                        to'liq ekran rasmlari (tag: screens)
tool/
  gen_icons.py          prototip SVG'laridan lib/design/hi_icons.g.dart
  build_fonts.py        Noto Sans KR / JetBrains Mono fayllarini qayta yig'ish
  gen_launcher_icons.py ilova ikonkalari
  push_texts.py         ARB'dan supabase/functions/ish-push/texts.json (push matnlari)
  smoke.sh, smoke_ui.py emulyatorda release APK'lar bilan yurish (ish-smoke.yml)
test_backend/           lokal Supabase'ga qarshi testlar (ish-integration.yml)
supabase/               migratsiyalar, edge funksiyalar, SQL testlar
```

## Testlar

```sh
flutter test --exclude-tags screens            # mantiq va vidjetlar
flutter test --tags screens --update-goldens   # ekran rasmlari → test/screens/goldens
TZ=Asia/Tashkent flutter test --exclude-tags screens   # telefon boshqa vaqt zonasida
bash supabase/tests/run.sh                     # baza: SQL testlar + poyga (PG 15+)
bash supabase/tests/perf.sh                    # baza masshtabda (20 000 ishchi)
```

Ekran testlari prototip kadrida (390×844, status bar 47, pastki chiziq 34)
chiziladi — shu kadrda joylashuv prototip bilan bir xil bo'lishi kerak.

CI (har `ish/*` push'da; natijalar `hanguk-ish-ci` prerelease'ida):

| Workflow | Nima |
|---|---|
| `ish-check.yml` | analyze, unit/widget testlar, ekran rasmlari, Toshkent va Los-Anjeles vaqt zonalarida testlar, ikkala APK |
| `ish-backend.yml` | SQL testlar PG16 va Supabase stack'da, ikki sessiyali poyga testi, masshtab (`tests/perf.sh`), edge funksiyalar (Deno) |
| `ish-integration.yml` | repozitoriylar va ikkala ilovaning ekranlari haqiqiy lokal Supabase'da (`test_backend/`) |
| `ish-smoke.yml` | release APK'lar Android emulyatorida: ochilish, bosish, yiqilish yo'qligi; demo ilovalarda uzun yurish (`tool/smoke.sh`) |

Versiyalar qotirilgan: Flutter 3.47.9, Supabase CLI 3.1.0 (workflow'larda).
Yangisiga o'tishda hammasini birga ko'taring; Flutter 3.47 Android Gradle
Plugin 8.11 / Gradle 8.14 / Kotlin 2.2 qo'llovi tez orada tugashini aytadi —
keyingi Flutter bilan ularni ham ko'tarish kerak bo'ladi.

## Qoidalar

- Har yangi ishchi matni 4 tilda (uz, ru, en, ko) — `test/l10n/arb_test.dart` tekshiradi.
- Vaqt doim Koreya vaqtida (UTC+9) ko'rsatiladi — `core/time/kst.dart`.
- Pul: ishchida `10 500 ₩`, ish beruvchida `10,500원` — `core/money/won.dart`.
