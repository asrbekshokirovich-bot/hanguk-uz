// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Kirghiz Kyrgyz (`ky`).
class AppLocalizationsKy extends AppLocalizations {
  AppLocalizationsKy([String locale = 'ky']) : super(locale);

  @override
  String get trainingTabTitle => 'Training Center';

  @override
  String get trainingTabSubtitle =>
      'Prepare for your university applications with AI-guided training modules.';

  @override
  String get studyPlanCardTitle => 'Study Plan түзүү';

  @override
  String get studyPlanCardDesc =>
      'Окуу максаттарыңыз үчүн ишенимдүү план түзүңүз.';

  @override
  String get personalStatementCardTitle => 'Personal Statement';

  @override
  String get personalStatementCardDesc =>
      'Таасирдүү жана кызыктуу жеке эссе жазыңыз.';

  @override
  String get interviewCardTitle => 'Interview Preparation';

  @override
  String get interviewCardDesc =>
      'Practice mock questions and improve your confidence.';

  @override
  String get applyCta => 'Apply to a university';

  @override
  String get noApplicationsTitle => 'No applications yet';

  @override
  String get noApplicationsBody =>
      'Add a target university first — drafting starts from a target school.';

  @override
  String get startInterview => 'Start Interview';

  @override
  String get cancel => 'Жокко чыгаруу';

  @override
  String get endInterview => 'Маекти аяктоо';

  @override
  String get endSession => 'Сессияны аяктоо';

  @override
  String get practiceAgain => 'Practice Again';

  @override
  String get connecting => 'Туташууда...';

  @override
  String get greetWait =>
      'Туташууда — интервьюер жакында сиз менен саламдашат...';

  @override
  String get yourTurn => 'Жооп берүү кезегиңиз';

  @override
  String get aiSpeaking => 'Интервьюер сүйлөп жатат...';

  @override
  String get wrappingUp => 'Маек аякталууда...';

  @override
  String get micRequired => 'Microphone access is required for the interview.';

  @override
  String get walkaroundLoadingTitle => 'Кампус боюнча сейил жүктөлүүдө';

  @override
  String get walkaroundLoadingSubtitle =>
      'Кампустун жанындагы көчө панорамасы жүктөлүүдө.';

  @override
  String get walkaroundNoPanoTitle => 'Бул жерде көчө панорамасы жок';

  @override
  String get walkaroundNoPanoSubtitle =>
      'Бул кампустун жанында сейилдей турган көчө панорамасы жок.';

  @override
  String get walkaroundBlockedTitle => 'Көчө панорамасы жеткиликсиз';

  @override
  String get walkaroundBlockedSubtitle =>
      'Карта кызматы бул сурамды бөгөттөдү. Башка тармак аркылуу кайра аракет кылыңыз.';

  @override
  String get walkaroundNetworkTitle =>
      'Карта кызматына туташуу мүмкүн болгон жок';

  @override
  String get walkaroundNetworkSubtitle =>
      'Интернетти текшерип, кайра аракет кылыңыз.';

  @override
  String get walkaroundInitErrorTitle =>
      'Көчө панорамасын иштетүү мүмкүн болгон жок';

  @override
  String get walkaroundInitErrorSubtitle =>
      'Сейилди баштоодо ката кетти. Сураныч, кайра аракет кылыңыз.';

  @override
  String get virtualTourTitle => 'Virtual Tour';

  @override
  String get virtualWalkaroundTitle => 'Virtual Walkaround';

  @override
  String get visitUniversityWebsite => 'Visit University Website';

  @override
  String universityTier(int tier) {
    return 'Деңгээл $tier';
  }

  @override
  String get universityVerified => 'Verified';

  @override
  String get universityNextEvent => 'Next event';

  @override
  String get navApplications => 'Applications';

  @override
  String get navMap => 'Map';

  @override
  String get navDocs => 'Документтер';

  @override
  String get navTraining => 'Training';

  @override
  String get applicationsTabTitle => 'My Applications';

  @override
  String get mapTabTitle => 'Universities';

  @override
  String get documentsTabTitle => 'My Documents';

  @override
  String get documentUploadInfo =>
      'Түп нуска документтериңиздин туура PDF же JPEG көчүрмөлөрүн жүктөңүз. Ар бир файл үчүн эң көп 10MB.';

  @override
  String get documentsRequiredHeading => 'Керектүү документтер';

  @override
  String get documentUploadFailed =>
      'Документиңизди жүктөө мүмкүн болгон жок. Сураныч, кайра аракет кылыңыз.';

  @override
  String get documentPreviewFailed =>
      'Документти ачуу мүмкүн болгон жок. Сураныч, кайра аракет кылыңыз.';

  @override
  String get documentLoadError => 'Документтериңизди жүктөө мүмкүн болгон жок.';

  @override
  String get commonRetry => 'Кайра аракет кылуу';

  @override
  String get onboardingSkip => 'Skip';

  @override
  String get onboardingNext => 'Next';

  @override
  String get onboardingStart => 'Get Started';

  @override
  String get onboardingStep1Title => 'Track your applications';

  @override
  String get onboardingStep1Body =>
      'Follow every university application from documents to decision, all in one place.';

  @override
  String get onboardingStep2Title => 'Explore universities & upload documents';

  @override
  String get onboardingStep2Body =>
      'Find universities on the map and securely upload the documents each one needs.';

  @override
  String get onboardingStep3Title => 'Practice interviews with AI';

  @override
  String get onboardingStep3Body =>
      'Rehearse Korean admission interviews with the AI coach and get instant feedback.';

  @override
  String get appsEmptyTitle => 'No applications yet';

  @override
  String get appsEmptyBody =>
      'Your applications will appear here once you apply to a university.';

  @override
  String get appsLoadError => 'Арыздарыңызды жүктөө мүмкүн болгон жок.';

  @override
  String get appsPendingHeading => 'Pending Applications';

  @override
  String get appsActiveHeading => 'Active Applications';

  @override
  String get searchHint => 'Search...';

  @override
  String get clearSearch => 'Clear search';

  @override
  String get filterAll => 'Баары';

  @override
  String get filterPartner => 'Өнөктөш';

  @override
  String get filterTop => 'Top';

  @override
  String get noUniversitiesMatch => 'No universities match this filter';

  @override
  String get clearFilters => 'Clear filters';

  @override
  String get universitiesLoadError => 'Couldn\'t load universities';

  @override
  String get checkConnectionRetry =>
      'Интернетти текшерип, кайра аракет кылыңыз';

  @override
  String get switchToListView => 'Switch to list view';

  @override
  String get switchToMapView => 'Switch to map view';

  @override
  String get chatInputHint =>
      'Түштүк Корея жөнүндө каалаган суроону бериңиз...';

  @override
  String get accountTooltip => 'Аккаунт';

  @override
  String get ok => 'OK';

  @override
  String get loadingLabel => 'Жүктөлүүдө...';

  @override
  String get accountBackTooltip => 'Артка';

  @override
  String get accountTitle => 'Аккаунт';

  @override
  String get accountSignedInAs => 'Кирген аккаунт';

  @override
  String get accountUnknownAccount => '(белгисиз аккаунт)';

  @override
  String get accountSessionLabel => 'Сеанс';

  @override
  String get accountSigningOut => 'Чыгууда...';

  @override
  String get accountSignOut => 'Аккаунттан чыгуу';

  @override
  String get accountYourDataLabel => 'Сиздин маалыматтарыңыз';

  @override
  String get accountYourDataBody =>
      'Hanguk сактап турган аккаунтуңуздун бардык маалыматтарынын — профиль, арыздар, окуу пландары, долбоорлор, маек сеанстары жана пикирлер — JSON көчүрмөсүн жүктөп алыңыз.';

  @override
  String get accountPreparingExport => 'Экспорт даярдалууда...';

  @override
  String get accountDownloadMyData => 'Маалыматтарымды жүктөп алуу';

  @override
  String get accountDangerZoneLabel => 'Коркунучтуу аймак';

  @override
  String get accountDangerZoneBody =>
      'Аккаунтту өчүрүү кайтарылгыс аракет. Профилиңиз, арыздарыңыз, окуу пландарыңыз, мотивациялык кат долбоорлору, маек сеанстары жана жазуулары толугу менен өчүрүлөт. Сакталган документтер 30 күндүн ичинде, камдык көчүрмөлөр 90 күндүн ичинде жок кылынат.';

  @override
  String get accountDeleteAccount => 'Аккаунтту өчүрүү';

  @override
  String get accountPrivacyPolicy => 'Купуялык саясаты';

  @override
  String get accountTermsOfService => 'Колдонуу шарттары';

  @override
  String get accountDeleteErrorTitle => 'Аккаунт өчүрүлгөн жок';

  @override
  String accountDeleteErrorBody(Object error) {
    return 'Маалыматтарыңызды өчүрүүдө ката кетти:\n\n$error\n\nӨчүрүүнү аягына чыгарышыбыз үчүн privacy@hanguk.uz дарегине кат жазыңыз.';
  }

  @override
  String accountExportFailed(Object error) {
    return 'Export failed: $error';
  }

  @override
  String get accountDeleteDialogTitle => 'Аккаунтуңузду өчүрөсүзбү?';

  @override
  String get accountDeleteDialogBody =>
      'Аккаунтуңуз, арыздарыңыз, окуу пландарыңыз, мотивациялык кат долбоорлору, маек сеанстары жана жазуулары биротоло өчүрүлөт.\n\nЫрастоо үчүн DELETE деп жазыңыз.';

  @override
  String get accountDeleteDialogConfirm => 'Биротоло өчүрүү';

  @override
  String get accountDeleteProgress => 'Аккаунт өчүрүлүүдө...';

  @override
  String get loginStudentPortal => 'Student Portal';

  @override
  String get loginAccessCodeHelp =>
      'Enter the 8-character code from your consultant or university representative.';

  @override
  String get loginAccessCodeButton => 'Login manually with Access Code';

  @override
  String get loginSwitchToPhone =>
      '← I actually want to Log in via Phone Number';

  @override
  String get loginComingSoonTitle => 'Coming Soon';

  @override
  String get loginComingSoonBody =>
      'Public sign up and phone login are currently under maintenance as we upgrade our systems.\n\nStudents: Please use your Magic Access Code to log in for now.';

  @override
  String get loginSwitchToMagicCode => 'Switch to Magic Code Login';

  @override
  String get loginErrorInvalidPhone =>
      'Please enter a valid phone number (e.g. +12345678).';

  @override
  String get loginErrorPasswordTooShort =>
      'Password must be at least 6 characters.';

  @override
  String get loginErrorInvalidCredentials =>
      'Телефон номери же сырсөз туура эмес.';

  @override
  String get loginErrorInvalidAccessCode =>
      'Сураныч, туура кирүү кодун жазыңыз (кеминде 6 белги).';

  @override
  String get signUpErrorNameRequired => 'Full Name is required.';

  @override
  String get signUpErrorPhoneRequired =>
      'A valid phone number is required (e.g. +12345678).';

  @override
  String get signUpErrorPasswordMismatch => 'Passwords do not match.';

  @override
  String get signUpSuccess => 'Account created successfully! Please log in.';

  @override
  String get notifSettingsTitle => 'Билдирме жөндөөлөрү';

  @override
  String get notifSettingsEmptyTitle => 'Азырынча көзөмөлдөгөн университет жок';

  @override
  String get notifSettingsEmptyBody =>
      'Университеттин барагында \"Бул мекемени көзөмөлдөө\" баскычын басып, жазылыңыз. Жок дегенде бир университетти көзөмөлдөгөндөн кийин билдирме жөндөөлөрү ушул жерде пайда болот.';

  @override
  String get notifSettingsCalendar => 'Календардагы өзгөрүүлөр';

  @override
  String get notifSettingsCalendarDesc => 'Мөөнөт даталары жылдырылса';

  @override
  String get notifSettingsCorrection => 'Оңдоо жарыялары';

  @override
  String get notifSettingsCorrectionDesc =>
      '정정공고 жарыяланды — эң жогорку артыкчылык';

  @override
  String get notifSettingsRequirement => 'Талаптардагы өзгөрүүлөр';

  @override
  String get notifSettingsRequirementDesc =>
      'TOPIK / GPA / тил сынагынын эрежелери өзгөрсө';

  @override
  String get notifSettingsScholarship => 'Стипендия жаңылыктары';

  @override
  String get notifSettingsScholarshipDesc =>
      'Демейки боюнча өчүк — билдирмелер көп келет';

  @override
  String notifSettingsLoadError(Object error) {
    return 'Ката: $error';
  }

  @override
  String notifSettingsPushLanguage(String lang) {
    return 'Push билдирменин тили: $lang';
  }

  @override
  String notifSettingsUpdateError(Object error) {
    return 'Жөндөөнү жаңыртуу мүмкүн болгон жок: $error';
  }

  @override
  String get interviewDialogStepUniversity => '1. Select Target University';

  @override
  String get interviewDialogStepTrack => '2. Select Interview Track';

  @override
  String get interviewDialogStepPersona => '3. Interviewer Persona';

  @override
  String get interviewNoAppsBody =>
      'Add a target university first — interview practice tailors questions to that school.';

  @override
  String get trackKorean => 'Корейче';

  @override
  String get trackEnglish => 'Англисче';

  @override
  String get personaFriendly => 'Friendly admissions officer';

  @override
  String get personaStrict => 'Strict professor';

  @override
  String get personaImpatient => 'Impatient visa officer';

  @override
  String get personaFriendlyCaps => 'Боорукер кабыл алуу кызматкери';

  @override
  String get personaStrictCaps => 'Катаал профессор';

  @override
  String get personaImpatientCaps => 'Чыдамсыз виза кызматкери';

  @override
  String get micBlockedInSettings =>
      'Microphone is blocked in system settings.';

  @override
  String get openSettings => 'Open settings';

  @override
  String genericError(Object error) {
    return 'Ката: $error';
  }

  @override
  String errorLoadingApplications(Object error) {
    return 'Error loading applications: $error';
  }

  @override
  String get noAppsInlineHint =>
      'No applications yet — go to the Applications tab to add one.';

  @override
  String get aiStatusWaiting => 'Жазууну күтүүдө...';

  @override
  String get aiStatusCoolingDown => 'ЖИ эс алууда…';

  @override
  String get aiStatusAnalyzing => 'ЖИ талдап жатат...';

  @override
  String get aiStatusReady => 'Даяр';

  @override
  String get aiStatusPredicting => 'ЖИ сунуштап жатат...';

  @override
  String get aiStatusSupervisionActive => 'ЖИ көзөмөлү күйүк';

  @override
  String get aiStatusSpellCheckUnavailable => 'Түзмөктүн сөздүгү жеткиликсиз';

  @override
  String get workspaceTitle => 'Иш аянты';

  @override
  String get workspaceAnalyzeButton => 'Талдоо';

  @override
  String get aiSupervisionWarningsTitle => 'ЖИ көзөмөлүнүн эскертүүлөрү:';

  @override
  String grammarReplaceWith(String original, String suggestion) {
    return '\"$original\" ордуна \"$suggestion\" деп жазыңыз';
  }

  @override
  String draftingHint(String documentTitle) {
    return '$documentTitle текстин ушул жерге жазыңыз...';
  }

  @override
  String get ghostSuggestionSemantics => 'ЖИ сунушу — коюу үчүн басыңыз';

  @override
  String get ghostAccept => 'Кабыл алуу';

  @override
  String get ghostDismiss => 'Сунушту жабуу';

  @override
  String get pastDraftsTooltip => 'Мурунку долбоорлор';

  @override
  String get sessionSettingsTooltip => 'Сессиянын жөндөөлөрү';

  @override
  String get switchTrackEnglish => 'Тил → Англисче';

  @override
  String get switchTrackKorean => 'Тил → Корейче';

  @override
  String get createNewSession => 'Жаңы сессия түзүү';

  @override
  String get yourSavedDrafts => 'Сакталган долбоорлор';

  @override
  String get noPreviousDrafts => 'Мурунку долбоорлор табылган жок.';

