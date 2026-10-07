// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Korean (`ko`).
class AppLocalizationsKo extends AppLocalizations {
  AppLocalizationsKo([String locale = 'ko']) : super(locale);

  @override
  String get trainingTabTitle => '트레이닝 센터';

  @override
  String get trainingTabSubtitle => 'AI 가이드 트레이닝 모듈로 대학 지원을 준비하세요.';

  @override
  String get studyPlanCardTitle => '학업 계획서 작성기';

  @override
  String get studyPlanCardDesc => '학업 여정을 위한 설득력 있는 로드맵을 작성하세요.';

  @override
  String get personalStatementCardTitle => '자기소개서';

  @override
  String get personalStatementCardDesc => '효과적이고 매력적인 자기소개 에세이를 작성하세요.';

  @override
  String get interviewCardTitle => '면접 준비';

  @override
  String get interviewCardDesc => '모의 질문으로 연습하고 자신감을 키우세요.';

  @override
  String get applyCta => '대학에 지원하기';

  @override
  String get noApplicationsTitle => '아직 지원서가 없습니다';

  @override
  String get noApplicationsBody => '먼저 목표 대학을 추가하세요 — 초안은 목표 학교에서 시작합니다.';

  @override
  String get startInterview => '면접 시작';

  @override
  String get cancel => '취소';

  @override
  String get endInterview => '면접 종료';

  @override
  String get endSession => '세션 종료';

  @override
  String get practiceAgain => '다시 연습하기';

  @override
  String get connecting => '연결 중...';

  @override
  String get greetWait => '연결 중 — 면접관이 곧 인사할 것입니다...';

  @override
  String get yourTurn => '답변할 차례입니다';

  @override
  String get aiSpeaking => '면접관이 말하는 중...';

  @override
  String get wrappingUp => '면접을 마무리하는 중...';

  @override
  String get micRequired => '면접을 위해 마이크 권한이 필요합니다.';

  @override
  String get walkaroundLoadingTitle => '캠퍼스 둘러보기 불러오는 중';

  @override
  String get walkaroundLoadingSubtitle => '캠퍼스 주변 거리뷰를 가져오는 중입니다.';

  @override
  String get walkaroundNoPanoTitle => '이 위치의 거리뷰가 없습니다';

  @override
  String get walkaroundNoPanoSubtitle => '이 캠퍼스 근처에는 걸어볼 수 있는 거리뷰가 없습니다.';

  @override
  String get walkaroundBlockedTitle => '거리뷰를 사용할 수 없습니다';

  @override
  String get walkaroundBlockedSubtitle =>
      '지도 제공자가 요청을 차단했습니다. 다른 네트워크에서 다시 시도해 주세요.';

  @override
  String get walkaroundNetworkTitle => '지도 서비스에 연결할 수 없습니다';

  @override
  String get walkaroundNetworkSubtitle => '연결 상태를 확인하고 다시 시도해 주세요.';

  @override
  String get walkaroundInitErrorTitle => '거리뷰를 시작할 수 없습니다';

  @override
  String get walkaroundInitErrorSubtitle =>
      '둘러보기를 시작하는 중 오류가 발생했습니다. 다시 시도해 주세요.';

  @override
  String get virtualTourTitle => '가상 투어';

  @override
  String get virtualWalkaroundTitle => '가상 캠퍼스 둘러보기';

  @override
  String get visitUniversityWebsite => '대학 웹사이트 방문';

  @override
  String universityTier(int tier) {
    return '티어 $tier';
  }

  @override
  String get universityVerified => '인증됨';

  @override
  String get universityNextEvent => '다음 일정';

  @override
  String get navApplications => '지원서';

  @override
  String get navMap => '지도';

  @override
  String get navDocs => '서류';

  @override
  String get navTraining => '트레이닝';

  @override
  String get applicationsTabTitle => '내 지원서';

  @override
  String get mapTabTitle => '대학교';

  @override
  String get documentsTabTitle => '내 서류';

  @override
  String get documentUploadInfo =>
      '원본 서류의 PDF 또는 JPEG 스캔본을 업로드하세요. 파일당 최대 10MB.';

  @override
  String get documentsRequiredHeading => '필수 서류';

  @override
  String get documentUploadFailed => '문서를 업로드하지 못했습니다. 다시 시도해 주세요.';

  @override
  String get documentPreviewFailed => '문서를 열지 못했습니다. 다시 시도해 주세요.';

  @override
  String get documentLoadError => '문서를 불러오지 못했습니다.';

  @override
  String get commonRetry => '다시 시도';

  @override
  String get onboardingSkip => '건너뛰기';

  @override
  String get onboardingNext => '다음';

  @override
  String get onboardingStart => '시작하기';

  @override
  String get onboardingStep1Title => '지원 현황 추적';

  @override
  String get onboardingStep1Body => '서류부터 합격까지 모든 대학 지원을 한곳에서 관리하세요.';

  @override
  String get onboardingStep2Title => '대학 탐색 및 서류 업로드';

  @override
  String get onboardingStep2Body => '지도에서 대학을 찾고 필요한 서류를 안전하게 업로드하세요.';

  @override
  String get onboardingStep3Title => 'AI로 면접 연습';

  @override
  String get onboardingStep3Body => 'AI 코치와 한국 대학 입학 면접을 연습하고 즉각적인 피드백을 받으세요.';

  @override
  String get appsEmptyTitle => '아직 지원 내역이 없습니다';

  @override
  String get appsEmptyBody => '대학에 지원하면 여기에 표시됩니다.';

  @override
  String get appsLoadError => '지원 내역을 불러오지 못했습니다.';

  @override
  String get appsPendingHeading => '대기 중인 지원';

  @override
  String get appsActiveHeading => '진행 중인 지원';

  @override
  String get searchHint => '검색...';

  @override
  String get clearSearch => '검색 지우기';

  @override
  String get filterAll => '전체';

  @override
  String get filterPartner => '파트너';

  @override
  String get filterTop => '상위';

  @override
  String get noUniversitiesMatch => '이 필터에 맞는 대학이 없습니다';

  @override
  String get clearFilters => '필터 지우기';

  @override
  String get universitiesLoadError => '대학을 불러오지 못했습니다';

  @override
  String get checkConnectionRetry => '연결을 확인하고 다시 시도하세요';

  @override
  String get switchToListView => '목록 보기로 전환';

  @override
  String get switchToMapView => '지도 보기로 전환';

  @override
  String get chatInputHint => '한국에 대해 무엇이든 물어보세요...';

  @override
  String get accountTooltip => '계정';

  @override
  String get ok => '확인';

  @override
  String get loadingLabel => '로딩 중...';

  @override
  String get accountBackTooltip => '뒤로';

  @override
  String get accountTitle => '계정';

  @override
  String get accountSignedInAs => '로그인 계정';

  @override
  String get accountUnknownAccount => '(알 수 없는 계정)';

  @override
  String get accountSessionLabel => '세션';

  @override
  String get accountSigningOut => '로그아웃 중...';

  @override
  String get accountSignOut => '로그아웃';

  @override
  String get accountYourDataLabel => '내 데이터';

  @override
  String get accountYourDataBody =>
      'Hanguk이 보관 중인 계정 데이터(프로필, 지원서, 학습 계획, 초안, 모의 면접 세션 및 피드백)의 JSON 사본을 다운로드합니다.';

  @override
  String get accountPreparingExport => '내보내기 준비 중...';

  @override
  String get accountDownloadMyData => '내 데이터 다운로드';

  @override
  String get accountDangerZoneLabel => '위험 구역';

  @override
  String get accountDangerZoneBody =>
      '계정 삭제는 영구적입니다. 프로필, 지원서, 학습 계획, 자기소개서 초안, 모의 면접 세션 및 기록이 모두 삭제됩니다. 저장된 문서는 30일 이내, 백업본은 90일 이내에 만료됩니다.';

  @override
  String get accountDeleteAccount => '계정 삭제';

  @override
  String get accountPrivacyPolicy => '개인정보처리방침';

  @override
  String get accountTermsOfService => '이용약관';

  @override
  String get accountDeleteErrorTitle => '계정을 삭제할 수 없습니다';

  @override
  String accountDeleteErrorBody(Object error) {
    return '데이터 삭제 중 오류가 발생했습니다:\n\n$error\n\n삭제를 완료할 수 있도록 privacy@hanguk.uz로 이메일을 보내주세요.';
  }

  @override
  String accountExportFailed(Object error) {
    return '내보내기 실패: $error';
  }

  @override
  String get accountDeleteDialogTitle => '계정을 삭제하시겠습니까?';

  @override
  String get accountDeleteDialogBody =>
      '계정, 지원서, 학습 계획, 자기소개서 초안, 모의 면접 세션 및 기록이 영구적으로 삭제됩니다.\n\n계속하려면 DELETE를 입력하세요.';

  @override
  String get accountDeleteDialogConfirm => '영구 삭제';

  @override
  String get accountDeleteProgress => '계정 삭제 중...';

  @override
  String get loginStudentPortal => '학생 포털';

  @override
  String get loginAccessCodeHelp => '컨설턴트 또는 대학 담당자에게 받은 8자리 코드를 입력하세요.';

  @override
  String get loginAccessCodeButton => '액세스 코드로 로그인';

  @override
  String get loginSwitchToPhone => '← 전화번호로 로그인할게요';

  @override
  String get loginComingSoonTitle => '출시 예정';

  @override
  String get loginComingSoonBody =>
      '시스템 업그레이드 작업 중이라 공개 회원가입과 전화 로그인이 일시 중단되었습니다.\n\n학생 여러분: 당분간 매직 액세스 코드로 로그인해 주세요.';

  @override
  String get loginSwitchToMagicCode => '매직 코드 로그인으로 전환';

  @override
  String get loginErrorInvalidPhone => '유효한 전화번호를 입력해 주세요 (예: +12345678).';

  @override
  String get loginErrorPasswordTooShort => '비밀번호는 6자 이상이어야 합니다.';

  @override
  String get loginErrorInvalidCredentials => '전화번호 또는 비밀번호가 올바르지 않습니다.';

  @override
  String get loginErrorInvalidAccessCode => '유효한 액세스 코드를 입력해 주세요 (최소 6자).';

  @override
  String get signUpErrorNameRequired => '이름을 입력해 주세요.';

  @override
  String get signUpErrorPhoneRequired => '유효한 전화번호가 필요합니다 (예: +12345678).';

  @override
  String get signUpErrorPasswordMismatch => '비밀번호가 일치하지 않습니다.';

  @override
  String get signUpSuccess => '계정이 생성되었습니다. 로그인해 주세요.';

  @override
  String get notifSettingsTitle => '알림 설정';

  @override
  String get notifSettingsEmptyTitle => '추적 중인 대학이 없습니다';

  @override
  String get notifSettingsEmptyBody =>
      '대학 페이지에서 \"이 학교 추적\"을 탭하여 팔로우하세요. 추적 중인 학교가 하나 이상 생기면 알림 설정이 여기에 표시됩니다.';

