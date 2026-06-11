import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/router/app_router.dart';
import 'design_system/theme/app_theme.dart';
import 'features/uni_db/data/push_token_bootstrap.dart';
import 'features/updater/presentation/update_gate.dart';
import 'l10n/app_localizations.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Crash reporting (P1 #15 from store_readiness audit). DSN supplied
  // via --dart-define=SENTRY_DSN=...; if empty the SDK no-ops cleanly.
  const sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');
  if (sentryDsn.isNotEmpty) {
    await SentryFlutter.init((options) {
      options.dsn = sentryDsn;
      options.tracesSampleRate = 0.1;
    });
  }

  // Show a splash while Supabase initializes — prevents ANR on slow emulators
  runApp(const _SplashApp());

  try {
    await Supabase.initialize(
      url: 'https://lysjdtyanhdfphqyijsr.supabase.co',
      anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTUxMDYsImV4cCI6MjA4ODQzMTEwNn0.p-WlK-r4xqRk63N6zc_8JCIV53FVmjwAcqK7Lx25GJs',
    );
  } catch (e) {
    debugPrint('Supabase init error (offline mode): $e');
  }

  runApp(const ProviderScope(child: HangukApp()));
}

/// Lightweight splash shown while Supabase initialises (prevents ANR).
class _SplashApp extends StatelessWidget {
  const _SplashApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.materialTheme,
      home: const Scaffold(
        backgroundColor: Color(0xFF0A0A1A),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.all(Radius.circular(20)),
                // Splash logo is decorative; the loading indicator below
                // is what conveys state to assistive tech.
                child: Image(
                  image: AssetImage('assets/images/app_icon.png'),
                  width: 80,
                  height: 80,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                ),
              ),
              SizedBox(height: 24),
              // Brand lime as the active/loading accent (was off-brand #6C63FF).
              CircularProgressIndicator(color: Color(0xFFD4E94C)),
            ],
          ),
        ),
      ),
    );
  }
}

class HangukApp extends ConsumerWidget {
  const HangukApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goRouter = ref.watch(appRouterProvider);

    // Read once so the bootstrap subscribes to auth-state changes.
    // Without this, the provider stays cold and tokens never register.
    // The provider is no-op until a PushTokenSource is configured (after
    // a Firebase / APNs / VAPID SDK is wired into the app).
    ref.read(pushTokenBootstrapProvider);

    return MaterialApp.router(
      title: 'Hanguk Student App',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.materialTheme,
      routerConfig: goRouter,
      builder: (context, child) {
        // Auto-update gate runs on launch + every foreground transition,
        // so updates aren't gated behind the login screen anymore.
        final wrapped = UpdateGate(child: child ?? const SizedBox.shrink());
        return wrapped;
      },
      // Audit L1/L3 closure 2026-05-10: full flutter_localizations wiring.
      // Non-English ARB files seeded with English placeholders + a
      // `TODO: translate` marker so a translator can fill them in
      // later without blocking the wiring.
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
