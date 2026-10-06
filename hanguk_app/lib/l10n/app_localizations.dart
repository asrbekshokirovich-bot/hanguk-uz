import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ko.dart';
import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';
import 'app_localizations_vi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('uz'),
    Locale('ko'),
    Locale('ru'),
    Locale('vi'),
  ];

  /// Title of the Training bottom-nav tab.
  ///
  /// In en, this message translates to:
  /// **'Training Center'**
  String get trainingTabTitle;

  /// One-line description of the Training tab.
  ///
  /// In en, this message translates to:
  /// **'Prepare for your university applications with AI-guided training modules.'**
  String get trainingTabSubtitle;

  /// No description provided for @studyPlanCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Study Plan Builder'**
  String get studyPlanCardTitle;

  /// No description provided for @studyPlanCardDesc.
  ///
  /// In en, this message translates to:
  /// **'Craft a compelling roadmap for your academic journey.'**
  String get studyPlanCardDesc;

  /// No description provided for @personalStatementCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Personal Statement'**
  String get personalStatementCardTitle;

  /// No description provided for @personalStatementCardDesc.
  ///
  /// In en, this message translates to:
  /// **'Write effective and engaging personal essays.'**
  String get personalStatementCardDesc;

  /// No description provided for @interviewCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Interview Preparation'**
  String get interviewCardTitle;

  /// No description provided for @interviewCardDesc.
  ///
  /// In en, this message translates to:
  /// **'Practice mock questions and improve your confidence.'**
  String get interviewCardDesc;

  /// No description provided for @applyCta.
  ///
  /// In en, this message translates to:
  /// **'Apply to a university'**
  String get applyCta;

  /// No description provided for @noApplicationsTitle.
  ///
  /// In en, this message translates to:
  /// **'No applications yet'**
  String get noApplicationsTitle;

  /// No description provided for @noApplicationsBody.
  ///
  /// In en, this message translates to:
  /// **'Add a target university first — drafting starts from a target school.'**
  String get noApplicationsBody;

  /// No description provided for @startInterview.
  ///
  /// In en, this message translates to:
  /// **'Start Interview'**
  String get startInterview;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @endInterview.
  ///
  /// In en, this message translates to:
  /// **'End Interview'**
  String get endInterview;

  /// No description provided for @endSession.
  ///
  /// In en, this message translates to:
  /// **'End Session'**
  String get endSession;

  /// No description provided for @practiceAgain.
  ///
  /// In en, this message translates to:
  /// **'Practice Again'**
  String get practiceAgain;

  /// No description provided for @connecting.
  ///
  /// In en, this message translates to:
  /// **'Connecting...'**
  String get connecting;

  /// No description provided for @greetWait.
  ///
  /// In en, this message translates to:
  /// **'Connecting — your interviewer will greet you shortly...'**
  String get greetWait;

  /// No description provided for @yourTurn.
  ///
  /// In en, this message translates to:
  /// **'Your turn to speak'**
  String get yourTurn;

  /// No description provided for @aiSpeaking.
  ///
  /// In en, this message translates to:
  /// **'Interviewer is speaking...'**
  String get aiSpeaking;

  /// No description provided for @wrappingUp.
  ///
  /// In en, this message translates to:
  /// **'Wrapping up the interview...'**
  String get wrappingUp;

  /// No description provided for @micRequired.
  ///
  /// In en, this message translates to:
  /// **'Microphone access is required for the interview.'**
  String get micRequired;

  /// Shown while the Kakao Roadview WebView is fetching a panorama.
  ///
  /// In en, this message translates to:
  /// **'Loading campus walkaround'**
  String get walkaroundLoadingTitle;

  /// No description provided for @walkaroundLoadingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Fetching street view near campus.'**
  String get walkaroundLoadingSubtitle;

  /// Shown when no Kakao panorama is found within 200m of the campus pin.
  ///
  /// In en, this message translates to:
  /// **'No street view here'**
  String get walkaroundNoPanoTitle;

  /// No description provided for @walkaroundNoPanoSubtitle.
  ///
  /// In en, this message translates to:
  /// **'This campus doesn\'t have a walkable street view nearby.'**
  String get walkaroundNoPanoSubtitle;

  /// Shown when the Kakao JS SDK loads but is blocked at runtime.
  ///
  /// In en, this message translates to:
  /// **'Street view unavailable'**
  String get walkaroundBlockedTitle;

  /// No description provided for @walkaroundBlockedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'The map provider blocked this request. Try again on a different network.'**
  String get walkaroundBlockedSubtitle;

  /// Shown when the Kakao JS SDK fails to load (network error).
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t reach the map provider'**
  String get walkaroundNetworkTitle;

  /// No description provided for @walkaroundNetworkSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Check your connection and try again.'**
  String get walkaroundNetworkSubtitle;

  /// Shown when initializing the Kakao Roadview throws unexpectedly.
  ///
  /// In en, this message translates to:
  /// **'Street view couldn\'t start'**
  String get walkaroundInitErrorTitle;

  /// No description provided for @walkaroundInitErrorSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong starting the walkaround. Please try again.'**
  String get walkaroundInitErrorSubtitle;

  /// Button label for the curated panorama tour (Pannellum), when available.
  ///
  /// In en, this message translates to:
  /// **'Virtual Tour'**
  String get virtualTourTitle;

  /// Button label for the Kakao Roadview walkaround.
  ///
  /// In en, this message translates to:
  /// **'Virtual Walkaround'**
  String get virtualWalkaroundTitle;

  /// Outline button in the university detail sheet that opens the institution's official homepage (institutions.primary_domain).
  ///
  /// In en, this message translates to:
  /// **'Visit University Website'**
  String get visitUniversityWebsite;

  /// Chip label for a non-top quality tier (2-4) on a university card or detail sheet.
  ///
  /// In en, this message translates to:
  /// **'Tier {tier}'**
  String universityTier(int tier);

  /// Chip label shown when the institution holds an IEQAS accreditation.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get universityVerified;

  /// Chip label preceding the date of the institution's next admission-cycle event.
  ///
  /// In en, this message translates to:
  /// **'Next event'**
  String get universityNextEvent;

  /// Bottom-nav label for the Applications tab (opens ApplicationsTab with AppBar title 'My Applications'). Renamed from navHome in the 2026-05-12 UI/UX audit P0 #5 — 'Home' was a misnomer because the tab is the Applications screen, not a landing/home screen.
  ///
  /// In en, this message translates to:
  /// **'Applications'**
  String get navApplications;

  /// Bottom-nav label for the Map tab.
  ///
  /// In en, this message translates to:
  /// **'Map'**
  String get navMap;

  /// Bottom-nav label for the Documents tab.
  ///
  /// In en, this message translates to:
  /// **'Docs'**
  String get navDocs;

  /// Bottom-nav label for the Training tab. Kept short for the nav bar — the full screen title is trainingTabTitle.
  ///
  /// In en, this message translates to:
  /// **'Training'**
  String get navTraining;

  /// AppBar title for the Applications tab.
  ///
  /// In en, this message translates to:
  /// **'My Applications'**
  String get applicationsTabTitle;

  /// Top-bar title for the Map tab.
  ///
  /// In en, this message translates to:
  /// **'Universities'**
  String get mapTabTitle;

  /// AppBar title for the Documents tab.
  ///
  /// In en, this message translates to:
  /// **'My Documents'**
  String get documentsTabTitle;

  /// No description provided for @documentUploadInfo.
  ///
  /// In en, this message translates to:
  /// **'Upload valid PDF or JPEG scans of your original documents. Max 10MB per file.'**
  String get documentUploadInfo;

  /// No description provided for @documentsRequiredHeading.
  ///
  /// In en, this message translates to:
  /// **'Required Documents'**
  String get documentsRequiredHeading;

  /// No description provided for @documentUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t upload your document. Please try again.'**
  String get documentUploadFailed;

  /// No description provided for @documentPreviewFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the document. Please try again.'**
  String get documentPreviewFailed;

  /// No description provided for @documentLoadError.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load your documents.'**
  String get documentLoadError;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get commonRetry;

  /// No description provided for @onboardingSkip.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get onboardingSkip;

  /// No description provided for @onboardingNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get onboardingNext;

  /// No description provided for @onboardingStart.
  ///
  /// In en, this message translates to:
  /// **'Get Started'**
  String get onboardingStart;

  /// No description provided for @onboardingStep1Title.
  ///
  /// In en, this message translates to:
  /// **'Track your applications'**
  String get onboardingStep1Title;

  /// No description provided for @onboardingStep1Body.
  ///
  /// In en, this message translates to:
  /// **'Follow every university application from documents to decision, all in one place.'**
  String get onboardingStep1Body;

  /// No description provided for @onboardingStep2Title.
  ///
  /// In en, this message translates to:
  /// **'Explore universities & upload documents'**
  String get onboardingStep2Title;

  /// No description provided for @onboardingStep2Body.
  ///
  /// In en, this message translates to:
  /// **'Find universities on the map and securely upload the documents each one needs.'**
  String get onboardingStep2Body;

  /// No description provided for @onboardingStep3Title.
  ///
  /// In en, this message translates to:
  /// **'Practice interviews with AI'**
  String get onboardingStep3Title;

  /// No description provided for @onboardingStep3Body.
  ///
  /// In en, this message translates to:
  /// **'Rehearse Korean admission interviews with the AI coach and get instant feedback.'**
  String get onboardingStep3Body;

  /// No description provided for @appsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No applications yet'**
  String get appsEmptyTitle;

  /// No description provided for @appsEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Your applications will appear here once you apply to a university.'**
  String get appsEmptyBody;

  /// No description provided for @appsLoadError.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load your applications.'**
  String get appsLoadError;

  /// No description provided for @appsPendingHeading.
  ///
  /// In en, this message translates to:
  /// **'Pending Applications'**
  String get appsPendingHeading;

  /// No description provided for @appsActiveHeading.
  ///
  /// In en, this message translates to:
  /// **'Active Applications'**
  String get appsActiveHeading;

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search...'**
  String get searchHint;

  /// No description provided for @clearSearch.
  ///
  /// In en, this message translates to:
  /// **'Clear search'**
  String get clearSearch;

  /// No description provided for @filterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get filterAll;

  /// No description provided for @filterPartner.
  ///
  /// In en, this message translates to:
  /// **'Partner'**
  String get filterPartner;

  /// No description provided for @filterTop.
  ///
  /// In en, this message translates to:
  /// **'Top'**
  String get filterTop;

  /// No description provided for @noUniversitiesMatch.
  ///
  /// In en, this message translates to:
  /// **'No universities match this filter'**
  String get noUniversitiesMatch;

  /// No description provided for @clearFilters.
  ///
  /// In en, this message translates to:
  /// **'Clear filters'**
  String get clearFilters;

  /// No description provided for @universitiesLoadError.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load universities'**
  String get universitiesLoadError;

  /// No description provided for @checkConnectionRetry.
  ///
  /// In en, this message translates to:
  /// **'Check your connection and try again'**
  String get checkConnectionRetry;

  /// No description provided for @switchToListView.
  ///
  /// In en, this message translates to:
  /// **'Switch to list view'**
  String get switchToListView;

  /// No description provided for @switchToMapView.
  ///
  /// In en, this message translates to:
  /// **'Switch to map view'**
  String get switchToMapView;

  /// No description provided for @chatInputHint.
  ///
  /// In en, this message translates to:
  /// **'Ask anything about South Korea...'**
  String get chatInputHint;

  /// Tooltip for the account icon button in the Applications AppBar — opens the AccountScreen with sign-out, data export, and delete account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountTooltip;

  /// Generic confirm/dismiss button used in alert dialogs.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// Neutral 'Loading...' label used by spinner placeholder views.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loadingLabel;

  /// Tooltip on the back arrow at the top of the AccountScreen.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get accountBackTooltip;

  /// Header shown next to the back arrow at the top of the AccountScreen. Same lemma as accountTooltip but kept separate so translators can differ between a 'header' and a 'tooltip' if their language calls for it.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountTitle;

  /// Label above the email/phone of the currently logged-in user on the AccountScreen.
  ///
  /// In en, this message translates to:
  /// **'Signed in as'**
  String get accountSignedInAs;

  /// Fallback shown when neither email nor phone is available for the current Supabase user.
  ///
  /// In en, this message translates to:
  /// **'(unknown account)'**
  String get accountUnknownAccount;

  /// Section header for the sign-out card on the AccountScreen.
  ///
  /// In en, this message translates to:
  /// **'Session'**
  String get accountSessionLabel;

  /// Label on the sign-out button while the sign-out call is in flight.
  ///
  /// In en, this message translates to:
  /// **'Signing out…'**
  String get accountSigningOut;

  /// Idle label on the sign-out button.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get accountSignOut;

  /// Section header for the data-export card on the AccountScreen (PIPA + GDPR right to data portability).
  ///
  /// In en, this message translates to:
  /// **'Your data'**
  String get accountYourDataLabel;

  /// Body copy under the 'Your data' header, explaining what the JSON export contains.
  ///
  /// In en, this message translates to:
  /// **'Download a JSON copy of everything Hanguk holds about your account — profile, applications, study plans, drafts, interview sessions and feedback.'**
  String get accountYourDataBody;

  /// Label on the export-data button while the export-my-data Edge Function call is in flight.
  ///
  /// In en, this message translates to:
  /// **'Preparing export…'**
  String get accountPreparingExport;

  /// Idle label on the data-export button.
  ///
  /// In en, this message translates to:
  /// **'Download my data'**
  String get accountDownloadMyData;

  /// Section header for the delete-account card on the AccountScreen. Red.
  ///
  /// In en, this message translates to:
  /// **'Danger zone'**
  String get accountDangerZoneLabel;

  /// Body copy under the 'Danger zone' header, enumerating exactly what gets deleted and the storage/backup retention windows. Same retention numbers appear in the privacy policy — keep them in sync if the policy is updated.
  ///
  /// In en, this message translates to:
  /// **'Deleting your account is permanent. We will erase your profile, applications, study plans, personal-statement drafts, interview sessions, and transcripts. Documents in storage are removed within 30 days; backups age out within 90 days.'**
  String get accountDangerZoneBody;

  /// Label on the red 'Delete account' button that opens the confirmation dialog.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get accountDeleteAccount;

  /// Legal footer link on the AccountScreen — opens the privacy policy in the system browser.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get accountPrivacyPolicy;

  /// Legal footer link on the AccountScreen — opens the terms of service in the system browser.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get accountTermsOfService;

  /// Title of the AlertDialog shown when fn_delete_my_account RPC throws.
  ///
  /// In en, this message translates to:
  /// **'Could not delete account'**
  String get accountDeleteErrorTitle;

  /// Body of the AlertDialog shown when fn_delete_my_account RPC throws. Embeds the server error message verbatim so we can debug. Falls back to manual email so the user retains their PIPA/GDPR right to erasure.
  ///
  /// In en, this message translates to:
  /// **'We hit an error while deleting your data:\n\n{error}\n\nPlease email privacy@hanguk.uz so we can finish the deletion for you.'**
  String accountDeleteErrorBody(Object error);

  /// SnackBar message shown when the export-my-data Edge Function fails. The error is the FunctionException.details or Exception.toString().
  ///
  /// In en, this message translates to:
  /// **'Export failed: {error}'**
  String accountExportFailed(Object error);

  /// Title of the 'type DELETE to confirm' dialog.
  ///
  /// In en, this message translates to:
  /// **'Delete your account?'**
  String get accountDeleteDialogTitle;

  /// Body of the 'type DELETE to confirm' dialog. NOTE: the literal word 'DELETE' that the user must type is intentionally left in English in all locales — the TextField controller compares against the uppercase literal 'DELETE'. Translators: leave 'DELETE' as-is and adapt only the surrounding sentence.
  ///
  /// In en, this message translates to:
  /// **'This will permanently delete your account, applications, study plans, personal-statement drafts, interview sessions, and transcripts.\n\nType DELETE to confirm.'**
  String get accountDeleteDialogBody;

  /// Label on the red confirm button at the bottom of the 'type DELETE to confirm' dialog.
  ///
  /// In en, this message translates to:
  /// **'Delete forever'**
  String get accountDeleteDialogConfirm;

  /// Status text shown next to the spinner in the non-dismissible deletion progress dialog.
  ///
  /// In en, this message translates to:
  /// **'Deleting your account…'**
  String get accountDeleteProgress;

  /// Subtitle under the 'Hanguk' wordmark on the LoginScreen card.
  ///
  /// In en, this message translates to:
  /// **'Student Portal'**
  String get loginStudentPortal;

  /// Help text above the magic-code TextField on the LoginScreen. Explains where the code comes from.
  ///
  /// In en, this message translates to:
  /// **'Enter the 8-character code from your consultant or university representative.'**
  String get loginAccessCodeHelp;

  /// Label on the primary sign-in button in magic-code mode.
  ///
  /// In en, this message translates to:
  /// **'Login manually with Access Code'**
  String get loginAccessCodeButton;

  /// Fallback TextButton under the magic-code form that returns to the phone-login UI. Translators: keep the leading arrow.
  ///
  /// In en, this message translates to:
  /// **'← I actually want to Log in via Phone Number'**
  String get loginSwitchToPhone;

  /// Title of the 'maintenance' card shown on the LoginScreen while public phone sign-up is disabled.
  ///
  /// In en, this message translates to:
  /// **'Coming Soon'**
  String get loginComingSoonTitle;

  /// Body of the 'maintenance' card. Explains that public sign-up is temporarily disabled and points students at the magic-code flow.
  ///
  /// In en, this message translates to:
  /// **'Public sign up and phone login are currently under maintenance as we upgrade our systems.\n\nStudents: Please use your Magic Access Code to log in for now.'**
  String get loginComingSoonBody;

  /// TextButton inside the 'Coming Soon' card that flips the LoginScreen into magic-code mode.
  ///
  /// In en, this message translates to:
  /// **'Switch to Magic Code Login'**
  String get loginSwitchToMagicCode;

  /// Validation error when the phone number on the Sign In tab is empty or too short.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid phone number (e.g. +12345678).'**
  String get loginErrorInvalidPhone;

  /// Validation error when the password is shorter than 6 chars (used on both Sign In and Sign Up).
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 6 characters.'**
  String get loginErrorPasswordTooShort;

  /// Error shown after the Supabase signInWithPhone call rejects the credentials. Intentionally vague — does not reveal whether the phone or password was the problem.
  ///
  /// In en, this message translates to:
  /// **'Invalid phone number or password.'**
  String get loginErrorInvalidCredentials;

  /// Validation error when the magic-code TextField is shorter than 6 chars before submission.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid access code (min 6 characters).'**
  String get loginErrorInvalidAccessCode;

  /// Validation error on the Sign Up tab when the name field is empty.
  ///
  /// In en, this message translates to:
  /// **'Full Name is required.'**
  String get signUpErrorNameRequired;

  /// Validation error on the Sign Up tab when the phone field is empty or too short.
  ///
  /// In en, this message translates to:
  /// **'A valid phone number is required (e.g. +12345678).'**
  String get signUpErrorPhoneRequired;

  /// Validation error on the Sign Up tab when password and confirm-password differ.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get signUpErrorPasswordMismatch;

  /// Success banner shown on the LoginScreen after Sign Up succeeds; the tab controller then animates back to the Sign In tab.
  ///
  /// In en, this message translates to:
  /// **'Account created successfully! Please log in.'**
  String get signUpSuccess;

  /// AppBar title for the /notifications/settings screen (per-tracked-university push-notification preferences).
  ///
  /// In en, this message translates to:
  /// **'Notification settings'**
  String get notifSettingsTitle;

  /// Empty-state title on the notification settings screen — shown when user_tracked_universities is empty.
  ///
  /// In en, this message translates to:
  /// **'No tracked universities yet'**
  String get notifSettingsEmptyTitle;

  /// Empty-state body on the notification settings screen — instructs the user how to start tracking a university.
  ///
  /// In en, this message translates to:
  /// **'Tap \"Track this institution\" on a university page to follow it. Notification preferences appear here once you have at least one tracked institution.'**
  String get notifSettingsEmptyBody;

  /// SwitchListTile title — toggles notify_on_calendar_change.
  ///
  /// In en, this message translates to:
  /// **'Calendar changes'**
  String get notifSettingsCalendar;

  /// SwitchListTile subtitle for the calendar-changes toggle.
  ///
  /// In en, this message translates to:
  /// **'Deadline dates move'**
  String get notifSettingsCalendarDesc;

  /// SwitchListTile title — toggles notify_on_correction (Korean: 정정공고).
  ///
  /// In en, this message translates to:
  /// **'Correction notices'**
  String get notifSettingsCorrection;

  /// SwitchListTile subtitle for the correction-notice toggle. NOTE: '정정공고' is the Korean university-admission term for an official correction announcement and is left untranslated across locales — it is the term the user actually encounters on Korean university sites.
  ///
  /// In en, this message translates to:
  /// **'정정공고 published — highest priority'**
  String get notifSettingsCorrectionDesc;

  /// SwitchListTile title — toggles notify_on_requirement_change.
  ///
  /// In en, this message translates to:
  /// **'Requirement changes'**
  String get notifSettingsRequirement;

  /// SwitchListTile subtitle for the requirement-changes toggle. 'TOPIK' is a proper noun (test name) and is left untranslated across locales.
  ///
  /// In en, this message translates to:
  /// **'TOPIK / GPA / language test rules change'**
  String get notifSettingsRequirementDesc;

  /// SwitchListTile title — toggles notify_on_scholarship_change.
  ///
  /// In en, this message translates to:
  /// **'Scholarship updates'**
  String get notifSettingsScholarship;

  /// SwitchListTile subtitle for the scholarship-updates toggle; warns the user that the channel is noisy.
  ///
  /// In en, this message translates to:
  /// **'Off by default — high volume'**
  String get notifSettingsScholarshipDesc;

  /// Centered error message when notificationSettingsProvider's AsyncValue is in the error state.
  ///
  /// In en, this message translates to:
  /// **'Error: {error}'**
  String notifSettingsLoadError(Object error);

  /// Label above each per-institution card showing the preferred language code stored on the row. The value is a BCP-47 code (e.g. 'en', 'ko').
  ///
  /// In en, this message translates to:
  /// **'Push payload language: {lang}'**
  String notifSettingsPushLanguage(String lang);

  /// SnackBar message when updateNotificationPrefs() throws.
  ///
  /// In en, this message translates to:
  /// **'Could not update preference: {error}'**
  String notifSettingsUpdateError(Object error);

  /// Step header in the training-tab interview-setup dialog.
  ///
  /// In en, this message translates to:
  /// **'1. Select Target University'**
  String get interviewDialogStepUniversity;

  /// Step header in the training-tab interview-setup dialog.
  ///
  /// In en, this message translates to:
  /// **'2. Select Interview Track'**
  String get interviewDialogStepTrack;

  /// Step header in the training-tab interview-setup dialog.
  ///
  /// In en, this message translates to:
  /// **'3. Interviewer Persona'**
  String get interviewDialogStepPersona;

  /// Empty-state body in the training-tab interview-setup dialog. Wording differs from noApplicationsBody because it explains how the interview, specifically, tailors to a university.
  ///
  /// In en, this message translates to:
  /// **'Add a target university first — interview practice tailors questions to that school.'**
  String get interviewNoAppsBody;

  /// Track-chip label for Korean. Used by interview setup AND drafting session dialogs.
  ///
  /// In en, this message translates to:
  /// **'Korean'**
  String get trackKorean;

  /// Track-chip label for English. Used by interview setup AND drafting session dialogs.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get trackEnglish;

  /// Dropdown label for the friendly persona on the training-tab quick-setup dialog.
  ///
  /// In en, this message translates to:
  /// **'Friendly admissions officer'**
  String get personaFriendly;

  /// Dropdown label for the strict persona on the training-tab quick-setup dialog.
  ///
  /// In en, this message translates to:
  /// **'Strict professor'**
  String get personaStrict;

  /// Dropdown label for the impatient persona on the training-tab quick-setup dialog.
  ///
  /// In en, this message translates to:
  /// **'Impatient visa officer'**
  String get personaImpatient;

  /// Dropdown label for the friendly persona on the full InterviewSetupView. Capitalised differently from the training-tab dialog to match the existing UI style.
  ///
  /// In en, this message translates to:
  /// **'Friendly Admissions Officer'**
  String get personaFriendlyCaps;

  /// Dropdown label for the strict persona on the full InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Strict Professor'**
  String get personaStrictCaps;

  /// Dropdown label for the impatient persona on the full InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Impatient Visa Officer'**
  String get personaImpatientCaps;

  /// SnackBar shown when the OS reports microphone permission permanently denied. Paired with an 'Open settings' deep-link action.
  ///
  /// In en, this message translates to:
  /// **'Microphone is blocked in system settings.'**
  String get micBlockedInSettings;

  /// SnackBar action label that deep-links into the OS app-settings page so the user can re-enable microphone.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get openSettings;

  /// Generic 'Error: {error}' inline message used in several training-flow loading states.
  ///
  /// In en, this message translates to:
  /// **'Error: {error}'**
  String genericError(Object error);

  /// Error string shown in the InterviewSetupView university picker when the applications provider errors.
  ///
  /// In en, this message translates to:
  /// **'Error loading applications: {error}'**
  String errorLoadingApplications(Object error);

  /// Short empty-state hint inside the InterviewSetupView university picker. Differs from the longer noApplicationsBody used in the training-tab dialog.
  ///
  /// In en, this message translates to:
  /// **'No applications yet — go to the Applications tab to add one.'**
  String get noAppsInlineHint;

  /// AdvancedDraftingWorkspace AI status when no draft text yet.
  ///
  /// In en, this message translates to:
  /// **'Waiting for input...'**
  String get aiStatusWaiting;

  /// AdvancedDraftingWorkspace AI status when the per-minute rate cap is in effect (audit A10). The next supervise call is deferred.
  ///
  /// In en, this message translates to:
  /// **'AI cooling down…'**
  String get aiStatusCoolingDown;

  /// AdvancedDraftingWorkspace AI status while supervise-draft is in flight.
  ///
  /// In en, this message translates to:
  /// **'AI analyzing...'**
  String get aiStatusAnalyzing;

  /// AdvancedDraftingWorkspace AI status when supervise-draft returned empty (no warnings, no ghost text).
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get aiStatusReady;

  /// AdvancedDraftingWorkspace AI status when ghost-text continuation is available.
  ///
  /// In en, this message translates to:
  /// **'AI Predicting...'**
  String get aiStatusPredicting;

  /// AdvancedDraftingWorkspace AI status when supervise-draft returned issues but no ghost text.
  ///
  /// In en, this message translates to:
  /// **'AI Supervision Active'**
  String get aiStatusSupervisionActive;

  /// AdvancedDraftingWorkspace AI status when this device has no spell checker service, so typed words cannot be checked against a dictionary.
  ///
  /// In en, this message translates to:
  /// **'Device dictionary unavailable'**
  String get aiStatusSpellCheckUnavailable;

  /// Header above the drafting TextField in AdvancedDraftingWorkspace.
  ///
  /// In en, this message translates to:
  /// **'Workspace'**
  String get workspaceTitle;

  /// Right-aligned action in the AdvancedDraftingWorkspace header that saves the draft and runs full analysis.
  ///
  /// In en, this message translates to:
  /// **'Analyze'**
  String get workspaceAnalyzeButton;

  /// Label above the list of grammar-fix chips in AdvancedDraftingWorkspace.
  ///
  /// In en, this message translates to:
  /// **'AI Supervision Warnings:'**
  String get aiSupervisionWarningsTitle;

  /// Action-chip body inside the AI Supervision Warnings list. Translators: the quotes around the substrings are part of the UI styling.
  ///
  /// In en, this message translates to:
  /// **'Replace \"{original}\" with \"{suggestion}\"'**
  String grammarReplaceWith(String original, String suggestion);

  /// TextField hint inside AdvancedDraftingWorkspace. documentTitle is a localized document name (e.g. 'Study Plan' / 'Personal Statement').
  ///
  /// In en, this message translates to:
  /// **'Type your {documentTitle} here...'**
  String draftingHint(String documentTitle);

  /// Semantic label on the ghost-text suggestion preview in AdvancedDraftingWorkspace (for screen readers).
  ///
  /// In en, this message translates to:
  /// **'AI suggestion — tap to insert'**
  String get ghostSuggestionSemantics;

  /// Button label inside the ghost-text suggestion bar — inserts the ghost text at the cursor.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get ghostAccept;

  /// Tooltip on the close (×) button inside the ghost-text suggestion bar.
  ///
  /// In en, this message translates to:
  /// **'Dismiss suggestion'**
  String get ghostDismiss;

  /// AppBar action tooltip on StudyPlanScreen opening StudyPlanHistoryView.
  ///
  /// In en, this message translates to:
  /// **'Past drafts'**
  String get pastDraftsTooltip;

  /// AppBar action tooltip on StudyPlanScreen for the per-session settings popup menu.
  ///
  /// In en, this message translates to:
  /// **'Session settings'**
  String get sessionSettingsTooltip;

  /// PopupMenuItem inside the session-settings menu on StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Switch track → English'**
  String get switchTrackEnglish;

  /// PopupMenuItem inside the session-settings menu on StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Switch track → Korean'**
  String get switchTrackKorean;

  /// Primary CTA on the StudyPlanScreen session-list (empty state of the screen).
  ///
  /// In en, this message translates to:
  /// **'Create New Session'**
  String get createNewSession;

  /// Section header above the past-drafts list on StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Your Saved Drafts'**
  String get yourSavedDrafts;

  /// Empty-state body inside the past-drafts list on StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'No previous drafts found.'**
  String get noPreviousDrafts;

  /// Fallback university name shown for drafts that have no target university yet.
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get generalDraftLabel;

  /// Localized document name. NOT the card title (that's studyPlanCardTitle). Used inline in the saved-drafts list as '{University} Study Plan'.
  ///
  /// In en, this message translates to:
  /// **'Study Plan'**
  String get studyPlanDocumentName;

  /// Localized document name. NOT the card title (that's personalStatementCardTitle). Used inline in the saved-drafts list as '{University} Personal Statement'.
  ///
  /// In en, this message translates to:
  /// **'Personal Statement'**
  String get personalStatementDocumentName;

  /// ListTile title in StudyPlanScreen's saved-drafts list. Placeholder order may need to swap in some locales — translators may rewrite to '{documentName} for {universityName}'.
  ///
  /// In en, this message translates to:
  /// **'{universityName} {documentName}'**
  String savedDraftItemTitle(String universityName, String documentName);

  /// ListTile subtitle in StudyPlanScreen's saved-drafts list. status is the raw status code from the row (e.g. 'in_progress').
  ///
  /// In en, this message translates to:
  /// **'Status: {status}'**
  String sessionStatusLabel(String status);

  /// AlertDialog title for the delete-session confirmation in StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Delete Session'**
  String get deleteSessionTitle;

  /// AlertDialog body for the delete-session confirmation in StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete this session? This action cannot be undone.'**
  String get deleteSessionBody;

  /// Generic 'Delete' button label used in destructive confirm dialogs across training.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get deleteLabel;

  /// Step 1 label in the StudyPlanScreen wizard stepper.
  ///
  /// In en, this message translates to:
  /// **'Guide'**
  String get stepperLabelGuide;

  /// Step 2 label in the StudyPlanScreen wizard stepper.
  ///
  /// In en, this message translates to:
  /// **'Example'**
  String get stepperLabelExample;

  /// Step 3 label in the StudyPlanScreen wizard stepper.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get stepperLabelDraft;

  /// Step 4 label in the StudyPlanScreen wizard stepper.
  ///
  /// In en, this message translates to:
  /// **'Feedback'**
  String get stepperLabelFeedback;

  /// CTA at the bottom of Step 1 (Guide) in StudyPlanScreen advancing to Step 2 (Example).
  ///
  /// In en, this message translates to:
  /// **'Read Examples'**
  String get readExamplesButton;

  /// Section header above the chosen-university row on Step 2 (Example) in StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Target University'**
  String get targetUniversityLabel;

  /// CTA at the bottom of Step 2 (Example) in StudyPlanScreen advancing to Step 3 (Draft).
  ///
  /// In en, this message translates to:
  /// **'Start Drafting'**
  String get startDraftingButton;

  /// Create-session AlertDialog title when documentType is study_plan.
  ///
  /// In en, this message translates to:
  /// **'Start New Study Plan'**
  String get newStudyPlanDialogTitle;

  /// Create-session AlertDialog title when documentType is personal_statement.
  ///
  /// In en, this message translates to:
  /// **'Start New Personal Statement'**
  String get newPersonalStatementDialogTitle;

  /// Step header inside the create-session dialog on StudyPlanScreen. Same text as interviewDialogStepUniversity but kept separate so translators can change one without the other.
  ///
  /// In en, this message translates to:
  /// **'1. Select Target University'**
  String get selectTargetUniversityStep;

  /// Step header inside the create-session dialog on StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'2. Select Language Track'**
  String get selectLanguageTrackStep;

  /// Primary CTA at the bottom of the StudyPlanScreen create-session dialog.
  ///
  /// In en, this message translates to:
  /// **'Create Session'**
  String get createSession;

  /// Header for the embassy-template AI example card on Step 2 (Example) in StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Embassy Example'**
  String get aiExampleEmbassyTitle;

  /// Header for the university-template AI example card on Step 2 (Example) in StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Example for {universityName}'**
  String aiExampleUniversityTitle(String universityName);

  /// Subtitle inside the embassy-template AI example card, identifying the addressee of the visa application.
  ///
  /// In en, this message translates to:
  /// **'Embassy of the Republic of Korea (Visa)'**
  String get aiExampleEmbassyLabel;

  /// Inline loading text inside the AI example card while the simulated 'thinking' delay runs.
  ///
  /// In en, this message translates to:
  /// **'AI is writing an example...'**
  String get aiExampleWritingPlaceholder;

  /// Copy-to-clipboard button label inside the AI example card.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get copyButton;

  /// SnackBar shown after the AI example text is copied to clipboard.
  ///
  /// In en, this message translates to:
  /// **'Text copied!'**
  String get copiedSnackbar;

  /// Section header on Step 4 (Feedback) in StudyPlanScreen.
  ///
  /// In en, this message translates to:
  /// **'Analysis & Feedback'**
  String get analysisFeedbackTitle;

  /// Empty-state body on Step 4 (Feedback) in StudyPlanScreen when no analysis row exists.
  ///
  /// In en, this message translates to:
  /// **'No analysis generated yet.'**
  String get noAnalysisYet;

  /// StudyPlanAnalysisView: shown instead of the empty state when the analyze call was refused because the account's plan does not include the trainer (HTTP 403).
  ///
  /// In en, this message translates to:
  /// **'Analysis is part of the Premium and No Risk plans. Your current plan does not include it.'**
  String get analysisErrorPlanRequired;

  /// StudyPlanAnalysisView: shown when the analyze call was rate limited (HTTP 429).
  ///
  /// In en, this message translates to:
  /// **'Too many analyses just now. Wait a minute and try again.'**
  String get analysisErrorRateLimited;

  /// StudyPlanAnalysisView: shown when the analysis backend or upstream model was unavailable.
  ///
  /// In en, this message translates to:
  /// **'The analysis service is temporarily unavailable. Your draft is saved — try again shortly.'**
  String get analysisErrorServiceDown;

  /// StudyPlanAnalysisView: shown when the analyze call failed for an unclassified reason, e.g. no network.
  ///
  /// In en, this message translates to:
  /// **'The analysis could not be completed. Your draft is saved — check your connection and try again.'**
  String get analysisErrorFailed;

  /// StudyPlanAnalysisView: button that re-runs the analysis after a failure.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get analysisRetryButton;

  /// Fallback body on Step 4 (Feedback) in StudyPlanScreen when the analysis row exists but aiResponse is empty.
  ///
  /// In en, this message translates to:
  /// **'AI successfully reviewed your draft.'**
  String get aiReviewedDraft;

  /// CTA at the bottom of Step 4 (Feedback) returning to Step 3 (Draft).
  ///
  /// In en, this message translates to:
  /// **'Return to Drafting'**
  String get returnToDrafting;

  /// AppBar title for StudyPlanHistoryView when documentType is study_plan.
  ///
  /// In en, this message translates to:
  /// **'Study Plan history'**
  String get studyPlanHistoryTitle;

  /// AppBar title for StudyPlanHistoryView when documentType is personal_statement.
  ///
  /// In en, this message translates to:
  /// **'Personal Statement history'**
  String get personalStatementHistoryTitle;

  /// AppBar title for StudyPlanHistoryView when documentType is unknown.
  ///
  /// In en, this message translates to:
  /// **'Drafting history'**
  String get draftingHistoryTitle;

  /// Empty-state title on StudyPlanHistoryView.
  ///
  /// In en, this message translates to:
  /// **'No past drafts yet'**
  String get noPastDraftsYet;

  /// Empty-state body on StudyPlanHistoryView.
  ///
  /// In en, this message translates to:
  /// **'Start a new session and your drafts will appear here, ordered by most recently edited.'**
  String get noPastDraftsBody;

  /// Fallback shown on a StudyPlanHistoryView session card when universityNameEn is null/empty.
  ///
  /// In en, this message translates to:
  /// **'No target university'**
  String get noTargetUniversity;

  /// Step pill on a StudyPlanHistoryView session card.
  ///
  /// In en, this message translates to:
  /// **'Step {step}'**
  String sessionStepLabel(int step);

  /// Word-count label in LiveMetricsBar (AdvancedDraftingWorkspace footer).
  ///
  /// In en, this message translates to:
  /// **'Words'**
  String get metricWords;

  /// Character-count label in LiveMetricsBar (AdvancedDraftingWorkspace footer).
  ///
  /// In en, this message translates to:
  /// **'Characters'**
  String get metricCharacters;

  /// LiveMetricsBar save-status tag.
  ///
  /// In en, this message translates to:
  /// **'Unsaved'**
  String get saveStatusUnsaved;

  /// LiveMetricsBar save-status tag.
  ///
  /// In en, this message translates to:
  /// **'Saving...'**
  String get saveStatusSaving;

  /// LiveMetricsBar save-status tag.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get saveStatusSaved;

  /// LiveMetricsBar save-status tag (audit U1/A5).
  ///
  /// In en, this message translates to:
  /// **'Save failed'**
  String get saveStatusError;

  /// AppBar title on InterviewScreen.
  ///
  /// In en, this message translates to:
  /// **'Interview Practice'**
  String get interviewPracticeTitle;

  /// Loading caption on InterviewScreen while startSession() runs after navigation from the training-tab dialog.
  ///
  /// In en, this message translates to:
  /// **'Setting up your interview...'**
  String get interviewSettingUp;

  /// Header on the full InterviewSetupView (separate from the quick-setup dialog in TrainingTab).
  ///
  /// In en, this message translates to:
  /// **'AI Interview Setup'**
  String get interviewSetupTitle;

  /// Subtitle under the InterviewSetupView header.
  ///
  /// In en, this message translates to:
  /// **'Configure your AI interviewer settings before starting.'**
  String get interviewSetupSubtitle;

  /// Field label for the sessionType dropdown on InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Interview Type'**
  String get interviewTypeLabel;

  /// sessionType dropdown item — value 'general'.
  ///
  /// In en, this message translates to:
  /// **'General Introduction'**
  String get interviewTypeGeneral;

  /// sessionType dropdown item — value 'university_specific'.
  ///
  /// In en, this message translates to:
  /// **'University Specific'**
  String get interviewTypeUniversitySpecific;

  /// sessionType dropdown item — value 'visa'.
  ///
  /// In en, this message translates to:
  /// **'Visa / Embassy Check'**
  String get interviewTypeVisa;

  /// Field label on InterviewSetupView when sessionType == university_specific. Lower-case variant of targetUniversityLabel.
  ///
  /// In en, this message translates to:
  /// **'Target university'**
  String get targetUniversityFieldLabel;

  /// Field label for the language-track picker on InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageLabel;

  /// Field label for the persona dropdown on InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Interviewer Persona'**
  String get interviewerPersonaLabel;

  /// Field label for the focus-topic TextField on InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Focus Topic (Optional)'**
  String get focusTopicLabel;

  /// TextField hint for the focus-topic field on InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'e.g. Discussing my computer science major...'**
  String get focusTopicHint;

  /// Switch tile title on InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Timed Mode'**
  String get timedModeTitle;

  /// Switch tile subtitle on InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'5 minute strict limit'**
  String get timedModeSubtitle;

  /// Primary CTA on InterviewSetupView. Different from startInterview which is used in the quick-setup dialog.
  ///
  /// In en, this message translates to:
  /// **'Start Practice'**
  String get startPracticeButton;

  /// Hint shown under a disabled Start Practice button when university_specific is selected but no target uni is picked.
  ///
  /// In en, this message translates to:
  /// **'Pick a target university above to enable.'**
  String get pickUniversityFirstHint;

  /// Coaching warning shown in InterviewActiveView when too many filler words detected (≥4).
  ///
  /// In en, this message translates to:
  /// **'Avoid using filler words!'**
  String get coachingFiller;

  /// Header above the live-hints panel in InterviewActiveView.
  ///
  /// In en, this message translates to:
  /// **'💡 Lifeline Hints:'**
  String get lifelineHintsTitle;

  /// Speaker label in the transcript ledger on InterviewActiveView (interviewer turn).
  ///
  /// In en, this message translates to:
  /// **'AI'**
  String get speakerAi;

  /// Speaker label in the transcript ledger on InterviewActiveView (user turn).
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get speakerYou;

  /// Error message shown in InterviewActiveView when a Vapi status-update event signals an error. detail is the truncated error payload (audit U12).
  ///
  /// In en, this message translates to:
  /// **'Connection interrupted: {detail}'**
  String connectionInterrupted(String detail);

  /// Header on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Interview Analytics'**
  String get interviewAnalyticsTitle;

  /// Loading caption on InterviewAnalyticsView while interview-feedback Edge Function runs.
  ///
  /// In en, this message translates to:
  /// **'Analyzing transcript with AI...'**
  String get analyzingTranscript;

  /// Fallback shown on InterviewAnalyticsView when feedback is null AND state.error is null.
  ///
  /// In en, this message translates to:
  /// **'No feedback available.'**
  String get noFeedbackAvailable;

  /// Big-score card header on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Overall Score'**
  String get overallScoreLabel;

  /// Per-metric label on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Communication'**
  String get metricCommunication;

  /// Per-metric label on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Confidence'**
  String get metricConfidence;

  /// Per-metric label on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Content'**
  String get metricContent;

  /// Per-metric label on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get metricLanguage;

  /// Section header on InterviewAnalyticsView above the long-form review.
  ///
  /// In en, this message translates to:
  /// **'Detailed Feedback'**
  String get detailedFeedbackTitle;

  /// Fallback body when the feedback row has no detailed_feedback field.
  ///
  /// In en, this message translates to:
  /// **'Great job.'**
  String get detailedFeedbackFallback;

  /// Section header on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Strengths'**
  String get strengthsLabel;

  /// Section header on InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Areas to Improve'**
  String get areasToImproveLabel;

  /// CTA at the bottom of InterviewAnalyticsView returning to InterviewSetupView.
  ///
  /// In en, this message translates to:
  /// **'Start another interview'**
  String get startAnotherInterview;

  /// Header on the audio player widget inside InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Session Recording'**
  String get sessionRecording;

  /// Error string shown inside the audio player when fetchRecordingUrl returns null.
  ///
  /// In en, this message translates to:
  /// **'Audio recording not found.'**
  String get audioRecordingNotFound;

  /// Header on InterviewHistoryView.
  ///
  /// In en, this message translates to:
  /// **'Interview History'**
  String get interviewHistoryTitle;

  /// Empty-state on InterviewHistoryView.
  ///
  /// In en, this message translates to:
  /// **'No past interviews found.'**
  String get noPastInterviews;

  /// Fallback target name on an InterviewHistoryView session card when neither the institution embed nor the legacy universities embed had a row.
  ///
  /// In en, this message translates to:
  /// **'Unknown Target'**
  String get unknownTarget;

  /// Fallback target name on an InterviewHistoryView session card when the institution embed exists but both name_en and name_ko are empty.
  ///
  /// In en, this message translates to:
  /// **'Unknown University'**
  String get unknownUniversity;

  /// SnackBar shown when an abandoned session is tapped on InterviewHistoryView (audit H1).
  ///
  /// In en, this message translates to:
  /// **'This session ended without feedback — no replay available.'**
  String get abandonedSessionNote;

  /// SnackBar shown when an in-progress session is tapped on InterviewHistoryView (audit H1).
  ///
  /// In en, this message translates to:
  /// **'This session is still active. Finish it to see feedback.'**
  String get activeSessionNote;

  /// IconButton tooltip on InterviewHistoryView session cards (audit H2).
  ///
  /// In en, this message translates to:
  /// **'Delete session'**
  String get deleteSessionTooltip;

  /// AlertDialog title for the delete-session confirmation on InterviewHistoryView.
  ///
  /// In en, this message translates to:
  /// **'Delete this session?'**
  String get deleteInterviewDialogTitle;

  /// AlertDialog body for the delete-session confirmation on InterviewHistoryView.
  ///
  /// In en, this message translates to:
  /// **'The feedback and recording link will be permanently removed.'**
  String get deleteInterviewDialogBody;

  /// SnackBar shown when the delete-interview-session RPC throws.
  ///
  /// In en, this message translates to:
  /// **'Delete failed: {error}'**
  String deleteFailed(Object error);

  /// Accessibility tooltip on the floating action button in HomeScreen that opens the Hanguk AI chat bottom-sheet. Read aloud by screen readers (audit P0 #3).
  ///
  /// In en, this message translates to:
  /// **'Ask Hanguk AI'**
  String get a11yTooltipAskAi;

  /// Accessibility tooltip on the trash-can IconButton in ChatTab's AppBar that wipes the in-memory chat transcript (audit P0 #3).
  ///
  /// In en, this message translates to:
  /// **'Clear chat history'**
  String get a11yTooltipClearChat;

  /// Accessibility tooltip on the send IconButton at the bottom of ChatTab and on the UniversityRoomModal discussion-tab composer (audit P0 #3). Shared between two screens — translators may keep one short phrase.
  ///
  /// In en, this message translates to:
  /// **'Send message'**
  String get a11yTooltipSendMessage;

  /// Accessibility tooltip on the × IconButton at the top-right of the UniversityRoomModal header that dismisses the bottom-sheet (audit P0 #3).
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get a11yTooltipClose;

  /// Accessibility tooltip on the eye IconButton inside a DocumentSlot row that opens the uploaded file preview (audit P0 #3).
  ///
  /// In en, this message translates to:
  /// **'Preview document'**
  String get a11yTooltipPreviewDocument;

  /// Accessibility tooltip on the trash IconButton inside a DocumentSlot row that removes an uploaded (non-approved) document (audit P0 #3).
  ///
  /// In en, this message translates to:
  /// **'Delete document'**
  String get a11yTooltipDeleteDocument;

  /// Accessibility tooltip on the history IconButton in InterviewSetupView's top-right that opens InterviewHistoryView (audit P0 #3). Same lemma as interviewHistoryTitle but a tooltip — translators may keep them in sync or differ.
  ///
  /// In en, this message translates to:
  /// **'Interview history'**
  String get a11yTooltipInterviewHistory;

  /// Accessibility tooltip on the × IconButton on StudyPlanScreen's AppBar that exits the current drafting session back to the saved-drafts list (audit P0 #3).
  ///
  /// In en, this message translates to:
  /// **'Close session'**
  String get a11yTooltipCloseSession;

  /// Accessibility tooltip on the trash IconButton inside a saved-drafts ListTile on StudyPlanScreen that removes the draft (audit P0 #3). Same lemma as deleteSessionTooltip (used on InterviewHistoryView) — translators may keep them in sync or differ.
  ///
  /// In en, this message translates to:
  /// **'Delete session'**
  String get a11yTooltipDeleteSession;

  /// Accessibility tooltip on the back-arrow IconButton in the training-flow views (InterviewHistoryView header, InterviewAnalyticsView header) (audit P0 #3). Same lemma as accountBackTooltip — translators may keep them in sync or differ.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get a11yTooltipBack;

  /// Accessibility tooltip on the audio-playback IconButton inside InterviewAnalyticsView's session-recording widget when the recording is currently paused/stopped (audit P0 #3). Paired with a11yTooltipPauseRecording.
  ///
  /// In en, this message translates to:
  /// **'Play recording'**
  String get a11yTooltipPlayRecording;

  /// Accessibility tooltip on the audio-playback IconButton inside InterviewAnalyticsView's session-recording widget when the recording is currently playing (audit P0 #3). Paired with a11yTooltipPlayRecording.
  ///
  /// In en, this message translates to:
  /// **'Pause recording'**
  String get a11yTooltipPauseRecording;

  /// Warning in StudyPlanAnalysisView when the draft's script doesn't match the selected writing track (audit G3-4).
  ///
  /// In en, this message translates to:
  /// **'Your draft\'s language doesn\'t match the track you chose. Please rewrite it in the selected language.'**
  String get trackMismatchWarning;

  /// Error banner in InterviewSetupView when startSession() fails (audit G3-5).
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t start the interview. Please check your connection and try again.'**
  String get interviewStartError;

  /// Section title above the per-answer breakdown in InterviewAnalyticsView.
  ///
  /// In en, this message translates to:
  /// **'Answer-by-answer review'**
  String get perAnswerReviewTitle;

  /// Label above the AI's suggested stronger version of one answer.
  ///
  /// In en, this message translates to:
  /// **'A STRONGER ANSWER'**
  String get betterAnswerLabel;

  /// Orb speed-dial label for the Home section.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// Accessibility label for the 한 orb, which opens the navigation speed-dial. Must not say "Home" — activating it opens a menu.
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get navMenu;

  /// Time-of-day greeting on the Home header (before 12:00).
  ///
  /// In en, this message translates to:
  /// **'Good morning'**
  String get greetingMorning;

  /// Time-of-day greeting on the Home header (12:00-17:59).
  ///
  /// In en, this message translates to:
  /// **'Good afternoon'**
  String get greetingAfternoon;

  /// Time-of-day greeting on the Home header (18:00 onwards).
  ///
  /// In en, this message translates to:
  /// **'Good evening'**
  String get greetingEvening;

  /// Headline on the Welcome screen, under the 한 tile (DESIGN_SPEC 3.1).
  ///
  /// In en, this message translates to:
  /// **'Welcome to\nyour journey'**
  String get welcomeHeadline;

  /// Supporting line under welcomeHeadline on the Welcome screen.
  ///
  /// In en, this message translates to:
  /// **'Your path to a South Korean university starts here.'**
  String get welcomeSubtitle;

  /// Primary lime button on the Welcome screen; opens the magic-code login.
  ///
  /// In en, this message translates to:
  /// **'I have a magic code'**
  String get welcomeMagicCodeCta;

  /// Secondary Welcome button opening the Guest Explorer (DESIGN_SPEC 3.1/3b).
  ///
  /// In en, this message translates to:
  /// **'Explore Universities'**
  String get welcomeExploreCta;

  /// Title of the magic-code login screen (DESIGN_SPEC 3.2).
  ///
  /// In en, this message translates to:
  /// **'Magic code'**
  String get magicCodeTitle;

  /// Eyebrow above the journey hero card on the Home dashboard.
  ///
  /// In en, this message translates to:
  /// **'Your journey'**
  String get homeJourneyEyebrow;

  /// Lime button on the Home journey hero card; opens Applications.
  ///
  /// In en, this message translates to:
  /// **'Continue journey'**
  String get homeContinueJourney;

  /// Link at the end of a Home section header; opens the full section.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get homeViewAll;

  /// Count on the Documents hero card: how many required documents have been uploaded out of the total.
  ///
  /// In en, this message translates to:
  /// **'{collected} of {total} collected'**
  String documentsCollected(int collected, int total);

  /// Label on the button that uploads a missing document.
  ///
  /// In en, this message translates to:
  /// **'Upload'**
  String get documentActionUpload;

  /// Status chip on a document row that a counselor has approved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get documentStatusApproved;

  /// Status chip on an uploaded document that has not been reviewed yet.
  ///
  /// In en, this message translates to:
  /// **'Pending review'**
  String get documentStatusPendingReview;

  /// Short status chip on an application card: the student is collecting documents.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get statusDocs;

  /// Short status chip on an application card: the application has been sent to the university.
  ///
  /// In en, this message translates to:
  /// **'Submitted'**
  String get statusSubmitted;

  /// Short status chip on an application card: the university or the consulate is reviewing it.
  ///
  /// In en, this message translates to:
  /// **'In review'**
  String get statusInReview;

  /// Short status chip on an application card: waiting on the university or the consulate to respond.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get statusWaiting;

  /// Short status chip on an application card that was rejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get statusRejected;

  /// Stage 1 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Document preparation'**
  String get journeyStageDocumentPrep;

  /// Stage 2 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Online application'**
  String get journeyStageOnlineApplication;

  /// Stage 3 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Offline application'**
  String get journeyStageOfflineApplication;

  /// Stage 4 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Interview'**
  String get journeyStageInterview;

  /// Stage 5 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Waiting for invoice'**
  String get journeyStageWaitingInvoice;

  /// Stage 6 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Tuition fee payment'**
  String get journeyStageTuitionPayment;

  /// Stage 7 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Waiting for admission letter'**
  String get journeyStageWaitingAdmission;

  /// Stage 8 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Preparing for visa application'**
  String get journeyStageVisaPreparation;

  /// Stage 9 of 9 on the application journey bar.
  ///
  /// In en, this message translates to:
  /// **'Waiting for visa issue'**
  String get journeyStageWaitingVisa;

  /// Pill over the map showing how many universities have coordinates and are therefore drawn as pins.
  ///
  /// In en, this message translates to:
  /// **'{count} universities mapped'**
  String mapUniversitiesMapped(int count);

  /// Title of the in-app update dialog when a new version is available.
  ///
  /// In en, this message translates to:
  /// **'Update Available'**
  String get updateAvailableTitle;

  /// Body line of the update dialog. version is e.g. '1.4.2+37'.
  ///
  /// In en, this message translates to:
  /// **'Version {version} is ready to install.'**
  String updateVersionReady(String version);

  /// Download size line in the update dialog. size is a formatted decimal like '48.3'.
  ///
  /// In en, this message translates to:
  /// **'Size: {size} MB'**
  String updateSizeMb(String size);

  /// Warning card in the update dialog when the update requires a full reinstall (signing key rotation).
  ///
  /// In en, this message translates to:
  /// **'This update changes the app signing key. After installing you will need to log in again with your magic code.'**
  String get updateSigningKeyWarning;

  /// Primary (lime) button in the update dialog — starts the download/install.
  ///
  /// In en, this message translates to:
  /// **'Update Now'**
  String get updateNow;

  /// Secondary (outline) button in the update dialog — dismisses it. Hidden when the update is forced.
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get updateLater;

  /// Title of the non-dismissible progress dialog while the APK downloads.
  ///
  /// In en, this message translates to:
  /// **'Downloading Update'**
  String get updateDownloadingTitle;

  /// Progress caption under the download bar. Both values are formatted decimals; total may be '?' when the server sends no Content-Length.
  ///
  /// In en, this message translates to:
  /// **'{downloaded} MB / {total} MB'**
  String updateDownloadProgress(String downloaded, String total);

  /// Label next to the spinner while the downloaded update is hash-verified and handed to the OS installer.
  ///
  /// In en, this message translates to:
  /// **'Verifying and installing…'**
  String get updateInstallingLabel;

  /// Title of the update dialog's failure state.
  ///
  /// In en, this message translates to:
  /// **'Update Failed'**
  String get updateFailedTitle;

  /// Update failure body: network error during download.
  ///
  /// In en, this message translates to:
  /// **'Could not download the update. Please check your internet connection and try again.'**
  String get updateErrorNetwork;

  /// Update failure body: SHA-256 of the downloaded APK did not match.
  ///
  /// In en, this message translates to:
  /// **'The downloaded file failed integrity verification. Please try again — if the problem repeats, contact your counsellor.'**
  String get updateErrorHashMismatch;

  /// Update failure body: the OS refused to launch the package installer.
  ///
  /// In en, this message translates to:
  /// **'Installation was blocked by your device. Please grant \"Install unknown apps\" permission for Hanguk in your phone settings, then try again.'**
  String get updateErrorInstallDenied;

  /// Update failure body: disk full while downloading.
  ///
  /// In en, this message translates to:
  /// **'Not enough storage to download the update. Please free up some space and try again.'**
  String get updateErrorStorage;

  /// Update failure body: in-app updates unsupported on this OS (e.g. desktop).
  ///
  /// In en, this message translates to:
  /// **'Updates are not available on this platform yet.'**
  String get updateErrorUnsupportedPlatform;

  /// Update failure body: catch-all for unclassified errors.
  ///
  /// In en, this message translates to:
  /// **'Update failed. Please try again, or contact your counsellor.'**
  String get updateErrorUnknown;

  /// Eyebrow label in the Guest Explorer header (DESIGN_SPEC 3b).
  ///
  /// In en, this message translates to:
  /// **'Guest Explorer'**
  String get guestModeEyebrow;

  /// Lime conversion pill in the guest header and orb dial; routes to Magic Code login.
  ///
  /// In en, this message translates to:
  /// **'Join Hanguk'**
  String get guestJoinCta;

  /// Display headline of the guest Explore section (DESIGN_SPEC screen 8).
  ///
  /// In en, this message translates to:
  /// **'Find Your University'**
  String get guestExploreTitle;

  /// Count line under the Explore headline.
  ///
  /// In en, this message translates to:
  /// **'{count} universities'**
  String guestUniversitiesCount(int count);

  /// Guest orb dial label for the Explore section.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get guestNavExplore;

  /// Guest orb dial label and section title for Compare (DESIGN_SPEC screen 10).
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get guestNavCompare;

  /// Link on Explore showing how many universities are queued for comparison.
  ///
  /// In en, this message translates to:
  /// **'Compare {count}/2'**
  String guestCompareCount(int count);

  /// Dashed empty-slot card on the guest Compare screen.
  ///
  /// In en, this message translates to:
  /// **'Add from Explore'**
  String get guestCompareEmptySlot;

  /// Primary conversion CTA under the guest comparison; routes to Magic Code login.
  ///
  /// In en, this message translates to:
  /// **'Apply with Hanguk'**
  String get guestCompareApplyCta;

  /// One-line reassurance caption under the compare CTA (DESIGN_SPEC screen 10).
  ///
  /// In en, this message translates to:
  /// **'Get a magic code and our team will guide your application from documents to visa.'**
  String get guestCompareReassurance;

  /// Compare row label: city.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get guestRowCity;

  /// Compare row label: tier.
  ///
  /// In en, this message translates to:
  /// **'Tier'**
  String get guestRowTier;

  /// Compare row label: IEQAS accreditation status.
  ///
  /// In en, this message translates to:
  /// **'IEQAS status'**
  String get guestRowIeqas;

  /// Chip on a university card: the Ministry of Education's top IEQAS grade for hosting international students.
  ///
  /// In en, this message translates to:
  /// **'IEQAS outstanding'**
  String get ieqasOutstanding;

  /// Chip on a university card: the standard IEQAS accreditation for hosting international students.
  ///
  /// In en, this message translates to:
  /// **'IEQAS accredited'**
  String get ieqasAccredited;

  /// Compare row label: whether the university is a Hanguk partner.
  ///
  /// In en, this message translates to:
  /// **'Hanguk partner'**
  String get guestRowPartner;

  /// Compare row label: next verified admission event date.
  ///
  /// In en, this message translates to:
  /// **'Next event'**
  String get guestRowNextEvent;

  /// Compare row label: official website domain.
  ///
  /// In en, this message translates to:
  /// **'Website'**
  String get guestRowWebsite;

  /// Compare row label: tuition per semester.
  ///
  /// In en, this message translates to:
  /// **'Tuition'**
  String get guestRowTuition;

  /// Compare row label: the application window.
  ///
  /// In en, this message translates to:
  /// **'Application'**
  String get guestRowApplication;

  /// Compare row label: document submission deadline.
  ///
  /// In en, this message translates to:
  /// **'Document deadline'**
  String get guestRowDocDeadline;

  /// Compare row label: the lowest TOPIK level accepted.
  ///
  /// In en, this message translates to:
  /// **'TOPIK'**
  String get guestRowTopik;

  /// Compare row label: whether an English test is named in the requirements.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get guestRowEnglish;

  /// Compare row label: whether an interview is required.
  ///
  /// In en, this message translates to:
  /// **'Interview'**
  String get guestRowInterview;

  /// Compare row label: how many kinds of document are required.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get guestRowDocuments;

  /// Appended to a tuition figure whose academic year differs from the intake — Korean guidelines quote the current year's fees.
  ///
  /// In en, this message translates to:
  /// **'{year} figure'**
  String guestTuitionYearNote(int year);

  /// Number of DISTINCT required document types.
  ///
  /// In en, this message translates to:
  /// **'{count} types'**
  String guestDocumentsCount(int count);

  /// Appended to the documents value when at least one required document needs an apostille.
  ///
  /// In en, this message translates to:
  /// **'apostille needed'**
  String get guestApostilleShort;

  /// Generic affirmative value in the compare grid.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get guestValueYes;

  /// Generic negative value in the compare grid.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get guestValueNo;

  /// First tab of the UniversityRoomModal — shows the application's ProcessTracker. Rendered as a SeoulFilterChip with the fixed hangul accent 현황.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get roomTabStatus;

  /// Second tab of the UniversityRoomModal — the realtime room chat. Rendered as a SeoulFilterChip with the fixed hangul accent 대화.
  ///
  /// In en, this message translates to:
  /// **'Discussion'**
  String get roomTabDiscussion;

  /// Third tab of the UniversityRoomModal — official admission announcements. Rendered as a SeoulFilterChip with the fixed hangul accent 소식.
  ///
  /// In en, this message translates to:
  /// **'News'**
  String get roomTabNews;

  /// Fourth tab of the UniversityRoomModal — the events calendar. Rendered as a SeoulFilterChip with the fixed hangul accent 일정.
  ///
  /// In en, this message translates to:
  /// **'Calendar'**
  String get roomTabCalendar;

  /// Section title above the ProcessTracker on the UniversityRoomModal Status tab.
  ///
  /// In en, this message translates to:
  /// **'Application Progress'**
  String get roomApplicationProgress;

  /// Empty state of the UniversityRoomModal Discussion tab when the room chat has no messages.
  ///
  /// In en, this message translates to:
  /// **'No messages yet. Start the conversation!'**
  String get roomChatEmpty;

  /// Hint text inside the message composer at the bottom of the UniversityRoomModal Discussion tab.
  ///
  /// In en, this message translates to:
  /// **'Message room...'**
  String get roomChatHint;

  /// Fallback sender name on a room chat message whose profile has no full name.
  ///
  /// In en, this message translates to:
  /// **'User'**
  String get roomChatSenderFallback;

  /// Empty state of the UniversityRoomModal News tab when the institution has no crawled announcements.
  ///
  /// In en, this message translates to:
  /// **'No active announcements.'**
  String get roomNewsEmpty;

  /// Empty state under the calendar on the UniversityRoomModal Calendar tab when the selected day has no events.
  ///
  /// In en, this message translates to:
  /// **'No events to display on this date.'**
  String get roomEventsEmpty;

  /// Neutral chip at the bottom of the ComingSoonCard placeholder used by uni_db screens before Phase 2 content lands.
  ///
  /// In en, this message translates to:
  /// **'University DB · Phase 0 scaffolded'**
  String get uniDbPhaseBadge;

  /// Header of the recent-changes glass banner on the Applications tab (HomeRecentChangesBannerSliver).
  ///
  /// In en, this message translates to:
  /// **'Updates from your tracked universities'**
  String get uniDbRecentChangesTitle;

  /// Relative timestamp on a recent-change line: less than a minute ago.
  ///
  /// In en, this message translates to:
  /// **'just now'**
  String get timeJustNow;

  /// Relative timestamp on a recent-change line.
  ///
  /// In en, this message translates to:
  /// **'{minutes}m ago'**
  String timeMinutesAgo(int minutes);

  /// Relative timestamp on a recent-change line.
  ///
  /// In en, this message translates to:
  /// **'{hours}h ago'**
  String timeHoursAgo(int hours);

  /// Relative timestamp on a recent-change line.
  ///
  /// In en, this message translates to:
  /// **'{days}d ago'**
  String timeDaysAgo(int days);

  /// Section header above the verified-deadline cards on the Applications tab (VerifiedDeadlinesOverlaySliver).
  ///
  /// In en, this message translates to:
  /// **'Verified upcoming deadlines'**
  String get uniDbVerifiedDeadlinesTitle;

  /// Countdown chip on a VerifiedDeadlineCard when the event date has passed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get deadlineClosed;

  /// Countdown chip on a VerifiedDeadlineCard: event is days away.
  ///
  /// In en, this message translates to:
  /// **'in {days}d'**
  String deadlineInDays(int days);

  /// Countdown chip on a VerifiedDeadlineCard: event is hours away.
  ///
  /// In en, this message translates to:
  /// **'in {hours}h'**
  String deadlineInHours(int hours);

  /// Countdown chip on a VerifiedDeadlineCard: event is minutes away.
  ///
  /// In en, this message translates to:
  /// **'in {minutes}m'**
  String deadlineInMinutes(int minutes);

  /// Admission-calendar event label — event_type 'apply_open'.
  ///
  /// In en, this message translates to:
  /// **'Application opens'**
  String get eventApplyOpen;

  /// Admission-calendar event label — event_type 'apply_close'.
  ///
  /// In en, this message translates to:
  /// **'Application closes'**
  String get eventApplyClose;

  /// Admission-calendar event label — event_type 'document_submission_deadline'.
  ///
  /// In en, this message translates to:
  /// **'Documents due'**
  String get eventDocumentsDue;

  /// Admission-calendar event label — event_type 'first_stage_results'.
  ///
  /// In en, this message translates to:
  /// **'1st stage results'**
  String get eventFirstStageResults;

  /// Admission-calendar event label — event_type 'interview'. Same lemma as journeyStageInterview but scoped to the deadline card so translators can differ.
  ///
  /// In en, this message translates to:
  /// **'Interview'**
  String get eventInterviewLabel;

  /// Admission-calendar event label — event_type 'practical_exam'.
  ///
  /// In en, this message translates to:
  /// **'Practical exam'**
  String get eventPracticalExam;

  /// Admission-calendar event label — event_type 'final_results'.
  ///
  /// In en, this message translates to:
  /// **'Final results'**
  String get eventFinalResults;

  /// Admission-calendar event label — event_type 'additional_admit'.
  ///
  /// In en, this message translates to:
  /// **'Additional admit'**
  String get eventAdditionalAdmit;

  /// Admission-calendar event label — event_type 'registration_open'.
  ///
  /// In en, this message translates to:
  /// **'Registration opens'**
  String get eventRegistrationOpen;

  /// Admission-calendar event label — event_type 'registration_close'.
  ///
  /// In en, this message translates to:
  /// **'Registration closes'**
  String get eventRegistrationClose;

  /// Admission cycle-track label — cycle_track 'foreign'.
  ///
  /// In en, this message translates to:
  /// **'Foreign track'**
  String get cycleForeign;

  /// Admission cycle-track label — cycle_track 'overseas_korean_full'.
  ///
  /// In en, this message translates to:
  /// **'Overseas Korean (full)'**
  String get cycleOverseasKoreanFull;

  /// Admission cycle-track label — cycle_track 'overseas_korean_partial'.
  ///
  /// In en, this message translates to:
  /// **'Overseas Korean (partial)'**
  String get cycleOverseasKoreanPartial;

  /// Admission cycle-track label — cycle_track 'susi'. Korean admission-round proper noun; transliterated, not translated.
  ///
  /// In en, this message translates to:
  /// **'Susi'**
  String get cycleSusi;

  /// Admission cycle-track label — cycle_track 'jeongsi'. Korean admission-round proper noun; transliterated, not translated.
  ///
  /// In en, this message translates to:
  /// **'Jeongsi'**
  String get cycleJeongsi;

  /// Admission cycle-track label — cycle_track 'transfer'.
  ///
  /// In en, this message translates to:
  /// **'Transfer'**
  String get cycleTransfer;

  /// Admission cycle-track label — cycle_track 'grad_general'.
  ///
  /// In en, this message translates to:
  /// **'Graduate'**
  String get cycleGradGeneral;

  /// Admission cycle-track label — cycle_track 'grad_foreign'.
  ///
  /// In en, this message translates to:
  /// **'Graduate (foreign)'**
  String get cycleGradForeign;

  /// Header of the UniversitySpecificSetupAddon block inside the interview setup view.
  ///
  /// In en, this message translates to:
  /// **'University-specific interview'**
  String get uniSpecificHeader;

  /// Empty-state body in UniversitySpecificSetupAddon when no institution is picked yet.
  ///
  /// In en, this message translates to:
  /// **'Pick a university above to seed the interviewer with its recruitment unit, requirements, and key deadlines.'**
  String get uniSpecificPickPrompt;

  /// Error body in UniversitySpecificSetupAddon when recruitmentForInterviewProvider errors.
  ///
  /// In en, this message translates to:
  /// **'Could not load recruitment data: {error}\nYou can still run a general interview.'**
  String uniSpecificLoadError(Object error);

  /// Empty-state body in UniversitySpecificSetupAddon when no verified recruitment row exists. NOTE: '모집요강' is the Korean term for the official admission guideline document and is left untranslated across locales — it is the document name the student encounters on Korean university sites.
  ///
  /// In en, this message translates to:
  /// **'No verified recruitment data for this university yet. The interviewer will fall back to general questions until we ingest its 모집요강.'**
  String get uniSpecificNoData;

  /// Outline button inside UniversitySpecificSetupAddon empty/error states that flips the session type back to general.
  ///
  /// In en, this message translates to:
  /// **'Try a general interview instead'**
  String get uniSpecificFallbackButton;

  /// Applicant-category line in the recruitment summary inside UniversitySpecificSetupAddon.
  ///
  /// In en, this message translates to:
  /// **'Track: {category}'**
  String uniSpecificTrackLabel(String category);

  /// Caption at the bottom of the recruitment summary inside UniversitySpecificSetupAddon.
  ///
  /// In en, this message translates to:
  /// **'The interviewer will draw on this recruitment data when asking questions.'**
  String get uniSpecificSeedNote;

  /// Fallback department name in the recruitment-summary cycle line when neither department_ko nor faculty_ko is set.
  ///
  /// In en, this message translates to:
  /// **'Recruitment unit'**
  String get uniSpecificRecruitmentUnitFallback;

  /// Header title of the /institutions/:id detail screen. Paired with the decorative hangul label 대학 정보.
  ///
  /// In en, this message translates to:
  /// **'Institution'**
  String get uniDbInstitutionTitle;

  /// Empty-state title when the institution id has no row in v_institutions_for_map.
  ///
  /// In en, this message translates to:
  /// **'Institution not found'**
  String get uniDbNotFoundTitle;

  /// Empty-state body under uniDbNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'This university isn\'t in our catalog yet. Please check back soon.'**
  String get uniDbNotFoundBody;

  /// Section heading on the institution detail screen listing cycle_dates events.
  ///
  /// In en, this message translates to:
  /// **'Upcoming deadlines'**
  String get uniDbUpcomingDeadlines;

  /// Empty-state body of the deadlines section on the institution detail screen.
  ///
  /// In en, this message translates to:
  /// **'No upcoming deadlines announced yet.'**
  String get uniDbNoDeadlines;

  /// Section heading on the institution detail screen for per-faculty tuition rows.
  ///
  /// In en, this message translates to:
  /// **'Tuition'**
  String get uniDbTuitionHeading;

  /// Empty-state body of the tuition section.
  ///
  /// In en, this message translates to:
  /// **'Tuition details aren\'t available yet.'**
  String get uniDbTuitionEmpty;

  /// Section heading on the institution detail screen for admission requirements.
  ///
  /// In en, this message translates to:
  /// **'Requirements'**
  String get uniDbRequirementsHeading;

  /// Empty-state body of the requirements section.
  ///
  /// In en, this message translates to:
  /// **'Admission requirements aren\'t available yet.'**
  String get uniDbRequirementsEmpty;

  /// Section heading on the institution detail screen for scholarships.
  ///
  /// In en, this message translates to:
  /// **'Scholarships'**
  String get uniDbScholarshipsHeading;

  /// Empty-state body of the scholarships section.
  ///
  /// In en, this message translates to:
  /// **'No scholarships listed for this university yet.'**
  String get uniDbScholarshipsEmpty;

  /// Section heading on the institution detail screen for required documents per applicant category.
  ///
  /// In en, this message translates to:
  /// **'Document checklist'**
  String get uniDbDocumentChecklistHeading;

  /// Empty-state body of the document checklist section.
  ///
  /// In en, this message translates to:
  /// **'The document checklist isn\'t available yet.'**
  String get uniDbDocumentsEmpty;

  /// Title of the track/untrack switch card on the institution detail screen.
  ///
  /// In en, this message translates to:
  /// **'Track this institution'**
  String get uniDbTrackTitle;

  /// Subtitle of the track switch when tracking is ON.
  ///
  /// In en, this message translates to:
  /// **'You\'ll see deadlines on the home banner and get push notifications when something changes.'**
  String get uniDbTrackOnDesc;

  /// Subtitle of the track switch when tracking is OFF.
  ///
  /// In en, this message translates to:
  /// **'Turn on to follow deadlines, correction notices, and requirement changes.'**
  String get uniDbTrackOffDesc;

  /// SnackBar when toggling user_tracked_universities fails.
  ///
  /// In en, this message translates to:
  /// **'Could not update tracking: {error}'**
  String uniDbTrackError(Object error);

  /// Primary button on the institution detail screen — mints a signed URL for the admission guideline PDF and opens it externally.
  ///
  /// In en, this message translates to:
  /// **'Open admission guide PDF'**
  String get uniDbOpenGuidePdf;

  /// Caption shown when the institution has no parsed guideline PDF on file.
  ///
  /// In en, this message translates to:
  /// **'No admission guide PDF available yet.'**
  String get uniDbNoGuidePdf;

  /// SnackBar when launchUrl returns false for the signed PDF URL.
  ///
  /// In en, this message translates to:
  /// **'Could not open the PDF — no app available to handle it.'**
  String get uniDbPdfNoApp;

  /// SnackBar when the get-pdf-url flow throws.
  ///
  /// In en, this message translates to:
  /// **'Could not open PDF: {error}'**
  String uniDbPdfError(Object error);

  /// Caption above the tuition rows stating the academic year they belong to.
  ///
  /// In en, this message translates to:
  /// **'{year} academic year'**
  String uniDbAcademicYear(int year);

  /// Caption on a tuition row identifying the semester.
  ///
  /// In en, this message translates to:
  /// **'Semester {number}'**
  String uniDbSemesterLabel(int number);

  /// Suffix appended to the semester caption when the row is the first (entry) semester.
  ///
  /// In en, this message translates to:
  /// **'first semester'**
  String get uniDbFirstSemester;

  /// Caption under the tuition amount stating the one-off admission fee. amount is a pre-formatted ₩ value like ₩120,000.
  ///
  /// In en, this message translates to:
  /// **'+ {amount} fee'**
  String uniDbAdmissionFee(String amount);

  /// Requirements chip stating the GPA floor percentage. GPA is a proper noun.
  ///
  /// In en, this message translates to:
  /// **'GPA ≥ {pct}%'**
  String uniDbGpaChip(String pct);

  /// Label above the TOPIK-level to award-percentage chips on a scholarship card. TOPIK is a proper noun.
  ///
  /// In en, this message translates to:
  /// **'TOPIK tier table'**
  String get uniDbTopikTierTable;

  /// Subtitle of an applicant-category group in the document checklist.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{1 document} other{{count} documents}}'**
  String uniDbDocumentsCount(int count);

  /// Tooltip on the shield icon of a document row that needs an apostille.
  ///
  /// In en, this message translates to:
  /// **'Apostille required'**
  String get uniDbApostilleRequired;

  /// Caption on the institution header card. date is a pre-formatted yyyy-mm-dd string.
  ///
  /// In en, this message translates to:
  /// **'Last verified: {date}'**
  String uniDbLastVerified(String date);

  /// Deadline event label for event_type orientation.
  ///
  /// In en, this message translates to:
  /// **'Orientation'**
  String get eventOrientation;

  /// Deadline event label for event_type semester_start.
  ///
  /// In en, this message translates to:
  /// **'Semester starts'**
  String get eventSemesterStart;

  /// Tuition faculty group label for faculty_group humanities.
  ///
  /// In en, this message translates to:
  /// **'Humanities'**
  String get facultyHumanities;

  /// Tuition faculty group label for faculty_group social_science.
  ///
  /// In en, this message translates to:
  /// **'Social Science'**
  String get facultySocialScience;

  /// Tuition faculty group label for faculty_group natural_science.
  ///
  /// In en, this message translates to:
  /// **'Natural Science'**
  String get facultyNaturalScience;

  /// Tuition faculty group label for faculty_group engineering.
  ///
  /// In en, this message translates to:
  /// **'Engineering'**
  String get facultyEngineering;

  /// Tuition faculty group label for faculty_group medical.
  ///
  /// In en, this message translates to:
  /// **'Medical / Pharma'**
  String get facultyMedical;

  /// Tuition faculty group label for faculty_group arts.
  ///
  /// In en, this message translates to:
  /// **'Arts'**
  String get facultyArts;

  /// Tuition faculty group label for faculty_group pe.
  ///
  /// In en, this message translates to:
  /// **'Physical Education'**
  String get facultyPhysicalEducation;

  /// Header title of the /institutions/compare screen. Paired with the decorative hangul label 비교.
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get uniDbCompareTitle;

  /// Empty-state title on the compare screen when no institutions matched the ids.
  ///
  /// In en, this message translates to:
  /// **'Compare universities'**
  String get uniDbCompareEmptyTitle;

  /// Empty-state body under uniDbCompareEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'Track at least two institutions, then return here to compare them.'**
  String get uniDbCompareEmptyBody;

  /// Hint on the compare screen when only one institution was resolved.
  ///
  /// In en, this message translates to:
  /// **'Need a second university to compare against.'**
  String get uniDbCompareNeedSecond;

  /// Line under uniDbCompareNeedSecond naming the single selected institution.
  ///
  /// In en, this message translates to:
  /// **'Currently selected: {name}'**
  String uniDbCompareSelected(String name);

  /// Compare-column field label: the institution's English name.
  ///
  /// In en, this message translates to:
  /// **'English name'**
  String get uniDbColEnglishName;

  /// Compare-column field label: the institution's Uzbek name.
  ///
  /// In en, this message translates to:
  /// **'Uzbek name'**
  String get uniDbColUzbekName;

  /// Compare-column field label: date the row was last verified.
  ///
  /// In en, this message translates to:
  /// **'Last verified'**
  String get uniDbColLastVerified;

  /// Header title of the /applications/tracker screen. Paired with the decorative hangul label 지원 현황.
  ///
  /// In en, this message translates to:
  /// **'Application tracker'**
  String get uniDbTrackerTitle;

  /// Empty-state title on the application tracker when the user tracks nothing.
  ///
  /// In en, this message translates to:
  /// **'No tracked universities yet'**
  String get uniDbTrackerEmptyTitle;

  /// Empty-state body under uniDbTrackerEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'Track a university on its page and its deadlines will appear here.'**
  String get uniDbTrackerEmptyBody;

  /// Error shown when the public university catalogue fails to load. Distinct from appsLoadError, which names the student's own applications — a guest has none.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load the university list.'**
  String get uniDbLoadFailed;

  /// Primary submit button on the Magic Code screen (DESIGN_SPEC §3.2). Distinct from welcomeMagicCodeCta, which is the Welcome-screen CTA that opens this screen.
  ///
  /// In en, this message translates to:
  /// **'Login to System'**
  String get loginSubmitButton;

  /// Caption under the Welcome screen's 'Explore Universities' guest button (DESIGN_SPEC §3.1).
  ///
  /// In en, this message translates to:
  /// **'No code needed to browse and compare.'**
  String get welcomeGuestCaption;

  /// Label in the divider above the Welcome screen's 'I have a magic code' button. Shown in capitals.
  ///
  /// In en, this message translates to:
  /// **'Hanguk clients'**
  String get welcomeClientsDivider;

  /// First half of the line under the Magic Code button: 'No code? Ask your consultant'.
  ///
  /// In en, this message translates to:
  /// **'No code?'**
  String get loginNoCodePrompt;

  /// Second, emphasised half of the line under the Magic Code button.
  ///
  /// In en, this message translates to:
  /// **'Ask your consultant'**
  String get loginAskConsultant;

  /// Accessibility label for the notification bell in the Home top bar (DESIGN_SPEC §3.3).
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get homeNotifications;

  /// Section header on the Notifications screen listing each application's current stage.
  ///
  /// In en, this message translates to:
  /// **'Application updates'**
  String get notifApplicationUpdates;

  /// Chip on a Notifications reminder for a required document not yet uploaded.
  ///
  /// In en, this message translates to:
  /// **'To upload'**
  String get notifToUpload;

  /// Empty-state title on the Notifications screen when nothing needs attention.
  ///
  /// In en, this message translates to:
  /// **'You\'re all caught up'**
  String get notifAllCaughtUp;

  /// Empty-state body on the Notifications screen.
  ///
  /// In en, this message translates to:
  /// **'Reminders about your documents and applications will appear here.'**
  String get notifAllCaughtUpBody;

  /// Eyebrow above the title of the guest contact sheet.
  ///
  /// In en, this message translates to:
  /// **'Hanguk Consulting'**
  String get guestContactEyebrow;

  /// Title of the contact sheet opened by the lime pill in the guest header.
  ///
  /// In en, this message translates to:
  /// **'Get in touch'**
  String get guestContactTitle;

  /// Sub-line of the guest contact sheet.
  ///
  /// In en, this message translates to:
  /// **'Pick a channel — we answer on all of them.'**
  String get guestContactSubtitle;

  /// Contact sheet row opening the Hanguk Consulting Telegram channel.
  ///
  /// In en, this message translates to:
  /// **'Telegram channel'**
  String get guestContactTelegramChannel;

  /// Second line under the Telegram channel row.
  ///
  /// In en, this message translates to:
  /// **'News, deadlines and open intakes'**
  String get guestContactTelegramChannelHint;

  /// Contact sheet row opening a direct Telegram chat with a consultant.
  ///
  /// In en, this message translates to:
  /// **'Message us on Telegram'**
  String get guestContactTelegramDirect;

  /// Second line under the direct Telegram row.
  ///
  /// In en, this message translates to:
  /// **'Ask a consultant directly'**
  String get guestContactTelegramDirectHint;

  /// Contact sheet row opening the Instagram page.
  ///
  /// In en, this message translates to:
  /// **'Instagram'**
  String get guestContactInstagram;

  /// Second line under the Instagram row.
  ///
  /// In en, this message translates to:
  /// **'Students, campuses, daily life'**
  String get guestContactInstagramHint;

  /// Contact sheet row placing a phone call; the number is shown beneath it.
  ///
  /// In en, this message translates to:
  /// **'Call us'**
  String get guestContactCall;

  /// Second line under the magic-code login row of the contact sheet.
  ///
  /// In en, this message translates to:
  /// **'Already have a magic code?'**
  String get guestContactJoinHint;

  /// SnackBar when no app can open the tapped contact link.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open that link on this device.'**
  String get guestContactLaunchFailed;

  /// Lime pill in the guest header; opens the contact sheet.
  ///
  /// In en, this message translates to:
  /// **'Contact us'**
  String get guestContactCta;

  /// Button under an AI answer that opens the report sheet.
  ///
  /// In en, this message translates to:
  /// **'Report'**
  String get aiReportAction;

  /// Title of the sheet for reporting an AI response.
  ///
  /// In en, this message translates to:
  /// **'Report this response'**
  String get aiReportTitle;

  /// Explanation inside the AI report sheet.
  ///
  /// In en, this message translates to:
  /// **'Tell us what is wrong with this AI response. Our team reviews every report.'**
  String get aiReportBody;

  /// Placeholder in the optional free-text field of the AI report sheet.
  ///
  /// In en, this message translates to:
  /// **'What is wrong with it? (optional)'**
  String get aiReportReasonHint;

  /// Primary action of the AI report sheet.
  ///
  /// In en, this message translates to:
  /// **'Send report'**
  String get aiReportSubmit;

  /// Confirmation shown after an AI report is stored.
  ///
  /// In en, this message translates to:
  /// **'Thank you. Our team will review this response.'**
  String get aiReportThanks;

  /// Shown when storing an AI report failed.
  ///
  /// In en, this message translates to:
  /// **'Could not send the report. Please try again.'**
  String get aiReportFailed;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Search university name'**
  String get catalogSearchHint;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Universities'**
  String get catalogListTitle;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'{city} universities'**
  String catalogCityUniversities(String city);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'No universities found'**
  String get catalogEmptyTitle;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Try another city or filter.'**
  String get catalogEmptyBody;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'State university'**
  String get catalogTypeState;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Private university'**
  String get catalogTypePrivate;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Specialized institute'**
  String get catalogTypeSpecialized;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get catalogTypeStateShort;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Private'**
  String get catalogTypePrivateShort;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Specialized'**
  String get catalogTypeSpecializedShort;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get catalogFilterTitle;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get catalogFilterClear;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get catalogFilterCity;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'{count} selected'**
  String catalogFilterCityPicked(int count);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Degree'**
  String get catalogFilterDegree;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Bachelor'**
  String get catalogDegreeBachelor;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Master'**
  String get catalogDegreeMaster;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'English requirement'**
  String get catalogFilterEnglish;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'your IELTS score'**
  String get catalogFilterEnglishHint;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Not needed'**
  String get catalogIeltsNone;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'All programmes (Korean and English)'**
  String get catalogIeltsNoteAll;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Only English-taught programmes you can enter with IELTS {score}'**
  String catalogIeltsNote(String score);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Tuition'**
  String get catalogFilterPrice;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'per semester'**
  String get catalogPricePerSemester;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get catalogPriceFrom;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get catalogPriceTo;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'up to {amount}'**
  String catalogPriceUpTo(String amount);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Show {count} universities'**
  String catalogApply(int count);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Faculties'**
  String get catalogFaculties;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'{count} faculties'**
  String catalogFacultyCount(int count);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'{count} programmes'**
  String catalogProgramCount(int count);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Tuition · {name}'**
  String catalogTuitionTitle(String name);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'/ semester'**
  String get catalogPerSemester;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'/ year'**
  String get catalogPerYear;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'/sem'**
  String get catalogSemSuffix;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'/yr'**
  String get catalogYearSuffix;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Yearly tuition'**
  String get catalogYearlyTuition;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Application fee'**
  String get catalogApplicationFee;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Entrance fee'**
  String get catalogEntranceFee;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Admission requirements'**
  String get catalogRequirements;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Korean language'**
  String get catalogReqKorean;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'For English programmes'**
  String get catalogReqEnglish;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Recommendation letter'**
  String get catalogReqRecommendation;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get catalogRecYes;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Not needed'**
  String get catalogRecNo;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get catalogRecOptional;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get catalogReqDocuments;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'{count} required'**
  String catalogDocsRequired(int count);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Apostille'**
  String get catalogReqApostille;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'on {count} documents'**
  String catalogApostilleDocs(int count);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Bank balance (D-2)'**
  String get catalogReqBank;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Deadlines · {season}'**
  String catalogTimeline(String season);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Announced later'**
  String get catalogRoundLater;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'estimated'**
  String get catalogRoundEstimated;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'No fixed date'**
  String get catalogRoundRelative;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Document submission'**
  String get catalogWindowLabel;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'{days} days left'**
  String catalogDaysLeft(int days);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Opens {date}'**
  String catalogWindowOpens(String date);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Deadline passed'**
  String get catalogWindowClosed;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Contact us'**
  String get catalogContact;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Spring'**
  String get catalogSeasonSpring;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Autumn'**
  String get catalogSeasonAutumn;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'{year} {term}'**
  String catalogSeasonLabel(String year, String term);

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'Add to compare'**
  String get catalogFavorite;

  /// University catalogue (Explore / Applications browse).
  ///
  /// In en, this message translates to:
  /// **'No data for this degree yet'**
  String get catalogNoDegreeData;

  /// Chip next to the season chip that turns compare mode on.
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get catalogCompareChip;

  /// The same chip while compare mode is on; tapping it leaves compare mode.
  ///
  /// In en, this message translates to:
  /// **'Compare · {count}/2'**
  String catalogCompareChipCount(int count);

  /// Right of the list title while compare mode is on.
  ///
  /// In en, this message translates to:
  /// **'Choose 2 universities'**
  String get catalogComparePickTwo;

  /// Empty slot in the compare tray at the bottom of the list.
  ///
  /// In en, this message translates to:
  /// **'Choose'**
  String get compareTraySlotEmpty;

  /// Button in the compare tray that opens the compare screen.
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get compareTrayCta;

  /// Title of the compare screen.
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get compareTitle;

  /// Toggle on the compare screen that hides rows where both universities are the same.
  ///
  /// In en, this message translates to:
  /// **'Only differences'**
  String get compareOnlyDiff;

  /// Empty column on the compare screen after a university was removed.
  ///
  /// In en, this message translates to:
  /// **'Choose a university'**
  String get compareAddSlot;

  /// Shown on the compare screen when fewer than two universities are chosen.
  ///
  /// In en, this message translates to:
  /// **'Choose 2 universities to compare.'**
  String get compareNeedTwo;

  /// Heading of the short facts section on the compare screen.
  ///
  /// In en, this message translates to:
  /// **'Key facts'**
  String get compareMainInfo;

  /// Heading of the long text section on the compare screen.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get compareDetails;

  /// Compare row: tuition for one semester.
  ///
  /// In en, this message translates to:
  /// **'Tuition (semester)'**
  String get compareRowTuition;

  /// Compare row: minimum TOPIK level.
  ///
  /// In en, this message translates to:
  /// **'TOPIK requirement'**
  String get compareRowTopik;

  /// Compare row: minimum IELTS score.
  ///
  /// In en, this message translates to:
  /// **'IELTS requirement'**
  String get compareRowIelts;

  /// Compare row: last day to apply.
  ///
  /// In en, this message translates to:
  /// **'Application deadline'**
  String get compareRowDeadline;

  /// Compare row: city.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get compareRowCity;

  /// Compare details row: the documents the university asks for.
  ///
  /// In en, this message translates to:
  /// **'Admission requirements'**
  String get compareRowRequirements;

  /// Badge on the cheaper tuition.
  ///
  /// In en, this message translates to:
  /// **'Cheaper'**
  String get compareBestCheaper;

  /// Badge on the lower TOPIK or IELTS requirement.
  ///
  /// In en, this message translates to:
  /// **'Lower'**
  String get compareBestLower;

  /// Title of the phone sign-up screen.
  ///
  /// In en, this message translates to:
  /// **'Sign up'**
  String get entryRegisterTitle;

  /// Line under the sign-up title.
  ///
  /// In en, this message translates to:
  /// **'Create an account with your phone number and a password.'**
  String get entryRegisterSubtitle;

  /// Label above the phone number field.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get entryPhoneLabel;

  /// Label above the password field.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get entryPasswordLabel;

  /// Label above the repeat-password field on sign-up.
  ///
  /// In en, this message translates to:
  /// **'Repeat password'**
  String get entryPasswordConfirmLabel;

  /// Placeholder in the password field.
  ///
  /// In en, this message translates to:
  /// **'At least 6 characters'**
  String get entryPasswordHint;

  /// Primary button on the sign-up screen.
  ///
  /// In en, this message translates to:
  /// **'Sign up'**
  String get entryRegisterSubmit;

  /// Text before the sign-in link on the sign-up screen.
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get entryHaveAccount;

  /// Link from sign-up to sign-in.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get entrySignInLink;

  /// Title of the phone sign-in screen.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get entrySignInTitle;

  /// Line under the sign-in title.
  ///
  /// In en, this message translates to:
  /// **'Enter the phone number and password you signed up with.'**
  String get entrySignInSubtitle;

  /// Primary button on the sign-in screen.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get entrySignInSubmit;

  /// Text before the sign-up link on the sign-in screen.
  ///
  /// In en, this message translates to:
  /// **'No account yet?'**
  String get entryNoAccount;

  /// Link from sign-in to sign-up.
  ///
  /// In en, this message translates to:
  /// **'Sign up'**
  String get entryRegisterLink;

  /// The phone number is not 9 digits after +998.
  ///
  /// In en, this message translates to:
  /// **'Enter the full number: 9 digits after +998.'**
  String get entryErrorPhone;

  /// The password is shorter than 6 characters.
  ///
  /// In en, this message translates to:
  /// **'The password must be at least 6 characters.'**
  String get entryErrorPasswordShort;

  /// The two passwords on sign-up differ.
  ///
  /// In en, this message translates to:
  /// **'The passwords do not match.'**
  String get entryErrorPasswordMismatch;

  /// Sign-up with a number that already has an account.
  ///
  /// In en, this message translates to:
  /// **'This number is already signed up. Sign in with your password.'**
  String get entryErrorExists;

  /// Shown on the Magic Code screen when the number belongs to a Hanguk student.
  ///
  /// In en, this message translates to:
  /// **'You are a Hanguk student — sign in with the Magic Code your consultant gave you.'**
  String get entryStudentNotice;

  /// Sign-in with a number that has no account.
  ///
  /// In en, this message translates to:
  /// **'This number is not signed up yet.'**
  String get entryErrorNotFound;

  /// Sign-in with the wrong password.
  ///
  /// In en, this message translates to:
  /// **'Wrong password.'**
  String get entryErrorWrongPassword;

  /// Ten wrong passwords in a row.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Try again in 15 minutes.'**
  String get entryErrorLocked;

  /// The server could not be reached.
  ///
  /// In en, this message translates to:
  /// **'Could not reach the server. Check your connection and try again.'**
  String get entryErrorNetwork;

  /// Screen-reader label of the eye button that shows the password.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get entryShowPassword;

  /// Screen-reader label of the eye button that hides the password.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get entryHidePassword;

  /// Label of the language setting.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get entryLanguageLabel;

  /// Title of the language picker sheet.
  ///
  /// In en, this message translates to:
  /// **'Choose a language'**
  String get entryLanguageSheetTitle;

  /// Admission timeline step 1 of the guideline template (etap_raqam = 1).
  ///
  /// In en, this message translates to:
  /// **'Online application'**
  String get catalogStep1;

  /// Admission timeline step 2 of the guideline template (etap_raqam = 2).
  ///
  /// In en, this message translates to:
  /// **'Application fee payment'**
  String get catalogStep2;

  /// Admission timeline step 3 of the guideline template (etap_raqam = 3).
  ///
  /// In en, this message translates to:
  /// **'Offline document submission'**
  String get catalogStep3;

  /// Admission timeline step 4 of the guideline template (etap_raqam = 4).
  ///
  /// In en, this message translates to:
  /// **'Bank statement (for the university)'**
  String get catalogStep4;

  /// Admission timeline step 5 of the guideline template (etap_raqam = 5).
  ///
  /// In en, this message translates to:
  /// **'Interview'**
  String get catalogStep5;

  /// Admission timeline step 6 of the guideline template (etap_raqam = 6).
  ///
  /// In en, this message translates to:
  /// **'Results announced'**
  String get catalogStep6;

  /// Admission timeline step 7 of the guideline template (etap_raqam = 7).
  ///
  /// In en, this message translates to:
  /// **'Tuition payment'**
  String get catalogStep7;

  /// Admission timeline step 8 of the guideline template (etap_raqam = 8).
  ///
  /// In en, this message translates to:
  /// **'Certificate of Admission issued'**
  String get catalogStep8;

  /// Admission timeline step 9 of the guideline template (etap_raqam = 9).
  ///
  /// In en, this message translates to:
  /// **'Bank statement for the visa'**
  String get catalogStep9;

  /// Admission timeline step 10 of the guideline template (etap_raqam = 10).
  ///
  /// In en, this message translates to:
  /// **'Translation and apostille for the visa'**
  String get catalogStep10;

  /// Admission timeline step 11 of the guideline template (etap_raqam = 11).
  ///
  /// In en, this message translates to:
  /// **'Visa application'**
  String get catalogStep11;

  /// Title of the surveys list (HangulTag English line) and the Han orb menu item
  ///
  /// In en, this message translates to:
  /// **'Surveys'**
  String get surveysTitle;

  /// Error state when the surveys list fails to load
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load surveys'**
  String get surveysLoadError;

  /// Empty state title on the surveys list
  ///
  /// In en, this message translates to:
  /// **'No surveys yet'**
  String get surveysEmptyTitle;

  /// Empty state body on the surveys list
  ///
  /// In en, this message translates to:
  /// **'New surveys will appear here'**
  String get surveysEmptyBody;

  /// Status chip on a survey the student has fully answered
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get surveyCompletedChip;

  /// Status chip on a survey the student has not started
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get surveyNewChip;

  /// Number of questions in a survey, shown on the survey card
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 question} other{{count} questions}}'**
  String surveyQuestionCount(int count);

  /// Call to action on an unfinished survey card
  ///
  /// In en, this message translates to:
  /// **'Fill in →'**
  String get surveyFillCta;

  /// Home card title when several surveys wait to be filled in
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 survey} other{{count} surveys}}'**
  String surveyPendingCount(int count);

  /// Home card subtitle for surveys not filled in yet
  ///
  /// In en, this message translates to:
  /// **'Waiting for your answers'**
  String get surveyPendingSubtitle;

  /// Survey screen title when the survey title is not known
  ///
  /// In en, this message translates to:
  /// **'Survey'**
  String get surveyTitleFallback;

  /// Warning when required survey questions are unanswered
  ///
  /// In en, this message translates to:
  /// **'Please answer all required questions'**
  String get surveyAnswerAllRequired;

  /// Error when survey answers fail to send
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t send your answers. Please try again.'**
  String get surveySubmitError;

  /// Title of the screen shown after a survey is submitted
  ///
  /// In en, this message translates to:
  /// **'Thank you!'**
  String get surveyThanksTitle;

  /// Body of the screen shown after a survey is submitted
  ///
  /// In en, this message translates to:
  /// **'Your answers have been received'**
  String get surveyThanksBody;

  /// Error state when survey questions fail to load
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load the questions'**
  String get surveyQuestionsLoadError;

  /// Empty state when a survey has no questions
  ///
  /// In en, this message translates to:
  /// **'No questions found'**
  String get surveyNoQuestions;

  /// Notice under a survey the student already answered
  ///
  /// In en, this message translates to:
  /// **'You\'ve already completed this survey'**
  String get surveyAlreadyCompleted;

  /// Button that sends survey answers
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get surveySubmit;

  /// Marker under a required survey question
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get surveyRequired;

  /// Hint in an email answer field
  ///
  /// In en, this message translates to:
  /// **'example@mail.com'**
  String get surveyEmailHint;

  /// Hint in a number answer field
  ///
  /// In en, this message translates to:
  /// **'Enter a number'**
  String get surveyNumberHint;

  /// Hint in a long text answer field
  ///
  /// In en, this message translates to:
  /// **'Write in detail...'**
  String get surveyLongTextHint;

  /// Hint in a short text answer field
  ///
  /// In en, this message translates to:
  /// **'Write your answer...'**
  String get surveyTextHint;

  /// Placeholder in a date answer field before a date is picked
  ///
  /// In en, this message translates to:
  /// **'Pick a date'**
  String get surveyPickDate;

  /// Name of a required document on the Documents tab and in Notifications (DocumentType id applicant_id_card). In Uzbekistan the ID card replaced the internal passport.
  ///
  /// In en, this message translates to:
  /// **'Applicant\'s ID card (passport) copy'**
  String get docTypeIdCard;

  /// Name of a required document (DocumentType id foreign_passport): the passport for travel abroad.
  ///
  /// In en, this message translates to:
  /// **'Applicant\'s foreign passport copy'**
  String get docTypeForeignPassport;

  /// Name of a required document (DocumentType id photo): a 3.5 x 4.5 cm photo.
  ///
  /// In en, this message translates to:
  /// **'Photo (3.5x4.5 cm)'**
  String get docTypePhoto;

  /// Name of a required document (DocumentType id diploma): a university diploma or school-leaving certificate.
  ///
  /// In en, this message translates to:
  /// **'Diploma or school certificate copy'**
  String get docTypeDiploma;

  /// Name of a required document (DocumentType id language_certificate), with the minimum score.
  ///
  /// In en, this message translates to:
  /// **'Language certificate copy (at least IELTS 5.5 or TOPIK 2)'**
  String get docTypeLanguageCertificate;

  /// Fallback name for a document type the app has no name for.
  ///
  /// In en, this message translates to:
  /// **'Document'**
  String get docTypeOther;

  /// Status chip on a document row that cannot be uploaded yet (shown beside the Korean accent 잠김).
  ///
  /// In en, this message translates to:
  /// **'Locked'**
  String get docStatusLocked;

  /// Section heading above the received push notifications on the Notifications screen.
  ///
  /// In en, this message translates to:
  /// **'Recent notifications'**
  String get notifPushSection;

  /// Button in the Notifications screen header that marks every notification as read.
  ///
  /// In en, this message translates to:
  /// **'Mark all read'**
  String get notifMarkAllRead;

  /// Note in an expanded application card while a counselor has not approved the chosen university yet.
  ///
  /// In en, this message translates to:
  /// **'Awaiting counselor approval.\nWe will notify you once it\'s reviewed.'**
  String get appPendingApprovalNote;

  /// Shown in place of the city on an application card when the university has no city on record.
  ///
  /// In en, this message translates to:
  /// **'South Korea'**
  String get appCountrySouthKorea;

  /// Error in a university room tab (Discussion / Calendar) when the university has no room.
  ///
  /// In en, this message translates to:
  /// **'This university doesn\'t have a room yet.'**
  String get appRoomNotFound;

  /// Error in the university room's Discussion tab when the room has no discussion channel.
  ///
  /// In en, this message translates to:
  /// **'This room has no discussion yet.'**
  String get appRoomDiscussionNotFound;

  /// Error in the university room's Discussion tab when loading or connecting failed. A Retry button follows.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t connect to the discussion.'**
  String get appRoomDiscussionConnectError;

  /// Error in the university room's Discussion tab when a message could not be sent.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t send the message.'**
  String get appRoomSendError;

  /// Error in the university room's Discussion tab when the session has expired.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again.'**
  String get appRoomNotSignedIn;

  /// Generic error in the university room's News or Calendar tab when loading failed. A Retry button follows.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load this. Please try again.'**
  String get appRoomLoadError;

  /// Title for an announcement in the university room's News tab that has no title of its own.
  ///
  /// In en, this message translates to:
  /// **'Announcement'**
  String get appRoomAnnouncementFallbackTitle;

  /// Title for an event in the university room's Calendar tab that has no title of its own.
  ///
  /// In en, this message translates to:
  /// **'Event'**
  String get appRoomEventFallbackTitle;

  /// Application status chip/label: the student chose the university and a counselor has not approved it yet (applications.status pending / pending_approval).
  ///
  /// In en, this message translates to:
  /// **'Awaiting approval'**
  String get statusPendingApproval;

  /// Application status label (applications.status documents_collection): the documents have been collected.
  ///
  /// In en, this message translates to:
  /// **'Documents collected'**
  String get statusDocumentsCollection;

  /// Application status label (applications.status documents_translation): the documents have been translated.
  ///
  /// In en, this message translates to:
  /// **'Documents translated'**
  String get statusDocumentsTranslation;

  /// Application status label (applications.status apostille): the apostille is ready.
  ///
  /// In en, this message translates to:
  /// **'Apostille ready'**
  String get statusApostille;

  /// Application status label (applications.status application_submitted): the application has been submitted to the university.
  ///
  /// In en, this message translates to:
  /// **'Application submitted'**
  String get statusApplicationSubmitted;

  /// Application status label (applications.status university_response): the university has replied (admission letter stage).
  ///
  /// In en, this message translates to:
  /// **'University replied'**
  String get statusUniversityResponse;

  /// Application status label (applications.status visa_documents): the visa documents are being prepared / are ready.
  ///
  /// In en, this message translates to:
  /// **'Visa documents'**
  String get statusVisaDocuments;

  /// Application status label (applications.status completed): the whole process is finished.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// Fallback application status label for a status code the app does not know yet.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get statusInProgress;

  /// First assistant bubble in the Hanguk AI chat. 'Hanguk AI' is the product name.
  ///
  /// In en, this message translates to:
  /// **'Hi! 👋 I\'m the Hanguk AI assistant. Ask me anything about documents, universities or the application process!'**
  String get chatGreeting;

  /// Assistant bubble when the AI returned an empty answer.
  ///
  /// In en, this message translates to:
  /// **'Sorry, I couldn\'t generate a response.'**
  String get chatNoResponse;

  /// Error banner in the AI chat when the request fails.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t reach Hanguk AI. Check your connection.'**
  String get chatConnectError;

  /// Assistant bubble shown after the chat history is cleared.
  ///
  /// In en, this message translates to:
  /// **'Chat cleared. How can I help you?'**
  String get chatCleared;

  /// Message inside the map WebView when the map has not loaded after 8 seconds.
  ///
  /// In en, this message translates to:
  /// **'The map didn\'t load. Check your internet connection.'**
  String get mapLoadFailed;

  /// Hint under a university name in the map marker preview bubble.
  ///
  /// In en, this message translates to:
  /// **'Tap for details'**
  String get mapTapForDetails;

  /// Message inside the map WebView when no map provider could be loaded.
  ///
  /// In en, this message translates to:
  /// **'The map service is unavailable right now.'**
  String get mapProviderUnavailable;

  /// Message inside the map WebView when the map failed to start.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t start the map.'**
  String get mapInitError;

  /// Study Plan trainer, step 1: guide title.
  ///
  /// In en, this message translates to:
  /// **'Study Plan writing guide'**
  String get trainingGuideSpTitle;

  /// Study Plan trainer, step 1: guide introduction.
  ///
  /// In en, this message translates to:
  /// **'A Study Plan explains why you want to study in South Korea, the goals you have set for yourself, and what you plan to do after graduation.'**
  String get trainingGuideSpIntro;

  /// Study Plan guide, item 1 title.
  ///
  /// In en, this message translates to:
  /// **'1. Purpose & motivation'**
  String get trainingGuideSp1Title;

  /// Study Plan guide, item 1 text.
  ///
  /// In en, this message translates to:
  /// **'Why did you choose this major? Why does South Korea — and the specific university you applied to — fit that goal?'**
  String get trainingGuideSp1Body;

  /// Study Plan guide, item 2 title.
  ///
  /// In en, this message translates to:
  /// **'2. Academic plan'**
  String get trainingGuideSp2Title;

  /// Study Plan guide, item 2 text.
  ///
  /// In en, this message translates to:
  /// **'Which courses or research areas will you focus on? What is your Korean-language learning plan?'**
  String get trainingGuideSp2Body;

  /// Study Plan guide, item 3 title.
  ///
  /// In en, this message translates to:
  /// **'3. Future plans'**
  String get trainingGuideSp3Title;

  /// Study Plan guide, item 3 text.
  ///
  /// In en, this message translates to:
  /// **'What do you intend to do after graduation? How will you contribute back home?'**
  String get trainingGuideSp3Body;

  /// Personal Statement trainer, step 1: guide title.
  ///
  /// In en, this message translates to:
  /// **'Personal Statement writing guide'**
  String get trainingGuidePsTitle;

  /// Personal Statement trainer, step 1: guide introduction.
  ///
  /// In en, this message translates to:
  /// **'A Personal Statement is an essay that shows who you are, what you have achieved, what interests you, and why you fit this major.'**
  String get trainingGuidePsIntro;

  /// Personal Statement guide, item 1 title.
  ///
  /// In en, this message translates to:
  /// **'1. Past & experience'**
  String get trainingGuidePs1Title;

  /// Personal Statement guide, item 1 text.
  ///
  /// In en, this message translates to:
  /// **'Write about your school achievements, the olympiads or projects you joined, and the interests you developed.'**
  String get trainingGuidePs1Body;

  /// Personal Statement guide, item 2 title.
  ///
  /// In en, this message translates to:
  /// **'2. Personal strengths'**
  String get trainingGuidePs2Title;

  /// Personal Statement guide, item 2 text.
  ///
  /// In en, this message translates to:
  /// **'What sets you apart from other applicants? How did you handle setbacks?'**
  String get trainingGuidePs2Body;

  /// Personal Statement guide, item 3 title.
  ///
  /// In en, this message translates to:
  /// **'3. Why this field?'**
  String get trainingGuidePs3Title;

  /// Personal Statement guide, item 3 text.
  ///
  /// In en, this message translates to:
  /// **'When and how did your interest in this field start?'**
  String get trainingGuidePs3Body;

  /// Status of a Study Plan / interview session that is not finished (DB codes 'in_progress', 'active'). Used inside sessionStatusLabel and on status chips.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get trainingStatusInProgress;

  /// Status of a finished Study Plan / interview session (DB code 'completed').
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get trainingStatusCompleted;

  /// Status of an interview session that was stopped before the end (DB code 'abandoned').
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get trainingStatusAbandoned;

  /// Study Plan trainer: the list of saved drafts could not be loaded.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load your drafts. Please try again.'**
  String get trainingErrorSessionsLoad;

  /// Study Plan trainer: creating a new draft session failed (shown in the start dialog).
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t create the draft. Please try again.'**
  String get trainingErrorCreateDraft;

  /// Study Plan trainer: opening a saved draft failed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the draft. Please try again.'**
  String get trainingErrorLoadDraft;

  /// Study Plan trainer: a newer draft was saved from another device.
  ///
  /// In en, this message translates to:
  /// **'Another device saved a newer draft. Please refresh to merge.'**
  String get trainingErrorDraftConflict;

  /// Study Plan trainer: changing the writing language track (English / Korean) failed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t change the writing language. Please try again.'**
  String get trainingErrorTrackUpdate;

  /// Study Plan trainer: fallback for an unexpected error.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get trainingErrorGeneric;

  /// Mock interview: the AI interviewer failed to answer.
  ///
  /// In en, this message translates to:
  /// **'The AI interviewer ran into a problem. Please try again.'**
  String get trainingInterviewAiError;

  /// Mock interview: the student's answer could not be processed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t process your answer. Please try again.'**
  String get trainingInterviewAnswerError;

  /// Mock interview: the interviewer's voice could not be played.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t play the interviewer\'s voice.'**
  String get trainingInterviewVoiceError;

  /// Mock interview: the link to the call recording could not be saved.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t save the recording link. Replay may be unavailable.'**
  String get trainingInterviewAudioLinkWarning;

  /// Mock interview: the feedback for a session could not be loaded.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load the feedback. Please try again.'**
  String get trainingInterviewFeedbackLoadError;

  /// Magic-code sign-in: no student has this code.
  ///
  /// In en, this message translates to:
  /// **'We don\'t recognise this code. Please double-check it with your counsellor.'**
  String get authErrorCodeNotFound;

  /// Magic-code sign-in: the server could not be reached (not a problem with the code).
  ///
  /// In en, this message translates to:
  /// **'We could not reach the server. Please check your connection and tap sign in again.'**
  String get authErrorServerUnreachable;

  /// Magic-code sign-in: a staff account tried to use a student code.
  ///
  /// In en, this message translates to:
  /// **'Staff members must use username/password sign-in, not a magic code.'**
  String get authErrorStaffBlocked;

  /// Magic-code sign-in: the server is still creating the account.
  ///
  /// In en, this message translates to:
  /// **'The server is busy setting up your account. Please try again in 30 seconds.'**
  String get authErrorAccountSetupBusy;

  /// Magic-code sign-in: the login server failed to open a session.
  ///
  /// In en, this message translates to:
  /// **'Login server error. Please try again, or ask your counsellor to reset your account.'**
  String get authErrorLoginServer;

  /// Sign-in: unexpected server error.
  ///
  /// In en, this message translates to:
  /// **'Unexpected server error. Please try again, or contact your counsellor.'**
  String get authErrorUnexpected;

  /// Phone sign-up: the phone belongs to an account a counsellor created.
  ///
  /// In en, this message translates to:
  /// **'This account was created by your counsellor. Please use the Magic Access Code they gave you.'**
  String get authErrorCrmAccount;

  /// Phone sign-up: the phone number is already registered.
  ///
  /// In en, this message translates to:
  /// **'This phone number is already registered. Please sign in.'**
  String get authErrorAlreadyRegistered;

  /// Phone sign-up: registration is switched off on the server.
  ///
  /// In en, this message translates to:
  /// **'Registration is currently disabled. Please contact an administrator.'**
  String get authErrorSignUpDisabled;

  /// Phone sign-up: the phone number is not in international format.
  ///
  /// In en, this message translates to:
  /// **'Invalid phone number format. Please include the country code.'**
  String get authErrorPhoneFormat;

  /// Phone sign-up: failed for another reason.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t create your account. Please try again.'**
  String get authErrorSignUpFailed;

  /// Screen-reader label of the floating 한 orb (opens the main menu) when no tooltip is given.
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get a11yMenu;

  /// Share-sheet subject when the user exports their data. 'Hanguk' is the product name.
  ///
  /// In en, this message translates to:
  /// **'Hanguk — your data export'**
  String get accountExportShareSubject;

  /// Share-sheet text accompanying the exported JSON file.
  ///
  /// In en, this message translates to:
  /// **'Your Hanguk data export (JSON).'**
  String get accountExportShareText;

  /// SnackBar when the data export fails (replaces showing the raw server error).
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t export your data. Please try again.'**
  String get accountExportError;

  /// Deadline tile label for an admission event type the app does not model yet
  ///
  /// In en, this message translates to:
  /// **'Key date'**
  String get uniDbEventOther;

  /// Institution chip when the university has no IEQAS accreditation
  ///
  /// In en, this message translates to:
  /// **'No IEQAS accreditation'**
  String get uniDbIeqasNone;

  /// Snackbar when the admission guide link cannot be opened because it is malformed
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the link. Please try again.'**
  String get uniDbPdfLinkInvalid;

  /// Tuition faculty group: medicine
  ///
  /// In en, this message translates to:
  /// **'Medicine'**
  String get uniDbFacultyMedicine;

  /// Tuition faculty group: pharmacy
  ///
  /// In en, this message translates to:
  /// **'Pharmacy'**
  String get uniDbFacultyPharmacy;

  /// Tuition faculty group: arts and physical education
  ///
  /// In en, this message translates to:
  /// **'Arts & Sports'**
  String get uniDbFacultyArtsPe;

  /// Tuition faculty group: theology
  ///
  /// In en, this message translates to:
  /// **'Theology'**
  String get uniDbFacultyTheology;

  /// Tuition faculty group: interdisciplinary / convergence programmes
  ///
  /// In en, this message translates to:
  /// **'Interdisciplinary'**
  String get uniDbFacultyInterdisciplinary;

  /// Tuition row that applies to every faculty
  ///
  /// In en, this message translates to:
  /// **'All faculties'**
  String get uniDbFacultyAll;

  /// Scholarship scope chip: offered by the university itself
  ///
  /// In en, this message translates to:
  /// **'University'**
  String get uniDbScholarshipScopeUniversity;

  /// Scholarship scope chip: government scholarship
  ///
  /// In en, this message translates to:
  /// **'Government'**
  String get uniDbScholarshipScopeNational;

  /// Scholarship scope chip: regional government scholarship
  ///
  /// In en, this message translates to:
  /// **'Regional'**
  String get uniDbScholarshipScopeRegional;

  /// Scholarship scope chip: private foundation scholarship
  ///
  /// In en, this message translates to:
  /// **'Foundation'**
  String get uniDbScholarshipScopeFoundation;

  /// Scholarship scope chip: offered by one department
  ///
  /// In en, this message translates to:
  /// **'Department'**
  String get uniDbScholarshipScopeDepartment;

  /// Scholarship award: percentage off tuition. {pct} is a number without the % sign
  ///
  /// In en, this message translates to:
  /// **'{pct}% tuition waiver'**
  String uniDbAwardTuitionPct(String pct);

  /// Scholarship award: tuition waiver without an amount
  ///
  /// In en, this message translates to:
  /// **'Tuition waiver'**
  String get uniDbAwardTuition;

  /// Scholarship award: fixed amount off tuition. {amount} is formatted, e.g. ₩1,000,000
  ///
  /// In en, this message translates to:
  /// **'{amount} off tuition'**
  String uniDbAwardTuitionKrw(String amount);

  /// Scholarship award: monthly stipend. {amount} is formatted, e.g. ₩300,000
  ///
  /// In en, this message translates to:
  /// **'{amount} monthly stipend'**
  String uniDbAwardStipendMonthly(String amount);

  /// Scholarship award: monthly stipend without an amount
  ///
  /// In en, this message translates to:
  /// **'Monthly stipend'**
  String get uniDbAwardStipend;

  /// Scholarship award: airfare up to an amount. {amount} is formatted, e.g. ₩800,000
  ///
  /// In en, this message translates to:
  /// **'Airfare up to {amount}'**
  String uniDbAwardAirfare(String amount);

  /// Scholarship award: airfare covered, no amount given
  ///
  /// In en, this message translates to:
  /// **'Airfare covered'**
  String get uniDbAwardAirfareCovered;

  /// Scholarship award of a type the app does not model (details in the Korean description)
  ///
  /// In en, this message translates to:
  /// **'Other benefit'**
  String get uniDbAwardOther;

  /// Requirement chip: TOPIK level that may be submitted after applying. {base} is e.g. 'TOPIK 4+'
  ///
  /// In en, this message translates to:
  /// **'{base} (can be submitted later)'**
  String uniDbTopikDeferred(String base);

  /// Recent-changes chip: the admission cycle was updated
  ///
  /// In en, this message translates to:
  /// **'Admission cycle'**
  String get uniDbChangeAdmissionCycle;

  /// Recent-changes chip: admission dates were updated
  ///
  /// In en, this message translates to:
  /// **'Dates'**
  String get uniDbChangeDates;

  /// Recent-changes chip when the changed field is not recognised
  ///
  /// In en, this message translates to:
  /// **'Updated'**
  String get uniDbChangeUpdated;

  /// Document checklist item: apostille certificate
  ///
  /// In en, this message translates to:
  /// **'Apostille'**
  String get uniDbDocApostille;

  /// Document checklist item: consent form (privacy / academic record verification)
  ///
  /// In en, this message translates to:
  /// **'Consent form'**
  String get uniDbDocConsent;

  /// Document checklist item: passport copy
  ///
  /// In en, this message translates to:
  /// **'Passport'**
  String get uniDbDocPassport;

  /// Document checklist item: TOPIK score certificate
  ///
  /// In en, this message translates to:
  /// **'TOPIK certificate'**
  String get uniDbDocTopik;

  /// Document checklist item: language test certificate (IELTS, TOEFL, Korean, …)
  ///
  /// In en, this message translates to:
  /// **'Language certificate'**
  String get uniDbDocLanguage;

  /// Document checklist item: academic transcript / school record
  ///
  /// In en, this message translates to:
  /// **'Transcript'**
  String get uniDbDocTranscript;

  /// Document checklist item: diploma or graduation certificate
  ///
  /// In en, this message translates to:
  /// **'Diploma'**
  String get uniDbDocDiploma;

  /// Document checklist item: certificate of current enrollment
  ///
  /// In en, this message translates to:
  /// **'Certificate of enrollment'**
  String get uniDbDocEnrollment;

  /// Document checklist item: family relationship certificate
  ///
  /// In en, this message translates to:
  /// **'Family relationship certificate'**
  String get uniDbDocFamily;

  /// Document checklist item: power of attorney
  ///
  /// In en, this message translates to:
  /// **'Power of attorney'**
  String get uniDbDocPowerOfAttorney;

  /// Document checklist item: proof of finances / bank balance certificate
  ///
  /// In en, this message translates to:
  /// **'Proof of funds'**
  String get uniDbDocFinance;

  /// Document checklist item: entry/exit (immigration) record
  ///
  /// In en, this message translates to:
  /// **'Entry and exit record'**
  String get uniDbDocEntryExit;

  /// Document checklist item: employment certificate
  ///
  /// In en, this message translates to:
  /// **'Employment certificate'**
  String get uniDbDocEmployment;

  /// Document checklist item: recommendation letter
  ///
  /// In en, this message translates to:
  /// **'Recommendation letter'**
  String get uniDbDocRecommendation;

  /// Document checklist item: proof of citizenship / nationality
  ///
  /// In en, this message translates to:
  /// **'Proof of citizenship'**
  String get uniDbDocCitizenship;

  /// Document checklist item: personal statement and study plan
  ///
  /// In en, this message translates to:
  /// **'Personal statement & study plan'**
  String get uniDbDocStatement;

  /// Document checklist item: Korean alien registration card (ARC)
  ///
  /// In en, this message translates to:
  /// **'Alien registration card'**
  String get uniDbDocAlienRegistration;

  /// Document checklist item: ID card copy
  ///
  /// In en, this message translates to:
  /// **'ID card copy'**
  String get uniDbDocIdCard;

  /// Document checklist item: photo
  ///
  /// In en, this message translates to:
  /// **'Photo'**
  String get uniDbDocPhoto;

  /// Document checklist item: portfolio
  ///
  /// In en, this message translates to:
  /// **'Portfolio'**
  String get uniDbDocPortfolio;

  /// Document checklist item: medical check certificate
  ///
  /// In en, this message translates to:
  /// **'Medical certificate'**
  String get uniDbDocHealth;

  /// Document checklist item: school academic calendar
  ///
  /// In en, this message translates to:
  /// **'School calendar'**
  String get uniDbDocCalendar;

  /// Document checklist item: tax payment certificate
  ///
  /// In en, this message translates to:
  /// **'Tax payment certificate'**
  String get uniDbDocTax;

  /// Document checklist item: business registration certificate
  ///
  /// In en, this message translates to:
  /// **'Business registration certificate'**
  String get uniDbDocBusinessRegistration;

  /// Document checklist item: award certificate
  ///
  /// In en, this message translates to:
  /// **'Award certificate'**
  String get uniDbDocAward;

  /// Document checklist item: application form
  ///
  /// In en, this message translates to:
  /// **'Application form'**
  String get uniDbDocApplicationForm;

  /// Document checklist item: a required document the app has no specific name for (details in the Korean note)
  ///
  /// In en, this message translates to:
  /// **'Additional document'**
  String get uniDbDocOther;

  /// Staff review screen title
  ///
  /// In en, this message translates to:
  /// **'Review queue'**
  String get adminReviewQueueTitle;

  /// Staff review screen title when loading failed / access denied
  ///
  /// In en, this message translates to:
  /// **'Review'**
  String get adminReviewTitle;

  /// Tooltip: reload the review queue
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get adminRefresh;

  /// Staff review queue has no pending items
  ///
  /// In en, this message translates to:
  /// **'Queue is empty. Nothing pending right now.'**
  String get adminQueueEmpty;

  /// Wide layout hint before a queue item is chosen
  ///
  /// In en, this message translates to:
  /// **'Select a queue item on the left.'**
  String get adminSelectItem;

  /// Snackbar after accepting an extraction
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get adminAccepted;

  /// Snackbar after editing and accepting an extraction
  ///
  /// In en, this message translates to:
  /// **'Edited and accepted'**
  String get adminEditedAccepted;

  /// Snackbar after rejecting an extraction
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get adminRejected;

  /// Tooltip: back from item detail to the queue (narrow layout)
  ///
  /// In en, this message translates to:
  /// **'Back to queue'**
  String get adminBackToQueue;

  /// Chip: the extractor's self-rated confidence
  ///
  /// In en, this message translates to:
  /// **'Confidence {pct}%'**
  String adminConfidence(int pct);

  /// Chip: the item is past its review deadline
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get adminOverdue;

  /// Button: open the Korean source page of the admission guide
  ///
  /// In en, this message translates to:
  /// **'Open source page (Korean)'**
  String get adminOpenSource;

  /// Label above the extracted JSON
  ///
  /// In en, this message translates to:
  /// **'Extracted data:'**
  String get adminExtractedPayload;

  /// Button: reject the extraction
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get adminReject;

  /// Button: edit the extraction, then accept it
  ///
  /// In en, this message translates to:
  /// **'Edit & accept'**
  String get adminEditAccept;

  /// Button: accept the extraction
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get adminAccept;

  /// Edit dialog error: the JSON is not an object
  ///
  /// In en, this message translates to:
  /// **'Data must be a JSON object'**
  String get adminPayloadNotObject;

  /// Edit dialog error: the JSON does not parse. {error} is the parser message
  ///
  /// In en, this message translates to:
  /// **'Invalid JSON: {error}'**
  String adminInvalidJson(String error);

  /// Edit dialog title
  ///
  /// In en, this message translates to:
  /// **'Edit data'**
  String get adminEditPayload;

  /// Edit dialog button: save the edit and accept
  ///
  /// In en, this message translates to:
  /// **'Save & accept'**
  String get adminSaveAccept;

  /// Reject dialog title
  ///
  /// In en, this message translates to:
  /// **'Reject — reason'**
  String get adminRejectReasonTitle;

  /// Reject dialog: optional free-text detail
  ///
  /// In en, this message translates to:
  /// **'Details (optional)'**
  String get adminDetailOptional;

  /// Shown to a signed-in user without the staff role
  ///
  /// In en, this message translates to:
  /// **'This area is for Hanguk staff only. If you should have access, ask an admin to add your staff role.'**
  String get adminStaffOnly;

  /// Review priority 1 with its SLA
  ///
  /// In en, this message translates to:
  /// **'P1 — correction notice (4h)'**
  String get adminPriorityP1;

  /// Review priority 2 with its SLA
  ///
  /// In en, this message translates to:
  /// **'P2 — attachment change (12h)'**
  String get adminPriorityP2;

  /// Review priority 3 with its SLA (D3 = difficulty tier 3)
  ///
  /// In en, this message translates to:
  /// **'P3 — D3 field with diff (24h)'**
  String get adminPriorityP3;

  /// Review priority 4 with its SLA (D2 = difficulty tier 2)
  ///
  /// In en, this message translates to:
  /// **'P4 — D2 routine (48h)'**
  String get adminPriorityP4;

  /// Review priority 5 with its SLA (D1 = difficulty tier 1)
  ///
  /// In en, this message translates to:
  /// **'P5 — D1 trivial (96h)'**
  String get adminPriorityP5;

  /// Why an item was queued: the extractor was unsure
  ///
  /// In en, this message translates to:
  /// **'Low confidence'**
  String get adminReasonLowConfidence;

  /// Why an item was queued: it contains a hard-to-extract field
  ///
  /// In en, this message translates to:
  /// **'Hard field'**
  String get adminReasonHighDifficulty;

  /// Why an item was queued: approved automatically, spot check
  ///
  /// In en, this message translates to:
  /// **'Auto-approved'**
  String get adminReasonAutoApproved;

  /// Why an item was queued: the university published a correction notice
  ///
  /// In en, this message translates to:
  /// **'Correction notice'**
  String get adminReasonCorrectionNotice;

  /// Queue item kind: an AI extraction job
  ///
  /// In en, this message translates to:
  /// **'Extraction'**
  String get adminEntityExtraction;

  /// Queue item kind: an admission guide document
  ///
  /// In en, this message translates to:
  /// **'Admission guide'**
  String get adminEntityGuideline;

  /// Reject reason: extracted from the wrong year's guide
  ///
  /// In en, this message translates to:
  /// **'Wrong year'**
  String get adminRejectWrongYear;

  /// Reject reason: the document was classified as the wrong type
  ///
  /// In en, this message translates to:
  /// **'Wrong document type'**
  String get adminRejectWrongArchetype;

  /// Reject reason: the AI invented a field not in the source
  ///
  /// In en, this message translates to:
  /// **'Invented field'**
  String get adminRejectHallucinated;

  /// Reject reason: the scanned text is unreadable
  ///
  /// In en, this message translates to:
  /// **'Garbled OCR text'**
  String get adminRejectOcrGarbled;

  /// Reject reason: the source page no longer exists
  ///
  /// In en, this message translates to:
  /// **'Source page not found (404)'**
  String get adminRejectSource404;

  /// Reject reason: other
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get adminRejectOther;

  /// The AI interviewer never spoke after the call started.
  ///
  /// In en, this message translates to:
  /// **'The interviewer did not respond. Please go back and try again.'**
  String get interviewErrorNoGreeting;

  /// The interview call ended before the AI interviewer spoke.
  ///
  /// In en, this message translates to:
  /// **'The call ended before the interviewer could speak. Please try again.'**
  String get interviewErrorEndedBeforeGreeting;

  /// The interview voice call failed for a technical reason.
  ///
  /// In en, this message translates to:
  /// **'The call could not be connected. Please check your internet and try again.'**
  String get interviewErrorCallFailed;

  /// S03 context line: study route
  ///
  /// In en, this message translates to:
  /// **'Language course'**
  String get onbResultRouteLanguageCourse;

  /// S03 context line: study route
  ///
  /// In en, this message translates to:
  /// **'Bachelor\'s'**
  String get onbResultRouteBachelor;

  /// S03 context line: study route
  ///
  /// In en, this message translates to:
  /// **'Master\'s'**
  String get onbResultRouteMaster;

  /// S03 context line: study route
  ///
  /// In en, this message translates to:
  /// **'Vocational college'**
  String get onbResultRouteCollege;

  /// S03 context line: intake
  ///
  /// In en, this message translates to:
  /// **'Spring 2027'**
  String get onbResultIntakeSpring2027;

  /// S03 context line: intake
  ///
  /// In en, this message translates to:
  /// **'Fall 2027'**
  String get onbResultIntakeFall2027;

  /// S03 context line: intake
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get onbResultIntakeLater;

  /// S03 band title
  ///
  /// In en, this message translates to:
  /// **'High chance'**
  String get onbResultBandHigh;

  /// S03 band one-line explanation
  ///
  /// In en, this message translates to:
  /// **'The main requirements are met — you can start on the documents.'**
  String get onbResultBandHighNote;

  /// S03 band title
  ///
  /// In en, this message translates to:
  /// **'Medium chance'**
  String get onbResultBandMid;

  /// S03 band one-line explanation
  ///
  /// In en, this message translates to:
  /// **'The way is open, but 1–2 points need strengthening.'**
  String get onbResultBandMidNote;

  /// S03 band title (low band)
  ///
  /// In en, this message translates to:
  /// **'High risk for now — but there is a way'**
  String get onbResultBandLow;

  /// S03 band one-line explanation (low band)
  ///
  /// In en, this message translates to:
  /// **'Language and financial documents are not enough yet.'**
  String get onbResultBandLowNote;

  /// S03 factors card title
  ///
  /// In en, this message translates to:
  /// **'What affected it'**
  String get onbResultFactorsTitle;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'TOPIK 3 or higher — the bachelor\'s requirement is met'**
  String get onbResultFactorKoreanStrong;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'TOPIK 2 — the embassy asks for TOPIK 3 for a bachelor\'s; enough for a college'**
  String get onbResultFactorKoreanTopik2Degree;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'The embassy asks for TOPIK 3 for a bachelor\'s'**
  String get onbResultFactorKoreanMissingDegree;

  /// S03 factor (+): vocational college, TOPIK 3+
  ///
  /// In en, this message translates to:
  /// **'TOPIK 3 or higher'**
  String get onbResultFactorKoreanCollegeStrong;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'TOPIK 2 — the college requirement is met'**
  String get onbResultFactorKoreanCollegeTopik2;

  /// S03 factor (+): language course, Sejong 1A / TOPIK 1+
  ///
  /// In en, this message translates to:
  /// **'Sejong 1A / TOPIK 1 certificate'**
  String get onbResultFactorKoreanCourseCertificate;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'A language-course visa needs TOPIK 1 or a Sejong certificate'**
  String get onbResultFactorKoreanCourseMissing;

  /// S03 factor (+): parents' official income
  ///
  /// In en, this message translates to:
  /// **'Parents\' official income'**
  String get onbResultFactorIncomeYes;

  /// S03 factor (−): no official income
  ///
  /// In en, this message translates to:
  /// **'Parents have no official income'**
  String get onbResultFactorIncomeNo;

  /// S03 factor (+): graduated recently
  ///
  /// In en, this message translates to:
  /// **'Graduated recently — no gap in studies'**
  String get onbResultFactorGradRecent;

  /// S03 factor (−): long gap since graduation
  ///
  /// In en, this message translates to:
  /// **'A long time since graduation — the study intent must be explained'**
  String get onbResultFactorGradGapLong;

  /// S03 factor (−): age above the soft limit
  ///
  /// In en, this message translates to:
  /// **'Because of age, the study intent must be explained'**
  String get onbResultFactorAgeHigh;

  /// S03 section title
  ///
  /// In en, this message translates to:
  /// **'Universities that fit you'**
  String get onbResultUnisTitle;

  /// S03 university card badge
  ///
  /// In en, this message translates to:
  /// **'Accredited'**
  String get onbResultAccredited;

  /// S03 university card: tuition per semester
  ///
  /// In en, this message translates to:
  /// **'Tuition/semester'**
  String get onbResultTuitionLabel;

  /// S03 university card and cost card: bank statement amount
  ///
  /// In en, this message translates to:
  /// **'Bank statement'**
  String get onbResultBankLabel;

  /// S03 cost card title
  ///
  /// In en, this message translates to:
  /// **'Estimated yearly cost'**
  String get onbResultYearlyCost;

  /// S03 next steps card title
  ///
  /// In en, this message translates to:
  /// **'Next 3 steps'**
  String get onbResultStepsTitle;

  /// S03 next step
  ///
  /// In en, this message translates to:
  /// **'Prepare for TOPIK 3 or enter through a language course'**
  String get onbResultStepTopikPrep;

  /// S03 next step
  ///
  /// In en, this message translates to:
  /// **'Translate and apostille the school certificate and passport'**
  String get onbResultStepSchoolDocs;

  /// S03 next step (master's route)
  ///
  /// In en, this message translates to:
  /// **'Translate and apostille the diploma and passport'**
  String get onbResultStepDiplomaDocs;

  /// S03 next step
  ///
  /// In en, this message translates to:
  /// **'Submit the documents before the university deadline'**
  String get onbResultStepApplyOnTime;

  /// S03 low band: section title instead of universities
  ///
  /// In en, this message translates to:
  /// **'Paths that fit you'**
  String get onbResultPathsTitle;

  /// S03 low band path title
  ///
  /// In en, this message translates to:
  /// **'Through a language course (D-4)'**
  String get onbResultPathLanguageCourse;

  /// S03 low band path note (design: '{N} semestr til kursi, …'; the number of semesters is not set yet)
  ///
  /// In en, this message translates to:
  /// **'A language course, then moving on to a bachelor\'s.'**
  String get onbResultPathLanguageCourseNote;

  /// S03 low band path title
  ///
  /// In en, this message translates to:
  /// **'Vocational college'**
  String get onbResultPathCollege;

  /// S03 low band path note
  ///
  /// In en, this message translates to:
  /// **'Softer requirements, lower tuition.'**
  String get onbResultPathCollegeNote;

  /// S03 low band path title
  ///
  /// In en, this message translates to:
  /// **'Preparing for the next season'**
  String get onbResultPathNextSeason;

  /// S03 low band path note
  ///
  /// In en, this message translates to:
  /// **'Fall 2027 with TOPIK 3 and a bank statement.'**
  String get onbResultPathNextSeasonNote;

  /// S03 link to the recommended tariff's detail
  ///
  /// In en, this message translates to:
  /// **'{tariff} — why? →'**
  String onbResultTariffWhy(String tariff);

  /// S03 main button: opens the name and phone sheet (S04).
  ///
  /// In en, this message translates to:
  /// **'Free consultation'**
  String get onbResultCtaOperator;

  /// S03 second button
  ///
  /// In en, this message translates to:
  /// **'Continue in Telegram'**
  String get onbResultCtaTelegram;

  /// S03 footer line
  ///
  /// In en, this message translates to:
  /// **'This is a preliminary assessment. The visa decision is made by the embassy.'**
  String get onbResultDisclaimer;

  /// Telegram plan text: the recommended tariff line
  ///
  /// In en, this message translates to:
  /// **'Recommended tariff: {tariff}'**
  String onbResultPlanTariff(String tariff);

  /// Tariff name (brand)
  ///
  /// In en, this message translates to:
  /// **'Standart'**
  String get onbTariffNameStandart;

  /// Tariff name (brand)
  ///
  /// In en, this message translates to:
  /// **'Premium'**
  String get onbTariffNamePremium;

  /// Tariff name (brand)
  ///
  /// In en, this message translates to:
  /// **'NO RISK'**
  String get onbTariffNameNoRisk;

  /// Tariff name (brand)
  ///
  /// In en, this message translates to:
  /// **'Hanbox'**
  String get onbTariffNameHanbox;

  /// S05 title
  ///
  /// In en, this message translates to:
  /// **'Prices and terms'**
  String get onbTariffsTitle;

  /// S05 subtitle
  ///
  /// In en, this message translates to:
  /// **'Most of it is paid after the visa is issued.'**
  String get onbTariffsSubtitle;

  /// S05/S06 number of services in a tariff
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 service} other{{count} services}}'**
  String onbTariffServices(int count);

  /// S05 Standart card price
  ///
  /// In en, this message translates to:
  /// **'2 mln so\'m now + 5 mln after the visa, or 5 mln in one go'**
  String get onbTariffPriceStandart;

  /// S05 Premium card price
  ///
  /// In en, this message translates to:
  /// **'3 mln now + 10 mln after the visa, or 10 mln'**
  String get onbTariffPricePremium;

  /// S05 NO RISK card price
  ///
  /// In en, this message translates to:
  /// **'\$5 000 in one go'**
  String get onbTariffPriceNoRisk;

  /// S05 Hanbox card price
  ///
  /// In en, this message translates to:
  /// **'\$2 000 or \$400 + \$200 a month'**
  String get onbTariffPriceHanbox;

  /// S05 card link to S06
  ///
  /// In en, this message translates to:
  /// **'Details →'**
  String get onbTariffMore;

  /// S05 button
  ///
  /// In en, this message translates to:
  /// **'Compare tariffs'**
  String get onbTariffsCompare;

  /// S05/S06 card title
  ///
  /// In en, this message translates to:
  /// **'Not included'**
  String get onbTariffExcludedTitle;

  /// Not included item
  ///
  /// In en, this message translates to:
  /// **'Tuition'**
  String get onbTariffExContract;

  /// Not included item
  ///
  /// In en, this message translates to:
  /// **'Application fee'**
  String get onbTariffExApplicationFee;

  /// Not included item
  ///
  /// In en, this message translates to:
  /// **'Bank statement'**
  String get onbTariffExBankStatement;

  /// Not included item
  ///
  /// In en, this message translates to:
  /// **'Flight'**
  String get onbTariffExFlight;

  /// Not included item
  ///
  /// In en, this message translates to:
  /// **'Visa fee'**
  String get onbTariffExVisaFee;

  /// Not included item
  ///
  /// In en, this message translates to:
  /// **'Living costs'**
  String get onbTariffExLiving;

  /// Not included item (Hanbox)
  ///
  /// In en, this message translates to:
  /// **'Visa'**
  String get onbTariffExVisa;

  /// S06 small line above the tariff name
  ///
  /// In en, this message translates to:
  /// **'Tariff details'**
  String get onbTariffDetailEyebrow;

  /// S06 payment timeline card title
  ///
  /// In en, this message translates to:
  /// **'When you pay'**
  String get onbTariffPayTitle;

  /// S06 timeline row
  ///
  /// In en, this message translates to:
  /// **'Contract'**
  String get onbTariffPayContract;

  /// S06 timeline row note
  ///
  /// In en, this message translates to:
  /// **'When the work starts'**
  String get onbTariffPayContractWhen;

  /// S06 timeline row
  ///
  /// In en, this message translates to:
  /// **'Visa issued'**
  String get onbTariffPayVisa;

  /// S06 timeline row note
  ///
  /// In en, this message translates to:
  /// **'When the visa is in your hands'**
  String get onbTariffPayVisaWhen;

  /// S06 timeline row second note
  ///
  /// In en, this message translates to:
  /// **'Within 7 working days after the visa is issued'**
  String get onbTariffPayVisaDays;

  /// S06 Hanbox timeline row
  ///
  /// In en, this message translates to:
  /// **'At the start'**
  String get onbTariffPayStart;

  /// S06 Hanbox timeline row
  ///
  /// In en, this message translates to:
  /// **'Every month'**
  String get onbTariffPayMonthly;

  /// S06 amount in millions of so'm (short)
  ///
  /// In en, this message translates to:
  /// **'{n} mln'**
  String onbTariffMln(int n);

  /// S06 Standart timeline footer
  ///
  /// In en, this message translates to:
  /// **'Or 5 mln so\'m in one go.'**
  String get onbTariffOrOnceStandart;

  /// S06 Premium timeline footer
  ///
  /// In en, this message translates to:
  /// **'Or 10 mln so\'m in one go.'**
  String get onbTariffOrOncePremium;

  /// S06 Hanbox timeline footer
  ///
  /// In en, this message translates to:
  /// **'Or \$2 000 in one go, or in instalments.'**
  String get onbTariffOrOnceHanbox;

  /// S06 card title
  ///
  /// In en, this message translates to:
  /// **'What\'s included'**
  String get onbTariffIncludedTitle;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Choosing a university'**
  String get onbTariffIncUniChoice;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Document list and check'**
  String get onbTariffIncDocsList;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Help with translation and apostille'**
  String get onbTariffIncTranslation;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Study plan and motivation letter'**
  String get onbTariffIncStudyPlan;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Submitting the application'**
  String get onbTariffIncApply;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Interview preparation'**
  String get onbTariffIncInterview;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Visa documents'**
  String get onbTariffIncVisaDocs;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Dormitory placement'**
  String get onbTariffIncDorm;

  /// Included (Premium)
  ///
  /// In en, this message translates to:
  /// **'Help in the first week in Korea'**
  String get onbTariffIncFirstWeek;

  /// Included (Standart, NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Applying to up to 3 universities for you'**
  String get onbTariffIncApplyUpTo3;

  /// Included (Standart)
  ///
  /// In en, this message translates to:
  /// **'Interview preparation (you get the questions that may come up)'**
  String get onbTariffIncInterviewQuestions;

  /// Included (Standart, NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Preparing documents (translation, apostille)'**
  String get onbTariffIncDocsPrep;

  /// Included (Standart, NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Postage'**
  String get onbTariffIncPost;

  /// Included (Standart, NO RISK)
  ///
  /// In en, this message translates to:
  /// **'SIM card and bank card'**
  String get onbTariffIncSimBank;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Interview preparation (practice with AI)'**
  String get onbTariffIncInterviewAi;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Bank account (simple, 1 day)'**
  String get onbTariffIncBankShot1Day;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Bank account (1 month)'**
  String get onbTariffIncBankShot1Month;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Preparing embassy documents (translation, apostille)'**
  String get onbTariffIncEmbassyDocs;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Help writing the study plan (prepared with AI)'**
  String get onbTariffIncStudyPlanAi;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Meeting you in Korea'**
  String get onbTariffIncPickup;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Tuition paid by the company'**
  String get onbTariffIncContractPaid;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Plane ticket bought for you'**
  String get onbTariffIncFlightTicket;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'A flat found and its first month paid'**
  String get onbTariffIncFlatMonth;

  /// Included (NO RISK)
  ///
  /// In en, this message translates to:
  /// **'Application fee'**
  String get onbTariffIncAppFee;

  /// Included (Hanbox)
  ///
  /// In en, this message translates to:
  /// **'1 year of live online lessons (in the Hanguk Academy app), groups of 11–15, goal — TOPIK 2'**
  String get onbTariffIncHanboxLessons;

  /// Included (Hanbox)
  ///
  /// In en, this message translates to:
  /// **'A laptop and textbooks are included in the price'**
  String get onbTariffIncHanboxLaptop;

  /// Included (Hanbox)
  ///
  /// In en, this message translates to:
  /// **'The first lesson is free'**
  String get onbTariffIncHanboxFirstLesson;

  /// Included (Hanbox)
  ///
  /// In en, this message translates to:
  /// **'After the course — Standart consulting free (TOPIK 2, 80% attendance, full payment)'**
  String get onbTariffIncHanboxStandart;

  /// S06 FAQ title
  ///
  /// In en, this message translates to:
  /// **'Questions and answers'**
  String get onbTariffFaqTitle;

  /// Amount in millions of so'm, inside a sentence
  ///
  /// In en, this message translates to:
  /// **'{n} mln so\'m'**
  String onbTariffMlnSom(int n);

  /// S06 FAQ question (Standart, Premium)
  ///
  /// In en, this message translates to:
  /// **'If the visa is not issued, do I pay {amount}?'**
  String onbTariffFaqNoVisaQ(String amount);

  /// S06 FAQ answer (draft, owner to approve)
  ///
  /// In en, this message translates to:
  /// **'No. With the two-step payment, {amount} is paid only after the visa is issued.'**
  String onbTariffFaqNoVisaA(String amount);

  /// S06 FAQ question (Standart, Premium)
  ///
  /// In en, this message translates to:
  /// **'When do I make the payment after the visa?'**
  String get onbTariffFaqWhenQ;

  /// S06 FAQ answer (draft, owner to approve)
  ///
  /// In en, this message translates to:
  /// **'Within 7 working days after the visa is issued.'**
  String get onbTariffFaqWhenA;

  /// S06 FAQ question
  ///
  /// In en, this message translates to:
  /// **'Who pays the tuition?'**
  String get onbTariffFaqContractQ;

  /// S06 FAQ answer (Standart, Premium, Hanbox; draft)
  ///
  /// In en, this message translates to:
  /// **'You pay the university tuition yourself — it is not included in the tariff price.'**
  String get onbTariffFaqContractA;

  /// S06 FAQ answer (NO RISK; draft)
  ///
  /// In en, this message translates to:
  /// **'The company pays the tuition — it is included in the NO RISK price.'**
  String get onbTariffFaqContractANoRisk;

  /// S06 bottom button
  ///
  /// In en, this message translates to:
  /// **'Get advice on this tariff'**
  String get onbTariffCta;

  /// S06 link to the contract sample (hidden until a PDF exists)
  ///
  /// In en, this message translates to:
  /// **'Sample contract (PDF)'**
  String get onbTariffContractPdf;

  /// S01 Welcome: headline.
  ///
  /// In en, this message translates to:
  /// **'Study in Korea — find out your chances in 2 minutes'**
  String get onbWelcomeTitle;

  /// S01 Welcome: one line under the headline.
  ///
  /// In en, this message translates to:
  /// **'An honest assessment: no percentages, no guarantees — just the rules and your answers.'**
  String get onbWelcomeBody;

  /// S01 Welcome: main button, starts the 6-question check (S02).
  ///
  /// In en, this message translates to:
  /// **'Check my chances'**
  String get onbWelcomeCta;

  /// S01 Welcome: secondary button, opens the university catalogue.
  ///
  /// In en, this message translates to:
  /// **'Browse universities'**
  String get onbWelcomeCatalog;

  /// S01 Welcome: trust row label (operator reply time). Shown only with real data.
  ///
  /// In en, this message translates to:
  /// **'Operator reply'**
  String get onbWelcomeTrustReply;

  /// S01 Welcome: trust row value, operator reply time in minutes.
  ///
  /// In en, this message translates to:
  /// **'≤{minutes} min'**
  String onbWelcomeTrustReplyValue(String minutes);

  /// S01 Welcome: small link for existing clients, opens sign-in with the client code.
  ///
  /// In en, this message translates to:
  /// **'I have a client code'**
  String get onbWelcomeClientCode;

  /// S02 quiz: button to the next question.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get onbQuizContinue;

  /// S02 quiz: screen-reader label of the back arrow.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get onbQuizBack;

  /// S02 question 1: study route.
  ///
  /// In en, this message translates to:
  /// **'What do you want to study in Korea?'**
  String get onbQuizQ1;

  /// S02 Q1 option: Korean language course (D-4).
  ///
  /// In en, this message translates to:
  /// **'Language course — learn Korean'**
  String get onbQuizRouteCourse;

  /// S02 Q1 option: bachelor's degree.
  ///
  /// In en, this message translates to:
  /// **'Bachelor\'s — university, 4 years'**
  String get onbQuizRouteBachelor;

  /// S02 Q1 option: master's degree.
  ///
  /// In en, this message translates to:
  /// **'Master\'s — after a bachelor\'s'**
  String get onbQuizRouteMaster;

  /// S02 Q1 option: vocational college.
  ///
  /// In en, this message translates to:
  /// **'Vocational college — a 2–3 year trade'**
  String get onbQuizRouteCollege;

  /// S02 Q2 graduation-year picker: the last option, this year or any year before it.
  ///
  /// In en, this message translates to:
  /// **'{year} or earlier'**
  String onbQuizGradYearOrEarlier(String year);

  /// S02 Q2 option: still at school or university.
  ///
  /// In en, this message translates to:
  /// **'Still studying'**
  String get onbQuizStillStudying;

  /// S02 question 3: Korean level.
  ///
  /// In en, this message translates to:
  /// **'What is your Korean level?'**
  String get onbQuizQ3;

  /// S02 question 3: one line under the question.
  ///
  /// In en, this message translates to:
  /// **'Pick by your official certificate. The embassy does not accept an application without one.'**
  String get onbQuizQ3Hint;

  /// S02 Q3 option: no Korean.
  ///
  /// In en, this message translates to:
  /// **'I don\'t speak Korean'**
  String get onbQuizKoreanNone;

  /// S02 Q3 option: learning, no certificate.
  ///
  /// In en, this message translates to:
  /// **'Learning, no certificate'**
  String get onbQuizKoreanLearning;

  /// S02 Q3 option: Sejong 1A / TOPIK 1.
  ///
  /// In en, this message translates to:
  /// **'TOPIK 1 or a Sejong Hakdang certificate'**
  String get onbQuizKoreanTopik1;

  /// S02 Q3 option: TOPIK 2.
  ///
  /// In en, this message translates to:
  /// **'TOPIK 2'**
  String get onbQuizKoreanTopik2;

  /// Quiz Korean option
  ///
  /// In en, this message translates to:
  /// **'TOPIK 3'**
  String get onbQuizKoreanTopik3;

  /// S02 Q3 option: don't know yet.
  ///
  /// In en, this message translates to:
  /// **'Not sure'**
  String get onbQuizKoreanUnknown;

  /// S02 question 5: parents' official income (and bank statement).
  ///
  /// In en, this message translates to:
  /// **'Do your parents have an official income?'**
  String get onbQuizQ5;

  /// S02 Q5 option: yes, official income.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get onbQuizIncomeYes;

  /// S02 Q5 option: no official income.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get onbQuizIncomeNo;

  /// S02 Q6 option: spring 2027 intake.
  ///
  /// In en, this message translates to:
  /// **'Spring 2027 (March)'**
  String get onbQuizIntakeSpring2027;

  /// S02 Q6 option: fall 2027 intake.
  ///
  /// In en, this message translates to:
  /// **'Fall 2027 (September)'**
  String get onbQuizIntakeFall2027;

  /// S02 Q6 option: later.
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get onbQuizIntakeLater;

  /// S04 contact sheet: title.
  ///
  /// In en, this message translates to:
  /// **'Detailed plan and list of universities'**
  String get onbContactTitle;

  /// S04 contact sheet: line under the title.
  ///
  /// In en, this message translates to:
  /// **'An operator will review your answers and call you within 10 minutes.'**
  String get onbContactSubtitle;

  /// S04 contact sheet: banner shown outside working hours.
  ///
  /// In en, this message translates to:
  /// **'We\'re outside working hours now. We\'ll call you tomorrow at 10:00.'**
  String get onbContactAfterHours;

  /// S04 contact sheet: name field label and placeholder.
  ///
  /// In en, this message translates to:
  /// **'Your name'**
  String get onbContactName;

  /// S04 contact sheet: phone field label.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get onbContactPhone;

  /// S04 contact sheet: the phone number is not a valid Uzbek number.
  ///
  /// In en, this message translates to:
  /// **'Check the number'**
  String get onbContactPhoneError;

  /// S04 contact sheet: the name is missing or not accepted.
  ///
  /// In en, this message translates to:
  /// **'Enter your name'**
  String get onbContactNameError;

  /// S04 contact sheet: sending failed (no internet or server error).
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t send. Check your connection and try again.'**
  String get onbContactNetworkError;

  /// S04 contact sheet: toggle, also send the plan to the visitor's Telegram.
  ///
  /// In en, this message translates to:
  /// **'Also send the plan to my Telegram'**
  String get onbContactTelegram;

  /// S04 contact sheet: submit button.
  ///
  /// In en, this message translates to:
  /// **'Have an operator call me'**
  String get onbContactCta;

  /// S04 contact sheet: working-hours note under the button.
  ///
  /// In en, this message translates to:
  /// **'Working hours Mon–Sat 09:40–18:00. At other times we\'ll call the next day at 10:00.'**
  String get onbContactHours;

  /// S04 contact sheet: success message with the visitor's name.
  ///
  /// In en, this message translates to:
  /// **'Thank you, {name}! An operator will call you within 10 minutes.'**
  String onbContactSuccess(String name);

  /// S04 contact sheet success: closes the sheet, back to the result.
  ///
  /// In en, this message translates to:
  /// **'Back to the result'**
  String get onbContactBackToResult;

  /// S04 banner before 09:40 on a working day: the call comes the same day.
  ///
  /// In en, this message translates to:
  /// **'We\'re outside working hours now. We\'ll call you today at 10:00.'**
  String get onbContactAfterHoursToday;

  /// S04 banner from Saturday 18:00 and all Sunday: the call comes on Monday.
  ///
  /// In en, this message translates to:
  /// **'We\'re outside working hours now. We\'ll call you on Monday at 10:00.'**
  String get onbContactAfterHoursMonday;

  /// S02 question 2: age.
  ///
  /// In en, this message translates to:
  /// **'How old are you?'**
  String get onbQuizAgeQ;

  /// S02 question 3: the year of the last graduation.
  ///
  /// In en, this message translates to:
  /// **'When did you finish your last school?'**
  String get onbQuizGradQ;

  /// S02 question 5: IELTS score.
  ///
  /// In en, this message translates to:
  /// **'Do you have an IELTS score?'**
  String get onbQuizIeltsQ;

  /// S02 IELTS option: none.
  ///
  /// In en, this message translates to:
  /// **'None, or below 5.5'**
  String get onbQuizIeltsNone;

  /// S02 IELTS option.
  ///
  /// In en, this message translates to:
  /// **'IELTS 5.5'**
  String get onbQuizIelts55;

  /// S02 IELTS option.
  ///
  /// In en, this message translates to:
  /// **'IELTS 6.0'**
  String get onbQuizIelts60;

  /// S02 IELTS option: 6.5 or higher.
  ///
  /// In en, this message translates to:
  /// **'IELTS 6.5 or higher'**
  String get onbQuizIelts65;

  /// S02 IELTS option: don't know yet.
  ///
  /// In en, this message translates to:
  /// **'Not sure'**
  String get onbQuizIeltsUnknown;

  /// S02 question 7: who pays.
  ///
  /// In en, this message translates to:
  /// **'Who pays for the studies?'**
  String get onbQuizPayerQ;

  /// S02 payer option.
  ///
  /// In en, this message translates to:
  /// **'My parents'**
  String get onbQuizPayerParentsOption;

  /// S02 payer option.
  ///
  /// In en, this message translates to:
  /// **'Myself'**
  String get onbQuizPayerSelfOption;

  /// S02 payer option.
  ///
  /// In en, this message translates to:
  /// **'A sponsor or relative'**
  String get onbQuizPayerSponsorOption;

  /// S02 question 10: region.
  ///
  /// In en, this message translates to:
  /// **'Which region do you live in?'**
  String get onbQuizRegionQ;

  /// S02 question 11: when to go.
  ///
  /// In en, this message translates to:
  /// **'When do you want to start?'**
  String get onbQuizIntakeQ;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'IELTS 5.5 or higher — for English-taught programmes'**
  String get onbResultFactorEnglishStrong;

  /// S03 university card badge: an official HANGUK partner university.
  ///
  /// In en, this message translates to:
  /// **'Official partner'**
  String get onbResultPartner;

  /// S03 university card: the language requirement cell (TOPIK and/or IELTS).
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get onbResultLanguageLabel;

  /// Quiz Korean option
  ///
  /// In en, this message translates to:
  /// **'TOPIK 4 or higher'**
  String get onbQuizKoreanTopik4;

  /// Quiz question: the KDB deposit
  ///
  /// In en, this message translates to:
  /// **'Can you put a deposit in the student\'s name?'**
  String get onbQuizKdbQ;

  /// Hint under the KDB question
  ///
  /// In en, this message translates to:
  /// **'Required for the visa: {low} (other cities) or {high} (Seoul, Gyeonggi, Incheon) in a KDB Bank Uzbekistan account in the student\'s name, for at least {months} month(s). It is not a payment — the money stays in the student\'s account.'**
  String onbQuizKdbHint(String low, String high, String months);

  /// KDB option
  ///
  /// In en, this message translates to:
  /// **'Yes, the money is ready now'**
  String get onbQuizKdbReady;

  /// KDB option
  ///
  /// In en, this message translates to:
  /// **'We will have it before the intake'**
  String get onbQuizKdbByIntake;

  /// KDB option
  ///
  /// In en, this message translates to:
  /// **'No, we can\'t'**
  String get onbQuizKdbNo;

  /// KDB option
  ///
  /// In en, this message translates to:
  /// **'Not sure'**
  String get onbQuizKdbUnknown;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'TOPIK 4 or higher — the master\'s requirement is met'**
  String get onbResultFactorKoreanMasterStrong;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'TOPIK 3 — the embassy asks for TOPIK 4 for a master\'s'**
  String get onbResultFactorKoreanTopik3Master;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'The embassy asks for TOPIK 4 for a master\'s'**
  String get onbResultFactorKoreanMissingMaster;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'The embassy asks for TOPIK 2 for a college'**
  String get onbResultFactorKoreanCollegeMissing;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'The KDB deposit is ready in the student\'s name'**
  String get onbResultFactorKdbReady;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'The KDB deposit is not there yet — needed before applying'**
  String get onbResultFactorKdbByIntake;

  /// Result factor
  ///
  /// In en, this message translates to:
  /// **'No KDB deposit — the embassy requires it'**
  String get onbResultFactorKdbNo;

  /// Low band note: language
  ///
  /// In en, this message translates to:
  /// **'The language certificate is below the embassy\'s requirement — without it the application is refused without an interview.'**
  String get onbResultBandLowNoteLanguage;

  /// Low band note: money
  ///
  /// In en, this message translates to:
  /// **'The financial requirement (a KDB deposit in the student\'s name and the parents\' papers) is not met yet.'**
  String get onbResultBandLowNoteMoney;

  /// Quiz Q1 hint
  ///
  /// In en, this message translates to:
  /// **'The result follows the visa rules for this route.'**
  String get onbQuizQ1Hint;

  /// Quiz graduation hint
  ///
  /// In en, this message translates to:
  /// **'School, lyceum, college or university — whichever was last.'**
  String get onbQuizGradHint;

  /// Quiz graduation, master's
  ///
  /// In en, this message translates to:
  /// **'When did you finish your bachelor\'s?'**
  String get onbQuizGradQMaster;

  /// Quiz IELTS hint
  ///
  /// In en, this message translates to:
  /// **'Needed for English-taught programmes. Only the regular IELTS (not Online), taken in the last 2 years.'**
  String get onbQuizIeltsHint;

  /// Quiz income hint
  ///
  /// In en, this message translates to:
  /// **'For example a salary certificate from work (my.gov.uz) or business and tax papers. The embassy asks for the parents\' papers.'**
  String get onbQuizIncomeHint;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ko', 'ru', 'uz', 'vi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ko':
      return AppLocalizationsKo();
    case 'ru':
      return AppLocalizationsRu();
    case 'uz':
      return AppLocalizationsUz();
    case 'vi':
      return AppLocalizationsVi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
