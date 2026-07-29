// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Uzbek (`uz`).
class AppLocalizationsUz extends AppLocalizations {
  AppLocalizationsUz([String locale = 'uz']) : super(locale);

  @override
  String get trainingTabTitle => 'Tayyorgarlik markazi';

  @override
  String get trainingTabSubtitle =>
      'Universitet arizalaringizni sun\'iy intellekt yordamida mashq qiling.';

  @override
  String get studyPlanCardTitle => 'Study Plan tuzish';

  @override
  String get studyPlanCardDesc =>
      'O\'qish maqsadlaringiz uchun ishonchli reja tuzing.';

  @override
  String get personalStatementCardTitle => 'Personal Statement';

  @override
  String get personalStatementCardDesc =>
      'Samarali va jozibali shaxsiy insho yozing.';

  @override
  String get interviewCardTitle => 'Suhbatga tayyorgarlik';

  @override
  String get interviewCardDesc =>
      'Sinov savollari bilan mashq qiling va o\'zingizga ishonchni mustahkamlang.';

  @override
  String get applyCta => 'Universitetga ariza topshirish';

  @override
  String get noApplicationsTitle => 'Hozircha arizalar yo\'q';

  @override
  String get noApplicationsBody =>
      'Avval maqsadli universitetni qo\'shing — insho yozish u yerdan boshlanadi.';

  @override
  String get startInterview => 'Suhbatni boshlash';

  @override
  String get cancel => 'Bekor qilish';

  @override
  String get endInterview => 'Suhbatni tugatish';

  @override
  String get endSession => 'Sessiyani tugatish';

  @override
  String get practiceAgain => 'Yana mashq qilish';

  @override
  String get connecting => 'Ulanmoqda...';

  @override
  String get greetWait => 'Ulanmoqda — intervyuer tez orada salomlashadi...';

  @override
  String get yourTurn => 'Javob berish navbatingiz';

  @override
  String get aiSpeaking => 'Intervyuer gapirmoqda...';

  @override
  String get wrappingUp => 'Suhbat yakunlanmoqda...';

  @override
  String get micRequired => 'Suhbat uchun mikrofon ruxsati kerak.';

  @override
  String get walkaroundLoadingTitle => 'Loading campus walkaround';

  @override
  String get walkaroundLoadingSubtitle => 'Fetching street view near campus.';

  @override
  String get walkaroundNoPanoTitle => 'No street view here';

  @override
  String get walkaroundNoPanoSubtitle =>
      'This campus doesn\'t have a walkable street view nearby.';

  @override
  String get walkaroundBlockedTitle => 'Street view unavailable';

  @override
  String get walkaroundBlockedSubtitle =>
      'The map provider blocked this request. Try again on a different network.';

  @override
  String get walkaroundNetworkTitle => 'Couldn\'t reach the map provider';

  @override
  String get walkaroundNetworkSubtitle =>
      'Check your connection and try again.';

  @override
  String get walkaroundInitErrorTitle => 'Street view couldn\'t start';

  @override
  String get walkaroundInitErrorSubtitle =>
      'Something went wrong starting the walkaround. Please try again.';

  @override
  String get virtualTourTitle => 'Virtual Tour';

  @override
  String get virtualWalkaroundTitle => 'Virtual Walkaround';

  @override
  String get visitUniversityWebsite => 'Universitet veb-saytiga o\'tish';

  @override
  String universityTier(int tier) {
    return 'Daraja $tier';
  }

  @override
  String get universityVerified => 'Tasdiqlangan';

  @override
  String get universityNextEvent => 'Keyingi tadbir';

  @override
  String get navApplications => 'Arizalar';

  @override
  String get navMap => 'Xarita';

  @override
  String get navDocs => 'Hujjatlar';

  @override
  String get navTraining => 'Tayyorgarlik';

  @override
  String get applicationsTabTitle => 'Arizalarim';

  @override
  String get mapTabTitle => 'Universitetlar';

  @override
  String get documentsTabTitle => 'Hujjatlarim';

  @override
  String get documentUploadInfo =>
      'Asl hujjatlaringizning to‘g‘ri PDF yoki JPEG nusxalarini yuklang. Har bir fayl uchun eng ko‘pi 10MB.';

  @override
  String get documentsRequiredHeading => 'Kerakli hujjatlar';

  @override
  String get documentUploadFailed =>
      'Hujjatingizni yuklab bo‘lmadi. Iltimos, qayta urinib ko‘ring.';

  @override
  String get documentPreviewFailed =>
      'Hujjatni ochib bo‘lmadi. Iltimos, qayta urinib ko‘ring.';

  @override
  String get documentLoadError => 'Hujjatlaringizni yuklab bo‘lmadi.';

  @override
  String get commonRetry => 'Qayta urinish';

  @override
  String get onboardingSkip => 'O\'tkazib yuborish';

  @override
  String get onboardingNext => 'Keyingi';

  @override
  String get onboardingStart => 'Boshlash';

  @override
  String get onboardingStep1Title => 'Arizalaringizni kuzating';

  @override
  String get onboardingStep1Body =>
      'Har bir universitet arizasini hujjatlardan qarorgacha bitta joyda kuzating.';

  @override
  String get onboardingStep2Title =>
      'Universitetlarni o\'rganing va hujjat yuklang';

  @override
  String get onboardingStep2Body =>
      'Universitetlarni xaritada toping va har biri uchun kerakli hujjatlarni xavfsiz yuklang.';

