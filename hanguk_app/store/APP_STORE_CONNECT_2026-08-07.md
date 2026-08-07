# Paste-ready App Store Connect copy — resubmission after 2026-08-07

Everything below is written to be **copied into App Store Connect as-is**. It
exists because the 2026-08-07 rejection (guideline 2.3) was caused by one
sentence in the live listing — "Compare programs, tuition, location, and
scholarship eligibility" — that names a feature the app does not have. See
`APP_REVIEW_2026-08-07.md` for why.

Rules that produced this text:

- Nothing here claims a tuition or scholarship **comparison**. The compare
  screen a user can reach shows city, tier, IEQAS accreditation and partner
  status; that is what the copy says.
- Nothing here claims a feature reachable only by deep link.
- The four languages say the same thing. Apple reads them all.

---

## 0. Field-by-field checklist

| Where in App Store Connect | What to set | Source below |
|---|---|---|
| App Information → **Support URL** | `https://hanguk.uz/support` | § 1 |
| App Information → Marketing URL | `https://hanguk.uz` (optional) | — |
| Version → **Description**, each language | replace in full | § 2 |
| Version → **Promotional Text**, each language | replace in full | § 3 |
| Version → **What's New**, each language | replace in full | § 4 |
| Version → **Screenshots** | no caption naming tuition/scholarship comparison | § 5 |
| Version → Build | a build containing the iPhone-only fix | § 5 |
| App Review Information | demo Magic Code + login note | `APP_REVIEW_2026-08-05.md` § 2 |

Do not skip a language. A corrected English description with the old Russian
one still live is the same rejection again.

---

## 1. Support URL

```
https://hanguk.uz/support
```

Served by `src/pages/Support.tsx`. It must be deployed and publicly reachable
**before** you resubmit — open it in a private browser window and confirm it
loads without a login. Set the same URL on the Play listing.

---

## 2. Description

### English

```
Hanguk Consulting helps students apply to universities in South Korea with professional guidance and support.

FEATURES:
• Track your university applications in real-time
• Upload and manage required documents
• Practice for admission interviews with an AI interviewer
• Browse Korean universities on an interactive map, then compare two of them side by side (city, tier, IEQAS accreditation, partner status)
• Build a step-by-step study plan with AI feedback
• Chat with your consultant without leaving the app
• Multi-language support (Uzbek, Russian, English, Korean)

Whether you're applying for language programs, undergraduate, or graduate studies, Hanguk Consulting provides support throughout your application journey.

Start your path to studying in South Korea today!
```

### O'zbekcha

```
Hanguk Consulting talabalarga Janubiy Koreya universitetlariga professional rahbarlik va qo'llab-quvvatlash bilan ariza berishga yordam beradi.

IMKONIYATLAR:
• Universitet arizalaringizni real vaqtda kuzating
• Kerakli hujjatlarni yuklang va boshqaring
• AI suhbatdosh bilan qabul suhbatlariga tayyorlaning
• Koreya universitetlarini interaktiv xaritada ko'ring va ikkitasini yonma-yon solishtiring (shahar, daraja, IEQAS akkreditatsiyasi, hamkorlik holati)
• AI izohlari bilan bosqichma-bosqich o'quv rejasini tuzing
• Konsultantingiz bilan ilovadan chiqmasdan yozishing
• Ko'p tilli qo'llab-quvvatlash (O'zbek, Rus, Ingliz, Koreys)

Til dasturlari, bakalavr yoki magistratura uchun ariza berayotgan bo'lsangiz ham, Hanguk Consulting ariza jarayoni davomida yordam beradi.

Janubiy Koreyada o'qish yo'lingizni bugun boshlang!
```

### Русский

```
Hanguk Consulting помогает студентам подавать документы в университеты Южной Кореи с профессиональным сопровождением.

ВОЗМОЖНОСТИ:
• Отслеживайте ваши заявки в университеты в реальном времени
• Загружайте и управляйте необходимыми документами
• Готовьтесь к вступительным собеседованиям с ИИ-интервьюером
• Смотрите корейские университеты на интерактивной карте и сравнивайте два из них рядом (город, уровень, аккредитация IEQAS, партнёрский статус)
• Составляйте пошаговый учебный план с подсказками ИИ
• Общайтесь с вашим консультантом, не выходя из приложения
• Многоязычная поддержка (узбекский, русский, английский, корейский)

Независимо от того, подаёте ли вы заявку на языковые программы, бакалавриат или магистратуру, Hanguk Consulting сопровождает вас на всём пути.

Начните свой путь к обучению в Южной Корее сегодня!
```

### 한국어

