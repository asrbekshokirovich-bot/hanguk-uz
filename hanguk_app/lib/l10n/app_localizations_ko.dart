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
  String get walkaroundLoadingTitle => '캠퍼스 워크어라운드 로딩 중';

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
      '워크어라운드 시작 중 오류가 발생했습니다. 다시 시도해 주세요.';

  @override
  String get virtualTourTitle => '가상 투어';

  @override
  String get virtualWalkaroundTitle => '가상 워크어라운드';

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
  String get loginAccessCodeHelp =>
      '컨설턴트 또는 대학 담당자가 제공한 8자리 액세스 코드(영문과 숫자)를 입력하세요.';

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
  String get welcomeGuestCaption => '코드 없이 자유롭게 둘러보고 비교하세요.';

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
}