  @override
  String get onboardingStep3Title => 'AI bilan suhbatga tayyorlaning';

  @override
  String get onboardingStep3Body =>
      'AI murabbiy bilan koreys universitetlari suhbatlarini mashq qiling va darhol fikr-mulohaza oling.';

  @override
  String get appsEmptyTitle => 'Hozircha arizalar yo\'q';

  @override
  String get appsEmptyBody =>
      'Universitetga ariza topshirganingizdan so\'ng arizalaringiz shu yerda ko\'rinadi.';

  @override
  String get appsLoadError => 'Arizalaringizni yuklab bo\'lmadi.';

  @override
  String get appsPendingHeading => 'Kutilayotgan arizalar';

  @override
  String get appsActiveHeading => 'Faol arizalar';

  @override
  String get searchHint => 'Qidirish...';

  @override
  String get clearSearch => 'Qidiruvni tozalash';

  @override
  String get filterAll => 'Hammasi';

  @override
  String get filterPartner => 'Hamkor';

  @override
  String get filterTop => 'Top';

  @override
  String get noUniversitiesMatch => 'Bu filtrga mos universitet yo\'q';

  @override
  String get clearFilters => 'Filtrlarni tozalash';

  @override
  String get universitiesLoadError => 'Universitetlarni yuklab bo\'lmadi';

  @override
  String get checkConnectionRetry =>
      'Internetni tekshirib, qayta urinib ko\'ring';

  @override
  String get switchToListView => 'Ro\'yxat ko\'rinishiga o\'tish';

  @override
  String get switchToMapView => 'Xarita ko\'rinishiga o\'tish';

  @override
  String get chatInputHint =>
      'Janubiy Koreya haqida xohlagan savolingizni bering...';

  @override
  String get accountTooltip => 'Hisob';

  @override
  String get ok => 'OK';

  @override
  String get loadingLabel => 'Yuklanmoqda...';

  @override
  String get accountBackTooltip => 'Orqaga';

  @override
  String get accountTitle => 'Hisob';

  @override
  String get accountSignedInAs => 'Tizimga kirgan hisob';

  @override
  String get accountUnknownAccount => '(noma\'lum hisob)';

  @override
  String get accountSessionLabel => 'Sessiya';

  @override
  String get accountSigningOut => 'Chiqilmoqda...';

  @override
  String get accountSignOut => 'Tizimdan chiqish';

  @override
  String get accountYourDataLabel => 'Sizning ma\'lumotlaringiz';

  @override
  String get accountYourDataBody =>
      'Hanguk saqlab turgan barcha hisob ma\'lumotlaringizning — profil, arizalar, o\'quv rejalari, qoralamalar, intervyu seanslari va izohlar — JSON nusxasini yuklab oling.';

  @override
  String get accountPreparingExport => 'Eksport tayyorlanmoqda...';

  @override
  String get accountDownloadMyData => 'Ma\'lumotlarimni yuklab olish';

  @override
  String get accountDangerZoneLabel => 'Xavfli zona';

  @override
  String get accountDangerZoneBody =>
      'Hisobni o\'chirish qaytarib bo\'lmaydigan amaldir. Profilingiz, arizalaringiz, o\'quv rejalaringiz, motivatsion xat qoralamalari, intervyu seanslari va yozuvlaringiz butunlay o\'chiriladi. Saqlangan hujjatlar 30 kun ichida, zaxira nusxalari esa 90 kun ichida muddati tugaydi.';

  @override
  String get accountDeleteAccount => 'Hisobni o\'chirish';

  @override
  String get accountPrivacyPolicy => 'Maxfiylik siyosati';

  @override
  String get accountTermsOfService => 'Foydalanish shartlari';

  @override
  String get accountDeleteErrorTitle => 'Hisob o\'chirilmadi';

  @override
  String accountDeleteErrorBody(Object error) {
    return 'Ma\'lumotlaringizni o\'chirishda xatolik yuz berdi:\n\n$error\n\nO\'chirishni yakunlay olishimiz uchun privacy@hanguk.uz manziliga email yuboring.';
  }

  @override
  String accountExportFailed(Object error) {
    return 'Eksport amalga oshmadi: $error';
  }

  @override
  String get accountDeleteDialogTitle => 'Hisobingizni o\'chirib tashlaysizmi?';

  @override
  String get accountDeleteDialogBody =>
      'Bu hisobingizni, arizalaringizni, o\'quv rejalaringizni, motivatsion xat qoralamalarini, intervyu seanslari va yozuvlarini butunlay o\'chirib tashlaydi.\n\nTasdiqlash uchun DELETE deb yozing.';

  @override
  String get accountDeleteDialogConfirm => 'Butunlay o\'chirish';

  @override
  String get accountDeleteProgress => 'Hisob o\'chirilmoqda...';

  @override
  String get loginStudentPortal => 'Talaba portali';

  @override
  String get loginAccessCodeHelp =>
      'Konsultantingiz yoki universitet vakili bergan 8 belgili kirish kodini (harflar va raqamlar) kiriting.';

  @override
  String get loginAccessCodeButton => 'Kirish kodi orqali kirish';

  @override
  String get loginSwitchToPhone => '← Telefon raqami orqali kirmoqchiman';

  @override
  String get loginComingSoonTitle => 'Tez orada';

