# Hanguk Ish

Koreyada kunlik va qisqa smenali ishlar — talabalar va hamma uchun.
Bitta Flutter kod, ikki Android ilova:

| Ilova | Flavor | applicationId | Til | Kirish nuqtasi |
|---|---|---|---|---|
| «Hanguk Ish» (ishchi) | `worker` | `uz.hanguk.ish` | uz, ru, en, ko | `lib/main_worker.dart` |
| «Hanguk Ish 사장님» (ish beruvchi) | `employer` | `uz.hanguk.ish.biz` | ko | `lib/main_employer.dart` |

Dizayn: Claude Design prototipi (2026-11-10). Reja: loyiha hujjati
`claude/hanguk-ish-qurish-reja.md`.

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
(berilmasa — demo ma'lumotlar).

## Reliz (CI)

GitHub → Settings → Secrets and variables → Actions:

| Secret | Nima uchun |
|---|---|
| `ISH_SUPABASE_URL`, `ISH_SUPABASE_PUBLISHABLE_KEY` | «hanguk-ish» loyihasi (Project Settings → API). Bo'lsa, CI APK'lari shu bazaga ulanadi |
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
```

## Testlar

```sh
flutter test --exclude-tags screens            # mantiq va vidjetlar
flutter test --tags screens --update-goldens   # ekran rasmlari → test/screens/goldens
```

Ekran testlari prototip kadrida (390×844, status bar 47, pastki chiziq 34)
chiziladi — shu kadrda joylashuv prototip bilan bir xil bo'lishi kerak. CI
(`.github/workflows/ish-check.yml`) rasmlarni va ikkala APK'ni `hanguk-ish-ci`
prerelease'iga qo'yadi.

## Qoidalar

- Har yangi ishchi matni 4 tilda (uz, ru, en, ko) — `test/l10n/arb_test.dart` tekshiradi.
- Vaqt doim Koreya vaqtida (UTC+9) ko'rsatiladi — `core/time/kst.dart`.
- Pul: ishchida `10 500 ₩`, ish beruvchida `10,500원` — `core/money/won.dart`.
