import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthState;

import '../../core/analytics/tracked.dart';
import '../../design_system/seoul_night/seoul_night.dart';
import '../analytics/app_events.dart';
import '../../l10n/app_localizations.dart';
import '../../design_system/seoul_night/seoul_night_gallery.dart';
import '../../features/account/presentation/account_screen.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/presentation/client_code_screen.dart';
import '../../features/entry/data/entry_store.dart';
import '../../features/entry/presentation/language_screen.dart';
import '../../features/client/presentation/client_shell.dart';
import '../../features/home/presentation/notifications_screen.dart';
import '../../features/assessment/presentation/lead_screen.dart';
import '../../features/assessment/presentation/report_screen.dart';
import '../../features/assessment/presentation/sent_screen.dart';
import '../../features/discover/presentation/discover_routes.dart';
import '../../features/discover/presentation/chosen_screen.dart';
import '../../features/discover/presentation/compare_screen.dart';
import '../../features/discover/presentation/discover_shell.dart';
import '../../features/discover/presentation/duel_screen.dart';
import '../../features/discover/presentation/universities_screen.dart';
import '../../features/discover/presentation/widgets/app_nav.dart';
import '../../features/discover/data/list_mode.dart';
import '../../features/discover/presentation/saved_screen.dart';
import '../../features/discover/presentation/search_screen.dart';
import '../../features/discover/presentation/filter_screen.dart';
import '../../features/discover/presentation/university_assess_screen.dart';
import '../../features/discover/presentation/university_screen.dart';
import '../../features/discover/presentation/visa_screen.dart';
import '../../features/map/data/map_repository.dart';
import '../../features/onboarding/onboarding_routes.dart';
import '../../features/onboarding/presentation/quiz_s02_screen.dart';
import '../../features/onboarding/presentation/result_s03_screen.dart';
import '../../features/onboarding/presentation/tariff_detail_s06_screen.dart';
import '../../features/onboarding/presentation/tariffs_s05_screen.dart';
import '../../features/onboarding/presentation/welcome_s01_screen.dart';
import '../../features/map/domain/university.dart';
import '../../features/map/presentation/map_deeplink_provider.dart';
import '../../features/map/presentation/widgets/university_roadview_screen.dart';
import '../../features/surveys/presentation/surveys_screen.dart';
import '../../features/surveys/presentation/survey_detail_screen.dart';
import '../../features/uni_db/presentation/admin_review_screen.dart';
import '../../features/uni_db/presentation/application_tracker_screen.dart';
import '../../features/uni_db/presentation/institution_compare_screen.dart';
import '../../features/uni_db/presentation/institution_detail_screen.dart';
import '../../features/uni_db/presentation/notification_settings_screen.dart';
import '../../features/university_choices/presentation/university_choices_screen.dart';
import '../feature_flags/uni_db_flag.dart';

part 'app_router.g.dart';

// Audit M9 / M11 (2026-05-11): map-feature routes registered as
// plain GoRoute entries so flipping or extending them doesn't
// require running `build_runner` (same pattern as `_uniDbRoutes`).
//
// - `/walkaround/:institutionId` — opens the Kakao Roadview WebView
//   for the institution. Accepts a `University` via `extra:` for the
//   common in-app case (detail sheet → walkaround); falls back to
//   fetching the row from `universitiesProvider` for cold deep-links.
//
// - `/map/:institutionId` — switches the home-tab to Map, then
//   writes the institution id into `pendingMapDetailProvider` so
//   MapTab raises the detail bottom sheet. Used by push
//   notifications and external "share this university" links.
// UI/UX audit P0 N1 (2026-05-12): the `/account` route is registered as
// a plain GoRoute entry (same pattern as `_mapRoutes()` and
// `_uniDbRoutes()`) so we don't need to run build_runner to surface it.
// Wiring this is required for the store-mandated sign-out and account
// deletion flow — see `account_screen.dart`.
List<RouteBase> _accountRoutes() => [
  GoRoute(path: '/account', builder: (context, state) => const NavScaffold(current: -1, child: AccountScreen())),
  // The 한 orb's bell opens this — actionable reminders (documents to submit,
  // application stages), not the per-institution notification toggles.
  GoRoute(
    path: '/notifications',
    builder: (context, state) => const NavScaffold(current: -1, child: NotificationsScreen()),
  ),
];

