import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/analytics/app_events.dart';
import 'core/analytics/http_tracking.dart';
import 'core/analytics/identity_links.dart';
import 'core/analytics/tracked.dart';
import 'core/money/fx_rates.dart';
import 'core/push/guest_push.dart';
import 'core/router/app_router.dart';
import 'design_system/theme/app_theme.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/presentation/widgets/sign_in_chrome.dart';
import 'features/entry/data/entry_store.dart';
import 'features/map/data/map_repository.dart';
import 'features/uni_db/data/fcm_token_source.dart';
import 'features/uni_db/data/notification_service.dart';
import 'features/uni_db/data/push_token_bootstrap.dart';
import 'features/updater/presentation/update_gate.dart';
import 'l10n/app_localizations.dart';

@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await persistBackgroundNotification(message);
}

Future<void> main() async {
  AppEvents.launching();
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

  // Initialize Firebase for push notifications.
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  } catch (e) {
    debugPrint('Firebase init error: $e');
  }

  // The language picked on the first screen and whether this phone has signed
  // up, known before the first frame (the splash tagline and the router both
  // use it). Local secure storage only — no network.
  EntryStore.initial = await EntryStore.load();

  // Yesterday's bank rates for fees in won, before the first frame; today's
  // are asked for once the app is up (FxRates).
  await FxRates.loadSaved();

  // Show a splash while Supabase initializes — prevents ANR on slow emulators
  runApp(const _SplashApp());

  try {
    await Supabase.initialize(
      // Calls to the backend that fail or are slow go to the analytics.
      httpClient: TrackingHttpClient(),
      url: 'https://lysjdtyanhdfphqyijsr.supabase.co',
      anonKey:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTUxMDYsImV4cCI6MjA4ODQzMTEwNn0.p-WlK-r4xqRk63N6zc_8JCIV53FVmjwAcqK7Lx25GJs',
    );
  } catch (e) {
    debugPrint('Supabase init error (offline mode): $e');
  }

  // Usage events (what is opened and pressed; see AppEvents).
  AppEvents.setLanguage(EntryStore.initial.languageCode);
  await AppEvents.start();
  AppEvents.installErrorHooks();
  AppEvents.track('app_open', props: {'signed_in': _signedIn(), 'cold': true});
  // An operator's link the app was installed through (Android) or opened
  // with (the web): tie this phone to the lead.
  unawaited(IdentityLinks.checkInstallReferrer());
  unawaited(IdentityLinks.checkWebLink());

  // Warm the Map tab's institutions query as soon as Supabase is ready,
  // instead of waiting for the user to open the tab. The Map screen also
  // has to load the Kakao Maps SDK from a foreign CDN, so overlapping that
  // wait with this one (rather than doing them back-to-back) cuts the
  // perceived "Map is slow to open" delay roughly in half.
  final container = ProviderContainer();

  // Initialize notification service with the Riverpod container so incoming
  // push notifications are persisted to the local notification history.
  try {
    await initNotificationService(container: container);
  } catch (e) {
    debugPrint('Notification service init error: $e');
  }

  unawaited(() async {
    try {
      await container.read(universitiesProvider.future);
    } catch (_) {
      // Swallowed on purpose — MapTab's own FutureProvider watch surfaces
      // the real error (with a Retry button) once the user opens the tab.
    }
  }());

  runApp(
    UncontrolledProviderScope(container: container, child: const HangukApp()),
  );
  WidgetsBinding.instance.addPostFrameCallback((_) => AppEvents.ready());
  unawaited(FxRates.refreshAndRebuild());
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
        body: SignInBackdrop(child: SplashContent()),
      ),
    );
  }
}

class HangukApp extends ConsumerWidget {
  const HangukApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goRouter = ref.watch(appRouterProvider);
    // The language chosen in the app; the phone's own until one is chosen.
    final locale = ref.watch(entryProvider.select((s) => s.locale));

    // Wire FCM token source and start listening to auth-state changes.
    // The chosen language goes with the token, so pushes arrive in it.
    ref
        .read(pushTokenBootstrapProvider)
        .setTokenSource(
          () => fcmTokenSource(languageCode: locale?.languageCode),
        );
    // A guest who allowed pushes keeps a current token in the app's language.
    unawaited(GuestPush.refresh(locale?.languageCode));

    return MaterialApp.router(
      title: 'Hanguk Student App',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.materialTheme,
      routerConfig: goRouter,
      locale: locale,
      builder: (context, child) {
        // Auto-update gate runs on launch + every foreground transition,
        // so updates aren't gated behind the login screen anymore.
        final wrapped = UpdateGate(child: child ?? const SizedBox.shrink());
        // Every tap and scroll, for the analytics (AppEvents).
        return AnalyticsRoot(child: wrapped);
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

bool _signedIn() {
  try {
    return isClientSession(Supabase.instance.client.auth.currentSession);
  } catch (_) {
    return false;
  }
}