  @override
  String get notifSettingsCalendar => '일정 변경';

  @override
  String get notifSettingsCalendarDesc => '마감일이 변경될 때';

  @override
  String get notifSettingsCorrection => '정정공고';

  @override
  String get notifSettingsCorrectionDesc => '정정공고 게시 — 최우선 알림';

  @override
  String get notifSettingsRequirement => '지원 요건 변경';

  @override
  String get notifSettingsRequirementDesc => 'TOPIK / 학점 / 어학 시험 규정 변경';

  @override
  String get notifSettingsScholarship => '장학금 업데이트';

  @override
  String get notifSettingsScholarshipDesc => '기본값 꺼짐 — 알림이 많을 수 있음';

  @override
  String notifSettingsLoadError(Object error) {
    return '오류: $error';
  }

  @override
  String notifSettingsPushLanguage(String lang) {
    return '푸시 알림 언어: $lang';
  }

  @override
  String notifSettingsUpdateError(Object error) {
    return '설정을 업데이트하지 못했습니다: $error';
  }

  @override
  String get interviewDialogStepUniversity => '1. 대상 대학 선택';

  @override
  String get interviewDialogStepTrack => '2. 면접 트랙 선택';

  @override
  String get interviewDialogStepPersona => '3. 면접관 성격';

  @override
  String get interviewNoAppsBody => '먼저 목표 대학을 추가하세요 — 면접 연습은 그 학교에 맞춰 진행됩니다.';

  @override
  String get trackKorean => '한국어';

  @override
  String get trackEnglish => '영어';

  @override
  String get personaFriendly => '친절한 입학사정관';

  @override
  String get personaStrict => '엄격한 교수';

  @override
  String get personaImpatient => '성격 급한 비자 담당관';

  @override
  String get personaFriendlyCaps => '친절한 입학사정관';

  @override
  String get personaStrictCaps => '엄격한 교수';

  @override
  String get personaImpatientCaps => '성격 급한 비자 담당관';

  @override
  String get micBlockedInSettings => '시스템 설정에서 마이크가 차단되었습니다.';

  @override
  String get openSettings => '설정 열기';

  @override
  String genericError(Object error) {
    return '오류: $error';
  }

  @override
  String errorLoadingApplications(Object error) {
    return '지원서를 불러오지 못했습니다: $error';
  }

  @override
  String get noAppsInlineHint => '아직 지원서가 없습니다 — 지원서 탭에서 추가하세요.';

  @override
  String get aiStatusWaiting => '입력 대기 중...';

  @override
  String get aiStatusCoolingDown => 'AI 잠시 대기 중…';

  @override
  String get aiStatusAnalyzing => 'AI 분석 중...';

  @override
  String get aiStatusReady => '준비 완료';

  @override
  String get aiStatusPredicting => 'AI 예측 중...';

  @override
  String get aiStatusSupervisionActive => 'AI 검토 활성화';

  @override
  String get aiStatusSpellCheckUnavailable => '기기 사전을 사용할 수 없음';

  @override
  String get workspaceTitle => '작업 공간';

  @override
  String get workspaceAnalyzeButton => '분석';

  @override
  String get aiSupervisionWarningsTitle => 'AI 검토 경고:';

  @override
  String grammarReplaceWith(String original, String suggestion) {
    return '\"$original\"을(를) \"$suggestion\"(으)로 교체';
  }

  @override
  String draftingHint(String documentTitle) {
    return '$documentTitle을(를) 여기에 입력하세요...';
  }

  @override
  String get ghostSuggestionSemantics => 'AI 제안 — 탭하여 삽입';

  @override
  String get ghostAccept => '사용';

  @override
  String get ghostDismiss => '제안 닫기';

  @override
  String get pastDraftsTooltip => '이전 초안';

  @override
  String get sessionSettingsTooltip => '세션 설정';

  @override
  String get switchTrackEnglish => '트랙 전환 → 영어';

  @override
  String get switchTrackKorean => '트랙 전환 → 한국어';

  @override
  String get createNewSession => '새 세션 만들기';

  @override
  String get yourSavedDrafts => '저장된 초안';

  @override
  String get noPreviousDrafts => '이전 초안이 없습니다.';

  @override
  String get generalDraftLabel => '일반';

  @override
  String get studyPlanDocumentName => '학업 계획서';

  @override
  String get personalStatementDocumentName => '자기소개서';

  @override
  String savedDraftItemTitle(String universityName, String documentName) {
    return '$universityName $documentName';
  }

  @override
  String sessionStatusLabel(String status) {
    return '상태: $status';
  }

  @override
  String get deleteSessionTitle => '세션 삭제';

  @override
  String get deleteSessionBody => '이 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.';

  @override
  String get deleteLabel => '삭제';

  @override
  String get stepperLabelGuide => '가이드';

  @override
  String get stepperLabelExample => '예시';

  @override
  String get stepperLabelDraft => '초안';

  @override
  String get stepperLabelFeedback => '피드백';

  @override
  String get readExamplesButton => '예시 보기';

  @override
  String get targetUniversityLabel => '대상 대학';

  @override
  String get startDraftingButton => '초안 작성 시작';

  @override
  String get newStudyPlanDialogTitle => '새 학업 계획서 시작';

  @override
  String get newPersonalStatementDialogTitle => '새 자기소개서 시작';

  @override
  String get selectTargetUniversityStep => '1. 대상 대학 선택';

  @override
  String get selectLanguageTrackStep => '2. 작성 언어 선택';

  @override
  String get createSession => '세션 만들기';

  @override
  String get aiExampleEmbassyTitle => '대사관 예시';

  @override
  String aiExampleUniversityTitle(String universityName) {
    return '$universityName 예시';
  }

  @override
  String get aiExampleEmbassyLabel => '주한 대한민국 대사관 (비자)';

  @override
  String get aiExampleWritingPlaceholder => 'AI가 예시를 작성 중입니다...';

  @override
  String get copyButton => '복사';

  @override
  String get copiedSnackbar => '텍스트가 복사되었습니다!';

  @override
  String get analysisFeedbackTitle => '분석 및 피드백';

  @override
  String get noAnalysisYet => '아직 생성된 분석이 없습니다.';

  @override
  String get analysisErrorPlanRequired =>
      '분석은 Premium 및 No Risk 플랜에 포함됩니다. 현재 플랜에는 포함되어 있지 않습니다.';

  @override
  String get analysisErrorRateLimited => '분석 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';

  @override
  String get analysisErrorServiceDown =>
      '분석 서비스를 일시적으로 사용할 수 없습니다. 초안은 저장되었습니다 — 잠시 후 다시 시도해 주세요.';

  @override
  String get analysisErrorFailed =>
      '분석을 완료할 수 없습니다. 초안은 저장되었습니다 — 연결을 확인한 후 다시 시도해 주세요.';

  @override
  String get analysisRetryButton => '다시 시도';

  @override
  String get aiReviewedDraft => 'AI가 초안을 검토했습니다.';

  @override
  String get returnToDrafting => '초안으로 돌아가기';

  @override
  String get studyPlanHistoryTitle => '학업 계획서 기록';

  @override
  String get personalStatementHistoryTitle => '자기소개서 기록';

  @override
  String get draftingHistoryTitle => '초안 기록';

  @override
  String get noPastDraftsYet => '아직 저장된 초안이 없습니다';

  @override
  String get noPastDraftsBody => '새 세션을 시작하면 가장 최근 편집된 순으로 초안이 여기에 표시됩니다.';

  @override
  String get noTargetUniversity => '대상 대학 없음';

  @override
  String sessionStepLabel(int step) {
    return '단계 $step';
  }

  @override
  String get metricWords => '단어';

  @override
  String get metricCharacters => '글자';

  @override
  String get saveStatusUnsaved => '저장 안 됨';

  @override
  String get saveStatusSaving => '저장 중...';

  @override
  String get saveStatusSaved => '저장됨';

  @override
  String get saveStatusError => '저장 실패';

  @override
  String get interviewPracticeTitle => '면접 연습';

  @override
  String get interviewSettingUp => '면접을 준비하는 중...';

  @override
  String get interviewSetupTitle => 'AI 면접 설정';

  @override
  String get interviewSetupSubtitle => '면접을 시작하기 전 AI 면접관 설정을 확인하세요.';

  @override
  String get interviewTypeLabel => '면접 유형';

  @override
  String get interviewTypeGeneral => '일반 자기소개';

  @override
  String get interviewTypeUniversitySpecific => '대학 맞춤형';

  @override
  String get interviewTypeVisa => '비자 / 대사관 점검';

  @override
  String get targetUniversityFieldLabel => '대상 대학';

  @override
  String get languageLabel => '언어';

  @override
  String get interviewerPersonaLabel => '면접관 성격';

  @override
  String get focusTopicLabel => '집중 주제 (선택)';

  @override
  String get focusTopicHint => '예) 컴퓨터공학 전공에 대해 이야기하기...';

  @override
  String get timedModeTitle => '시간 제한 모드';

  @override
  String get timedModeSubtitle => '5분 엄격 제한';

  @override
  String get startPracticeButton => '연습 시작';

  @override
  String get pickUniversityFirstHint => '위에서 대상 대학을 먼저 선택하세요.';

  @override
  String get coachingFiller => '추임새를 자제하세요!';

  @override
  String get lifelineHintsTitle => '💡 도움 힌트:';

  @override
  String get speakerAi => 'AI';

  @override
  String get speakerYou => '본인';

  @override
  String connectionInterrupted(String detail) {
    return '연결이 중단되었습니다: $detail';
  }

  @override
  String get interviewAnalyticsTitle => '면접 분석';

  @override
  String get analyzingTranscript => 'AI가 대화 기록을 분석하는 중...';

  @override
  String get noFeedbackAvailable => '피드백을 사용할 수 없습니다.';

  @override
  String get overallScoreLabel => '총점';

  @override
  String get metricCommunication => '의사소통';

  @override
  String get metricConfidence => '자신감';

  @override
  String get metricContent => '내용';

  @override
  String get metricLanguage => '언어';

  @override
  String get detailedFeedbackTitle => '상세 피드백';

  @override
  String get detailedFeedbackFallback => '잘하셨습니다.';

  @override
  String get strengthsLabel => '강점';

  @override
  String get areasToImproveLabel => '개선할 점';

  @override
  String get startAnotherInterview => '다른 면접 시작';

  @override
  String get sessionRecording => '세션 녹음';

  @override
  String get audioRecordingNotFound => '오디오 녹음을 찾을 수 없습니다.';

  @override
  String get interviewHistoryTitle => '면접 기록';

  @override
  String get noPastInterviews => '지난 면접 기록이 없습니다.';

  @override
  String get unknownTarget => '알 수 없는 대상';

  @override
  String get unknownUniversity => '알 수 없는 대학';