  @override
  String get loginComingSoonBody =>
      'Tizimlarimiz yangilanayotgani sababli ommaviy ro\'yxatdan o\'tish va telefon orqali kirish vaqtincha to\'xtatildi.\n\nTalabalar: hozircha sehrli kirish kodingiz bilan tizimga kiring.';

  @override
  String get loginSwitchToMagicCode => 'Sehrli kod orqali kirishga o\'tish';

  @override
  String get loginErrorInvalidPhone =>
      'Iltimos, to\'g\'ri telefon raqamini kiriting (masalan, +12345678).';

  @override
  String get loginErrorPasswordTooShort =>
      'Parol kamida 6 ta belgidan iborat bo\'lishi kerak.';

  @override
  String get loginErrorInvalidCredentials =>
      'Telefon raqami yoki parol noto\'g\'ri.';

  @override
  String get loginErrorInvalidAccessCode =>
      'Iltimos, to\'g\'ri kirish kodini kiriting (kamida 6 belgi).';

  @override
  String get signUpErrorNameRequired => 'To\'liq ismni kiritish shart.';

  @override
  String get signUpErrorPhoneRequired =>
      'To\'g\'ri telefon raqami kerak (masalan, +12345678).';

  @override
  String get signUpErrorPasswordMismatch => 'Parollar mos kelmadi.';

  @override
  String get signUpSuccess => 'Hisob yaratildi! Iltimos, tizimga kiring.';

  @override
  String get notifSettingsTitle => 'Bildirishnoma sozlamalari';

  @override
  String get notifSettingsEmptyTitle => 'Hali kuzatilayotgan universitet yo\'q';

  @override
  String get notifSettingsEmptyBody =>
      'Universitet sahifasida \"Bu muassasani kuzatish\"ni bosib obuna bo\'ling. Kamida bitta kuzatuv qo\'shilgach, bildirishnoma sozlamalari shu yerda paydo bo\'ladi.';

  @override
  String get notifSettingsCalendar => 'Taqvim o\'zgarishlari';

  @override
  String get notifSettingsCalendarDesc => 'Muddat sanalari o\'zgarsa';

  @override
  String get notifSettingsCorrection => 'Tuzatish e\'lonlari';

  @override
  String get notifSettingsCorrectionDesc =>
      '정정공고 e\'lon qilindi — eng yuqori ustuvorlik';

  @override
  String get notifSettingsRequirement => 'Talab o\'zgarishlari';

  @override
  String get notifSettingsRequirementDesc =>
      'TOPIK / GPA / til imtihoni qoidalari o\'zgarsa';

  @override
  String get notifSettingsScholarship => 'Stipendiya yangiliklari';

  @override
  String get notifSettingsScholarshipDesc =>
      'Standart bo\'yicha o\'chirilgan — ko\'p bildirishnoma keladi';

  @override
  String notifSettingsLoadError(Object error) {
    return 'Xato: $error';
  }

  @override
  String notifSettingsPushLanguage(String lang) {
    return 'Push bildirishnoma tili: $lang';
  }

  @override
  String notifSettingsUpdateError(Object error) {
    return 'Sozlamani yangilab bo\'lmadi: $error';
  }

  @override
  String get interviewDialogStepUniversity =>
      '1. Maqsadli universitetni tanlang';

  @override
  String get interviewDialogStepTrack => '2. Suhbat tilini tanlang';

  @override
  String get interviewDialogStepPersona => '3. Suhbatdosh tipi';

  @override
  String get interviewNoAppsBody =>
      'Avval maqsadli universitetni qo\'shing — suhbat mashqi o\'sha maktabga moslab boriladi.';

  @override
  String get trackKorean => 'Koreyscha';

  @override
  String get trackEnglish => 'Inglizcha';

  @override
  String get personaFriendly => 'Do\'stona qabul xodimi';

  @override
  String get personaStrict => 'Qattiqqo\'l professor';

  @override
  String get personaImpatient => 'Sabri yo\'q viza xodimi';

  @override
  String get personaFriendlyCaps => 'Do\'stona qabul xodimi';

  @override
  String get personaStrictCaps => 'Qattiqqo\'l professor';

  @override
  String get personaImpatientCaps => 'Sabri yo\'q viza xodimi';

  @override
  String get micBlockedInSettings => 'Mikrofon tizim sozlamalarida bloklangan.';

  @override
  String get openSettings => 'Sozlamalarni ochish';

  @override
  String genericError(Object error) {
    return 'Xato: $error';
  }

  @override
  String errorLoadingApplications(Object error) {
    return 'Arizalarni yuklab bo\'lmadi: $error';
  }

  @override
  String get noAppsInlineHint =>
      'Hozircha arizalar yo\'q — Arizalar tabidan qo\'shing.';

  @override
  String get aiStatusWaiting => 'Kiritishni kutmoqda...';

  @override
  String get aiStatusCoolingDown => 'AI dam olmoqda…';

  @override
  String get aiStatusAnalyzing => 'AI tahlil qilmoqda...';

  @override
  String get aiStatusReady => 'Tayyor';

  @override
  String get aiStatusPredicting => 'AI taklif bermoqda...';

  @override
  String get aiStatusSupervisionActive => 'AI nazorati faol';

  @override
  String get workspaceTitle => 'Ish maydoni';

  @override
  String get workspaceAnalyzeButton => 'Tahlil';

  @override
  String get aiSupervisionWarningsTitle => 'AI nazorat ogohlantirishlari:';

  @override
  String grammarReplaceWith(String original, String suggestion) {
    return '\"$original\" o\'rniga \"$suggestion\" yozing';
  }

