# Hanguk Ish

Koreyada kunlik va qisqa smenali ishlar — talabalar va hamma uchun.
Bitta Flutter kod, ikki Android ilova:

| Ilova | Flavor | applicationId | Til | Kirish nuqtasi |
|---|---|---|---|---|
| «Hanguk Ish» (ishchi) | `worker` | `uz.hanguk.ish` | uz, ru, en, ko | `lib/main_worker.dart` |
| «Hanguk Ish 사장님» (ish beruvchi) | `employer` | `uz.hanguk.ish.biz` | ko | `lib/main_employer.dart` |

Dizayn: Claude Design prototipi (2026-11-10). Reja: loyiha hujjati
`claude/hanguk-ish-qurish-reja.md`.

Kirish (P49, P50 — Asrbek qarori): SMS ham, biznes raqami ham yo'q. A01
«Boshlash» va BA0 «시작하기» telefonda anonim akkaunt ochadi (Supabase anonymous
sign-in, `user_metadata.app = 'hanguk_ish'`); prototipdagi «Telefon raqam bilan» /
«Telegram bilan», T1/T2, BA0'dagi telefon va 사업자등록번호 maydonlari olib
tashlangan. Sajangnimning biznesi «시작하기» da darhol, tekshiruvsiz ochiladi
(`ish.open_business`, nomi «사업장 XXXX») va shu zahoti smena joylay oladi.
Akkaunt telefonda saqlanadi: ilova o'chirilsa, yangi akkaunt ochiladi.

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

## Xodimlar: hanguk.uz → CRM → «Hanguk Ish»

Ilovadan tashqaridagi (Telegram guruh va kanallaridan topilgan) ish
beruvchilar, ularning faqat taklif bilan ochiladigan ishlari, mos ishchilar,
takliflar, tasdiq, davomat va to'lov — hanguk.uz CRM'ida (`src/components/crm/ish/`,
`src/lib/ish/`). Reja: `docs/operator-reja.md`.

Hanguk Ish hanguk.uz'ning o'z Supabase loyihasida (`ish` sxemasi, P48): bo'lim
hanguk.uz'ning klienti va xodimning hanguk.uz sessiyasi bilan ishlaydi —
alohida kirish, SMS kod yoki Vercel o'zgaruvchisi kerak emas.

1. Xodim CRM'ga odatdagidek kiradi va «Hanguk Ish» bo'limini ochadi.
2. Admin uni Hanguk Ish xodimi qiladi (Supabase → SQL Editor; hanguk.uz akkaunti email'i).
   Avval Hanguk Ish profili (xodim yaratgan ish beruvchilar va eslatmalar unga
   bog'lanadi; email bilan kirganlarda u o'zi paydo bo'lmaydi), keyin xodim qatori:

   ```sql
   insert into ish.profiles (id)
   select id from auth.users where email = 'xodim@hanguk.local'
   on conflict (id) do nothing;
   insert into ish.staff_members (user_id)
   select id from auth.users where email = 'xodim@hanguk.local';
   ```

   Olib tashlash: `delete from ish.staff_members where user_id = …;`
   Ro'yxatda bo'lmasa, bo'lim «Hanguk Ish xodimlari ro'yxatida yo'q» deydi.

«Ilovadagi bizneslar» yorlig'i (P52): sajangnim ilovasida tekshiruvsiz ochilgan
bizneslar (eng yangisi tepada) — holati, ochilgan kuni, smenalar soni (24 soatda
nechta). Xodim haqiqiy nom va manzilni qo'yadi («사업장 XXXX» nomlilar
belgilanadi) va shubhali biznesni to'xtatadi: uning smenalari ishchilar
lentasidan chiqadi, ariza berib bo'lmaydi, yangi smena qo'yilmaydi, sajangnim
BA1 da «Biznes to'xtatilgan» deb ko'radi. Tasdiqlangan ishchilar smenasida
qoladi — ular bilan xodim o'zi bog'lanadi. «Qayta yoqish» hammasini qaytaradi.

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
