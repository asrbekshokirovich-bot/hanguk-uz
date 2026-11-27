import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/time/clock.dart';
import '../data/backend/backend.dart';
import '../data/backend/firebase_push_service.dart';
import '../data/backend/overrides.dart';
import '../data/demo/demo_account.dart';
import '../data/demo/demo_employer.dart';
import '../data/demo/demo_offers.dart';
import '../data/demo/demo_shifts.dart';
import '../data/repositories/account_repository.dart';
import '../data/repositories/employer_repository.dart';
import '../data/repositories/offer_repository.dart';
import '../data/repositories/push_service.dart';
import '../data/repositories/shift_repository.dart';
import '../design/theme.dart';
import '../features/employer/language.dart';
import '../features/worker/map/native_kakao_map.dart';
import '../features/worker/settings/app_language.dart';
import '../features/worker/telegram/pending_referral.dart';
import '../features/worker/telegram/telegram_sign_in.dart';
import '../features/worker/telegram/telegram_web_app.dart';
import 'flavor.dart';
import 'language_store.dart';

/// Shared start-up of both apps: edge-to-edge navy screens in portrait, and
/// the HanPyol database when the build names one (`BackendConfig`);
/// otherwise the demo data.
Future<void> bootstrap(Flavor flavor, Widget app) async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(HiSystemUi.onNavy);
  await SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.portraitUp,
  ]);
  const backend = BackendConfig.fromEnvironment;
  final overrides = <Override>[flavorProvider.overrideWithValue(flavor)];
  // The language chosen before; without the device store, this launch
  // only. The employer app starts in the phone's language when it speaks it,
  // else Korean (P43).
  // The web build inside Telegram (the mini app); null on phones.
  final telegram = kIsWeb ? telegramWebApp() : null;
  telegram?.ready();
  SharedPreferences? prefs;
  try {
    prefs = await SharedPreferences.getInstance();
    final store = PrefsLanguageStore(prefs);
    // The mini app's first launch speaks the person's Telegram language.
    if (telegram != null && store.load() == null) {
      final language = AppLanguage.values.where((l) => l.code == telegram.languageCode).firstOrNull;
      if (language != null) await store.save(language);
    }
    overrides.add(languageStoreProvider.overrideWithValue(store));
    if (kIsWeb) {
      // An invite link: ?ref=<code> (the bot's button) or ?startapp=<code>.
      final pending = PendingReferral(prefs);
      await pending.remember(Uri.base.queryParameters['ref'] ?? telegram?.startParam);
      overrides.add(pendingReferralProvider.overrideWithValue(pending));
    }
  } on Object {
    // Kept for the session.
  }
  if (flavor == Flavor.employer) {
    overrides.add(employerDefaultLanguageProvider.overrideWithValue(
      employerLanguageFor(WidgetsBinding.instance.platformDispatcher.locales),
    ));
    // First launch: the owner chooses the language before anything else.
    overrides.add(employerAskLanguageProvider.overrideWithValue(
      prefs == null || PrefsLanguageStore(prefs).load() == null,
    ));
  }
  if (backend.isConfigured) {
    await Supabase.initialize(
      url: backend.url,
      publishableKey: backend.publishableKey,
      postgrestOptions: ishPostgrestOptions,
    );
    overrides.addAll(backendOverrides(backend, Supabase.instance.client));
    if (kIsWeb) {
      // The mini app: no phone pushes; Telegram signs the person in.
      if (telegram != null) {
        overrides.add(telegramSignInProvider.overrideWithValue(TelegramSignIn(Supabase.instance.client, telegram)));
      }
    } else {
      // P56: pushes, when the build carries the Firebase configuration
      // (android/app/google-services.json); without it, none.
      overrides.add(pushServiceProvider.overrideWithValue(FirebasePushService(prefs: prefs)));
    }
  } else {
    // The emulator smoke test runs the demo at a set hour (ish-smoke.yml).
    final clock = demoClockAt(const String.fromEnvironment('ISH_DEMO_KST'));
    if (clock != null) {
      final now = clock();
      final account = DemoAccountRepository(now: now, offers: true);
      overrides.addAll([
        clockProvider.overrideWithValue(clock),
        shiftRepositoryProvider.overrideWithValue(DemoShiftRepository(now: now, clock: clock, offers: true)),
        accountRepositoryProvider.overrideWithValue(account),
        offerRepositoryProvider.overrideWithValue(DemoOfferRepository(now: now, clock: clock, account: account)),
        employerRepositoryProvider.overrideWithValue(DemoEmployerRepository(now: now, clock: clock)),
      ]);
    }
  }
  // A04's native Kakao map (when the build has the Native app key).
  if (flavor == Flavor.worker && !kIsWeb) await initKakaoNativeMap();
  runApp(ProviderScope(overrides: overrides, child: app));
}