  @override
  String draftingHint(String documentTitle) {
    return '$documentTitle matnini shu yerga yozing...';
  }

  @override
  String get ghostSuggestionSemantics => 'AI taklifi — qo\'yish uchun bosing';

  @override
  String get ghostAccept => 'Qabul qilish';

  @override
  String get ghostDismiss => 'Taklifni yopish';

  @override
  String get pastDraftsTooltip => 'Avvalgi qoralamalar';

  @override
  String get sessionSettingsTooltip => 'Sessiya sozlamalari';

  @override
  String get switchTrackEnglish => 'Til → Inglizcha';

  @override
  String get switchTrackKorean => 'Til → Koreyscha';

  @override
  String get createNewSession => 'Yangi sessiya yaratish';

  @override
  String get yourSavedDrafts => 'Saqlangan qoralamalar';

  @override
  String get noPreviousDrafts => 'Avvalgi qoralamalar topilmadi.';

  @override
  String get generalDraftLabel => 'Umumiy';

  @override
  String get studyPlanDocumentName => 'Study Plan';

  @override
  String get personalStatementDocumentName => 'Personal Statement';

  @override
  String savedDraftItemTitle(String universityName, String documentName) {
    return '$universityName $documentName';
  }

  @override
  String sessionStatusLabel(String status) {
    return 'Holat: $status';
  }

  @override
  String get deleteSessionTitle => 'Sessiyani o\'chirish';

  @override
  String get deleteSessionBody =>
      'Ushbu sessiyani o\'chirib tashlamoqchimisiz? Bu amalni qaytarib bo\'lmaydi.';

  @override
  String get deleteLabel => 'O\'chirish';

  @override
  String get stepperLabelGuide => 'Qo\'llanma';

  @override
  String get stepperLabelExample => 'Namuna';

  @override
  String get stepperLabelDraft => 'Qoralama';

  @override
  String get stepperLabelFeedback => 'Izoh';

  @override
  String get readExamplesButton => 'Namunalarni ko\'rish';

  @override
  String get targetUniversityLabel => 'Maqsadli universitet';

  @override
  String get startDraftingButton => 'Yozishni boshlash';

  @override
  String get newStudyPlanDialogTitle => 'Yangi Study Plan';

  @override
  String get newPersonalStatementDialogTitle => 'Yangi Personal Statement';

  @override
  String get selectTargetUniversityStep => '1. Maqsadli universitetni tanlang';

  @override
  String get selectLanguageTrackStep => '2. Yozish tilini tanlang';

  @override
  String get createSession => 'Sessiya yaratish';

  @override
  String get aiExampleEmbassyTitle => 'Elchixona uchun namuna';

  @override
  String aiExampleUniversityTitle(String universityName) {
    return '$universityName uchun namuna';
  }

  @override
  String get aiExampleEmbassyLabel => 'Koreya Respublikasi Elchixonasi (Viza)';

  @override
  String get aiExampleWritingPlaceholder => 'AI namuna yozmoqda...';

  @override
  String get copyButton => 'Nusxa olish';

  @override
  String get copiedSnackbar => 'Matn nusxalandi!';

  @override
  String get analysisFeedbackTitle => 'Tahlil va izohlar';

  @override
  String get noAnalysisYet => 'Hozircha tahlil yaratilmagan.';

  @override
  String get aiReviewedDraft => 'AI qoralamani ko\'rib chiqdi.';

  @override
  String get returnToDrafting => 'Qoralamaga qaytish';

  @override
  String get studyPlanHistoryTitle => 'Study Plan tarixi';

  @override
  String get personalStatementHistoryTitle => 'Personal Statement tarixi';

  @override
  String get draftingHistoryTitle => 'Qoralamalar tarixi';

  @override
  String get noPastDraftsYet => 'Hali saqlangan qoralamalar yo\'q';

  @override
  String get noPastDraftsBody =>
      'Yangi sessiya boshlang — qoralamalaringiz oxirgi tahrir tartibida shu yerda paydo bo\'ladi.';

  @override
  String get noTargetUniversity => 'Maqsadli universitet yo\'q';

  @override
  String sessionStepLabel(int step) {
    return 'Bosqich $step';
  }

  @override
  String get metricWords => 'So\'zlar';

  @override
  String get metricCharacters => 'Belgilar';

  @override
  String get saveStatusUnsaved => 'Saqlanmagan';

  @override
  String get saveStatusSaving => 'Saqlanmoqda...';

  @override
  String get saveStatusSaved => 'Saqlandi';

  @override
  String get saveStatusError => 'Saqlash xatosi';

  @override
  String get interviewPracticeTitle => 'Suhbat mashqi';

  @override
  String get interviewSettingUp => 'Suhbat tayyorlanmoqda...';

  @override
  String get interviewSetupTitle => 'AI suhbat sozlamalari';

  @override
  String get interviewSetupSubtitle =>
      'Suhbatni boshlashdan oldin AI suhbatdosh sozlamalarini moslang.';

  @override
  String get interviewTypeLabel => 'Suhbat turi';

  @override
  String get interviewTypeGeneral => 'Umumiy tanishtiruv';

  @override
  String get interviewTypeUniversitySpecific => 'Universitetga moslangan';

  @override
  String get interviewTypeVisa => 'Viza / Elchixona suhbati';

  @override
  String get targetUniversityFieldLabel => 'Maqsadli universitet';

