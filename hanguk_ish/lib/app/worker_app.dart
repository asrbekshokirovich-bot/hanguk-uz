import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/theme.dart';
import '../features/worker/onboarding/a01_login_screen.dart';
import '../features/worker/settings/app_language.dart';
import '../l10n/gen/worker_l10n.dart';
import 'text_scale.dart';

/// Routes of the worker app.
final workerRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (context, state) => const A01LoginScreen()),
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
