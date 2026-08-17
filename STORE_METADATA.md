# App Store Metadata - Multi-Language

This file contains all store descriptions and metadata for Apple App Store and Google Play Store submissions.

> **Every bullet below has to be findable in the shipped app.** App Review
> rejected the 2026-08-07 submission on guideline 2.3 over one line of App
> Store Connect copy — "Compare programs, tuition, location, and scholarship
> eligibility" — because at that time no screen compared tuition or
> scholarship eligibility. Do not paste a feature list into App Store Connect
> that is wider than this file, and do not widen this file ahead of the app.
> See `hanguk_app/store/APP_REVIEW_2026-08-07.md`.
>
> **The compare rows have since grown, and the bullet was widened to match.**
> Commit `0023a97` ("compare on the fee, the dates and the language bar")
> moved Guest Compare onto `approvedCatalogueProvider`, so
> `lib/features/guest/presentation/guest_compare_screen.dart` now renders
> city, tier, IEQAS status, Hanguk partner, website, **tuition, application
> window, document deadline, TOPIK requirement, English-taught, interview**
> and document count. That is reachable without an account: Welcome →
> Explore Universities → add two → Compare. Photographed in
> `hanguk_app/store/listings/screenshots/captured/`.
>
> **Still absent, still not to be claimed:** scholarship eligibility and
> rank. Neither exists on any screen. If either is ever added, widen this
> file first and only then the store copy.
>
> **A row that exists is not a row that is filled** (added 2026-08-17). The
> compare screen renders every field above, but the data behind it is thin,
> measured against production:
>
> | | count |
> | --- | --- |
> | institutions visible on the map | **204** |
> | with any approved admission record | 53 |
> | with an interview answer | 50 |
> | with a TOPIK level | 31 |
> | **with tuition** | **4** |
>
> A reviewer picking two universities off the map sees tuition on both in
> roughly one pair in two thousand. A description that leads with "compare
> tuition" is therefore accurate about the *screen* and misleading about the
> *app*, which is the distinction guideline 2.3 turns on — and this
> submission has already been rejected twice on metadata. The bullets below
> are worded to say which fields depend on a published guideline rather than
> promising all of them for every university.
>
> Widen them back the moment the extraction backlog is drained
> (`.github/workflows/uni-db-drain-backlog.yml` — ~490 field extractions
> failed). Re-run the query in `hanguk_app/store/APP_REVIEW_2026-08-14.md`
> before doing so.

---

## English (Default)

### App Information
- **App Name:** Hanguk Consulting
- **Subtitle:** Study in South Korea
- **Category:** Education
- **Age Rating:** 4+

### Keywords
```
korea,university,study abroad,education,application,student,TOPIK,korean language,admission,visa
```

### Short Description (80 characters)
```
Professional university application support for studying in South Korea.
```

### Full Description
```
Hanguk Consulting helps students apply to universities in South Korea with professional guidance and support.

FEATURES:
• Track your university applications in real-time
• Upload and manage required documents
• Practice for admission interviews with AI
• Browse Korean universities on an interactive map, then compare two of them side by side — city, tier, IEQAS accreditation, partner status and website
• For universities whose admission guideline we have already published, the comparison also shows tuition, the application window, the document deadline, the TOPIK requirement, English-taught tracks and whether an interview is required
• Get personalized AI assistance for your journey
• Multi-language support (Uzbek, Russian, English, Korean)

Whether you're applying for language programs, undergraduate, or graduate studies, Hanguk Consulting provides comprehensive support throughout your application journey.

Start your path to studying in South Korea today!
```

---

## O'zbekcha (Uzbek)

### App Information
- **App Name:** Hanguk Consulting
- **Subtitle:** Janubiy Koreyada o'qish
- **Category:** Ta'lim

### Keywords
```
koreya,universitet,chet elda o'qish,ta'lim,ariza,talaba,TOPIK,koreys tili,qabul,viza
```

### Short Description
```
Janubiy Koreyada o'qish uchun professional universitet ariza yordami.
```

### Full Description
```
Hanguk Consulting talabalarga Janubiy Koreya universitetlariga professional rahbarlik va qo'llab-quvvatlash bilan ariza berishga yordam beradi.

IMKONIYATLAR:
• Universitet arizalaringizni real vaqtda kuzating
• Kerakli hujjatlarni yuklang va boshqaring
• AI bilan qabul suhbatlariga tayyorlaning
• Koreya universitetlarini interaktiv xaritada ko'ring va ikkitasini yonma-yon solishtiring — shahar, daraja, IEQAS akkreditatsiyasi, hamkorlik holati va veb-sayt
• Qabul qo'llanmasi biz tomonidan e'lon qilingan universitetlar uchun taqqoslash o'qish to'lovi, ariza muddati, hujjat topshirish muddati, TOPIK talabi, ingliz tilidagi yo'nalish va suhbat talabini ham ko'rsatadi
• Sayohatingiz uchun shaxsiy AI yordamini oling
• Ko'p tilli qo'llab-quvvatlash (O'zbek, Rus, Ingliz, Koreys)

Til dasturlari, bakalavr yoki magistratura uchun ariza berayotgan bo'lsangiz ham, Hanguk Consulting ariza jarayoni davomida to'liq yordam beradi.

Janubiy Koreyada o'qish yo'lingizni bugun boshlang!
```

---

## Русский (Russian)

### App Information
- **App Name:** Hanguk Consulting
- **Subtitle:** Обучение в Южной Корее
- **Category:** Образование

