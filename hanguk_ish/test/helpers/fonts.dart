import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

bool _loaded = false;

/// Loads the app's bundled fonts into the test engine, so rendered screens
/// show real Inter / Noto Sans KR / JetBrains Mono glyphs instead of the
/// test font's boxes. Same files and weights as pubspec.yaml.
Future<void> loadHiFonts() async {
  if (_loaded) return;
  TestWidgetsFlutterBinding.ensureInitialized();
  const families = {
    'Inter': [400, 500, 600, 700, 800, 900],
    'NotoSansKR': [400, 500, 600, 700, 800, 900],
    'JetBrainsMono': [500, 600, 700, 800],
  };
  for (final entry in families.entries) {
    final loader = FontLoader(entry.key);
    for (final weight in entry.value) {
      loader.addFont(rootBundle.load('assets/fonts/${entry.key}-$weight.ttf'));
    }
    await loader.load();
  }
  _loaded = true;
}