/// The full design's guest flow: the home (03) with its search (04), filter
/// board (05), results and slots (06), the duel (07), the chosen three (08),
/// the comparison (09) and the saved list (16), a university's page (10),
/// and "Koreaga keta olamanmi o'zi?" (11–13). Plain GoRoutes so the catalogue can be reached
/// without a session — see the redirect below.
List<RouteBase> _guestRoutes() => [
  GoRoute(
    path: kDiscoverPath,
    builder: (context, state) =>
        DiscoverShell(tab: int.tryParse(state.uri.queryParameters['tab'] ?? '') ?? AppTab.home),
  ),
  GoRoute(
    path: kDiscoverSearchPath,
    builder: (context, state) => const NavScaffold(current: AppTab.universities, child: SearchScreen()),
  ),
  GoRoute(
    path: kDiscoverFilterPath,
    builder: (context, state) => const NavScaffold(current: AppTab.universities, child: FilterScreen()),
  ),
  GoRoute(
    path: kDiscoverResultsPath,
    builder: (context, state) => const NavScaffold(current: AppTab.universities, child: UniversitiesScreen()),
  ),
  GoRoute(
    path: kDiscoverDuelPath,
    builder: (context, state) => const NavScaffold(current: AppTab.universities, child: DuelScreen()),
  ),
  GoRoute(path: kDiscoverChosenPath, builder: (context, state) => const ChosenScreen()),
  GoRoute(
    path: kDiscoverComparePath,
    builder: (context, state) => NavScaffold(
      current: AppTab.universities,
      child: CompareScreen(
        institutionIds: state.extra is List ? (state.extra as List).whereType<String>().toList() : const [],
      ),
    ),
  ),
  GoRoute(path: kDiscoverSavedPath, builder: (context, state) => const SavedScreen()),
  GoRoute(
    path: '/university/:id',
    builder: (context, state) => UniversityScreen(institutionId: state.pathParameters['id'] ?? ''),
  ),
  GoRoute(path: kVisaPath, builder: (context, state) => const VisaScreen()),
  GoRoute(
    path: '/university/:id/assess',
    builder: (context, state) => UniversityAssessScreen(institutionId: state.pathParameters['id'] ?? ''),
  ),
  // The assessment's questions live on the home board now; a link to the old
  // page opens the report.
  GoRoute(path: kAssessmentPath, redirect: (context, state) => kAssessmentReportPath),
  GoRoute(
    path: kAssessmentReportPath,
    builder: (context, state) => const NavScaffold(current: AppTab.home, child: ReportScreen()),
  ),
  GoRoute(
    path: kAssessmentLeadPath,
    builder: (context, state) => const NavScaffold(current: AppTab.home, child: LeadScreen()),
  ),
  GoRoute(
    path: kAssessmentSentPath,
    builder: (context, state) => const NavScaffold(current: AppTab.home, child: SentScreen()),
  ),
];

/// The way in before Welcome: the language picker on first launch — see the
/// redirect below.
List<RouteBase> _entryRoutes() => [
  GoRoute(
    path: '/language',
    builder: (context, state) => const LanguageScreen(),
  ),
];

/// "Viza imkoniyatim" (S02–S06; S01 is `/welcome`). Public, like `/guest`:
/// a visitor answers six questions and sees the result before giving a phone.
List<RouteBase> _onboardingRoutes() => [
  GoRoute(path: kQuizPath, builder: (context, state) => const QuizScreen()),
  GoRoute(
    path: kQuizResultPath,
    builder: (context, state) => const QuizResultScreen(),
  ),
  GoRoute(
    path: kTariffsPath,
    builder: (context, state) => const NavScaffold(current: -1, child: TariffsScreen()),
  ),
  GoRoute(
    path: '$kTariffsPath/:code',
    builder: (context, state) =>
        NavScaffold(current: -1, child: TariffDetailScreen(code: state.pathParameters['code'] ?? 'premium')),
  ),
];

