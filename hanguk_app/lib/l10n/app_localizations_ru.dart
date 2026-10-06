// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get trainingTabTitle => 'Учебный центр';

  @override
  String get trainingTabSubtitle =>
      'Готовьтесь к поступлению с учебными модулями на основе ИИ.';

  @override
  String get studyPlanCardTitle => 'Конструктор учебного плана';

  @override
  String get studyPlanCardDesc =>
      'Составьте убедительный план своего академического пути.';

  @override
  String get personalStatementCardTitle => 'Мотивационное письмо';

  @override
  String get personalStatementCardDesc =>
      'Пишите сильные и увлекательные личные эссе.';

  @override
  String get interviewCardTitle => 'Подготовка к собеседованию';

  @override
  String get interviewCardDesc =>
      'Отвечайте на пробные вопросы и становитесь увереннее.';

  @override
  String get applyCta => 'Подать заявку в университет';

  @override
  String get noApplicationsTitle => 'Заявок пока нет';

  @override
  String get noApplicationsBody =>
      'Сначала добавьте целевой университет — черновик создаётся для конкретного вуза.';

  @override
  String get startInterview => 'Начать собеседование';

  @override
  String get cancel => 'Отмена';

  @override
  String get endInterview => 'Завершить собеседование';

  @override
  String get endSession => 'Завершить сессию';

  @override
  String get practiceAgain => 'Попробовать ещё раз';

  @override
  String get connecting => 'Подключение...';

  @override
  String get greetWait =>
      'Подключение — интервьюер скоро вас поприветствует...';

  @override
  String get yourTurn => 'Ваша очередь говорить';

  @override
  String get aiSpeaking => 'Говорит интервьюер...';

  @override
  String get wrappingUp => 'Завершаем собеседование...';

  @override
  String get micRequired => 'Для собеседования нужен доступ к микрофону.';

  @override
  String get walkaroundLoadingTitle => 'Загрузка прогулки по кампусу';

  @override
  String get walkaroundLoadingSubtitle =>
      'Загружаем панорамы улиц рядом с кампусом.';

  @override
  String get walkaroundNoPanoTitle => 'Здесь нет панорам улиц';

  @override
  String get walkaroundNoPanoSubtitle =>
      'Рядом с этим кампусом нет доступных панорам улиц.';

  @override
  String get walkaroundBlockedTitle => 'Панорамы улиц недоступны';

  @override
  String get walkaroundBlockedSubtitle =>
      'Картографический сервис заблокировал запрос. Попробуйте другую сеть.';

  @override
  String get walkaroundNetworkTitle =>
      'Не удалось подключиться к картографическому сервису';

  @override
  String get walkaroundNetworkSubtitle =>
      'Проверьте подключение и попробуйте снова.';

  @override
  String get walkaroundInitErrorTitle => 'Не удалось запустить панорамы улиц';

  @override
  String get walkaroundInitErrorSubtitle =>
      'Не удалось запустить прогулку. Попробуйте ещё раз.';

  @override
  String get virtualTourTitle => 'Виртуальный тур';

  @override
  String get virtualWalkaroundTitle => 'Виртуальная прогулка';

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
  String get ok => 'ОК';

  @override
  String get loadingLabel => 'Загрузка...';

  @override
  String get accountBackTooltip => 'Назад';

  @override
  String get accountTitle => 'Аккаунт';

  @override
  String get accountSignedInAs => 'Вы вошли как';

  @override
  String get accountUnknownAccount => '(неизвестный аккаунт)';

  @override
  String get accountSessionLabel => 'Сеанс';

  @override
  String get accountSigningOut => 'Выход…';

  @override
  String get accountSignOut => 'Выйти';

  @override
  String get accountYourDataLabel => 'Ваши данные';

  @override
  String get accountYourDataBody =>
      'Скачайте JSON-копию всех данных, которые Hanguk хранит о вашем аккаунте: профиль, заявки, учебные планы, черновики, сессии собеседований и отзывы.';

  @override
  String get accountPreparingExport => 'Подготовка экспорта…';

  @override
  String get accountDownloadMyData => 'Скачать мои данные';

  @override
  String get accountDangerZoneLabel => 'Опасная зона';

  @override
  String get accountDangerZoneBody =>
      'Удаление аккаунта необратимо. Мы удалим ваш профиль, заявки, учебные планы, черновики мотивационных писем, сессии собеседований и расшифровки. Документы в хранилище удаляются в течение 30 дней, резервные копии — в течение 90 дней.';

  @override
  String get accountDeleteAccount => 'Удалить аккаунт';

  @override
  String get accountPrivacyPolicy => 'Политика конфиденциальности';

  @override
  String get accountTermsOfService => 'Условия использования';

  @override
  String get accountDeleteErrorTitle => 'Не удалось удалить аккаунт';

  @override
  String accountDeleteErrorBody(Object error) {
    return 'При удалении ваших данных произошла ошибка:\n\n$error\n\nНапишите на privacy@hanguk.uz, и мы завершим удаление за вас.';
  }

  @override
  String accountExportFailed(Object error) {
    return 'Ошибка экспорта: $error';
  }

  @override
  String get accountDeleteDialogTitle => 'Удалить аккаунт?';

  @override
  String get accountDeleteDialogBody =>
      'Ваш аккаунт, заявки, учебные планы, черновики мотивационных писем, сессии собеседований и расшифровки будут удалены безвозвратно.\n\nВведите DELETE для подтверждения.';

  @override
  String get accountDeleteDialogConfirm => 'Удалить навсегда';

  @override
  String get accountDeleteProgress => 'Удаляем ваш аккаунт…';

  @override
  String get loginStudentPortal => 'Портал студента';

  @override
  String get loginAccessCodeHelp =>
      'Введите 8-значный код от вашего консультанта или представителя университета.';

  @override
  String get loginAccessCodeButton => 'Войти по коду доступа';

  @override
  String get loginSwitchToPhone => '← Я хочу войти по номеру телефона';

  @override
  String get loginComingSoonTitle => 'Скоро';

  @override
  String get loginComingSoonBody =>
      'Открытая регистрация и вход по телефону временно недоступны: мы обновляем системы.\n\nСтудентам: пока входите с помощью магического кода.';

  @override
  String get loginSwitchToMagicCode => 'Войти по магическому коду';

  @override
  String get loginErrorInvalidPhone =>
      'Введите корректный номер телефона (например, +12345678).';

  @override
  String get loginErrorPasswordTooShort =>
      'Пароль должен содержать не менее 6 символов.';

  @override
  String get loginErrorInvalidCredentials =>
      'Неверный номер телефона или пароль.';

  @override
  String get loginErrorInvalidAccessCode =>
      'Введите корректный код доступа (не менее 6 символов).';

  @override
  String get signUpErrorNameRequired => 'Укажите полное имя.';

  @override
  String get signUpErrorPhoneRequired =>
      'Укажите корректный номер телефона (например, +12345678).';

  @override
  String get signUpErrorPasswordMismatch => 'Пароли не совпадают.';

  @override
  String get signUpSuccess => 'Аккаунт создан! Теперь войдите.';

  @override
  String get notifSettingsTitle => 'Настройки уведомлений';

  @override
  String get notifSettingsEmptyTitle => 'Нет отслеживаемых университетов';

  @override
  String get notifSettingsEmptyBody =>
      'Нажмите «Отслеживать этот университет» на странице вуза, чтобы следить за ним. Настройки уведомлений появятся здесь, когда вы начнёте отслеживать хотя бы один университет.';

  @override
  String get notifSettingsCalendar => 'Изменения в календаре';

  @override
  String get notifSettingsCalendarDesc => 'Переносы дедлайнов';

  @override
  String get notifSettingsCorrection => 'Уведомления об исправлениях';

  @override
  String get notifSettingsCorrectionDesc =>
      'Опубликован 정정공고 — высший приоритет';

  @override
  String get notifSettingsRequirement => 'Изменения требований';

  @override
  String get notifSettingsRequirementDesc =>
      'Изменения правил TOPIK / GPA / языковых тестов';

  @override
  String get notifSettingsScholarship => 'Новости о стипендиях';

  @override
  String get notifSettingsScholarshipDesc =>
      'По умолчанию выключено — много уведомлений';

  @override
  String notifSettingsLoadError(Object error) {
    return 'Ошибка: $error';
  }

  @override
  String notifSettingsPushLanguage(String lang) {
    return 'Язык push-уведомлений: $lang';
  }

  @override
  String notifSettingsUpdateError(Object error) {
    return 'Не удалось обновить настройку: $error';
  }

  @override
  String get interviewDialogStepUniversity => '1. Выберите целевой университет';

  @override
  String get interviewDialogStepTrack => '2. Выберите язык собеседования';

  @override
  String get interviewDialogStepPersona => '3. Тип интервьюера';

  @override
  String get interviewNoAppsBody =>
      'Сначала добавьте целевой университет — вопросы собеседования подбираются под этот вуз.';

  @override
  String get trackKorean => 'Корейский';

  @override
  String get trackEnglish => 'Английский';

  @override
  String get personaFriendly => 'Доброжелательный сотрудник приёмной комиссии';

  @override
  String get personaStrict => 'Строгий профессор';

  @override
  String get personaImpatient => 'Нетерпеливый визовый офицер';

  @override
  String get personaFriendlyCaps =>
      'Доброжелательный сотрудник приёмной комиссии';

  @override
  String get personaStrictCaps => 'Строгий профессор';

  @override
  String get personaImpatientCaps => 'Нетерпеливый визовый офицер';

  @override
  String get micBlockedInSettings =>
      'Микрофон заблокирован в настройках системы.';

  @override
  String get openSettings => 'Открыть настройки';

  @override
  String genericError(Object error) {
    return 'Ошибка: $error';
  }

  @override
  String errorLoadingApplications(Object error) {
    return 'Ошибка загрузки заявок: $error';
  }

  @override
  String get noAppsInlineHint =>
      'Заявок пока нет — добавьте её во вкладке «Заявки».';

  @override
  String get aiStatusWaiting => 'Ожидание ввода...';

  @override
  String get aiStatusCoolingDown => 'ИИ делает паузу…';

  @override
  String get aiStatusAnalyzing => 'ИИ анализирует...';

  @override
  String get aiStatusReady => 'Готово';

  @override
  String get aiStatusPredicting => 'ИИ предлагает текст...';

  @override
  String get aiStatusSupervisionActive => 'Проверка ИИ активна';

  @override
  String get aiStatusSpellCheckUnavailable => 'Словарь устройства недоступен';

  @override
  String get workspaceTitle => 'Рабочая область';

  @override
  String get workspaceAnalyzeButton => 'Анализ';

  @override
  String get aiSupervisionWarningsTitle => 'Замечания ИИ:';

  @override
  String grammarReplaceWith(String original, String suggestion) {
    return 'Заменить «$original» на «$suggestion»';
  }

  @override
  String draftingHint(String documentTitle) {
    return 'Напишите здесь: $documentTitle...';
  }

  @override
  String get ghostSuggestionSemantics =>
      'Подсказка ИИ — нажмите, чтобы вставить';

  @override
  String get ghostAccept => 'Принять';

  @override
  String get ghostDismiss => 'Скрыть подсказку';

  @override
  String get pastDraftsTooltip => 'Прошлые черновики';

  @override
  String get sessionSettingsTooltip => 'Настройки сессии';

  @override
  String get switchTrackEnglish => 'Сменить язык → английский';

  @override
  String get switchTrackKorean => 'Сменить язык → корейский';

  @override
  String get createNewSession => 'Создать новую сессию';

  @override
  String get yourSavedDrafts => 'Сохранённые черновики';

  @override
  String get noPreviousDrafts => 'Прошлых черновиков нет.';

  @override
  String get generalDraftLabel => 'Общий';

  @override
  String get studyPlanDocumentName => 'Учебный план';

  @override
  String get personalStatementDocumentName => 'Мотивационное письмо';

  @override
  String savedDraftItemTitle(String universityName, String documentName) {
    return '$documentName — $universityName';
  }

  @override
  String sessionStatusLabel(String status) {
    return 'Статус: $status';
  }

  @override
  String get deleteSessionTitle => 'Удалить сессию';

  @override
  String get deleteSessionBody =>
      'Вы уверены, что хотите удалить эту сессию? Это действие нельзя отменить.';

  @override
  String get deleteLabel => 'Удалить';

  @override
  String get stepperLabelGuide => 'Руководство';

  @override
  String get stepperLabelExample => 'Пример';

  @override
  String get stepperLabelDraft => 'Черновик';

  @override
  String get stepperLabelFeedback => 'Отзыв';

  @override
  String get readExamplesButton => 'Смотреть примеры';

  @override
  String get targetUniversityLabel => 'Целевой университет';

  @override
  String get startDraftingButton => 'Начать писать';

  @override
  String get newStudyPlanDialogTitle => 'Новый учебный план';

  @override
  String get newPersonalStatementDialogTitle => 'Новое мотивационное письмо';

  @override
  String get selectTargetUniversityStep => '1. Выберите целевой университет';

  @override
  String get selectLanguageTrackStep => '2. Выберите язык';

  @override
  String get createSession => 'Создать сессию';

  @override
  String get aiExampleEmbassyTitle => 'Пример для посольства';

  @override
  String aiExampleUniversityTitle(String universityName) {
    return 'Пример для $universityName';
  }

  @override
  String get aiExampleEmbassyLabel => 'Посольство Республики Корея (виза)';

  @override
  String get aiExampleWritingPlaceholder => 'ИИ пишет пример...';

  @override
  String get copyButton => 'Копировать';

  @override
  String get copiedSnackbar => 'Текст скопирован!';

  @override
  String get analysisFeedbackTitle => 'Анализ и отзыв';

  @override
  String get noAnalysisYet => 'Анализ ещё не готов.';

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
  String get aiReviewedDraft => 'ИИ проверил ваш черновик.';

  @override
  String get returnToDrafting => 'Вернуться к черновику';

  @override
  String get studyPlanHistoryTitle => 'История учебных планов';

  @override
  String get personalStatementHistoryTitle => 'История мотивационных писем';

  @override
  String get draftingHistoryTitle => 'История черновиков';

  @override
  String get noPastDraftsYet => 'Прошлых черновиков пока нет';

  @override
  String get noPastDraftsBody =>
      'Начните новую сессию — ваши черновики появятся здесь, сначала последние изменённые.';

  @override
  String get noTargetUniversity => 'Без целевого университета';

  @override
  String sessionStepLabel(int step) {
    return 'Этап $step';
  }

  @override
  String get metricWords => 'Слова';

  @override
  String get metricCharacters => 'Символы';

  @override
  String get saveStatusUnsaved => 'Не сохранено';

  @override
  String get saveStatusSaving => 'Сохранение...';

  @override
  String get saveStatusSaved => 'Сохранено';

  @override
  String get saveStatusError => 'Ошибка сохранения';

  @override
  String get interviewPracticeTitle => 'Тренировка собеседования';

  @override
  String get interviewSettingUp => 'Готовим ваше собеседование...';

  @override
  String get interviewSetupTitle => 'Настройка ИИ-собеседования';

  @override
  String get interviewSetupSubtitle =>
      'Настройте ИИ-интервьюера перед началом.';

  @override
  String get interviewTypeLabel => 'Тип собеседования';

  @override
  String get interviewTypeGeneral => 'Общее знакомство';

  @override
  String get interviewTypeUniversitySpecific => 'Для конкретного университета';

  @override
  String get interviewTypeVisa => 'Виза / посольство';

  @override
  String get targetUniversityFieldLabel => 'Целевой университет';

  @override
  String get languageLabel => 'Язык';

  @override
  String get interviewerPersonaLabel => 'Тип интервьюера';

  @override
  String get focusTopicLabel => 'Тема (необязательно)';

  @override
  String get focusTopicHint =>
      'например, обсуждение моей специальности по информатике...';

  @override
  String get timedModeTitle => 'Режим с таймером';

  @override
  String get timedModeSubtitle => 'Строгий лимит 5 минут';

  @override
  String get startPracticeButton => 'Начать тренировку';

  @override
  String get pickUniversityFirstHint =>
      'Выберите целевой университет выше, чтобы продолжить.';

  @override
  String get coachingFiller => 'Избегайте слов-паразитов!';

  @override
  String get lifelineHintsTitle => '💡 Подсказки:';

  @override
  String get speakerAi => 'ИИ';

  @override
  String get speakerYou => 'Вы';

  @override
  String connectionInterrupted(String detail) {
    return 'Соединение прервано: $detail';
  }

  @override
  String get interviewAnalyticsTitle => 'Аналитика собеседования';

  @override
  String get analyzingTranscript => 'ИИ анализирует расшифровку...';

  @override
  String get noFeedbackAvailable => 'Отзыв недоступен.';

  @override
  String get overallScoreLabel => 'Общий балл';

  @override
  String get metricCommunication => 'Коммуникация';

  @override
  String get metricConfidence => 'Уверенность';

  @override
  String get metricContent => 'Содержание';

  @override
  String get metricLanguage => 'Язык';

  @override
  String get detailedFeedbackTitle => 'Подробный отзыв';

  @override
  String get detailedFeedbackFallback => 'Отличная работа.';

  @override
  String get strengthsLabel => 'Сильные стороны';

  @override
  String get areasToImproveLabel => 'Что улучшить';

  @override
  String get startAnotherInterview => 'Начать новое собеседование';

  @override
  String get sessionRecording => 'Запись сессии';

  @override
  String get audioRecordingNotFound => 'Аудиозапись не найдена.';

  @override
  String get interviewHistoryTitle => 'История собеседований';

  @override
  String get noPastInterviews => 'Прошлых собеседований нет.';

  @override
  String get unknownTarget => 'Неизвестная цель';

  @override
  String get unknownUniversity => 'Неизвестный университет';

  @override
  String get abandonedSessionNote =>
      'Эта сессия завершилась без отзыва — запись недоступна.';

  @override
  String get activeSessionNote =>
      'Эта сессия ещё активна. Завершите её, чтобы увидеть отзыв.';

  @override
  String get deleteSessionTooltip => 'Удалить сессию';

  @override
  String get deleteInterviewDialogTitle => 'Удалить эту сессию?';

  @override
  String get deleteInterviewDialogBody =>
      'Отзыв и ссылка на запись будут удалены безвозвратно.';

  @override
  String deleteFailed(Object error) {
    return 'Не удалось удалить: $error';
  }

  @override
  String get a11yTooltipAskAi => 'Спросить Hanguk AI';

  @override
  String get a11yTooltipClearChat => 'Очистить историю чата';

  @override
  String get a11yTooltipSendMessage => 'Отправить сообщение';

  @override
  String get a11yTooltipClose => 'Закрыть';

  @override
  String get a11yTooltipPreviewDocument => 'Просмотреть документ';

  @override
  String get a11yTooltipDeleteDocument => 'Удалить документ';

  @override
  String get a11yTooltipInterviewHistory => 'История собеседований';

  @override
  String get a11yTooltipCloseSession => 'Закрыть сессию';

  @override
  String get a11yTooltipDeleteSession => 'Удалить сессию';

  @override
  String get a11yTooltipBack => 'Назад';

  @override
  String get a11yTooltipPlayRecording => 'Воспроизвести запись';

  @override
  String get a11yTooltipPauseRecording => 'Приостановить запись';

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
  String get ieqasOutstanding => 'IEQAS высшая';

  @override
  String get ieqasAccredited => 'IEQAS аккредитация';

  @override
  String get guestRowPartner => 'Партнёр Hanguk';

  @override
  String get guestRowNextEvent => 'Ближайшая дата';

  @override
  String get guestRowWebsite => 'Сайт';

  @override
  String get guestRowTuition => 'Стоимость обучения';

  @override
  String get guestRowApplication => 'Приём заявок';

  @override
  String get guestRowDocDeadline => 'Срок подачи документов';

  @override
  String get guestRowTopik => 'TOPIK';

  @override
  String get guestRowEnglish => 'Английский';

  @override
  String get guestRowInterview => 'Собеседование';

  @override
  String get guestRowDocuments => 'Документы';

  @override
  String guestTuitionYearNote(int year) {
    return 'данные за $year год';
  }

  @override
  String guestDocumentsCount(int count) {
    return '$count видов';
  }

  @override
  String get guestApostilleShort => 'нужен апостиль';

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
      'Чтобы смотреть и сравнивать, код не нужен.';

  @override
  String get welcomeClientsDivider => 'Клиенты Hanguk';

  @override
  String get loginNoCodePrompt => 'Нет кода?';

  @override
  String get loginAskConsultant => 'Спросите консультанта';

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

  @override
  String get aiReportAction => 'Пожаловаться';

  @override
  String get aiReportTitle => 'Пожаловаться на этот ответ';

  @override
  String get aiReportBody =>
      'Расскажите, что не так с этим ответом ИИ. Наша команда рассматривает каждую жалобу.';

  @override
  String get aiReportReasonHint => 'Что с ним не так? (необязательно)';

  @override
  String get aiReportSubmit => 'Отправить жалобу';

  @override
  String get aiReportThanks => 'Спасибо. Наша команда рассмотрит этот ответ.';

  @override
  String get aiReportFailed =>
      'Не удалось отправить жалобу. Попробуйте ещё раз.';

  @override
  String get catalogSearchHint => 'Поиск по названию университета';

  @override
  String get catalogListTitle => 'Университеты';

  @override
  String catalogCityUniversities(String city) {
    return 'Университеты: $city';
  }

  @override
  String get catalogEmptyTitle => 'Университеты не найдены';

  @override
  String get catalogEmptyBody => 'Попробуйте другой город или фильтр.';

  @override
  String get catalogTypeState => 'Государственный университет';

  @override
  String get catalogTypePrivate => 'Частный университет';

  @override
  String get catalogTypeSpecialized => 'Специализированный вуз';

  @override
  String get catalogTypeStateShort => 'Государственный';

  @override
  String get catalogTypePrivateShort => 'Частный';

  @override
  String get catalogTypeSpecializedShort => 'Специализированный';

  @override
  String get catalogFilterTitle => 'Фильтр';

  @override
  String get catalogFilterClear => 'Сбросить';

  @override
  String get catalogFilterCity => 'Город';

  @override
  String catalogFilterCityPicked(int count) {
    return 'Выбрано: $count';
  }

  @override
  String get catalogFilterDegree => 'Степень';

  @override
  String get catalogDegreeBachelor => 'Бакалавриат';

  @override
  String get catalogDegreeMaster => 'Магистратура';

  @override
  String get catalogFilterEnglish => 'Требование по английскому';

  @override
  String get catalogFilterEnglishHint => 'ваш балл IELTS';

  @override
  String get catalogIeltsNone => 'Не нужен';

  @override
  String get catalogIeltsNoteAll => 'Все программы (на корейском и английском)';

  @override
  String catalogIeltsNote(String score) {
    return 'Только программы на английском, куда можно поступить с IELTS $score';
  }

  @override
  String get catalogFilterPrice => 'Стоимость обучения';

  @override
  String get catalogPricePerSemester => 'за семестр';

  @override
  String get catalogPriceFrom => 'От';

  @override
  String get catalogPriceTo => 'До';

  @override
  String catalogPriceUpTo(String amount) {
    return 'до $amount';
  }

  @override
  String catalogApply(int count) {
    return 'Показать университеты: $count';
  }

  @override
  String get catalogFaculties => 'Факультеты';

  @override
  String catalogFacultyCount(int count) {
    return 'Факультетов: $count';
  }

  @override
  String catalogProgramCount(int count) {
    return 'Направлений: $count';
  }

  @override
  String catalogTuitionTitle(String name) {
    return 'Стоимость · $name';
  }

  @override
  String get catalogPerSemester => '/ семестр';

  @override
  String get catalogPerYear => '/ год';

  @override
  String get catalogSemSuffix => '/сем';

  @override
  String get catalogYearSuffix => '/год';

  @override
  String get catalogYearlyTuition => 'Стоимость за год';

  @override
  String get catalogApplicationFee => 'Сбор за заявку';

  @override
  String get catalogEntranceFee => 'Вступительный взнос';

  @override
  String get catalogRequirements => 'Требования к поступлению';

  @override
  String get catalogReqKorean => 'Корейский язык';

  @override
  String get catalogReqEnglish => 'Для программ на английском';

  @override
  String get catalogReqRecommendation => 'Рекомендательное письмо';

  @override
  String get catalogRecYes => 'Нужно';

  @override
  String get catalogRecNo => 'Не нужно';

  @override
  String get catalogRecOptional => 'По желанию';

  @override
  String get catalogReqDocuments => 'Документы';

  @override
  String catalogDocsRequired(int count) {
    return 'Обязательных: $count';
  }

  @override
  String get catalogReqApostille => 'Апостиль';

  @override
  String catalogApostilleDocs(int count) {
    return 'на $count документах';
  }

  @override
  String get catalogReqBank => 'Банковский баланс (D-2)';

  @override
  String catalogTimeline(String season) {
    return 'Сроки · $season';
  }

  @override
  String get catalogRoundLater => 'Объявят позже';

  @override
  String get catalogRoundEstimated => 'ориентировочно';

  @override
  String get catalogRoundRelative => 'Без точной даты';

  @override
  String get catalogWindowLabel => 'Подача документов';

  @override
  String catalogDaysLeft(int days) {
    return 'Осталось дней: $days';
  }

  @override
  String catalogWindowOpens(String date) {
    return 'Откроется $date';
  }

  @override
  String get catalogWindowClosed => 'Срок истёк';

  @override
  String get catalogContact => 'Связаться';

  @override
  String get catalogSeasonSpring => 'Весна';

  @override
  String get catalogSeasonAutumn => 'Осень';

  @override
  String catalogSeasonLabel(String year, String term) {
    return '$term $year';
  }

  @override
  String get catalogFavorite => 'Добавить к сравнению';

  @override
  String get catalogNoDegreeData => 'По этой степени данных пока нет';

  @override
  String get catalogCompareChip => 'Сравнить';

  @override
  String catalogCompareChipCount(int count) {
    return 'Сравнение · $count/2';
  }

  @override
  String get catalogComparePickTwo => 'Выберите 2 университета';

  @override
  String get compareTraySlotEmpty => 'Выбрать';

  @override
  String get compareTrayCta => 'Сравнить';

  @override
  String get compareTitle => 'Сравнение';

  @override
  String get compareOnlyDiff => 'Только различия';

  @override
  String get compareAddSlot => 'Выберите университет';

  @override
  String get compareNeedTwo => 'Выберите 2 университета для сравнения.';

  @override
  String get compareMainInfo => 'Основные сведения';

  @override
  String get compareDetails => 'Подробности';

  @override
  String get compareRowTuition => 'Оплата (семестр)';

  @override
  String get compareRowTopik => 'Требование TOPIK';

  @override
  String get compareRowIelts => 'Требование IELTS';

  @override
  String get compareRowDeadline => 'Срок подачи';

  @override
  String get compareRowCity => 'Город';

  @override
  String get compareRowRequirements => 'Требования к поступлению';

  @override
  String get compareBestCheaper => 'Дешевле';

  @override
  String get compareBestLower => 'Ниже';

  @override
  String get entryRegisterTitle => 'Регистрация';

  @override
  String get entryRegisterSubtitle =>
      'Создайте аккаунт по номеру телефона и паролю.';

  @override
  String get entryPhoneLabel => 'Номер телефона';

  @override
  String get entryPasswordLabel => 'Пароль';

  @override
  String get entryPasswordConfirmLabel => 'Повторите пароль';

  @override
  String get entryPasswordHint => 'Не менее 6 символов';

  @override
  String get entryRegisterSubmit => 'Зарегистрироваться';

  @override
  String get entryHaveAccount => 'Уже есть аккаунт?';

  @override
  String get entrySignInLink => 'Войти';

  @override
  String get entrySignInTitle => 'Вход';

  @override
  String get entrySignInSubtitle =>
      'Введите номер телефона и пароль, указанные при регистрации.';

  @override
  String get entrySignInSubmit => 'Войти';

  @override
  String get entryNoAccount => 'Нет аккаунта?';

  @override
  String get entryRegisterLink => 'Зарегистрироваться';

  @override
  String get entryErrorPhone => 'Введите номер полностью: 9 цифр после +998.';

  @override
  String get entryErrorPasswordShort =>
      'Пароль должен быть не короче 6 символов.';

  @override
  String get entryErrorPasswordMismatch => 'Пароли не совпадают.';

  @override
  String get entryErrorExists =>
      'Этот номер уже зарегистрирован. Войдите с паролем.';

  @override
  String get entryStudentNotice =>
      'Вы студент Hanguk — войдите с помощью магического кода, который дал ваш консультант.';

  @override
  String get entryErrorNotFound => 'Этот номер не зарегистрирован.';

  @override
  String get entryErrorWrongPassword => 'Неверный пароль.';

  @override
  String get entryErrorLocked =>
      'Слишком много попыток. Попробуйте через 15 минут.';

  @override
  String get entryErrorNetwork =>
      'Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.';

  @override
  String get entryShowPassword => 'Показать пароль';

  @override
  String get entryHidePassword => 'Скрыть пароль';

  @override
  String get entryLanguageLabel => 'Язык';

  @override
  String get entryLanguageSheetTitle => 'Выберите язык';

  @override
  String get catalogStep1 => 'Онлайн-подача документов';

  @override
  String get catalogStep2 => 'Оплата регистрационного взноса';

  @override
  String get catalogStep3 => 'Подача документов в бумажном виде';

  @override
  String get catalogStep4 => 'Банковская выписка (для университета)';

  @override
  String get catalogStep5 => 'Собеседование';

  @override
  String get catalogStep6 => 'Объявление результатов';

  @override
  String get catalogStep7 => 'Оплата обучения';

  @override
  String get catalogStep8 => 'Выдача Certificate of Admission';

  @override
  String get catalogStep9 => 'Банковская выписка для визы';

  @override
  String get catalogStep10 => 'Перевод и апостиль для визы';

  @override
  String get catalogStep11 => 'Подача документов на визу';

  @override
  String get surveysTitle => 'Опросы';

  @override
  String get surveysLoadError => 'Не удалось загрузить опросы';

  @override
  String get surveysEmptyTitle => 'Опросов пока нет';

  @override
  String get surveysEmptyBody => 'Новые опросы появятся здесь';

  @override
  String get surveyCompletedChip => 'Пройден';

  @override
  String get surveyNewChip => 'Новый';

  @override
  String surveyQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count вопроса',
      many: '$count вопросов',
      few: '$count вопроса',
      one: '$count вопрос',
    );
    return '$_temp0';
  }

  @override
  String get surveyFillCta => 'Пройти →';

  @override
  String surveyPendingCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count опроса',
      many: '$count опросов',
      few: '$count опроса',
      one: '$count опрос',
    );
    return '$_temp0';
  }

  @override
  String get surveyPendingSubtitle => 'Ждут ваших ответов';

  @override
  String get surveyTitleFallback => 'Опрос';

  @override
  String get surveyAnswerAllRequired => 'Ответьте на все обязательные вопросы';

  @override
  String get surveySubmitError =>
      'Не удалось отправить ответы. Попробуйте ещё раз.';

  @override
  String get surveyThanksTitle => 'Спасибо!';

  @override
  String get surveyThanksBody => 'Ваши ответы получены';

  @override
  String get surveyQuestionsLoadError => 'Не удалось загрузить вопросы';

  @override
  String get surveyNoQuestions => 'Вопросов нет';

  @override
  String get surveyAlreadyCompleted => 'Вы уже прошли этот опрос';

  @override
  String get surveySubmit => 'Отправить';

  @override
  String get surveyRequired => 'Обязательно';

  @override
  String get surveyEmailHint => 'primer@mail.com';

  @override
  String get surveyNumberHint => 'Введите число';

  @override
  String get surveyLongTextHint => 'Напишите подробно...';

  @override
  String get surveyTextHint => 'Напишите ваш ответ...';

  @override
  String get surveyPickDate => 'Выберите дату';

  @override
  String get docTypeIdCard => 'Копия ID-карты (паспорта) заявителя';

  @override
  String get docTypeForeignPassport => 'Копия загранпаспорта заявителя';

  @override
  String get docTypePhoto => 'Фото (3.5x4.5 см)';

  @override
  String get docTypeDiploma => 'Копия диплома или аттестата';

  @override
  String get docTypeLanguageCertificate =>
      'Копия языкового сертификата (не ниже IELTS 5.5 или TOPIK 2)';

  @override
  String get docTypeOther => 'Документ';

  @override
  String get docStatusLocked => 'Недоступно';

  @override
  String get notifPushSection => 'Последние уведомления';

  @override
  String get notifMarkAllRead => 'Прочитать все';

  @override
  String get appPendingApprovalNote =>
      'Ожидает одобрения консультанта.\nМы сообщим вам после рассмотрения.';

  @override
  String get appCountrySouthKorea => 'Южная Корея';

  @override
  String get appRoomNotFound => 'У этого университета пока нет комнаты.';

  @override
  String get appRoomDiscussionNotFound => 'В этой комнате пока нет обсуждения.';

  @override
  String get appRoomDiscussionConnectError =>
      'Не удалось подключиться к обсуждению.';

  @override
  String get appRoomSendError => 'Не удалось отправить сообщение.';

  @override
  String get appRoomNotSignedIn => 'Пожалуйста, войдите снова.';

  @override
  String get appRoomLoadError => 'Не удалось загрузить. Попробуйте ещё раз.';

  @override
  String get appRoomAnnouncementFallbackTitle => 'Объявление';

  @override
  String get appRoomEventFallbackTitle => 'Событие';

  @override
  String get statusPendingApproval => 'Ожидает одобрения';

  @override
  String get statusDocumentsCollection => 'Документы собраны';

  @override
  String get statusDocumentsTranslation => 'Документы переведены';

  @override
  String get statusApostille => 'Апостиль готов';

  @override
  String get statusApplicationSubmitted => 'Заявка подана';

  @override
  String get statusUniversityResponse => 'Университет ответил';

  @override
  String get statusVisaDocuments => 'Визовые документы';

  @override
  String get statusCompleted => 'Завершено';

  @override
  String get statusInProgress => 'В процессе';

  @override
  String get chatGreeting =>
      'Здравствуйте! 👋 Я помощник Hanguk AI. Задавайте любые вопросы о документах, университетах и процессе поступления!';

  @override
  String get chatNoResponse => 'Извините, не удалось подготовить ответ.';

  @override
  String get chatConnectError =>
      'Не удалось связаться с Hanguk AI. Проверьте подключение к интернету.';

  @override
  String get chatCleared => 'Чат очищен. Чем могу помочь?';

  @override
  String get mapLoadFailed =>
      'Карта не загрузилась. Проверьте подключение к интернету.';

  @override
  String get mapTapForDetails => 'Нажмите, чтобы узнать подробнее';

  @override
  String get mapProviderUnavailable =>
      'Картографический сервис сейчас недоступен.';

  @override
  String get mapInitError => 'Не удалось запустить карту.';

  @override
  String get trainingGuideSpTitle => 'Как написать учебный план (Study Plan)';

  @override
  String get trainingGuideSpIntro =>
      'Учебный план объясняет, почему вы хотите учиться в Южной Корее, какие цели перед собой ставите и чем планируете заниматься после выпуска.';

  @override
  String get trainingGuideSp1Title => '1. Цель и мотивация';

  @override
  String get trainingGuideSp1Body =>
      'Почему вы выбрали эту специальность? Почему Южная Корея и выбранный вами университет подходят для этой цели?';

  @override
  String get trainingGuideSp2Title => '2. Учебные планы';

  @override
  String get trainingGuideSp2Body =>
      'На каких предметах или направлениях исследований вы сосредоточитесь? Как вы планируете изучать корейский язык?';

  @override
  String get trainingGuideSp3Title => '3. Планы на будущее';

  @override
  String get trainingGuideSp3Body =>
      'Чем вы собираетесь заниматься после выпуска? Какой вклад вы внесёте в развитие своей страны?';

  @override
  String get trainingGuidePsTitle =>
      'Как написать мотивационное письмо (Personal Statement)';

  @override
  String get trainingGuidePsIntro =>
      'Мотивационное письмо — это эссе о том, кто вы, чего достигли, что вас интересует и почему вы подходите для этой специальности.';

  @override
  String get trainingGuidePs1Title => '1. Опыт и достижения';

  @override
  String get trainingGuidePs1Body =>
      'Расскажите о своих школьных достижениях, олимпиадах и проектах, в которых вы участвовали, и о своих увлечениях.';

  @override
  String get trainingGuidePs2Title => '2. Личные качества';

  @override
  String get trainingGuidePs2Body =>
      'Чем вы выделяетесь среди других абитуриентов? Как вы справлялись с трудностями?';

  @override
  String get trainingGuidePs3Title => '3. Почему именно эта область?';

  @override
  String get trainingGuidePs3Body =>
      'Когда и как у вас появился интерес к этой области?';

  @override
  String get trainingStatusInProgress => 'В процессе';

  @override
  String get trainingStatusCompleted => 'Завершено';

  @override
  String get trainingStatusAbandoned => 'Прервано';

  @override
  String get trainingErrorSessionsLoad =>
      'Не удалось загрузить ваши черновики. Попробуйте ещё раз.';

  @override
  String get trainingErrorCreateDraft =>
      'Не удалось создать черновик. Попробуйте ещё раз.';

  @override
  String get trainingErrorLoadDraft =>
      'Не удалось открыть черновик. Попробуйте ещё раз.';

  @override
  String get trainingErrorDraftConflict =>
      'На другом устройстве сохранён более новый черновик. Обновите страницу, чтобы объединить их.';

  @override
  String get trainingErrorTrackUpdate =>
      'Не удалось изменить язык письма. Попробуйте ещё раз.';

  @override
  String get trainingErrorGeneric => 'Что-то пошло не так. Попробуйте ещё раз.';

  @override
  String get trainingInterviewAiError =>
      'У ИИ-интервьюера возникла проблема. Попробуйте ещё раз.';

  @override
  String get trainingInterviewAnswerError =>
      'Не удалось обработать ваш ответ. Попробуйте ещё раз.';

  @override
  String get trainingInterviewVoiceError =>
      'Не удалось воспроизвести голос интервьюера.';

  @override
  String get trainingInterviewAudioLinkWarning =>
      'Не удалось сохранить ссылку на запись. Прослушать её позже может быть невозможно.';

  @override
  String get trainingInterviewFeedbackLoadError =>
      'Не удалось загрузить отзыв. Попробуйте ещё раз.';

  @override
  String get authErrorCodeNotFound =>
      'Этот код не найден. Пожалуйста, уточните его у своего консультанта.';

  @override
  String get authErrorServerUnreachable =>
      'Не удалось связаться с сервером. Проверьте подключение и нажмите «Войти» ещё раз.';

  @override
  String get authErrorStaffBlocked =>
      'Сотрудникам нужно входить по логину и паролю, а не по magic-коду.';

  @override
  String get authErrorAccountSetupBusy =>
      'Сервер настраивает ваш аккаунт. Попробуйте ещё раз через 30 секунд.';

  @override
  String get authErrorLoginServer =>
      'Ошибка сервера входа. Попробуйте ещё раз или попросите консультанта сбросить ваш аккаунт.';

  @override
  String get authErrorUnexpected =>
      'Непредвиденная ошибка сервера. Попробуйте ещё раз или обратитесь к консультанту.';

  @override
  String get authErrorCrmAccount =>
      'Этот аккаунт создал ваш консультант. Пожалуйста, войдите с помощью Magic Access Code, который он вам дал.';

  @override
  String get authErrorAlreadyRegistered =>
      'Этот номер телефона уже зарегистрирован. Пожалуйста, войдите.';

  @override
  String get authErrorSignUpDisabled =>
      'Регистрация сейчас отключена. Пожалуйста, обратитесь к администратору.';

  @override
  String get authErrorPhoneFormat =>
      'Неверный формат номера телефона. Укажите код страны.';

  @override
  String get authErrorSignUpFailed =>
      'Не удалось создать аккаунт. Попробуйте ещё раз.';

  @override
  String get a11yMenu => 'Меню';

  @override
  String get accountExportShareSubject => 'Hanguk — выгрузка ваших данных';

  @override
  String get accountExportShareText =>
      'Выгрузка ваших данных из Hanguk (JSON).';

  @override
  String get accountExportError =>
      'Не удалось выгрузить ваши данные. Попробуйте ещё раз.';

  @override
  String get uniDbEventOther => 'Важная дата';

  @override
  String get uniDbIeqasNone => 'Без аккредитации IEQAS';

  @override
  String get uniDbPdfLinkInvalid =>
      'Не удалось открыть ссылку. Попробуйте ещё раз.';

  @override
  String get uniDbFacultyMedicine => 'Медицина';

  @override
  String get uniDbFacultyPharmacy => 'Фармация';

  @override
  String get uniDbFacultyArtsPe => 'Искусство и спорт';

  @override
  String get uniDbFacultyTheology => 'Богословие';

  @override
  String get uniDbFacultyInterdisciplinary => 'Междисциплинарные направления';

  @override
  String get uniDbFacultyAll => 'Все факультеты';

  @override
  String get uniDbScholarshipScopeUniversity => 'Университетская';

  @override
  String get uniDbScholarshipScopeNational => 'Государственная';

  @override
  String get uniDbScholarshipScopeRegional => 'Региональная';

  @override
  String get uniDbScholarshipScopeFoundation => 'Фонд';

  @override
  String get uniDbScholarshipScopeDepartment => 'Кафедра';

  @override
  String uniDbAwardTuitionPct(String pct) {
    return 'Скидка $pct% на обучение';
  }

  @override
  String get uniDbAwardTuition => 'Скидка на обучение';

  @override
  String uniDbAwardTuitionKrw(String amount) {
    return 'Скидка $amount на обучение';
  }

  @override
  String uniDbAwardStipendMonthly(String amount) {
    return 'Стипендия $amount в месяц';
  }

  @override
  String get uniDbAwardStipend => 'Ежемесячная стипендия';

  @override
  String uniDbAwardAirfare(String amount) {
    return 'Авиабилет до $amount';
  }

  @override
  String get uniDbAwardAirfareCovered => 'Оплата авиабилета';

  @override
  String get uniDbAwardOther => 'Другая льгота';

  @override
  String uniDbTopikDeferred(String base) {
    return '$base (можно предоставить позже)';
  }

  @override
  String get uniDbChangeAdmissionCycle => 'Приёмная кампания';

  @override
  String get uniDbChangeDates => 'Даты';

  @override
  String get uniDbChangeUpdated => 'Обновлено';

  @override
  String get uniDbDocApostille => 'Апостиль';

  @override
  String get uniDbDocConsent => 'Согласие';

  @override
  String get uniDbDocPassport => 'Паспорт';

  @override
  String get uniDbDocTopik => 'Сертификат TOPIK';

  @override
  String get uniDbDocLanguage => 'Языковой сертификат';

  @override
  String get uniDbDocTranscript => 'Выписка оценок';

  @override
  String get uniDbDocDiploma => 'Диплом или аттестат';

  @override
  String get uniDbDocEnrollment => 'Справка с места учёбы';

  @override
  String get uniDbDocFamily => 'Документ о родстве';

  @override
  String get uniDbDocPowerOfAttorney => 'Доверенность';

  @override
  String get uniDbDocFinance => 'Подтверждение финансов';

  @override
  String get uniDbDocEntryExit => 'Справка о въезде и выезде';

  @override
  String get uniDbDocEmployment => 'Справка с места работы';

  @override
  String get uniDbDocRecommendation => 'Рекомендательное письмо';

  @override
  String get uniDbDocCitizenship => 'Подтверждение гражданства';

  @override
  String get uniDbDocStatement => 'Мотивационное письмо и учебный план';

  @override
  String get uniDbDocAlienRegistration => 'Карта регистрации иностранца';

  @override
  String get uniDbDocIdCard => 'Копия удостоверения личности';

  @override
  String get uniDbDocPhoto => 'Фотография';

  @override
  String get uniDbDocPortfolio => 'Портфолио';

  @override
  String get uniDbDocHealth => 'Медицинская справка';

  @override
  String get uniDbDocCalendar => 'Учебный календарь';

  @override
  String get uniDbDocTax => 'Справка об уплате налогов';

  @override
  String get uniDbDocBusinessRegistration =>
      'Свидетельство о регистрации предприятия';

  @override
  String get uniDbDocAward => 'Грамоты и награды';

  @override
  String get uniDbDocApplicationForm => 'Анкета-заявление';

  @override
  String get uniDbDocOther => 'Дополнительный документ';

  @override
  String get adminReviewQueueTitle => 'Очередь проверки';

  @override
  String get adminReviewTitle => 'Проверка';

  @override
  String get adminRefresh => 'Обновить';

  @override
  String get adminQueueEmpty =>
      'Очередь пуста. Сейчас ничего не ожидает проверки.';

  @override
  String get adminSelectItem => 'Выберите элемент очереди слева.';

  @override
  String get adminAccepted => 'Принято';

  @override
  String get adminEditedAccepted => 'Исправлено и принято';

  @override
  String get adminRejected => 'Отклонено';

  @override
  String get adminBackToQueue => 'Назад к очереди';

  @override
  String adminConfidence(int pct) {
    return 'Уверенность $pct%';
  }

  @override
  String get adminOverdue => 'Просрочено';

  @override
  String get adminOpenSource => 'Открыть источник (на корейском)';

  @override
  String get adminExtractedPayload => 'Извлечённые данные:';

  @override
  String get adminReject => 'Отклонить';

  @override
  String get adminEditAccept => 'Исправить и принять';

  @override
  String get adminAccept => 'Принять';

  @override
  String get adminPayloadNotObject => 'Данные должны быть JSON-объектом';

  @override
  String adminInvalidJson(String error) {
    return 'Некорректный JSON: $error';
  }

  @override
  String get adminEditPayload => 'Редактировать данные';

  @override
  String get adminSaveAccept => 'Сохранить и принять';

  @override
  String get adminRejectReasonTitle => 'Причина отклонения';

  @override
  String get adminDetailOptional => 'Подробности (необязательно)';

  @override
  String get adminStaffOnly =>
      'Этот раздел только для сотрудников Hanguk. Если вам нужен доступ, попросите администратора добавить вам роль сотрудника.';

  @override
  String get adminPriorityP1 => 'P1 — уведомление об исправлении (4 ч)';

  @override
  String get adminPriorityP2 => 'P2 — изменение вложения (12 ч)';

  @override
  String get adminPriorityP3 => 'P3 — изменённое поле D3 (24 ч)';

  @override
  String get adminPriorityP4 => 'P4 — обычное D2 (48 ч)';

  @override
  String get adminPriorityP5 => 'P5 — простое D1 (96 ч)';

  @override
  String get adminReasonLowConfidence => 'Низкая уверенность';

  @override
  String get adminReasonHighDifficulty => 'Сложное поле';

  @override
  String get adminReasonAutoApproved => 'Одобрено автоматически';

  @override
  String get adminReasonCorrectionNotice => 'Уведомление об исправлении';

  @override
  String get adminEntityExtraction => 'Извлечение';

  @override
  String get adminEntityGuideline => 'Правила приёма';

  @override
  String get adminRejectWrongYear => 'Не тот год';

  @override
  String get adminRejectWrongArchetype => 'Неверный тип документа';

  @override
  String get adminRejectHallucinated => 'Выдуманное поле';

  @override
  String get adminRejectOcrGarbled => 'Искажённый текст OCR';

  @override
  String get adminRejectSource404 => 'Источник не найден (404)';

  @override
  String get adminRejectOther => 'Другое';

  @override
  String get interviewErrorNoGreeting =>
      'Интервьюер не ответил. Вернитесь назад и попробуйте ещё раз.';

  @override
  String get interviewErrorEndedBeforeGreeting =>
      'Звонок завершился до того, как интервьюер заговорил. Попробуйте ещё раз.';

  @override
  String get interviewErrorCallFailed =>
      'Не удалось подключить звонок. Проверьте интернет и попробуйте ещё раз.';

  @override
  String get onbResultRouteLanguageCourse => 'Языковые курсы';

  @override
  String get onbResultRouteBachelor => 'Бакалавриат';

  @override
  String get onbResultRouteMaster => 'Магистратура';

  @override
  String get onbResultRouteCollege => 'Профессиональный колледж';

  @override
  String get onbResultIntakeSpring2027 => 'Весна 2027';

  @override
  String get onbResultIntakeFall2027 => 'Осень 2027';

  @override
  String get onbResultIntakeLater => 'Позже';

  @override
  String get onbResultBandHigh => 'Высокие шансы';

  @override
  String get onbResultBandHighNote =>
      'Основные требования выполнены — можно начинать готовить документы.';

  @override
  String get onbResultBandMid => 'Средние шансы';

  @override
  String get onbResultBandMidNote =>
      'Путь открыт, но 1–2 пункта нужно усилить.';

  @override
  String get onbResultBandLow => 'Пока риск высокий — но путь есть';

  @override
  String get onbResultBandLowNote =>
      'Языка и финансовых документов пока недостаточно.';

  @override
  String get onbResultFactorsTitle => 'Что повлияло';

  @override
  String get onbResultFactorKoreanStrong =>
      'TOPIK 3 и выше — требование для бакалавриата выполнено';

  @override
  String get onbResultFactorKoreanTopik2Degree =>
      'TOPIK 2 — для бакалавриата посольство требует TOPIK 3, для колледжа достаточно';

  @override
  String get onbResultFactorKoreanMissingDegree =>
      'Для бакалавриата посольство требует TOPIK 3';

  @override
  String get onbResultFactorKoreanCollegeStrong => 'TOPIK 3 и выше';

  @override
  String get onbResultFactorKoreanCollegeTopik2 =>
      'TOPIK 2 — требование для колледжа выполнено';

  @override
  String get onbResultFactorKoreanCourseCertificate =>
      'Есть сертификат Sejong 1A / TOPIK 1';

  @override
  String get onbResultFactorKoreanCourseMissing =>
      'Для визы на языковые курсы нужен TOPIK 1 или сертификат Sejong';

  @override
  String get onbResultFactorIncomeYes => 'Официальный доход родителей';

  @override
  String get onbResultFactorIncomeNo => 'У родителей нет официального дохода';

  @override
  String get onbResultFactorGradRecent =>
      'Выпуск недавно — перерыва в учёбе нет';

  @override
  String get onbResultFactorGradGapLong =>
      'После выпуска прошло много времени — нужно объяснить цель учёбы';

  @override
  String get onbResultFactorAgeHigh =>
      'Из-за возраста нужно объяснить цель учёбы';

  @override
  String get onbResultFactorBudgetLow =>
      'Бюджет ниже примерных годовых расходов';

  @override
  String get onbResultUnisTitle => 'Подходящие вам университеты';

  @override
  String get onbResultAccredited => 'Аккредитован';

  @override
  String get onbResultTuitionLabel => 'Контракт/сем.';

  @override
  String get onbResultBankLabel => 'Банковская справка';

  @override
  String get onbResultYearlyCost => 'Примерные расходы в год';

  @override
  String get onbResultStepsTitle => 'Следующие 3 шага';

  @override
  String get onbResultStepTopikPrep =>
      'Подготовка к TOPIK 3 или поступление через языковые курсы';

  @override
  String get onbResultStepSchoolDocs =>
      'Перевести и апостилировать аттестат и паспорт';

  @override
  String get onbResultStepDiplomaDocs =>
      'Перевести и апостилировать диплом и паспорт';

  @override
  String get onbResultStepApplyOnTime => 'Подать документы до срока вуза';

  @override
  String get onbResultPathsTitle => 'Подходящие вам пути';

  @override
  String get onbResultPathLanguageCourse => 'Через языковые курсы (D-4)';

  @override
  String get onbResultPathLanguageCourseNote =>
      'Языковые курсы, затем переход в бакалавриат.';

  @override
  String get onbResultPathCollege => 'Профессиональный колледж';

  @override
  String get onbResultPathCollegeNote => 'Требования мягче, контракт ниже.';

  @override
  String get onbResultPathNextSeason => 'Подготовка к следующему сезону';

  @override
  String get onbResultPathNextSeasonNote =>
      'Осень 2027 с TOPIK 3 и банковской справкой.';

  @override
  String onbResultTariffWhy(String tariff) {
    return '$tariff — почему? →';
  }

  @override
  String get onbResultCtaOperator => 'Бесплатная консультация';

  @override
  String get onbResultCtaTelegram => 'Продолжить в Telegram';

  @override
  String get onbResultDisclaimer =>
      'Это предварительная оценка. Решение по визе принимает посольство.';

  @override
  String onbResultPlanTariff(String tariff) {
    return 'Рекомендуемый тариф: $tariff';
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
  String get onbTariffsTitle => 'Цены и условия';

  @override
  String get onbTariffsSubtitle =>
      'Основная часть оплачивается после получения визы.';

  @override
  String onbTariffServices(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count услуг',
      few: '$count услуги',
      one: '$count услуга',
    );
    return '$_temp0';
  }

  @override
  String get onbTariffPriceStandart =>
      '2 млн сумов сейчас + 5 млн после визы, или 5 млн сразу';

  @override
  String get onbTariffPricePremium =>
      '3 млн сейчас + 10 млн после визы, или 10 млн';

  @override
  String get onbTariffPriceNoRisk => '\$5 000 сразу';

  @override
  String get onbTariffPriceHanbox => '\$2 000 или \$400 + \$200 в месяц';

  @override
  String get onbTariffMore => 'Подробнее →';

  @override
  String get onbTariffsCompare => 'Сравнить тарифы';

  @override
  String get onbTariffExcludedTitle => 'Что не входит';

  @override
  String get onbTariffExContract => 'Контракт';

  @override
  String get onbTariffExApplicationFee => 'Плата за подачу заявления';

  @override
  String get onbTariffExBankStatement => 'Банковская справка';

  @override
  String get onbTariffExFlight => 'Перелёт';

  @override
  String get onbTariffExVisaFee => 'Визовый сбор';

  @override
  String get onbTariffExLiving => 'Проживание';

  @override
  String get onbTariffExVisa => 'Виза';

  @override
  String get onbTariffDetailEyebrow => 'Детали тарифа';

  @override
  String get onbTariffPayTitle => 'Когда платить';

  @override
  String get onbTariffPayContract => 'Договор';

  @override
  String get onbTariffPayContractWhen => 'В начале работы';

  @override
  String get onbTariffPayVisa => 'Виза получена';

  @override
  String get onbTariffPayVisaWhen => 'Когда виза у вас на руках';

  @override
  String get onbTariffPayVisaDays =>
      'В течение 7 рабочих дней после получения визы';

  @override
  String get onbTariffPayStart => 'В начале';

  @override
  String get onbTariffPayMonthly => 'Каждый месяц';

  @override
  String onbTariffMln(int n) {
    return '$n млн';
  }

  @override
  String get onbTariffOrOnceStandart => 'Или 5 млн сумов сразу.';

  @override
  String get onbTariffOrOncePremium => 'Или 10 млн сумов сразу.';

  @override
  String get onbTariffOrOnceHanbox => 'Или \$2 000 сразу, или в рассрочку.';

  @override
  String get onbTariffIncludedTitle => 'Что входит';

  @override
  String get onbTariffIncUniChoice => 'Выбор университета';

  @override
  String get onbTariffIncDocsList => 'Список документов и проверка';

  @override
  String get onbTariffIncTranslation => 'Помощь с переводом и апостилем';

  @override
  String get onbTariffIncStudyPlan => 'Учебный план и мотивационное письмо';

  @override
  String get onbTariffIncApply => 'Подача заявления';

  @override
  String get onbTariffIncInterview => 'Подготовка к интервью';

  @override
  String get onbTariffIncVisaDocs => 'Визовые документы';

  @override
  String get onbTariffIncDorm => 'Заселение в общежитие';

  @override
  String get onbTariffIncFirstWeek => 'Помощь в первую неделю в Корее';

  @override
  String get onbTariffIncApplyUpTo3 => 'Подача документов в 3 университета';

  @override
  String get onbTariffIncInterviewQuestions =>
      'Подготовка к собеседованию (даются возможные вопросы)';

  @override
  String get onbTariffIncDocsPrep =>
      'Подготовка документов (перевод, апостиль)';

  @override
  String get onbTariffIncPost => 'Почта';

  @override
  String get onbTariffIncSimBank => 'SIM-карта и банковская карта';

  @override
  String get onbTariffIncInterviewAi =>
      'Подготовка к собеседованию (подготовка с ИИ)';

  @override
  String get onbTariffIncBankShot1Day => 'Банковский счёт (простой, на 1 день)';

  @override
  String get onbTariffIncBankShot1Month => 'Банковский счёт (на 1 месяц)';

  @override
  String get onbTariffIncEmbassyDocs =>
      'Подготовка документов для посольства (перевод, апостиль)';

  @override
  String get onbTariffIncStudyPlanAi =>
      'Помощь в написании учебного плана (подготовка с ИИ)';

  @override
  String get onbTariffIncPickup => 'Встреча в Корее';

  @override
  String get onbTariffIncContractPaid => 'Оплата контракта за счёт компании';

  @override
  String get onbTariffIncFlightTicket => 'Покупка авиабилета';

  @override
  String get onbTariffIncFlatMonth => 'Поиск квартиры и оплата первого месяца';

  @override
  String get onbTariffIncAppFee =>
      'Плата за подачу заявления (Application fee)';

  @override
  String get onbTariffIncHanboxLessons =>
      '1 год живых онлайн-уроков (в приложении Hanguk Academy), группа 11–15 человек, цель — TOPIK 2';

  @override
  String get onbTariffIncHanboxLaptop =>
      'Ноутбук и учебники входят в стоимость';

  @override
  String get onbTariffIncHanboxFirstLesson => 'Первый урок бесплатно';

  @override
  String get onbTariffIncHanboxStandart =>
      'После курса — консалтинг Standart бесплатно (TOPIK 2, посещаемость 80%, полная оплата)';

  @override
  String get onbTariffFaqTitle => 'Вопросы и ответы';

  @override
  String onbTariffMlnSom(int n) {
    return '$n млн сумов';
  }

  @override
  String onbTariffFaqNoVisaQ(String amount) {
    return 'Если виза не выйдет, я плачу $amount?';
  }

  @override
  String onbTariffFaqNoVisaA(String amount) {
    return 'Нет. При оплате в два этапа $amount платится только после получения визы.';
  }

  @override
  String get onbTariffFaqWhenQ => 'Когда вносить платёж после визы?';

  @override
  String get onbTariffFaqWhenA =>
      'В течение 7 рабочих дней после получения визы.';

  @override
  String get onbTariffFaqContractQ => 'Кто оплачивает контракт?';

  @override
  String get onbTariffFaqContractA =>
      'Контракт университета вы оплачиваете сами — он не входит в стоимость тарифа.';

  @override
  String get onbTariffFaqContractANoRisk =>
      'Контракт оплачивает компания — он входит в стоимость NO RISK.';

  @override
  String get onbTariffCta => 'Консультация по этому тарифу';

  @override
  String get onbTariffContractPdf => 'Образец договора (PDF)';

  @override
  String get onbWelcomeTitle =>
      'Учёба в Корее — узнайте свои шансы за 2 минуты';

  @override
  String get onbWelcomeBody =>
      'Честная оценка: без процентов и гарантий — только правила и ваши ответы.';

  @override
  String get onbWelcomeCta => 'Узнать мои шансы';

  @override
  String get onbWelcomeCatalog => 'Смотреть университеты';

  @override
  String get onbWelcomeTrustReply => 'Ответ оператора';

  @override
  String onbWelcomeTrustReplyValue(String minutes) {
    return '≤$minutes мин';
  }

  @override
  String get onbWelcomeClientCode => 'У меня есть код клиента';

  @override
  String get onbQuizContinue => 'Продолжить';

  @override
  String get onbQuizBack => 'Назад';

  @override
  String get onbQuizQ1 => 'Что вы хотите изучать в Корее?';

  @override
  String get onbQuizRouteCourse => 'Языковые курсы — изучать корейский';

  @override
  String get onbQuizRouteBachelor => 'Бакалавриат — университет, 4 года';

  @override
  String get onbQuizRouteMaster => 'Магистратура — после бакалавриата';

  @override
  String get onbQuizRouteCollege =>
      'Профессиональный колледж — профессия за 2–3 года';

  @override
  String onbQuizGradYearOrEarlier(String year) {
    return '$year или раньше';
  }

  @override
  String get onbQuizStillStudying => 'Ещё учусь';

  @override
  String get onbQuizQ3 => 'Какой у вас уровень корейского?';

  @override
  String get onbQuizQ3Hint =>
      'Выберите по официальному сертификату. Без сертификата посольство заявление не принимает.';

  @override
  String get onbQuizKoreanNone => 'Не знаю корейский';

  @override
  String get onbQuizKoreanLearning => 'Учу, сертификата нет';

  @override
  String get onbQuizKoreanTopik1 => 'TOPIK 1 или сертификат Sejong Hakdang';

  @override
  String get onbQuizKoreanTopik2 => 'TOPIK 2';

  @override
  String get onbQuizKoreanTopik3 => 'TOPIK 3';

  @override
  String get onbQuizKoreanUnknown => 'Точно не знаю';

  @override
  String get onbQuizBudgetUnder3 => 'До \$3 000';

  @override
  String get onbQuizBudget3to6 => '\$3 000 – 6 000';

  @override
  String get onbQuizBudget6to10 => '\$6 000 – 10 000';

  @override
  String get onbQuizBudgetOver10 => 'Больше \$10 000';

  @override
  String get onbQuizQ5 => 'Есть ли у ваших родителей официальный доход?';

  @override
  String get onbQuizIncomeYes => 'Да, есть';

  @override
  String get onbQuizIncomeNo => 'Нет';

  @override
  String get onbQuizIntakeSpring2027 => 'Весна 2027 (март)';

  @override
  String get onbQuizIntakeFall2027 => 'Осень 2027 (сентябрь)';

  @override
  String get onbQuizIntakeLater => 'Позже';

  @override
  String get onbContactTitle => 'Подробный план и список университетов';

  @override
  String get onbContactSubtitle =>
      'Оператор изучит ваши ответы и позвонит в течение 10 минут.';

  @override
  String get onbContactAfterHours =>
      'Сейчас нерабочее время. Мы позвоним завтра в 10:00.';

  @override
  String get onbContactName => 'Ваше имя';

  @override
  String get onbContactPhone => 'Телефон';

  @override
  String get onbContactPhoneError => 'Проверьте номер';

  @override
  String get onbContactNameError => 'Введите имя';

  @override
  String get onbContactNetworkError =>
      'Не удалось отправить. Проверьте интернет и попробуйте снова.';

  @override
  String get onbContactTelegram => 'Отправить план и в мой Telegram';

  @override
  String get onbContactCta => 'Пусть оператор позвонит';

  @override
  String get onbContactHours =>
      'Рабочее время Пн–Сб 09:40–18:00. В другое время позвоним на следующий день в 10:00.';

  @override
  String onbContactSuccess(String name) {
    return 'Спасибо, $name! Оператор позвонит в течение 10 минут.';
  }

  @override
  String get onbContactBackToResult => 'Вернуться к результату';

  @override
  String get onbContactAfterHoursToday =>
      'Сейчас нерабочее время. Мы позвоним сегодня в 10:00.';

  @override
  String get onbContactAfterHoursMonday =>
      'Сейчас нерабочее время. Мы позвоним в понедельник в 10:00.';

  @override
  String get onbQuizAgeQ => 'Сколько вам лет?';

  @override
  String get onbQuizGradQ => 'Когда вы окончили последнее место учёбы?';

  @override
  String get onbQuizIeltsQ => 'Есть ли у вас результат IELTS?';

  @override
  String get onbQuizIeltsNone => 'Нет или ниже 5.5';

  @override
  String get onbQuizIelts55 => 'IELTS 5.5';

  @override
  String get onbQuizIelts60 => 'IELTS 6.0';

  @override
  String get onbQuizIelts65 => 'IELTS 6.5 и выше';

  @override
  String get onbQuizIeltsUnknown => 'Точно не знаю';

  @override
  String get onbQuizBudgetQ =>
      'Сколько вы можете тратить в год на учёбу и жизнь?';

  @override
  String get onbQuizPayerQ => 'Кто оплачивает учёбу?';

  @override
  String get onbQuizPayerParentsOption => 'Родители';

  @override
  String get onbQuizPayerSelfOption => 'Я сам(а)';

  @override
  String get onbQuizPayerSponsorOption => 'Спонсор или родственник';

  @override
  String get onbQuizRegionQ => 'В каком регионе вы живёте?';

  @override
  String get onbQuizIntakeQ => 'Когда хотите начать учёбу?';

  @override
  String get onbResultFactorEnglishStrong =>
      'IELTS 5.5 и выше — для программ на английском';

  @override
  String get onbResultPartner => 'Официальный партнёр';

  @override
  String get onbResultLanguageLabel => 'Язык';

  @override
  String get onbQuizKoreanTopik4 => 'TOPIK 4 и выше';

  @override
  String get onbQuizKdbQ => 'Сможете положить депозит на имя студента?';

  @override
  String onbQuizKdbHint(String low, String high, String months) {
    return 'Обязательно для визы: на счёте студента в KDB Bank Uzbekistan $low (другие города) или $high (Сеул, Кёнгидо, Инчхон), не менее $months мес. Это не оплата — деньги остаются на счёте студента.';
  }

  @override
  String get onbQuizKdbReady => 'Да, деньги уже есть';

  @override
  String get onbQuizKdbByIntake => 'Соберём до набора';

  @override
  String get onbQuizKdbNo => 'Нет, не сможем';

  @override
  String get onbQuizKdbUnknown => 'Точно не знаю';

  @override
  String get onbResultFactorKoreanMasterStrong =>
      'TOPIK 4 и выше — требование для магистратуры выполнено';

  @override
  String get onbResultFactorKoreanTopik3Master =>
      'TOPIK 3 — для магистратуры посольство требует TOPIK 4';

  @override
  String get onbResultFactorKoreanMissingMaster =>
      'Для магистратуры посольство требует TOPIK 4';

  @override
  String get onbResultFactorKoreanCollegeMissing =>
      'Для колледжа посольство требует TOPIK 2';

  @override
  String get onbResultFactorKdbReady => 'Депозит KDB на имя студента готов';

  @override
  String get onbResultFactorKdbByIntake =>
      'Депозита KDB пока нет — он нужен до подачи';

  @override
  String get onbResultFactorKdbNo =>
      'Нет депозита KDB — посольство требует его обязательно';

  @override
  String get onbResultFactorBudgetBelowDeposit =>
      'Бюджет меньше суммы депозита KDB';

  @override
  String get onbResultBandLowNoteLanguage =>
      'Языковой сертификат ниже требования посольства — без него заявление отклоняют без собеседования.';

  @override
  String get onbResultBandLowNoteMoney =>
      'Финансовое требование (депозит KDB на имя студента и документы родителей) пока не выполнено.';

  @override
  String get onbQuizQ1Hint =>
      'Результат считается по визовым требованиям этого направления.';

  @override
  String get onbQuizGradHint =>
      'Школа, лицей, колледж или университет — что было последним.';

  @override
  String get onbQuizGradQMaster => 'Когда вы окончили бакалавриат?';

  @override
  String get onbQuizIeltsHint =>
      'Нужен для программ на английском. Только обычный IELTS (не Online), сданный за последние 2 года.';

  @override
  String get onbQuizBudgetHint =>
      'Контракт, общежитие и еда. Достаточно примерной суммы.';

  @override
  String get onbQuizIncomeHint =>
      'Например, справка о зарплате с работы (my.gov.uz) или документы о бизнесе и налогах. Посольство запрашивает документы родителей.';
}