  @override
  String get abandonedSessionNote => '이 세션은 피드백 없이 종료되었습니다 — 재생할 수 없습니다.';

  @override
  String get activeSessionNote => '이 세션은 아직 진행 중입니다. 끝낸 후 피드백을 확인하세요.';

  @override
  String get deleteSessionTooltip => '세션 삭제';

  @override
  String get deleteInterviewDialogTitle => '이 세션을 삭제하시겠습니까?';

  @override
  String get deleteInterviewDialogBody => '피드백과 녹음 링크가 영구적으로 삭제됩니다.';

  @override
  String deleteFailed(Object error) {
    return '삭제 실패: $error';
  }

  @override
  String get a11yTooltipAskAi => 'Hanguk AI에 질문하기';

  @override
  String get a11yTooltipClearChat => '채팅 기록 지우기';

  @override
  String get a11yTooltipSendMessage => '메시지 보내기';

  @override
  String get a11yTooltipClose => '닫기';

  @override
  String get a11yTooltipPreviewDocument => '문서 미리보기';

  @override
  String get a11yTooltipDeleteDocument => '문서 삭제';

  @override
  String get a11yTooltipInterviewHistory => '면접 기록';

  @override
  String get a11yTooltipCloseSession => '세션 닫기';

  @override
  String get a11yTooltipDeleteSession => '세션 삭제';

  @override
  String get a11yTooltipBack => '뒤로';

  @override
  String get a11yTooltipPlayRecording => '녹음 재생';

  @override
  String get a11yTooltipPauseRecording => '녹음 일시정지';

  @override
  String get trackMismatchWarning =>
      '작성 중인 초안의 언어가 선택한 트랙과 다릅니다. 선택한 언어로 다시 작성해 주세요.';

  @override
  String get interviewStartError => '면접을 시작할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';

  @override
  String get perAnswerReviewTitle => '답변별 분석';

  @override
  String get betterAnswerLabel => '더 좋은 답변 예시';

  @override
  String get navHome => '홈';

  @override
  String get navMenu => '메뉴';

  @override
  String get greetingMorning => '좋은 아침';

  @override
  String get greetingAfternoon => '좋은 오후';

  @override
  String get greetingEvening => '좋은 저녁';

  @override
  String get welcomeHeadline => '당신의 여정을 환영합니다';

  @override
  String get welcomeSubtitle => '한국 대학으로 가는 길이 여기서 시작됩니다.';

  @override
  String get welcomeMagicCodeCta => '매직 코드가 있어요';

  @override
  String get welcomeExploreCta => '대학 둘러보기';

  @override
  String get magicCodeTitle => '매직 코드';

  @override
  String get homeJourneyEyebrow => '나의 여정';

  @override
  String get homeContinueJourney => '여정 계속하기';

  @override
  String get homeViewAll => '전체 보기';

  @override
  String documentsCollected(int collected, int total) {
    return '$total개 중 $collected개 완료';
  }

  @override
  String get documentActionUpload => '업로드';

  @override
  String get documentStatusApproved => '승인됨';

  @override
  String get documentStatusPendingReview => '검토 대기';

  @override
  String get statusDocs => '서류';

  @override
  String get statusSubmitted => '제출됨';

  @override
  String get statusInReview => '심사 중';

  @override
  String get statusWaiting => '대기 중';

  @override
  String get statusRejected => '불합격';

  @override
  String get journeyStageDocumentPrep => '서류 준비';

  @override
  String get journeyStageOnlineApplication => '온라인 지원';

  @override
  String get journeyStageOfflineApplication => '오프라인 지원';

  @override
  String get journeyStageInterview => '면접';

  @override
  String get journeyStageWaitingInvoice => '청구서 대기';

  @override
  String get journeyStageTuitionPayment => '등록금 납부';

  @override
  String get journeyStageWaitingAdmission => '입학허가서 대기';

  @override
  String get journeyStageVisaPreparation => '비자 준비';

  @override
  String get journeyStageWaitingVisa => '비자 발급 대기';

  @override
  String mapUniversitiesMapped(int count) {
    return '$count개 대학 표시됨';
  }

  @override
  String get updateAvailableTitle => '업데이트 가능';

  @override
  String updateVersionReady(String version) {
    return '$version 버전을 설치할 수 있습니다.';
  }

  @override
  String updateSizeMb(String size) {
    return '크기: $size MB';
  }

  @override
  String get updateSigningKeyWarning =>
      '이 업데이트는 앱 서명 키를 변경합니다. 설치 후 매직 코드로 다시 로그인해야 합니다.';

  @override
  String get updateNow => '지금 업데이트';

  @override
  String get updateLater => '나중에';

  @override
  String get updateDownloadingTitle => '업데이트 다운로드 중';

  @override
  String updateDownloadProgress(String downloaded, String total) {
    return '$downloaded MB / $total MB';
  }

  @override
  String get updateInstallingLabel => '확인 및 설치 중…';

  @override
  String get updateFailedTitle => '업데이트 실패';

  @override
  String get updateErrorNetwork =>
      '업데이트를 다운로드할 수 없습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.';

  @override
  String get updateErrorHashMismatch =>
      '다운로드한 파일이 무결성 검증을 통과하지 못했습니다. 다시 시도해 주세요. 문제가 반복되면 상담사에게 문의하세요.';

  @override
  String get updateErrorInstallDenied =>
      '기기에서 설치가 차단되었습니다. 휴대폰 설정에서 Hanguk의 \"알 수 없는 앱 설치\" 권한을 허용한 후 다시 시도해 주세요.';

  @override
  String get updateErrorStorage =>
      '업데이트를 다운로드할 저장 공간이 부족합니다. 공간을 확보한 후 다시 시도해 주세요.';

  @override
  String get updateErrorUnsupportedPlatform => '이 플랫폼에서는 아직 업데이트를 사용할 수 없습니다.';

  @override
  String get updateErrorUnknown => '업데이트에 실패했습니다. 다시 시도하거나 상담사에게 문의해 주세요.';

  @override
  String get guestModeEyebrow => '게스트 탐색';

  @override
  String get guestJoinCta => 'Hanguk 가입';

  @override
  String get guestExploreTitle => '나의 대학 찾기';

  @override
  String guestUniversitiesCount(int count) {
    return '대학 $count곳';
  }

  @override
  String get guestNavExplore => '탐색';

  @override
  String get guestNavCompare => '비교';

  @override
  String guestCompareCount(int count) {
    return '비교 $count/2';
  }

  @override
  String get guestCompareEmptySlot => '탐색에서 추가';

  @override
  String get guestCompareApplyCta => 'Hanguk과 함께 지원';

  @override
  String get guestCompareReassurance => '매직 코드를 받으면 서류부터 비자까지 저희 팀이 안내합니다.';

  @override
  String get guestRowCity => '도시';

  @override
  String get guestRowTier => '등급';

  @override
  String get guestRowIeqas => 'IEQAS 상태';

  @override
  String get ieqasOutstanding => 'IEQAS 우수';

  @override
  String get ieqasAccredited => 'IEQAS 인증';

  @override
  String get guestRowPartner => 'Hanguk 파트너';

  @override
  String get guestRowNextEvent => '다음 일정';

  @override
  String get guestRowWebsite => '웹사이트';

  @override
  String get guestRowTuition => '등록금';

  @override
  String get guestRowApplication => '원서접수';

  @override
  String get guestRowDocDeadline => '서류 마감';

  @override
  String get guestRowTopik => 'TOPIK';

  @override
  String get guestRowEnglish => '영어';

  @override
  String get guestRowInterview => '면접';

  @override
  String get guestRowDocuments => '제출서류';

  @override
  String guestTuitionYearNote(int year) {
    return '$year년 기준';
  }

  @override
  String guestDocumentsCount(int count) {
    return '$count종';
  }

  @override
  String get guestApostilleShort => '아포스티유 필요';

  @override
  String get guestValueYes => '예';

  @override
  String get guestValueNo => '아니요';

  @override
  String get roomTabStatus => '현황';

  @override
  String get roomTabDiscussion => '토론';

  @override
  String get roomTabNews => '소식';

  @override
  String get roomTabCalendar => '일정';

  @override
  String get roomApplicationProgress => '지원 진행 상황';

  @override
  String get roomChatEmpty => '아직 메시지가 없습니다. 대화를 시작해 보세요!';

  @override
  String get roomChatHint => '메시지를 입력하세요...';

  @override
  String get roomChatSenderFallback => '사용자';

  @override
  String get roomNewsEmpty => '현재 공지사항이 없습니다.';

  @override
  String get roomEventsEmpty => '이 날짜에 표시할 일정이 없습니다.';

  @override
  String get uniDbPhaseBadge => '대학 DB · 0단계 준비됨';

  @override
  String get uniDbRecentChangesTitle => '추적 중인 대학의 업데이트';

  @override
  String get timeJustNow => '방금 전';

  @override
  String timeMinutesAgo(int minutes) {
    return '$minutes분 전';
  }

  @override
  String timeHoursAgo(int hours) {
    return '$hours시간 전';
  }

  @override
  String timeDaysAgo(int days) {
    return '$days일 전';
  }

  @override
  String get uniDbVerifiedDeadlinesTitle => '확인된 예정 마감일';

  @override
  String get deadlineClosed => '마감됨';

  @override
  String deadlineInDays(int days) {
    return '$days일 후';
  }

  @override
  String deadlineInHours(int hours) {
    return '$hours시간 후';
  }

  @override
  String deadlineInMinutes(int minutes) {
    return '$minutes분 후';
  }

  @override
  String get eventApplyOpen => '원서 접수 시작';

  @override
  String get eventApplyClose => '원서 접수 마감';

  @override
  String get eventDocumentsDue => '서류 제출 마감';

  @override
  String get eventFirstStageResults => '1단계 발표';

  @override
  String get eventInterviewLabel => '면접';

  @override
  String get eventPracticalExam => '실기 시험';

  @override
  String get eventFinalResults => '최종 발표';

  @override
  String get eventAdditionalAdmit => '추가 합격';

  @override
  String get eventRegistrationOpen => '등록 시작';

  @override
  String get eventRegistrationClose => '등록 마감';

  @override
  String get cycleForeign => '외국인 전형';

  @override
  String get cycleOverseasKoreanFull => '재외국민 (전 과정)';

  @override
  String get cycleOverseasKoreanPartial => '재외국민 (일부 과정)';

  @override
  String get cycleSusi => '수시';

  @override
  String get cycleJeongsi => '정시';

  @override
  String get cycleTransfer => '편입';

  @override
  String get cycleGradGeneral => '대학원';

  @override
  String get cycleGradForeign => '대학원 (외국인)';

  @override
  String get uniSpecificHeader => '대학 맞춤 면접';

  @override
  String get uniSpecificPickPrompt =>
      '위에서 대학을 선택하면 해당 대학의 모집단위, 지원 요건, 주요 일정이 면접에 반영됩니다.';

