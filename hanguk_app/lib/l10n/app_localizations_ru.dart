// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get trainingTabTitle => 'Training Center';

  @override
  String get trainingTabSubtitle =>
      'Prepare for your university applications with AI-guided training modules.';

  @override
  String get studyPlanCardTitle => 'Study Plan Builder';

  @override
  String get studyPlanCardDesc =>
      'Craft a compelling roadmap for your academic journey.';

  @override
  String get personalStatementCardTitle => 'Personal Statement';

  @override
  String get personalStatementCardDesc =>
      'Write effective and engaging personal essays.';

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
  String get cancel => 'Cancel';

  @override
  String get endInterview => 'End Interview';

  @override
  String get endSession => 'End Session';

  @override
  String get practiceAgain => 'Practice Again';

  @override
  String get connecting => 'Connecting...';

  @override
  String get greetWait =>
      'Connecting — your interviewer will greet you shortly...';

  @override
  String get yourTurn => 'Your turn to speak';

  @override
  String get aiSpeaking => 'Interviewer is speaking...';

  @override
  String get wrappingUp => 'Wrapping up the interview...';

  @override
  String get micRequired => 'Microphone access is required for the interview.';

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
  String get visitUniversityWebsite => 'Перейти на сайт университета';

  @override
  String universityTier(int tier) {
    return 'Уровень $tier';
  }

  @override
  String get universityVerified => 'Проверено';

  @override
  String get universityNextEvent => 'Ближайшее событие';

  @override
  String get navApplications => 'Заявки';

  @override
  String get navMap => 'Карта';

  @override
  String get navDocs => 'Документы';

  @override
  String get navTraining => 'Подготовка';

  @override
  String get applicationsTabTitle => 'Мои заявки';

  @override
  String get mapTabTitle => 'Университеты';

  @override
  String get documentsTabTitle => 'Мои документы';

  @override
  String get documentUploadInfo =>
      'Загрузите корректные PDF или JPEG сканы оригиналов документов. Максимум 10 МБ на файл.';

  @override
  String get documentsRequiredHeading => 'Необходимые документы';

  @override
  String get documentUploadFailed =>
      'Не удалось загрузить документ. Пожалуйста, попробуйте ещё раз.';

  @override
  String get documentPreviewFailed =>
      'Не удалось открыть документ. Пожалуйста, попробуйте ещё раз.';

  @override
  String get documentLoadError => 'Не удалось загрузить ваши документы.';

  @override
  String get commonRetry => 'Повторить';

  @override
  String get onboardingSkip => 'Пропустить';

  @override
  String get onboardingNext => 'Далее';

  @override
  String get onboardingStart => 'Начать';

  @override
  String get onboardingStep1Title => 'Отслеживайте заявки';

  @override
  String get onboardingStep1Body =>
      'Следите за каждой заявкой в университет — от документов до решения — в одном месте.';

  @override
  String get onboardingStep2Title => 'Изучайте вузы и загружайте документы';

  @override
  String get onboardingStep2Body =>
      'Находите университеты на карте и безопасно загружайте нужные документы.';

  @override
  String get onboardingStep3Title => 'Тренируйте интервью с ИИ';

  @override
  String get onboardingStep3Body =>
      'Репетируйте вступительные интервью с ИИ-коучем и получайте мгновенную обратную связь.';

  @override
  String get appsEmptyTitle => 'Заявок пока нет';

  @override
  String get appsEmptyBody =>
      'Ваши заявки появятся здесь после подачи в университет.';

  @override
  String get appsLoadError => 'Не удалось загрузить ваши заявки.';

  @override
  String get appsPendingHeading => 'Ожидающие заявки';

  @override
  String get appsActiveHeading => 'Активные заявки';

  @override
  String get searchHint => 'Поиск...';

  @override
  String get clearSearch => 'Очистить поиск';

  @override
  String get filterAll => 'Все';

  @override
  String get filterPartner => 'Партнёр';

  @override
  String get filterTop => 'Топ';

  @override
  String get noUniversitiesMatch => 'Нет вузов по этому фильтру';

  @override
  String get clearFilters => 'Сбросить фильтры';

  @override
  String get universitiesLoadError => 'Не удалось загрузить университеты';

  @override
  String get checkConnectionRetry => 'Проверьте подключение и попробуйте снова';

  @override
  String get switchToListView => 'Переключить на список';

  @override
  String get switchToMapView => 'Переключить на карту';

  @override
  String get chatInputHint => 'Спросите что угодно о Южной Корее...';

  @override
  String get accountTooltip => 'Аккаунт';

  @override
  String get ok => 'OK';

  @override
  String get loadingLabel => 'Loading...';

  @override
  String get accountBackTooltip => 'Back';

  @override
  String get accountTitle => 'Account';

  @override
  String get accountSignedInAs => 'Signed in as';

  @override
  String get accountUnknownAccount => '(unknown account)';

  @override
  String get accountSessionLabel => 'Session';

  @override
  String get accountSigningOut => 'Signing out…';

  @override
  String get accountSignOut => 'Sign out';

  @override
  String get accountYourDataLabel => 'Your data';

  @override
  String get accountYourDataBody =>
      'Download a JSON copy of everything Hanguk holds about your account — profile, applications, study plans, drafts, interview sessions and feedback.';

  @override
  String get accountPreparingExport => 'Preparing export…';

  @override
  String get accountDownloadMyData => 'Download my data';

  @override
  String get accountDangerZoneLabel => 'Danger zone';

  @override
  String get accountDangerZoneBody =>
      'Deleting your account is permanent. We will erase your profile, applications, study plans, personal-statement drafts, interview sessions, and transcripts. Documents in storage are removed within 30 days; backups age out within 90 days.';

  @override
  String get accountDeleteAccount => 'Delete account';

  @override
  String get accountPrivacyPolicy => 'Privacy Policy';

  @override
  String get accountTermsOfService => 'Terms of Service';

  @override
  String get accountDeleteErrorTitle => 'Could not delete account';

  @override
  String accountDeleteErrorBody(Object error) {
    return 'We hit an error while deleting your data:\n\n$error\n\nPlease email privacy@hanguk.uz so we can finish the deletion for you.';
  }

  @override
  String accountExportFailed(Object error) {
    return 'Export failed: $error';
  }

  @override
  String get accountDeleteDialogTitle => 'Delete your account?';

  @override
  String get accountDeleteDialogBody =>
      'This will permanently delete your account, applications, study plans, personal-statement drafts, interview sessions, and transcripts.\n\nType DELETE to confirm.';

  @override
  String get accountDeleteDialogConfirm => 'Delete forever';

  @override
  String get accountDeleteProgress => 'Deleting your account…';

  @override
  String get loginStudentPortal => 'Student Portal';

  @override
  String get loginAccessCodeHelp =>
      'Enter the 8-character access code (letters and numbers) provided by your consultant or university representative.';

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
      'Invalid phone number or password.';

  @override
  String get loginErrorInvalidAccessCode =>
      'Please enter a valid access code (min 6 characters).';

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
  String get notifSettingsTitle => 'Notification settings';

  @override
  String get notifSettingsEmptyTitle => 'No tracked universities yet';

  @override
  String get notifSettingsEmptyBody =>
      'Tap \"Track this institution\" on a university page to follow it. Notification preferences appear here once you have at least one tracked institution.';

  @override
  String get notifSettingsCalendar => 'Calendar changes';

  @override
  String get notifSettingsCalendarDesc => 'Deadline dates move';

  @override
  String get notifSettingsCorrection => 'Correction notices';

  @override
  String get notifSettingsCorrectionDesc => '정정공고 published — highest priority';

  @override
  String get notifSettingsRequirement => 'Requirement changes';

  @override
  String get notifSettingsRequirementDesc =>
      'TOPIK / GPA / language test rules change';

  @override
  String get notifSettingsScholarship => 'Scholarship updates';

  @override
  String get notifSettingsScholarshipDesc => 'Off by default — high volume';

  @override
  String notifSettingsLoadError(Object error) {
    return 'Error: $error';
  }

  @override
  String notifSettingsPushLanguage(String lang) {
    return 'Push payload language: $lang';
  }

  @override
  String notifSettingsUpdateError(Object error) {
    return 'Could not update preference: $error';
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
  String get trackKorean => 'Korean';

  @override
  String get trackEnglish => 'English';

  @override
  String get personaFriendly => 'Friendly admissions officer';

  @override
  String get personaStrict => 'Strict professor';

  @override
  String get personaImpatient => 'Impatient visa officer';

  @override
  String get personaFriendlyCaps => 'Friendly Admissions Officer';

  @override
  String get personaStrictCaps => 'Strict Professor';

  @override
  String get personaImpatientCaps => 'Impatient Visa Officer';

  @override
  String get micBlockedInSettings =>
      'Microphone is blocked in system settings.';

  @override
  String get openSettings => 'Open settings';

  @override
  String genericError(Object error) {
    return 'Error: $error';
  }

  @override
  String errorLoadingApplications(Object error) {
    return 'Error loading applications: $error';
  }

  @override
  String get noAppsInlineHint =>
      'No applications yet — go to the Applications tab to add one.';

  @override
  String get aiStatusWaiting => 'Waiting for input...';

  @override
  String get aiStatusCoolingDown => 'AI cooling down…';

  @override
  String get aiStatusAnalyzing => 'AI analyzing...';

  @override
  String get aiStatusReady => 'Ready';

  @override
  String get aiStatusPredicting => 'AI Predicting...';

  @override
  String get aiStatusSupervisionActive => 'AI Supervision Active';

  @override
  String get aiStatusSpellCheckUnavailable => 'Словарь устройства недоступен';

  @override
  String get workspaceTitle => 'Workspace';

  @override
  String get workspaceAnalyzeButton => 'Analyze';

  @override
  String get aiSupervisionWarningsTitle => 'AI Supervision Warnings:';

  @override
  String grammarReplaceWith(String original, String suggestion) {
    return 'Replace \"$original\" with \"$suggestion\"';
  }

  @override
  String draftingHint(String documentTitle) {
    return 'Type your $documentTitle here...';
  }

  @override
  String get ghostSuggestionSemantics => 'AI suggestion — tap to insert';

  @override
  String get ghostAccept => 'Accept';

  @override
  String get ghostDismiss => 'Dismiss suggestion';

  @override
  String get pastDraftsTooltip => 'Past drafts';

  @override
  String get sessionSettingsTooltip => 'Session settings';

  @override
  String get switchTrackEnglish => 'Switch track → English';

  @override
  String get switchTrackKorean => 'Switch track → Korean';

  @override
  String get createNewSession => 'Create New Session';

  @override
  String get yourSavedDrafts => 'Your Saved Drafts';

  @override
  String get noPreviousDrafts => 'No previous drafts found.';

  @override
  String get generalDraftLabel => 'General';

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
    return 'Status: $status';
  }

  @override
  String get deleteSessionTitle => 'Delete Session';

  @override
  String get deleteSessionBody =>
      'Are you sure you want to delete this session? This action cannot be undone.';

  @override
  String get deleteLabel => 'Delete';

  @override
  String get stepperLabelGuide => 'Guide';

  @override
  String get stepperLabelExample => 'Example';

  @override
  String get stepperLabelDraft => 'Draft';

  @override
  String get stepperLabelFeedback => 'Feedback';

  @override
  String get readExamplesButton => 'Read Examples';

  @override
  String get targetUniversityLabel => 'Target University';

  @override
  String get startDraftingButton => 'Start Drafting';

  @override
  String get newStudyPlanDialogTitle => 'Start New Study Plan';

  @override
  String get newPersonalStatementDialogTitle => 'Start New Personal Statement';

  @override
  String get selectTargetUniversityStep => '1. Select Target University';

  @override
  String get selectLanguageTrackStep => '2. Select Language Track';

  @override
  String get createSession => 'Create Session';

  @override
  String get aiExampleEmbassyTitle => 'Embassy Example';

  @override
  String aiExampleUniversityTitle(String universityName) {
    return 'Example for $universityName';
  }

  @override
  String get aiExampleEmbassyLabel => 'Embassy of the Republic of Korea (Visa)';

  @override
  String get aiExampleWritingPlaceholder => 'AI is writing an example...';

  @override
  String get copyButton => 'Copy';

  @override
  String get copiedSnackbar => 'Text copied!';

  @override
  String get analysisFeedbackTitle => 'Analysis & Feedback';

  @override
  String get noAnalysisYet => 'No analysis generated yet.';

  @override
  String get analysisErrorPlanRequired =>
      'Анализ входит в тарифы Premium и No Risk. В вашем текущем тарифе его нет.';

  @override
  String get analysisErrorRateLimited =>
      'Слишком много запросов на анализ. Подождите минуту и попробуйте снова.';

  @override
  String get analysisErrorServiceDown =>
      'Сервис анализа временно недоступен. Черновик сохранён — попробуйте позже.';

  @override
  String get analysisErrorFailed =>
      'Не удалось выполнить анализ. Черновик сохранён — проверьте соединение и попробуйте снова.';

  @override
  String get analysisRetryButton => 'Повторить';

  @override
  String get aiReviewedDraft => 'AI successfully reviewed your draft.';

  @override
  String get returnToDrafting => 'Return to Drafting';

  @override
  String get studyPlanHistoryTitle => 'Study Plan history';

  @override
  String get personalStatementHistoryTitle => 'Personal Statement history';

  @override
  String get draftingHistoryTitle => 'Drafting history';

  @override
  String get noPastDraftsYet => 'No past drafts yet';

  @override
  String get noPastDraftsBody =>
      'Start a new session and your drafts will appear here, ordered by most recently edited.';

  @override
  String get noTargetUniversity => 'No target university';

  @override
  String sessionStepLabel(int step) {
    return 'Этап $step';
  }

  @override
  String get metricWords => 'Words';

  @override
  String get metricCharacters => 'Characters';

  @override
  String get saveStatusUnsaved => 'Unsaved';

  @override
  String get saveStatusSaving => 'Saving...';

  @override
  String get saveStatusSaved => 'Saved';

  @override
  String get saveStatusError => 'Save failed';

  @override
  String get interviewPracticeTitle => 'Interview Practice';

  @override
  String get interviewSettingUp => 'Setting up your interview...';

  @override
  String get interviewSetupTitle => 'AI Interview Setup';

  @override
  String get interviewSetupSubtitle =>
      'Configure your AI interviewer settings before starting.';

  @override
  String get interviewTypeLabel => 'Interview Type';

  @override
  String get interviewTypeGeneral => 'General Introduction';

  @override
  String get interviewTypeUniversitySpecific => 'University Specific';

  @override
  String get interviewTypeVisa => 'Visa / Embassy Check';

  @override
  String get targetUniversityFieldLabel => 'Target university';

  @override
  String get languageLabel => 'Language';

  @override
  String get interviewerPersonaLabel => 'Interviewer Persona';

  @override
  String get focusTopicLabel => 'Focus Topic (Optional)';

  @override
  String get focusTopicHint => 'e.g. Discussing my computer science major...';

  @override
  String get timedModeTitle => 'Timed Mode';

  @override
  String get timedModeSubtitle => '5 minute strict limit';

  @override
  String get startPracticeButton => 'Start Practice';

  @override
  String get pickUniversityFirstHint =>
      'Pick a target university above to enable.';

  @override
  String get coachingFiller => 'Avoid using filler words!';

  @override
  String get lifelineHintsTitle => '💡 Lifeline Hints:';

  @override
  String get speakerAi => 'AI';

  @override
  String get speakerYou => 'You';

  @override
  String connectionInterrupted(String detail) {
    return 'Connection interrupted: $detail';
  }

  @override
  String get interviewAnalyticsTitle => 'Interview Analytics';

  @override
  String get analyzingTranscript => 'Analyzing transcript with AI...';

  @override
  String get noFeedbackAvailable => 'No feedback available.';

  @override
  String get overallScoreLabel => 'Overall Score';

  @override
  String get metricCommunication => 'Communication';

  @override
  String get metricConfidence => 'Confidence';

  @override
  String get metricContent => 'Content';

  @override
  String get metricLanguage => 'Language';

  @override
  String get detailedFeedbackTitle => 'Detailed Feedback';

  @override
  String get detailedFeedbackFallback => 'Great job.';

  @override
  String get strengthsLabel => 'Strengths';

  @override
  String get areasToImproveLabel => 'Areas to Improve';

  @override
  String get startAnotherInterview => 'Start another interview';

  @override
  String get sessionRecording => 'Session Recording';

  @override
  String get audioRecordingNotFound => 'Audio recording not found.';

  @override
  String get interviewHistoryTitle => 'Interview History';

  @override
  String get noPastInterviews => 'No past interviews found.';

  @override
  String get unknownTarget => 'Unknown Target';

  @override
  String get unknownUniversity => 'Unknown University';

  @override
  String get abandonedSessionNote =>
      'This session ended without feedback — no replay available.';

  @override
  String get activeSessionNote =>
      'This session is still active. Finish it to see feedback.';

  @override
  String get deleteSessionTooltip => 'Delete session';

  @override
  String get deleteInterviewDialogTitle => 'Delete this session?';

  @override
  String get deleteInterviewDialogBody =>
      'The feedback and recording link will be permanently removed.';

  @override
  String deleteFailed(Object error) {
    return 'Delete failed: $error';
  }

  @override
  String get a11yTooltipAskAi => 'Ask Hanguk AI';

  @override
  String get a11yTooltipClearChat => 'Clear chat history';

  @override
  String get a11yTooltipSendMessage => 'Send message';

  @override
  String get a11yTooltipClose => 'Close';

  @override
  String get a11yTooltipPreviewDocument => 'Preview document';

  @override
  String get a11yTooltipDeleteDocument => 'Delete document';

  @override
  String get a11yTooltipInterviewHistory => 'Interview history';

  @override
  String get a11yTooltipCloseSession => 'Close session';

  @override
  String get a11yTooltipDeleteSession => 'Delete session';

  @override
  String get a11yTooltipBack => 'Back';

  @override
  String get a11yTooltipPlayRecording => 'Play recording';

  @override
  String get a11yTooltipPauseRecording => 'Pause recording';

  @override
  String get trackMismatchWarning =>
      'Язык вашего черновика не совпадает с выбранным направлением. Пожалуйста, перепишите его на выбранном языке.';

  @override
  String get interviewStartError =>
      'Не удалось начать собеседование. Проверьте подключение и попробуйте снова.';

  @override
  String get perAnswerReviewTitle => 'Разбор каждого ответа';

  @override
  String get betterAnswerLabel => 'БОЛЕЕ СИЛЬНЫЙ ОТВЕТ';

  @override
  String get navHome => 'Главная';

  @override
  String get navMenu => 'Меню';

  @override
  String get greetingMorning => 'Доброе утро';

  @override
  String get greetingAfternoon => 'Добрый день';

  @override
  String get greetingEvening => 'Добрый вечер';

  @override
  String get welcomeHeadline => 'Добро пожаловать в ваш путь';

  @override
  String get welcomeSubtitle =>
      'Ваш путь в университет Южной Кореи начинается здесь.';

  @override
  String get welcomeMagicCodeCta => 'У меня есть магический код';

  @override
  String get welcomeExploreCta => 'Смотреть университеты';

  @override
  String get magicCodeTitle => 'Магический код';

  @override
  String get homeJourneyEyebrow => 'Ваш путь';

  @override
  String get homeContinueJourney => 'Продолжить путь';

  @override
  String get homeViewAll => 'Показать все';

  @override
  String documentsCollected(int collected, int total) {
    return 'Собрано $collected из $total';
  }

  @override
  String get documentActionUpload => 'Загрузить';

  @override
  String get documentStatusApproved => 'Одобрено';

  @override
  String get documentStatusPendingReview => 'На проверке';

  @override
  String get statusDocs => 'Документы';

  @override
  String get statusSubmitted => 'Подано';

  @override
  String get statusInReview => 'На рассмотрении';

  @override
  String get statusWaiting => 'Ожидание';

  @override
  String get statusRejected => 'Отказано';

  @override
  String get journeyStageDocumentPrep => 'Подготовка документов';

  @override
  String get journeyStageOnlineApplication => 'Онлайн-заявка';

  @override
  String get journeyStageOfflineApplication => 'Офлайн-заявка';

  @override
  String get journeyStageInterview => 'Собеседование';

  @override
  String get journeyStageWaitingInvoice => 'Ожидание счёта';

  @override
  String get journeyStageTuitionPayment => 'Оплата обучения';

  @override
  String get journeyStageWaitingAdmission => 'Ожидание письма о зачислении';

  @override
  String get journeyStageVisaPreparation => 'Подготовка к визе';

  @override
  String get journeyStageWaitingVisa => 'Ожидание выдачи визы';

  @override
  String mapUniversitiesMapped(int count) {
    return 'На карте: $count';
  }

  @override
  String get updateAvailableTitle => 'Доступно обновление';

  @override
  String updateVersionReady(String version) {
    return 'Версия $version готова к установке.';
  }

  @override
  String updateSizeMb(String size) {
    return 'Размер: $size МБ';
  }

  @override
  String get updateSigningKeyWarning =>
      'Это обновление меняет ключ подписи приложения. После установки вам нужно будет снова войти с помощью магического кода.';

  @override
  String get updateNow => 'Обновить сейчас';

  @override
  String get updateLater => 'Позже';

  @override
  String get updateDownloadingTitle => 'Загрузка обновления';

  @override
  String updateDownloadProgress(String downloaded, String total) {
    return '$downloaded МБ / $total МБ';
  }

  @override
  String get updateInstallingLabel => 'Проверка и установка…';

  @override
  String get updateFailedTitle => 'Не удалось обновить';

  @override
  String get updateErrorNetwork =>
      'Не удалось загрузить обновление. Проверьте подключение к интернету и попробуйте снова.';

  @override
  String get updateErrorHashMismatch =>
      'Загруженный файл не прошёл проверку целостности. Попробуйте снова — если проблема повторяется, обратитесь к своему консультанту.';

  @override
  String get updateErrorInstallDenied =>
      'Установка заблокирована вашим устройством. Разрешите «Установку неизвестных приложений» для Hanguk в настройках телефона и попробуйте снова.';

  @override
  String get updateErrorStorage =>
      'Недостаточно памяти для загрузки обновления. Освободите место и попробуйте снова.';

  @override
  String get updateErrorUnsupportedPlatform =>
      'Обновления пока недоступны на этой платформе.';

  @override
  String get updateErrorUnknown =>
      'Не удалось выполнить обновление. Попробуйте снова или обратитесь к своему консультанту.';

  @override
  String get guestModeEyebrow => 'Гостевой режим';

  @override
  String get guestJoinCta => 'Вступить в Hanguk';

  @override
  String get guestExploreTitle => 'Найдите свой университет';

  @override
  String guestUniversitiesCount(int count) {
    return '$count университетов';
  }

  @override
  String get guestNavExplore => 'Обзор';

  @override
  String get guestNavCompare => 'Сравнить';

  @override
  String guestCompareCount(int count) {
    return 'Сравнить $count/2';
  }

  @override
  String get guestCompareEmptySlot => 'Добавьте из обзора';

  @override
  String get guestCompareApplyCta => 'Подать через Hanguk';

  @override
  String get guestCompareReassurance =>
      'Получите магический код — наша команда проведёт вас от документов до визы.';

  @override
  String get guestRowCity => 'Город';

  @override
  String get guestRowTier => 'Уровень';

  @override
  String get guestRowIeqas => 'Статус IEQAS';

  @override
  String get guestRowPartner => 'Партнёр Hanguk';

  @override
  String get guestRowNextEvent => 'Ближайшая дата';

  @override
  String get guestRowWebsite => 'Сайт';

  @override
  String get guestValueYes => 'Да';

  @override
  String get guestValueNo => 'Нет';

  @override
  String get roomTabStatus => 'Статус';

  @override
  String get roomTabDiscussion => 'Обсуждение';

  @override
  String get roomTabNews => 'Новости';

  @override
  String get roomTabCalendar => 'Календарь';

  @override
  String get roomApplicationProgress => 'Ход заявки';

  @override
  String get roomChatEmpty => 'Пока нет сообщений. Начните обсуждение!';

  @override
  String get roomChatHint => 'Сообщение в комнату...';

  @override
  String get roomChatSenderFallback => 'Пользователь';

  @override
  String get roomNewsEmpty => 'Нет актуальных объявлений.';

  @override
  String get roomEventsEmpty => 'На эту дату событий нет.';

  @override
  String get uniDbPhaseBadge => 'База университетов · Этап 0 подготовлен';

  @override
  String get uniDbRecentChangesTitle =>
      'Обновления отслеживаемых университетов';

  @override
  String get timeJustNow => 'только что';

  @override
  String timeMinutesAgo(int minutes) {
    return '$minutes мин назад';
  }

  @override
  String timeHoursAgo(int hours) {
    return '$hours ч назад';
  }

  @override
  String timeDaysAgo(int days) {
    return '$days дн назад';
  }

  @override
  String get uniDbVerifiedDeadlinesTitle => 'Проверенные ближайшие дедлайны';

  @override
  String get deadlineClosed => 'Закрыто';

  @override
  String deadlineInDays(int days) {
    return 'через $days дн';
  }

  @override
  String deadlineInHours(int hours) {
    return 'через $hours ч';
  }

  @override
  String deadlineInMinutes(int minutes) {
    return 'через $minutes мин';
  }

  @override
  String get eventApplyOpen => 'Открытие приёма заявок';

  @override
  String get eventApplyClose => 'Закрытие приёма заявок';

  @override
  String get eventDocumentsDue => 'Срок подачи документов';

  @override
  String get eventFirstStageResults => 'Результаты 1-го этапа';

  @override
  String get eventInterviewLabel => 'Собеседование';

  @override
  String get eventPracticalExam => 'Практический экзамен';

  @override
  String get eventFinalResults => 'Итоговые результаты';

  @override
  String get eventAdditionalAdmit => 'Дополнительный набор';

  @override
  String get eventRegistrationOpen => 'Начало регистрации';

  @override
  String get eventRegistrationClose => 'Окончание регистрации';

  @override
  String get cycleForeign => 'Трек для иностранцев';

  @override
  String get cycleOverseasKoreanFull => 'Зарубежные корейцы (полный)';

  @override
  String get cycleOverseasKoreanPartial => 'Зарубежные корейцы (частичный)';

  @override
  String get cycleSusi => 'Суси (susi)';

  @override
  String get cycleJeongsi => 'Чонси (jeongsi)';

  @override
  String get cycleTransfer => 'Перевод';

  @override
  String get cycleGradGeneral => 'Магистратура';

  @override
  String get cycleGradForeign => 'Магистратура (иностранцы)';

  @override
  String get uniSpecificHeader => 'Интервью под конкретный университет';

  @override
  String get uniSpecificPickPrompt =>
      'Выберите университет выше, чтобы интервьюер учитывал его направление набора, требования и ключевые даты.';

  @override
  String uniSpecificLoadError(Object error) {
    return 'Не удалось загрузить данные о наборе: $error\nВы всё равно можете пройти общее интервью.';
  }

  @override
  String get uniSpecificNoData =>
      'Для этого университета пока нет проверенных данных о наборе. Пока мы не загрузим его 모집요강, интервью будет состоять из общих вопросов.';

  @override
  String get uniSpecificFallbackButton => 'Пройти общее интервью';

  @override
  String uniSpecificTrackLabel(String category) {
    return 'Трек: $category';
  }

  @override
  String get uniSpecificSeedNote =>
      'Интервьюер будет опираться на эти данные о наборе при постановке вопросов.';

  @override
  String get uniSpecificRecruitmentUnitFallback => 'Направление набора';

  @override
  String get uniDbInstitutionTitle => 'Университет';

  @override
  String get uniDbNotFoundTitle => 'Университет не найден';

  @override
  String get uniDbNotFoundBody =>
      'Этого университета пока нет в каталоге. Загляните позже.';

  @override
  String get uniDbUpcomingDeadlines => 'Ближайшие дедлайны';

  @override
  String get uniDbNoDeadlines => 'Дедлайны пока не объявлены.';

  @override
  String get uniDbTuitionHeading => 'Стоимость обучения';

  @override
  String get uniDbTuitionEmpty => 'Данных о стоимости обучения пока нет.';

  @override
  String get uniDbRequirementsHeading => 'Требования';

  @override
  String get uniDbRequirementsEmpty =>
      'Требования к поступлению пока недоступны.';

  @override
  String get uniDbScholarshipsHeading => 'Стипендии';

  @override
  String get uniDbScholarshipsEmpty =>
      'Стипендии для этого университета пока не указаны.';

  @override
  String get uniDbDocumentChecklistHeading => 'Список документов';

  @override
  String get uniDbDocumentsEmpty => 'Список документов пока недоступен.';

  @override
  String get uniDbTrackTitle => 'Отслеживать этот университет';

  @override
  String get uniDbTrackOnDesc =>
      'Дедлайны появятся на главном экране, а об изменениях придут push-уведомления.';

  @override
  String get uniDbTrackOffDesc =>
      'Включите, чтобы следить за дедлайнами, поправками и изменениями требований.';

  @override
  String uniDbTrackError(Object error) {
    return 'Не удалось обновить отслеживание: $error';
  }

  @override
  String get uniDbOpenGuidePdf => 'Открыть PDF-руководство по приёму';

  @override
  String get uniDbNoGuidePdf => 'PDF-руководство по приёму пока недоступно.';

  @override
  String get uniDbPdfNoApp =>
      'Не удалось открыть PDF — нет подходящего приложения.';

  @override
  String uniDbPdfError(Object error) {
    return 'Не удалось открыть PDF: $error';
  }

  @override
  String uniDbAcademicYear(int year) {
    return '$year учебный год';
  }

  @override
  String uniDbSemesterLabel(int number) {
    return 'Семестр $number';
  }

  @override
  String get uniDbFirstSemester => 'первый семестр';

  @override
  String uniDbAdmissionFee(String amount) {
    return '+ $amount вступительный взнос';
  }

  @override
  String uniDbGpaChip(String pct) {
    return 'GPA ≥ $pct%';
  }

  @override
  String get uniDbTopikTierTable => 'Таблица уровней TOPIK';

  @override
  String uniDbDocumentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count документа',
      many: '$count документов',
      few: '$count документа',
      one: '$count документ',
    );
    return '$_temp0';
  }

  @override
  String get uniDbApostilleRequired => 'Требуется апостиль';

  @override
  String uniDbLastVerified(String date) {
    return 'Последняя проверка: $date';
  }

  @override
  String get eventOrientation => 'Ориентация для студентов';

  @override
  String get eventSemesterStart => 'Начало семестра';

  @override
  String get facultyHumanities => 'Гуманитарные науки';

  @override
  String get facultySocialScience => 'Социальные науки';

  @override
  String get facultyNaturalScience => 'Естественные науки';

  @override
  String get facultyEngineering => 'Инженерия';

  @override
  String get facultyMedical => 'Медицина / Фармация';

  @override
  String get facultyArts => 'Искусство';

  @override
  String get facultyPhysicalEducation => 'Физическая культура';

  @override
  String get uniDbCompareTitle => 'Сравнение';

  @override
  String get uniDbCompareEmptyTitle => 'Сравнить университеты';

  @override
  String get uniDbCompareEmptyBody =>
      'Добавьте в отслеживание минимум два университета и вернитесь сюда для сравнения.';

  @override
  String get uniDbCompareNeedSecond =>
      'Для сравнения нужен второй университет.';

  @override
  String uniDbCompareSelected(String name) {
    return 'Сейчас выбран: $name';
  }

  @override
  String get uniDbColEnglishName => 'Название на английском';

  @override
  String get uniDbColUzbekName => 'Название на узбекском';

  @override
  String get uniDbColLastVerified => 'Последняя проверка';

  @override
  String get uniDbColTuition => 'Стоимость / семестр';

  @override
  String get uniDbColKorean => 'Уровень корейского';

  @override
  String get uniDbColNextDeadline => 'Ближайший срок';

  @override
  String get uniDbColInterview => 'Собеседование';

  @override
  String get uniDbColDocuments => 'Документы';

  @override
  String get uniDbNotPublishedYet => 'Пока не опубликовано';

  @override
  String get uniDbTopikNoMinimum => 'Минимум не указан';

  @override
  String get uniDbTopikDeferred => 'Можно подать позже';

  @override
  String get uniDbLowest => 'Минимум';

  @override
  String get uniDbTentative => 'Дата не подтверждена';

  @override
  String uniDbScholarshipsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count стипендии',
      many: '$count стипендий',
      few: '$count стипендии',
      one: '1 стипендия',
    );
    return '$_temp0';
  }

  @override
  String get uniDbInterviewRequired => 'Требуется';

  @override
  String get uniDbInterviewNotRequired => 'Не требуется';

  @override
  String get uniDbViewFullDetails => 'Подробная информация';

  @override
  String get uniDbCompareSelectHint => 'Выберите 2-3 университета для сравнения';

  @override
  String uniDbCompareCta(int count) {
    return 'Сравнить: $count';
  }

  @override
  String get uniDbCompareAction => 'Сравнить университеты';

  @override
  String get uniDbTrackerTitle => 'Трекер заявок';

  @override
  String get uniDbTrackerEmptyTitle => 'Отслеживаемых университетов пока нет';

  @override
  String get uniDbTrackerEmptyBody =>
      'Начните отслеживать университет на его странице — дедлайны появятся здесь.';

  @override
  String get uniDbLoadFailed => 'Не удалось загрузить список университетов.';

  @override
  String get loginSubmitButton => 'Войти в систему';

  @override
  String get welcomeGuestCaption =>
      'Код не нужен — свободно просматривайте, фильтруйте и сравнивайте.';

  @override
  String get homeNotifications => 'Уведомления';

  @override
  String get notifApplicationUpdates => 'Обновления заявок';

  @override
  String get notifToUpload => 'Загрузить';

  @override
  String get notifAllCaughtUp => 'Всё выполнено';

  @override
  String get notifAllCaughtUpBody =>
      'Напоминания о документах и заявках появятся здесь.';

  @override
  String get guestContactEyebrow => 'Hanguk Consulting';

  @override
  String get guestContactTitle => 'Свяжитесь с нами';

  @override
  String get guestContactSubtitle => 'Выберите удобный канал — отвечаем везде.';

  @override
  String get guestContactTelegramChannel => 'Telegram-канал';

  @override
  String get guestContactTelegramChannelHint => 'Новости, сроки и наборы';

  @override
  String get guestContactTelegramDirect => 'Написать в Telegram';

  @override
  String get guestContactTelegramDirectHint => 'Задайте вопрос консультанту';

  @override
  String get guestContactInstagram => 'Instagram';

  @override
  String get guestContactInstagramHint => 'Студенты, кампусы, будни';

  @override
  String get guestContactCall => 'Позвонить';

  @override
  String get guestContactJoinHint => 'Уже есть магический код?';

  @override
  String get guestContactLaunchFailed => 'Не удалось открыть ссылку.';

  @override
  String get guestContactCta => 'Связаться';
}
