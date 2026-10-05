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
  String get walkaroundLoadingTitle => 'Kampus sayri yuklanmoqda';

  @override
  String get walkaroundLoadingSubtitle =>
      'Kampus atrofidagi ko‘cha panoramasi yuklanmoqda.';

  @override
  String get walkaroundNoPanoTitle => 'Bu yerda ko‘cha panoramasi yo‘q';

  @override
  String get walkaroundNoPanoSubtitle =>
      'Bu kampus yaqinida sayr qilsa bo‘ladigan ko‘cha panoramasi yo‘q.';

  @override
  String get walkaroundBlockedTitle => 'Ko‘cha panoramasi mavjud emas';

  @override
  String get walkaroundBlockedSubtitle =>
      'Xarita provayderi bu so‘rovni blokladi. Boshqa tarmoq orqali qayta urinib ko‘ring.';

  @override
  String get walkaroundNetworkTitle => 'Xarita xizmatiga ulanib bo‘lmadi';

  @override
  String get walkaroundNetworkSubtitle =>
      'Internetni tekshirib, qayta urinib ko‘ring.';

  @override
  String get walkaroundInitErrorTitle =>
      'Ko‘cha panoramasini ishga tushirib bo‘lmadi';

  @override
  String get walkaroundInitErrorSubtitle =>
      'Sayrni boshlashda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.';

  @override
  String get virtualTourTitle => 'Virtual sayohat';

  @override
  String get virtualWalkaroundTitle => 'Virtual sayr';

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
      'Konsultantingiz yoki universitet vakili bergan 8 belgili kodni kiriting.';

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
  String get aiStatusSpellCheckUnavailable => 'Qurilma lug\'ati mavjud emas';

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
  String get analysisErrorPlanRequired =>
      'Tahlil Premium va No Risk tariflariga kiradi. Sizning hozirgi tarifingizda bu yo\'q.';

  @override
  String get analysisErrorRateLimited =>
      'Juda ko\'p tahlil so\'raldi. Bir daqiqa kutib, qayta urinib ko\'ring.';

  @override
  String get analysisErrorServiceDown =>
      'Tahlil xizmati vaqtincha ishlamayapti. Qoralamangiz saqlangan — birozdan keyin urinib ko\'ring.';

  @override
  String get analysisErrorFailed =>
      'Tahlilni yakunlab bo\'lmadi. Qoralamangiz saqlangan — internetni tekshirib, qayta urinib ko\'ring.';

  @override
  String get analysisRetryButton => 'Qayta urinish';

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
  String get welcomeHeadline => 'Xush kelibsiz';

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
  String get ieqasOutstanding => 'IEQAS a\'lo';

  @override
  String get ieqasAccredited => 'IEQAS akkreditatsiya';

  @override
  String get guestRowPartner => 'Hanguk hamkori';

  @override
  String get guestRowNextEvent => 'Keyingi sana';

  @override
  String get guestRowWebsite => 'Veb-sayt';

  @override
  String get guestRowTuition => 'Kontrakt narxi';

  @override
  String get guestRowApplication => 'Ariza topshirish';

  @override
  String get guestRowDocDeadline => 'Hujjat muddati';

  @override
  String get guestRowTopik => 'TOPIK';

  @override
  String get guestRowEnglish => 'Ingliz tili';

  @override
  String get guestRowInterview => 'Suhbat';

  @override
  String get guestRowDocuments => 'Kerakli hujjatlar';

  @override
  String guestTuitionYearNote(int year) {
    return '$year yil ma’lumoti';
  }

  @override
  String guestDocumentsCount(int count) {
    return '$count xil';
  }

  @override
  String get guestApostilleShort => 'apostil kerak';

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
      'Ko\'rish va solishtirish uchun kod shart emas.';

  @override
  String get welcomeClientsDivider => 'Hanguk mijozlari';

  @override
  String get loginNoCodePrompt => 'Kod yo\'qmi?';

  @override
  String get loginAskConsultant => 'Konsultantingizdan so\'rang';

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

  @override
  String get guestContactEyebrow => 'Hanguk Consulting';

  @override
  String get guestContactTitle => 'Biz bilan bog\'laning';

  @override
  String get guestContactSubtitle =>
      'Qulay kanalni tanlang — hammasida javob beramiz.';

  @override
  String get guestContactTelegramChannel => 'Telegram kanal';

  @override
  String get guestContactTelegramChannelHint =>
      'Yangiliklar, muddatlar va qabullar';

  @override
  String get guestContactTelegramDirect => 'Telegramda yozish';

  @override
  String get guestContactTelegramDirectHint =>
      'Maslahatchiga to\'g\'ridan-to\'g\'ri savol bering';

  @override
  String get guestContactInstagram => 'Instagram';

  @override
  String get guestContactInstagramHint =>
      'Talabalar, kampuslar, kundalik hayot';

  @override
  String get guestContactCall => 'Qo\'ng\'iroq qilish';

  @override
  String get guestContactJoinHint => 'Sehrli kodingiz bormi?';

  @override
  String get guestContactLaunchFailed => 'Bu havolani ochib bo\'lmadi.';

  @override
  String get guestContactCta => 'Bog\'lanish';

  @override
  String get aiReportAction => 'Shikoyat';

  @override
  String get aiReportTitle => 'Ushbu javob ustidan shikoyat';

  @override
  String get aiReportBody =>
      'Ushbu AI javobida nima noto‘g‘ri ekanini yozing. Jamoamiz har bir shikoyatni ko‘rib chiqadi.';

  @override
  String get aiReportReasonHint => 'Nimasi noto‘g‘ri? (ixtiyoriy)';

  @override
  String get aiReportSubmit => 'Shikoyatni yuborish';

  @override
  String get aiReportThanks => 'Rahmat. Jamoamiz ushbu javobni ko‘rib chiqadi.';

  @override
  String get aiReportFailed =>
      'Shikoyatni yuborib bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get catalogSearchHint => 'Universitet nomini qidiring';

  @override
  String get catalogListTitle => 'Universitetlar';

  @override
  String catalogCityUniversities(String city) {
    return '$city universitetlari';
  }

  @override
  String get catalogEmptyTitle => 'Universitet topilmadi';

  @override
  String get catalogEmptyBody => 'Boshqa shahar yoki filtrni tanlab ko\'ring.';

  @override
  String get catalogTypeState => 'Davlat universiteti';

  @override
  String get catalogTypePrivate => 'Xususiy universitet';

  @override
  String get catalogTypeSpecialized => 'Ixtisoslashgan oliygoh';

  @override
  String get catalogTypeStateShort => 'Davlat';

  @override
  String get catalogTypePrivateShort => 'Xususiy';

  @override
  String get catalogTypeSpecializedShort => 'Ixtisoslashgan';

  @override
  String get catalogFilterTitle => 'Filtr';

  @override
  String get catalogFilterClear => 'Tozalash';

  @override
  String get catalogFilterCity => 'Shahar';

  @override
  String catalogFilterCityPicked(int count) {
    return '$count ta tanlandi';
  }

  @override
  String get catalogFilterDegree => 'Daraja';

  @override
  String get catalogDegreeBachelor => 'Bakalavr';

  @override
  String get catalogDegreeMaster => 'Magistr';

  @override
  String get catalogFilterEnglish => 'Ingliz tili talabi';

  @override
  String get catalogFilterEnglishHint => 'sizning IELTS balingiz';

  @override
  String get catalogIeltsNone => 'Shart emas';

  @override
  String get catalogIeltsNoteAll =>
      'Barcha dasturlar (koreys va ingliz tilida)';

  @override
  String catalogIeltsNote(String score) {
    return 'Faqat ingliz tilidagi dasturlar, IELTS $score bilan kirish mumkin bo\'lganlar';
  }

  @override
  String get catalogFilterPrice => 'Kontrakt narxi';

  @override
  String get catalogPricePerSemester => 'semestr uchun';

  @override
  String get catalogPriceFrom => 'Dan';

  @override
  String get catalogPriceTo => 'Gacha';

  @override
  String catalogPriceUpTo(String amount) {
    return '$amount gacha';
  }

  @override
  String catalogApply(int count) {
    return '$count ta universitetni ko\'rsatish';
  }

  @override
  String get catalogFaculties => 'Fakultetlar';

  @override
  String catalogFacultyCount(int count) {
    return '$count ta fakultet';
  }

  @override
  String catalogProgramCount(int count) {
    return '$count ta yo\'nalish';
  }

  @override
  String catalogTuitionTitle(String name) {
    return 'Kontrakt narxi · $name';
  }

  @override
  String get catalogPerSemester => '/ semestr';

  @override
  String get catalogPerYear => '/ yil';

  @override
  String get catalogSemSuffix => '/semestr';

  @override
  String get catalogYearSuffix => '/yil';

  @override
  String get catalogYearlyTuition => 'Yillik kontrakt';

  @override
  String get catalogApplicationFee => 'Ariza to\'lovi';

  @override
  String get catalogEntranceFee => 'Kirish to\'lovi';

  @override
  String get catalogRequirements => 'Kirish talablari';

  @override
  String get catalogReqKorean => 'Koreys tili';

  @override
  String get catalogReqEnglish => 'Ingliz dasturi uchun';

  @override
  String get catalogReqRecommendation => 'Tavsiyanoma';

  @override
  String get catalogRecYes => 'Kerak';

  @override
  String get catalogRecNo => 'Shart emas';

  @override
  String get catalogRecOptional => 'Ixtiyoriy';

  @override
  String get catalogReqDocuments => 'Hujjatlar';

  @override
  String catalogDocsRequired(int count) {
    return '$count ta majburiy';
  }

  @override
  String get catalogReqApostille => 'Apostil';

  @override
  String catalogApostilleDocs(int count) {
    return '$count ta hujjatga';
  }

  @override
  String get catalogReqBank => 'Bank hisobi (D-2)';

  @override
  String catalogTimeline(String season) {
    return 'Muddatlar · $season';
  }

  @override
  String get catalogRoundLater => 'Keyin e\'lon qilinadi';

  @override
  String get catalogRoundEstimated => 'taxminiy';

  @override
  String get catalogRoundRelative => 'Aniq sana yo\'q';

  @override
  String get catalogWindowLabel => 'Hujjat topshirish vaqti';

  @override
  String catalogDaysLeft(int days) {
    return '$days kun qoldi';
  }

  @override
  String catalogWindowOpens(String date) {
    return '$date da ochiladi';
  }

  @override
  String get catalogWindowClosed => 'Muddat tugagan';

  @override
  String get catalogContact => 'Bog\'lanish';

  @override
  String get catalogSeasonSpring => 'Bahor';

  @override
  String get catalogSeasonAutumn => 'Kuz';

  @override
  String catalogSeasonLabel(String year, String term) {
    return '$year $term';
  }

  @override
  String get catalogFavorite => 'Solishtirishga qo\'shish';

  @override
  String get catalogNoDegreeData => 'Bu daraja bo\'yicha ma\'lumot hali yo\'q';

  @override
  String get catalogCompareChip => 'Taqqoslash';

  @override
  String catalogCompareChipCount(int count) {
    return 'Taqqoslash · $count/2';
  }

  @override
  String get catalogComparePickTwo => '2 ta universitet tanlang';

  @override
  String get compareTraySlotEmpty => 'Tanlang';

  @override
  String get compareTrayCta => 'Taqqoslash';

  @override
  String get compareTitle => 'Taqqoslash';

  @override
  String get compareOnlyDiff => 'Faqat farqlar';

  @override
  String get compareAddSlot => 'Universitet tanlang';

  @override
  String get compareNeedTwo => 'Taqqoslash uchun 2 ta universitet tanlang.';

  @override
  String get compareMainInfo => 'Asosiy ma’lumotlar';

  @override
  String get compareDetails => 'Batafsil ma’lumotlar';

  @override
  String get compareRowTuition => 'Kontrakt (semestr)';

  @override
  String get compareRowTopik => 'TOPIK talabi';

  @override
  String get compareRowIelts => 'IELTS talabi';

  @override
  String get compareRowDeadline => 'Ariza muddati';

  @override
  String get compareRowCity => 'Shahar';

  @override
  String get compareRowRequirements => 'Qabul talablari';

  @override
  String get compareBestCheaper => 'Arzonroq';

  @override
  String get compareBestLower => 'Pastroq';

  @override
  String get entryRegisterTitle => 'Ro‘yxatdan o‘tish';

  @override
  String get entryRegisterSubtitle =>
      'Telefon raqamingiz va parol bilan hisob yarating.';

  @override
  String get entryPhoneLabel => 'Telefon raqami';

  @override
  String get entryPasswordLabel => 'Parol';

  @override
  String get entryPasswordConfirmLabel => 'Parolni takrorlang';

  @override
  String get entryPasswordHint => 'Kamida 6 ta belgi';

  @override
  String get entryRegisterSubmit => 'Ro‘yxatdan o‘tish';

  @override
  String get entryHaveAccount => 'Hisobingiz bormi?';

  @override
  String get entrySignInLink => 'Kirish';

  @override
  String get entrySignInTitle => 'Kirish';

  @override
  String get entrySignInSubtitle =>
      'Ro‘yxatdan o‘tgan telefon raqamingiz va parolingizni kiriting.';

  @override
  String get entrySignInSubmit => 'Kirish';

  @override
  String get entryNoAccount => 'Hisobingiz yo‘qmi?';

  @override
  String get entryRegisterLink => 'Ro‘yxatdan o‘tish';

  @override
  String get entryErrorPhone =>
      'Telefon raqamini to‘liq kiriting: +998 dan keyin 9 ta raqam.';

  @override
  String get entryErrorPasswordShort =>
      'Parol kamida 6 ta belgidan iborat bo‘lsin.';

  @override
  String get entryErrorPasswordMismatch => 'Parollar bir xil emas.';

  @override
  String get entryErrorExists =>
      'Bu raqam allaqachon ro‘yxatdan o‘tgan. Parolingiz bilan kiring.';

  @override
  String get entryStudentNotice =>
      'Siz Hanguk talabasisiz — maslahatchingiz bergan Magic code bilan kiring.';

  @override
  String get entryErrorNotFound => 'Bu raqam ro‘yxatdan o‘tmagan.';

  @override
  String get entryErrorWrongPassword => 'Parol noto‘g‘ri.';

  @override
  String get entryErrorLocked =>
      'Juda ko‘p urinish. 15 daqiqadan keyin qayta urinib ko‘ring.';

  @override
  String get entryErrorNetwork =>
      'Serverga ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';

  @override
  String get entryShowPassword => 'Parolni ko‘rsatish';

  @override
  String get entryHidePassword => 'Parolni yashirish';

  @override
  String get entryLanguageLabel => 'Til';

  @override
  String get entryLanguageSheetTitle => 'Tilni tanlang';

  @override
  String get catalogStep1 => 'Online hujjat topshirish';

  @override
  String get catalogStep2 => 'Application fee to‘lash';

  @override
  String get catalogStep3 => 'Offline hujjat topshirish';

  @override
  String get catalogStep4 => 'Bank statement (universitet uchun)';

  @override
  String get catalogStep5 => 'Intervyu';

  @override
  String get catalogStep6 => 'Natija e’lon qilinishi';

  @override
  String get catalogStep7 => 'Kontrakt to‘lash';

  @override
  String get catalogStep8 => 'Certificate of Admission berilishi';

  @override
  String get catalogStep9 => 'Viza uchun bank statement';

  @override
  String get catalogStep10 => 'Viza uchun tarjima va apostil';

  @override
  String get catalogStep11 => 'Vizaga hujjat topshirish';

  @override
  String get surveysTitle => 'So‘rovnomalar';

  @override
  String get surveysLoadError => 'So‘rovnomalarni yuklab bo‘lmadi';

  @override
  String get surveysEmptyTitle => 'Hozircha so‘rovnomalar yo‘q';

  @override
  String get surveysEmptyBody => 'Yangi so‘rovnomalar shu yerda paydo bo‘ladi';

  @override
  String get surveyCompletedChip => 'Bajarildi';

  @override
  String get surveyNewChip => 'Yangi';

  @override
  String surveyQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ta savol',
    );
    return '$_temp0';
  }

  @override
  String get surveyFillCta => 'To‘ldirish →';

  @override
  String surveyPendingCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ta so‘rovnoma',
    );
    return '$_temp0';
  }

  @override
  String get surveyPendingSubtitle => 'Javoblaringizni kutmoqda';

  @override
  String get surveyTitleFallback => 'So‘rovnoma';

  @override
  String get surveyAnswerAllRequired =>
      'Barcha majburiy savollarga javob bering';

  @override
  String get surveySubmitError =>
      'Javoblarni yuborib bo‘lmadi. Qayta urinib ko‘ring.';

  @override
  String get surveyThanksTitle => 'Rahmat!';

  @override
  String get surveyThanksBody => 'Javoblaringiz qabul qilindi';

  @override
  String get surveyQuestionsLoadError => 'Savollarni yuklab bo‘lmadi';

  @override
  String get surveyNoQuestions => 'Savollar topilmadi';

  @override
  String get surveyAlreadyCompleted =>
      'Siz bu so‘rovnomani allaqachon to‘ldirgansiz';

  @override
  String get surveySubmit => 'Yuborish';

  @override
  String get surveyRequired => 'Majburiy';

  @override
  String get surveyEmailHint => 'misol@mail.com';

  @override
  String get surveyNumberHint => 'Raqam kiriting';

  @override
  String get surveyLongTextHint => 'Batafsil yozing...';

  @override
  String get surveyTextHint => 'Javobingizni yozing...';

  @override
  String get surveyPickDate => 'Sanani tanlang';

  @override
  String get docTypeIdCard => 'Topshiruvchining ID karta (pasport) nusxasi';

  @override
  String get docTypeForeignPassport =>
      'Topshiruvchining zagran pasporti nusxasi';

  @override
  String get docTypePhoto => 'Rasm (3.5x4.5 sm)';

  @override
  String get docTypeDiploma => 'Diplom yoki attestat nusxasi';

  @override
  String get docTypeLanguageCertificate =>
      'Til sertifikati nusxasi (kamida IELTS 5.5 yoki TOPIK 2)';

  @override
  String get docTypeOther => 'Hujjat';

  @override
  String get docStatusLocked => 'Yopiq';

  @override
  String get notifPushSection => 'So‘nggi bildirishnomalar';

  @override
  String get notifMarkAllRead => 'Hammasi o‘qildi';

  @override
  String get appPendingApprovalNote =>
      'Maslahatchi tasdig‘i kutilmoqda.\nKo‘rib chiqilgach, sizga xabar beramiz.';

  @override
  String get appCountrySouthKorea => 'Janubiy Koreya';

  @override
  String get appRoomNotFound => 'Bu universitetda hali xona yo‘q.';

  @override
  String get appRoomDiscussionNotFound => 'Bu xonada hali muhokama yo‘q.';

  @override
  String get appRoomDiscussionConnectError => 'Muhokamaga ulanib bo‘lmadi.';

  @override
  String get appRoomSendError => 'Xabarni yuborib bo‘lmadi.';

  @override
  String get appRoomNotSignedIn => 'Iltimos, qaytadan kiring.';

  @override
  String get appRoomLoadError => 'Yuklab bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get appRoomAnnouncementFallbackTitle => 'E’lon';

  @override
  String get appRoomEventFallbackTitle => 'Tadbir';

  @override
  String get statusPendingApproval => 'Tasdiq kutilmoqda';

  @override
  String get statusDocumentsCollection => 'Hujjatlar yig‘ildi';

  @override
  String get statusDocumentsTranslation => 'Hujjatlar tarjima qilindi';

  @override
  String get statusApostille => 'Apostil tayyor';

  @override
  String get statusApplicationSubmitted => 'Ariza topshirildi';

  @override
  String get statusUniversityResponse => 'Universitet javob berdi';

  @override
  String get statusVisaDocuments => 'Viza hujjatlari';

  @override
  String get statusCompleted => 'Yakunlandi';

  @override
  String get statusInProgress => 'Jarayonda';

  @override
  String get chatGreeting =>
      'Salom! 👋 Men Hanguk AI yordamchisiman. Hujjatlar, universitetlar va ariza jarayoni haqidagi har qanday savolingizga javob beraman!';

  @override
  String get chatNoResponse => 'Kechirasiz, javob tayyorlay olmadim.';

  @override
  String get chatConnectError =>
      'Hanguk AI bilan bog‘lanib bo‘lmadi. Internet aloqasini tekshiring.';

  @override
  String get chatCleared =>
      'Suhbat tozalandi. Sizga qanday yordam bera olaman?';

  @override
  String get mapLoadFailed =>
      'Xarita yuklanmadi. Internet aloqasini tekshiring.';

  @override
  String get mapTapForDetails => 'Batafsil ma’lumot uchun bosing';

  @override
  String get mapProviderUnavailable => 'Xarita xizmati hozircha ishlamayapti.';

  @override
  String get mapInitError => 'Xaritani ishga tushirib bo‘lmadi.';

  @override
  String get trainingGuideSpTitle => 'Study Plan yozish bo‘yicha qo‘llanma';

  @override
  String get trainingGuideSpIntro =>
      'Study Plan — nega Janubiy Koreyada o‘qimoqchi ekaningiz, oldingizga qo‘ygan maqsadlaringiz va o‘qishni bitirgandan keyingi rejalaringiz haqida batafsil ma’lumot beruvchi muhim hujjat.';

  @override
  String get trainingGuideSp1Title => '1. Maqsad va motivatsiya';

  @override
  String get trainingGuideSp1Body =>
      'Nega aynan shu mutaxassislikni tanladingiz? Nega Janubiy Koreya va siz tanlagan universitet bu maqsadingizga mos keladi?';

  @override
  String get trainingGuideSp2Title => '2. Ta’lim rejasi';

  @override
  String get trainingGuideSp2Body =>
      'O‘qish davomida qaysi fanlar yoki yo‘nalishlarga ko‘proq e’tibor qaratmoqchisiz? Koreys tilini o‘rganish rejangiz qanday?';

  @override
  String get trainingGuideSp3Title => '3. Kelajakdagi rejalar';

  @override
  String get trainingGuideSp3Body =>
      'O‘qishni tamomlagach, qanday ish bilan shug‘ullanmoqchisiz? Vataningizga qanday hissa qo‘shasiz?';

  @override
  String get trainingGuidePsTitle =>
      'Personal Statement yozish bo‘yicha qo‘llanma';

  @override
  String get trainingGuidePsIntro =>
      'Personal Statement — shaxsingiz, yutuqlaringiz, qiziqishlaringiz va nega aynan shu mutaxassislikka munosib ekaningizni ko‘rsatuvchi insho.';

  @override
  String get trainingGuidePs1Title => '1. O‘tmish va tajriba';

  @override
  String get trainingGuidePs1Body =>
      'Maktab yoki litseydagi yutuqlaringiz, qatnashgan olimpiada va loyihalaringiz hamda qiziqishlaringiz haqida yozing.';

  @override
  String get trainingGuidePs2Title => '2. Shaxsiy fazilatlar';

  @override
  String get trainingGuidePs2Body =>
      'Sizni boshqa abituriyentlardan nima ajratib turadi? Qiyinchiliklarni qanday yenggansiz?';

  @override
  String get trainingGuidePs3Title => '3. Nega aynan shu soha?';

  @override
  String get trainingGuidePs3Body =>
      'Bu sohaga qiziqishingiz qachon va qanday paydo bo‘lgan?';

  @override
  String get trainingStatusInProgress => 'Jarayonda';

  @override
  String get trainingStatusCompleted => 'Yakunlangan';

  @override
  String get trainingStatusAbandoned => 'To‘xtatilgan';

  @override
  String get trainingErrorSessionsLoad =>
      'Qoralamalaringizni yuklab bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get trainingErrorCreateDraft =>
      'Qoralamani yaratib bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get trainingErrorLoadDraft =>
      'Qoralamani ochib bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get trainingErrorDraftConflict =>
      'Boshqa qurilmada yangiroq qoralama saqlangan. Birlashtirish uchun sahifani yangilang.';

  @override
  String get trainingErrorTrackUpdate =>
      'Yozish tilini o‘zgartirib bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get trainingErrorGeneric =>
      'Nimadir xato ketdi. Qaytadan urinib ko‘ring.';

  @override
  String get trainingInterviewAiError =>
      'AI suhbatdoshda muammo yuz berdi. Qaytadan urinib ko‘ring.';

  @override
  String get trainingInterviewAnswerError =>
      'Javobingizni qayta ishlab bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get trainingInterviewVoiceError =>
      'Suhbatdosh ovozini ijro etib bo‘lmadi.';

  @override
  String get trainingInterviewAudioLinkWarning =>
      'Yozuv havolasini saqlab bo‘lmadi. Qayta tinglash imkoni bo‘lmasligi mumkin.';

  @override
  String get trainingInterviewFeedbackLoadError =>
      'Fikr-mulohazani yuklab bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get authErrorCodeNotFound =>
      'Bu kod topilmadi. Iltimos, uni maslahatchingiz bilan tekshirib ko‘ring.';

  @override
  String get authErrorServerUnreachable =>
      'Serverga ulanib bo‘lmadi. Internet aloqasini tekshirib, «Kirish»ni qayta bosing.';

  @override
  String get authErrorStaffBlocked =>
      'Xodimlar magic code orqali emas, login va parol bilan kirishi kerak.';

  @override
  String get authErrorAccountSetupBusy =>
      'Server hisobingizni sozlamoqda. 30 soniyadan so‘ng qaytadan urinib ko‘ring.';

  @override
  String get authErrorLoginServer =>
      'Kirish serverida xatolik. Qaytadan urinib ko‘ring yoki maslahatchingizdan hisobingizni tiklashni so‘rang.';

  @override
  String get authErrorUnexpected =>
      'Serverda kutilmagan xatolik. Qaytadan urinib ko‘ring yoki maslahatchingizga murojaat qiling.';

  @override
  String get authErrorCrmAccount =>
      'Bu hisobni maslahatchingiz yaratgan. Iltimos, u bergan Magic Access Code orqali kiring.';

  @override
  String get authErrorAlreadyRegistered =>
      'Bu telefon raqami allaqachon ro‘yxatdan o‘tgan. Iltimos, tizimga kiring.';

  @override
  String get authErrorSignUpDisabled =>
      'Ro‘yxatdan o‘tish hozircha o‘chirilgan. Iltimos, administratorga murojaat qiling.';

  @override
  String get authErrorPhoneFormat =>
      'Telefon raqami noto‘g‘ri formatda. Iltimos, mamlakat kodini ham kiriting.';

  @override
  String get authErrorSignUpFailed =>
      'Hisob yaratib bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get a11yMenu => 'Menyu';

  @override
  String get accountExportShareSubject => 'Hanguk — ma’lumotlaringiz nusxasi';

  @override
  String get accountExportShareText =>
      'Hanguk’dagi ma’lumotlaringiz nusxasi (JSON).';

  @override
  String get accountExportError =>
      'Ma’lumotlaringizni eksport qilib bo‘lmadi. Qaytadan urinib ko‘ring.';

  @override
  String get uniDbEventOther => 'Muhim sana';

  @override
  String get uniDbIeqasNone => 'IEQAS akkreditatsiyasi yo‘q';

  @override
  String get uniDbPdfLinkInvalid =>
      'Havolani ochib bo‘lmadi. Qayta urinib ko‘ring.';

  @override
  String get uniDbFacultyMedicine => 'Tibbiyot';

  @override
  String get uniDbFacultyPharmacy => 'Farmatsiya';

  @override
  String get uniDbFacultyArtsPe => 'San’at va sport';

  @override
  String get uniDbFacultyTheology => 'Ilohiyot';

  @override
  String get uniDbFacultyInterdisciplinary => 'Fanlararo yo‘nalishlar';

  @override
  String get uniDbFacultyAll => 'Barcha fakultetlar';

  @override
  String get uniDbScholarshipScopeUniversity => 'Universitet';

  @override
  String get uniDbScholarshipScopeNational => 'Davlat';

  @override
  String get uniDbScholarshipScopeRegional => 'Hududiy';

  @override
  String get uniDbScholarshipScopeFoundation => 'Jamg‘arma';

  @override
  String get uniDbScholarshipScopeDepartment => 'Kafedra';

  @override
  String uniDbAwardTuitionPct(String pct) {
    return 'Kontraktdan $pct% chegirma';
  }

  @override
  String get uniDbAwardTuition => 'Kontrakt chegirmasi';

  @override
  String uniDbAwardTuitionKrw(String amount) {
    return 'Kontraktdan $amount chegirma';
  }

  @override
  String uniDbAwardStipendMonthly(String amount) {
    return 'Oyiga $amount stipendiya';
  }

  @override
  String get uniDbAwardStipend => 'Oylik stipendiya';

  @override
  String uniDbAwardAirfare(String amount) {
    return '$amount gacha aviachipta';
  }

  @override
  String get uniDbAwardAirfareCovered => 'Aviachipta qoplanadi';

  @override
  String get uniDbAwardOther => 'Boshqa imtiyoz';

  @override
  String uniDbTopikDeferred(String base) {
    return '$base (keyinroq topshirish mumkin)';
  }

  @override
  String get uniDbChangeAdmissionCycle => 'Qabul davri';

  @override
  String get uniDbChangeDates => 'Sanalar';

  @override
  String get uniDbChangeUpdated => 'Yangilandi';

  @override
  String get uniDbDocApostille => 'Apostil';

  @override
  String get uniDbDocConsent => 'Rozilik xati';

  @override
  String get uniDbDocPassport => 'Pasport';

  @override
  String get uniDbDocTopik => 'TOPIK sertifikati';

  @override
  String get uniDbDocLanguage => 'Til sertifikati';

  @override
  String get uniDbDocTranscript => 'Baholar ko‘chirmasi';

  @override
  String get uniDbDocDiploma => 'Diplom yoki attestat';

  @override
  String get uniDbDocEnrollment => 'O‘qish joyidan ma’lumotnoma';

  @override
  String get uniDbDocFamily => 'Oila tarkibi haqida ma’lumotnoma';

  @override
  String get uniDbDocPowerOfAttorney => 'Ishonchnoma';

  @override
  String get uniDbDocFinance => 'Moliyaviy imkoniyat hujjati';

  @override
  String get uniDbDocEntryExit => 'Chegaradan o‘tish ma’lumotnomasi';

  @override
  String get uniDbDocEmployment => 'Ish joyidan ma’lumotnoma';

  @override
  String get uniDbDocRecommendation => 'Tavsiyanoma';

  @override
  String get uniDbDocCitizenship => 'Fuqarolikni tasdiqlovchi hujjat';

  @override
  String get uniDbDocStatement => 'Motivatsion xat va o‘quv reja';

  @override
  String get uniDbDocAlienRegistration => 'Chet el fuqarosi ro‘yxat kartasi';

  @override
  String get uniDbDocIdCard => 'Shaxsiy guvohnoma nusxasi';

  @override
  String get uniDbDocPhoto => 'Fotosurat';

  @override
  String get uniDbDocPortfolio => 'Portfolio';

  @override
  String get uniDbDocHealth => 'Tibbiy ma’lumotnoma';

  @override
  String get uniDbDocCalendar => 'O‘quv taqvimi';

  @override
  String get uniDbDocTax => 'Soliq to‘lovi ma’lumotnomasi';

  @override
  String get uniDbDocBusinessRegistration =>
      'Korxona ro‘yxatdan o‘tganlik guvohnomasi';

  @override
  String get uniDbDocAward => 'Mukofot guvohnomasi';

  @override
  String get uniDbDocApplicationForm => 'Ariza shakli';

  @override
  String get uniDbDocOther => 'Qo‘shimcha hujjat';

  @override
  String get adminReviewQueueTitle => 'Tekshiruv navbati';

  @override
  String get adminReviewTitle => 'Tekshiruv';

  @override
  String get adminRefresh => 'Yangilash';

  @override
  String get adminQueueEmpty =>
      'Navbat bo‘sh. Hozircha kutilayotgan narsa yo‘q.';

  @override
  String get adminSelectItem => 'Chapdagi navbatdan elementni tanlang.';

  @override
  String get adminAccepted => 'Qabul qilindi';

  @override
  String get adminEditedAccepted => 'Tahrirlanib qabul qilindi';

  @override
  String get adminRejected => 'Rad etildi';

  @override
  String get adminBackToQueue => 'Navbatga qaytish';

  @override
  String adminConfidence(int pct) {
    return 'Ishonchlilik $pct%';
  }

  @override
  String get adminOverdue => 'Muddati o‘tgan';

  @override
  String get adminOpenSource => 'Manba sahifasini ochish (koreyscha)';

  @override
  String get adminExtractedPayload => 'Ajratib olingan ma’lumotlar:';

  @override
  String get adminReject => 'Rad etish';

  @override
  String get adminEditAccept => 'Tahrirlab qabul qilish';

  @override
  String get adminAccept => 'Qabul qilish';

  @override
  String get adminPayloadNotObject => 'Ma’lumotlar JSON obyekti bo‘lishi kerak';

  @override
  String adminInvalidJson(String error) {
    return 'JSON noto‘g‘ri: $error';
  }

  @override
  String get adminEditPayload => 'Ma’lumotlarni tahrirlash';

  @override
  String get adminSaveAccept => 'Saqlab qabul qilish';

  @override
  String get adminRejectReasonTitle => 'Rad etish sababi';

  @override
  String get adminDetailOptional => 'Tafsilotlar (ixtiyoriy)';

  @override
  String get adminStaffOnly =>
      'Bu bo‘lim faqat Hanguk xodimlari uchun. Agar sizga ruxsat kerak bo‘lsa, administratordan xodim rolini qo‘shishni so‘rang.';

  @override
  String get adminPriorityP1 => 'P1 — tuzatish e’loni (4 soat)';

  @override
  String get adminPriorityP2 => 'P2 — ilova o‘zgarishi (12 soat)';

  @override
  String get adminPriorityP3 => 'P3 — o‘zgargan D3 maydoni (24 soat)';

  @override
  String get adminPriorityP4 => 'P4 — oddiy D2 (48 soat)';

  @override
  String get adminPriorityP5 => 'P5 — oddiy D1 (96 soat)';

  @override
  String get adminReasonLowConfidence => 'Past ishonchlilik';

  @override
  String get adminReasonHighDifficulty => 'Murakkab maydon';

  @override
  String get adminReasonAutoApproved => 'Avtomatik tasdiqlangan';

  @override
  String get adminReasonCorrectionNotice => 'Tuzatish e’loni';

  @override
  String get adminEntityExtraction => 'Ajratib olish';

  @override
  String get adminEntityGuideline => 'Qabul qo‘llanmasi';

  @override
  String get adminRejectWrongYear => 'Noto‘g‘ri yil';

  @override
  String get adminRejectWrongArchetype => 'Noto‘g‘ri hujjat turi';

  @override
  String get adminRejectHallucinated => 'To‘qib chiqarilgan maydon';

  @override
  String get adminRejectOcrGarbled => 'OCR matni buzilgan';

  @override
  String get adminRejectSource404 => 'Manba sahifasi topilmadi (404)';

  @override
  String get adminRejectOther => 'Boshqa';

  @override
  String get interviewErrorNoGreeting =>
      'Suhbatdosh javob bermadi. Orqaga qaytib, qayta urinib ko‘ring.';

  @override
  String get interviewErrorEndedBeforeGreeting =>
      'Suhbatdosh gapirishga ulgurmay qo‘ng‘iroq tugadi. Qayta urinib ko‘ring.';

  @override
  String get interviewErrorCallFailed =>
      'Qo‘ng‘iroqqa ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';

  @override
  String get onbResultRouteLanguageCourse => 'Til kursi';

  @override
  String get onbResultRouteBachelor => 'Bakalavr';

  @override
  String get onbResultRouteMaster => 'Magistratura';

  @override
  String get onbResultRouteCollege => 'Kasbiy kollej';

  @override
  String get onbResultIntakeSpring2027 => '2027 bahor';

  @override
  String get onbResultIntakeFall2027 => '2027 kuz';

  @override
  String get onbResultIntakeLater => 'Keyinroq';

  @override
  String get onbResultBandHigh => 'Yuqori imkoniyat';

  @override
  String get onbResultBandHighNote =>
      'Asosiy talablar bajarilgan — hujjatlarni boshlash mumkin.';

  @override
  String get onbResultBandMid => 'O\'rta imkoniyat';

  @override
  String get onbResultBandMidNote =>
      'Yo\'l ochiq, lekin 1–2 nuqta kuchaytirilishi kerak.';

  @override
  String get onbResultBandLow => 'Hozircha xavf yuqori — lekin yo\'l bor';

  @override
  String get onbResultBandLowNote =>
      'Til va moliyaviy hujjatlar hali yetarli emas.';

  @override
  String get onbResultFactorsTitle => 'Nimaga ta\'sir qildi';

  @override
  String get onbResultFactorKoreanStrong => 'TOPIK 3 va yuqori';

  @override
  String get onbResultFactorKoreanTopik2Degree =>
      'TOPIK 2, ko\'p OTM TOPIK 3 so\'raydi';

  @override
  String get onbResultFactorKoreanMissingDegree =>
      'TOPIK 2 dan past, ko\'p OTM TOPIK 3 so\'raydi';

  @override
  String get onbResultFactorKoreanCollegeStrong => 'TOPIK 3 va yuqori';

  @override
  String get onbResultFactorKoreanCollegeTopik2 =>
      'TOPIK 2 — kasbiy kollej TOPIK 2 qabul qiladi';

  @override
  String get onbResultFactorKoreanCourseCertificate =>
      'Sejong 1A / TOPIK 1 sertifikati bor';

  @override
  String get onbResultFactorKoreanCourseMissing =>
      'Koreys tili sertifikati yo\'q';

  @override
  String get onbResultFactorIncomeYes => 'Ota-ona rasmiy daromadi';

  @override
  String get onbResultFactorIncomeNo => 'Ota-onada rasmiy daromad yo\'q';

  @override
  String get onbResultFactorGradRecent =>
      'Bitiruv yili yaqin — o\'qishda tanaffus yo\'q';

  @override
  String get onbResultFactorGradGapLong =>
      'Bitiruvdan ko\'p vaqt o\'tgan — ta\'lim niyati tushuntirilishi kerak';

  @override
  String get onbResultFactorAgeHigh =>
      'Yoshga ko\'ra ta\'lim niyati tushuntirilishi kerak';

  @override
  String get onbResultFactorBudgetLow =>
      'Byudjet yillik taxminiy xarajatdan kam';

  @override
  String get onbResultUnisTitle => 'Sizga mos universitetlar';

  @override
  String get onbResultAccredited => 'Akkreditatsiyalangan';

  @override
  String get onbResultTuitionLabel => 'Kontrakt/semestr';

  @override
  String get onbResultBankLabel => 'Bank spravkasi';

  @override
  String get onbResultYearlyCost => 'Yillik taxminiy xarajat';

  @override
  String get onbResultStepsTitle => 'Keyingi 3 qadam';

  @override
  String get onbResultStepTopikPrep =>
      'TOPIK 3 ga tayyorgarlik yoki til kursi orqali kirish';

  @override
  String get onbResultStepSchoolDocs =>
      'Attestat va pasportni tarjima va apostil qilish';

  @override
  String get onbResultStepDiplomaDocs =>
      'Diplom va pasportni tarjima va apostil qilish';

  @override
  String get onbResultStepApplyOnTime => 'OTM muddatigacha hujjat topshirish';

  @override
  String get onbResultPathsTitle => 'Sizga mos yo\'llar';

  @override
  String get onbResultPathLanguageCourse => 'Til kursi orqali (D-4)';

  @override
  String get onbResultPathLanguageCourseNote =>
      'Til kursi, keyin bakalavrga o\'tish.';

  @override
  String get onbResultPathCollege => 'Kasbiy kollej';

  @override
  String get onbResultPathCollegeNote =>
      'Talablar yumshoqroq, kontrakt pastroq.';

  @override
  String get onbResultPathNextSeason => 'Keyingi mavsumga tayyorgarlik';

  @override
  String get onbResultPathNextSeasonNote =>
      'TOPIK 3 va bank spravkasi bilan 2027 kuz.';

  @override
  String onbResultTariffWhy(String tariff) {
    return '$tariff — nega? →';
  }

  @override
  String get onbResultCtaOperator => 'Bepul konsultatsiya';

  @override
  String get onbResultCtaTelegram => 'Telegram\'da davom etish';

  @override
  String get onbResultDisclaimer =>
      'Bu dastlabki baho. Viza qarorini elchixona beradi.';

  @override
  String onbResultPlanTariff(String tariff) {
    return 'Tavsiya etilgan tarif: $tariff';
  }

  @override
  String get onbTariffNameStandart => 'Standart';

  @override
  String get onbTariffNamePremium => 'Premium';

  @override
  String get onbTariffNameNoRisk => 'NO RISK';

  @override
  String get onbTariffNameHanbox => 'Hanbox';

  @override
  String get onbTariffsTitle => 'Narxlar va shartlar';

  @override
  String get onbTariffsSubtitle =>
      'Asosiy qismi viza chiqqandan keyin to\'lanadi.';

  @override
  String onbTariffServices(int count) {
    return '$count xizmat';
  }

  @override
  String get onbTariffPriceStandart =>
      '2 mln so\'m hozir + 5 mln vizadan keyin, yoki 5 mln bir yo\'la';

  @override
  String get onbTariffPricePremium =>
      '3 mln hozir + 10 mln vizadan keyin, yoki 10 mln';

  @override
  String get onbTariffPriceNoRisk => '\$5 000 bir yo\'la';

  @override
  String get onbTariffPriceHanbox => '\$2 000 yoki \$400 + oyiga \$200';

  @override
  String get onbTariffMore => 'Batafsil →';

  @override
  String get onbTariffsCompare => 'Tariflarni solishtirish';

  @override
  String get onbTariffExcludedTitle => 'Nima kirmaydi';

  @override
  String get onbTariffExContract => 'Kontrakt';

  @override
  String get onbTariffExApplicationFee => 'Ariza to\'lovi';

  @override
  String get onbTariffExBankStatement => 'Bank spravkasi';

  @override
  String get onbTariffExFlight => 'Parvoz';

  @override
  String get onbTariffExVisaFee => 'Viza to\'lovi';

  @override
  String get onbTariffExLiving => 'Yashash';

  @override
  String get onbTariffExVisa => 'Viza';

  @override
  String get onbTariffDetailEyebrow => 'Tarif tafsiloti';

  @override
  String get onbTariffPayTitle => 'To\'lov vaqti';

  @override
  String get onbTariffPayContract => 'Shartnoma';

  @override
  String get onbTariffPayContractWhen => 'Ish boshlanishida';

  @override
  String get onbTariffPayVisa => 'Viza chiqdi';

  @override
  String get onbTariffPayVisaWhen => 'Viza qo\'lingizda bo\'lganda';

  @override
  String get onbTariffPayVisaDays => 'Viza chiqqanidan keyin 7 ish kuni ichida';

  @override
  String get onbTariffPayStart => 'Boshlanishda';

  @override
  String get onbTariffPayMonthly => 'Har oy';

  @override
  String onbTariffMln(int n) {
    return '$n mln';
  }

  @override
  String get onbTariffOrOnceStandart => 'Yoki 5 mln so\'m bir yo\'la.';

  @override
  String get onbTariffOrOncePremium => 'Yoki 10 mln so\'m bir yo\'la.';

  @override
  String get onbTariffOrOnceHanbox => 'Yoki \$2 000 bir yo\'la, yoki nasiya.';

  @override
  String get onbTariffIncludedTitle => 'Nima kiradi';

  @override
  String get onbTariffIncUniChoice => 'Universitet tanlash';

  @override
  String get onbTariffIncDocsList => 'Hujjatlar ro\'yxati va tekshiruv';

  @override
  String get onbTariffIncTranslation => 'Tarjima va apostil yordami';

  @override
  String get onbTariffIncStudyPlan => 'Study Plan va motivatsion xat';

  @override
  String get onbTariffIncApply => 'Ariza topshirish';

  @override
  String get onbTariffIncInterview => 'Intervyuga tayyorlash';

  @override
  String get onbTariffIncVisaDocs => 'Viza hujjatlari';

  @override
  String get onbTariffIncDorm => 'Yotoqxona joylashuvi';

  @override
  String get onbTariffIncFirstWeek => 'Koreyada birinchi hafta yordami';

  @override
  String get onbTariffIncApplyUpTo3 =>
      '3tagacha universitetga topshirib berish';

  @override
  String get onbTariffIncInterviewQuestions =>
      'Suhbatga tayyorlash (tushishi mumkin bo\'lgan savollar beriladi)';

  @override
  String get onbTariffIncDocsPrep =>
      'Hujjatlarni tayyorlash (tarjima, apostil)';

  @override
  String get onbTariffIncPost => 'Pochta';

  @override
  String get onbTariffIncSimBank => 'Sim karta va bank karta';

  @override
  String get onbTariffIncInterviewAi =>
      'Suhbatga tayyorlash (ai bilan tayyorgarlik)';

  @override
  String get onbTariffIncBankShot1Day => 'Bank shot (1 kunlik oddiy)';

  @override
  String get onbTariffIncBankShot1Month => 'Bank shot (1 oylik)';

  @override
  String get onbTariffIncEmbassyDocs =>
      'Elchixonaga hujjat tayyorlash (tarjima, apostil)';

  @override
  String get onbTariffIncStudyPlanAi =>
      'Studyplan yozishga yordam (ai yordamida tayyorgarlik)';

  @override
  String get onbTariffIncPickup => 'Koreada kutib olish xizmati';

  @override
  String get onbTariffIncContractPaid => 'Kontrakt to\'lovi firma tomonidan';

  @override
  String get onbTariffIncFlightTicket => 'Samalyot bileti olib beriladi';

  @override
  String get onbTariffIncFlatMonth =>
      'Kvartira topib 1 oylik puli to\'lab beriladi';

  @override
  String get onbTariffIncAppFee => 'Ariza to\'lovi (Application fee)';

  @override
  String get onbTariffIncHanboxLessons =>
      '1 yil onlayn jonli darslar (Hanguk Academy ilovasida), 11–15 kishilik guruh, maqsad — TOPIK 2';

  @override
  String get onbTariffIncHanboxLaptop => 'Noutbuk va darsliklar narxga kiradi';

  @override
  String get onbTariffIncHanboxFirstLesson => 'Birinchi dars bepul';

  @override
  String get onbTariffIncHanboxStandart =>
      'Kursdan keyin — Standart konsalting bepul (TOPIK 2, 80% davomat, to\'liq to\'lov)';

  @override
  String get onbTariffFaqTitle => 'Savol-javob';

  @override
  String onbTariffMlnSom(int n) {
    return '$n mln so\'m';
  }

  @override
  String onbTariffFaqNoVisaQ(String amount) {
    return 'Viza chiqmasa $amount to\'laymanmi?';
  }

  @override
  String onbTariffFaqNoVisaA(String amount) {
    return 'Yo\'q. Ikki bosqichli to\'lovda $amount faqat viza chiqqanidan keyin to\'lanadi.';
  }

  @override
  String get onbTariffFaqWhenQ => 'Vizadan keyingi to\'lovni qachon qilaman?';

  @override
  String get onbTariffFaqWhenA => 'Viza chiqqanidan keyin 7 ish kuni ichida.';

  @override
  String get onbTariffFaqContractQ => 'Kontraktni kim to\'laydi?';

  @override
  String get onbTariffFaqContractA =>
      'Universitet kontraktini o\'zingiz to\'laysiz — u tarif narxiga kirmaydi.';

  @override
  String get onbTariffFaqContractANoRisk =>
      'Kontrakt to\'lovini firma qiladi — u NO RISK narxiga kiradi.';

  @override
  String get onbTariffCta => 'Shu tarif bo\'yicha maslahat';

  @override
  String get onbTariffContractPdf => 'Shartnoma namunasi (PDF)';

  @override
  String get onbWelcomeTitle =>
      'Koreyada o\'qish — imkoniyatingizni 2 daqiqada bilib oling';

  @override
  String get onbWelcomeBody =>
      'Halol baho: foiz yo\'q, kafolat yo\'q — qoidalar va sizning javoblaringiz.';

  @override
  String get onbWelcomeCta => 'Imkoniyatimni bilish';

  @override
  String get onbWelcomeCatalog => 'Universitetlarni ko\'rish';

  @override
  String get onbWelcomeTrustReply => 'Operator javobi';

  @override
  String onbWelcomeTrustReplyValue(String minutes) {
    return '≤$minutes daqiqa';
  }

  @override
  String get onbWelcomeClientCode => 'Mijoz kodim bor';

  @override
  String get onbQuizContinue => 'Davom etish';

  @override
  String get onbQuizBack => 'Orqaga';

  @override
  String get onbQuizQ1 => 'Qaysi yo\'nalishda o\'qimoqchisiz?';

  @override
  String get onbQuizRouteCourse => 'Til kursi';

  @override
  String get onbQuizRouteBachelor => 'Bakalavr';

  @override
  String get onbQuizRouteMaster => 'Magistratura';

  @override
  String get onbQuizRouteCollege => 'Kasbiy kollej';

  @override
  String onbQuizGradYearOrEarlier(String year) {
    return '$year yoki oldin';
  }

  @override
  String get onbQuizStillStudying => 'Hali o‘qiyapman';

  @override
  String get onbQuizQ3 => 'Koreys tili darajangiz?';

  @override
  String get onbQuizQ3Hint =>
      'Sertifikat bo\'lmasa ham javob bering — bu yo\'lni belgilaydi.';

  @override
  String get onbQuizKoreanNone => 'Yo\'q';

  @override
  String get onbQuizKoreanLearning => 'O\'rganyapman, sertifikatsiz';

  @override
  String get onbQuizKoreanTopik1 => 'Sejong 1A / TOPIK 1';

  @override
  String get onbQuizKoreanTopik2 => 'TOPIK 2';

  @override
  String get onbQuizKoreanTopik3 => 'TOPIK 3 va yuqori';

  @override
  String get onbQuizKoreanUnknown => 'Hali bilmayman';

  @override
  String get onbQuizBudgetUnder3 => '\$3 000 gacha';

  @override
  String get onbQuizBudget3to6 => '\$3–6 ming';

  @override
  String get onbQuizBudget6to10 => '\$6–10 ming';

  @override
  String get onbQuizBudgetOver10 => '\$10 000+';

  @override
  String get onbQuizQ5 => 'Ota-onada rasmiy daromad bormi?';

  @override
  String get onbQuizIncomeYes => 'Ha, rasmiy daromad bor';

  @override
  String get onbQuizIncomeNo => 'Yo‘q';

  @override
  String get onbQuizIntakeSpring2027 => '2027 bahor';

  @override
  String get onbQuizIntakeFall2027 => '2027 kuz';

  @override
  String get onbQuizIntakeLater => 'Keyinroq';

  @override
  String get onbContactTitle => 'Batafsil reja va universitetlar ro\'yxati';

  @override
  String get onbContactSubtitle =>
      'Operator javoblaringizni ko\'rib, 10 daqiqada qo\'ng\'iroq qiladi.';

  @override
  String get onbContactAfterHours =>
      'Hozir ish vaqtidan tashqari. Ertaga 10:00 da qo\'ng\'iroq qilamiz.';

  @override
  String get onbContactName => 'Ismingiz';

  @override
  String get onbContactPhone => 'Telefon';

  @override
  String get onbContactPhoneError => 'Raqamni tekshiring';

  @override
  String get onbContactNameError => 'Ismingizni kiriting';

  @override
  String get onbContactNetworkError =>
      'Yuborilmadi. Internetni tekshirib, qayta urinib ko\'ring.';

  @override
  String get onbContactTelegram => 'Rejani Telegram\'imga ham yuboring';

  @override
  String get onbContactCta => 'Operator qo\'ng\'iroq qilsin';

  @override
  String get onbContactHours =>
      'Ish vaqti Du–Sh 09:40–18:00. Boshqa vaqtda — ertasi 10:00 da qo\'ng\'iroq qilamiz.';

  @override
  String onbContactSuccess(String name) {
    return 'Rahmat, $name! Operator 10 daqiqada qo\'ng\'iroq qiladi.';
  }

  @override
  String get onbContactBackToResult => 'Natijaga qaytish';

  @override
  String get onbContactAfterHoursToday =>
      'Hozir ish vaqtidan tashqari. Bugun 10:00 da qo\'ng\'iroq qilamiz.';

  @override
  String get onbContactAfterHoursMonday =>
      'Hozir ish vaqtidan tashqari. Dushanba kuni 10:00 da qo\'ng\'iroq qilamiz.';

  @override
  String get onbQuizAgeQ => 'Yoshingiz nechada?';

  @override
  String get onbQuizGradQ => 'Oxirgi o\'qishni qachon tugatgansiz?';

  @override
  String get onbQuizIeltsQ => 'IELTS darajangiz?';

  @override
  String get onbQuizIeltsNone => 'Yo\'q';

  @override
  String get onbQuizIelts55 => 'IELTS 5.5';

  @override
  String get onbQuizIelts60 => 'IELTS 6.0';

  @override
  String get onbQuizIelts65 => 'IELTS 6.5 va yuqori';

  @override
  String get onbQuizIeltsUnknown => 'Hali bilmayman';

  @override
  String get onbQuizBudgetQ =>
      'Yiliga o\'qish va yashashga qancha ajrata olasiz?';

  @override
  String get onbQuizPayerQ => 'Kim to\'laydi?';

  @override
  String get onbQuizPayerParentsOption => 'Ota-onam';

  @override
  String get onbQuizPayerSelfOption => 'O\'zim';

  @override
  String get onbQuizPayerSponsorOption => 'Homiy';

  @override
  String get onbQuizRegionQ => 'Qaysi viloyatdansiz?';

  @override
  String get onbQuizIntakeQ => 'Qachon ketmoqchisiz?';

  @override
  String get onbResultFactorEnglishStrong => 'IELTS 5.5 va yuqori';

  @override
  String get onbResultPartner => 'Rasmiy hamkor';

  @override
  String get onbResultLanguageLabel => 'Til talabi';
}
