// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

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
  String get visitUniversityWebsite => 'Visit University Website';

  @override
  String universityTier(int tier) {
    return 'Tier $tier';
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
  String get navDocs => 'Docs';

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
  String get accountTooltip => 'Account';

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
  String get aiStatusSpellCheckUnavailable => 'Device dictionary unavailable';

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
      'Analysis is part of the Premium and No Risk plans. Your current plan does not include it.';

  @override
  String get analysisErrorRateLimited =>
      'Too many analyses just now. Wait a minute and try again.';

  @override
  String get analysisErrorServiceDown =>
      'The analysis service is temporarily unavailable. Your draft is saved — try again shortly.';

  @override
  String get analysisErrorFailed =>
      'The analysis could not be completed. Your draft is saved — check your connection and try again.';

  @override
  String get analysisRetryButton => 'Try again';

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
    return 'Step $step';
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
      'Your draft\'s language doesn\'t match the track you chose. Please rewrite it in the selected language.';

  @override
  String get interviewStartError =>
      'Couldn\'t start the interview. Please check your connection and try again.';

  @override
  String get perAnswerReviewTitle => 'Answer-by-answer review';

  @override
  String get betterAnswerLabel => 'A STRONGER ANSWER';

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
  String get welcomeExploreCta => 'Explore Universities';

  @override
  String get magicCodeTitle => 'Magic code';

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
  String get statusInReview => 'In review';

  @override
  String get statusWaiting => 'Waiting';

  @override
  String get statusRejected => 'Rejected';

  @override
  String get journeyStageDocumentPrep => 'Document preparation';

  @override
  String get journeyStageOnlineApplication => 'Online application';

  @override
  String get journeyStageOfflineApplication => 'Offline application';

  @override
  String get journeyStageInterview => 'Interview';

  @override
  String get journeyStageWaitingInvoice => 'Waiting for invoice';

  @override
  String get journeyStageTuitionPayment => 'Tuition fee payment';

  @override
  String get journeyStageWaitingAdmission => 'Waiting for admission letter';

  @override
  String get journeyStageVisaPreparation => 'Preparing for visa application';

  @override
  String get journeyStageWaitingVisa => 'Waiting for visa issue';

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
  String get guestJoinCta => 'Join Hanguk';

  @override
  String get guestExploreTitle => 'Find Your University';

  @override
  String guestUniversitiesCount(int count) {
    return '$count universities';
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
  String get guestRowCity => 'City';

  @override
  String get guestRowTier => 'Tier';

  @override
  String get guestRowIeqas => 'IEQAS status';

  @override
  String get ieqasOutstanding => 'IEQAS outstanding';

  @override
  String get ieqasAccredited => 'IEQAS accredited';

  @override
  String get guestRowPartner => 'Hanguk partner';

  @override
  String get guestRowNextEvent => 'Next event';

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
  String get uniDbPhaseBadge => 'University DB · Phase 0 scaffolded';

  @override
  String get uniDbRecentChangesTitle =>
      'Updates from your tracked universities';

  @override
  String get timeJustNow => 'just now';

  @override
  String timeMinutesAgo(int minutes) {
    return '${minutes}m ago';
  }

  @override
  String timeHoursAgo(int hours) {
    return '${hours}h ago';
  }

  @override
  String timeDaysAgo(int days) {
    return '${days}d ago';
  }

  @override
  String get uniDbVerifiedDeadlinesTitle => 'Verified upcoming deadlines';

  @override
  String get deadlineClosed => 'Closed';

  @override
  String deadlineInDays(int days) {
    return 'in ${days}d';
  }

  @override
  String deadlineInHours(int hours) {
    return 'in ${hours}h';
  }

  @override
  String deadlineInMinutes(int minutes) {
    return 'in ${minutes}m';
  }

  @override
  String get eventApplyOpen => 'Application opens';

  @override
  String get eventApplyClose => 'Application closes';

  @override
  String get eventDocumentsDue => 'Documents due';

  @override
  String get eventFirstStageResults => '1st stage results';

  @override
  String get eventInterviewLabel => 'Interview';

  @override
  String get eventPracticalExam => 'Practical exam';

  @override
  String get eventFinalResults => 'Final results';

  @override
  String get eventAdditionalAdmit => 'Additional admit';

  @override
  String get eventRegistrationOpen => 'Registration opens';

  @override
  String get eventRegistrationClose => 'Registration closes';

  @override
  String get cycleForeign => 'Foreign track';

  @override
  String get cycleOverseasKoreanFull => 'Overseas Korean (full)';

  @override
  String get cycleOverseasKoreanPartial => 'Overseas Korean (partial)';

  @override
  String get cycleSusi => 'Susi';

  @override
  String get cycleJeongsi => 'Jeongsi';

  @override
  String get cycleTransfer => 'Transfer';

  @override
  String get cycleGradGeneral => 'Graduate';

  @override
  String get cycleGradForeign => 'Graduate (foreign)';

  @override
  String get uniSpecificHeader => 'University-specific interview';

  @override
  String get uniSpecificPickPrompt =>
      'Pick a university above to seed the interviewer with its recruitment unit, requirements, and key deadlines.';

  @override
  String uniSpecificLoadError(Object error) {
    return 'Could not load recruitment data: $error\nYou can still run a general interview.';
  }

  @override
  String get uniSpecificNoData =>
      'No verified recruitment data for this university yet. The interviewer will fall back to general questions until we ingest its 모집요강.';

  @override
  String get uniSpecificFallbackButton => 'Try a general interview instead';

  @override
  String uniSpecificTrackLabel(String category) {
    return 'Track: $category';
  }

  @override
  String get uniSpecificSeedNote =>
      'The interviewer will draw on this recruitment data when asking questions.';

  @override
  String get uniSpecificRecruitmentUnitFallback => 'Recruitment unit';

  @override
  String get uniDbInstitutionTitle => 'Institution';

  @override
  String get uniDbNotFoundTitle => 'Institution not found';

  @override
  String get uniDbNotFoundBody =>
      'This university isn\'t in our catalog yet. Please check back soon.';

  @override
  String get uniDbUpcomingDeadlines => 'Upcoming deadlines';

  @override
  String get uniDbNoDeadlines => 'No upcoming deadlines announced yet.';

  @override
  String get uniDbTuitionHeading => 'Tuition';

  @override
  String get uniDbTuitionEmpty => 'Tuition details aren\'t available yet.';

  @override
  String get uniDbRequirementsHeading => 'Requirements';

  @override
  String get uniDbRequirementsEmpty =>
      'Admission requirements aren\'t available yet.';

  @override
  String get uniDbScholarshipsHeading => 'Scholarships';

  @override
  String get uniDbScholarshipsEmpty =>
      'No scholarships listed for this university yet.';

  @override
  String get uniDbDocumentChecklistHeading => 'Document checklist';

  @override
  String get uniDbDocumentsEmpty =>
      'The document checklist isn\'t available yet.';

  @override
  String get uniDbTrackTitle => 'Track this institution';

  @override
  String get uniDbTrackOnDesc =>
      'You\'ll see deadlines on the home banner and get push notifications when something changes.';

  @override
  String get uniDbTrackOffDesc =>
      'Turn on to follow deadlines, correction notices, and requirement changes.';

  @override
  String uniDbTrackError(Object error) {
    return 'Could not update tracking: $error';
  }

  @override
  String get uniDbOpenGuidePdf => 'Open admission guide PDF';

  @override
  String get uniDbNoGuidePdf => 'No admission guide PDF available yet.';

  @override
  String get uniDbPdfNoApp =>
      'Could not open the PDF — no app available to handle it.';

  @override
  String uniDbPdfError(Object error) {
    return 'Could not open PDF: $error';
  }

  @override
  String uniDbAcademicYear(int year) {
    return '$year academic year';
  }

  @override
  String uniDbSemesterLabel(int number) {
    return 'Semester $number';
  }

  @override
  String get uniDbFirstSemester => 'first semester';

  @override
  String uniDbAdmissionFee(String amount) {
    return '+ $amount fee';
  }

  @override
  String uniDbGpaChip(String pct) {
    return 'GPA ≥ $pct%';
  }

  @override
  String get uniDbTopikTierTable => 'TOPIK tier table';

  @override
  String uniDbDocumentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count documents',
      one: '1 document',
    );
    return '$_temp0';
  }

  @override
  String get uniDbApostilleRequired => 'Apostille required';

  @override
  String uniDbLastVerified(String date) {
    return 'Last verified: $date';
  }

  @override
  String get eventOrientation => 'Orientation';

  @override
  String get eventSemesterStart => 'Semester starts';

  @override
  String get facultyHumanities => 'Humanities';

  @override
  String get facultySocialScience => 'Social Science';

  @override
  String get facultyNaturalScience => 'Natural Science';

  @override
  String get facultyEngineering => 'Engineering';

  @override
  String get facultyMedical => 'Medical / Pharma';

  @override
  String get facultyArts => 'Arts';

  @override
  String get facultyPhysicalEducation => 'Physical Education';

  @override
  String get uniDbCompareTitle => 'Compare';

  @override
  String get uniDbCompareEmptyTitle => 'Compare universities';

  @override
  String get uniDbCompareEmptyBody =>
      'Track at least two institutions, then return here to compare them.';

  @override
  String get uniDbCompareNeedSecond =>
      'Need a second university to compare against.';

  @override
  String uniDbCompareSelected(String name) {
    return 'Currently selected: $name';
  }

  @override
  String get uniDbColEnglishName => 'English name';

  @override
  String get uniDbColUzbekName => 'Uzbek name';

  @override
  String get uniDbColLastVerified => 'Last verified';

  @override
  String get uniDbTrackerTitle => 'Application tracker';

  @override
  String get uniDbTrackerEmptyTitle => 'No tracked universities yet';

  @override
  String get uniDbTrackerEmptyBody =>
      'Track a university on its page and its deadlines will appear here.';

  @override
  String get uniDbLoadFailed => 'Couldn\'t load the university list.';

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
  String get homeNotifications => 'Notifications';

  @override
  String get notifApplicationUpdates => 'Application updates';

  @override
  String get notifToUpload => 'To upload';

  @override
  String get notifAllCaughtUp => 'You\'re all caught up';

  @override
  String get notifAllCaughtUpBody =>
      'Reminders about your documents and applications will appear here.';

  @override
  String get guestContactEyebrow => 'Hanguk Consulting';

  @override
  String get guestContactTitle => 'Get in touch';

  @override
  String get guestContactSubtitle =>
      'Pick a channel — we answer on all of them.';

  @override
  String get guestContactTelegramChannel => 'Telegram channel';

  @override
  String get guestContactTelegramChannelHint =>
      'News, deadlines and open intakes';

  @override
  String get guestContactTelegramDirect => 'Message us on Telegram';

  @override
  String get guestContactTelegramDirectHint => 'Ask a consultant directly';

  @override
  String get guestContactInstagram => 'Instagram';

  @override
  String get guestContactInstagramHint => 'Students, campuses, daily life';

  @override
  String get guestContactCall => 'Call us';

  @override
  String get guestContactJoinHint => 'Already have a magic code?';

  @override
  String get guestContactLaunchFailed =>
      'Couldn\'t open that link on this device.';

  @override
  String get guestContactCta => 'Contact us';

  @override
  String get aiReportAction => 'Report';

  @override
  String get aiReportTitle => 'Report this response';

  @override
  String get aiReportBody =>
      'Tell us what is wrong with this AI response. Our team reviews every report.';

  @override
  String get aiReportReasonHint => 'What is wrong with it? (optional)';

  @override
  String get aiReportSubmit => 'Send report';

  @override
  String get aiReportThanks => 'Thank you. Our team will review this response.';

  @override
  String get aiReportFailed => 'Could not send the report. Please try again.';

  @override
  String get catalogSearchHint => 'Search university name';

  @override
  String get catalogListTitle => 'Universities';

  @override
  String catalogCityUniversities(String city) {
    return '$city universities';
  }

  @override
  String get catalogEmptyTitle => 'No universities found';

  @override
  String get catalogEmptyBody => 'Try another city or filter.';

  @override
  String get catalogTypeState => 'State university';

  @override
  String get catalogTypePrivate => 'Private university';

  @override
  String get catalogTypeSpecialized => 'Specialized institute';

  @override
  String get catalogTypeStateShort => 'State';

  @override
  String get catalogTypePrivateShort => 'Private';

  @override
  String get catalogTypeSpecializedShort => 'Specialized';

  @override
  String get catalogFilterTitle => 'Filter';

  @override
  String get catalogFilterClear => 'Clear';

  @override
  String get catalogFilterCity => 'City';

  @override
  String catalogFilterCityPicked(int count) {
    return '$count selected';
  }

  @override
  String get catalogFilterDegree => 'Degree';

  @override
  String get catalogDegreeBachelor => 'Bachelor';

  @override
  String get catalogDegreeMaster => 'Master';

  @override
  String get catalogFilterEnglish => 'English requirement';

  @override
  String get catalogFilterEnglishHint => 'your IELTS score';

  @override
  String get catalogIeltsNone => 'Not needed';

  @override
  String get catalogIeltsNoteAll => 'All programmes (Korean and English)';

  @override
  String catalogIeltsNote(String score) {
    return 'Only English-taught programmes you can enter with IELTS $score';
  }

  @override
  String get catalogFilterPrice => 'Tuition';

  @override
  String get catalogPricePerSemester => 'per semester';

  @override
  String get catalogPriceFrom => 'From';

  @override
  String get catalogPriceTo => 'To';

  @override
  String catalogPriceUpTo(String amount) {
    return 'up to $amount';
  }

  @override
  String catalogApply(int count) {
    return 'Show $count universities';
  }

  @override
  String get catalogFaculties => 'Faculties';

  @override
  String catalogFacultyCount(int count) {
    return '$count faculties';
  }

  @override
  String catalogProgramCount(int count) {
    return '$count programmes';
  }

  @override
  String catalogTuitionTitle(String name) {
    return 'Tuition · $name';
  }

  @override
  String get catalogPerSemester => '/ semester';

  @override
  String get catalogPerYear => '/ year';

  @override
  String get catalogSemSuffix => '/sem';

  @override
  String get catalogYearSuffix => '/yr';

  @override
  String get catalogYearlyTuition => 'Yearly tuition';

  @override
  String get catalogApplicationFee => 'Application fee';

  @override
  String get catalogEntranceFee => 'Entrance fee';

  @override
  String get catalogRequirements => 'Admission requirements';

  @override
  String get catalogReqKorean => 'Korean language';

  @override
  String get catalogReqEnglish => 'For English programmes';

  @override
  String get catalogReqRecommendation => 'Recommendation letter';

  @override
  String get catalogRecYes => 'Required';

  @override
  String get catalogRecNo => 'Not needed';

  @override
  String get catalogRecOptional => 'Optional';

  @override
  String get catalogReqDocuments => 'Documents';

  @override
  String catalogDocsRequired(int count) {
    return '$count required';
  }

  @override
  String get catalogReqApostille => 'Apostille';

  @override
  String catalogApostilleDocs(int count) {
    return 'on $count documents';
  }

  @override
  String get catalogReqBank => 'Bank balance (D-2)';

  @override
  String catalogTimeline(String season) {
    return 'Deadlines · $season';
  }

  @override
  String get catalogRoundLater => 'Announced later';

  @override
  String get catalogRoundEstimated => 'estimated';

  @override
  String get catalogRoundRelative => 'No fixed date';

  @override
  String get catalogWindowLabel => 'Document submission';

  @override
  String catalogDaysLeft(int days) {
    return '$days days left';
  }

  @override
  String catalogWindowOpens(String date) {
    return 'Opens $date';
  }

  @override
  String get catalogWindowClosed => 'Deadline passed';

  @override
  String get catalogContact => 'Contact us';

  @override
  String get catalogSeasonSpring => 'Spring';

  @override
  String get catalogSeasonAutumn => 'Autumn';

  @override
  String catalogSeasonLabel(String year, String term) {
    return '$year $term';
  }

  @override
  String get catalogFavorite => 'Add to compare';

  @override
  String get catalogNoDegreeData => 'No data for this degree yet';

  @override
  String get catalogCompareChip => 'Compare';

  @override
  String catalogCompareChipCount(int count) {
    return 'Compare · $count/2';
  }

  @override
  String get catalogComparePickTwo => 'Choose 2 universities';

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
      'Could not reach the server. Check your connection and try again.';

  @override
  String get entryShowPassword => 'Show password';

  @override
  String get entryHidePassword => 'Hide password';

  @override
  String get entryLanguageLabel => 'Language';

  @override
  String get entryLanguageSheetTitle => 'Choose a language';

  @override
  String get catalogStep1 => 'Online application';

  @override
  String get catalogStep2 => 'Application fee payment';

  @override
  String get catalogStep3 => 'Offline document submission';

  @override
  String get catalogStep4 => 'Bank statement (for the university)';

  @override
  String get catalogStep5 => 'Interview';

  @override
  String get catalogStep6 => 'Results announced';

  @override
  String get catalogStep7 => 'Tuition payment';

  @override
  String get catalogStep8 => 'Certificate of Admission issued';

  @override
  String get catalogStep9 => 'Bank statement for the visa';

  @override
  String get catalogStep10 => 'Translation and apostille for the visa';

  @override
  String get catalogStep11 => 'Visa application';

  @override
  String get surveysTitle => 'Surveys';

  @override
  String get surveysLoadError => 'Couldn\'t load surveys';

  @override
  String get surveysEmptyTitle => 'No surveys yet';

  @override
  String get surveysEmptyBody => 'New surveys will appear here';

  @override
  String get surveyCompletedChip => 'Completed';

  @override
  String get surveyNewChip => 'New';

  @override
  String surveyQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count questions',
      one: '1 question',
    );
    return '$_temp0';
  }

  @override
  String get surveyFillCta => 'Fill in →';

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
  String get surveyTitleFallback => 'Survey';

  @override
  String get surveyAnswerAllRequired => 'Please answer all required questions';

  @override
  String get surveySubmitError =>
      'Couldn\'t send your answers. Please try again.';

  @override
  String get surveyThanksTitle => 'Thank you!';

  @override
  String get surveyThanksBody => 'Your answers have been received';

  @override
  String get surveyQuestionsLoadError => 'Couldn\'t load the questions';

  @override
  String get surveyNoQuestions => 'No questions found';

  @override
  String get surveyAlreadyCompleted => 'You\'ve already completed this survey';

  @override
  String get surveySubmit => 'Submit';

  @override
  String get surveyRequired => 'Required';

  @override
  String get surveyEmailHint => 'example@mail.com';

  @override
  String get surveyNumberHint => 'Enter a number';

  @override
  String get surveyLongTextHint => 'Write in detail...';

  @override
  String get surveyTextHint => 'Write your answer...';

  @override
  String get surveyPickDate => 'Pick a date';

  @override
  String get docTypeIdCard => 'Applicant\'s ID card (passport) copy';

  @override
  String get docTypeForeignPassport => 'Applicant\'s foreign passport copy';

  @override
  String get docTypePhoto => 'Photo (3.5x4.5 cm)';

  @override
  String get docTypeDiploma => 'Diploma or school certificate copy';

  @override
  String get docTypeLanguageCertificate =>
      'Language certificate copy (at least IELTS 5.5 or TOPIK 2)';

  @override
  String get docTypeOther => 'Document';

  @override
  String get docStatusLocked => 'Locked';

  @override
  String get notifPushSection => 'Recent notifications';

  @override
  String get notifMarkAllRead => 'Mark all read';

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
  String get statusPendingApproval => 'Awaiting approval';

  @override
  String get statusDocumentsCollection => 'Documents collected';

  @override
  String get statusDocumentsTranslation => 'Documents translated';

  @override
  String get statusApostille => 'Apostille ready';

  @override
  String get statusApplicationSubmitted => 'Application submitted';

  @override
  String get statusUniversityResponse => 'University replied';

  @override
  String get statusVisaDocuments => 'Visa documents';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusInProgress => 'In progress';

  @override
  String get chatGreeting =>
      'Hi! 👋 I\'m the Hanguk AI assistant. Ask me anything about documents, universities or the application process!';

  @override
  String get chatNoResponse => 'Sorry, I couldn\'t generate a response.';

  @override
  String get chatConnectError =>
      'Couldn\'t reach Hanguk AI. Check your connection.';

  @override
  String get chatCleared => 'Chat cleared. How can I help you?';

  @override
  String get mapLoadFailed =>
      'The map didn\'t load. Check your internet connection.';

  @override
  String get mapTapForDetails => 'Tap for details';

  @override
  String get mapProviderUnavailable =>
      'The map service is unavailable right now.';

  @override
  String get mapInitError => 'Couldn\'t start the map.';

  @override
  String get trainingGuideSpTitle => 'Study Plan writing guide';

  @override
  String get trainingGuideSpIntro =>
      'A Study Plan explains why you want to study in South Korea, the goals you have set for yourself, and what you plan to do after graduation.';

  @override
  String get trainingGuideSp1Title => '1. Purpose & motivation';

  @override
  String get trainingGuideSp1Body =>
      'Why did you choose this major? Why does South Korea — and the specific university you applied to — fit that goal?';

  @override
  String get trainingGuideSp2Title => '2. Academic plan';

  @override
  String get trainingGuideSp2Body =>
      'Which courses or research areas will you focus on? What is your Korean-language learning plan?';

  @override
  String get trainingGuideSp3Title => '3. Future plans';

  @override
  String get trainingGuideSp3Body =>
      'What do you intend to do after graduation? How will you contribute back home?';

  @override
  String get trainingGuidePsTitle => 'Personal Statement writing guide';

  @override
  String get trainingGuidePsIntro =>
      'A Personal Statement is an essay that shows who you are, what you have achieved, what interests you, and why you fit this major.';

  @override
  String get trainingGuidePs1Title => '1. Past & experience';

  @override
  String get trainingGuidePs1Body =>
      'Write about your school achievements, the olympiads or projects you joined, and the interests you developed.';

  @override
  String get trainingGuidePs2Title => '2. Personal strengths';

  @override
  String get trainingGuidePs2Body =>
      'What sets you apart from other applicants? How did you handle setbacks?';

  @override
  String get trainingGuidePs3Title => '3. Why this field?';

  @override
  String get trainingGuidePs3Body =>
      'When and how did your interest in this field start?';

  @override
  String get trainingStatusInProgress => 'In progress';

  @override
  String get trainingStatusCompleted => 'Completed';

  @override
  String get trainingStatusAbandoned => 'Stopped';

  @override
  String get trainingErrorSessionsLoad =>
      'Couldn\'t load your drafts. Please try again.';

  @override
  String get trainingErrorCreateDraft =>
      'Couldn\'t create the draft. Please try again.';

  @override
  String get trainingErrorLoadDraft =>
      'Couldn\'t open the draft. Please try again.';

  @override
  String get trainingErrorDraftConflict =>
      'Another device saved a newer draft. Please refresh to merge.';

  @override
  String get trainingErrorTrackUpdate =>
      'Couldn\'t change the writing language. Please try again.';

  @override
  String get trainingErrorGeneric => 'Something went wrong. Please try again.';

  @override
  String get trainingInterviewAiError =>
      'The AI interviewer ran into a problem. Please try again.';

  @override
  String get trainingInterviewAnswerError =>
      'Couldn\'t process your answer. Please try again.';

  @override
  String get trainingInterviewVoiceError =>
      'Couldn\'t play the interviewer\'s voice.';

  @override
  String get trainingInterviewAudioLinkWarning =>
      'Couldn\'t save the recording link. Replay may be unavailable.';

  @override
  String get trainingInterviewFeedbackLoadError =>
      'Couldn\'t load the feedback. Please try again.';

  @override
  String get authErrorCodeNotFound =>
      'We don\'t recognise this code. Please double-check it with your counsellor.';

  @override
  String get authErrorServerUnreachable =>
      'We could not reach the server. Please check your connection and tap sign in again.';

  @override
  String get authErrorStaffBlocked =>
      'Staff members must use username/password sign-in, not a magic code.';

  @override
  String get authErrorAccountSetupBusy =>
      'The server is busy setting up your account. Please try again in 30 seconds.';

  @override
  String get authErrorLoginServer =>
      'Login server error. Please try again, or ask your counsellor to reset your account.';

  @override
  String get authErrorUnexpected =>
      'Unexpected server error. Please try again, or contact your counsellor.';

  @override
  String get authErrorCrmAccount =>
      'This account was created by your counsellor. Please use the Magic Access Code they gave you.';

  @override
  String get authErrorAlreadyRegistered =>
      'This phone number is already registered. Please sign in.';

  @override
  String get authErrorSignUpDisabled =>
      'Registration is currently disabled. Please contact an administrator.';

  @override
  String get authErrorPhoneFormat =>
      'Invalid phone number format. Please include the country code.';

  @override
  String get authErrorSignUpFailed =>
      'Couldn\'t create your account. Please try again.';

  @override
  String get a11yMenu => 'Menu';

  @override
  String get accountExportShareSubject => 'Hanguk — your data export';

  @override
  String get accountExportShareText => 'Your Hanguk data export (JSON).';

  @override
  String get accountExportError =>
      'Couldn\'t export your data. Please try again.';

  @override
  String get uniDbEventOther => 'Key date';

  @override
  String get uniDbIeqasNone => 'No IEQAS accreditation';

  @override
  String get uniDbPdfLinkInvalid =>
      'Couldn\'t open the link. Please try again.';

  @override
  String get uniDbFacultyMedicine => 'Medicine';

  @override
  String get uniDbFacultyPharmacy => 'Pharmacy';

  @override
  String get uniDbFacultyArtsPe => 'Arts & Sports';

  @override
  String get uniDbFacultyTheology => 'Theology';

  @override
  String get uniDbFacultyInterdisciplinary => 'Interdisciplinary';

  @override
  String get uniDbFacultyAll => 'All faculties';

  @override
  String get uniDbScholarshipScopeUniversity => 'University';

  @override
  String get uniDbScholarshipScopeNational => 'Government';

  @override
  String get uniDbScholarshipScopeRegional => 'Regional';

  @override
  String get uniDbScholarshipScopeFoundation => 'Foundation';

  @override
  String get uniDbScholarshipScopeDepartment => 'Department';

  @override
  String uniDbAwardTuitionPct(String pct) {
    return '$pct% tuition waiver';
  }

  @override
  String get uniDbAwardTuition => 'Tuition waiver';

  @override
  String uniDbAwardTuitionKrw(String amount) {
    return '$amount off tuition';
  }

  @override
  String uniDbAwardStipendMonthly(String amount) {
    return '$amount monthly stipend';
  }

  @override
  String get uniDbAwardStipend => 'Monthly stipend';

  @override
  String uniDbAwardAirfare(String amount) {
    return 'Airfare up to $amount';
  }

  @override
  String get uniDbAwardAirfareCovered => 'Airfare covered';

  @override
  String get uniDbAwardOther => 'Other benefit';

  @override
  String uniDbTopikDeferred(String base) {
    return '$base (can be submitted later)';
  }

  @override
  String get uniDbChangeAdmissionCycle => 'Admission cycle';

  @override
  String get uniDbChangeDates => 'Dates';

  @override
  String get uniDbChangeUpdated => 'Updated';

  @override
  String get uniDbDocApostille => 'Apostille';

  @override
  String get uniDbDocConsent => 'Consent form';

  @override
  String get uniDbDocPassport => 'Passport';

  @override
  String get uniDbDocTopik => 'TOPIK certificate';

  @override
  String get uniDbDocLanguage => 'Language certificate';

  @override
  String get uniDbDocTranscript => 'Transcript';

  @override
  String get uniDbDocDiploma => 'Diploma';

  @override
  String get uniDbDocEnrollment => 'Certificate of enrollment';

  @override
  String get uniDbDocFamily => 'Family relationship certificate';

  @override
  String get uniDbDocPowerOfAttorney => 'Power of attorney';

  @override
  String get uniDbDocFinance => 'Proof of funds';

  @override
  String get uniDbDocEntryExit => 'Entry and exit record';

  @override
  String get uniDbDocEmployment => 'Employment certificate';

  @override
  String get uniDbDocRecommendation => 'Recommendation letter';

  @override
  String get uniDbDocCitizenship => 'Proof of citizenship';

  @override
  String get uniDbDocStatement => 'Personal statement & study plan';

  @override
  String get uniDbDocAlienRegistration => 'Alien registration card';

  @override
  String get uniDbDocIdCard => 'ID card copy';

  @override
  String get uniDbDocPhoto => 'Photo';

  @override
  String get uniDbDocPortfolio => 'Portfolio';

  @override
  String get uniDbDocHealth => 'Medical certificate';

  @override
  String get uniDbDocCalendar => 'School calendar';

  @override
  String get uniDbDocTax => 'Tax payment certificate';

  @override
  String get uniDbDocBusinessRegistration =>
      'Business registration certificate';

  @override
  String get uniDbDocAward => 'Award certificate';

  @override
  String get uniDbDocApplicationForm => 'Application form';

  @override
  String get uniDbDocOther => 'Additional document';

  @override
  String get adminReviewQueueTitle => 'Review queue';

  @override
  String get adminReviewTitle => 'Review';

  @override
  String get adminRefresh => 'Refresh';

  @override
  String get adminQueueEmpty => 'Queue is empty. Nothing pending right now.';

  @override
  String get adminSelectItem => 'Select a queue item on the left.';

  @override
  String get adminAccepted => 'Accepted';

  @override
  String get adminEditedAccepted => 'Edited and accepted';

  @override
  String get adminRejected => 'Rejected';

  @override
  String get adminBackToQueue => 'Back to queue';

  @override
  String adminConfidence(int pct) {
    return 'Confidence $pct%';
  }

  @override
  String get adminOverdue => 'Overdue';

  @override
  String get adminOpenSource => 'Open source page (Korean)';

  @override
  String get adminExtractedPayload => 'Extracted data:';

  @override
  String get adminReject => 'Reject';

  @override
  String get adminEditAccept => 'Edit & accept';

  @override
  String get adminAccept => 'Accept';

  @override
  String get adminPayloadNotObject => 'Data must be a JSON object';

  @override
  String adminInvalidJson(String error) {
    return 'Invalid JSON: $error';
  }

  @override
  String get adminEditPayload => 'Edit data';

  @override
  String get adminSaveAccept => 'Save & accept';

  @override
  String get adminRejectReasonTitle => 'Reject — reason';

  @override
  String get adminDetailOptional => 'Details (optional)';

  @override
  String get adminStaffOnly =>
      'This area is for Hanguk staff only. If you should have access, ask an admin to add your staff role.';

  @override
  String get adminPriorityP1 => 'P1 — correction notice (4h)';

  @override
  String get adminPriorityP2 => 'P2 — attachment change (12h)';

  @override
  String get adminPriorityP3 => 'P3 — D3 field with diff (24h)';

  @override
  String get adminPriorityP4 => 'P4 — D2 routine (48h)';

  @override
  String get adminPriorityP5 => 'P5 — D1 trivial (96h)';

  @override
  String get adminReasonLowConfidence => 'Low confidence';

  @override
  String get adminReasonHighDifficulty => 'Hard field';

  @override
  String get adminReasonAutoApproved => 'Auto-approved';

  @override
  String get adminReasonCorrectionNotice => 'Correction notice';

  @override
  String get adminEntityExtraction => 'Extraction';

  @override
  String get adminEntityGuideline => 'Admission guide';

  @override
  String get adminRejectWrongYear => 'Wrong year';

  @override
  String get adminRejectWrongArchetype => 'Wrong document type';

  @override
  String get adminRejectHallucinated => 'Invented field';

  @override
  String get adminRejectOcrGarbled => 'Garbled OCR text';

  @override
  String get adminRejectSource404 => 'Source page not found (404)';

  @override
  String get adminRejectOther => 'Other';

  @override
  String get interviewErrorNoGreeting =>
      'The interviewer did not respond. Please go back and try again.';

  @override
  String get interviewErrorEndedBeforeGreeting =>
      'The call ended before the interviewer could speak. Please try again.';

  @override
  String get interviewErrorCallFailed =>
      'The call could not be connected. Please check your internet and try again.';

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
  String get onbResultFactorKoreanStrong => 'TOPIK 3 or higher';

  @override
  String get onbResultFactorKoreanTopik2Degree =>
      'TOPIK 2, many universities ask for TOPIK 3';

  @override
  String get onbResultFactorKoreanMissingDegree =>
      'Below TOPIK 2, many universities ask for TOPIK 3';

  @override
  String get onbResultFactorKoreanCollegeStrong => 'TOPIK 3 or higher';

  @override
  String get onbResultFactorKoreanCollegeTopik2 =>
      'TOPIK 2 — vocational colleges accept TOPIK 2';

  @override
  String get onbResultFactorKoreanCourseCertificate =>
      'Sejong 1A / TOPIK 1 certificate';

  @override
  String get onbResultFactorKoreanCourseMissing =>
      'No Korean language certificate';

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
  String get onbResultFactorBudgetLow =>
      'Budget is below the estimated yearly cost';

  @override
  String get onbResultUnisTitle => 'Universities that fit you';

  @override
  String get onbResultAccredited => 'Accredited';

  @override
  String get onbResultTuitionLabel => 'Tuition/semester';

  @override
  String get onbResultTopikLabel => 'TOPIK required';

  @override
  String get onbResultBankLabel => 'Bank statement';

  @override
  String get onbResultYearlyCost => 'Estimated yearly cost';

  @override
  String get onbResultStepsTitle => 'Next 3 steps';

  @override
  String get onbResultStepTopikPrep =>
      'Prepare for TOPIK 3 or enter through a language course';

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
  String get onbResultPathLanguageCourse => 'Through a language course (D-4)';

  @override
  String get onbResultPathLanguageCourseNote =>
      'A language course, then moving on to a bachelor\'s.';

  @override
  String get onbResultPathCollege => 'Vocational college';

  @override
  String get onbResultPathCollegeNote => 'Softer requirements, lower tuition.';

  @override
  String get onbResultPathNextSeason => 'Preparing for the next season';

  @override
  String get onbResultPathNextSeasonNote =>
      'Fall 2027 with TOPIK 3 and a bank statement.';

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
  String get onbWelcomeTitle =>
      'Study in Korea — find out your chances in 2 minutes';

  @override
  String get onbWelcomeBody =>
      'An honest assessment: no percentages, no guarantees — just the rules and your answers.';

  @override
  String get onbWelcomeCta => 'Check my chances';

  @override
  String get onbWelcomeCatalog => 'Browse universities';

  @override
  String get onbWelcomeTrustReply => 'Operator reply';

  @override
  String onbWelcomeTrustReplyValue(String minutes) {
    return '≤$minutes min';
  }

  @override
  String get onbWelcomeClientCode => 'I have a client code';

  @override
  String get onbQuizContinue => 'Continue';

  @override
  String get onbQuizBack => 'Back';

  @override
  String get onbQuizQ1 => 'What would you like to study?';

  @override
  String get onbQuizRouteCourse => 'Language course';

  @override
  String get onbQuizRouteBachelor => 'Bachelor\'s';

  @override
  String get onbQuizRouteMaster => 'Master\'s';

  @override
  String get onbQuizRouteCollege => 'Vocational college';

  @override
  String onbQuizGradYearOrEarlier(String year) {
    return '$year or earlier';
  }

  @override
  String get onbQuizStillStudying => 'Still studying';

  @override
  String get onbQuizQ3 => 'Your Korean level?';

  @override
  String get onbQuizQ3Hint =>
      'Answer even without a certificate — it decides the route.';

  @override
  String get onbQuizKoreanNone => 'None';

  @override
  String get onbQuizKoreanLearning => 'Learning, no certificate';

  @override
  String get onbQuizKoreanTopik1 => 'Sejong 1A / TOPIK 1';

  @override
  String get onbQuizKoreanTopik2 => 'TOPIK 2';

  @override
  String get onbQuizKoreanTopik3 => 'TOPIK 3 or higher';

  @override
  String get onbQuizKoreanUnknown => 'Not sure yet';

  @override
  String get onbQuizBudgetUnder3 => 'Up to \$3,000';

  @override
  String get onbQuizBudget3to6 => '\$3–6k';

  @override
  String get onbQuizBudget6to10 => '\$6–10k';

  @override
  String get onbQuizBudgetOver10 => '\$10,000+';

  @override
  String get onbQuizQ5 => 'Do your parents have an official income?';

  @override
  String get onbQuizIncomeYes => 'Yes, official income';

  @override
  String get onbQuizIncomeNo => 'No';

  @override
  String get onbQuizIntakeSpring2027 => 'Spring 2027';

  @override
  String get onbQuizIntakeFall2027 => 'Fall 2027';

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
  String get onbQuizIeltsQ => 'Your IELTS score?';

  @override
  String get onbQuizIeltsNone => 'None';

  @override
  String get onbQuizIelts55 => 'IELTS 5.5';

  @override
  String get onbQuizIelts60 => 'IELTS 6.0';

  @override
  String get onbQuizIelts65 => 'IELTS 6.5 or higher';

  @override
  String get onbQuizIeltsUnknown => 'Not sure yet';

  @override
  String get onbQuizBudgetQ =>
      'How much can you spend a year on study and living?';

  @override
  String get onbQuizPayerQ => 'Who pays?';

  @override
  String get onbQuizPayerParentsOption => 'My parents';

  @override
  String get onbQuizPayerSelfOption => 'Myself';

  @override
  String get onbQuizPayerSponsorOption => 'A sponsor';

  @override
  String get onbQuizRegionQ => 'Which region are you from?';

  @override
  String get onbQuizIntakeQ => 'When do you want to go?';

  @override
  String get onbResultFactorEnglishStrong => 'IELTS 5.5 or higher';
}
