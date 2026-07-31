import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/seoul_night/seoul_night.dart';
import '../../l10n/app_localizations.dart';
import '../../design_system/seoul_night/seoul_night_gallery.dart';
import '../../features/account/presentation/account_screen.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/home/presentation/home_tab_provider.dart';
import '../../features/home/presentation/notifications_screen.dart';
import '../../features/guest/presentation/guest_shell.dart';
import '../../features/home/presentation/welcome_screen.dart';
import '../../features/map/data/map_repository.dart';
import '../../features/map/domain/university.dart';
import '../../features/map/presentation/map_deeplink_provider.dart';
import '../../features/map/presentation/widgets/university_roadview_screen.dart';
import '../../features/uni_db/presentation/admin_review_screen.dart';
import '../../features/uni_db/presentation/application_tracker_screen.dart';
import '../../features/uni_db/presentation/institution_compare_screen.dart';
import '../../features/uni_db/presentation/institution_detail_screen.dart';
import '../../features/uni_db/presentation/notification_settings_screen.dart';
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
  GoRoute(path: '/account', builder: (context, state) => const AccountScreen()),
  // The 한 orb's bell opens this — actionable reminders (documents to submit,
  // application stages), not the per-institution notification toggles.
  GoRoute(
    path: '/notifications',
    builder: (context, state) => const NotificationsScreen(),
  ),
];

/// Guest Explorer (DESIGN_SPEC 3b). Registered as a plain GoRoute so the
/// catalogue can be reached without a session — see the redirect below,
/// which lists `/guest` alongside `/welcome` and `/login`.
List<RouteBase> _guestRoutes() => [
  GoRoute(path: '/guest', builder: (context, state) => const GuestShell()),
];

List<RouteBase> _mapRoutes() => [
  GoRoute(
    path: '/walkaround/:institutionId',
    builder: (context, state) {
      final id = state.pathParameters['institutionId'] ?? '';
      final extraUni = state.extra is University
          ? state.extra as University
          : null;
      return _WalkaroundRouteEntry(institutionId: id, seed: extraUni);
    },
  ),
  GoRoute(
    path: '/map/:institutionId',
    builder: (context, state) {
      final id = state.pathParameters['institutionId'] ?? '';
      return _MapDeepLinkEntry(institutionId: id);
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
/// `pendingMapDetailProvider` and renders the home screen; MapTab
/// picks the id up on its next build and raises the detail sheet.
class _MapDeepLinkEntry extends ConsumerWidget {
  const _MapDeepLinkEntry({required this.institutionId});

  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Schedule the writes for after first build to avoid mutating
    // providers during the build phase.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Named, not a literal: the Seoul Night shell added a Home section, so
      // the old hardcoded `1` now points at Applications.
      ref.read(homeTabProvider.notifier).setTab(SeoulSection.map);
      ref.read(pendingMapDetailProvider.notifier).set(institutionId);
    });
    return const HomeScreen();
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
                onPressed: () {
                  if (nav.canPop()) {
                    nav.pop();
                  } else {
                    // Cold deep-link with nothing behind it. `go('/')` lets
                    // the redirect decide: home for a student, welcome for a
                    // visitor.
                    context.go('/');
                  }
                },
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
      return InstitutionCompareScreen(ids: ids);
    },
  ),
  GoRoute(
    path: '/institutions/:id',
    builder: (context, state) => InstitutionDetailScreen(
      institutionId: state.pathParameters['id'] ?? '',
    ),
  ),
  GoRoute(
    path: '/applications/tracker',
    builder: (context, state) => const ApplicationTrackerScreen(),
  ),
  GoRoute(
    path: '/notifications/settings',
    builder: (context, state) => const NotificationSettingsScreen(),
  ),
  GoRoute(
    path: '/admin/review',
    builder: (context, state) => const AdminReviewScreen(),
  ),
];

final appRouterProvider = Provider<GoRouter>((ref) {
  final authStateAsync = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    routes: <RouteBase>[
      ...$appRoutes,
      ..._accountRoutes(),
      ..._guestRoutes(),
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
    redirect: (context, state) {
      final isLoading = authStateAsync.isLoading;
      final isAuthenticated = authStateAsync.value?.session != null;

      final loc = state.uri.toString();
      final isGoingToLogin = loc == '/login';
      final isGoingToWelcome = loc == '/welcome';
      // Guest Explorer is a public surface: it reads only the anon-readable
      // catalogue view and holds no student data. `/walkaround` rides along
      // because the guest map's detail sheet opens it — it is a Kakao
      // panorama of a campus, catalogue content like any other, and it
      // resolves through the same public view. Without this a guest tapping
      // it would be bounced out to /welcome mid-browse.
      final isGoingToGuest =
          loc.startsWith('/guest') || loc.startsWith('/walkaround');

      if (isLoading) return null;

      if (!isAuthenticated &&
          !isGoingToLogin &&
          !isGoingToWelcome &&
          !isGoingToGuest) {
        return '/welcome';
      }

      // A signed-in student has the real thing; guest mode is a lesser view
      // of it, so send them home rather than letting them land there.
      if (isAuthenticated &&
          (isGoingToLogin || isGoingToWelcome || loc.startsWith('/guest'))) {
        return '/';
      }

      return null;
    },
  );
});

@TypedGoRoute<HomeRoute>(path: '/')
class HomeRoute extends GoRouteData with $HomeRoute {
  const HomeRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) => const HomeScreen();
}

@TypedGoRoute<WelcomeRoute>(path: '/welcome')
class WelcomeRoute extends GoRouteData with $WelcomeRoute {
  const WelcomeRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      const WelcomeScreen();
}

@TypedGoRoute<LoginRoute>(path: '/login')
class LoginRoute extends GoRouteData with $LoginRoute {
  const LoginRoute();

  @override
  Widget build(BuildContext context, GoRouterState state) {
    final extra = state.extra as Map<String, dynamic>?;
    final isMagicCode = extra?['magic_code'] as bool? ?? false;
    return LoginScreen(initialMagicCodeMode: isMagicCode);
  }
}