  @override
  String uniSpecificLoadError(Object error) {
    return '모집 정보를 불러오지 못했습니다: $error\n일반 면접은 계속 진행할 수 있습니다.';
  }

  @override
  String get uniSpecificNoData =>
      '이 대학의 검증된 모집 정보가 아직 없습니다. 모집요강을 수집할 때까지 일반 질문으로 진행됩니다.';

  @override
  String get uniSpecificFallbackButton => '일반 면접으로 진행하기';

  @override
  String uniSpecificTrackLabel(String category) {
    return '전형: $category';
  }

  @override
  String get uniSpecificSeedNote => '면접 질문에 이 모집 정보가 반영됩니다.';

  @override
  String get uniSpecificRecruitmentUnitFallback => '모집단위';

  @override
  String get uniDbInstitutionTitle => '대학';

  @override
  String get uniDbNotFoundTitle => '대학을 찾을 수 없습니다';

  @override
  String get uniDbNotFoundBody => '이 대학은 아직 카탈로그에 없습니다. 나중에 다시 확인해 주세요.';

  @override
  String get uniDbUpcomingDeadlines => '다가오는 마감일';

  @override
  String get uniDbNoDeadlines => '아직 발표된 마감일이 없습니다.';

  @override
  String get uniDbTuitionHeading => '등록금';

  @override
  String get uniDbTuitionEmpty => '등록금 정보가 아직 없습니다.';

  @override
  String get uniDbRequirementsHeading => '지원 자격';

  @override
  String get uniDbRequirementsEmpty => '입학 요건 정보가 아직 없습니다.';

  @override
  String get uniDbScholarshipsHeading => '장학금';

  @override
  String get uniDbScholarshipsEmpty => '이 대학의 장학금 정보가 아직 없습니다.';

  @override
  String get uniDbDocumentChecklistHeading => '제출 서류';

  @override
  String get uniDbDocumentsEmpty => '서류 목록이 아직 없습니다.';

  @override
  String get uniDbTrackTitle => '이 대학 팔로우';

  @override
  String get uniDbTrackOnDesc => '홈 배너에서 마감일을 확인하고 변경 시 푸시 알림을 받습니다.';

  @override
  String get uniDbTrackOffDesc => '마감일, 정정공고, 요건 변경을 팔로우하려면 켜세요.';

  @override
  String uniDbTrackError(Object error) {
    return '팔로우 설정을 변경하지 못했습니다: $error';
  }

  @override
  String get uniDbOpenGuidePdf => '모집요강 PDF 열기';

  @override
  String get uniDbNoGuidePdf => '모집요강 PDF가 아직 없습니다.';

  @override
  String get uniDbPdfNoApp => 'PDF를 열 수 없습니다 — 처리할 앱이 없습니다.';

  @override
  String uniDbPdfError(Object error) {
    return 'PDF를 열 수 없습니다: $error';
  }

  @override
  String uniDbAcademicYear(int year) {
    return '$year학년도';
  }

  @override
  String uniDbSemesterLabel(int number) {
    return '$number학기';
  }

  @override
  String get uniDbFirstSemester => '첫 학기';

  @override
  String uniDbAdmissionFee(String amount) {
    return '+ 입학금 $amount';
  }

  @override
  String uniDbGpaChip(String pct) {
    return 'GPA ≥ $pct%';
  }

  @override
  String get uniDbTopikTierTable => 'TOPIK 등급표';