### Keywords
```
корея,университет,учеба за рубежом,образование,заявка,студент,TOPIK,корейский язык,поступление,виза
```

### Short Description
```
Профессиональная помощь в подаче заявок в университеты Южной Кореи.
```

### Full Description
```
Hanguk Consulting помогает студентам подавать заявки в университеты Южной Кореи с профессиональным руководством и поддержкой.

ВОЗМОЖНОСТИ:
• Отслеживайте ваши заявки в университеты в реальном времени
• Загружайте и управляйте необходимыми документами
• Практикуйте собеседования с ИИ
• Смотрите корейские университеты на интерактивной карте и сравнивайте два из них рядом — город, уровень, аккредитация IEQAS, партнёрский статус и сайт
• Для университетов, чьи правила приёма мы уже опубликовали, сравнение также показывает стоимость обучения, сроки подачи, срок подачи документов, требование TOPIK, обучение на английском и наличие собеседования
• Получайте персональную помощь ИИ
• Многоязычная поддержка (Узбекский, Русский, Английский, Корейский)

Независимо от того, подаете ли вы заявку на языковые программы, бакалавриат или магистратуру, Hanguk Consulting обеспечивает полную поддержку на протяжении всего процесса подачи заявки.

Начните свой путь к обучению в Южной Корее сегодня!
```

---

## 한국어 (Korean)

### App Information
- **App Name:** 한국 컨설팅 (Hanguk Consulting)
- **Subtitle:** 한국 유학 안내
- **Category:** 교육

### Keywords
```
한국,대학,유학,교육,지원,학생,TOPIK,한국어,입학,비자
```

### Short Description
```
한국 대학 진학을 위한 전문 입학 지원 서비스.
```

### Full Description
```
Hanguk Consulting은 전문적인 안내와 지원으로 한국 대학 진학을 돕습니다.

기능:
• 대학 지원 현황을 실시간으로 추적
• 필요한 서류를 업로드하고 관리
• AI와 함께 입학 면접 연습
• 인터랙티브 지도에서 한국 대학을 둘러보고 두 곳을 나란히 비교 — 도시, 등급, IEQAS 인증, 제휴 여부, 웹사이트
• 모집요강을 이미 게시한 대학의 경우 등록금, 원서접수 기간, 서류 마감, TOPIK 요건, 영어 트랙, 면접 여부까지 함께 비교
• 맞춤형 AI 지원 서비스
• 다국어 지원 (우즈베크어, 러시아어, 영어, 한국어)

어학연수, 학부, 대학원 과정에 지원하시든, Hanguk Consulting은 지원 과정 전반에 걸쳐 포괄적인 지원을 제공합니다.

오늘 한국 유학의 첫 걸음을 시작하세요!
```

---

## URLs

- **Privacy Policy:** https://hanguk.uz/privacy
- **Terms of Service:** https://hanguk.uz/terms
- **Support URL:** https://hanguk.uz/support
- **Marketing URL:** https://hanguk.uz

---

## Assets Location

| Asset | File Path | Dimensions |
|-------|-----------|------------|
| App Icon | `public/icon-1024.png` | 1024×1024 |
| Splash Screen | `public/splash-2732.png` | 1920×1920 |
| Store screenshots | `hanguk_app/store/listings/screenshots/captured/` | 1320×2868 (6.9" iPhone) |

> The twelve files that used to sit in `public/screenshots/` were **deleted on
> 2026-08-12**. They were AI-generated marketing renders — a phone bezel drawn
> around an invented blue-and-white UI, headline text over a gradient, and
> body copy that was not real words ("Futtless Tracks", "Prqdnaction"). They
> showed no part of this app, which is dark navy and lime. They were also
> JPEGs carrying a `.png` extension, at 1024×1920 and 1088×1920 — not a size
> any iPhone has.
>
> Uploading them is what failed guideline 2.3.3 on 2026-08-05 and again on
> 2026-08-12. Do not restore them or anything like them. Capture real frames
> with `hanguk_app/tools/store/capture_screenshots.cjs`.

---

## Screenshot Order (Recommended)

**Never lead with Welcome or Login.** Apple does not count a splash,
welcome or sign-in screen as the app in use, and an order that opened with
those two is what drew the 2.3.3 rejections. They must not appear in the set
at all.

1. **Map** — the national university map, markers plotted
2. **Explore** — the searchable institution list with city filters
3. **Compare** — two universities side by side, both columns filled
4. **Documents** — uploaded application documents, list populated
5. **Study Plan** — a plan with its generated steps
6. **Interview** — an active session with a live transcript

Every frame must be a real capture from a signed-in session with real data.
An empty tab reads as functionality the reviewer could not reach, which
draws the same rejection by another name. Full capture list and rules:
`hanguk_app/store/listings/screenshots/README.md`.

---

## App Store Notes

### Apple App Store
- Screenshots must be **1320×2868** (6.9" iPhone, the required size). Flattened PNG, no alpha channel
- Leave **every iPad size empty** — the app is iPhone-only (`TARGETED_DEVICE_FAMILY = "1"`)
- Sweep every size through **View All Sizes in Media Manager**, in every locale
- App icon must have NO transparency
- Subtitle limited to 30 characters
- Keywords limited to 100 characters total

### Google Play Store
- Reuse the captured phone screenshots (1320×2868 is within Play's limits)
- Short description limited to 80 characters
- Full description limited to 4000 characters
- Feature graphic recommended: 1024×500

---

## Contact Information

- **Developer Name:** Hanguk Consulting
- **Support Email:** support@hanguk.uz
- **Website:** https://hanguk.uz
