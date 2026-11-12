import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/backend/backend.dart';
import '../data/backend/overrides.dart';
import '../design/theme.dart';
import '../features/employer/language.dart';
import '../features/worker/settings/app_language.dart';
import 'flavor.dart';
import 'language_store.dart';

/// Shared start-up of both apps: edge-to-edge navy screens in portrait, and
/// the Hanguk Ish database when the build names one (`BackendConfig`);
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
  try {
    final prefs = await SharedPreferences.getInstance();
    overrides.add(languageStoreProvider.overrideWithValue(PrefsLanguageStore(prefs)));
  } on Object {
    // Kept for the session.
  }
  if (flavor == Flavor.employer) {
    overrides.add(employerDefaultLanguageProvider.overrideWithValue(
      employerLanguageFor(WidgetsBinding.instance.platformDispatcher.locales),
    ));
  }
  if (backend.isConfigured) {
    await Supabase.initialize(
      url: backend.url,
      publishableKey: backend.publishableKey,
      postgrestOptions: ishPostgrestOptions,
    );
    overrides.addAll(backendOverrides(backend, Supabase.instance.client));
  }
  runApp(ProviderScope(overrides: overrides, child: app));
}
