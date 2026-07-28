import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';

Future<void> loadRealFonts() async {
  for (final e in <String, List<String>>{
    'Inter': ['assets/fonts/Inter-400.ttf', 'assets/fonts/Inter-700.ttf'],
    'NotoSansKR': ['assets/fonts/NotoSansKR-500.ttf'],
  }.entries) {
    final loader = FontLoader(e.key);
    for (final path in e.value) {
      loader.addFont(File(path)
          .readAsBytes()
          .then((b) => ByteData.view(Uint8List.fromList(b).buffer)));
    }
    await loader.load();
  }
}

Widget host(Widget child) => MediaQuery(
      data: const MediaQueryData(size: Size(390, 844)),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Localizations(
          locale: const Locale('en'),
          delegates: const [
            DefaultMaterialLocalizations.delegate,
            DefaultWidgetsLocalizations.delegate,
          ],
          child: Material(child: Center(child: child)),
        ),
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(loadRealFonts);

  testWidgets('SeoulFilterChip: tap near the top edge of the 44px box',
      (tester) async {
    var taps = 0;
    await tester.pumpWidget(host(SeoulFilterChip(
        label: 'General', selected: false, onTap: () => taps++)));
    final box = tester.getRect(find.byType(SeoulFilterChip));
    debugPrint('CHIP rect: $box (h=${box.height})');
    // 4px below the top edge — inside the 44px target, outside the text glyphs.
    await tester.tapAt(Offset(box.center.dx, box.top + 4));
    await tester.pump();
    debugPrint('CHIP|top-edge tap registered=${taps > 0}');
    await tester.tapAt(box.center);
    await tester.pump();
    debugPrint('CHIP|centre tap total=$taps');
  });

  testWidgets('LimeButton: tap near the top edge of the 52px box',
      (tester) async {
    var taps = 0;
    await tester.pumpWidget(host(SizedBox(
        width: 300,
        child: LimeButton(label: 'Start Practice', onPressed: () => taps++))));
    final box = tester.getRect(find.byType(LimeButton));
    debugPrint('LIME rect: $box (h=${box.height})');
    await tester.tapAt(Offset(box.center.dx, box.top + 4));
    await tester.pump();
    debugPrint('LIME|top-edge tap registered=${taps > 0}');
    await tester.tapAt(Offset(box.left + 8, box.center.dy));
    await tester.pump();
    debugPrint('LIME|left-padding tap total=$taps');
  });

  testWidgets('GlassCard(onTap): tap in the padding', (tester) async {
    var taps = 0;
    await tester.pumpWidget(host(SizedBox(
        width: 300,
        child: GlassCard(
            onTap: () => taps++,
            blur: false,
            child: const Text('Row content')))));
    final box = tester.getRect(find.byType(GlassCard));
    debugPrint('CARD rect: $box');
    await tester.tapAt(Offset(box.center.dx, box.top + 4));
    await tester.pump();
    debugPrint('CARD|padding tap registered=${taps > 0}');
  });

  testWidgets('HangulGlyphTile inside picker row is not itself tappable (n/a)',
      (tester) async {
    debugPrint('SKIP');
  });

  testWidgets('ref.read after ConsumerState dispose', (tester) async {
    debugPrint('SKIP-riverpod');
  });
}