  @override
  String get languageLabel => 'Til';

  @override
  String get interviewerPersonaLabel => 'Suhbatdosh tipi';

  @override
  String get focusTopicLabel => 'Mavzu (ixtiyoriy)';

  @override
  String get focusTopicHint =>
      'masalan, Kompyuter ilmlari mutaxassisligi haqida...';

  @override
  String get timedModeTitle => 'Vaqt cheklovi';

  @override
  String get timedModeSubtitle => 'Qattiq 5 daqiqalik cheklov';

  @override
  String get startPracticeButton => 'Mashqni boshlash';

  @override
  String get pickUniversityFirstHint =>
      'Yuqoridan maqsadli universitetni tanlang.';

  @override
  String get coachingFiller => 'Qo\'shimcha so\'zlardan voz keching!';

  @override
  String get lifelineHintsTitle => '💡 Yordam maslahatlari:';

  @override
  String get speakerAi => 'AI';

  @override
  String get speakerYou => 'Siz';

  @override
  String connectionInterrupted(String detail) {
    return 'Aloqa uzildi: $detail';
  }

  @override
  String get interviewAnalyticsTitle => 'Suhbat tahlili';

  @override
  String get analyzingTranscript => 'AI transkripsiyani tahlil qilmoqda...';

  @override
  String get noFeedbackAvailable => 'Izoh topilmadi.';

  @override
  String get overallScoreLabel => 'Umumiy ball';

  @override
  String get metricCommunication => 'Muloqot';

  @override
  String get metricConfidence => 'Ishonchlilik';

  @override
  String get metricContent => 'Mazmun';

  @override
  String get metricLanguage => 'Til';

  @override
  String get detailedFeedbackTitle => 'Batafsil izoh';

  @override
  String get detailedFeedbackFallback => 'Yaxshi natija.';

  @override
  String get strengthsLabel => 'Kuchli tomonlar';

  @override
  String get areasToImproveLabel => 'Yaxshilash kerak';

  @override
  String get startAnotherInterview => 'Yangi suhbatni boshlash';

  @override
  String get sessionRecording => 'Sessiya yozuvi';

  @override
  String get audioRecordingNotFound => 'Audio yozuv topilmadi.';

  @override
  String get interviewHistoryTitle => 'Suhbatlar tarixi';

  @override
  String get noPastInterviews => 'O\'tgan suhbatlar topilmadi.';

  @override
  String get unknownTarget => 'Noma\'lum maqsad';

  @override
  String get unknownUniversity => 'Noma\'lum universitet';

  @override
  String get abandonedSessionNote =>
      'Bu sessiya izohsiz tugatilgan — qayta tinglash mavjud emas.';

  @override
  String get activeSessionNote =>
      'Bu sessiya hali faol. Tugatib izohni ko\'ring.';

  @override
  String get deleteSessionTooltip => 'Sessiyani o\'chirish';

  @override
  String get deleteInterviewDialogTitle =>
      'Bu sessiyani o\'chirib tashlaysizmi?';

  @override
  String get deleteInterviewDialogBody =>
      'Izoh va yozuv havolasi butunlay o\'chiriladi.';

  @override
  String deleteFailed(Object error) {
    return 'O\'chirish amalga oshmadi: $error';
  }

  @override
  String get a11yTooltipAskAi => 'Hanguk AI dan so\'rash';

  @override
  String get a11yTooltipClearChat => 'Chat tarixini tozalash';

  @override
  String get a11yTooltipSendMessage => 'Xabar yuborish';

  @override
  String get a11yTooltipClose => 'Yopish';

  @override
  String get a11yTooltipPreviewDocument => 'Hujjatni ko\'rib chiqish';

  @override
  String get a11yTooltipDeleteDocument => 'Hujjatni o\'chirish';

  @override
  String get a11yTooltipInterviewHistory => 'Suhbat tarixi';

  @override
  String get a11yTooltipCloseSession => 'Sessiyani yopish';

  @override
  String get a11yTooltipDeleteSession => 'Sessiyani o\'chirish';

  @override
  String get a11yTooltipBack => 'Orqaga';

  @override
  String get a11yTooltipPlayRecording => 'Yozuvni ijro etish';

  @override
  String get a11yTooltipPauseRecording => 'Yozuvni to\'xtatish';

  @override
  String get trackMismatchWarning =>
      'Qoralamangiz tili siz tanlagan yo\'nalishga mos kelmayapti. Iltimos, tanlangan tilda qayta yozing.';

  @override
  String get interviewStartError =>
      'Suhbatni boshlab bo\'lmadi. Internet aloqasini tekshirib, qayta urinib ko\'ring.';

  @override
  String get perAnswerReviewTitle => 'Har bir javob tahlili';

  @override
  String get betterAnswerLabel => 'KUCHLIROQ JAVOB';

  @override
  String get navHome => 'Bosh sahifa';

  @override
  String get navMenu => 'Menyu';

  @override
  String get greetingMorning => 'Xayrli tong';

  @override
  String get greetingAfternoon => 'Xayrli kun';

  @override
  String get greetingEvening => 'Xayrli kech';

  @override
  String get welcomeHeadline => 'Yo\'lingizga xush kelibsiz';

  @override
  String get welcomeSubtitle =>
      'Janubiy Koreya universitetiga yo\'lingiz shu yerdan boshlanadi.';

  @override
  String get welcomeMagicCodeCta => 'Menda sehrli kod bor';

