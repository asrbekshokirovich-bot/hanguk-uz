import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/links/directions.dart';
import '../data/models/my_shift.dart';
import '../data/models/shift.dart';
import '../design/theme.dart';
import '../features/worker/feed/feed_screen.dart';
import '../features/worker/map/map_screen.dart';
import '../features/worker/my_shifts/my_shifts_screen.dart';
import '../features/worker/onboarding/a01_login_screen.dart';
import '../features/worker/profile/profile_screens.dart';
import '../features/worker/settings/app_language.dart';
import '../features/worker/shell/worker_shell.dart';
import '../features/worker/shift/shift_detail_screen.dart';
import '../features/worker/shift/take_shift.dart';
import '../features/worker/work/work_screens.dart';
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
  static String checkIn(String app) => '/work/$app/check-in';
  static String atWork(String app) => '/work/$app';
  static String checkOut(String app) => '/work/$app/check-out';
  static String result(String app) => '/work/$app/result';
  static String rate(String app) => '/work/$app/rate';
  static String chat(String app) => '/chat/$app';
  static String taken(String id, {required bool pending}) => '/shift/$id/taken${pending ? '?pending=1' : ''}';
}

/// «Olish» / «Smenani olish»: the confirmation sheet, then the success page.
Future<void> takeShift(BuildContext context, ShiftListing shift) async {
  final result = await showTakeShiftSheet(context, shift);
  if (result == null || !context.mounted) return;
  await context.push(WorkerRoutes.taken(shift.id, pending: result.status == ApplicationStatus.pending));
}

MyShiftsActions _myShiftsActions(BuildContext context, WidgetRef ref) => MyShiftsActions(
      openShift: (app) => context.push(WorkerRoutes.shift(app.shift.id)),
      openCheckIn: (app) => context.push(WorkerRoutes.checkIn(app.applicationId)),
      openAtWork: (app) => context.push(WorkerRoutes.atWork(app.applicationId)),
      openResult: (app) => context.push(WorkerRoutes.result(app.applicationId)),
      openRate: (app) => context.push(WorkerRoutes.rate(app.applicationId)),
      openChat: (app) => context.push(WorkerRoutes.chat(app.applicationId)),
      openDirections: (app) => _openDirections(context, ref, app),
      openFeed: () => context.go(WorkerRoutes.feed),
    );

Future<void> _openDirections(BuildContext context, WidgetRef ref, MyShift app) async {
  final lang = ref.read(appLanguageProvider).code;
  final messenger = ScaffoldMessenger.maybeOf(context);
  final l10n = WorkerL10n.of(context);
  final opened = await ref.read(linkOpenerProvider)(directionsUri(app.shift.business, app.shift.business.displayName(lang)));
  if (!opened) messenger?.showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
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
              builder: (context, state) => Consumer(
                builder: (context, ref, _) => MyShiftsScreen(actions: _myShiftsActions(context, ref)),
              ),
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
        path: '/work/:app',
        builder: (context, state) => AtWorkScreen(
          applicationId: state.pathParameters['app']!,
          onClose: () => context.go(WorkerRoutes.myShifts),
          onScanOut: () => context.push(WorkerRoutes.checkOut(state.pathParameters['app']!)),
        ),
        routes: [
          GoRoute(
            path: 'check-in',
            builder: (context, state) => QrScanScreen(
              applicationId: state.pathParameters['app']!,
              mode: QrScanMode.checkIn,
              onClose: () => context.canPop() ? context.pop() : context.go(WorkerRoutes.myShifts),
              onDone: (app) => context.pushReplacement(WorkerRoutes.atWork(app.applicationId)),
            ),
          ),
          GoRoute(
            path: 'check-out',
            builder: (context, state) => QrScanScreen(
              applicationId: state.pathParameters['app']!,
              mode: QrScanMode.checkOut,
              onClose: () => context.canPop() ? context.pop() : context.go(WorkerRoutes.atWork(state.pathParameters['app']!)),
              onDone: (app) => context.go(WorkerRoutes.result(app.applicationId)),
            ),
          ),
          GoRoute(
            path: 'result',
            builder: (context, state) => ShiftResultScreen(
              applicationId: state.pathParameters['app']!,
              onClose: () => context.go(WorkerRoutes.feed),
              onRate: () => context.push(WorkerRoutes.rate(state.pathParameters['app']!)),
            ),
          ),
          GoRoute(
            path: 'rate',
            builder: (context, state) => RateBusinessScreen(
              applicationId: state.pathParameters['app']!,
              onClose: () => context.canPop() ? context.pop() : context.go(WorkerRoutes.myShifts),
              onSent: () => context.go(WorkerRoutes.feed),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/chat/:app',
        builder: (context, state) => WorkerPendingScreen(
          title: WorkerL10n.of(context).chat,
          onBack: () => context.canPop() ? context.pop() : context.go(WorkerRoutes.myShifts),
        ),
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