  @override
  String uniDbDocumentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '서류 $count건',
    );
    return '$_temp0';
  }

  @override
  String get uniDbApostilleRequired => '아포스티유 필요';

  @override
  String uniDbLastVerified(String date) {
    return '최종 확인: $date';
  }

  @override
  String get eventOrientation => '오리엔테이션';

  @override
  String get eventSemesterStart => '개강';

  @override
  String get facultyHumanities => '인문계열';

  @override
  String get facultySocialScience => '사회계열';

  @override
  String get facultyNaturalScience => '자연계열';

  @override
  String get facultyEngineering => '공학계열';

  @override
  String get facultyMedical => '의약계열';

  @override
  String get facultyArts => '예술계열';

  @override
  String get facultyPhysicalEducation => '체육계열';

  @override
  String get uniDbCompareTitle => '비교';

  @override
  String get uniDbCompareEmptyTitle => '대학 비교';

  @override
  String get uniDbCompareEmptyBody => '두 개 이상의 대학을 팔로우한 뒤 여기에서 비교하세요.';

  @override
  String get uniDbCompareNeedSecond => '비교하려면 두 번째 대학이 필요합니다.';

  @override
  String uniDbCompareSelected(String name) {
    return '현재 선택: $name';
  }

  @override
  String get uniDbColEnglishName => '영문 이름';

  @override
  String get uniDbColUzbekName => '우즈베크어 이름';

  @override
  String get uniDbColLastVerified => '최종 확인';

  @override
  String get uniDbTrackerTitle => '지원 현황 트래커';

  @override
  String get uniDbTrackerEmptyTitle => '팔로우한 대학이 아직 없습니다';

  @override
  String get uniDbTrackerEmptyBody => '대학 페이지에서 팔로우하면 마감일이 여기에 표시됩니다.';

  @override
  String get uniDbLoadFailed => '대학 목록을 불러오지 못했습니다.';

  @override
  String get loginSubmitButton => '로그인';

  @override
  String get welcomeGuestCaption => '둘러보고 비교하는 데 코드가 필요 없어요.';

  @override
  String get welcomeClientsDivider => 'Hanguk 고객';

  @override
  String get loginNoCodePrompt => '코드가 없나요?';

  @override
  String get loginAskConsultant => '컨설턴트에게 문의하세요';

  @override
  String get homeNotifications => '알림';

  @override
  String get notifApplicationUpdates => '지원 현황';

  @override
  String get notifToUpload => '업로드 필요';

  @override
  String get notifAllCaughtUp => '모두 완료';

  @override
  String get notifAllCaughtUpBody => '서류와 지원에 대한 알림이 여기에 표시됩니다.';

  @override
  String get guestContactEyebrow => 'Hanguk Consulting';

  @override
  String get guestContactTitle => '문의하기';

  @override
  String get guestContactSubtitle => '편한 채널을 선택하세요 — 모두 답변드립니다.';

  @override
  String get guestContactTelegramChannel => '텔레그램 채널';

  @override
  String get guestContactTelegramChannelHint => '소식, 마감일, 모집 정보';

  @override
  String get guestContactTelegramDirect => '텔레그램으로 문의';

  @override
  String get guestContactTelegramDirectHint => '상담사에게 바로 물어보세요';

  @override
  String get guestContactInstagram => '인스타그램';

  @override
  String get guestContactInstagramHint => '학생, 캠퍼스, 일상';

  @override
  String get guestContactCall => '전화하기';

  @override
  String get guestContactJoinHint => '매직 코드가 있으신가요?';

  @override
  String get guestContactLaunchFailed => '이 링크를 열 수 없습니다.';

  @override
  String get guestContactCta => '문의하기';

  @override
  String get aiReportAction => '신고';

  @override
  String get aiReportTitle => '이 답변 신고';

  @override
  String get aiReportBody => '이 AI 답변의 어떤 점이 문제인지 알려주세요. 저희 팀이 모든 신고를 검토합니다.';

  @override
  String get aiReportReasonHint => '무엇이 문제인가요? (선택)';

  @override
  String get aiReportSubmit => '신고 보내기';

  @override
  String get aiReportThanks => '감사합니다. 저희 팀이 이 답변을 검토하겠습니다.';

  @override
  String get aiReportFailed => '신고를 보내지 못했습니다. 다시 시도해 주세요.';

  @override
  String get catalogSearchHint => '대학 이름 검색';

  @override
  String get catalogListTitle => '대학교';

  @override
  String catalogCityUniversities(String city) {
    return '$city 대학교';
  }

  @override
  String get catalogEmptyTitle => '대학을 찾을 수 없습니다';

  @override
  String get catalogEmptyBody => '다른 도시나 필터를 선택해 보세요.';

  @override
  String get catalogTypeState => '국공립 대학';

  @override
  String get catalogTypePrivate => '사립 대학';

  @override
  String get catalogTypeSpecialized => '특수 대학';

  @override
  String get catalogTypeStateShort => '국공립';

  @override
  String get catalogTypePrivateShort => '사립';

  @override
  String get catalogTypeSpecializedShort => '특수';

  @override
  String get catalogFilterTitle => '필터';

  @override
  String get catalogFilterClear => '초기화';

  @override
  String get catalogFilterCity => '도시';

  @override
  String catalogFilterCityPicked(int count) {
    return '$count개 선택';
  }

  @override
  String get catalogFilterDegree => '과정';

  @override
  String get catalogDegreeBachelor => '학사';

  @override
  String get catalogDegreeMaster => '석사';

  @override
  String get catalogFilterEnglish => '영어 요건';

  @override
  String get catalogFilterEnglishHint => '내 IELTS 점수';

  @override
  String get catalogIeltsNone => '필요 없음';

  @override
  String get catalogIeltsNoteAll => '모든 과정 (한국어·영어)';

  @override
  String catalogIeltsNote(String score) {
    return 'IELTS $score(으)로 지원 가능한 영어 과정만';
  }

  @override
  String get catalogFilterPrice => '등록금';

  @override
  String get catalogPricePerSemester => '학기당';

  @override
  String get catalogPriceFrom => '최소';

  @override
  String get catalogPriceTo => '최대';

  @override
  String catalogPriceUpTo(String amount) {
    return '$amount 이하';
  }

  @override
  String catalogApply(int count) {
    return '대학 $count곳 보기';
  }

  @override
  String get catalogFaculties => '단과대학';

  @override
  String catalogFacultyCount(int count) {
    return '단과대학 $count개';
  }

  @override
  String catalogProgramCount(int count) {
    return '전공 $count개';
  }

  @override
  String catalogTuitionTitle(String name) {
    return '등록금 · $name';
  }

  @override
  String get catalogPerSemester => '/ 학기';

  @override
  String get catalogPerYear => '/ 년';

  @override
  String get catalogSemSuffix => '/학기';

  @override
  String get catalogYearSuffix => '/년';

  @override
  String get catalogYearlyTuition => '연간 등록금';

  @override
  String get catalogApplicationFee => '전형료';

  @override
  String get catalogEntranceFee => '입학금';

  @override
  String get catalogRequirements => '지원 자격';

  @override
  String get catalogReqKorean => '한국어';

  @override
  String get catalogReqEnglish => '영어 과정';

  @override
  String get catalogReqRecommendation => '추천서';

  @override
  String get catalogRecYes => '필수';

  @override
  String get catalogRecNo => '불필요';

  @override
  String get catalogRecOptional => '선택';

  @override
  String get catalogReqDocuments => '제출 서류';

  @override
  String catalogDocsRequired(int count) {
    return '필수 $count개';
  }

  @override
  String get catalogReqApostille => '아포스티유';

  @override
  String catalogApostilleDocs(int count) {
    return '서류 $count개';
  }

  @override
  String get catalogReqBank => '잔고 증명 (D-2)';

  @override
  String catalogTimeline(String season) {
    return '일정 · $season';
  }

  @override
  String get catalogRoundLater => '추후 공지';

  @override
  String get catalogRoundEstimated => '예정';

  @override
  String get catalogRoundRelative => '날짜 미정';

  @override
  String get catalogWindowLabel => '원서 접수 기간';

  @override
  String catalogDaysLeft(int days) {
    return '$days일 남음';
  }

  @override
  String catalogWindowOpens(String date) {
    return '$date 접수 시작';
  }

  @override
  String get catalogWindowClosed => '접수 마감';

  @override
  String get catalogContact => '문의하기';

  @override
  String get catalogSeasonSpring => '봄';

  @override
  String get catalogSeasonAutumn => '가을';

  @override
  String catalogSeasonLabel(String year, String term) {
    return '$year $term';
  }

  @override
  String get catalogFavorite => '비교에 추가';

  @override
  String get catalogNoDegreeData => '이 과정의 정보가 아직 없습니다';

  @override
  String get catalogCompareChip => '비교';

  @override
  String catalogCompareChipCount(int count) {
    return '비교 · $count/2';
  }

  @override
  String get catalogComparePickTwo => '대학 2곳을 선택하세요';

  @override
  String get compareTraySlotEmpty => '선택';

  @override
  String get compareTrayCta => '비교하기';

  @override
  String get compareTitle => '비교';

  @override
  String get compareOnlyDiff => '차이만 보기';

  @override
  String get compareAddSlot => '대학을 선택하세요';

  @override
  String get compareNeedTwo => '비교할 대학 2곳을 선택하세요.';

  @override
  String get compareMainInfo => '주요 정보';

  @override
  String get compareDetails => '상세 정보';

  @override
  String get compareRowTuition => '등록금 (학기)';

  @override
  String get compareRowTopik => 'TOPIK 요건';

  @override
  String get compareRowIelts => 'IELTS 요건';

  @override
  String get compareRowDeadline => '지원 마감';

  @override
  String get compareRowCity => '도시';

  @override
  String get compareRowRequirements => '지원 서류';

  @override
  String get compareBestCheaper => '더 저렴';

  @override
  String get compareBestLower => '더 낮음';

  @override
  String get entryRegisterTitle => '회원가입';

  @override
  String get entryRegisterSubtitle => '전화번호와 비밀번호로 계정을 만드세요.';

  @override
  String get entryPhoneLabel => '전화번호';

  @override
  String get entryPasswordLabel => '비밀번호';

  @override
  String get entryPasswordConfirmLabel => '비밀번호 확인';

  @override
  String get entryPasswordHint => '6자 이상';

  @override
  String get entryRegisterSubmit => '가입하기';

  @override
  String get entryHaveAccount => '이미 계정이 있으신가요?';

  @override
  String get entrySignInLink => '로그인';

  @override
  String get entrySignInTitle => '로그인';

  @override
  String get entrySignInSubtitle => '가입한 전화번호와 비밀번호를 입력하세요.';

  @override
  String get entrySignInSubmit => '로그인';

  @override
  String get entryNoAccount => '계정이 없으신가요?';

  @override
  String get entryRegisterLink => '회원가입';

  @override
  String get entryErrorPhone => '+998 뒤에 9자리 번호를 모두 입력하세요.';

  @override
  String get entryErrorPasswordShort => '비밀번호는 6자 이상이어야 합니다.';

  @override
  String get entryErrorPasswordMismatch => '비밀번호가 일치하지 않습니다.';

  @override
  String get entryErrorExists => '이미 가입된 번호입니다. 비밀번호로 로그인하세요.';

  @override
  String get entryStudentNotice => 'Hanguk 학생이시네요 — 상담사가 드린 매직 코드로 로그인하세요.';

  @override
  String get entryErrorNotFound => '가입되지 않은 번호입니다.';

  @override
  String get entryErrorWrongPassword => '비밀번호가 올바르지 않습니다.';

  @override
  String get entryErrorLocked => '시도 횟수가 너무 많습니다. 15분 후에 다시 시도하세요.';

  @override
  String get entryErrorNetwork => '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도하세요.';

  @override
  String get entryShowPassword => '비밀번호 보기';

  @override
  String get entryHidePassword => '비밀번호 숨기기';

  @override
  String get entryLanguageLabel => '언어';

  @override
  String get entryLanguageSheetTitle => '언어 선택';

  @override
  String get catalogStep1 => '온라인 원서 접수';

  @override
  String get catalogStep2 => '전형료 납부';

  @override
  String get catalogStep3 => '서류 제출(우편·방문)';

  @override
  String get catalogStep4 => '은행 잔고증명서 제출(대학)';

  @override
  String get catalogStep5 => '면접';

  @override
  String get catalogStep6 => '합격자 발표';

  @override
  String get catalogStep7 => '등록금 납부';

  @override
  String get catalogStep8 => '표준입학허가서 발급';

  @override
  String get catalogStep9 => '비자용 은행 잔고증명서';

  @override
  String get catalogStep10 => '비자용 번역 및 아포스티유';

  @override
  String get catalogStep11 => '비자 신청';

  @override
  String get surveysTitle => '설문조사';

  @override
  String get surveysLoadError => '설문조사를 불러오지 못했습니다';

  @override
  String get surveysEmptyTitle => '아직 설문조사가 없습니다';

  @override
  String get surveysEmptyBody => '새 설문조사가 여기에 표시됩니다';

  @override
  String get surveyCompletedChip => '완료';

  @override
  String get surveyNewChip => '새 설문';

  @override
  String surveyQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '질문 $count개',
    );
    return '$_temp0';
  }

  @override
  String get surveyFillCta => '작성하기 →';

  @override
  String surveyPendingCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '설문조사 $count개',
    );
    return '$_temp0';
  }

  @override
  String get surveyPendingSubtitle => '답변을 기다리고 있어요';

  @override
  String get surveyTitleFallback => '설문조사';

  @override
  String get surveyAnswerAllRequired => '필수 질문에 모두 답해 주세요';

  @override
  String get surveySubmitError => '답변을 보내지 못했습니다. 다시 시도해 주세요.';

  @override
  String get surveyThanksTitle => '감사합니다!';

  @override
  String get surveyThanksBody => '답변이 접수되었습니다';

  @override
  String get surveyQuestionsLoadError => '질문을 불러오지 못했습니다';

  @override
  String get surveyNoQuestions => '질문이 없습니다';

  @override
  String get surveyAlreadyCompleted => '이미 이 설문조사를 완료했습니다';

  @override
  String get surveySubmit => '제출';

  @override
  String get surveyRequired => '필수';

  @override
  String get surveyEmailHint => 'example@mail.com';

  @override
  String get surveyNumberHint => '숫자를 입력하세요';

  @override
  String get surveyLongTextHint => '자세히 작성해 주세요...';

  @override
  String get surveyTextHint => '답변을 입력하세요...';

  @override
  String get surveyPickDate => '날짜를 선택하세요';

  @override
  String get docTypeIdCard => '지원자 신분증(국내 여권) 사본';

  @override
  String get docTypeForeignPassport => '지원자 해외여행용 여권 사본';

  @override
  String get docTypePhoto => '사진 (3.5x4.5 cm)';

  @override
  String get docTypeDiploma => '졸업장 또는 졸업증명서 사본';

  @override
  String get docTypeLanguageCertificate =>
      '어학 증명서 사본 (IELTS 5.5 또는 TOPIK 2급 이상)';

  @override
  String get docTypeOther => '서류';

  @override
  String get docStatusLocked => '잠김';

  @override
  String get notifPushSection => '최근 알림';

  @override
  String get notifMarkAllRead => '모두 읽음';

  @override
  String get appPendingApprovalNote => '상담사 승인을 기다리고 있습니다.\n검토가 끝나면 알려 드릴게요.';

  @override
  String get appCountrySouthKorea => '대한민국';

  @override
  String get appRoomNotFound => '이 대학에는 아직 대화방이 없습니다.';

  @override
  String get appRoomDiscussionNotFound => '이 대화방에는 아직 토론이 없습니다.';

  @override
  String get appRoomDiscussionConnectError => '토론에 연결하지 못했습니다.';

  @override
  String get appRoomSendError => '메시지를 보내지 못했습니다.';

  @override
  String get appRoomNotSignedIn => '다시 로그인해 주세요.';

  @override
  String get appRoomLoadError => '불러오지 못했습니다. 다시 시도해 주세요.';

  @override
  String get appRoomAnnouncementFallbackTitle => '공지';

  @override
  String get appRoomEventFallbackTitle => '일정';

  @override
  String get statusPendingApproval => '승인 대기';

  @override
  String get statusDocumentsCollection => '서류 수집 완료';

  @override
  String get statusDocumentsTranslation => '서류 번역 완료';

  @override
  String get statusApostille => '아포스티유 준비 완료';

  @override
  String get statusApplicationSubmitted => '지원서 제출 완료';

  @override
  String get statusUniversityResponse => '대학 회신 도착';

  @override
  String get statusVisaDocuments => '비자 서류';

  @override
  String get statusCompleted => '완료';

  @override
  String get statusInProgress => '진행 중';

  @override
  String get chatGreeting =>
      '안녕하세요! 👋 Hanguk AI 도우미입니다. 서류, 대학, 지원 절차에 대해 무엇이든 물어보세요!';

  @override
  String get chatNoResponse => '죄송합니다. 답변을 생성하지 못했습니다.';

  @override
  String get chatConnectError => 'Hanguk AI에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.';

  @override
  String get chatCleared => '대화가 삭제되었습니다. 무엇을 도와드릴까요?';

  @override
  String get mapLoadFailed => '지도를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.';

  @override
  String get mapTapForDetails => '눌러서 자세히 보기';

  @override
  String get mapProviderUnavailable => '지금은 지도 서비스를 사용할 수 없습니다.';

  @override
  String get mapInitError => '지도를 시작하지 못했습니다.';

  @override
  String get trainingGuideSpTitle => '학업 계획서(Study Plan) 작성 가이드';

  @override
  String get trainingGuideSpIntro =>
      'Study Plan은 한국에서 공부하려는 이유, 학업 목표, 졸업 이후 계획을 자세히 보여주는 핵심 서류입니다.';

  @override
  String get trainingGuideSp1Title => '1. 목적과 동기';

  @override
  String get trainingGuideSp1Body =>
      '왜 이 전공을 선택했는가? 한국과 지원 대학교가 그 목표에 어떻게 부합하는가?';

  @override
  String get trainingGuideSp2Title => '2. 학업 계획';

  @override
  String get trainingGuideSp2Body => '재학 중 어떤 분야에 집중할 것인가? 한국어 학습 계획은 어떻게 되는가?';

  @override
  String get trainingGuideSp3Title => '3. 졸업 후 계획';

  @override
  String get trainingGuideSp3Body => '졸업 후 어떤 진로를 그리고 있는가? 모국에 어떻게 기여할 것인가?';

  @override
  String get trainingGuidePsTitle => '자기소개서(Personal Statement) 작성 가이드';

  @override
  String get trainingGuidePsIntro =>
      'Personal Statement는 본인의 배경, 성취, 관심사, 그리고 해당 전공에 적합한 이유를 보여주는 글입니다.';

  @override
  String get trainingGuidePs1Title => '1. 과거 경험';

  @override
  String get trainingGuidePs1Body => '학교 시절 성취, 참가한 대회, 관심사를 구체적으로 적으세요.';

  @override
  String get trainingGuidePs2Title => '2. 개인적 강점';

  @override
  String get trainingGuidePs2Body =>
      '나를 다른 지원자와 구분 짓는 강점은 무엇인가? 어려움을 어떻게 극복했는가?';

  @override
  String get trainingGuidePs3Title => '3. 왜 이 전공인가';

  @override
  String get trainingGuidePs3Body => '이 전공에 대한 관심은 언제, 어떻게 시작되었는가?';

  @override
  String get trainingStatusInProgress => '진행 중';

  @override
  String get trainingStatusCompleted => '완료';

  @override
  String get trainingStatusAbandoned => '중단됨';

  @override
  String get trainingErrorSessionsLoad => '초안 목록을 불러오지 못했습니다. 다시 시도해 주세요.';

  @override
  String get trainingErrorCreateDraft => '초안을 만들지 못했습니다. 다시 시도해 주세요.';

  @override
  String get trainingErrorLoadDraft => '초안을 열지 못했습니다. 다시 시도해 주세요.';

  @override
  String get trainingErrorDraftConflict =>
      '다른 기기에서 더 최신 초안이 저장되었습니다. 새로고침하여 병합해 주세요.';

  @override
  String get trainingErrorTrackUpdate => '작성 언어를 변경하지 못했습니다. 다시 시도해 주세요.';

  @override
  String get trainingErrorGeneric => '문제가 발생했습니다. 다시 시도해 주세요.';

  @override
  String get trainingInterviewAiError => 'AI 면접관에 문제가 발생했습니다. 다시 시도해 주세요.';

  @override
  String get trainingInterviewAnswerError => '답변을 처리하지 못했습니다. 다시 시도해 주세요.';

  @override
  String get trainingInterviewVoiceError => '면접관 음성을 재생하지 못했습니다.';

  @override
  String get trainingInterviewAudioLinkWarning =>
      '녹음 링크를 저장하지 못했습니다. 다시 듣기가 불가능할 수 있습니다.';

  @override
  String get trainingInterviewFeedbackLoadError =>
      '피드백을 불러오지 못했습니다. 다시 시도해 주세요.';

  @override
  String get authErrorCodeNotFound => '확인되지 않는 코드입니다. 담당 상담사에게 코드를 다시 확인해 주세요.';

  @override
  String get authErrorServerUnreachable =>
      '서버에 연결할 수 없습니다. 인터넷 연결을 확인한 후 다시 로그인해 주세요.';

  @override
  String get authErrorStaffBlocked => '직원은 매직 코드가 아닌 아이디/비밀번호로 로그인해야 합니다.';

  @override
  String get authErrorAccountSetupBusy =>
      '서버에서 계정을 준비하고 있습니다. 30초 후에 다시 시도해 주세요.';

  @override
  String get authErrorLoginServer =>
      '로그인 서버 오류입니다. 다시 시도하거나 담당 상담사에게 계정 초기화를 요청해 주세요.';

  @override
  String get authErrorUnexpected =>
      '예기치 않은 서버 오류입니다. 다시 시도하거나 담당 상담사에게 문의해 주세요.';

  @override
  String get authErrorCrmAccount =>
      '이 계정은 담당 상담사가 만들었습니다. 상담사가 알려준 매직 액세스 코드로 로그인해 주세요.';

  @override
  String get authErrorAlreadyRegistered => '이미 등록된 전화번호입니다. 로그인해 주세요.';

  @override
  String get authErrorSignUpDisabled => '현재 회원가입이 중단되었습니다. 관리자에게 문의해 주세요.';

  @override
  String get authErrorPhoneFormat => '전화번호 형식이 올바르지 않습니다. 국가 번호를 포함해 주세요.';

  @override
  String get authErrorSignUpFailed => '계정을 만들지 못했습니다. 다시 시도해 주세요.';

  @override
  String get a11yMenu => '메뉴';

  @override
  String get accountExportShareSubject => 'Hanguk — 내 데이터 내보내기';

  @override
  String get accountExportShareText => 'Hanguk 데이터 내보내기 파일(JSON)입니다.';

  @override
  String get accountExportError => '데이터를 내보내지 못했습니다. 다시 시도해 주세요.';

  @override
  String get uniDbEventOther => '주요 일정';

  @override
  String get uniDbIeqasNone => 'IEQAS 미인증';

  @override
  String get uniDbPdfLinkInvalid => '링크를 열 수 없습니다. 다시 시도해 주세요.';

  @override
  String get uniDbFacultyMedicine => '의학계열';

  @override
  String get uniDbFacultyPharmacy => '약학계열';

  @override
  String get uniDbFacultyArtsPe => '예체능계열';

  @override
  String get uniDbFacultyTheology => '신학계열';

  @override
  String get uniDbFacultyInterdisciplinary => '융합계열';

  @override
  String get uniDbFacultyAll => '전체 학과';

  @override
  String get uniDbScholarshipScopeUniversity => '교내';

  @override
  String get uniDbScholarshipScopeNational => '정부';

  @override
  String get uniDbScholarshipScopeRegional => '지자체';

  @override
  String get uniDbScholarshipScopeFoundation => '재단';

  @override
  String get uniDbScholarshipScopeDepartment => '학과';

  @override
  String uniDbAwardTuitionPct(String pct) {
    return '등록금 $pct% 감면';
  }

  @override
  String get uniDbAwardTuition => '등록금 감면';

  @override
  String uniDbAwardTuitionKrw(String amount) {
    return '등록금 $amount 감면';
  }

  @override
  String uniDbAwardStipendMonthly(String amount) {
    return '월 $amount 생활비 지원';
  }

  @override
  String get uniDbAwardStipend => '월 생활비 지원';

  @override
  String uniDbAwardAirfare(String amount) {
    return '항공권 $amount 지원';
  }

  @override
  String get uniDbAwardAirfareCovered => '항공권 지원';

  @override
  String get uniDbAwardOther => '기타 혜택';

  @override
  String uniDbTopikDeferred(String base) {
    return '$base (추후 제출 가능)';
  }

  @override
  String get uniDbChangeAdmissionCycle => '모집 전형';

  @override
  String get uniDbChangeDates => '일정';

  @override
  String get uniDbChangeUpdated => '업데이트';

  @override
  String get uniDbDocApostille => '아포스티유';

  @override
  String get uniDbDocConsent => '동의서';

  @override
  String get uniDbDocPassport => '여권';

  @override
  String get uniDbDocTopik => 'TOPIK 성적증명서';

  @override
  String get uniDbDocLanguage => '어학성적증명서';

  @override
  String get uniDbDocTranscript => '성적증명서';

  @override
  String get uniDbDocDiploma => '졸업증명서';

  @override
  String get uniDbDocEnrollment => '재학증명서';

  @override
  String get uniDbDocFamily => '가족관계증명서';

  @override
  String get uniDbDocPowerOfAttorney => '위임장';

  @override
  String get uniDbDocFinance => '재정 증빙서류';

  @override
  String get uniDbDocEntryExit => '출입국사실증명서';

  @override
  String get uniDbDocEmployment => '재직증명서';

  @override
  String get uniDbDocRecommendation => '추천서';

  @override
  String get uniDbDocCitizenship => '국적 증명서';

  @override
  String get uniDbDocStatement => '자기소개서 및 학업계획서';

  @override
  String get uniDbDocAlienRegistration => '외국인등록증';

  @override
  String get uniDbDocIdCard => '신분증 사본';

  @override
  String get uniDbDocPhoto => '사진';

  @override
  String get uniDbDocPortfolio => '포트폴리오';

  @override
  String get uniDbDocHealth => '건강진단서';

  @override
  String get uniDbDocCalendar => '학사일정';

  @override
  String get uniDbDocTax => '납세증명서';

  @override
  String get uniDbDocBusinessRegistration => '사업자등록증';

  @override
  String get uniDbDocAward => '수상 증명서';

  @override
  String get uniDbDocApplicationForm => '입학원서';

  @override
  String get uniDbDocOther => '기타 서류';

  @override
  String get adminReviewQueueTitle => '검토 대기열';

  @override
  String get adminReviewTitle => '검토';

  @override
  String get adminRefresh => '새로고침';

  @override
  String get adminQueueEmpty => '대기열이 비어 있습니다. 지금은 처리할 항목이 없습니다.';

  @override
  String get adminSelectItem => '왼쪽 대기열에서 항목을 선택하세요.';

  @override
  String get adminAccepted => '승인됨';

  @override
  String get adminEditedAccepted => '수정 후 승인됨';

  @override
  String get adminRejected => '반려됨';

  @override
  String get adminBackToQueue => '대기열로 돌아가기';

  @override
  String adminConfidence(int pct) {
    return '신뢰도 $pct%';
  }

  @override
  String get adminOverdue => '기한 초과';

  @override
  String get adminOpenSource => '원문 페이지 열기';

  @override
  String get adminExtractedPayload => '추출된 데이터:';

  @override
  String get adminReject => '반려';

  @override
  String get adminEditAccept => '수정 후 승인';

  @override
  String get adminAccept => '승인';

  @override
  String get adminPayloadNotObject => '데이터는 JSON 객체여야 합니다';

  @override
  String adminInvalidJson(String error) {
    return '잘못된 JSON: $error';
  }

  @override
  String get adminEditPayload => '데이터 수정';

  @override
  String get adminSaveAccept => '저장 후 승인';

  @override
  String get adminRejectReasonTitle => '반려 사유';

  @override
  String get adminDetailOptional => '상세 내용 (선택)';

  @override
  String get adminStaffOnly =>
      '이 영역은 Hanguk 직원 전용입니다. 접근 권한이 필요하면 관리자에게 직원 역할 추가를 요청하세요.';

  @override
  String get adminPriorityP1 => 'P1 — 정정공고 (4시간)';

  @override
  String get adminPriorityP2 => 'P2 — 첨부파일 변경 (12시간)';

  @override
  String get adminPriorityP3 => 'P3 — 변경된 D3 필드 (24시간)';

  @override
  String get adminPriorityP4 => 'P4 — D2 일반 (48시간)';

  @override
  String get adminPriorityP5 => 'P5 — D1 단순 (96시간)';

  @override
  String get adminReasonLowConfidence => '낮은 신뢰도';

  @override
  String get adminReasonHighDifficulty => '고난도 필드';

  @override
  String get adminReasonAutoApproved => '자동 승인';

  @override
  String get adminReasonCorrectionNotice => '정정공고';

  @override
  String get adminEntityExtraction => '추출';

  @override
  String get adminEntityGuideline => '모집요강';

  @override
  String get adminRejectWrongYear => '잘못된 연도';

  @override
  String get adminRejectWrongArchetype => '잘못된 문서 유형';

  @override
  String get adminRejectHallucinated => '없는 필드 생성';

  @override
  String get adminRejectOcrGarbled => 'OCR 텍스트 깨짐';

  @override
  String get adminRejectSource404 => '원문 페이지 없음 (404)';

  @override
  String get adminRejectOther => '기타';

  @override
  String get interviewErrorNoGreeting => '면접관이 응답하지 않았습니다. 뒤로 돌아가 다시 시도해 주세요.';

  @override
  String get interviewErrorEndedBeforeGreeting =>
      '면접관이 말하기 전에 통화가 종료되었습니다. 다시 시도해 주세요.';

  @override
  String get interviewErrorCallFailed =>
      '통화에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';

  @override
  String get onbResultRouteLanguageCourse => '어학연수';

  @override
  String get onbResultRouteBachelor => '학사';

  @override
  String get onbResultRouteMaster => '석사';

  @override
  String get onbResultRouteCollege => '전문대학';

  @override
  String get onbResultIntakeSpring2027 => '2027년 봄';

  @override
  String get onbResultIntakeFall2027 => '2027년 가을';

  @override
  String get onbResultIntakeLater => '나중에';

  @override
  String get onbResultBandHigh => '가능성 높음';

  @override
  String get onbResultBandHighNote => '주요 요건을 충족했습니다 — 서류 준비를 시작할 수 있습니다.';

  @override
  String get onbResultBandMid => '가능성 보통';

  @override
  String get onbResultBandMidNote => '길은 열려 있지만 1–2가지를 보완해야 합니다.';

  @override
  String get onbResultBandLow => '아직은 위험이 높지만 — 길은 있습니다';

  @override
  String get onbResultBandLowNote => '어학 및 재정 서류가 아직 부족합니다.';

  @override
  String get onbResultFactorsTitle => '결과에 영향을 준 요인';

  @override
  String get onbResultFactorKoreanStrong => 'TOPIK 3급 이상 — 학사 기준 충족';

  @override
  String get onbResultFactorKoreanTopik2Degree =>
      'TOPIK 2급 — 학사는 대사관 기준 3급, 전문대는 가능';

  @override
  String get onbResultFactorKoreanMissingDegree => '학사는 대사관 기준 TOPIK 3급 필요';

  @override
  String get onbResultFactorKoreanCollegeStrong => 'TOPIK 3급 이상';

  @override
  String get onbResultFactorKoreanCollegeTopik2 => 'TOPIK 2급 — 전문대 기준 충족';

  @override
  String get onbResultFactorKoreanCourseCertificate =>
      '세종 1A / TOPIK 1급 자격증 있음';

  @override
  String get onbResultFactorKoreanCourseMissing =>
      '어학연수 비자는 TOPIK 1급 또는 세종학당 수료증 필요';

  @override
  String get onbResultFactorIncomeYes => '부모님의 공식 소득';

  @override
  String get onbResultFactorIncomeNo => '부모님의 공식 소득 없음';

  @override
  String get onbResultFactorGradRecent => '최근 졸업 — 학업 공백 없음';

  @override
  String get onbResultFactorGradGapLong => '졸업 후 오랜 시간 경과 — 학업 목적을 설명해야 합니다';

  @override
  String get onbResultFactorAgeHigh => '나이로 인해 학업 목적을 설명해야 합니다';

  @override
  String get onbResultUnisTitle => '나에게 맞는 대학';

  @override
  String get onbResultAccredited => '인증 대학';

  @override
  String get onbResultTuitionLabel => '등록금/학기';

  @override
  String get onbResultBankLabel => 'KDB 예금';

  @override
  String get onbResultYearlyCost => '연간 예상 비용';

  @override
  String get onbResultStepsTitle => '다음 3단계';

  @override
  String get onbResultStepSchoolDocs => '고등학교 졸업장과 여권 번역 및 아포스티유';

  @override
  String get onbResultStepDiplomaDocs => '학위증과 여권 번역 및 아포스티유';

  @override
  String get onbResultStepApplyOnTime => '대학 마감일 전에 서류 제출';

  @override
  String get onbResultPathsTitle => '나에게 맞는 길';

  @override
  String get onbResultPathLanguageCourse => '먼저 어학연수 (D-4)';

  @override
  String get onbResultPathLanguageCourseNote =>
      '한국에서 한국어를 배우고 TOPIK 취득 후 본과정으로 진학. 어학연수 비자도 TOPIK 1급 또는 세종학당 수료증이 필요합니다.';

  @override
  String get onbResultPathCollege => '전문대학';

  @override
  String get onbResultPathCollegeNote => '보유하신 TOPIK 2급으로 전문대 지원이 가능합니다.';

  @override
  String get onbResultPathNextSeason => '다음 학기 준비';

  @override
  String onbResultPathNextSeasonNote(String level) {
    return 'TOPIK $level급을 취득하고 다음 학기에 지원.';
  }

  @override
  String onbResultTariffWhy(String tariff) {
    return '$tariff — 왜? →';
  }

  @override
  String get onbResultCtaOperator => '무료 상담';

  @override
  String get onbResultCtaTelegram => '텔레그램에서 계속하기';

  @override
  String get onbResultDisclaimer => '이것은 예비 평가입니다. 비자 결정은 대사관이 내립니다.';

  @override
  String onbResultPlanTariff(String tariff) {
    return '추천 요금제: $tariff';
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
  String get onbTariffsTitle => '가격 및 조건';

  @override
  String get onbTariffsSubtitle => '대부분은 비자 발급 후에 지불합니다.';

  @override
  String onbTariffServices(int count) {
    return '서비스 $count개';
  }

  @override
  String get onbTariffPriceStandart => '지금 200만 숨 + 비자 후 500만, 또는 500만 일시불';

  @override
  String get onbTariffPricePremium => '지금 300만 + 비자 후 1,000만, 또는 1,000만';

  @override
  String get onbTariffPriceNoRisk => '\$5 000 일시불';

  @override
  String get onbTariffPriceHanbox => '\$2 000 또는 \$400 + 월 \$200';

  @override
  String get onbTariffMore => '자세히 →';

  @override
  String get onbTariffsCompare => '요금제 비교';

  @override
  String get onbTariffExcludedTitle => '포함되지 않는 것';

  @override
  String get onbTariffExContract => '등록금';

  @override
  String get onbTariffExApplicationFee => '지원비';

  @override
  String get onbTariffExBankStatement => '은행 잔고증명';

  @override
  String get onbTariffExFlight => '항공편';

  @override
  String get onbTariffExVisaFee => '비자 수수료';

  @override
  String get onbTariffExLiving => '생활비';

  @override
  String get onbTariffExVisa => '비자';

  @override
  String get onbTariffDetailEyebrow => '요금제 상세';

  @override
  String get onbTariffPayTitle => '결제 시점';

  @override
  String get onbTariffPayContract => '계약';

  @override
  String get onbTariffPayContractWhen => '업무 시작 시';

  @override
  String get onbTariffPayVisa => '비자 발급';

  @override
  String get onbTariffPayVisaWhen => '비자를 받았을 때';

  @override
  String get onbTariffPayVisaDays => '비자 발급 후 7영업일 이내';

  @override
  String get onbTariffPayStart => '시작 시';

  @override
  String get onbTariffPayMonthly => '매월';

  @override
  String onbTariffMln(int n) {
    return '${n}00만';
  }

  @override
  String get onbTariffOrOnceStandart => '또는 500만 숨 일시불.';

  @override
  String get onbTariffOrOncePremium => '또는 1,000만 숨 일시불.';

  @override
  String get onbTariffOrOnceHanbox => '또는 \$2 000 일시불, 또는 할부.';

  @override
  String get onbTariffIncludedTitle => '포함 사항';

  @override
  String get onbTariffIncUniChoice => '대학 선택';

  @override
  String get onbTariffIncDocsList => '서류 목록 및 검토';

  @override
  String get onbTariffIncTranslation => '번역 및 아포스티유 지원';

  @override
  String get onbTariffIncStudyPlan => '학업계획서 및 자기소개서';

  @override
  String get onbTariffIncApply => '지원서 제출';

  @override
  String get onbTariffIncInterview => '면접 준비';

  @override
  String get onbTariffIncVisaDocs => '비자 서류';

  @override
  String get onbTariffIncDorm => '기숙사 배정';

  @override
  String get onbTariffIncFirstWeek => '한국 도착 첫 주 지원';

  @override
  String get onbTariffIncApplyUpTo3 => '최대 3개 대학 지원 대행';

  @override
  String get onbTariffIncInterviewQuestions => '면접 준비 (예상 질문 제공)';

  @override
  String get onbTariffIncDocsPrep => '서류 준비 (번역, 아포스티유)';

  @override
  String get onbTariffIncPost => '우편 발송';

  @override
  String get onbTariffIncSimBank => '유심 및 은행 카드';

  @override
  String get onbTariffIncInterviewAi => '면접 준비 (AI와 함께 연습)';

  @override
  String get onbTariffIncBankShot1Day => '은행 계좌 (일반, 1일)';

  @override
  String get onbTariffIncBankShot1Month => '은행 계좌 (1개월)';

  @override
  String get onbTariffIncEmbassyDocs => '대사관 서류 준비 (번역, 아포스티유)';

  @override
  String get onbTariffIncStudyPlanAi => '학업계획서 작성 지원 (AI 활용)';

  @override
  String get onbTariffIncPickup => '한국 공항 픽업';

  @override
  String get onbTariffIncContractPaid => '등록금 회사 부담';

  @override
  String get onbTariffIncFlightTicket => '항공권 구매 대행';

  @override
  String get onbTariffIncFlatMonth => '숙소를 찾아 1개월 월세 지원';

  @override
  String get onbTariffIncAppFee => '지원비 (Application fee)';

  @override
  String get onbTariffIncHanboxLessons =>
      '1년 실시간 온라인 수업 (Hanguk Academy 앱), 11–15명 그룹, 목표 — TOPIK 2급';

  @override
  String get onbTariffIncHanboxLaptop => '노트북과 교재가 가격에 포함됩니다';

  @override
  String get onbTariffIncHanboxFirstLesson => '첫 수업 무료';

  @override
  String get onbTariffIncHanboxStandart =>
      '수료 후 — Standart 컨설팅 무료 (TOPIK 2급, 출석률 80%, 전액 납부)';

  @override
  String get onbTariffFaqTitle => '자주 묻는 질문';

  @override
  String onbTariffMlnSom(int n) {
    return '${n}00만 숨';
  }

  @override
  String onbTariffFaqNoVisaQ(String amount) {
    return '비자가 나오지 않아도 $amount을 내나요?';
  }

  @override
  String onbTariffFaqNoVisaA(String amount) {
    return '아니요. 2단계 결제에서는 $amount을 비자 발급 후에만 지불합니다.';
  }

  @override
  String get onbTariffFaqWhenQ => '비자 후 결제는 언제 하나요?';

  @override
  String get onbTariffFaqWhenA => '비자 발급 후 7영업일 이내입니다.';

  @override
  String get onbTariffFaqContractQ => '등록금은 누가 내나요?';

  @override
  String get onbTariffFaqContractA => '대학 등록금은 본인이 직접 냅니다 — 요금제 가격에 포함되지 않습니다.';

  @override
  String get onbTariffFaqContractANoRisk => '등록금은 회사가 냅니다 — NO RISK 가격에 포함됩니다.';

  @override
  String get onbTariffCta => '이 요금제 상담받기';

  @override
  String get onbTariffContractPdf => '계약서 샘플 (PDF)';

  @override
  String get onbWelcomeTitle => '비자 발급 가능성을 [2분 만에] 확인하세요';

  @override
  String get onbWelcomeBody => '시간을 아끼세요. 짧은 질문에 답하고 객관적인 평가를 받아보세요';

  @override
  String get onbWelcomeCta => '내 가능성 확인하기';

  @override
  String get onbWelcomeCatalog => '대학교 둘러보기';

  @override
  String get onbWelcomeClientCode => '고객 코드가 있어요';

  @override
  String get onbQuizContinue => '계속';

  @override
  String get onbQuizBack => '뒤로';

  @override
  String get onbQuizQ1 => '한국에서 무엇을 공부하고 싶나요?';

  @override
  String get onbQuizRouteCourse => '어학연수 — 한국어 배우기';

  @override
  String get onbQuizRouteBachelor => '학사 — 대학교 4년';

  @override
  String get onbQuizRouteMaster => '석사 — 학사 졸업 후';

  @override
  String get onbQuizRouteCollege => '전문대 — 2~3년 직업 과정';

  @override
  String onbQuizGradYearOrEarlier(String year) {
    return '$year년 또는 그 이전';
  }

  @override
  String get onbQuizStillStudying => '아직 재학 중';

  @override
  String get onbQuizQ3 => '한국어 수준이 어떻게 되나요?';

  @override
  String get onbQuizQ3Hint => '공식 성적표 기준으로 선택하세요. 대사관은 성적 없이 신청을 받지 않습니다.';

  @override
  String get onbQuizKoreanNone => '한국어를 못해요';

  @override
  String get onbQuizKoreanLearning => '배우는 중, 성적 없음';

  @override
  String get onbQuizKoreanTopik1 => 'TOPIK 1급 또는 세종학당 수료증';

  @override
  String get onbQuizKoreanTopik2 => 'TOPIK 2급';

  @override
  String get onbQuizKoreanTopik3 => 'TOPIK 3급';

  @override
  String get onbQuizKoreanUnknown => '잘 모르겠어요';

  @override
  String get onbQuizQ5 => '부모님께 공식 소득이 있나요?';

  @override
  String get onbQuizIncomeYes => '네, 있어요';

  @override
  String get onbQuizIncomeNo => '아니요';

  @override
  String get onbQuizIntakeSpring2027 => '2027년 봄 (3월)';

  @override
  String get onbQuizIntakeFall2027 => '2027년 가을 (9월)';

  @override
  String get onbQuizIntakeLater => '나중에';

  @override
  String get onbContactTitle => '상세 계획과 대학교 목록';

  @override
  String get onbContactSubtitle => '상담원이 답변을 확인하고 10분 안에 전화드립니다.';

  @override
  String get onbContactAfterHours => '지금은 업무 시간이 아닙니다. 내일 10:00에 전화드릴게요.';

  @override
  String get onbContactName => '이름';

  @override
  String get onbContactPhone => '전화번호';

  @override
  String get onbContactPhoneError => '번호를 확인해 주세요';

  @override
  String get onbContactNameError => '이름을 입력해 주세요';

  @override
  String get onbContactNetworkError => '전송하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';

  @override
  String get onbContactTelegram => '계획을 텔레그램으로도 보내 주세요';

  @override
  String get onbContactCta => '상담원 전화 요청';

  @override
  String get onbContactHours =>
      '업무 시간 월–토 09:40–18:00. 그 외 시간에는 다음 날 10:00에 전화드립니다.';

  @override
  String onbContactSuccess(String name) {
    return '감사합니다, $name님! 상담원이 10분 안에 전화드립니다.';
  }

  @override
  String get onbContactBackToResult => '결과로 돌아가기';

  @override
  String get onbContactAfterHoursToday => '지금은 업무 시간이 아닙니다. 오늘 10:00에 전화드릴게요.';

  @override
  String get onbContactAfterHoursMonday =>
      '지금은 업무 시간이 아닙니다. 월요일 10:00에 전화드릴게요.';

  @override
  String get onbQuizAgeQ => '나이가 어떻게 되나요?';

  @override
  String get onbQuizGradQ => '마지막 학교를 언제 졸업했나요?';

  @override
  String get onbQuizIeltsQ => 'IELTS 점수가 있나요?';

  @override
  String get onbQuizIeltsNone => '없음 또는 5.5 미만';

  @override
  String get onbQuizIelts55 => 'IELTS 5.5';

  @override
  String get onbQuizIelts60 => 'IELTS 6.0';

  @override
  String get onbQuizIelts65 => 'IELTS 6.5 이상';

  @override
  String get onbQuizIeltsUnknown => '잘 모르겠어요';

  @override
  String get onbQuizPayerQ => '학비는 누가 부담하나요?';

  @override
  String get onbQuizPayerParentsOption => '부모님';

  @override
  String get onbQuizPayerSelfOption => '본인';

  @override
  String get onbQuizPayerSponsorOption => '후원자 또는 친척';

  @override
  String get onbQuizRegionQ => '어느 지역에 살고 있나요?';

  @override
  String get onbQuizIntakeQ => '언제 입학하고 싶나요?';

  @override
  String get onbResultFactorEnglishStrong => 'IELTS 5.5 이상 — 영어 트랙 지원 가능';

  @override
  String get onbResultPartner => '공식 파트너';

  @override
  String get onbResultLanguageLabel => '어학 요건';

  @override
  String get onbQuizKoreanTopik4 => 'TOPIK 4급 이상';

  @override
  String get onbQuizKdbQ => '학생 명의로 예금을 넣을 수 있나요?';

  @override
  String onbQuizKdbHint(String low, String high, String months) {
    return '비자 필수: 학생 명의 KDB Bank Uzbekistan 계좌에 $low(기타 지역) 또는 $high(서울·경기·인천), 최소 $months개월 예치. 납부가 아니라 학생 계좌에 남는 돈입니다.';
  }

  @override
  String get onbQuizKdbReady => '네, 지금 준비돼 있어요';

  @override
  String get onbQuizKdbByIntake => '입학 전까지 준비할게요';

  @override
  String get onbQuizKdbNo => '아니요, 어려워요';

  @override
  String get onbQuizKdbUnknown => '잘 모르겠어요';

  @override
  String get onbResultFactorKoreanMasterStrong => 'TOPIK 4급 이상 — 석사 기준 충족';

  @override
  String get onbResultFactorKoreanTopik3Master => 'TOPIK 3급 — 석사는 대사관 기준 4급 필요';

  @override
  String get onbResultFactorKoreanMissingMaster => '석사는 대사관 기준 TOPIK 4급 필요';

  @override
  String get onbResultFactorKoreanCollegeMissing => '전문대는 대사관 기준 TOPIK 2급 필요';

  @override
  String get onbResultFactorKdbReady => '학생 명의 KDB 예금 준비됨';

  @override
  String get onbResultFactorKdbByIntake => 'KDB 예금 미준비 — 신청 전 필요';

  @override
  String get onbResultFactorKdbNo => 'KDB 예금 없음 — 대사관 필수 요건';

  @override
  String get onbResultBandLowNoteLanguage =>
      '어학 성적이 대사관 기준보다 낮습니다 — 성적 없이 신청하면 면접 없이 불허됩니다.';

  @override
  String get onbResultBandLowNoteMoney =>
      '재정 요건(학생 명의 KDB 예금과 부모 서류)이 아직 부족합니다.';

  @override
  String get onbQuizQ1Hint => '결과는 이 과정의 비자 기준으로 계산됩니다.';

  @override
  String get onbQuizGradHint => '고등학교·리세이·전문대·대학교 중 마지막 학교.';

  @override
  String get onbQuizGradQMaster => '학사를 언제 졸업했나요?';

  @override
  String get onbQuizIeltsHint =>
      '영어 트랙에 필요합니다. 최근 2년 내 일반 IELTS만 인정(Online 불가).';

  @override
  String get onbQuizIncomeHint =>
      '예: 직장 급여 증명(my.gov.uz) 또는 사업·세금 서류. 대사관은 부모 서류를 요구합니다.';

  @override
  String onbWelcomeCallTimer(String minutes) {
    return '$minutes분 안에 상담원이 연락드립니다';
  }

  @override
  String onbResultStepLanguagePrep(String level) {
    return 'TOPIK $level급 준비';
  }

  @override
  String onbResultStepLanguagePrepEnglish(String level) {
    return 'TOPIK $level급 또는 IELTS 5.5 준비';
  }

  @override
  String onbResultStepDeposit(String low, String high, String months) {
    return '학생 명의 KDB 예금 개설: $low–$high, 최소 $months개월';
  }

  @override
  String get onbResultStepParentsDocs => '부모 소득 또는 재산 서류 준비 (my.gov.uz)';

  @override
  String get onbResultPathEnglishTrack => '영어 트랙';

  @override
  String get onbResultPathEnglishTrackNote =>
      'IELTS 5.5로 한국어 성적이 필요 없는 과정에 지원.';

  @override
  String get onbResultPathDeposit => 'KDB 예금 준비';

  @override
  String onbResultPathDepositNote(String low, String high, String months) {
    return '학생 명의 $low–$high, 최소 $months개월 — 비자 필수 요건.';
  }

  @override
  String get onbResultPathParentsDocs => '부모 서류';

  @override
  String get onbResultPathParentsDocsNote => '재직·사업·재산 서류 — 대사관이 요구합니다.';

  @override
  String get catalogGuestUniTitle => '방문 대학';

  @override
  String get catalogGuestUniWhere => '현재 우즈베키스탄 방문';

  @override
  String get catalogGuestUniBadge => '사마르칸트 방문 대표단';
}