  @override
  String get welcomeExploreCta => 'Universitetlarni ko‘rish';

  @override
  String get magicCodeTitle => 'Sehrli kod';

  @override
  String get homeJourneyEyebrow => 'Sizning yo\'lingiz';

  @override
  String get homeContinueJourney => 'Yo\'lni davom ettirish';

  @override
  String get homeViewAll => 'Barchasini ko\'rish';

  @override
  String documentsCollected(int collected, int total) {
    return '$total tadan $collected tasi yig\'ildi';
  }

  @override
  String get documentActionUpload => 'Yuklash';

  @override
  String get documentStatusApproved => 'Tasdiqlangan';

  @override
  String get documentStatusPendingReview => 'Tekshiruvda';

  @override
  String get statusDocs => 'Hujjatlar';

  @override
  String get statusSubmitted => 'Yuborilgan';

  @override
  String get statusInReview => 'Ko‘rib chiqilmoqda';

  @override
  String get statusWaiting => 'Kutilmoqda';

  @override
  String get statusRejected => 'Rad etilgan';

  @override
  String get journeyStageDocumentPrep => 'Hujjatlarni tayyorlash';

  @override
  String get journeyStageOnlineApplication => 'Onlayn ariza';

  @override
  String get journeyStageOfflineApplication => 'Oflayn ariza';

  @override
  String get journeyStageInterview => 'Suhbat';

  @override
  String get journeyStageWaitingInvoice => 'Hisob-fakturani kutish';

  @override
  String get journeyStageTuitionPayment => 'Kontrakt to\'lovi';

  @override
  String get journeyStageWaitingAdmission => 'Qabul xatini kutish';

  @override
  String get journeyStageVisaPreparation => 'Vizaga tayyorgarlik';

  @override
  String get journeyStageWaitingVisa => 'Viza berilishini kutish';

  @override
  String mapUniversitiesMapped(int count) {
    return '$count ta universitet xaritada';
  }

  @override
  String get updateAvailableTitle => 'Yangilanish mavjud';

  @override
  String updateVersionReady(String version) {
    return '$version versiyasi o\'rnatishga tayyor.';
  }

  @override
  String updateSizeMb(String size) {
    return 'Hajmi: $size MB';
  }

  @override
  String get updateSigningKeyWarning =>
      'Bu yangilanish ilovaning imzo kalitini o\'zgartiradi. O\'rnatilgandan so\'ng sehrli kod bilan qayta kirishingiz kerak bo\'ladi.';

  @override
  String get updateNow => 'Hozir yangilash';

  @override
  String get updateLater => 'Keyinroq';

  @override
  String get updateDownloadingTitle => 'Yangilanish yuklab olinmoqda';

  @override
  String updateDownloadProgress(String downloaded, String total) {
    return '$downloaded MB / $total MB';
  }

  @override
  String get updateInstallingLabel => 'Tekshirilmoqda va o\'rnatilmoqda…';

  @override
  String get updateFailedTitle => 'Yangilanish amalga oshmadi';

  @override
  String get updateErrorNetwork =>
      'Yangilanishni yuklab bo\'lmadi. Internet aloqangizni tekshirib, qayta urinib ko\'ring.';

  @override
  String get updateErrorHashMismatch =>
      'Yuklab olingan fayl yaxlitlik tekshiruvidan o\'tmadi. Qayta urinib ko\'ring — muammo takrorlansa, maslahatchingizga murojaat qiling.';

  @override
  String get updateErrorInstallDenied =>
      'O\'rnatishni qurilmangiz blokladi. Telefon sozlamalarida Hanguk uchun \"Noma\'lum ilovalarni o\'rnatish\" ruxsatini bering, so\'ng qayta urinib ko\'ring.';

  @override
  String get updateErrorStorage =>
      'Yangilanishni yuklab olish uchun xotirada joy yetarli emas. Joy bo\'shatib, qayta urinib ko\'ring.';

  @override
  String get updateErrorUnsupportedPlatform =>
      'Bu platformada yangilanishlar hozircha mavjud emas.';

  @override
  String get updateErrorUnknown =>
      'Yangilanish amalga oshmadi. Qayta urinib ko\'ring yoki maslahatchingizga murojaat qiling.';

  @override
  String get guestModeEyebrow => 'Mehmon rejimi';

  @override
  String get guestJoinCta => 'Hangukka qo‘shilish';

  @override
  String get guestExploreTitle => 'Universitetingizni toping';

  @override
  String guestUniversitiesCount(int count) {
    return '$count ta universitet';
  }

  @override
  String get guestNavExplore => 'Kashf etish';

  @override
  String get guestNavCompare => 'Taqqoslash';

  @override
  String guestCompareCount(int count) {
    return 'Taqqoslash $count/2';
  }

  @override
  String get guestCompareEmptySlot => 'Kashf etishdan qo‘shing';

  @override
  String get guestCompareApplyCta => 'Hanguk bilan topshirish';

  @override
  String get guestCompareReassurance =>
      'Magic kod oling — jamoamiz hujjatlardan vizagacha butun jarayonda yo‘l ko‘rsatadi.';

  @override
  String get guestRowCity => 'Shahar';

  @override
  String get guestRowTier => 'Daraja';

  @override
  String get guestRowIeqas => 'IEQAS holati';

  @override
  String get guestRowPartner => 'Hanguk hamkori';

  @override
  String get guestRowNextEvent => 'Keyingi sana';

