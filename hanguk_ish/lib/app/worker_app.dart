import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/models/shift.dart';
import '../design/theme.dart';
import '../features/worker/feed/feed_screen.dart';
import '../features/worker/map/map_screen.dart';
import '../features/worker/onboarding/a01_login_screen.dart';
import '../features/worker/profile/profile_screens.dart';
import '../features/worker/settings/app_language.dart';
import '../features/worker/shell/worker_shell.dart';
import '../features/worker/shift/shift_detail_screen.dart';
import '../features/worker/shift/take_shift.dart';
import '../l10n/gen/worker_l10n.dart';
import 'text_scale.dart';

/// Paths of the worker app.
abstract final class WorkerRoutes {
  static const login = '/';
  static const profileName = '/profile/name';
  static const profileLanguages = '/profile/languages';
  static const profileSchedule = '/profile/schedule';

  /// The tabs.
  static const feed = '/feed';
  static const map = '/map';
  static const myShifts = '/my-shifts';
  static const earnings = '/earnings';
  static const me = '/me';

  static const notifications = '/notifications';

  /// Where the app opens once signed in.
  static const home = feed;

  static String shift(String id) => '/shift/$id';
  static String taken(String id, {required bool pending}) => '/shift/$id/taken${pending ? '?pending=1' : ''}';
}

/// «Olish» / «Smenani olish»: the confirmation sheet, then the success page.
Future<void> takeShift(BuildContext context, ShiftListing shift) async {
  final result = await showTakeShiftSheet(context, shift);
  if (result == null || !context.mounted) return;
  await context.push(WorkerRoutes.taken(shift.id, pending: result.status == ApplicationStatus.pending));
}

FeedActions _feedActions(BuildContext context) => FeedActions(
      openShift: (shift) => context.push(WorkerRoutes.shift(shift.id)),
      takeShift: (shift) => takeShift(context, shift),
      openFeed: () => context.go(WorkerRoutes.feed),
      openMap: () => context.go(WorkerRoutes.map),
      openNotifications: () => context.push(WorkerRoutes.notifications),
    );

/// Where the app opens (tests open a screen directly).
final workerInitialLocationProvider = Provider<String>((ref) => WorkerRoutes.login);

/// Routes of the worker app.
final workerRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: ref.watch(workerInitialLocationProvider),
    routes: [
      GoRoute(
        path: WorkerRoutes.login,
        builder: (context, state) => A01LoginScreen(
          // Phone and Telegram sign-in screens are not designed yet (T1, T2);
          // until they are, both continue to the profile.
          onPhone: () => context.push(WorkerRoutes.profileName),
          onTelegram: () => context.push(WorkerRoutes.profileName),
        ),
      ),
      GoRoute(
        path: WorkerRoutes.profileName,
        builder: (context, state) => ProfileNameScreen(
          onBack: () => context.pop(),
          onNext: () => context.push(WorkerRoutes.profileLanguages),
        ),
      ),
      GoRoute(
        path: WorkerRoutes.profileLanguages,
        builder: (context, state) => ProfileLanguagesScreen(
          onBack: () => context.pop(),
          onNext: () => context.push(WorkerRoutes.profileSchedule),
        ),
      ),
      GoRoute(
        path: WorkerRoutes.profileSchedule,
        builder: (context, state) => ProfileScheduleScreen(
          onBack: () => context.pop(),
          onDone: () => context.go(WorkerRoutes.home),
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => WorkerShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: WorkerRoutes.feed,
              builder: (context, state) => FeedScreen(actions: _feedActions(context)),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: WorkerRoutes.map,
              builder: (context, state) => WorkerMapScreen(actions: _feedActions(context)),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: WorkerRoutes.myShifts,
              builder: (context, state) => WorkerPendingScreen(title: WorkerL10n.of(context).navMyShifts),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: WorkerRoutes.earnings,
              builder: (context, state) => WorkerPendingScreen(title: WorkerL10n.of(context).navEarnings),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: WorkerRoutes.me,
              builder: (context, state) => WorkerPendingScreen(title: WorkerL10n.of(context).navProfile),
            ),
          ]),
        ],
      ),
      GoRoute(
        path: '/shift/:id',
        builder: (context, state) => ShiftDetailScreen(
          shiftId: state.pathParameters['id']!,
          onBack: () => context.canPop() ? context.pop() : context.go(WorkerRoutes.feed),
          onTake: (shift) => takeShift(context, shift),
        ),
        routes: [
          GoRoute(
            path: 'taken',
            builder: (context, state) => ShiftTakenScreen(
              shiftId: state.pathParameters['id']!,
              pending: state.uri.queryParameters['pending'] == '1',
              onClose: () => context.go(WorkerRoutes.feed),
              onMyShifts: () => context.go(WorkerRoutes.myShifts),
            ),
          ),
        ],
      ),
      GoRoute(
        path: WorkerRoutes.notifications,
        builder: (context, state) => WorkerPendingScreen(
          title: WorkerL10n.of(context).notifications,
          onBack: () => context.canPop() ? context.pop() : context.go(WorkerRoutes.feed),
        ),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

/// «Hanguk Ish» — the worker app.
class WorkerApp extends ConsumerWidget {
  const WorkerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(appLanguageProvider);
    return MaterialApp.router(
      onGenerateTitle: (context) => WorkerL10n.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: hiTheme(),
      locale: language.locale,
      supportedLocales: WorkerL10n.supportedLocales,
      localizationsDelegates: WorkerL10n.localizationsDelegates,
      routerConfig: ref.watch(workerRouterProvider),
      builder: (context, child) =>
          HiTextScaleCap(child: child ?? const SizedBox.shrink()),
    );
  }
}
