import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/theme.dart';
import '../features/employer/create/ba2_create_screen.dart';
import '../features/employer/home/ba1_home_screen.dart';
import '../features/employer/ko.dart';
import '../features/employer/login/ba0_login_screen.dart';
import '../features/employer/notifications/employer_notifications_screen.dart';
import '../features/employer/report/ba5_report_screen.dart';
import '../features/employer/shell/employer_shell.dart';
import '../features/employer/shift/ba3_shift_screen.dart';
import '../features/employer/workers/ba4_workers_screen.dart';
import 'text_scale.dart';

/// Paths of the employer app.
abstract final class EmployerRoutes {
  static const login = '/';
  static const home = '/home';
  static const workers = '/workers';
  static const report = '/report';
  static const create = '/create';
  static const notifications = '/notifications';

  static String shift(String id) => '/shift/$id';
  static String edit(String id) => '/shift/$id/edit';
  static String invite(String workerId) => '$create?invite=${Uri.encodeQueryComponent(workerId)}';
}

/// Where the app opens (tests open a screen directly).
final employerInitialLocationProvider = Provider<String>((ref) => EmployerRoutes.login);

/// Routes of the employer app.
final employerRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: ref.watch(employerInitialLocationProvider),
    routes: [
      GoRoute(
        path: EmployerRoutes.login,
        builder: (context, state) => Ba0LoginScreen(
          onStart: (phone, businessNumber) {
            String digits(String s) => s.replaceAll(RegExp(r'\D'), '');
            if (digits(phone).length != 11 || digits(businessNumber).length != 10) {
              (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(const SnackBar(content: Text(Ko.loginIncomplete)));
              return;
            }
            // Demo: no SMS check or 국세청 lookup until the backend is connected.
            context.go(EmployerRoutes.home);
          },
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => EmployerShell(
          shell: shell,
          onCreate: () => context.push(EmployerRoutes.create),
        ),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: EmployerRoutes.home,
              builder: (context, state) => Ba1HomeScreen(
                actions: HomeActions(
                  openShift: (id) => context.push(EmployerRoutes.shift(id)),
                  create: () => context.push(EmployerRoutes.create),
                  notifications: () => context.push(EmployerRoutes.notifications),
                ),
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: EmployerRoutes.workers,
              builder: (context, state) => Ba4WorkersScreen(
                onRequestAgain: (worker) => context.push(EmployerRoutes.invite(worker.id)),
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: EmployerRoutes.report,
              builder: (context, state) => const Ba5ReportScreen(),
            ),
          ]),
        ],
      ),
      GoRoute(
        path: EmployerRoutes.create,
        builder: (context, state) => Ba2CreateScreen(
          inviteWorkerId: state.uri.queryParameters['invite'],
          onClose: () => context.canPop() ? context.pop() : context.go(EmployerRoutes.home),
          onSaved: (shift) => context.canPop() ? context.pop() : context.go(EmployerRoutes.home),
        ),
      ),
      GoRoute(
        path: '/shift/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return Ba3ShiftScreen(
            shiftId: id,
            onBack: () => context.canPop() ? context.pop() : context.go(EmployerRoutes.home),
            onEdit: () => context.push(EmployerRoutes.edit(id)),
          );
        },
        routes: [
          GoRoute(
            path: 'edit',
            builder: (context, state) => Ba2CreateScreen(
              editShiftId: state.pathParameters['id'],
              onClose: () => context.pop(),
              onSaved: (shift) => context.pop(),
            ),
          ),
        ],
      ),
      GoRoute(
        path: EmployerRoutes.notifications,
        builder: (context, state) => EmployerNotificationsScreen(
          onBack: () => context.canPop() ? context.pop() : context.go(EmployerRoutes.home),
          openShift: (id) => context.push(EmployerRoutes.shift(id)),
        ),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

/// «Hanguk Ish 사장님» — the employer app, Korean only.
class EmployerApp extends ConsumerWidget {
  const EmployerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Hanguk Ish 사장님',
      debugShowCheckedModeBanner: false,
      theme: hiTheme(),
      locale: const Locale('ko'),
      supportedLocales: const [Locale('ko')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: ref.watch(employerRouterProvider),
      builder: (context, child) =>
          HiTextScaleCap(child: child ?? const SizedBox.shrink()),
    );
  }
}
