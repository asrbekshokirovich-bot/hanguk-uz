import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/format/business_number.dart';
import '../core/format/phone.dart';
import '../data/backend/backend.dart';
import '../data/repositories/auth_repository.dart';
import '../data/repositories/employer_repository.dart';
import '../design/theme.dart';
import '../design/tokens.dart';
import '../design/widgets/backdrop.dart';
import '../design/widgets/brand.dart';
import '../features/employer/create/ba2_create_screen.dart';
import '../features/employer/home/ba1_home_screen.dart';
import '../features/employer/ko.dart';
import '../features/employer/login/ba0_code_screen.dart';
import '../features/employer/login/ba0_login_screen.dart';
import '../features/employer/notifications/employer_notifications_screen.dart';
import '../features/employer/providers.dart';
import '../features/employer/report/ba5_report_screen.dart';
import '../features/employer/shell/employer_shell.dart';
import '../features/employer/shift/ba3_shift_screen.dart';
import '../features/employer/workers/ba4_workers_screen.dart';
import 'text_scale.dart';

/// Paths of the employer app.
abstract final class EmployerRoutes {
  /// Decides where a launch opens (signed in with a business?).
  static const start = '/start';

  static const login = '/';

  /// T2: the SMS code after BA0.
  static String code(String phone, String businessNumber) =>
      '/code?n=${Uri.encodeQueryComponent(phone)}&b=${Uri.encodeQueryComponent(businessNumber)}';

  static const home = '/home';
  static const workers = '/workers';
  static const report = '/report';
  static const create = '/create';
  static const notifications = '/notifications';

  static String shift(String id) => '/shift/$id';
  static String edit(String id) => '/shift/$id/edit';
  static String invite(String workerId) => '$create?invite=${Uri.encodeQueryComponent(workerId)}';
}

/// Where the app opens: with a backend, the start gate (a saved session
/// skips BA0); the demo starts at BA0. Tests open a screen directly.
final employerInitialLocationProvider = Provider<String>(
  (ref) => ref.watch(backendConfigProvider).isConfigured ? EmployerRoutes.start : EmployerRoutes.login,
);

void _say(BuildContext context, String text) => (ScaffoldMessenger.of(context)..hideCurrentSnackBar())
    .showSnackBar(SnackBar(content: Text(text)));

/// After signing in: an owner with a business opens BA1; a new owner's
/// [businessNumber] is checked with 국세청 and registered first. A refusal
/// goes back to BA0 with the reason.
Future<void> continueOwnerAfterSignIn(BuildContext context, WidgetRef ref, {String? businessNumber}) async {
  final repo = ref.read(employerRepositoryProvider);
  try {
    final businesses = await repo.businesses();
    if (businesses.isEmpty) {
      if (businessNumber == null) {
        if (context.mounted) context.go(EmployerRoutes.login);
        return;
      }
      await repo.registerBusiness(businessNumber);
    }
    ref.invalidate(businessesProvider);
    if (context.mounted) context.go(EmployerRoutes.home);
  } catch (error) {
    if (!context.mounted) return;
    if (businessNumber == null) {
      // A launch while offline: BA1 shows the error and retries.
      context.go(EmployerRoutes.home);
      return;
    }
    context.go(EmployerRoutes.login);
    _say(context, Ko.error(error));
  }
}

class _OwnerStartGate extends ConsumerStatefulWidget {
  const _OwnerStartGate();

  @override
  ConsumerState<_OwnerStartGate> createState() => _OwnerStartGateState();
}

class _OwnerStartGateState extends ConsumerState<_OwnerStartGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (ref.read(authRepositoryProvider).userId == null) {
        context.go(EmployerRoutes.login);
      } else {
        continueOwnerAfterSignIn(context, ref);
      }
    });
  }

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: HiColors.navy,
        body: HiBackdrop(glow: HiGlow.entry, child: Center(child: HiBrandTile())),
      );
}

/// Routes of the employer app.
final employerRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: ref.watch(employerInitialLocationProvider),
    routes: [
      GoRoute(path: EmployerRoutes.start, builder: (context, state) => const _OwnerStartGate()),
      GoRoute(
        path: EmployerRoutes.login,
        builder: (context, state) => Consumer(
          builder: (context, ref, _) => Ba0LoginScreen(
            onStart: (phone, businessNumber) async {
              if (KoreanPhone.toE164(phone) == null || businessNumber.replaceAll(RegExp(r'\D'), '').length != 10) {
                _say(context, Ko.loginIncomplete);
                return;
              }
              if (!isValidBusinessNumber(businessNumber)) {
                _say(context, Ko.bizNoInvalid);
                return;
              }
              final auth = ref.read(authRepositoryProvider);
              if (auth.userId != null) {
                // Back from a refused registration: signed in already.
                await continueOwnerAfterSignIn(context, ref, businessNumber: businessNumber);
                return;
              }
              try {
                await auth.sendCode(phone);
              } catch (error) {
                if (context.mounted) _say(context, Ko.error(error));
                return;
              }
              if (context.mounted) context.push(EmployerRoutes.code(phone, businessNumber));
            },
          ),
        ),
      ),
      GoRoute(
        path: '/code',
        builder: (context, state) => Consumer(
          builder: (context, ref, _) => Ba0CodeScreen(
            phone: state.uri.queryParameters['n'] ?? '',
            onBack: () => context.canPop() ? context.pop() : context.go(EmployerRoutes.login),
            onVerified: () =>
                continueOwnerAfterSignIn(context, ref, businessNumber: state.uri.queryParameters['b'] ?? ''),
          ),
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
