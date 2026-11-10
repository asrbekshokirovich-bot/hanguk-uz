import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/theme.dart';
import '../design/tokens.dart';
import '../design/widgets/backdrop.dart';
import '../features/worker/onboarding/a01_login_screen.dart';
import '../features/worker/profile/profile_screens.dart';
import '../features/worker/settings/app_language.dart';
import '../l10n/gen/worker_l10n.dart';
import 'text_scale.dart';

/// Paths of the worker app.
abstract final class WorkerRoutes {
  static const login = '/';
  static const profileName = '/profile/name';
  static const profileLanguages = '/profile/languages';
  static const profileSchedule = '/profile/schedule';
  static const home = '/home';
}

/// Routes of the worker app.
final workerRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
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
      GoRoute(
        path: WorkerRoutes.home,
        builder: (context, state) => const _HomePlaceholder(),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

/// The shift feed arrives in P3 (A03).
class _HomePlaceholder extends StatelessWidget {
  const _HomePlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(child: SizedBox.expand()),
    );
  }
}

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