  @override
  String get guestRowWebsite => 'Veb-sayt';

  @override
  String get guestValueYes => 'Ha';

  @override
  String get guestValueNo => 'Yo‘q';

  @override
  String get roomTabStatus => 'Holat';

  @override
  String get roomTabDiscussion => 'Muhokama';

  @override
  String get roomTabNews => 'Yangiliklar';

  @override
  String get roomTabCalendar => 'Taqvim';

  @override
  String get roomApplicationProgress => 'Ariza jarayoni';

  @override
  String get roomChatEmpty => 'Hozircha xabarlar yo‘q. Suhbatni boshlang!';

  @override
  String get roomChatHint => 'Xonaga xabar yozing...';

  @override
  String get roomChatSenderFallback => 'Foydalanuvchi';

  @override
  String get roomNewsEmpty => 'Faol e‘lonlar yo‘q.';

  @override
  String get roomEventsEmpty => 'Bu sanada tadbirlar yo‘q.';

  @override
  String get uniDbPhaseBadge => 'Universitet bazasi · 0-bosqich tayyorlandi';

  @override
  String get uniDbRecentChangesTitle =>
      'Kuzatilayotgan universitetlaringizdagi yangiliklar';

  @override
  String get timeJustNow => 'hozirgina';

  @override
  String timeMinutesAgo(int minutes) {
    return '$minutes daqiqa oldin';
  }

  @override
  String timeHoursAgo(int hours) {
    return '$hours soat oldin';
  }

  @override
  String timeDaysAgo(int days) {
    return '$days kun oldin';
  }

  @override
  String get uniDbVerifiedDeadlinesTitle => 'Tasdiqlangan yaqin muddatlar';

  @override
  String get deadlineClosed => 'Yopilgan';

  @override
  String deadlineInDays(int days) {
    return '$days kundan keyin';
  }

  @override
  String deadlineInHours(int hours) {
    return '$hours soatdan keyin';
  }

  @override
  String deadlineInMinutes(int minutes) {
    return '$minutes daqiqadan keyin';
  }

  @override
  String get eventApplyOpen => 'Ariza qabuli boshlanadi';

  @override
  String get eventApplyClose => 'Ariza qabuli tugaydi';

  @override
  String get eventDocumentsDue => 'Hujjat topshirish muddati';

  @override
  String get eventFirstStageResults => '1-bosqich natijalari';

  @override
  String get eventInterviewLabel => 'Suhbat';

  @override
  String get eventPracticalExam => 'Amaliy imtihon';

  @override
  String get eventFinalResults => 'Yakuniy natijalar';

  @override
  String get eventAdditionalAdmit => 'Qo\'shimcha qabul';

  @override
  String get eventRegistrationOpen => 'Ro\'yxatdan o\'tish boshlanadi';

  @override
  String get eventRegistrationClose => 'Ro\'yxatdan o\'tish tugaydi';

  @override
  String get cycleForeign => 'Chet ellik abituriyentlar';

  @override
  String get cycleOverseasKoreanFull => 'Chet eldagi koreyslar (to\'liq)';

  @override
  String get cycleOverseasKoreanPartial => 'Chet eldagi koreyslar (qisman)';

  @override
  String get cycleSusi => 'Susi';

  @override
  String get cycleJeongsi => 'Jeongsi';

  @override
  String get cycleTransfer => 'O\'qishni ko\'chirish';

  @override
  String get cycleGradGeneral => 'Magistratura';

  @override
  String get cycleGradForeign => 'Magistratura (chet ellik)';

  @override
  String get uniSpecificHeader => 'Universitetga mos suhbat';

  @override
  String get uniSpecificPickPrompt =>
      'Suhbat savollari tanlangan universitetning qabul yo\'nalishi, talablari va asosiy muddatlariga moslashishi uchun yuqoridan universitet tanlang.';

  @override
  String uniSpecificLoadError(Object error) {
    return 'Qabul ma\'lumotlarini yuklab bo\'lmadi: $error\nUmumiy suhbatni baribir o\'tkazishingiz mumkin.';
  }

  @override
  String get uniSpecificNoData =>
      'Bu universitet uchun tasdiqlangan qabul ma\'lumotlari hali yo\'q. 모집요강 hujjati qo\'shilgunga qadar suhbat umumiy savollar bilan o\'tadi.';

  @override
  String get uniSpecificFallbackButton => 'Umumiy suhbatni sinab ko\'ring';

  @override
  String uniSpecificTrackLabel(String category) {
    return 'Yo\'nalish: $category';
  }

  @override
  String get uniSpecificSeedNote =>
      'Suhbat savollari ushbu qabul ma\'lumotlariga asoslanadi.';

  @override
  String get uniSpecificRecruitmentUnitFallback => 'Qabul yo\'nalishi';

  @override
  String get uniDbInstitutionTitle => 'Universitet';

  @override
  String get uniDbNotFoundTitle => 'Universitet topilmadi';

  @override
  String get uniDbNotFoundBody =>
      'Bu universitet hali katalogimizda yo\'q. Keyinroq qayta tekshirib ko\'ring.';

  @override
  String get uniDbUpcomingDeadlines => 'Yaqinlashayotgan muddatlar';

  @override
  String get uniDbNoDeadlines => 'Hozircha e\'lon qilingan muddatlar yo\'q.';

  @override
  String get uniDbTuitionHeading => 'Kontrakt to\'lovi';

