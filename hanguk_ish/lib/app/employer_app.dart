import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/theme.dart';
import '../features/employer/login/ba0_login_screen.dart';
import 'text_scale.dart';

/// Routes of the employer app.
final employerRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (context, state) => const Ba0LoginScreen()),
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