List<RouteBase> _universityChoiceRoutes() => [
  GoRoute(
    path: kUniversityChoicesPath,
    builder: (context, state) => const NavScaffold(current: AppTab.application, child: UniversityChoicesScreen()),
  ),
];

List<RouteBase> _surveyRoutes() => [
  GoRoute(
    path: '/surveys',
    builder: (context, state) => const NavScaffold(current: AppTab.prepare, child: SurveysScreen()),
  ),
  GoRoute(
    path: '/surveys/:id',
    builder: (context, state) {
      final id = state.pathParameters['id'] ?? '';
      final title = state.extra is String ? state.extra as String : null;
      return NavScaffold(current: AppTab.prepare, child: SurveyDetailScreen(surveyId: id, surveyTitle: title));
    },
  ),
];

List<RouteBase> _mapRoutes() => [
  GoRoute(
    path: '/walkaround/:institutionId',
    builder: (context, state) {
      final id = state.pathParameters['institutionId'] ?? '';
      final extraUni = state.extra is University
          ? state.extra as University
          : null;
      return NavScaffold(current: AppTab.universities, child: _WalkaroundRouteEntry(institutionId: id, seed: extraUni));
    },
  ),
  GoRoute(
    path: '/map/:institutionId',
    builder: (context, state) {
      final id = state.pathParameters['institutionId'] ?? '';
      return NavScaffold(current: AppTab.universities, child: _MapDeepLinkEntry(institutionId: id));
    },
  ),
];

/// Entry-point widget for `/walkaround/:institutionId`. If the caller
/// already had the University in hand (extra), uses it. Otherwise
/// awaits `universitiesProvider` and finds the matching row. Renders
/// a clean empty state if neither path resolves.
class _WalkaroundRouteEntry extends ConsumerWidget {
  const _WalkaroundRouteEntry({required this.institutionId, this.seed});

  final String institutionId;
  final University? seed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (seed != null) {
      return UniversityRoadviewScreen(university: seed!);
    }
    final unisAsync = ref.watch(universitiesProvider);
    return unisAsync.when(
      loading: () => const _RouteLoadingShell(),
      error: (_, _) => const _RouteMissingShell(),
      data: (unis) {
        University? match;
        for (final u in unis) {
          if (u.id == institutionId) {
            match = u;
            break;
          }
        }
        if (match == null) return const _RouteMissingShell();
        return UniversityRoadviewScreen(university: match);
      },
    );
  }
}

/// Entry-point widget for `/map/:institutionId`. Writes the id into
/// `pendingMapDetailProvider` and shows the map tab; the map picks the id up
/// and selects that university's pin.
class _MapDeepLinkEntry extends ConsumerWidget {
  const _MapDeepLinkEntry({required this.institutionId});

  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Schedule the writes for after first build to avoid mutating
    // providers during the build phase.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(pendingMapDetailProvider.notifier).set(institutionId);
    });
    // The map is the Universitetlar list's third mode.
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(uniModeProvider.notifier).set(UniMode.map));
    return const ClientShell(tab: ClientShell.tabUniversities);
  }
}

class _RouteLoadingShell extends StatelessWidget {
  const _RouteLoadingShell();
  @override
  Widget build(BuildContext context) => const SeoulNightScaffold(
    body: Center(child: CircularProgressIndicator(color: SeoulColors.lime)),
  );
}

