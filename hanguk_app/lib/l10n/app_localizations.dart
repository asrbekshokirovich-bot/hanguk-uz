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
  /// **'Enter the 8-character access code (letters and numbers) provided by your consultant or university representative.'**
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
  /// **'Welcome to your journey'**
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

  /// Secondary button on the Welcome screen that opens the guest catalog. Currently compiled out behind kGuestModeEnabled.
  ///
  /// In en, this message translates to:
  /// **'Explore universities'**
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
