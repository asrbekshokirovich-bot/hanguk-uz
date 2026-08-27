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
  String get welcomeHeadline => 'Welcome to your journey';

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
  String get guestSaveToggle => 'Save';

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
  String get welcomeGuestCaption =>
      'No code needed — browse, filter and compare freely.';

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
}