  @override
  String get uniDbTuitionEmpty =>
      'Kontrakt to\'lovi ma\'lumotlari hali mavjud emas.';

  @override
  String get uniDbRequirementsHeading => 'Talablar';

  @override
  String get uniDbRequirementsEmpty => 'Qabul talablari hali mavjud emas.';

  @override
  String get uniDbScholarshipsHeading => 'Stipendiyalar';

  @override
  String get uniDbScholarshipsEmpty =>
      'Bu universitet uchun hali stipendiyalar ko\'rsatilmagan.';

  @override
  String get uniDbDocumentChecklistHeading => 'Hujjatlar ro\'yxati';

  @override
  String get uniDbDocumentsEmpty => 'Hujjatlar ro\'yxati hali mavjud emas.';

  @override
  String get uniDbTrackTitle => 'Bu universitetni kuzatish';

  @override
  String get uniDbTrackOnDesc =>
      'Muddatlar bosh sahifadagi bannerda ko\'rinadi va o\'zgarishlar haqida push-bildirishnoma olasiz.';

  @override
  String get uniDbTrackOffDesc =>
      'Muddatlar, tuzatish e\'lonlari va talablar o\'zgarishini kuzatish uchun yoqing.';

  @override
  String uniDbTrackError(Object error) {
    return 'Kuzatuvni yangilab bo\'lmadi: $error';
  }

  @override
  String get uniDbOpenGuidePdf => 'Qabul yo\'riqnomasi PDF-ini ochish';

  @override
  String get uniDbNoGuidePdf => 'Qabul yo\'riqnomasi PDF hali mavjud emas.';

  @override
  String get uniDbPdfNoApp =>
      'PDF-ni ochib bo\'lmadi — uni ochadigan ilova topilmadi.';

  @override
  String uniDbPdfError(Object error) {
    return 'PDF-ni ochib bo\'lmadi: $error';
  }

  @override
  String uniDbAcademicYear(int year) {
    return '$year o\'quv yili';
  }

  @override
  String uniDbSemesterLabel(int number) {
    return '$number-semestr';
  }

  @override
  String get uniDbFirstSemester => 'birinchi semestr';

  @override
  String uniDbAdmissionFee(String amount) {
    return '+ $amount qabul to\'lovi';
  }

  @override
  String uniDbGpaChip(String pct) {
    return 'GPA ≥ $pct%';
  }

  @override
  String get uniDbTopikTierTable => 'TOPIK darajalar jadvali';

  @override
  String uniDbDocumentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ta hujjat',
      one: '1 ta hujjat',
    );
    return '$_temp0';
  }

  @override
  String get uniDbApostilleRequired => 'Apostil talab qilinadi';

  @override
  String uniDbLastVerified(String date) {
    return 'Oxirgi tekshiruv: $date';
  }

  @override
  String get eventOrientation => 'Tanishtiruv kuni';

  @override
  String get eventSemesterStart => 'Semestr boshlanadi';

  @override
  String get facultyHumanities => 'Gumanitar fanlar';

  @override
  String get facultySocialScience => 'Ijtimoiy fanlar';

  @override
  String get facultyNaturalScience => 'Tabiiy fanlar';

  @override
  String get facultyEngineering => 'Muhandislik';

  @override
  String get facultyMedical => 'Tibbiyot / Farmatsiya';

  @override
  String get facultyArts => 'San\'at';

  @override
  String get facultyPhysicalEducation => 'Jismoniy tarbiya';

  @override
  String get uniDbCompareTitle => 'Taqqoslash';

  @override
  String get uniDbCompareEmptyTitle => 'Universitetlarni taqqoslash';

  @override
  String get uniDbCompareEmptyBody =>
      'Kamida ikkita universitetni kuzatuvga qo\'shing, so\'ng taqqoslash uchun shu yerga qayting.';

  @override
  String get uniDbCompareNeedSecond =>
      'Taqqoslash uchun ikkinchi universitet kerak.';

  @override
  String uniDbCompareSelected(String name) {
    return 'Hozir tanlangan: $name';
  }

  @override
  String get uniDbColEnglishName => 'Inglizcha nomi';

  @override
  String get uniDbColUzbekName => 'O\'zbekcha nomi';

  @override
  String get uniDbColLastVerified => 'Oxirgi tekshiruv';

  @override
  String get uniDbTrackerTitle => 'Arizalar kuzatuvi';

  @override
  String get uniDbTrackerEmptyTitle =>
      'Hali kuzatilayotgan universitetlar yo\'q';

  @override
  String get uniDbTrackerEmptyBody =>
      'Universitet sahifasida uni kuzatuvga qo\'shing — muddatlari shu yerda ko\'rinadi.';

  @override
  String get uniDbLoadFailed => 'Universitetlar ro\'yxatini yuklab bo\'lmadi.';

  @override
  String get loginSubmitButton => 'Tizimga kirish';

  @override
  String get welcomeGuestCaption =>
      'Kod shart emas — bemalol ko\'ring, filtrlang va solishtiring.';

  @override
  String get homeNotifications => 'Bildirishnomalar';

  @override
  String get notifApplicationUpdates => 'Ariza yangiliklari';

  @override
  String get notifToUpload => 'Yuklash kerak';

  @override
  String get notifAllCaughtUp => 'Hammasi bajarilgan';

  @override
  String get notifAllCaughtUpBody =>
      'Hujjatlar va arizalaringiz haqidagi eslatmalar shu yerda chiqadi.';
}
