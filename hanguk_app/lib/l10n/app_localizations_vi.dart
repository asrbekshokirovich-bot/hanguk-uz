// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

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
  String get visitUniversityWebsite => 'Truy cập website của trường';

  @override
  String universityTier(int tier) {
    return 'Bậc $tier';
  }

  @override
  String get universityVerified => 'Đã xác minh';

  @override
  String get universityNextEvent => 'Sự kiện tiếp theo';

  @override
  String get navApplications => 'Đơn';

  @override
  String get navMap => 'Bản đồ';

  @override
  String get navDocs => 'Tài liệu';

  @override
  String get navTraining => 'Đào tạo';

  @override
  String get applicationsTabTitle => 'Đơn của tôi';

  @override
  String get mapTabTitle => 'Trường đại học';

  @override
  String get documentsTabTitle => 'Tài liệu của tôi';

  @override
  String get documentUploadInfo =>
      'Upload valid PDF or JPEG scans of your original documents. Max 10MB per file.';

  @override
  String get documentsRequiredHeading => 'Required Documents';

  @override
  String get documentUploadFailed =>
      'Couldn\'t upload your document. Please try again.';

  @override
  String get documentPreviewFailed =>
      'Couldn\'t open the document. Please try again.';

  @override
  String get documentLoadError => 'Couldn\'t load your documents.';

  @override
  String get commonRetry => 'Retry';

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
  String get appsLoadError => 'Couldn\'t load your applications.';

  @override
  String get appsPendingHeading => 'Pending Applications';

  @override
  String get appsActiveHeading => 'Active Applications';

  @override
  String get searchHint => 'Search...';

  @override
  String get clearSearch => 'Clear search';

  @override
  String get filterAll => 'All';

  @override
  String get filterPartner => 'Partner';

  @override
  String get filterTop => 'Top';

  @override
  String get noUniversitiesMatch => 'No universities match this filter';

  @override
  String get clearFilters => 'Clear filters';

  @override
  String get universitiesLoadError => 'Couldn\'t load universities';

  @override
  String get checkConnectionRetry => 'Check your connection and try again';

  @override
  String get switchToListView => 'Switch to list view';

  @override
  String get switchToMapView => 'Switch to map view';

  @override
  String get chatInputHint => 'Ask anything about South Korea...';

  @override
  String get accountTooltip => 'Tài khoản';

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
    return 'Bước $step';
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
      'Ngôn ngữ bản nháp của bạn không khớp với lộ trình đã chọn. Vui lòng viết lại bằng ngôn ngữ đã chọn.';

  @override
  String get interviewStartError =>
      'Không thể bắt đầu phỏng vấn. Vui lòng kiểm tra kết nối và thử lại.';

  @override
  String get perAnswerReviewTitle => 'Phân tích từng câu trả lời';

  @override
  String get betterAnswerLabel => 'CÂU TRẢ LỜI TỐT HƠN';

  @override
  String get navHome => 'Trang chủ';

  @override
  String get navMenu => 'Menu';

  @override
  String get greetingMorning => 'Chào buổi sáng';

  @override
  String get greetingAfternoon => 'Chào buổi chiều';

  @override
  String get greetingEvening => 'Chào buổi tối';

  @override
  String get welcomeHeadline => 'Chào mừng đến hành trình của bạn';

  @override
  String get welcomeSubtitle =>
      'Con đường đến đại học Hàn Quốc bắt đầu từ đây.';

  @override
  String get welcomeMagicCodeCta => 'Tôi có mã Magic Code';

  @override
  String get welcomeExploreCta => 'Khám phá các trường';

  @override
  String get magicCodeTitle => 'Mã Magic Code';

  @override
  String get homeJourneyEyebrow => 'Hành trình của bạn';

  @override
  String get homeContinueJourney => 'Tiếp tục hành trình';

  @override
  String get homeViewAll => 'Xem tất cả';

  @override
  String documentsCollected(int collected, int total) {
    return 'Đã có $collected trên $total';
  }

  @override
  String get documentActionUpload => 'Tải lên';

  @override
  String get documentStatusApproved => 'Đã duyệt';

  @override
  String get documentStatusPendingReview => 'Chờ duyệt';

  @override
  String get statusDocs => 'Hồ sơ';

  @override
  String get statusSubmitted => 'Đã nộp';

  @override
  String get statusInReview => 'Đang xét duyệt';

  @override
  String get statusWaiting => 'Đang chờ';

  @override
  String get statusRejected => 'Bị từ chối';

  @override
  String get journeyStageDocumentPrep => 'Chuẩn bị hồ sơ';

  @override
  String get journeyStageOnlineApplication => 'Nộp hồ sơ trực tuyến';

  @override
  String get journeyStageOfflineApplication => 'Nộp hồ sơ trực tiếp';

  @override
  String get journeyStageInterview => 'Phỏng vấn';

  @override
  String get journeyStageWaitingInvoice => 'Chờ hóa đơn';

  @override
  String get journeyStageTuitionPayment => 'Đóng học phí';

  @override
  String get journeyStageWaitingAdmission => 'Chờ thư mời nhập học';

  @override
  String get journeyStageVisaPreparation => 'Chuẩn bị visa';

  @override
  String get journeyStageWaitingVisa => 'Chờ cấp visa';

  @override
  String mapUniversitiesMapped(int count) {
    return '$count trường trên bản đồ';
  }

  @override
  String get updateAvailableTitle => 'Có bản cập nhật mới';

  @override
  String updateVersionReady(String version) {
    return 'Phiên bản $version đã sẵn sàng để cài đặt.';
  }

  @override
  String updateSizeMb(String size) {
    return 'Dung lượng: $size MB';
  }

  @override
  String get updateSigningKeyWarning =>
      'Bản cập nhật này thay đổi khóa ký của ứng dụng. Sau khi cài đặt, bạn sẽ cần đăng nhập lại bằng mã Magic Code của mình.';

  @override
  String get updateNow => 'Cập nhật ngay';

  @override
  String get updateLater => 'Để sau';

  @override
  String get updateDownloadingTitle => 'Đang tải bản cập nhật';

  @override
  String updateDownloadProgress(String downloaded, String total) {
    return '$downloaded MB / $total MB';
  }

  @override
  String get updateInstallingLabel => 'Đang xác minh và cài đặt…';

  @override
  String get updateFailedTitle => 'Cập nhật thất bại';

  @override
  String get updateErrorNetwork =>
      'Không thể tải bản cập nhật. Vui lòng kiểm tra kết nối internet và thử lại.';

  @override
  String get updateErrorHashMismatch =>
      'Tệp đã tải không vượt qua bước kiểm tra tính toàn vẹn. Vui lòng thử lại — nếu vấn đề lặp lại, hãy liên hệ với tư vấn viên của bạn.';

  @override
  String get updateErrorInstallDenied =>
      'Thiết bị của bạn đã chặn việc cài đặt. Vui lòng cấp quyền \"Cài đặt ứng dụng không xác định\" cho Hanguk trong cài đặt điện thoại, sau đó thử lại.';

  @override
  String get updateErrorStorage =>
      'Không đủ bộ nhớ để tải bản cập nhật. Vui lòng giải phóng dung lượng và thử lại.';

  @override
  String get updateErrorUnsupportedPlatform =>
      'Cập nhật chưa khả dụng trên nền tảng này.';

  @override
  String get updateErrorUnknown =>
      'Cập nhật thất bại. Vui lòng thử lại hoặc liên hệ với tư vấn viên của bạn.';

  @override
  String get guestModeEyebrow => 'Chế độ khách';

  @override
  String get guestJoinCta => 'Tham gia Hanguk';

  @override
  String get guestExploreTitle => 'Tìm trường đại học của bạn';

  @override
  String guestUniversitiesCount(int count) {
    return '$count trường đại học';
  }

  @override
  String get guestNavExplore => 'Khám phá';

  @override
  String get guestNavCompare => 'So sánh';

  @override
  String guestCompareCount(int count) {
    return 'So sánh $count/2';
  }

  @override
  String get guestCompareEmptySlot => 'Thêm từ Khám phá';

  @override
  String get guestCompareApplyCta => 'Nộp hồ sơ cùng Hanguk';

  @override
  String get guestCompareReassurance =>
      'Nhận mã thần kỳ — đội ngũ của chúng tôi sẽ hướng dẫn bạn từ hồ sơ đến visa.';

  @override
  String get guestRowCity => 'Thành phố';

  @override
  String get guestRowTier => 'Hạng';

  @override
  String get guestRowIeqas => 'Trạng thái IEQAS';

  @override
  String get guestRowPartner => 'Đối tác Hanguk';

  @override
  String get guestRowNextEvent => 'Sự kiện tiếp theo';

  @override
  String get guestRowWebsite => 'Trang web';

  @override
  String get guestValueYes => 'Có';

  @override
  String get guestValueNo => 'Không';

  @override
  String get roomTabStatus => 'Trạng thái';

  @override
  String get roomTabDiscussion => 'Thảo luận';

  @override
  String get roomTabNews => 'Tin tức';

  @override
  String get roomTabCalendar => 'Lịch';

  @override
  String get roomApplicationProgress => 'Tiến trình hồ sơ';

  @override
  String get roomChatEmpty =>
      'Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!';

  @override
  String get roomChatHint => 'Nhắn tin vào phòng...';

  @override
  String get roomChatSenderFallback => 'Người dùng';

  @override
  String get roomNewsEmpty => 'Không có thông báo nào.';

  @override
  String get roomEventsEmpty => 'Không có sự kiện nào vào ngày này.';

  @override
  String get uniDbPhaseBadge =>
      'CSDL trường đại học · Giai đoạn 0 đã dựng khung';

  @override
  String get uniDbRecentChangesTitle =>
      'Cập nhật từ các trường bạn đang theo dõi';

  @override
  String get timeJustNow => 'vừa xong';

  @override
  String timeMinutesAgo(int minutes) {
    return '$minutes phút trước';
  }

  @override
  String timeHoursAgo(int hours) {
    return '$hours giờ trước';
  }

  @override
  String timeDaysAgo(int days) {
    return '$days ngày trước';
  }

  @override
  String get uniDbVerifiedDeadlinesTitle => 'Hạn chót sắp tới đã xác minh';

  @override
  String get deadlineClosed => 'Đã đóng';

  @override
  String deadlineInDays(int days) {
    return 'còn $days ngày';
  }

  @override
  String deadlineInHours(int hours) {
    return 'còn $hours giờ';
  }

  @override
  String deadlineInMinutes(int minutes) {
    return 'còn $minutes phút';
  }

  @override
  String get eventApplyOpen => 'Mở nhận hồ sơ';

  @override
  String get eventApplyClose => 'Đóng nhận hồ sơ';

  @override
  String get eventDocumentsDue => 'Hạn nộp giấy tờ';

  @override
  String get eventFirstStageResults => 'Kết quả vòng 1';

  @override
  String get eventInterviewLabel => 'Phỏng vấn';

  @override
  String get eventPracticalExam => 'Thi thực hành';

  @override
  String get eventFinalResults => 'Kết quả cuối cùng';

  @override
  String get eventAdditionalAdmit => 'Trúng tuyển bổ sung';

  @override
  String get eventRegistrationOpen => 'Mở đăng ký nhập học';

  @override
  String get eventRegistrationClose => 'Đóng đăng ký nhập học';

  @override
  String get cycleForeign => 'Diện sinh viên quốc tế';

  @override
  String get cycleOverseasKoreanFull => 'Kiều bào Hàn (toàn phần)';

  @override
  String get cycleOverseasKoreanPartial => 'Kiều bào Hàn (một phần)';

  @override
  String get cycleSusi => 'Susi';

  @override
  String get cycleJeongsi => 'Jeongsi';

  @override
  String get cycleTransfer => 'Chuyển trường';

  @override
  String get cycleGradGeneral => 'Sau đại học';

  @override
  String get cycleGradForeign => 'Sau đại học (quốc tế)';

  @override
  String get uniSpecificHeader => 'Phỏng vấn theo trường cụ thể';

  @override
  String get uniSpecificPickPrompt =>
      'Chọn một trường ở trên để người phỏng vấn dựa vào đơn vị tuyển sinh, yêu cầu và các mốc hạn quan trọng của trường đó.';

  @override
  String uniSpecificLoadError(Object error) {
    return 'Không tải được dữ liệu tuyển sinh: $error\nBạn vẫn có thể luyện phỏng vấn chung.';
  }

  @override
  String get uniSpecificNoData =>
      'Chưa có dữ liệu tuyển sinh đã xác minh cho trường này. Người phỏng vấn sẽ dùng câu hỏi chung cho đến khi chúng tôi nạp 모집요강 của trường.';

  @override
  String get uniSpecificFallbackButton => 'Chuyển sang phỏng vấn chung';

  @override
  String uniSpecificTrackLabel(String category) {
    return 'Diện: $category';
  }

  @override
  String get uniSpecificSeedNote =>
      'Người phỏng vấn sẽ dựa trên dữ liệu tuyển sinh này khi đặt câu hỏi.';

  @override
  String get uniSpecificRecruitmentUnitFallback => 'Đơn vị tuyển sinh';

  @override
  String get uniDbInstitutionTitle => 'Trường đại học';

  @override
  String get uniDbNotFoundTitle => 'Không tìm thấy trường';

  @override
  String get uniDbNotFoundBody =>
      'Trường này chưa có trong danh mục. Vui lòng quay lại sau.';

  @override
  String get uniDbUpcomingDeadlines => 'Hạn chót sắp tới';

  @override
  String get uniDbNoDeadlines => 'Chưa có hạn chót nào được công bố.';

  @override
  String get uniDbTuitionHeading => 'Học phí';

  @override
  String get uniDbTuitionEmpty => 'Chưa có thông tin học phí.';

  @override
  String get uniDbRequirementsHeading => 'Yêu cầu';

  @override
  String get uniDbRequirementsEmpty => 'Chưa có thông tin yêu cầu tuyển sinh.';

  @override
  String get uniDbScholarshipsHeading => 'Học bổng';

  @override
  String get uniDbScholarshipsEmpty => 'Chưa có học bổng nào cho trường này.';

  @override
  String get uniDbDocumentChecklistHeading => 'Danh sách hồ sơ';

  @override
  String get uniDbDocumentsEmpty => 'Chưa có danh sách hồ sơ.';

  @override
  String get uniDbTrackTitle => 'Theo dõi trường này';

  @override
  String get uniDbTrackOnDesc =>
      'Hạn chót sẽ hiện trên trang chủ và bạn sẽ nhận thông báo đẩy khi có thay đổi.';

  @override
  String get uniDbTrackOffDesc =>
      'Bật để theo dõi hạn chót, thông báo đính chính và thay đổi yêu cầu.';

  @override
  String uniDbTrackError(Object error) {
    return 'Không thể cập nhật theo dõi: $error';
  }

  @override
  String get uniDbOpenGuidePdf => 'Mở PDF hướng dẫn tuyển sinh';

  @override
  String get uniDbNoGuidePdf => 'Chưa có PDF hướng dẫn tuyển sinh.';

  @override
  String get uniDbPdfNoApp => 'Không mở được PDF — không có ứng dụng phù hợp.';

  @override
  String uniDbPdfError(Object error) {
    return 'Không mở được PDF: $error';
  }

  @override
  String uniDbAcademicYear(int year) {
    return 'Năm học $year';
  }

  @override
  String uniDbSemesterLabel(int number) {
    return 'Học kỳ $number';
  }

  @override
  String get uniDbFirstSemester => 'học kỳ đầu';

  @override
  String uniDbAdmissionFee(String amount) {
    return '+ $amount phí nhập học';
  }

  @override
  String uniDbGpaChip(String pct) {
    return 'GPA ≥ $pct%';
  }

  @override
  String get uniDbTopikTierTable => 'Bảng mức TOPIK';

  @override
  String uniDbDocumentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count giấy tờ',
    );
    return '$_temp0';
  }

  @override
  String get uniDbApostilleRequired => 'Cần chứng nhận apostille';

  @override
  String uniDbLastVerified(String date) {
    return 'Xác minh lần cuối: $date';
  }

  @override
  String get eventOrientation => 'Định hướng tân sinh viên';

  @override
  String get eventSemesterStart => 'Bắt đầu học kỳ';

  @override
  String get facultyHumanities => 'Nhân văn';

  @override
  String get facultySocialScience => 'Khoa học xã hội';

  @override
  String get facultyNaturalScience => 'Khoa học tự nhiên';

  @override
  String get facultyEngineering => 'Kỹ thuật';

  @override
  String get facultyMedical => 'Y / Dược';

  @override
  String get facultyArts => 'Nghệ thuật';

  @override
  String get facultyPhysicalEducation => 'Giáo dục thể chất';

  @override
  String get uniDbCompareTitle => 'So sánh';

  @override
  String get uniDbCompareEmptyTitle => 'So sánh các trường';

  @override
  String get uniDbCompareEmptyBody =>
      'Theo dõi ít nhất hai trường rồi quay lại đây để so sánh.';

  @override
  String get uniDbCompareNeedSecond => 'Cần trường thứ hai để so sánh.';

  @override
  String uniDbCompareSelected(String name) {
    return 'Đang chọn: $name';
  }

  @override
  String get uniDbColEnglishName => 'Tên tiếng Anh';

  @override
  String get uniDbColUzbekName => 'Tên tiếng Uzbek';

  @override
  String get uniDbColLastVerified => 'Xác minh lần cuối';

  @override
  String get uniDbTrackerTitle => 'Theo dõi hồ sơ';

  @override
  String get uniDbTrackerEmptyTitle => 'Chưa theo dõi trường nào';

  @override
  String get uniDbTrackerEmptyBody =>
      'Theo dõi một trường trên trang của trường đó — hạn chót sẽ hiện ở đây.';

  @override
  String get uniDbLoadFailed => 'Không tải được danh sách trường đại học.';

  @override
  String get loginSubmitButton => 'Đăng nhập';

  @override
  String get welcomeGuestCaption =>
      'Không cần mã — tự do duyệt, lọc và so sánh.';
}