```
Hanguk Consulting은 한국 대학 지원을 준비하는 학생들을 전문적으로 지원합니다.

주요 기능:
• 대학 지원 현황을 실시간으로 추적
• 필요한 서류를 업로드하고 관리
• AI 면접관과 입학 면접 연습
• 인터랙티브 지도에서 한국 대학을 둘러보고 두 곳을 나란히 비교 (도시, 등급, IEQAS 인증, 제휴 여부)
• AI 피드백과 함께 단계별 학습 계획 수립
• 앱 안에서 담당 컨설턴트와 채팅

어학연수, 학부, 대학원 과정 어디에 지원하시든 Hanguk Consulting이 지원 과정 전반을 함께합니다.

오늘 한국 유학의 첫 걸음을 시작하세요!
```

---

## 3. Promotional Text (170 characters max)

### English

```
Plan your Korean university application, practise the admissions interview with an AI interviewer, and explore Korean universities on an interactive map — in one app.
```

### O'zbekcha

```
Koreya universitetiga arizangizni rejalashtiring, AI suhbatdosh bilan qabul suhbatiga tayyorlaning va universitetlarni interaktiv xaritada ko'ring — bitta ilovada.
```

### Русский

```
Планируйте поступление в корейский университет, тренируйте собеседование с ИИ и смотрите университеты на интерактивной карте — всё в одном приложении.
```

### 한국어

```
한국 대학 지원을 계획하고, AI 면접관과 입학 면접을 연습하고, 인터랙티브 지도에서 대학을 살펴보세요. 모두 한 앱에서.
```

---

## 4. What's New

Same text in every language slot, translated. It is still the first public
version, so it describes the app rather than a change list.

### English

```
This is the first release of Hanguk.

- Track your university applications and required documents in one place.
- Practise the admissions interview with an AI interviewer and get feedback.
- Build a step-by-step study plan with AI guidance.
- Browse Korean universities on an interactive map and compare two side by side.
- Chat with your consultant inside the app.
- Delete your account and your data from the Account screen at any time.
```

### O'zbekcha

```
Bu — Hanguk ilovasining birinchi versiyasi.

- Universitet arizalaringiz va hujjatlaringizni bitta joyda kuzating.
- AI suhbatdosh bilan qabul suhbatiga tayyorlaning va izoh oling.
- AI yordamida bosqichma-bosqich o'quv rejasini tuzing.
- Koreya universitetlarini interaktiv xaritada ko'ring, ikkitasini yonma-yon solishtiring.
- Konsultantingiz bilan ilova ichida yozishing.
- Akkaunt ekranidan akkauntingizni va ma'lumotlaringizni istalgan vaqtda o'chiring.
```

### Русский

```
Это первый выпуск приложения Hanguk.

- Отслеживайте заявки и документы в одном месте.
- Тренируйте вступительное собеседование с ИИ и получайте обратную связь.
- Составляйте пошаговый учебный план с помощью ИИ.
- Смотрите корейские университеты на карте и сравнивайте два из них рядом.
- Общайтесь с консультантом внутри приложения.
- Удаляйте аккаунт и данные из экрана «Аккаунт» в любой момент.
```

### 한국어

```
Hanguk의 첫 번째 릴리스입니다.

- 대학 지원 현황과 서류를 한곳에서 관리하세요.
- AI 면접관과 입학 면접을 연습하고 피드백을 받으세요.
- AI 도움을 받아 단계별 학습 계획을 세우세요.
- 인터랙티브 지도에서 한국 대학을 둘러보고 두 곳을 나란히 비교하세요.
- 앱 안에서 담당 컨설턴트와 대화하세요.
- 계정 화면에서 언제든 계정과 데이터를 삭제할 수 있습니다.
```

---

## 5. Build and screenshots

- **Build.** `pubspec.yaml` is bumped to `1.0.27+2044`, so the next archive
  carries a build number App Store Connect has not seen. Build it per
  `docs/RELEASE_IOS.md` and confirm `UIDeviceFamily` prints `[1]` — review ran
  on 2042, which predates the iPhone-only fix, on an iPad Air.

  ```bash
  cd hanguk_app
  flutter build ipa --release --dart-define=STORE_BUILD=true
  /usr/libexec/PlistBuddy -c "Print :UIDeviceFamily" \
    build/ios/iphoneos/Runner.app/Info.plist
  ```

- **Screenshots.** A caption is metadata under guideline 2.3 — no frame may be
  captioned with a tuition or scholarship comparison. Capture rules and the
  screen list: `store/listings/screenshots/README.md`. Also sweep
  **Previews and Screenshots → View All Sizes in Media Manager** and clear
  leftovers from sizes you are not uploading.

- **Reply to App Review.** Text ready to send in
  `APP_REVIEW_2026-08-07.md` § 4 — send it after the Support URL is live and
  the description is corrected, not before.
