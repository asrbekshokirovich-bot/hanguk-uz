import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/backend/backend.dart';
import '../data/backend/overrides.dart';
import '../design/theme.dart';
import 'flavor.dart';

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
  if (backend.isConfigured) {
    await Supabase.initialize(url: backend.url, anonKey: backend.anonKey);
    overrides.addAll(backendOverrides(backend, Supabase.instance.client));
  }
  runApp(ProviderScope(overrides: overrides, child: app));
}