  @override
  String get generalDraftLabel => 'Жалпы';

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
    return 'Абалы: $status';
  }

  @override
  String get deleteSessionTitle => 'Сессияны өчүрүү';

  @override
  String get deleteSessionBody =>
      'Бул сессияны өчүрүүнү каалайсызбы? Бул аракетти кайтаруу мүмкүн эмес.';

  @override
  String get deleteLabel => 'Өчүрүү';

  @override
  String get stepperLabelGuide => 'Колдонмо';

  @override
  String get stepperLabelExample => 'Үлгү';

  @override
  String get stepperLabelDraft => 'Долбоор';

  @override
  String get stepperLabelFeedback => 'Пикир';

  @override
  String get readExamplesButton => 'Үлгүлөрдү көрүү';

  @override
  String get targetUniversityLabel => 'Максаттуу университет';

  @override
  String get startDraftingButton => 'Жазууну баштоо';

  @override
  String get newStudyPlanDialogTitle => 'Жаңы Study Plan';

  @override
  String get newPersonalStatementDialogTitle => 'Жаңы Personal Statement';

  @override
  String get selectTargetUniversityStep =>
      '1. Максаттуу университетти тандаңыз';

  @override
  String get selectLanguageTrackStep => '2. Жазуу тилин тандаңыз';

  @override
  String get createSession => 'Сессия түзүү';

  @override
  String get aiExampleEmbassyTitle => 'Элчилик үчүн үлгү';

  @override
  String aiExampleUniversityTitle(String universityName) {
    return '$universityName үчүн үлгү';
  }

  @override
  String get aiExampleEmbassyLabel => 'Корея Республикасынын Элчилиги (Виза)';

  @override
  String get aiExampleWritingPlaceholder => 'AI is writing an example...';

  @override
  String get copyButton => 'Көчүрүү';

  @override
  String get copiedSnackbar => 'Текст көчүрүлдү!';

  @override
  String get analysisFeedbackTitle => 'Талдоо жана пикирлер';

  @override
  String get noAnalysisYet => 'Азырынча талдоо түзүлгөн жок.';

  @override
  String get analysisErrorPlanRequired =>
      'Талдоо Premium жана No Risk тарифтерине кирет. Сиздин азыркы тарифиңизде ал жок.';

  @override
  String get analysisErrorRateLimited =>
      'Өтө көп талдоо суралды. Бир мүнөт күтүп, кайра аракет кылыңыз.';

  @override
  String get analysisErrorServiceDown =>
      'Талдоо кызматы убактылуу иштебей жатат. Долбооруңуз сакталды — бир аздан кийин кайра аракет кылыңыз.';

  @override
  String get analysisErrorFailed =>
      'Талдоону аягына чыгаруу мүмкүн болгон жок. Долбооруңуз сакталды — интернетти текшерип, кайра аракет кылыңыз.';

  @override
  String get analysisRetryButton => 'Кайра аракет кылуу';

  @override
  String get aiReviewedDraft => 'ЖИ долбооруңузду карап чыкты.';

  @override
  String get returnToDrafting => 'Долбоорго кайтуу';

  @override
  String get studyPlanHistoryTitle => 'Study Plan тарыхы';

  @override
  String get personalStatementHistoryTitle => 'Personal Statement тарыхы';

  @override
  String get draftingHistoryTitle => 'Долбоорлордун тарыхы';

  @override
  String get noPastDraftsYet => 'Азырынча сакталган долбоорлор жок';

  @override
  String get noPastDraftsBody =>
      'Жаңы сессия баштаңыз — долбоорлоруңуз акыркы оңдоо тартибинде ушул жерде пайда болот.';

  @override
  String get noTargetUniversity => 'Максаттуу университет жок';

  @override
  String sessionStepLabel(int step) {
    return '$step-баскыч';
  }

  @override
  String get metricWords => 'Сөздөр';

  @override
  String get metricCharacters => 'Белгилер';

  @override
  String get saveStatusUnsaved => 'Сакталган жок';

  @override
  String get saveStatusSaving => 'Сакталууда...';

  @override
  String get saveStatusSaved => 'Сакталды';

  @override
  String get saveStatusError => 'Сактоо катасы';

  @override
  String get interviewPracticeTitle => 'Маек машыгуусу';

  @override
  String get interviewSettingUp => 'Маек даярдалууда...';

  @override
  String get interviewSetupTitle => 'ЖИ маегинин жөндөөлөрү';

  @override
  String get interviewSetupSubtitle =>
      'Маекти баштоодон мурун ЖИ интервьюердин жөндөөлөрүн тууралаңыз.';

  @override
  String get interviewTypeLabel => 'Маектин түрү';

  @override
  String get interviewTypeGeneral => 'Жалпы таанышуу';

  @override
  String get interviewTypeUniversitySpecific => 'Университетке ылайыкталган';

  @override
  String get interviewTypeVisa => 'Виза / Элчилик маеги';

  @override
  String get targetUniversityFieldLabel => 'Максаттуу университет';

  @override
  String get languageLabel => 'Тил';

  @override
  String get interviewerPersonaLabel => 'Интервьюердин түрү';

  @override
  String get focusTopicLabel => 'Тема (милдеттүү эмес)';

  @override
  String get focusTopicHint =>
      'мисалы, Компьютердик илимдер адистиги жөнүндө...';

  @override
  String get timedModeTitle => 'Убакыт чектөөсү';

  @override
  String get timedModeSubtitle => 'Катуу 5 мүнөттүк чек';

  @override
  String get startPracticeButton => 'Машыгууну баштоо';

  @override
  String get pickUniversityFirstHint =>
      'Жогортон максаттуу университетти тандаңыз.';

  @override
  String get coachingFiller => 'Ашыкча сөздөрдөн качыңыз!';

  @override
  String get lifelineHintsTitle => '💡 Жардам кеңештери:';

  @override
  String get speakerAi => 'AI';

  @override
  String get speakerYou => 'You';

  @override
  String connectionInterrupted(String detail) {
    return 'Байланыш үзүлдү: $detail';
  }

  @override
  String get interviewAnalyticsTitle => 'Маектин талдоосу';

  @override
  String get analyzingTranscript => 'ЖИ транскрипцияны талдап жатат...';

  @override
  String get noFeedbackAvailable => 'Пикир табылган жок.';

  @override
  String get overallScoreLabel => 'Жалпы балл';

  @override
  String get metricCommunication => 'Баарлашуу';

  @override
  String get metricConfidence => 'Ишенимдүүлүк';

  @override
  String get metricContent => 'Мазмун';

  @override
  String get metricLanguage => 'Тил';

  @override
  String get detailedFeedbackTitle => 'Толук пикир';

  @override
  String get detailedFeedbackFallback => 'Жакшы жыйынтык.';

  @override
  String get strengthsLabel => 'Күчтүү жактары';

  @override
  String get areasToImproveLabel => 'Жакшыртуу керек';

  @override
  String get startAnotherInterview => 'Жаңы маекти баштоо';

  @override
  String get sessionRecording => 'Сессиянын жазуусу';

  @override
  String get audioRecordingNotFound => 'Аудио жазуу табылган жок.';

  @override
  String get interviewHistoryTitle => 'Маектердин тарыхы';

  @override
  String get noPastInterviews => 'Мурунку маектер табылган жок.';

  @override
  String get unknownTarget => 'Белгисиз максат';

  @override
  String get unknownUniversity => 'Белгисиз университет';

  @override
  String get abandonedSessionNote =>
      'Бул сессия пикирсиз аяктаган — кайра угуу мүмкүн эмес.';

  @override
  String get activeSessionNote =>
      'Бул сессия дагы эле активдүү. Аяктап, пикирди көрүңүз.';

  @override
  String get deleteSessionTooltip => 'Сессияны өчүрүү';

  @override
  String get deleteInterviewDialogTitle => 'Бул сессияны өчүрөсүзбү?';

  @override
  String get deleteInterviewDialogBody =>
      'Пикир жана жазуунун шилтемеси биротоло өчүрүлөт.';

  @override
  String deleteFailed(Object error) {
    return 'Өчүрүү ишке ашкан жок: $error';
  }

  @override
  String get a11yTooltipAskAi => 'Ask Hanguk AI';

  @override
  String get a11yTooltipClearChat => 'Чат тарыхын тазалоо';

  @override
  String get a11yTooltipSendMessage => 'Билдирүү жөнөтүү';

  @override
  String get a11yTooltipClose => 'Close';

  @override
  String get a11yTooltipPreviewDocument => 'Preview document';

  @override
  String get a11yTooltipDeleteDocument => 'Delete document';

  @override
  String get a11yTooltipInterviewHistory => 'Interview history';

  @override
  String get a11yTooltipCloseSession => 'Сессияны жабуу';

  @override
  String get a11yTooltipDeleteSession => 'Сессияны өчүрүү';

  @override
  String get a11yTooltipBack => 'Артка';

  @override
  String get a11yTooltipPlayRecording => 'Жазууну угуу';

  @override
  String get a11yTooltipPauseRecording => 'Жазууну токтотуу';

  @override
  String get trackMismatchWarning =>
      'Долбооруңуздун тили сиз тандаган багытка дал келбейт. Сураныч, тандалган тилде кайра жазыңыз.';

  @override
  String get interviewStartError =>
      'Маекти баштоо мүмкүн болгон жок. Интернет байланышын текшерип, кайра аракет кылыңыз.';

  @override
  String get perAnswerReviewTitle => 'Ар бир жооптун талдоосу';

  @override
  String get betterAnswerLabel => 'КҮЧТҮҮРӨӨК ЖООП';

  @override
  String get navHome => 'Home';

  @override
  String get navMenu => 'Menu';

  @override
  String get greetingMorning => 'Good morning';

  @override
  String get greetingAfternoon => 'Good afternoon';

  @override
  String get greetingEvening => 'Good evening';

  @override
  String get welcomeHeadline => 'Welcome to\nyour journey';

  @override
  String get welcomeSubtitle =>
      'Your path to a South Korean university starts here.';

  @override
  String get welcomeMagicCodeCta => 'I have a magic code';

  @override
  String get welcomeExploreCta => 'Университеттерди көрүү';

  @override
  String get magicCodeTitle => 'Сыйкырдуу код';

  @override
  String get homeJourneyEyebrow => 'Your journey';

  @override
  String get homeContinueJourney => 'Continue journey';

  @override
  String get homeViewAll => 'View all';

  @override
  String documentsCollected(int collected, int total) {
    return '$collected of $total collected';
  }

  @override
  String get documentActionUpload => 'Upload';

  @override
  String get documentStatusApproved => 'Approved';

  @override
  String get documentStatusPendingReview => 'Pending review';

  @override
  String get statusDocs => 'Documents';

  @override
  String get statusSubmitted => 'Submitted';

  @override
  String get statusInReview => 'Каралууда';

  @override
  String get statusWaiting => 'Waiting';

  @override
  String get statusRejected => 'Четке кагылды';

  @override
  String get journeyStageDocumentPrep => 'Документтерди даярдоо';

  @override
  String get journeyStageOnlineApplication => 'Онлайн арыз';

  @override
  String get journeyStageOfflineApplication => 'Офлайн арыз';

  @override
  String get journeyStageInterview => 'Маек';

  @override
  String get journeyStageWaitingInvoice => 'Эсеп-фактураны күтүү';

  @override
  String get journeyStageTuitionPayment => 'Контракт төлөмү';

  @override
  String get journeyStageWaitingAdmission => 'Кабыл алуу катын күтүү';

  @override
  String get journeyStageVisaPreparation => 'Визага даярдык';

  @override
  String get journeyStageWaitingVisa => 'Виза берилишин күтүү';

  @override
  String mapUniversitiesMapped(int count) {
    return '$count universities mapped';
  }

  @override
  String get updateAvailableTitle => 'Update Available';

  @override
  String updateVersionReady(String version) {
    return 'Version $version is ready to install.';
  }

  @override
  String updateSizeMb(String size) {
    return 'Size: $size MB';
  }

  @override
  String get updateSigningKeyWarning =>
      'This update changes the app signing key. After installing you will need to log in again with your magic code.';

  @override
  String get updateNow => 'Update Now';

  @override
  String get updateLater => 'Later';

  @override
  String get updateDownloadingTitle => 'Downloading Update';

  @override
  String updateDownloadProgress(String downloaded, String total) {
    return '$downloaded MB / $total MB';
  }

  @override
  String get updateInstallingLabel => 'Verifying and installing…';

  @override
  String get updateFailedTitle => 'Update Failed';

  @override
  String get updateErrorNetwork =>
      'Could not download the update. Please check your internet connection and try again.';

  @override
  String get updateErrorHashMismatch =>
      'The downloaded file failed integrity verification. Please try again — if the problem repeats, contact your counsellor.';

  @override
  String get updateErrorInstallDenied =>
      'Installation was blocked by your device. Please grant \"Install unknown apps\" permission for Hanguk in your phone settings, then try again.';

  @override
  String get updateErrorStorage =>
      'Not enough storage to download the update. Please free up some space and try again.';

  @override
  String get updateErrorUnsupportedPlatform =>
      'Updates are not available on this platform yet.';

  @override
  String get updateErrorUnknown =>
      'Update failed. Please try again, or contact your counsellor.';

  @override
  String get guestModeEyebrow => 'Guest Explorer';

  @override
  String get guestJoinCta => 'Hanguk\'ка кошулуу';

  @override
  String get guestExploreTitle => 'Find Your University';

  @override
  String guestUniversitiesCount(int count) {
    return '$count университет';
  }

  @override
  String get guestNavExplore => 'Explore';

  @override
  String get guestNavCompare => 'Compare';

  @override
  String guestCompareCount(int count) {
    return 'Compare $count/2';
  }

  @override
  String get guestCompareEmptySlot => 'Add from Explore';

  @override
  String get guestCompareApplyCta => 'Apply with Hanguk';

  @override
  String get guestCompareReassurance =>
      'Get a magic code and our team will guide your application from documents to visa.';

  @override
  String get guestRowCity => 'Шаар';

  @override
  String get guestRowTier => 'Деңгээл';

  @override
  String get guestRowIeqas => 'IEQAS абалы';

  @override
  String get ieqasOutstanding => 'IEQAS эң жакшы';

  @override
  String get ieqasAccredited => 'IEQAS аккредитация';

  @override
  String get guestRowPartner => 'Hanguk өнөктөшү';

  @override
  String get guestRowNextEvent => 'Кийинки дата';

  @override
  String get guestRowWebsite => 'Website';

  @override
  String get guestRowTuition => 'Tuition';

  @override
  String get guestRowApplication => 'Application';

  @override
  String get guestRowDocDeadline => 'Document deadline';

  @override
  String get guestRowTopik => 'TOPIK';

  @override
  String get guestRowEnglish => 'English';

  @override
  String get guestRowInterview => 'Interview';

  @override
  String get guestRowDocuments => 'Documents';

  @override
  String guestTuitionYearNote(int year) {
    return '$year figure';
  }

  @override
  String guestDocumentsCount(int count) {
    return '$count types';
  }

  @override
  String get guestApostilleShort => 'apostille needed';

  @override
  String get guestValueYes => 'Yes';

  @override
  String get guestValueNo => 'No';

  @override
  String get roomTabStatus => 'Status';

  @override
  String get roomTabDiscussion => 'Discussion';

  @override
  String get roomTabNews => 'News';

  @override
  String get roomTabCalendar => 'Calendar';

  @override
  String get roomApplicationProgress => 'Application Progress';

  @override
  String get roomChatEmpty => 'No messages yet. Start the conversation!';

  @override
  String get roomChatHint => 'Message room...';

  @override
  String get roomChatSenderFallback => 'User';

  @override
  String get roomNewsEmpty => 'No active announcements.';

  @override
  String get roomEventsEmpty => 'No events to display on this date.';

  @override
  String get uniDbPhaseBadge => 'Университеттер базасы · 0-баскыч даярдалды';

  @override
  String get uniDbRecentChangesTitle =>
      'Updates from your tracked universities';

  @override
  String get timeJustNow => 'азыр эле';

  @override
  String timeMinutesAgo(int minutes) {
    return '$minutes мүнөт мурун';
  }

  @override
  String timeHoursAgo(int hours) {
    return '$hours саат мурун';
  }

  @override
  String timeDaysAgo(int days) {
    return '$days күн мурун';
  }

  @override
  String get uniDbVerifiedDeadlinesTitle => 'Verified upcoming deadlines';

  @override
  String get deadlineClosed => 'Жабылды';

  @override
  String deadlineInDays(int days) {
    return '$days күндөн кийин';
  }

  @override
  String deadlineInHours(int hours) {
    return '$hours сааттан кийин';
  }

  @override
  String deadlineInMinutes(int minutes) {
    return '$minutes мүнөттөн кийин';
  }

  @override
  String get eventApplyOpen => 'Арыз кабыл алуу башталат';

  @override
  String get eventApplyClose => 'Арыз кабыл алуу аяктайт';

  @override
  String get eventDocumentsDue => 'Документ тапшыруу мөөнөтү';

  @override
  String get eventFirstStageResults => '1-баскычтын жыйынтыгы';

  @override
  String get eventInterviewLabel => 'Маек';

  @override
  String get eventPracticalExam => 'Практикалык сынак';

  @override
  String get eventFinalResults => 'Акыркы жыйынтыктар';

  @override
  String get eventAdditionalAdmit => 'Кошумча кабыл алуу';

  @override
  String get eventRegistrationOpen => 'Каттоо башталат';

  @override
  String get eventRegistrationClose => 'Каттоо аяктайт';

  @override
  String get cycleForeign => 'Чет элдик абитуриенттер';

  @override
  String get cycleOverseasKoreanFull => 'Чет өлкөдөгү корейлер (толук)';

  @override
  String get cycleOverseasKoreanPartial =>
      'Чет өлкөдөгү корейлер (жарым-жартылай)';

  @override
  String get cycleSusi => 'Susi';

  @override
  String get cycleJeongsi => 'Jeongsi';

  @override
  String get cycleTransfer => 'Окууну которуу';

  @override
  String get cycleGradGeneral => 'Магистратура';

  @override
  String get cycleGradForeign => 'Магистратура (чет элдик)';

  @override
  String get uniSpecificHeader => 'Университетке ылайыкталган маек';

  @override
  String get uniSpecificPickPrompt =>
      'Маектин суроолору тандалган университеттин кабыл алуу багытына, талаптарына жана негизги мөөнөттөрүнө ылайыкталышы үчүн жогортон университет тандаңыз.';

  @override
  String uniSpecificLoadError(Object error) {
    return 'Кабыл алуу маалыматтарын жүктөө мүмкүн болгон жок: $error\nЖалпы маекти баары бир өткөрө аласыз.';
  }

  @override
  String get uniSpecificNoData =>
      'Бул университет үчүн текшерилген кабыл алуу маалыматтары азырынча жок. 모집요강 документи кошулганга чейин маек жалпы суроолор менен өтөт.';

  @override
  String get uniSpecificFallbackButton => 'Жалпы маекти сынап көрүңүз';

  @override
  String uniSpecificTrackLabel(String category) {
    return 'Багыт: $category';
  }

  @override
  String get uniSpecificSeedNote =>
      'Маектин суроолору ушул кабыл алуу маалыматтарына негизделет.';

  @override
  String get uniSpecificRecruitmentUnitFallback => 'Кабыл алуу багыты';

  @override
  String get uniDbInstitutionTitle => 'Университет';

  @override
  String get uniDbNotFoundTitle => 'Университет табылган жок';

  @override
  String get uniDbNotFoundBody =>
      'Бул университет азырынча каталогубузда жок. Кийинчерээк кайра текшерип көрүңүз.';

  @override
  String get uniDbUpcomingDeadlines => 'Жакындап калган мөөнөттөр';

  @override
  String get uniDbNoDeadlines => 'Азырынча жарыяланган мөөнөттөр жок.';

  @override
  String get uniDbTuitionHeading => 'Контракт төлөмү';

  @override
  String get uniDbTuitionEmpty =>
      'Контракт төлөмү боюнча маалымат азырынча жок.';

  @override
  String get uniDbRequirementsHeading => 'Талаптар';

  @override
  String get uniDbRequirementsEmpty => 'Кабыл алуу талаптары азырынча жок.';

  @override
  String get uniDbScholarshipsHeading => 'Стипендиялар';

  @override
  String get uniDbScholarshipsEmpty =>
      'Бул университет үчүн азырынча стипендиялар көрсөтүлгөн жок.';

  @override
  String get uniDbDocumentChecklistHeading => 'Документтердин тизмеси';

  @override
  String get uniDbDocumentsEmpty => 'Документтердин тизмеси азырынча жок.';

  @override
  String get uniDbTrackTitle => 'Бул университетти көзөмөлдөө';

  @override
  String get uniDbTrackOnDesc =>
      'Мөөнөттөр башкы барактагы баннерде көрүнөт жана өзгөрүүлөр тууралуу push-билдирме аласыз.';

  @override
  String get uniDbTrackOffDesc =>
      'Мөөнөттөрдү, оңдоо жарыяларын жана талаптардын өзгөрүшүн көзөмөлдөө үчүн күйгүзүңүз.';

  @override
  String uniDbTrackError(Object error) {
    return 'Көзөмөлдү жаңыртуу мүмкүн болгон жок: $error';
  }

  @override
  String get uniDbOpenGuidePdf => 'Кабыл алуу көрсөтмөсүнүн PDF-ин ачуу';

  @override
  String get uniDbNoGuidePdf => 'Кабыл алуу көрсөтмөсүнүн PDF-и азырынча жок.';

  @override
  String get uniDbPdfNoApp =>
      'PDF-ти ачуу мүмкүн болгон жок — аны ача турган тиркеме табылган жок.';

  @override
  String uniDbPdfError(Object error) {
    return 'PDF-ти ачуу мүмкүн болгон жок: $error';
  }

  @override
  String uniDbAcademicYear(int year) {
    return '$year окуу жылы';
  }

  @override
  String uniDbSemesterLabel(int number) {
    return '$number-семестр';
  }

  @override
  String get uniDbFirstSemester => 'биринчи семестр';

  @override
  String uniDbAdmissionFee(String amount) {
    return '+ $amount кабыл алуу төлөмү';
  }

  @override
  String uniDbGpaChip(String pct) {
    return 'GPA ≥ $pct%';
  }

  @override
  String get uniDbTopikTierTable => 'TOPIK деңгээлдеринин таблицасы';

  @override
  String uniDbDocumentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count документ',
      one: '1 документ',
    );
    return '$_temp0';
  }

  @override
  String get uniDbApostilleRequired => 'Апостиль талап кылынат';

  @override
  String uniDbLastVerified(String date) {
    return 'Акыркы текшерүү: $date';
  }

  @override
  String get eventOrientation => 'Таанышуу күнү';

  @override
  String get eventSemesterStart => 'Семестр башталат';

  @override
  String get facultyHumanities => 'Гуманитардык илимдер';

  @override
  String get facultySocialScience => 'Коомдук илимдер';

  @override
  String get facultyNaturalScience => 'Табигый илимдер';

  @override
  String get facultyEngineering => 'Инженерия';

  @override
  String get facultyMedical => 'Medical / Pharma';

  @override
  String get facultyArts => 'Искусство';

  @override
  String get facultyPhysicalEducation => 'Дене тарбия';

  @override
  String get uniDbCompareTitle => 'Салыштыруу';

  @override
  String get uniDbCompareEmptyTitle => 'Университеттерди салыштыруу';

  @override
  String get uniDbCompareEmptyBody =>
      'Кеминде эки университетти көзөмөлгө кошуп, андан кийин салыштыруу үчүн ушул жерге кайтыңыз.';

  @override
  String get uniDbCompareNeedSecond =>
      'Салыштыруу үчүн экинчи университет керек.';

  @override
  String uniDbCompareSelected(String name) {
    return 'Азыр тандалганы: $name';
  }

  @override
  String get uniDbColEnglishName => 'Англисче аталышы';

  @override
  String get uniDbColUzbekName => 'Өзбекче аталышы';

  @override
  String get uniDbColLastVerified => 'Акыркы текшерүү';

  @override
  String get uniDbTrackerTitle => 'Арыздарды көзөмөлдөө';

  @override
  String get uniDbTrackerEmptyTitle =>
      'Азырынча көзөмөлдөгөн университеттер жок';

  @override
  String get uniDbTrackerEmptyBody =>
      'Университеттин барагында аны көзөмөлгө кошуңуз — мөөнөттөрү ушул жерде көрүнөт.';

  @override
  String get uniDbLoadFailed =>
      'Университеттердин тизмесин жүктөө мүмкүн болгон жок.';

  @override
  String get loginSubmitButton => 'Login to System';

  @override
  String get welcomeGuestCaption => 'No code needed to browse and compare.';

  @override
  String get welcomeClientsDivider => 'Hanguk clients';

  @override
  String get loginNoCodePrompt => 'No code?';

  @override
  String get loginAskConsultant => 'Ask your consultant';

  @override
  String get homeNotifications => 'Билдирмелер';

  @override
  String get notifApplicationUpdates => 'Арыз жаңылыктары';

  @override
  String get notifToUpload => 'Жүктөө керек';

  @override
  String get notifAllCaughtUp => 'Баары аткарылды';

  @override
  String get notifAllCaughtUpBody =>
      'Документтериңиз жана арыздарыңыз тууралуу эскертмелер ушул жерде чыгат.';

  @override
  String get guestContactEyebrow => 'Hanguk Consulting';

  @override
  String get guestContactTitle => 'Биз менен байланышыңыз';

  @override
  String get guestContactSubtitle =>
      'Ыңгайлуу каналды тандаңыз — баарында жооп беребиз.';

  @override
  String get guestContactTelegramChannel => 'Telegram канал';

  @override
  String get guestContactTelegramChannelHint =>
      'Жаңылыктар, мөөнөттөр жана кабыл алуулар';

  @override
  String get guestContactTelegramDirect => 'Telegram\'да жазуу';

  @override
  String get guestContactTelegramDirectHint =>
      'Консультантка түз суроо бериңиз';

  @override
  String get guestContactInstagram => 'Instagram';

  @override
  String get guestContactInstagramHint =>
      'Студенттер, кампустар, күнүмдүк жашоо';

  @override
  String get guestContactCall => 'Чалуу';

  @override
  String get guestContactJoinHint => 'Сыйкырдуу кодуңуз барбы?';

  @override
  String get guestContactLaunchFailed =>
      'Бул шилтемени ачуу мүмкүн болгон жок.';

  @override
  String get guestContactCta => 'Contact us';

  @override
  String get aiReportAction => 'Даттануу';

  @override
  String get aiReportTitle => 'Бул жооп боюнча даттануу';

  @override
  String get aiReportBody =>
      'Бул ЖИ жообунда эмне туура эмес экенин жазыңыз. Командабыз ар бир даттанууну карап чыгат.';

  @override
  String get aiReportReasonHint => 'Эмнеси туура эмес? (милдеттүү эмес)';

  @override
  String get aiReportSubmit => 'Даттанууну жөнөтүү';

  @override
  String get aiReportThanks => 'Рахмат. Командабыз бул жоопту карап чыгат.';

  @override
  String get aiReportFailed =>
      'Даттанууну жөнөтүү мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get catalogSearchHint => 'Аталышын, шаарын же багытын жазыңыз';

  @override
  String get catalogListTitle => 'Университеттер';

  @override
  String catalogCityUniversities(String city) {
    return '$city университеттери';
  }

  @override
  String get catalogEmptyTitle => 'Университет табылган жок';

  @override
  String get catalogEmptyBody => 'Башка шаарды же чыпканы тандап көрүңүз.';

  @override
  String get catalogTypeState => 'Мамлекеттик университет';

  @override
  String get catalogTypePrivate => 'Жеке университет';

  @override
  String get catalogTypeSpecialized => 'Адистештирилген жогорку окуу жайы';

  @override
  String get catalogTypeStateShort => 'Мамлекеттик';

  @override
  String get catalogTypePrivateShort => 'Жеке';

  @override
  String get catalogTypeSpecializedShort => 'Адистештирилген';

  @override
  String get catalogFilterTitle => 'Чыпка';

  @override
  String get catalogFilterClear => 'Тазалоо';

  @override
  String get catalogFilterCity => 'Шаар';

  @override
  String catalogFilterCityPicked(int count) {
    return '$count тандалды';
  }

  @override
  String get catalogFilterDegree => 'Даража';

  @override
  String get catalogDegreeBachelor => 'Бакалавр';

  @override
  String get catalogDegreeMaster => 'Магистр';

  @override
  String get catalogFilterEnglish => 'Англис тили талабы';

  @override
  String get catalogFilterEnglishHint => 'сиздин IELTS баллыңыз';

  @override
  String get catalogIeltsNone => 'Шарт эмес';

  @override
  String get catalogIeltsNoteAll =>
      'Бардык программалар (корей жана англис тилинде)';

  @override
  String catalogIeltsNote(String score) {
    return 'IELTS $score менен кире турган англис тилиндеги программалар гана';
  }

  @override
  String get catalogFilterPrice => 'Контракт баасы';

  @override
  String get catalogPricePerSemester => 'семестр үчүн';

  @override
  String get catalogPriceFrom => 'Баштап';

  @override
  String get catalogPriceTo => 'Чейин';

  @override
  String catalogPriceUpTo(String amount) {
    return '$amount чейин';
  }

  @override
  String catalogApply(int count) {
    return '$count университетти көрсөтүү';
  }

  @override
  String get catalogFaculties => 'Факультеттер';

  @override
  String catalogFacultyCount(int count) {
    return '$count факультет';
  }

  @override
  String catalogProgramCount(int count) {
    return '$count багыт';
  }

  @override
  String catalogTuitionTitle(String name) {
    return 'Контракт баасы · $name';
  }

  @override
  String get catalogPerSemester => '/ семестр';

  @override
  String get catalogPerYear => '/ жыл';

  @override
  String get catalogSemSuffix => '/семестр';

  @override
  String get catalogYearSuffix => '/жыл';

  @override
  String get catalogYearlyTuition => 'Жылдык контракт';

  @override
  String get catalogApplicationFee => 'Арыз төлөмү';

  @override
  String get catalogEntranceFee => 'Кирүү төлөмү';

  @override
  String get catalogRequirements => 'Кирүү талаптары';

  @override
  String get catalogReqKorean => 'Корей тили';

  @override
  String get catalogReqEnglish => 'Англис программасы үчүн';

  @override
  String get catalogReqRecommendation => 'Сунуш кат';

  @override
  String get catalogRecYes => 'Керек';

  @override
  String get catalogRecNo => 'Шарт эмес';

  @override
  String get catalogRecOptional => 'Каалоо боюнча';

  @override
  String get catalogReqDocuments => 'Документтер';

  @override
  String catalogDocsRequired(int count) {
    return '$count милдеттүү';
  }

  @override
  String get catalogReqApostille => 'Апостиль';

  @override
  String catalogApostilleDocs(int count) {
    return '$count документке';
  }

  @override
  String get catalogReqBank => 'Банк эсеби (D-2)';

  @override
  String catalogTimeline(String season) {
    return 'Мөөнөттөр · $season';
  }

  @override
  String get catalogRoundLater => 'Кийин жарыяланат';

  @override
  String get catalogRoundEstimated => 'болжолдуу';

  @override
  String get catalogRoundRelative => 'Так дата жок';

  @override
  String get catalogWindowLabel => 'Документ тапшыруу убактысы';

  @override
  String catalogDaysLeft(int days) {
    return '$days күн калды';
  }

  @override
  String catalogWindowOpens(String date) {
    return '$date ачылат';
  }

  @override
  String get catalogWindowClosed => 'Мөөнөт бүттү';

  @override
  String get catalogContact => 'Байланышуу';

  @override
  String get catalogSeasonSpring => 'Жаз';

  @override
  String get catalogSeasonAutumn => 'Күз';

  @override
  String catalogSeasonLabel(String year, String term) {
    return '$year $term';
  }

  @override
  String get catalogFavorite => 'Add to compare';

  @override
  String get catalogNoDegreeData => 'Бул даража боюнча маалымат азырынча жок';

  @override
  String get catalogCompareChip => 'Салыштыруу';

  @override
  String catalogCompareChipCount(int count) {
    return 'Салыштыруу · $count/2';
  }

  @override
  String get catalogComparePickTwo => '2 университет тандаңыз';

  @override
  String get compareTraySlotEmpty => 'Choose';

  @override
  String get compareTrayCta => 'Compare';

  @override
  String get compareTitle => 'Compare';

  @override
  String get compareOnlyDiff => 'Only differences';

  @override
  String get compareAddSlot => 'Choose a university';

  @override
  String get compareNeedTwo => 'Choose 2 universities to compare.';

  @override
  String get compareMainInfo => 'Key facts';

  @override
  String get compareDetails => 'Details';

  @override
  String get compareRowTuition => 'Tuition (semester)';

  @override
  String get compareRowTopik => 'TOPIK requirement';

  @override
  String get compareRowIelts => 'IELTS requirement';

  @override
  String get compareRowDeadline => 'Application deadline';

  @override
  String get compareRowCity => 'City';

  @override
  String get compareRowRequirements => 'Admission requirements';

  @override
  String get compareBestCheaper => 'Cheaper';

  @override
  String get compareBestLower => 'Lower';

  @override
  String get entryRegisterTitle => 'Sign up';

  @override
  String get entryRegisterSubtitle =>
      'Create an account with your phone number and a password.';

  @override
  String get entryPhoneLabel => 'Phone number';

  @override
  String get entryPasswordLabel => 'Password';

  @override
  String get entryPasswordConfirmLabel => 'Repeat password';

  @override
  String get entryPasswordHint => 'At least 6 characters';

  @override
  String get entryRegisterSubmit => 'Sign up';

  @override
  String get entryHaveAccount => 'Already have an account?';

  @override
  String get entrySignInLink => 'Sign in';

  @override
  String get entrySignInTitle => 'Sign in';

  @override
  String get entrySignInSubtitle =>
      'Enter the phone number and password you signed up with.';

  @override
  String get entrySignInSubmit => 'Sign in';

  @override
  String get entryNoAccount => 'No account yet?';

  @override
  String get entryRegisterLink => 'Sign up';

  @override
  String get entryErrorPhone => 'Enter the full number: 9 digits after +998.';

  @override
  String get entryErrorPasswordShort =>
      'The password must be at least 6 characters.';

  @override
  String get entryErrorPasswordMismatch => 'The passwords do not match.';

  @override
  String get entryErrorExists =>
      'This number is already signed up. Sign in with your password.';

  @override
  String get entryStudentNotice =>
      'You are a Hanguk student — sign in with the Magic Code your consultant gave you.';

  @override
  String get entryErrorNotFound => 'This number is not signed up yet.';

  @override
  String get entryErrorWrongPassword => 'Wrong password.';

  @override
  String get entryErrorLocked => 'Too many attempts. Try again in 15 minutes.';

  @override
  String get entryErrorNetwork =>
      'Серверге туташуу мүмкүн болгон жок. Интернетти текшерип, кайра аракет кылыңыз.';

  @override
  String get entryShowPassword => 'Show password';

  @override
  String get entryHidePassword => 'Hide password';

  @override
  String get entryLanguageLabel => 'Тил';

  @override
  String get entryLanguageSheetTitle => 'Тилди тандаңыз';

  @override
  String get catalogStep1 => 'Онлайн документ тапшыруу';

  @override
  String get catalogStep2 => 'Application fee төлөө';

  @override
  String get catalogStep3 => 'Офлайн документ тапшыруу';

  @override
  String get catalogStep4 => 'Bank statement (университет үчүн)';

  @override
  String get catalogStep5 => 'Интервью';

  @override
  String get catalogStep6 => 'Жыйынтык жарыяланат';

  @override
  String get catalogStep7 => 'Контракт төлөө';

  @override
  String get catalogStep8 => 'Certificate of Admission берилет';

  @override
  String get catalogStep9 => 'Виза үчүн bank statement';

  @override
  String get catalogStep10 => 'Виза үчүн котормо жана апостиль';

  @override
  String get catalogStep11 => 'Визага документ тапшыруу';

  @override
  String get surveysTitle => 'Сурамжылоолор';

  @override
  String get surveysLoadError => 'Сурамжылоолорду жүктөө мүмкүн болгон жок';

  @override
  String get surveysEmptyTitle => 'Азырынча сурамжылоолор жок';

  @override
  String get surveysEmptyBody => 'Жаңы сурамжылоолор ушул жерде пайда болот';

  @override
  String get surveyCompletedChip => 'Аткарылды';

  @override
  String get surveyNewChip => 'Жаңы';

  @override
  String surveyQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count суроо',
      one: '1 суроо',
    );
    return '$_temp0';
  }

  @override
  String get surveyFillCta => 'Толтуруу →';

  @override
  String surveyPendingCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count surveys',
      one: '1 survey',
    );
    return '$_temp0';
  }

  @override
  String get surveyPendingSubtitle => 'Waiting for your answers';

  @override
  String get surveyTitleFallback => 'Сурамжылоо';

  @override
  String get surveyAnswerAllRequired =>
      'Бардык милдеттүү суроолорго жооп бериңиз';

  @override
  String get surveySubmitError =>
      'Жоопторду жөнөтүү мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get surveyThanksTitle => 'Рахмат!';

  @override
  String get surveyThanksBody => 'Жоопторуңуз кабыл алынды';

  @override
  String get surveyQuestionsLoadError => 'Суроолорду жүктөө мүмкүн болгон жок';

  @override
  String get surveyNoQuestions => 'Суроолор табылган жок';

  @override
  String get surveyAlreadyCompleted =>
      'Сиз бул сурамжылоону мурунтан толтургансыз';

  @override
  String get surveySubmit => 'Жөнөтүү';

  @override
  String get surveyRequired => 'Милдеттүү';

  @override
  String get surveyEmailHint => 'mysal@mail.com';

  @override
  String get surveyNumberHint => 'Сан жазыңыз';

  @override
  String get surveyLongTextHint => 'Толук жазыңыз...';

  @override
  String get surveyTextHint => 'Жообуңузду жазыңыз...';

  @override
  String get surveyPickDate => 'Датаны тандаңыз';

  @override
  String get docTypeIdCard =>
      'Тапшыруучунун ID картасынын (паспортунун) көчүрмөсү';

  @override
  String get docTypeForeignPassport =>
      'Тапшыруучунун чет өлкөгө чыгуучу паспортунун көчүрмөсү';

  @override
  String get docTypePhoto => 'Сүрөт (3.5x4.5 см)';

  @override
  String get docTypeDiploma => 'Диплом же аттестаттын көчүрмөсү';

  @override
  String get docTypeLanguageCertificate =>
      'Тил сертификатынын көчүрмөсү (кеминде IELTS 5.5 же TOPIK 2)';

  @override
  String get docTypeOther => 'Документ';

  @override
  String get docStatusLocked => 'Locked';

  @override
  String get notifPushSection => 'Акыркы билдирмелер';

  @override
  String get notifMarkAllRead => 'Баары окулду';

  @override
  String get appPendingApprovalNote =>
      'Awaiting counselor approval.\nWe will notify you once it\'s reviewed.';

  @override
  String get appCountrySouthKorea => 'South Korea';

  @override
  String get appRoomNotFound => 'This university doesn\'t have a room yet.';

  @override
  String get appRoomDiscussionNotFound => 'This room has no discussion yet.';

  @override
  String get appRoomDiscussionConnectError =>
      'Couldn\'t connect to the discussion.';

  @override
  String get appRoomSendError => 'Couldn\'t send the message.';

  @override
  String get appRoomNotSignedIn => 'Please sign in again.';

  @override
  String get appRoomLoadError => 'Couldn\'t load this. Please try again.';

  @override
  String get appRoomAnnouncementFallbackTitle => 'Announcement';

  @override
  String get appRoomEventFallbackTitle => 'Event';

  @override
  String get statusPendingApproval => 'Ырастоо күтүлүүдө';

  @override
  String get statusDocumentsCollection => 'Документтер чогултулууда';

  @override
  String get statusDocumentsTranslation => 'Документтер которулду';

  @override
  String get statusApostille => 'Апостиль даяр';

  @override
  String get statusApplicationSubmitted => 'Арыз тапшырылды';

  @override
  String get statusUniversityResponse => 'Университет жооп берди';

  @override
  String get statusVisaDocuments => 'Виза документтери';

  @override
  String get statusCompleted => 'Аякталды';

  @override
  String get statusInProgress => 'Жүрүүдө';

  @override
  String get chatGreeting =>
      'Салам! 👋 Мен Hanguk AI жардамчысымын. Документтер, университеттер жана арыз берүү процесси боюнча каалаган сурооңузга жооп берем!';

  @override
  String get chatNoResponse => 'Кечириңиз, жооп даярдай алган жокмун.';

  @override
  String get chatConnectError =>
      'Hanguk AI менен байланышуу мүмкүн болгон жок. Интернет байланышын текшериңиз.';

  @override
  String get chatCleared => 'Чат тазаланды. Сизге кантип жардам бере алам?';

  @override
  String get mapLoadFailed =>
      'Карта жүктөлгөн жок. Интернет байланышын текшериңиз.';

  @override
  String get mapTapForDetails => 'Толук маалымат үчүн басыңыз';

  @override
  String get mapProviderUnavailable => 'Карта кызматы азыр иштебей жатат.';

  @override
  String get mapInitError => 'Картаны иштетүү мүмкүн болгон жок.';

  @override
  String get trainingGuideSpTitle => 'Study Plan жазуу боюнча колдонмо';

  @override
  String get trainingGuideSpIntro =>
      'Study Plan — эмне үчүн Түштүк Кореяда окугуңуз келерин, алдыңызга койгон максаттарыңызды жана окууну бүткөндөн кийинки пландарыңызды түшүндүргөн маанилүү документ.';

  @override
  String get trainingGuideSp1Title => '1. Максат жана мотивация';

  @override
  String get trainingGuideSp1Body =>
      'Эмне үчүн дал ушул адистикти тандадыңыз? Эмне үчүн Түштүк Корея жана сиз тандаган университет бул максатыңызга ылайык келет?';

  @override
  String get trainingGuideSp2Title => '2. Окуу планы';

  @override
  String get trainingGuideSp2Body =>
      'Окуу учурунда кайсы сабактарга же багыттарга көбүрөөк көңүл бурасыз? Корей тилин үйрөнүү планыңыз кандай?';

  @override
  String get trainingGuideSp3Title => '3. Келечектеги пландар';

  @override
  String get trainingGuideSp3Body =>
      'Окууну бүткөндөн кийин эмне иш менен алектенесиз? Мекениңизге кандай салым кошосуз?';

  @override
  String get trainingGuidePsTitle => 'Personal Statement жазуу боюнча колдонмо';

  @override
  String get trainingGuidePsIntro =>
      'Personal Statement — сиздин инсандыгыңызды, жетишкендиктериңизди, кызыкчылыктарыңызды жана эмне үчүн дал ушул адистикке татыктуу экениңизди көрсөткөн эссе.';

  @override
  String get trainingGuidePs1Title => '1. Өткөнүңүз жана тажрыйбаңыз';

  @override
  String get trainingGuidePs1Body =>
      'Мектептеги же лицейдеги жетишкендиктериңиз, катышкан олимпиада жана долбоорлоруңуз, ошондой эле кызыкчылыктарыңыз жөнүндө жазыңыз.';

  @override
  String get trainingGuidePs2Title => '2. Жеке сапаттар';

  @override
  String get trainingGuidePs2Body =>
      'Сизди башка абитуриенттерден эмне айырмалап турат? Кыйынчылыктарды кантип жеңгенсиз?';

  @override
  String get trainingGuidePs3Title => '3. Эмне үчүн дал ушул тармак?';

  @override
  String get trainingGuidePs3Body =>
      'Бул тармакка кызыгууңуз качан жана кантип пайда болгон?';

  @override
  String get trainingStatusInProgress => 'Жүрүүдө';

  @override
  String get trainingStatusCompleted => 'Аякталган';

  @override
  String get trainingStatusAbandoned => 'Токтотулган';

  @override
  String get trainingErrorSessionsLoad =>
      'Долбоорлоруңузду жүктөө мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get trainingErrorCreateDraft =>
      'Долбоорду түзүү мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get trainingErrorLoadDraft =>
      'Долбоорду ачуу мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get trainingErrorDraftConflict =>
      'Башка түзмөктө жаңыраак долбоор сакталган. Бириктирүү үчүн баракты жаңыртыңыз.';

  @override
  String get trainingErrorTrackUpdate =>
      'Жазуу тилин өзгөртүү мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get trainingErrorGeneric =>
      'Бир нерсе туура эмес болуп калды. Кайра аракет кылыңыз.';

  @override
  String get trainingInterviewAiError =>
      'ЖИ интервьюерде көйгөй чыкты. Кайра аракет кылыңыз.';

  @override
  String get trainingInterviewAnswerError =>
      'Жообуңузду иштетүү мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get trainingInterviewVoiceError =>
      'Интервьюердин үнүн угузуу мүмкүн болгон жок.';

  @override
  String get trainingInterviewAudioLinkWarning =>
      'Жазуунун шилтемесин сактоо мүмкүн болгон жок. Кайра угуу мүмкүн болбой калышы ыктымал.';

  @override
  String get trainingInterviewFeedbackLoadError =>
      'Пикирди жүктөө мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get authErrorCodeNotFound =>
      'Бул код табылган жок. Сураныч, аны консультантыңыз менен текшерип көрүңүз.';

  @override
  String get authErrorServerUnreachable =>
      'Серверге туташуу мүмкүн болгон жок. Интернет байланышын текшерип, «Кирүү» баскычын кайра басыңыз.';

  @override
  String get authErrorStaffBlocked =>
      'Кызматкерлер magic code менен эмес, логин жана сырсөз менен кириши керек.';

  @override
  String get authErrorAccountSetupBusy =>
      'Сервер аккаунтуңузду жөндөп жатат. 30 секунддан кийин кайра аракет кылыңыз.';

  @override
  String get authErrorLoginServer =>
      'Кирүү серверинде ката кетти. Кайра аракет кылыңыз же консультантыңыздан аккаунтуңузду калыбына келтирүүнү сураңыз.';

  @override
  String get authErrorUnexpected =>
      'Серверде күтүлбөгөн ката кетти. Кайра аракет кылыңыз же консультантыңызга кайрылыңыз.';

  @override
  String get authErrorCrmAccount =>
      'Бул аккаунтту консультантыңыз түзгөн. Сураныч, ал берген Magic Access Code менен кириңиз.';

  @override
  String get authErrorAlreadyRegistered =>
      'Бул телефон номери мурунтан катталган. Сураныч, аккаунтка кириңиз.';

  @override
  String get authErrorSignUpDisabled =>
      'Катталуу азырынча өчүрүлгөн. Сураныч, администраторго кайрылыңыз.';

  @override
  String get authErrorPhoneFormat =>
      'Телефон номеринин форматы туура эмес. Сураныч, өлкөнүн кодун да жазыңыз.';

  @override
  String get authErrorSignUpFailed =>
      'Аккаунт түзүү мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get a11yMenu => 'Menu';

  @override
  String get accountExportShareSubject =>
      'Hanguk — маалыматтарыңыздын көчүрмөсү';

  @override
  String get accountExportShareText =>
      'Hanguk\'тагы маалыматтарыңыздын көчүрмөсү (JSON).';

  @override
  String get accountExportError =>
      'Маалыматтарыңызды экспорттоо мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get uniDbEventOther => 'Маанилүү дата';

  @override
  String get uniDbIeqasNone => 'IEQAS аккредитациясы жок';

  @override
  String get uniDbPdfLinkInvalid =>
      'Шилтемени ачуу мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get uniDbFacultyMedicine => 'Медицина';

  @override
  String get uniDbFacultyPharmacy => 'Фармация';

  @override
  String get uniDbFacultyArtsPe => 'Искусство жана спорт';

  @override
  String get uniDbFacultyTheology => 'Теология';

  @override
  String get uniDbFacultyInterdisciplinary => 'Тармактар аралык багыттар';

  @override
  String get uniDbFacultyAll => 'Бардык факультеттер';

  @override
  String get uniDbScholarshipScopeUniversity => 'Университет';

  @override
  String get uniDbScholarshipScopeNational => 'Мамлекет';

  @override
  String get uniDbScholarshipScopeRegional => 'Аймактык';

  @override
  String get uniDbScholarshipScopeFoundation => 'Фонд';

  @override
  String get uniDbScholarshipScopeDepartment => 'Кафедра';

  @override
  String uniDbAwardTuitionPct(String pct) {
    return 'Контракттан $pct% арзандатуу';
  }

  @override
  String get uniDbAwardTuition => 'Контракт арзандатуусу';

  @override
  String uniDbAwardTuitionKrw(String amount) {
    return 'Контракттан $amount арзандатуу';
  }

  @override
  String uniDbAwardStipendMonthly(String amount) {
    return 'Айына $amount стипендия';
  }

  @override
  String get uniDbAwardStipend => 'Айлык стипендия';

  @override
  String uniDbAwardAirfare(String amount) {
    return '$amount чейин авиабилет';
  }

  @override
  String get uniDbAwardAirfareCovered => 'Авиабилет төлөнөт';

  @override
  String get uniDbAwardOther => 'Башка жеңилдик';

  @override
  String uniDbTopikDeferred(String base) {
    return '$base (кийинчерээк тапшырса болот)';
  }

  @override
  String get uniDbChangeAdmissionCycle => 'Кабыл алуу мезгили';

  @override
  String get uniDbChangeDates => 'Даталар';

  @override
  String get uniDbChangeUpdated => 'Жаңыртылды';

  @override
  String get uniDbDocApostille => 'Апостиль';

  @override
  String get uniDbDocConsent => 'Макулдук каты';

  @override
  String get uniDbDocPassport => 'Паспорт';

  @override
  String get uniDbDocTopik => 'TOPIK сертификаты';

  @override
  String get uniDbDocLanguage => 'Тил сертификаты';

  @override
  String get uniDbDocTranscript => 'Баалардын көчүрмөсү';

  @override
  String get uniDbDocDiploma => 'Диплом же аттестат';

  @override
  String get uniDbDocEnrollment => 'Окуу жайынан маалымкат';

  @override
  String get uniDbDocFamily => 'Үй-бүлө курамы жөнүндө маалымкат';

  @override
  String get uniDbDocPowerOfAttorney => 'Ишеним кат';

  @override
  String get uniDbDocFinance => 'Каржылык мүмкүнчүлүктү тастыктаган документ';

  @override
  String get uniDbDocEntryExit => 'Чек арадан өтүү жөнүндө маалымкат';

  @override
  String get uniDbDocEmployment => 'Иш ордунан маалымкат';

  @override
  String get uniDbDocRecommendation => 'Сунуш кат';

  @override
  String get uniDbDocCitizenship => 'Жарандыкты тастыктаган документ';

  @override
  String get uniDbDocStatement => 'Мотивациялык кат жана окуу планы';

  @override
  String get uniDbDocAlienRegistration => 'Чет элдик жарандын каттоо картасы';

  @override
  String get uniDbDocIdCard => 'Жеке күбөлүктүн көчүрмөсү';

  @override
  String get uniDbDocPhoto => 'Сүрөт';

  @override
  String get uniDbDocPortfolio => 'Портфолио';

  @override
  String get uniDbDocHealth => 'Медициналык маалымкат';

  @override
  String get uniDbDocCalendar => 'Окуу календары';

  @override
  String get uniDbDocTax => 'Салык төлөгөнү жөнүндө маалымкат';

  @override
  String get uniDbDocBusinessRegistration => 'Ишкананы каттоо күбөлүгү';

  @override
  String get uniDbDocAward => 'Сыйлык күбөлүгү';

  @override
  String get uniDbDocApplicationForm => 'Арыз формасы';

  @override
  String get uniDbDocOther => 'Кошумча документ';

  @override
  String get interviewErrorNoGreeting =>
      'Интервьюер жооп берген жок. Артка кайтып, кайра аракет кылыңыз.';

  @override
  String get interviewErrorEndedBeforeGreeting =>
      'Интервьюер сүйлөй электе чалуу аяктады. Кайра аракет кылыңыз.';

  @override
  String get interviewErrorCallFailed =>
      'Чалууга туташуу мүмкүн болгон жок. Интернетти текшерип, кайра аракет кылыңыз.';

  @override
  String get onbResultRouteLanguageCourse => 'Language course';

  @override
  String get onbResultRouteBachelor => 'Bachelor\'s';

  @override
  String get onbResultRouteMaster => 'Master\'s';

  @override
  String get onbResultRouteCollege => 'Vocational college';

  @override
  String get onbResultIntakeSpring2027 => 'Spring 2027';

  @override
  String get onbResultIntakeFall2027 => 'Fall 2027';

  @override
  String get onbResultIntakeLater => 'Later';

  @override
  String get onbResultBandHigh => 'High chance';

  @override
  String get onbResultBandHighNote =>
      'The main requirements are met — you can start on the documents.';

  @override
  String get onbResultBandMid => 'Medium chance';

  @override
  String get onbResultBandMidNote =>
      'The way is open, but 1–2 points need strengthening.';

  @override
  String get onbResultBandLow => 'High risk for now — but there is a way';

  @override
  String get onbResultBandLowNote =>
      'Language and financial documents are not enough yet.';

  @override
  String get onbResultFactorsTitle => 'What affected it';

  @override
  String get onbResultFactorKoreanStrong =>
      'TOPIK 3 or higher — the bachelor\'s requirement is met';

  @override
  String get onbResultFactorKoreanTopik2Degree =>
      'TOPIK 2 — the embassy asks for TOPIK 3 for a bachelor\'s; enough for a college';

  @override
  String get onbResultFactorKoreanMissingDegree =>
      'The embassy asks for TOPIK 3 for a bachelor\'s';

  @override
  String get onbResultFactorKoreanCollegeStrong => 'TOPIK 3 or higher';

  @override
  String get onbResultFactorKoreanCollegeTopik2 =>
      'TOPIK 2 — the college requirement is met';

  @override
  String get onbResultFactorKoreanCourseCertificate =>
      'Sejong 1A / TOPIK 1 certificate';

  @override
  String get onbResultFactorKoreanCourseMissing =>
      'A language-course visa needs TOPIK 1 or a Sejong certificate';

  @override
  String get onbResultFactorIncomeYes => 'Parents\' official income';

  @override
  String get onbResultFactorIncomeNo => 'Parents have no official income';

  @override
  String get onbResultFactorGradRecent =>
      'Graduated recently — no gap in studies';

  @override
  String get onbResultFactorGradGapLong =>
      'A long time since graduation — the study intent must be explained';

  @override
  String get onbResultFactorAgeHigh =>
      'Because of age, the study intent must be explained';

  @override
  String get onbResultUnisTitle => 'Universities that fit you';

  @override
  String get onbResultAccredited => 'Accredited';

  @override
  String get onbResultTuitionLabel => 'Tuition/semester';

  @override
  String get onbResultBankLabel => 'KDB deposit';

  @override
  String get onbResultYearlyCost => 'Estimated yearly cost';

  @override
  String get onbResultStepsTitle => 'Next 3 steps';

  @override
  String get onbResultStepSchoolDocs =>
      'Translate and apostille the school certificate and passport';

  @override
  String get onbResultStepDiplomaDocs =>
      'Translate and apostille the diploma and passport';

  @override
  String get onbResultStepApplyOnTime =>
      'Submit the documents before the university deadline';

  @override
  String get onbResultPathsTitle => 'Paths that fit you';

  @override
  String get onbResultPathLanguageCourse => 'A language course first (D-4)';

  @override
  String get onbResultPathLanguageCourseNote =>
      'Learn Korean in Korea, then move on once you have TOPIK. The language-course visa also needs TOPIK 1 or a Sejong certificate.';

  @override
  String get onbResultPathCollege => 'Vocational college';

  @override
  String get onbResultPathCollegeNote =>
      'Your TOPIK 2 is enough for a vocational college.';

  @override
  String get onbResultPathNextSeason => 'Get ready for the next intake';

  @override
  String onbResultPathNextSeasonNote(String level) {
    return 'Get the TOPIK $level certificate and apply for the next intake.';
  }

  @override
  String onbResultTariffWhy(String tariff) {
    return '$tariff — why? →';
  }

  @override
  String get onbResultCtaOperator => 'Free consultation';

  @override
  String get onbResultCtaTelegram => 'Continue in Telegram';

  @override
  String get onbResultDisclaimer =>
      'This is a preliminary assessment. The visa decision is made by the embassy.';

  @override
  String onbResultPlanTariff(String tariff) {
    return 'Recommended tariff: $tariff';
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
  String get onbTariffsTitle => 'Prices and terms';

  @override
  String get onbTariffsSubtitle =>
      'Most of it is paid after the visa is issued.';

  @override
  String onbTariffServices(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count services',
      one: '1 service',
    );
    return '$_temp0';
  }

  @override
  String get onbTariffPriceStandart =>
      '2 mln so\'m now + 5 mln after the visa, or 5 mln in one go';

  @override
  String get onbTariffPricePremium =>
      '3 mln now + 10 mln after the visa, or 10 mln';

  @override
  String get onbTariffPriceNoRisk => '\$5 000 in one go';

  @override
  String get onbTariffPriceHanbox => '\$2 000 or \$400 + \$200 a month';

  @override
  String get onbTariffMore => 'Details →';

  @override
  String get onbTariffsCompare => 'Compare tariffs';

  @override
  String get onbTariffExcludedTitle => 'Not included';

  @override
  String get onbTariffExContract => 'Tuition';

  @override
  String get onbTariffExApplicationFee => 'Application fee';

  @override
  String get onbTariffExBankStatement => 'Bank statement';

  @override
  String get onbTariffExFlight => 'Flight';

  @override
  String get onbTariffExVisaFee => 'Visa fee';

  @override
  String get onbTariffExLiving => 'Living costs';

  @override
  String get onbTariffExVisa => 'Visa';

  @override
  String get onbTariffDetailEyebrow => 'Tariff details';

  @override
  String get onbTariffPayTitle => 'When you pay';

  @override
  String get onbTariffPayContract => 'Contract';

  @override
  String get onbTariffPayContractWhen => 'When the work starts';

  @override
  String get onbTariffPayVisa => 'Visa issued';

  @override
  String get onbTariffPayVisaWhen => 'When the visa is in your hands';

  @override
  String get onbTariffPayVisaDays =>
      'Within 7 working days after the visa is issued';

  @override
  String get onbTariffPayStart => 'At the start';

  @override
  String get onbTariffPayMonthly => 'Every month';

  @override
  String onbTariffMln(int n) {
    return '$n mln';
  }

  @override
  String get onbTariffOrOnceStandart => 'Or 5 mln so\'m in one go.';

  @override
  String get onbTariffOrOncePremium => 'Or 10 mln so\'m in one go.';

  @override
  String get onbTariffOrOnceHanbox =>
      'Or \$2 000 in one go, or in instalments.';

  @override
  String get onbTariffIncludedTitle => 'What\'s included';

  @override
  String get onbTariffIncUniChoice => 'Choosing a university';

  @override
  String get onbTariffIncDocsList => 'Document list and check';

  @override
  String get onbTariffIncTranslation => 'Help with translation and apostille';

  @override
  String get onbTariffIncStudyPlan => 'Study plan and motivation letter';

  @override
  String get onbTariffIncApply => 'Submitting the application';

  @override
  String get onbTariffIncInterview => 'Interview preparation';

  @override
  String get onbTariffIncVisaDocs => 'Visa documents';

  @override
  String get onbTariffIncDorm => 'Dormitory placement';

  @override
  String get onbTariffIncFirstWeek => 'Help in the first week in Korea';

  @override
  String get onbTariffIncApplyUpTo3 =>
      'Applying to up to 3 universities for you';

  @override
  String get onbTariffIncInterviewQuestions =>
      'Interview preparation (you get the questions that may come up)';

  @override
  String get onbTariffIncDocsPrep =>
      'Preparing documents (translation, apostille)';

  @override
  String get onbTariffIncPost => 'Postage';

  @override
  String get onbTariffIncSimBank => 'SIM card and bank card';

  @override
  String get onbTariffIncInterviewAi =>
      'Interview preparation (practice with AI)';

  @override
  String get onbTariffIncBankShot1Day => 'Bank account (simple, 1 day)';

  @override
  String get onbTariffIncBankShot1Month => 'Bank account (1 month)';

  @override
  String get onbTariffIncEmbassyDocs =>
      'Preparing embassy documents (translation, apostille)';

  @override
  String get onbTariffIncStudyPlanAi =>
      'Help writing the study plan (prepared with AI)';

  @override
  String get onbTariffIncPickup => 'Meeting you in Korea';

  @override
  String get onbTariffIncContractPaid => 'Tuition paid by the company';

  @override
  String get onbTariffIncFlightTicket => 'Plane ticket bought for you';

  @override
  String get onbTariffIncFlatMonth => 'A flat found and its first month paid';

  @override
  String get onbTariffIncAppFee => 'Application fee';

  @override
  String get onbTariffIncHanboxLessons =>
      '1 year of live online lessons (in the Hanguk Academy app), groups of 11–15, goal — TOPIK 2';

  @override
  String get onbTariffIncHanboxLaptop =>
      'A laptop and textbooks are included in the price';

  @override
  String get onbTariffIncHanboxFirstLesson => 'The first lesson is free';

  @override
  String get onbTariffIncHanboxStandart =>
      'After the course — Standart consulting free (TOPIK 2, 80% attendance, full payment)';

  @override
  String get onbTariffFaqTitle => 'Questions and answers';

  @override
  String onbTariffMlnSom(int n) {
    return '$n mln so\'m';
  }

  @override
  String onbTariffFaqNoVisaQ(String amount) {
    return 'If the visa is not issued, do I pay $amount?';
  }

  @override
  String onbTariffFaqNoVisaA(String amount) {
    return 'No. With the two-step payment, $amount is paid only after the visa is issued.';
  }

  @override
  String get onbTariffFaqWhenQ => 'When do I make the payment after the visa?';

  @override
  String get onbTariffFaqWhenA =>
      'Within 7 working days after the visa is issued.';

  @override
  String get onbTariffFaqContractQ => 'Who pays the tuition?';

  @override
  String get onbTariffFaqContractA =>
      'You pay the university tuition yourself — it is not included in the tariff price.';

  @override
  String get onbTariffFaqContractANoRisk =>
      'The company pays the tuition — it is included in the NO RISK price.';

  @override
  String get onbTariffCta => 'Get advice on this tariff';

  @override
  String get onbTariffContractPdf => 'Sample contract (PDF)';

  @override
  String get onbWelcomeTitle => 'Find out your visa chances [in 2 minutes]';

  @override
  String get onbWelcomeBody =>
      'Save time: answer a few short questions and get an honest assessment';

  @override
  String get onbWelcomeCta => 'Check my chances';

  @override
  String get onbWelcomeCatalog => 'Browse universities';

  @override
  String get onbWelcomeClientCode => 'I have a client code';

  @override
  String get onbQuizContinue => 'Улантуу';

  @override
  String get onbQuizBack => 'Back';

  @override
  String get onbQuizQ1 => 'What do you want to study in Korea?';

  @override
  String get onbQuizRouteCourse => 'Language course — learn Korean';

  @override
  String get onbQuizRouteBachelor => 'Bachelor\'s — university, 4 years';

  @override
  String get onbQuizRouteMaster => 'Master\'s — after a bachelor\'s';

  @override
  String get onbQuizRouteCollege => 'Vocational college — a 2–3 year trade';

  @override
  String onbQuizGradYearOrEarlier(String year) {
    return '$year or earlier';
  }

  @override
  String get onbQuizStillStudying => 'Still studying';

  @override
  String get onbQuizQ3 => 'What is your Korean level?';

  @override
  String get onbQuizQ3Hint =>
      'Pick by your official certificate. The embassy does not accept an application without one.';

  @override
  String get onbQuizKoreanNone => 'I don\'t speak Korean';

  @override
  String get onbQuizKoreanLearning => 'Learning, no certificate';

  @override
  String get onbQuizKoreanTopik1 => 'TOPIK 1 or a Sejong Hakdang certificate';

  @override
  String get onbQuizKoreanTopik2 => 'TOPIK 2';

  @override
  String get onbQuizKoreanTopik3 => 'TOPIK 3';

  @override
  String get onbQuizKoreanUnknown => 'Not sure';

  @override
  String get onbQuizQ5 => 'Do your parents have an official income?';

  @override
  String get onbQuizIncomeYes => 'Yes';

  @override
  String get onbQuizIncomeNo => 'No';

  @override
  String get onbQuizIntakeSpring2027 => 'Spring 2027 (March)';

  @override
  String get onbQuizIntakeFall2027 => 'Fall 2027 (September)';

  @override
  String get onbQuizIntakeLater => 'Later';

  @override
  String get onbContactTitle => 'Detailed plan and list of universities';

  @override
  String get onbContactSubtitle =>
      'An operator will review your answers and call you within 10 minutes.';

  @override
  String get onbContactAfterHours =>
      'We\'re outside working hours now. We\'ll call you tomorrow at 10:00.';

  @override
  String get onbContactName => 'Your name';

  @override
  String get onbContactPhone => 'Phone';

  @override
  String get onbContactPhoneError => 'Check the number';

  @override
  String get onbContactNameError => 'Enter your name';

  @override
  String get onbContactNetworkError =>
      'Couldn\'t send. Check your connection and try again.';

  @override
  String get onbContactTelegram => 'Also send the plan to my Telegram';

  @override
  String get onbContactCta => 'Have an operator call me';

  @override
  String get onbContactHours =>
      'Working hours Mon–Sat 09:40–18:00. At other times we\'ll call the next day at 10:00.';

  @override
  String onbContactSuccess(String name) {
    return 'Thank you, $name! An operator will call you within 10 minutes.';
  }

  @override
  String get onbContactBackToResult => 'Back to the result';

  @override
  String get onbContactAfterHoursToday =>
      'We\'re outside working hours now. We\'ll call you today at 10:00.';

  @override
  String get onbContactAfterHoursMonday =>
      'We\'re outside working hours now. We\'ll call you on Monday at 10:00.';

  @override
  String get onbQuizAgeQ => 'How old are you?';

  @override
  String get onbQuizGradQ => 'When did you finish your last school?';

  @override
  String get onbQuizIeltsQ => 'Do you have an IELTS score?';

  @override
  String get onbQuizIeltsNone => 'None, or below 5.5';

  @override
  String get onbQuizIelts55 => 'IELTS 5.5';

  @override
  String get onbQuizIelts60 => 'IELTS 6.0';

  @override
  String get onbQuizIelts65 => 'IELTS 6.5 or higher';

  @override
  String get onbQuizIeltsUnknown => 'Not sure';

  @override
  String get onbQuizPayerQ => 'Who pays for the studies?';

  @override
  String get onbQuizPayerParentsOption => 'My parents';

  @override
  String get onbQuizPayerSelfOption => 'Myself';

  @override
  String get onbQuizPayerSponsorOption => 'A sponsor or relative';

  @override
  String get onbQuizRegionQ => 'Which region do you live in?';

  @override
  String get onbQuizIntakeQ => 'When do you want to start?';

  @override
  String get onbResultFactorEnglishStrong =>
      'IELTS 5.5 or higher — for English-taught programmes';

  @override
  String get onbResultPartner => 'Official partner';

  @override
  String get onbResultLanguageLabel => 'Language';

  @override
  String get onbQuizKoreanTopik4 => 'TOPIK 4 or higher';

  @override
  String get onbQuizKdbQ => 'Can you put a deposit in the student\'s name?';

  @override
  String onbQuizKdbHint(String low, String high, String months) {
    return 'Required for the visa: $low (other cities) or $high (Seoul, Gyeonggi, Incheon) in a KDB Bank Uzbekistan account in the student\'s name, for at least $months month(s). It is not a payment — the money stays in the student\'s account.';
  }

  @override
  String get onbQuizKdbReady => 'Yes, the money is ready now';

  @override
  String get onbQuizKdbByIntake => 'We will have it before the intake';

  @override
  String get onbQuizKdbNo => 'No, we can\'t';

  @override
  String get onbQuizKdbUnknown => 'Not sure';

  @override
  String get onbResultFactorKoreanMasterStrong =>
      'TOPIK 4 or higher — the master\'s requirement is met';

  @override
  String get onbResultFactorKoreanTopik3Master =>
      'TOPIK 3 — the embassy asks for TOPIK 4 for a master\'s';

  @override
  String get onbResultFactorKoreanMissingMaster =>
      'The embassy asks for TOPIK 4 for a master\'s';

  @override
  String get onbResultFactorKoreanCollegeMissing =>
      'The embassy asks for TOPIK 2 for a college';

  @override
  String get onbResultFactorKdbReady =>
      'The KDB deposit is ready in the student\'s name';

  @override
  String get onbResultFactorKdbByIntake =>
      'The KDB deposit is not there yet — needed before applying';

  @override
  String get onbResultFactorKdbNo => 'No KDB deposit — the embassy requires it';

  @override
  String get onbResultBandLowNoteLanguage =>
      'The language certificate is below the embassy\'s requirement — without it the application is refused without an interview.';

  @override
  String get onbResultBandLowNoteMoney =>
      'The financial requirement (a KDB deposit in the student\'s name and the parents\' papers) is not met yet.';

  @override
  String get onbQuizQ1Hint =>
      'The result follows the visa rules for this route.';

  @override
  String get onbQuizGradHint =>
      'School, lyceum, college or university — whichever was last.';

  @override
  String get onbQuizGradQMaster => 'When did you finish your bachelor\'s?';

  @override
  String get onbQuizIeltsHint =>
      'Needed for English-taught programmes. Only the regular IELTS (not Online), taken in the last 2 years.';

  @override
  String get onbQuizIncomeHint =>
      'For example a salary certificate from work (my.gov.uz) or business and tax papers. The embassy asks for the parents\' papers.';

  @override
  String onbWelcomeCallTimer(String minutes) {
    return 'Our operator will contact you within $minutes minutes';
  }

  @override
  String onbResultStepLanguagePrep(String level) {
    return 'Prepare for the TOPIK $level certificate';
  }

  @override
  String onbResultStepLanguagePrepEnglish(String level) {
    return 'Prepare for TOPIK $level or IELTS 5.5';
  }

  @override
  String onbResultStepDeposit(String low, String high, String months) {
    return 'Open the KDB deposit in the student\'s name: $low–$high, for at least $months month(s)';
  }

  @override
  String get onbResultStepParentsDocs =>
      'Prepare the parents\' income or property papers (my.gov.uz)';

  @override
  String get onbResultPathEnglishTrack => 'An English-taught programme';

  @override
  String get onbResultPathEnglishTrackNote =>
      'With IELTS 5.5, apply to a programme that does not ask for Korean.';

  @override
  String get onbResultPathDeposit => 'Prepare the KDB deposit';

  @override
  String onbResultPathDepositNote(String low, String high, String months) {
    return '$low–$high in the student\'s name for at least $months month(s) — required for the visa.';
  }

  @override
  String get onbResultPathParentsDocs => 'The parents\' papers';

  @override
  String get onbResultPathParentsDocsNote =>
      'Official work, business or property papers — the embassy asks for these.';

  @override
  String get catalogGuestUniTitle => 'Конок университет';

  @override
  String get catalogGuestUniWhere => 'Азыр Өзбекстанда';

  @override
  String get catalogGuestUniBadge => 'Делегация Самаркандда';

  @override
  String get catalogAiResultsTitle => 'Жыйынтыктар';

  @override
  String get catalogAiSearching => 'Жасалма интеллект издеп жатат…';

  @override
  String catalogAiFields(String fields) {
    return 'Багыттар: $fields';
  }

  @override
  String fdIntakeLabel(String season) {
    return '$season intake';
  }

  @override
  String get fdSearchHint => 'Университет издеңиз';

  @override
  String get fdCellLanguage => 'Тил талабы';

  @override
  String get fdCellDeadline => 'Deadline';

  @override
  String get fdAdmissionUnknown => 'Admission ?%';

  @override
  String fdCounter(int current, int total) {
    return '$current / $total';
  }

  @override
  String get fdBannerUniversities => 'universities';

  @override
  String get fdBannerSubtitle => 'By field · city · TOPIK';

  @override
  String get fdSkip => 'Skip';

  @override
  String get fdSave => 'Save';

  @override
  String get fdPrevious => 'Previous';

  @override
  String get fdNext => 'Next';

  @override
  String get fdNavUniversities => 'Университеттер';

  @override
  String get fdNavMap => '360° map';

  @override
  String get fdNavPrepare => 'Даярдык';

  @override
  String get fdPrepareEyebrow => 'Университетке';

  @override
  String get fdPrepareTitle => 'даярдык';

  @override
  String fdPrepareStudyPlanSteps(int done, int total) {
    return '$done / $total баскыч';
  }

  @override
  String get fdPrepareStudyPlanTitle => 'Study Plan даярдоо';

  @override
  String get fdPrepareStudyPlanBody =>
      'Окуу планыңызды 4 баскычта жазыңыз, Hanguk AI пикир берет.';

  @override
  String get fdPrepareNew => 'Жаңы';

  @override
  String fdPrepareInterviewDone(int n) {
    return '$n машыгуу';
  }

  @override
  String get fdPrepareInterviewTitle => 'Маекке даярдык';

  @override
  String get fdPrepareInterviewBody =>
      'Hanguk AI интервьюери менен 8 суроону үн чыгарып машыгыңыз.';

  @override
  String get fdPrepareAskTitle => 'Hanguk AI\'га суроо бериңиз';

  @override
  String get fdPrepareAskBody => 'Документтер, виза, жатакана жөнүндө';

  @override
  String get fdRecentSearches => 'Акыркы издөөлөр';

  @override
  String fdCountTa(int count) {
    return '$count';
  }

  @override
  String get fdPopularCities => 'Белгилүү шаарлар';

  @override
  String get fdFieldIt => 'IT';

  @override
  String get fdFieldBusiness => 'Бизнес';

  @override
  String get fdFieldEngineering => 'Инженерия';

  @override
  String get fdFieldMedicine => 'Медицина';

  @override
  String get fdFieldDesign => 'Дизайн';

  @override
  String get fdFieldTourism => 'Туризм';

  @override
  String get fdFieldEducation => 'Педагогика';

  @override
  String get fdRegionSeoul => 'Сеул';

  @override
  String get fdOther => 'Башка';

  @override
  String get fdFilterTitleLead => 'What university';

  @override
  String get fdFilterTitleMark => 'do you need?';

  @override
  String get fdSectionField => 'Багыт';

  @override
  String get fdSectionCity => 'City';

  @override
  String get fdSectionDegree => 'Degree';

  @override
  String get fdSectionTopik => 'TOPIK required for admission';

  @override
  String get fdAny => 'Айырмасы жок';

  @override
  String get fdTopikNone => 'Талап жок';

  @override
  String get fdSectionFee => 'Tuition / semester';

  @override
  String fdFeeUpTo(String amount) {
    return '$amount чейин';
  }

  @override
  String get fdSectionType => 'Түрү';

  @override
  String fdShowUniversities(int count) {
    return '$count университетти көрүү →';
  }

  @override
  String get fdMatchingUniversities => 'matching universities';

  @override
  String fdOfTotal(int total) {
    return 'of $total';
  }

  @override
  String get fdSegLow => 'Төмөн';

  @override
  String get fdSegMid => 'Орточо';

  @override
  String get fdSegGood => 'Жакшы';

  @override
  String get fdSegHigh => 'Жогору';

  @override
  String get fdSegVeryHigh => 'Абдан жогору';

  @override
  String get fdAssessTitleLead => 'Кореяга бара аламбы';

  @override
  String get fdAssessTitleMark => 'өзү?';

  @override
  String get fdAssessTopik => 'My Korean (TOPIK)';

  @override
  String get fdAssessGpa => 'School certificate average';

  @override
  String get fdAssessBank => 'Bank balance (D-2)';

  @override
  String fdAssessBankNeed(String amount) {
    return '$amount required';
  }

  @override
  String fdMln(int n) {
    return '₩${n}M';
  }

  @override
  String get fdLanguageCourse => 'Language course';

  @override
  String get fdAssessRefused => 'Has a visa been refused before?';

  @override
  String get fdNo => 'No';

  @override
  String get fdYes => 'Yes';

  @override
  String get fdAssessSeeReport => 'See the report →';

  @override
  String fdAssessAdmissionCount(int n) {
    return 'Admission · $n universities';
  }

  @override
  String get fdVisa => 'Виза';

  @override
  String fdAssessTopikHint(int level, String uni, String word) {
    return 'TOPIK $level → $uni admission becomes «$word»';
  }

  @override
  String get fdReportNameError => 'Атыңызды жазыңыз';

  @override
  String get fdReportPhoneError => 'Телефон номерин толук жазыңыз';

  @override
  String get fdReportNetworkError =>
      'Жөнөтүү мүмкүн болгон жок. Интернетти текшерип, кайра аракет кылыңыз.';

  @override
  String get fdShare => 'Бөлүшүү';

  @override
  String get fdVerdictYes => 'YES';

  @override
  String get fdVerdictMaybe => 'MAYBE';

  @override
  String get fdVerdictNotYet => 'NOT YET';

  @override
  String get fdVerdictYesNote =>
      'Your figures are enough — you can start the documents.';

  @override
  String get fdVerdictMaybeNote =>
      'Raise one or two figures and the answer becomes «YES».';

  @override
  String get fdVerdictNotYetNote =>
      'The figures aren\'t there yet — start with the steps below.';

  @override
  String get fdReportFixesTitle => 'What to do';

  @override
  String get fdReportAdmission => 'University admission';

  @override
  String fdReportOpenOf(int total, int open) {
    return '$open of $total open';
  }

  @override
  String get fdReportVisa => 'D-2 visa';

  @override
  String get fdReportStudy => 'Studying in Korea';

  @override
  String fdFixBank(String amount) {
    return 'Банк эсебин $amount кылуу';
  }

  @override
  String fdFixTopik(int level) {
    return 'TOPIK $level деңгээлине жетүү';
  }

  @override
  String fdGainVisa(int n) {
    return 'виза +$n%';
  }

  @override
  String fdGainAdmission(int n) {
    return 'кабыл алуу +$n%';
  }

  @override
  String get fdReportFormLead => 'We\'ll send the report';

  @override
  String get fdReportFormFree => 'free';

  @override
  String get fdReportFormTail => '';

  @override
  String get fdReportName => 'Аты-жөнү';

  @override
  String get fdReportSend => 'Жөнөтүү';

  @override
  String get fdSentThanks => 'Рахмат';

  @override
  String fdSentBody(String phone) {
    return 'Отчёт $phone номерине жөнөтүлдү. Консультантыңыз 24 сааттын ичинде чалат.';
  }

  @override
  String get fdSentMeanwhile => 'Ушул аралыкта';

  @override
  String get fdSentDocsTitle => 'Документтердин тизмеси';

  @override
  String fdSentDocsBody(String uni, int count) {
    return '$uni үчүн $count документ';
  }

  @override
  String fdSentTopikTitle(int level) {
    return 'TOPIK $level деңгээлине даярдануу';
  }

  @override
  String get fdSentBack => 'Университеттерге кайтуу';

  @override
  String get fdSentConsultant => 'Сиздин консультантыңыз';

  @override
  String get fdSentCall => 'Чалуу';

  @override
  String get fdUniTuitionSem => 'Контракт / сем';

  @override
  String get fdUniTuitionYear => 'Контракт / жыл';

  @override
  String get fdUniDeadline => 'Документ мөөнөтү';

  @override
  String fdUniFacultiesSummary(int faculties, int majors) {
    return '$faculties факультет · $majors багыт';
  }

  @override
  String fdUniAllMajors(int count) {
    return 'Бардык $count багыт →';
  }

  @override
  String get fdSaved => 'Saved';

  @override
  String get fdUniCta => 'Can I really go to Korea?';

  @override
  String fdResultsMatching(int count) {
    return '$count matching universities';
  }

  @override
  String get fdResultsBestFirst => 'best match first';

  @override
  String get fdSlotDropHere => 'Ушул жерге';

  @override
  String fdSlotNumber(int n) {
    return '$n-слот';
  }

  @override
  String get fdSlotEmpty => 'бош';

  @override
  String get fdAddToSlot => 'Add to a slot';

  @override
  String get fdRemoveFromSlot => 'Remove from the slot';

  @override
  String fdInSlot(int n) {
    return '✓ In slot $n';
  }

  @override
  String get fdSlotsFull => 'Үч слот тең бош эмес. Адегенде бирин бошотуңуз.';

  @override
  String get fdBestThreeTitle => 'Pick your best 3';

  @override
  String fdBestThreeBody(int count) {
    return 'from $count — two at a time';
  }

  @override
  String get fdDuelTitleLead => 'Your best';

  @override
  String get fdDuelTitleMark => '3';

  @override
  String fdDuelCompared(int count) {
    return '$count compared';
  }

  @override
  String get fdOr => 'OR';

  @override
  String get fdDuelLegend => '= champion, goes into a slot';

  @override
  String get fdDuelPick => 'Pick this one';

  @override
  String get fdChosenTitleMark => 'Сонун';

  @override
  String get fdChosenTitleTail => 'тандоо!';

  @override
  String get fdChosenBodyThree =>
      'Your three universities are ready. Let\'s find out which are open to you.';

  @override
  String fdChosenBody(int count) {
    return 'Your $count universities are ready. Let\'s find out which are open to you.';
  }

  @override
  String get fdChosenNext => 'Now the big question';

  @override
  String get fdChosenAdmission => 'Can I get into these?';

  @override
  String get fdChosenVisa => 'Will I get the visa?';

  @override
  String get fdChosenEmpty =>
      'Слоттор азырынча бош. Жыйынтыктардан университет кошуңуз.';

  @override
  String get fdCompareTitle => 'Compare';

  @override
  String fdCompareCount(int count) {
    return '$count universities';
  }

  @override
  String get fdCompareCity => 'City';

  @override
  String get fdCompareType => 'Type';

  @override
  String get fdCompareAdmission => 'Admission';

  @override
  String get fdSavedTitle => 'Saved';

  @override
  String get fdSavedCompareThree => 'Compare all three';

  @override
  String get fdSavedCompareTwo => 'Compare both';

  @override
  String get fdSavedCompareBody => 'Fee, language and deadline side by side';

  @override
  String get fdSavedEmpty =>
      'Nothing saved yet. On the home screen, swipe a card right or tap ♡.';

  @override
  String get fdUnsave => 'Remove from saved';

  @override
  String get fdOddsLead => 'Кабыл алынуу ыктымалдыгым';

  @override
  String get fdStampSave => 'SAVE';

  @override
  String get fdStampSkip => 'SKIP';

  @override
  String get fdSwipeHint => 'Try swiping';

  @override
  String get fdQsRanking => 'дүйнөлүк рейтинг';

  @override
  String get fdPerSemShort => '/ сем';

  @override
  String get fdPerYearShort => '/ жыл';

  @override
  String get fdCodeTitleLead => 'Your client';

  @override
  String get fdCodeTitleMark => 'code';

  @override
  String get fdCodeBody =>
      'Enter the 8-character code your consultant gave you — your application status opens.';

  @override
  String get fdCodeSubmit => 'Sign in';

  @override
  String get fdCodeNoCode => 'No code? Free consultation:';

  @override
  String fdCodeCell(int n) {
    return 'Коддун $n-белгиси';
  }

  @override
  String fdMapKicker(int count) {
    return 'Across Korea · $count universities';
  }

  @override
  String get fdMapTitleMark => 'map';

  @override
  String get fdMapLabel => 'KOREA · 대한민국';

  @override
  String fdMapPin(String city, int count) {
    return '$city: $count universities';
  }

  @override
  String get fdMapZoomIn => 'Zoom in';

  @override
  String get fdMapZoomOut => 'Zoom out';

  @override
  String get fdMapOpen360 => 'Open the 360° view';

  @override
  String get fdMapEmpty => 'No university matches this filter.';

  @override
  String fdMapCardOf(int n, int total) {
    return '$n / $total';
  }

  @override
  String get fdNavApplication => 'Арызым';

  @override
  String get fdNavDocuments => 'Документтер';

  @override
  String get fdJourneyTitle => 'Арыздын жүрүшү';

  @override
  String get fdJourneyCurrent => 'Current stage';

  @override
  String fdJourneyNext(String stage) {
    return 'Next stage: $stage';
  }

  @override
  String get fdJourneyDone => 'Every stage is done';

  @override
  String get fdJourneyWaiting =>
      'Waiting for the consultant to confirm your application';

  @override
  String get fdJourneyEmpty => 'Азырынча арыз жок';

  @override
  String get fdJourneyEmptyBody =>
      'Консультант университетти арызыңызга бекиткенден кийин, жүрүшү ушул жерде көрүнөт.';

  @override
  String get fdJourneyBrowse => 'Университеттерди көрүү';

  @override
  String get fdJourneyRoom => 'University room';

  @override
  String get fdConsultantRole => 'Консультант · сурооларыңызга жооп берет';

  @override
  String get fdDocsTitle => 'Документтерим';

  @override
  String get fdDocsAccepted => 'Accepted documents';

  @override
  String fdDocsNeedMore(int n) {
    return '$n more needed';
  }

  @override
  String fdDocsUnderReview(int n) {
    return '$n under review';
  }

  @override
  String get fdDocsAllAccepted => 'Everything is accepted';

  @override
  String get fdDocAccepted => 'Кабыл алынды';

  @override
  String get fdDocNeeded => 'Керек';

  @override
  String get fdDocReview => 'Текшерилүүдө';

  @override
  String get fdDocUpload => 'Жүктөө';

  @override
  String get fdDocView => 'Көрүү';

  @override
  String get fdDocRemove => 'Өчүрүү';

  @override
  String get accountMoreLabel => 'Башка бөлүмдөр';

  @override
  String get fdPlanTitle => 'Study Plan';

  @override
  String get fdPlanStepGoal => 'Максат';

  @override
  String get fdPlanStepKorea => 'Эмне үчүн Корея';

  @override
  String get fdPlanStepUni => 'Эмне үчүн бул университет';

  @override
  String get fdPlanStepFuture => 'Келечек планы';

  @override
  String fdPlanStepOf(int n, int total) {
    return '$n-баскыч · $total баскычтан';
  }

  @override
  String get fdPlanQ1Head => 'Сиздин';

  @override
  String get fdPlanQ1Mark => 'максатыңыз?';

  @override
  String get fdPlanQ1Hint =>
      '3–5 сүйлөм. Эмнени үйрөнгүңүз келет жана бул сизге эмне үчүн керек? Так жазыңыз.';

  @override
  String get fdPlanQ2Head => 'Эмне үчүн дал';

  @override
  String get fdPlanQ2Mark => 'Корея?';

  @override
  String get fdPlanQ2Hint =>
      '3–5 сүйлөм. Жеке себепти жазыңыз: үй-бүлө, кесип, тил, тажрыйба. Жалпы сөздөрдөн качыңыз.';

  @override
  String get fdPlanQ3Head => 'Эмне үчүн дал ушул';

  @override
  String get fdPlanQ3Mark => 'университет?';

  @override
  String get fdPlanQ3Hint =>
      '3–5 сүйлөм. Университеттин программасы, лабораториясы же багыты сизге эмне үчүн ылайык? Так мисал келтириңиз.';

  @override
  String get fdPlanQ4Head => 'Окуудан кийинки';

  @override
  String get fdPlanQ4Mark => 'план?';

  @override
  String get fdPlanQ4Hint =>
      '3–5 сүйлөм. Окуудан кийин эмне кыласыз: иш, магистратура же үйгө кайтуу? Так кадамдарды жазыңыз.';

  @override
  String get fdPlanHintField => 'Ушул жерге жазыңыз…';

  @override
  String get fdPlanWarnTitle => 'Маанилүү: ЖИ жазган текстти тапшырбаңыз';

  @override
  String get fdPlanWarnBody =>
      'Университеттер ЖИ текстин аныкташат. Бул жерге жазганыңыз — сиздики гана. Hanguk AI пикир гана берет.';

  @override
  String get fdPlanFeedback => 'Пикир алуу';

  @override
  String get fdPlanFeedbackBusy => 'Талданууда…';

  @override
  String get fdPlanWriteFirst => 'Адегенде ушул баскычты жазыңыз.';

  @override
  String get fdPlanSheetTitle => 'Hanguk AI пикири';

  @override
  String get fdPlanStrengths => 'Жакшы жактары';

  @override
  String get fdPlanImprove => 'Жакшыртуу үчүн';

  @override
  String get fdPlanNext => 'Кийинки баскыч';

  @override
  String get fdPlanClose => 'Жабуу';

  @override
  String get fdPlanLoadFailed =>
      'Study Plan ачылган жок. Интернетти текшерип, кайра аракет кылыңыз.';

  @override
  String get fdInterviewTitle => 'Маек машыгуусу';

  @override
  String get fdInterviewAi => 'Hanguk AI · интервьюер';

  @override
  String fdInterviewStyle(String university) {
    return '$university кабыл алуу комиссиясынын стилинде';
  }

  @override
  String get fdInterviewTip =>
      'Так жана орточо ылдамдыкта сүйлөңүз · 60–90 секунд';

  @override
  String get fdInterviewMute => 'Микрофонду өчүрүү';

  @override
  String get fdInterviewUnmute => 'Микрофонду күйгүзүү';

  @override
  String get fdInterviewMuted => 'Микрофон өчүк — интервьюер сизди укпайт';

  @override
  String get fdCodeScan => 'Scan QR code';

  @override
  String get fdScanTitle => 'Scan the QR code';

  @override
  String get fdScanHint =>
      'Hold the QR code your consultant gave you inside the frame';

  @override
  String get fdScanNoCode =>
      'This QR code has no client code. Type the code instead.';

  @override
  String get fdScanNoCamera =>
      'Camera access is off. Allow it in the phone\'s settings, or type the code instead.';

  @override
  String get fdScanFailed => 'The camera did not open. Type the code instead.';

  @override
  String get fdPlanDictate => 'Үн менен жазуу';

  @override
  String get fdPlanDictateStop => 'Жазууну токтотуу';

  @override
  String get fdPlanListening => 'Угуп жатам… сүйлөңүз';

  @override
  String get fdPlanDictateUnavailable =>
      'Бул телефондо үндү текстке айландыруу иштеген жок. Микрофонго уруксатты текшериңиз.';

  @override
  String get ucTitle => 'Университет тандоо';

  @override
  String get ucSubtitle => 'Консультантыңыз сиз үчүн тандаган университеттер';

  @override
  String get ucNeedsAnswerTitle => 'Ырастооңуз керек';

  @override
  String get ucNeedsAnswerBody =>
      'Ар бир университетти карап чыгып, \"Макулмун\" же \"Өзгөртүүнү суранам\" баскычын басыңыз.';

  @override
  String ucRank(int rank) {
    return '$rank-ТАНДОО';
  }

  @override
  String get ucPartner => 'Өнөктөш';

  @override
  String get ucStatusOffered => 'Жообуңуз күтүлүүдө';

  @override
  String get ucStatusAccepted => 'Консультант ырастап жатат';

  @override
  String get ucStatusChangeRequested => 'Өзгөртүү суралды';

  @override
  String get ucStatusPartner => 'Өнөктөш — жооп шарт эмес';

  @override
  String get ucStatusConfirmed => 'Бекитилди';

  @override
  String get ucConfirmedNote => 'Акыркы жолу ырасталды — эми арыз даярдалууда.';

  @override
  String get ucChangeSentNote =>
      'Консультантыңыз жакында башка университет сунуштайт.';

  @override
  String get ucFitOk => 'Баллыңыз ылайык';

  @override
  String get ucFitGap => 'Балл талаптан төмөн';

  @override
  String ucDeadline(String date) {
    return 'Арыз: $date чейин';
  }

  @override
  String ucContract(String amount) {
    return 'Контракт: $amount баштап';
  }

  @override
  String get ucAccept => 'Макулмун';

  @override
  String get ucRequestChange => 'Өзгөртүүнү суранам';

  @override
  String get ucChangeQuestion =>
      'Эмне үчүн бул университет сизге туура келбейт?';

  @override
  String get ucReasonCity => 'Шаар туура келбейт';

  @override
  String get ucReasonPrice => 'Контракт баасы кымбат';

  @override
  String get ucReasonMajor => 'Башка багытты каалайм';

  @override
  String get ucReasonOther => 'Башка себеп';

  @override
  String get ucChangeNote => 'Пикир (милдеттүү эмес)';

  @override
  String get ucChangeSend => 'Консультантка жөнөтүү';

  @override
  String get ucSendError => 'Жөнөтүү мүмкүн болгон жок. Кайра аракет кылыңыз.';

  @override
  String get ucEmpty => 'Консультантыңыз азырынча университет сунуштаган жок.';

  @override
  String ucBannerPending(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count университет жообуңузду күтүп жатат',
      one: '1 университет жообуңузду күтүп жатат',
    );
    return '$_temp0';
  }

  @override
  String get ucResultAccepted => 'Кабыл алындыңыз 🎓';

  @override
  String get ucResultRejected => 'Кабыл алынган жоксуз';

  @override
  String get ucCongratsTitle => 'Куттуктайбыз!';

  @override
  String ucCongratsBody(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Сиз $count университетке кабыл алындыңыз',
      one: 'Сиз 1 университетке кабыл алындыңыз',
    );
    return '$_temp0';
  }

  @override
  String get ucFinalRecommended =>
      'Консультанттын сунушу: акыркы университет ушул';

  @override
  String get ucFinalGo => 'Ушул университетке барам';

  @override
  String get ucFinalChosen => '✓ Сиз ушул университетти тандадыңыз';

  @override
  String get fdNavAssess => 'КАБЫЛ АЛУУ';

  @override
  String get fdNavNeedsClientCode =>
      'Адегенде кардар коду керек — консультант SMS жөнөтөт';

  @override
  String fdListTitle(int count) {
    return '$count match you';
  }

  @override
  String get fdModeAdmission => 'Admission %';

  @override
  String get fdModeVisa => 'Visa %';

  @override
  String get fdModeMap => 'Map';

  @override
  String get fdBoardMatchLabel => 'MATCHING UNIVERSITIES';

  @override
  String fdOfTotalShort(int total) {
    return '/ $total';
  }

  @override
  String get fdBoardVisaTitle => 'ВИЗА D-2';

  @override
  String get fdBoardVisaSub => 'visa chance · ';

  @override
  String get fdBoardVisaAsk => 'tap to assess';

  @override
  String get fdGaugeLow => 'low';

  @override
  String get fdGaugeMid => 'medium';

  @override
  String get fdGaugeHigh => 'high';

  @override
  String get fdBoardStripTitle => 'Matching now';

  @override
  String get fdBoardStripHint => 'tap → details';

  @override
  String get fdBoardStripEmpty => 'None match — loosen the filter';

  @override
  String get fdUniAdmissionLabel => 'ADMISSION';

  @override
  String get fdUniNoteHigh => 'High chance';

  @override
  String get fdUniNoteReal => 'Real, needs work';

  @override
  String get fdUniNoteDream => 'A dream — a gamble';

  @override
  String get fdUniVisaNote => 'depends on you, not on the university';

  @override
  String get fdUniAskAssess => 'Tap to assess →';

  @override
  String get fdUniBoostTitle => 'RAISE THE CHANCE — tap, see the result';

  @override
  String get fdUniBoostStart =>
      'Start the assessment — the chances appear here';

  @override
  String get fdUniBoostApplied => 'Chances updated ↑';

  @override
  String fdUniAddPick(int count) {
    return '♥ Тандоого кошуу · $count/3';
  }

  @override
  String fdUniInPick(int count) {
    return '✓ Тандоодо · $count/3';
  }

  @override
  String fdUniPickAdded(int count) {
    return 'Кошулду · $count/3';
  }

  @override
  String fdPickedHint(int count) {
    return '$count чемпион — эми эң маанилүү суроо.';
  }

  @override
  String get fdPickedVisaTitle => 'ЖАЛПЫ ВИЗА D-2';

  @override
  String fdPickedWithConsultant(int n) {
    return '· консультант менен ~$n%';
  }

  @override
  String get fdPickedCta => 'Кореяга бара аламбы? →';

  @override
  String get fdPickedRemove => 'Алып салуу';

  @override
  String get fdReportEyebrow => 'КОРЕЯГА БАРА АЛАМБЫ?';

  @override
  String get fdReportHeadYes => 'Ооба, мүмкүн.';

  @override
  String get fdReportHeadMaybe => 'Балким.';

  @override
  String get fdReportHeadNotYet => 'Азырынча жок.';

  @override
  String fdReportJobsLeft(int n) {
    return '$n иш калды.';
  }

  @override
  String get fdReportBestAdmission => 'ЭҢ ЖАКШЫ КАБЫЛ АЛУУ';

  @override
  String get fdReportVisaCard => 'ВИЗА D-2';

  @override
  String fdReportWithConsultant(int n) {
    return '→ консультант менен $n%';
  }

  @override
  String fdReportJobsTitle(int n) {
    return '$n ИШ';
  }

  @override
  String get fdReportCta => 'Акысыз чалуу алуу →';

  @override
  String get fdLeadTitle => 'Консультант байланышат';

  @override
  String fdLeadSub(int n) {
    return 'Отчёт жана $n иштен турган план — консультанттан акысыз. 10 мүнөттүн ичинде чалат.';
  }

  @override
  String get fdLeadHintA => 'Жөнөткөндөн кийин SMS менен 8 белгилүү ';

  @override
  String get fdLeadHintB => 'кардар коду';

  @override
  String get fdLeadHintC =>
      ' келет — аны менен арыз жана документтер бөлүмдөрү ачылат.';

  @override
  String get fdCodeTitle => 'Кардар кодум бар';

  @override
  String get fdCodeSub => 'The 8-character code the consultant sent by SMS.';

  @override
  String get fdConsultantWrite => 'Жазуу';

  @override
  String fdDocsReadyChip(int ready, int total) {
    return '$ready / $total даяр';
  }

  @override
  String get fdDocsUploadNext => 'Кийинки документти жүктөө';

  @override
  String get fdPrepareStudyKicker => 'STUDY PLAN';

  @override
  String get fdPrepareInterviewKicker => 'МАЕК МАШЫГУУСУ';

  @override
  String get fdPrepareLocked =>
      'These sections open fully after the client code.';

  @override
  String get fdBoardProfileTitle => 'Your details for the visa';

  @override
  String get fdBoardProfileHint =>
      'The D-2 visa chance above and every percent in the app follow these answers.';

  @override
  String get fdListReportCta => 'Get the visa report →';

  @override
  String ajSummary(int count, int done) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count университет',
      one: '$count университет',
    );
    return '$_temp0 · $done / 8 баскыч';
  }

  @override
  String ajNearestInterview(int days) {
    return 'Эң жакын: маек · $days күн калды';
  }

  @override
  String ajNearestSubmission(int days) {
    return 'Эң жакын: тапшыруу · $days күн калды';
  }

  @override
  String get ajNearestInterviewToday => 'Эң жакын: маек · бүгүн';

  @override
  String get ajNearestSubmissionToday => 'Эң жакын: тапшыруу · бүгүн';

  @override
  String get ajPhaseDocuments => 'Документ';

  @override
  String get ajPhaseSubmission => 'Тапшыруу';

  @override
  String get ajPhaseInterview => 'Маек';

  @override
  String get ajPhaseAdmission => 'Кабыл алуу';

  @override
  String get ajPhaseVisa => 'Виза';

  @override
  String ajChipInterview(String date) {
    return 'Маек $date';
  }

  @override
  String get ajChipActionNeeded => 'Сизден керек';

  @override
  String get ajChipWaiting => 'Күтүлүүдө';

  @override
  String get ajChipAccepted => 'Кабыл алынды';

  @override
  String get ajChipRejected => 'Кире алган жок';

  @override
  String get ajChipDone => 'Аякталды';

  @override
  String get ajStateDocuments => 'Документтер чогултулууда';

  @override
  String get ajStatePreparing => 'Тапшырууга даярдануу';

  @override
  String get ajStateReviewing => 'Документтер текшерилүүдө';

  @override
  String get ajStateInterview => 'Маек баскычы';

  @override
  String get ajStateResult => 'Жыйынтык күтүлүүдө';

  @override
  String get ajStateVisa => 'Виза баскычы';

  @override
  String get ajStateFlight => 'Учууга даярдык';

  @override
  String ajLineInterview(String date, String time) {
    return 'Тапшырылды · маек $date, $time';
  }

  @override
  String ajLineStudyPlan(String date) {
    return 'Study Plan кол тамгаңыз керек · $date чейин';
  }

  @override
  String get ajLineStudyPlanNoDate => 'Study Plan кол тамгаңыз керек';

  @override
  String ajLineReviewing(String date) {
    return 'Университет текшерип жатат · жооп ~$date';
  }

  @override
  String get ajLineReviewingNoDate => 'Университет текшерип жатат';

  @override
  String ajLineSubmitBy(String date) {
    return 'Тапшырууга даярдануу · $date чейин';
  }

  @override
  String get ajLineDocuments => 'Документтериңиз даярдалууда';

  @override
  String get ajLineInterviewDone => 'Маек өттү · жооп күтүлүүдө';

  @override
  String get ajLineAccepted => 'Кабыл алуу каты келди';

  @override
  String get ajLineVisaProcess => 'Виза документтери даярдалууда';

  @override
  String get ajLineVisaWaiting => 'Визанын жыйынтыгы күтүлүүдө';

  @override
  String get ajLineVisaReceived => 'Виза алынды · учууга даярданыңыз';

  @override
  String get ajLineRejected => 'Бул университетке кабыл алынган жоксуз';

  @override
  String get ajSign => 'Кол коюу';

  @override
  String ajDetailKicker(int index, int total) {
    return 'АРЫЗ · $index / $total';
  }

  @override
  String ajTicketIntake(int year, String semester) {
    return 'HANGUK AIR · $year $semester';
  }

  @override
  String get ajSpring => 'ЖАЗ';

  @override
  String get ajAutumn => 'КҮЗ';

  @override
  String ajTicketVisa(String type) {
    return '$type студент';
  }

  @override
  String get ajTashkent => 'Ташкент';

  @override
  String get ajTicketUniversity => 'УНИВЕРСИТЕТ';

  @override
  String get ajTicketStatus => 'АБАЛЫ';

  @override
  String get ajTicketCountdown => 'КОРЕЯГА ЧЕЙИН';

  @override
  String ajDays(int days) {
    return '$days күн';
  }

  @override
  String get ajStatusSignPending => 'Кол тамга күтүлүүдө';

  @override
  String get ajStampsTitle => 'Паспортуңуздагы мөөрлөр';

  @override
  String ajStampsCount(int done) {
    return '$done / 8 басылды';
  }

  @override
  String get ajStampContract => 'Келишим';

  @override
  String get ajStampDocuments => 'Документтерди чогултуу';

  @override
  String get ajStampTranslation => 'Котормо жана апостиль';

  @override
  String get ajStampSubmission => 'Университетке тапшыруу';

  @override
  String get ajStampInterview => 'Маек';

  @override
  String get ajStampAdmission => 'Кабыл алуу каты';

  @override
  String ajStampVisa(String type) {
    return 'Виза $type';
  }

  @override
  String get ajStampFlight => 'Учуу жана турак жай';

  @override
  String ajUntil(String date) {
    return '$date чейин';
  }

  @override
  String get ajActionStudyPlan =>
      'Study Plan кол тамгаңыз керек — андан кийин тапшырабыз';

  @override
  String ajOpenUniversity(String name) {
    return '$name — толук';
  }

  @override
  String get ajBack => 'Артка';

  @override
  String get btField => 'Pick your field';

  @override
  String get btCount => 'Matching universities';

  @override
  String get btVisa => 'Your visa chances';

  @override
  String get btList => 'See the list';

  @override
  String get btStrip => 'Your best matches';

  @override
  String get btCity => 'Which city?';

  @override
  String get btDegree => 'Which degree?';

  @override
  String get btTopik => 'Your Korean level';

  @override
  String get btIelts => 'Your IELTS score';

  @override
  String get btFee => 'Tuition';

  @override
  String get btType => 'State or private';

  @override
  String get btGrant => 'Need a grant?';

  @override
  String get fdSectionIelts => 'My English (IELTS)';

  @override
  String get fdIeltsNoneHint => 'I won\'t study in English';

  @override
  String fdIeltsHint(String score) {
    return 'English programmes up to IELTS $score';
  }

  @override
  String get fdSectionGrant => 'Грант / стипендия';

  @override
  String get fdGrantHint => 'Tuition discount';

  @override
  String get fdGrantNone => 'Not needed';

  @override
  String fdGrantSummary(int pct) {
    return 'Грант $pct%+';
  }

  @override
  String fdTopikHint(String meaning, int level) {
    return '$meaning — TOPIK $level+ opens';
  }

  @override
  String get fdTopikHintNone => 'Pick your level';

  @override
  String get fdTopikLevel1 => 'Greetings';

  @override
  String get fdTopikLevel2 => 'Simple sentences';

  @override
  String get fdTopikLevel3 => 'Everyday talk';

  @override
  String get fdTopikLevel4 => 'Free conversation';

  @override
  String get fdTopikLevel5 => 'Academic texts';

  @override
  String get fdTopikLevel6 => 'Near native';

  @override
  String fdCodeSms(String bold) {
    return 'Консультант SMS менен жөнөткөн $bold код';
  }

  @override
  String get fdCodeEight => '8 белгилүү';

  @override
  String get fdCodeUnlocks => 'The code opens';

  @override
  String get fdCodeChat => 'Consultant chat';

  @override
  String get fdCodeScanShort => 'Scan QR';

  @override
  String get fdCodeNone => 'No code';

  @override
  String get fdCodeFreeConsult => 'Free consultation';

  @override
  String get uaTitle => 'Кирүү ыктымалдыгы';

  @override
  String get uaCity => 'City';

  @override
  String get uaAskTitle =>
      'Бул университетке кирүү ыктымалдыгыңызды билгиңиз келеби?';

  @override
  String get uaAskBody =>
      '12 суроо + Study Plan + тест маеги · болжол менен 3 мүнөт. Пайыз, тактык жана жогорулатуу жолдору аягында чыгат.';

  @override
  String get uaAskStart => 'Баалоону баштоо →';

  @override
  String get uaImpactNone => 'таасири жок';

  @override
  String get uaSecAcademic => 'Академиялык';

  @override
  String get uaSecLanguage => 'Тил';

  @override
  String get uaSecDocuments => 'Документтер топтому';

  @override
  String get uaSecTests => 'Баалоо тесттери';

  @override
  String get uaTestsCount => 'counts toward the %';

  @override
  String get uaTestsBadge => '+ тактык';

  @override
  String get uaTestsHint =>
      'Тесттерди тапшырсаңыз, кирүү ыктымалдыгыңыз тагыраак эсептелет';

  @override
  String get uaNo => 'Жок';

  @override
  String get uaHave => 'Бар';

  @override
  String get uaQDegree => 'Кайсы даражага тапшырасыз';

  @override
  String get uaDegLanguage => 'Тил курсу (D-4)';

  @override
  String get uaDegBachelor => 'Бакалавр';

  @override
  String get uaDegMaster => 'Магистр';

  @override
  String get uaQGpa => 'Аттестат / дипломдун орточо баллы';

  @override
  String get uaQGap => 'Бүтүргөндөн кийин өткөн убакыт';

  @override
  String get uaGap0 => '0 жыл';

  @override
  String get uaGap1 => '1 жыл';

  @override
  String get uaGap2 => '2 жыл';

  @override
  String get uaGap3 => '3+ жыл';

  @override
  String get uaQExperience => 'Тандаган багыт боюнча тажрыйба';

  @override
  String get uaExpCourse => 'Курс / ийрим';

  @override
  String get uaExpProject => 'Долбоор';

  @override
  String get uaExpWork => 'Иш тажрыйбасы';

  @override
  String get uaQOlympiad => 'Олимпиада / сынак жетишкендиктери';

  @override
  String get uaOlSchool => 'Мектеп';

  @override
  String get uaOlNational => 'Республикалык';

  @override
  String get uaOlInternational => 'Эл аралык';

  @override
  String get uaQTopik => 'TOPIK деңгээли';

  @override
  String get uaQTopikCert => 'TOPIK сертификаты';

  @override
  String get uaCertOld => '2 жылдан эски';

  @override
  String get uaCertFresh => 'Жарактуу (2 жылга чейин)';

  @override
  String get uaQIelts => 'Англис тили (IELTS)';

  @override
  String get uaQMotivation => 'Мотивациялык кат';

  @override
  String get uaMotDraft => 'Долбоор';

  @override
  String get uaMotReady => 'Даяр';

  @override
  String get uaQRecommendation => 'Сунуш кат (мугалимден)';

  @override
  String get uaQPortfolio => 'Портфолио (дизайн, искусство, долбоор)';

  @override
  String get uaQActivity => 'Кошумча иш-аракеттер';

  @override
  String get uaActVolunteer => 'Ыктыярчылык';

  @override
  String get uaActSportArt => 'Спорт / искусство';

  @override
  String get uaActLeader => 'Уюмду жетектеген';

  @override
  String get uaTestPlan => 'Study Plan тести';

  @override
  String get uaTestTalk => 'Маек тести';

  @override
  String get uaTestStart => 'Баштоо';

  @override
  String get uaTestTaken => 'Тапшырылды · бир жолу гана тапшырылат';

  @override
  String get uaTestsNeedCode =>
      'The tests open with your client code — your consultant sends it by SMS';

  @override
  String get uaResultTitle => 'Кирүү ыктымалдыгыңыз';

  @override
  String get uaAccuracyLow => 'Тактык: төмөн — тесттер азырынча тапшырыла элек';

  @override
  String get uaAccuracyMid => 'Тактык: орточо — бир тест тапшырылды';

  @override
  String get uaAccuracyHigh => 'Тактык: жогору — эки тест тең тапшырылды';

  @override
  String get uaInterviewFailed =>
      'Маек 60 баллдан төмөн — чыныгы кабыл алууда да бул баскычтан өтүү мүмкүн эмес.';

  @override
  String get uaWays => 'ЖОГОРУЛАТУУ ЖОЛДОРУ';

  @override
  String get uaWayMotivation => 'Мотивациялык катты даярдаңыз';

  @override
  String get uaWayRecommendation => 'Сунуш кат алыңыз';

  @override
  String get sptQ1 => 'Эмне үчүн дал ушул университет жана ушул багыт?';

  @override
  String get sptQ2 => 'Кореяда эмнени жана кантип окуйсуз?';

  @override
  String get sptQ3 => 'Бүтүргөндөн кийин эмне кыласыз?';

  @override
  String get sptHint => 'Корей же англис тилинде жазыңыз';

  @override
  String get sptSubmit => 'Текшерүүгө жөнөтүү';

  @override
  String get sptChecking => 'Жасалма интеллект текшерип жатат…';

  @override
  String get sptError =>
      'Текшерүү мүмкүн болгон жок. Интернетти текшерип, кайра жөнөтүңүз.';

  @override
  String get sptResultTitle => 'STUDY PLAN БАЛЛЫ';

  @override
  String get sptMotivation => 'Мотивация жана багытты билүү';

  @override
  String get sptPlan => 'Окуу планы';

  @override
  String get sptCareer => 'Бүтүргөндөн кийинки план';

  @override
  String get sptLanguage => 'Тил жана жазуу';

  @override
  String get sptStrengths => 'Күчтүү жактары';

  @override
  String get sptImprovements => 'Жакшыртуу керек';

  @override
  String get sptDone => 'Даяр';

  @override
  String uaImpactUp(int n) {
    return 'кабыл алуу +$n%';
  }

  @override
  String uaImpactDown(int n) {
    return 'кабыл алуу −$n%';
  }

  @override
  String uaGpaValue(String value) {
    return '$value / 5';
  }

  @override
  String uaTestMeta(String name, int questions, int minutes) {
    return '$name үчүн · $questions суроо · $minutes мүнөт · 1 аракет';
  }

  @override
  String uaTestScore(int n) {
    return '$n/100';
  }

  @override
  String uaWayTopik(int level) {
    return 'TOPIK $level деңгээлине жетиңиз';
  }

  @override
  String sptIntro(String name, int minutes) {
    return '$name үчүн 3 суроого жооп жазыңыз. Убакыт — $minutes мүнөт, тест бир жолу гана тапшырылат. Убакыт бүтсө, жазылганы жөнөтүлөт.';
  }

  @override
  String get vzTitle => 'Визам';

  @override
  String get vzTitleMark => 'чыгабы?';

  @override
  String get vzYes => 'Ооба';

  @override
  String get vzOne => 'Бир';

  @override
  String get vzTwoPlus => 'Эки жана көп';

  @override
  String get vzSecEducation => 'Билим';

  @override
  String get vzSecMoney => 'Каржы';

  @override
  String get vzSecHistory => 'Тарых';

  @override
  String get vzSecPrep => 'Даярдык';

  @override
  String get vzQEducation => 'Акыркы билимиңиз';

  @override
  String get vzEduSchool => 'Мектеп (11-класс)';

  @override
  String get vzEduCollege => 'Колледж / лицей';

  @override
  String get vzQAge => 'Жаш';

  @override
  String get vzQIncome => 'Ата-энеңиздин жылдык кирешеси';

  @override
  String get vzIncome0 => '< \$5 000';

  @override
  String get vzIncome1 => '\$5–10 миң';

  @override
  String get vzIncome2 => '\$10–20 миң';

  @override
  String get vzIncome3 => '\$20 миң+';

  @override
  String get vzQIncomeDocumented =>
      'Киреше расмий документтештирилген (айлык, салык, бизнес)';

  @override
  String get vzQSponsor => 'Демөөрчү ким';

  @override
  String get vzSponsorSelf => 'Өзүм';

  @override
  String get vzSponsorParents => 'Ата-энем';

  @override
  String get vzSponsorRelative => 'Башка тууган';

  @override
  String get vzQRelationDoc => 'Туугандык документи (апостиль менен)';

  @override
  String get vzQStability => 'Киреше канчадан бери туруктуу';

  @override
  String get vzStable0 => '< 6 ай';

  @override
  String get vzStable1 => '6–12 ай';

  @override
  String get vzStable2 => '1–3 жыл';

  @override
  String get vzStable3 => '3 жыл+';

  @override
  String get vzQProperty =>
      'Ата-энеңиздин атында кыймылсыз мүлк барбы (үй, батир, жер)';

  @override
  String get vzQCar => 'Ата-энеңиздин атында автоунаа барбы';

  @override
  String get vzQBusiness =>
      'Ата-энеңиздин бизнеси / катталган компаниясы барбы';

  @override
  String get vzBusinessIp => 'Жеке ишкер (ЖИ)';

  @override
  String get vzBusinessLlc => 'Компания (ЖЧК)';

  @override
  String get vzQRefused => 'Мурун виза четке кагылганбы';

  @override
  String get vzQKoreaBefore => 'Кореяда мурун болгонсузбу';

  @override
  String get vzKoreaOnTime => 'Ооба, мөөнөтүндө кайтканмын';

  @override
  String get vzKoreaOverstay => 'Мөөнөттөн ашып калгам';

  @override
  String get vzQIllegalRelatives =>
      'Жакын туугандарыңыздан Түштүк Кореяда мыйзамсыз жүргөндөр барбы';

  @override
  String get vzQLegalRelatives =>
      'Кореяда мыйзамдуу жашаган туугандарыңыз барбы';

  @override
  String get vzQStudyPlan => 'Study Plan (окуу планы)';

  @override
  String get vzQInterview => 'Маекке даярдык';

  @override
  String get vzInterviewSelf => 'Өзүм машыктым';

  @override
  String get vzInterviewAi => 'Hanguk AI менен 3+ жолу';

  @override
  String get vzBandHigh => 'Жогорку мүмкүнчүлүк';

  @override
  String get vzBandHighHint => 'документтерди даярдаңыз';

  @override
  String get vzBandMid => 'Орточо мүмкүнчүлүк';

  @override
  String get vzBandMidHint => 'иштөө керек';

  @override
  String get vzBandLow => 'Төмөн мүмкүнчүлүк';

  @override
  String get vzBandLowHint => 'көп иштөө керек';

  @override
  String get vzTourGauge =>
      'Виза ыктымалдыгыңыз — жоопторуңузга жараша өзгөрөт';

  @override
  String get vzTourEducation => 'Билим: даража, балл, жаш';

  @override
  String get vzTourLanguage => 'Тил: TOPIK жана IELTS';

  @override
  String get vzTourMoney => 'Каржы: элчилик эң көп ушуну текшерет';

  @override
  String get vzTourHistory => 'Тарых: мурунку визалар жана туугандар';

  @override
  String get vzTourPrep => 'Даярдык: Study Plan, маек, каттар';

  @override
  String get vzTourReplay => 'Көрсөтмөнү кайра көрүү';

  @override
  String uaVisaUp(int n) {
    return 'виза +$n%';
  }

  @override
  String uaVisaDown(int n) {
    return 'виза −$n%';
  }

  @override
  String vzAgeValue(int n) {
    return '$n жаш';
  }

  @override
  String vzWithConsultant(int n) {
    return 'консультант менен ~$n%';
  }

  @override
  String get tuHero => 'Университет: аталышы, шаары жана баасы';

  @override
  String get tuFacts => 'City, contract, language and document deadline';

  @override
  String get tuAsk => 'Бул жерден кирүү ыктымалдыгыңызды билесиз';

  @override
  String get tuPick => 'Жакса — тандоого кошуңуз, 3кө чейин';

  @override
  String get taAcademic =>
      'Академиялык: ар бир жооп кабыл алууга таасирин көрсөтөт';

  @override
  String get taLanguage => 'Тил: TOPIK жана IELTS';

  @override
  String get taDocuments => 'Документтер: кат, сунуш кат, портфолио';

  @override
  String get taTests => 'Тесттер: Study Plan жана маек — бир жолу';

  @override
  String get taResult => 'Жыйынтык: пайыз жана аны жогорулатуу жолдору';

  @override
  String get fdCodeBannerTitle => 'Бул бөлүм Hanguk\'тун студенттери үчүн';

  @override
  String get fdCodeBannerBody =>
      'Биздин студент болуп, бардык мүмкүнчүлүктөрдү колдонуңуз: Даярдык, Арызым жана Документтер бөлүмдөрү толук ачылат.';

  @override
  String get fdCodeTelegram => 'Telegram\'да админ менен жазышуу';

  @override
  String get fdCodeSmsFrom => 'SMS · Hanguk';

  @override
  String get fdCodeYours => 'Кардар кодуңуз:';

  @override
  String get fdCodePaste => 'коюу →';

  @override
  String get fdPrepareNeedsCode =>
      'Даярдык — Premium жана No-Risk кардарлары үчүн. Кодуңуз болсо жазыңыз';

  @override
  String get fdGrantOrder => 'адегенде балл → андан кийин грант';

  @override
  String get fdGrantStepScores => '1 · БАЛЛДАРЫҢЫЗ';

  @override
  String get fdGrantStepWanted => '2 · КЕРЕКТҮҮ ГРАНТ';

  @override
  String get fdGrantAny => 'Шарт эмес';

  @override
  String get fdSectionCityMap => 'Шаар · картадан тандаңыз';

  @override
  String get fdAllRegions => 'Баары';

  @override
  String get fdRegionGangwonPlus => 'Gangwon+';

  @override
  String fdGrantAtLeast(int n) {
    return 'Кеминде $n%';
  }

  @override
  String get ulTitle => 'Университеттер';

  @override
  String get ulSearchHint => 'Аталышы, багыт, шаар';

  @override
  String get ulPrivate => 'Жеке университет';

  @override
  String get ulState => 'Мамлекеттик университет';

  @override
  String get ulNoRequirement => 'Талап жок';

  @override
  String get fltTitle => 'Чыпка';

  @override
  String get fltAllFields => 'Баары';

  @override
  String get fltFeeSem => 'Контракт / семестр';

  @override
  String ulCount(int n) {
    return '$n';
  }

  @override
  String ulSubtitle(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n университет',
      one: '$n университет',
    );
    return '$_temp0 · карточканы басыңыз';
  }

  @override
  String fltCount(int n) {
    return 'ЫЛАЙЫК УНИВЕРСИТЕТТЕР · $n ИЧИНЕН';
  }

  @override
  String get vzReport => 'Отчётту көрүү →';

  @override
  String get uaTestsUnavailable =>
      'Тест азырынча ачылган жок — интернетти текшерип, кайра аракет кылыңыз';

  @override
  String get tuGrants => 'TOPIK же IELTS жыйынтыгыңызга жараша грант';

  @override
  String get ugTitle => 'Грант';

  @override
  String get ugSubtitle =>
      'Киргенде контракттан арзандатуу — TOPIK / IELTS боюнча';

  @override
  String get ugNoCertificate => 'Сертификатсыз';

  @override
  String ugEither(String topik, String english) {
    return '$topik же $english';
  }

  @override
  String ugBoth(String topik, String english) {
    return '$topik жана $english';
  }

  @override
  String get ugNone =>
      'Бул университеттин көрсөтмөсүндө TOPIK / IELTS гранты жок';

  @override
  String get ugYours => 'СИЗГЕ';

  @override
  String get fltOnePercent => '1% университеттер';

  @override
  String get fltOnePercentOnly => '1% гана';

  @override
  String get deviceCodeTitle => 'Түзмөктүн коду';

  @override
  String get deviceCodeBody =>
      'Кызматкер бул кодду CRM\'де (Ilova analitikasi → Sozlamalar) жазып, телефонду тест түзмөгү деп белгилейт.';

  @override
  String get deviceCodeNone =>
      'Код азырынча даяр эмес: бир аздан кийин кайра аракет кылыңыз.';

  @override
  String deviceCodeVersion(String version) {
    return 'Версия $version';
  }

  @override
  String get leadForWhomQ => 'Ким үчүн?';

  @override
  String get leadForWhomSelf => 'Өзүм үчүн';

  @override
  String get leadForWhomChild => 'Балам үчүн';

  @override
  String get leadForWhomRelative => 'Тууганым үчүн';

  @override
  String get leadHowHeardQ => 'Бизди кайдан таптыңыз?';

  @override
  String contactTelegramMessage(String code) {
    return 'Тиркемеден · $code';
  }

  @override
  String get leadHeardInstagram => 'Instagram';

  @override
  String get leadHeardTelegram => 'Telegram';

  @override
  String get leadHeardFriend => 'Досумдун же тууганымдын сунушу';

  @override
  String get leadHeardKoreaFriend => 'Кореяда окуган тааныш';

  @override
  String get leadHeardLearningCenter => 'Окуу борбору';

  @override
  String get leadHeardEvent => 'Иш-чара';

  @override
  String get leadHeardStore => 'Play Market же App Store';

  @override
  String get leadHeardOther => 'Башка';

  @override
  String get leadConsent =>
      'Консультант сиз тандаган университеттерди жана тесттеги жоопторуңузду көрүп, ошонун негизинде кеңеш берет.';

  @override
  String get guestPushTitle => 'Мөөнөттөрдү өткөрүп жибербеңиз';

  @override
  String get guestPushBody =>
      'Кабыл алуу мөөнөттөрү жана жаңы гранттар тууралуу билдирме жөнөтөлүбү? Телефон номериңиз керек эмес.';

  @override
  String get guestPushYes => 'Ооба, жөнөтүңүз';

  @override
  String get guestPushLater => 'Кийинчерээк';

  @override
  String get guestPushHeartTitle => 'Ушул университеттин мөөнөтүн эскертелиби?';

  @override
  String get guestPushHeartBody =>
      'Сактаган университеттериңизде онлайн арыз берүү мөөнөтү бүтөөрдөн мурун кабарлайбыз. Телефон номериңиз керек эмес.';

  @override
  String get guestRemindersTitle => 'Мөөнөт эскертмелери';

  @override
  String get guestRemindersOn => 'Күйүк';

  @override
  String get guestRemindersOff => 'Өчүк';

  @override
  String get guestRemindersBody =>
      'Сактаган университеттериңизде онлайн арыз берүү мөөнөтү бүтөөрдөн мурун кабарлайбыз. Күнүнө эң көп 1, жумасына 2; 22:00–08:00 аралыгында жөнөтпөйбүз.';

  @override
  String get guestTelegramTitle => 'Билдирмелер өчүк';

  @override
  String get guestTelegramBody =>
      'Мөөнөт эскертмесин Telegram\'да алсаңыз болот. Телефон номериңиз керек эмес — ботто бир жолу «Start» басасыз.';

  @override
  String get guestTelegramButton => 'Telegram\'да алуу';

  @override
  String get guestPathTitle => 'Арыз жолу';

  @override
  String get guestPathBachelor => 'Бакалавр';

  @override
  String get guestPathMaster => 'Магистратура';

  @override
  String get guestPathNoDates =>
      'Бул мезгилдин даталары азырынча жарыялана элек. Университет жарыялаары менен кошобуз.';

  @override
  String get guestPathDays => 'күн';

  @override
  String get guestPathDeadline => 'Мөөнөт';

  @override
  String get guestPathDocuments => 'Документтердин тизмеси';

  @override
  String get guestPathApply => 'Консультант менен тапшыруу';

  @override
  String get guestPathEmpty =>
      'Университетти ♥ менен сактаңыз — баскычтары, даталары жана документтери ушул жерде чыгат.';

  @override
  String get guestPathPick => 'Университет тандоо';

  @override
  String get guestDocsTitle => 'Документтердин тизмеси';

  @override
  String get guestDocsReady => 'даяр · белгилер телефонуңузда гана';

  @override
  String get guestDocsNone =>
      'Бул университеттин көрсөтмөсүндө документтердин тизмеси азырынча жок.';

  @override
  String get guestDocsApostille => 'апостиль';

  @override
  String get guestDocsNote =>
      'Тизме университеттин көрсөтмөсүнөн алынган. Документтерди даярдоого жана которууга консультант жардам берет.';

  @override
  String get continueEyebrow => 'УЛАНТУУ';

  @override
  String get continueTitle => 'Your assessment is saved';

  @override
  String get continueNearest => 'Nearest deadline';

  @override
  String get continuePath => 'Арыз жолун көрүү';

  @override
  String get continueReport => 'Отчётту ачуу';

  @override
  String get prepGuestIntro =>
      'Конок катары да сынап көрсөңүз болот. Чектөөсүз колдонуу — кардар коду менен.';

  @override
  String get prepGuestAi => 'Hanguk AI';

  @override
  String get prepGuestAiLimit => 'Күнүнө 10 суроо';

  @override
  String get prepGuestInterviewLimit => 'Жумасына 1';

  @override
  String get prepGuestStudyLocked => 'Кардар коду менен ачылат';

  @override
  String get prepGuestSignIn => 'Кардар коду менен кирүү';

  @override
  String get nextStepBadge => 'КИЙИНКИ КАДАМ';

  @override
  String get nextStepUploadTitle => 'Documents to upload';

  @override
  String get nextStepUploadBody =>
      'Алар даяр болгондо, консультант онлайн арызды тапшырат.';

  @override
  String get nextStepUploadButton => 'Документтерди жүктөө';

  @override
  String continueTitleCount(String count) {
    return 'Баалооңуз сакталды: $count университет';
  }

  @override
  String continueNearestLine(String university, String date) {
    return 'Эң жакын мөөнөт: $university — онлайн арыз $date чейин';
  }

  @override
  String nextStepUploadCount(String count) {
    return '$count документти жүктөңүз';
  }

  @override
  String nextStepUploadNeeded(String names) {
    return '$names керек.';
  }

  @override
  String get nextStepAnd => 'жана';

  @override
  String get nextStepOrder => 'ТАРТИП';

  @override
  String get nextStepStageContract => 'Келишим';

  @override
  String get nextStepStageDocuments => 'Документтер';

  @override
  String get nextStepStageUniversity => 'Университет тандоо';

  @override
  String get nextStepStageOnline => 'Онлайн арыз';

  @override
  String get nextStepStageResult => 'Жыйынтык жана виза';

  @override
  String prepGuestAiLeft(String limit, String left) {
    return 'Бүгүн $limit суроодон $left калды';
  }

  @override
  String get prepGuestInterviewFree => 'Жумасына 1 · бул жумада бош';

  @override
  String get prepGuestInterviewUsed => 'Жумасына 1 · бул жумада колдонулду';

  @override
  String get continueWelcomeBack => 'Кайра кош келиңиз!';

  @override
  String get nextStepOfferBody =>
      'Консультант сунуштаган университеттерди карап чыгып, жооп бериңиз.';

  @override
  String get nextStepOfferButton => 'Сунуштарды көрүү';

  @override
  String get nextStepSubmissionTitle => 'Онлайн арыз мөөнөтү жакын';

  @override
  String nextStepSubmissionBody(String university) {
    return '$university: онлайн арыз мөөнөтү. Арыз барагында дата менен абалын көрүңүз.';
  }

  @override
  String get nextStepInterviewTitle => 'Маекке даярданыңыз';

  @override
  String nextStepInterviewBody(String university) {
    return '$university: маек. Дата менен убакытты арыз барагында көрүңүз.';
  }

  @override
  String get nextStepOpenButton => 'Арызды ачуу';

  @override
  String get vzAnswersCleared => 'Жооптор тазаланды';

  @override
  String get countryScreenTitle => 'Өлкөнү тандаңыз';

  @override
  String get countryScreenTitleAccent => 'тандаңыз';

  @override
  String get countryScreenSubtitle =>
      'Телефон коду, баалар жана виза эрежелери ушуга жараша көрсөтүлөт';

  @override
  String get countryScreenGuessHint =>
      'Телефондун жөндөөсүнө жараша белгиленди';

  @override
  String get countryUzbekistan => 'Өзбекстан';

  @override
  String get countryKyrgyzstan => 'Кыргызстан';

  @override
  String get countryUzCaption => '+998 · сум';

  @override
  String get countryKgCaption => '+996 · сом';

  @override
  String get countryLabel => 'Өлкө';

  @override
  String get countrySheetTitle => 'Өлкөнү тандаңыз';

  @override
  String get ajBishkek => 'Бишкек';

  @override
  String get leadKgConsent =>
      'Жеке маалыматтарымдын (аты-жөнү, телефон, жооптор) кеңеш үчүн Hanguk Consulting\'ке жөнөтүлүшүнө жана Корея Республикасындагы серверде сакталышына макулмун.';
}
