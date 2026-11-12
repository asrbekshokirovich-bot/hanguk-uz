import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/format/phone.dart';
import '../data/backend/backend.dart';
import '../data/repositories/auth_repository.dart';
import '../data/repositories/live_updates.dart';
import '../data/repositories/employer_repository.dart';
import '../design/theme.dart';
import '../design/tokens.dart';
import '../design/widgets/backdrop.dart';
import '../design/widgets/brand.dart';
import '../features/employer/create/ba2_create_screen.dart';
import '../features/employer/home/ba1_home_screen.dart';
import '../features/employer/biz.dart';
import '../features/employer/language.dart';
import '../features/employer/login/ba0_code_screen.dart';
import '../features/employer/login/ba0_login_screen.dart';
import '../features/employer/notifications/employer_notifications_screen.dart';
import '../features/employer/providers.dart';
import '../features/employer/report/ba5_report_screen.dart';
import '../features/employer/shell/employer_shell.dart';
import '../features/employer/shift/ba3_shift_screen.dart';
import '../features/employer/widgets.dart';
import '../features/employer/workers/ba4_workers_screen.dart';
import '../l10n/gen/worker_l10n.dart';
import 'text_scale.dart';

/// Paths of the employer app.
abstract final class EmployerRoutes {
  /// Decides where a launch opens (signed in with a business?).
  static const start = '/start';

  static const login = '/';

  /// T2: the SMS code after BA0.
  static String code(String phone) => '/code?n=${Uri.encodeQueryComponent(phone)}';

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
/// business is opened first (P50: no 사업자등록번호, no check). A lost
/// connection goes back to BA0 with the reason; «시작하기» there continues
/// from here, signed in already.
Future<void> continueOwnerAfterSignIn(BuildContext context, WidgetRef ref) async {
  final repo = ref.read(employerRepositoryProvider);
  try {
    final businesses = await repo.businesses();
    if (businesses.isEmpty) await repo.openBusiness();
    ref.invalidate(businessesProvider);
    if (context.mounted) context.go(EmployerRoutes.home);
  } catch (error) {
    if (!context.mounted) return;
    context.go(EmployerRoutes.login);
    _say(context, Biz.error(error));
  }
}

/// The first frame of a launch with a backend: the brand on navy while the
/// session and the businesses are checked. Offline, it says so and tries
/// again on «다시 시도».
class _OwnerStartGate extends ConsumerStatefulWidget {
  const _OwnerStartGate();

  @override
  ConsumerState<_OwnerStartGate> createState() => _OwnerStartGateState();
}

class _OwnerStartGateState extends ConsumerState<_OwnerStartGate> {
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _continue());
  }

  Future<void> _continue() async {
    if (!mounted) return;
    if (ref.read(authRepositoryProvider).userId == null) {
      context.go(EmployerRoutes.login);
      return;
    }
    setState(() => _error = null);
    try {
      final businesses = await ref.read(employerRepositoryProvider).businesses();
      if (!mounted) return;
      ref.invalidate(businessesProvider);
      // No business yet: the registration did not finish; BA0 asks again.
      context.go(businesses.isEmpty ? EmployerRoutes.login : EmployerRoutes.home);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        glow: HiGlow.entry,
        child: Center(
          child: error == null
              ? const HiBrandTile()
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: EmployerLoadError(error: error, onRetry: _continue),
                ),
        ),
      ),
    );
  }
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
            onStart: (phone) async {
              // P54: the owner's phone and an SMS code (Twilio Verify); the
              // business opens at once, unchecked (P50).
              if (KoreanPhone.toE164(phone) == null) {
                _say(context, Biz.loginIncomplete);
                return;
              }
              final auth = ref.read(authRepositoryProvider);
              if (auth.userId != null) {
                // Back after a lost connection: signed in already.
                await continueOwnerAfterSignIn(context, ref);
                return;
              }
              try {
                await auth.sendCode(phone);
              } catch (error) {
                if (context.mounted) _say(context, Biz.error(error));
                return;
              }
              if (context.mounted) context.push(EmployerRoutes.code(phone));
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
            onVerified: () => continueOwnerAfterSignIn(context, ref),
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
  // Signed out from elsewhere (the session ended): back to sign-in.
  ref.listen(authUserProvider, (previous, next) {
    if (next case AsyncData(value: null) when previous?.value != null) router.go(EmployerRoutes.login);
  });
  ref.onDispose(router.dispose);
  return router;
});

/// «Hanguk Ish 사장님» — the employer app, in Korean (the prototype's),
/// Uzbek, Russian or English (P43).
class EmployerApp extends ConsumerStatefulWidget {
  const EmployerApp({super.key});

  @override
  ConsumerState<EmployerApp> createState() => _EmployerAppState();
}

class _EmployerAppState extends ConsumerState<EmployerApp> {
  @override
  void initState() {
    super.initState();
    Biz.use(ref.read(employerLanguageProvider));
    ref.listenManual(employerLanguageProvider, (previous, next) {
      Biz.use(next);
      _redrawAll();
    });
  }

  /// [Biz]'s texts hang on no inherited widget: after a language change
  /// every screen is drawn again, const parts too.
  void _redrawAll() {
    void mark(Element element) {
      element.markNeedsBuild();
      element.visitChildren(mark);
    }

    if (mounted) (context as Element).visitChildren(mark);
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(employerLanguageProvider);
    return MaterialApp.router(
      title: 'Hanguk Ish 사장님',
      debugShowCheckedModeBanner: false,
      theme: hiTheme(),
      locale: language.locale,
      supportedLocales: WorkerL10n.supportedLocales,
      localizationsDelegates: WorkerL10n.localizationsDelegates,
      routerConfig: ref.watch(employerRouterProvider),
      builder: (context, child) =>
          HiTextScaleCap(child: child ?? const SizedBox.shrink()),
    );
  }
}