/// Shown when a `/walkaround/:id` link names an institution that is not in
/// the catalogue — a stale share link, or a row that left `is_visible_on_map`.
///
/// Reachable anonymously since `/walkaround` was opened to Guest Explorer, so
/// it is on the design system and localized like any other screen. It must
/// also not eject a guest: `context.go('/')` sent an unauthenticated visitor
/// to `/welcome`, so "Back" silently dropped them out of guest mode and lost
/// their compare tray. Popping returns them wherever they came from.
class _RouteMissingShell extends StatelessWidget {
  const _RouteMissingShell();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final nav = Navigator.of(context);
    return SeoulNightScaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(SeoulSizes.screenPadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const HangulGlyphTile(glyph: '한', size: 56),
              const SizedBox(height: 18),
              Text(
                l.unknownUniversity,
                textAlign: TextAlign.center,
                style: SeoulType.title,
              ),
              const SizedBox(height: 24),
              SeoulOutlineButton(
                label: l.a11yTooltipBack,
                expand: false,
                onPressed: tracked('app_router.back', () {
                  if (nav.canPop()) {
                    nav.pop();
                  } else {
                    // Cold deep-link with nothing behind it. `go('/')` lets
                    // the redirect decide: home for a student, welcome for a
                    // visitor.
                    context.go('/');
                  }
                }),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// University DB routes (plan §H.3) — only registered when the
// `UNI_DB_ENABLED` compile-time flag is true. Kept as plain GoRoute
// entries so flipping the flag does not require running build_runner.
List<RouteBase> _uniDbRoutes() => [
  GoRoute(
    path: '/institutions/compare',
    builder: (context, state) {
      final raw = state.uri.queryParameters['ids'] ?? '';
      final ids = raw
          .split(',')
          .map((e) => e.trim())
          .where((e) => e.isNotEmpty)
          .toList(growable: false);
      return NavScaffold(current: AppTab.universities, child: InstitutionCompareScreen(ids: ids));
    },
  ),
  GoRoute(
    path: '/institutions/:id',
    builder: (context, state) => NavScaffold(
      current: AppTab.universities,
      child: InstitutionDetailScreen(institutionId: state.pathParameters['id'] ?? ''),
    ),
  ),
  GoRoute(
    path: '/applications/tracker',
    builder: (context, state) => const NavScaffold(current: AppTab.application, child: ApplicationTrackerScreen()),
  ),
  GoRoute(
    path: '/notifications/settings',
    builder: (context, state) => const NavScaffold(current: -1, child: NotificationSettingsScreen()),
  ),
  GoRoute(
    path: '/admin/review',
    builder: (context, state) => const AdminReviewScreen(),
  ),
];

/// What the redirect needs from the auth stream, and a ping when it changes.
///
/// The router used to `ref.watch` the auth stream itself, so EVERY auth event
/// built a brand-new GoRouter at '/': the guest sign-in that opens the
/// university tests, and the token refresh when the app comes back from the
/// microphone prompt or the background. Each one threw the student out of the
/// Study Plan / interview test to the home screen. Now the router is built
/// once and only re-runs its redirect when being signed in actually changes.
class _AuthGate extends ChangeNotifier {
  bool isLoading = true;
  bool isAuthenticated = false;

  void update({required bool isLoading, required bool isAuthenticated}) {
    if (isLoading == this.isLoading && isAuthenticated == this.isAuthenticated) return;
    this.isLoading = isLoading;
    this.isAuthenticated = isAuthenticated;
    notifyListeners();
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  // Only the language gate rebuilds the router; switching language later
  // must not throw the visitor back to the first screen.
  final hasLanguage = ref.watch(entryProvider.select((s) => s.hasLanguage));

  final gate = _AuthGate();
  void sync(AsyncValue<AuthState> s) => gate.update(
    isLoading: s.isLoading,
    isAuthenticated: isClientSession(s.value?.session),
  );
  sync(ref.read(authStateProvider));
  ref.listen<AsyncValue<AuthState>>(authStateProvider, (_, next) => sync(next));

  final router = GoRouter(
    initialLocation: '/',
    observers: [AppEventsNavigatorObserver()],
    routes: <RouteBase>[
      ...$appRoutes,
      ..._accountRoutes(),
      ..._guestRoutes(),
      ..._entryRoutes(),
      ..._onboardingRoutes(),
      ..._surveyRoutes(),
      ..._universityChoiceRoutes(),
      ..._mapRoutes(),
      if (kUniDbEnabled) ..._uniDbRoutes(),
      // Seoul Night design-system gallery. Debug builds only — the flag is
      // kDebugMode, so the route simply doesn't exist in a release binary.
      if (kSeoulGalleryEnabled)
        GoRoute(
          path: kSeoulGalleryRoute,
          builder: (context, state) => const SeoulNightGallery(),
        ),
    ],
    refreshListenable: gate,
    redirect: (context, state) => resolveAppRedirect(
      loc: state.uri.toString(),
      isLoading: gate.isLoading,
      isAuthenticated: gate.isAuthenticated,
      hasLanguage: hasLanguage,
    ),
  );
  return router;
});

/// Where [loc] should go instead, or null to stay. Pure, so the gates can be
/// tested without a router or a session.
@visibleForTesting
String? resolveAppRedirect({
  required String loc,
  required bool isLoading,
  required bool isAuthenticated,
  required bool hasLanguage,
}) {
  final path = Uri.parse(loc).path;
  final isGoingToLogin = path == '/login';
  final isGoingToWelcome = path == '/welcome';
  // The guest flow is a public surface: it reads only the anon-readable
  // catalogue views and holds no student data. `/walkaround` rides along
  // because the map's detail sheet opens it — a Kakao panorama of a campus,
  // catalogue content like any other. A university's page (10) and the
  // assessment (11–13) are public too: the visitor gives a phone only in 12.
  final isGoingToGuest =
      path.startsWith('/guest') ||
      path.startsWith('/walkaround') ||
      path.startsWith('/university/') ||
      path == kAssessmentPath ||
      path.startsWith('$kAssessmentPath/');

  final isGoingToLanguage = path == '/language';
  // The old "Viza imkoniyatim" screens (S01–S06) stay reachable by link until
  // they are removed; nothing in the flow leads there any more.
  final isGoingToOnboarding = isOnboardingPath(path);

  if (isLoading) return null;

  // The way in: the language on first launch, then the home (design 03).
  // A signed-in student skips all of it.
  if (!isAuthenticated) {
    if (!hasLanguage) return isGoingToLanguage ? null : '/language';
    if (isGoingToLanguage) return kDiscoverPath;
  }

  if (!isAuthenticated &&
      !isGoingToLogin &&
      !isGoingToWelcome &&
      !isGoingToGuest &&
      !isGoingToOnboarding) {
    return kDiscoverPath;
  }

  // A signed-in student has the real thing; the guest home is a lesser view
  // of it, so send them home rather than letting them land there. The pages
  // pushed from it (search, filter, results, saved…) are the same for both.
  if (isAuthenticated &&
      (isGoingToLogin ||
          isGoingToWelcome ||
          isGoingToLanguage ||
          isGoingToOnboarding ||
          path == kDiscoverPath)) {
    return '/';
  }

  return null;
}

@TypedGoRoute<HomeRoute>(path: '/')
class HomeRoute extends GoRouteData with $HomeRoute {
  const HomeRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) => ClientShell(
    tab: int.tryParse(state.uri.queryParameters['tab'] ?? '') ?? ClientShell.tabApplication,
  );
}

@TypedGoRoute<WelcomeRoute>(path: '/welcome')
class WelcomeRoute extends GoRouteData with $WelcomeRoute {
  const WelcomeRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const OnboardingWelcomeScreen();
}

@TypedGoRoute<LoginRoute>(path: '/login')
class LoginRoute extends GoRouteData with $LoginRoute {
  const LoginRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    final extra = state.extra as Map<String, dynamic>?;
    return ClientCodeScreen(notice: extra?['notice'] as String?);
  }
}
