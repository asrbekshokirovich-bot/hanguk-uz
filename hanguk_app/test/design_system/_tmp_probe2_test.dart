import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';

Future<void> loadRealFonts() async {
  for (final e in <String, List<String>>{
    'Inter': [
      'assets/fonts/Inter-400.ttf','assets/fonts/Inter-500.ttf',
      'assets/fonts/Inter-700.ttf','assets/fonts/Inter-800.ttf',
    ],
    'NotoSansKR': ['assets/fonts/NotoSansKR-500.ttf','assets/fonts/NotoSansKR-700.ttf','assets/fonts/NotoSansKR-900.ttf'],
  }.entries) {
    final loader = FontLoader(e.key);
    for (final path in e.value) {
      loader.addFont(File(path).readAsBytes().then((b) => ByteData.view(Uint8List.fromList(b).buffer)));
    }
    await loader.load();
  }
}

Widget host(Widget child, {required Size size, required double scale}) => MediaQuery(
      data: MediaQueryData(size: size, textScaler: TextScaler.linear(scale)),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Localizations(
          locale: const Locale('en'),
          delegates: const [DefaultMaterialLocalizations.delegate, DefaultWidgetsLocalizations.delegate],
          child: Material(
            color: SeoulColors.royalBlue,
            child: Center(
              child: SizedBox(
                width: size.width, height: size.height,
                child: Column(children: [const SizedBox(height: 64), Expanded(child: child)]),
              ),
            ),
          ),
        ),
      ),
    );

Future<String> probe(WidgetTester tester, Widget w) async {
  final errors = <String>[];
  final prev = FlutterError.onError;
  FlutterError.onError = (d) => errors.add(d.toString());
  await tester.pumpWidget(w);
  await tester.pump();
  FlutterError.onError = prev;
  if (errors.isEmpty) return 'CLEAN';
  return errors.map((e) => e.split('\n').where((l) => l.contains('overflowed') || l.contains('Cannot')).join(' // ')).join(' | ');
}

/// The PRE-restyle active view (git 6f4c222^) skeleton, for headroom comparison.
Widget oldSkeleton({required bool coaching, required String status}) => Stack(children: [
      Column(children: [
        Container(
          margin: const EdgeInsets.only(top: 20),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.school, size: 16),
            const SizedBox(width: 8),
            Flexible(child: Text('Seoul National University', overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.bold))),
          ]),
        ),
        if (coaching)
          Container(
            margin: const EdgeInsets.only(top: 16),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: const Text('⚠️ Avoid using filler words!', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold)),
          ),
        const Spacer(),
        const SizedBox(height: 150, width: 150),
        const SizedBox(height: 16),
        Text(status, textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.bold)),
        const Spacer(),
        Flexible(
          child: Container(
            clipBehavior: Clip.antiAlias,
            padding: const EdgeInsets.fromLTRB(24, 18, 24, 8),
            width: double.infinity,
            decoration: const BoxDecoration(color: Colors.white10),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const SizedBox(height: 8),
              Container(height: 64, width: 64, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white10)),
              const SizedBox(height: 12),
              const Text('End Interview', style: TextStyle(fontFamily: 'Inter', fontSize: 12)),
              const SizedBox(height: 8),
            ]),
          ),
        ),
      ]),
    ]);

/// _VoiceOrb shape check (Positioned with a single edge inside a Stack).
Widget orb() => Center(
      child: SizedBox(
        width: 208, height: 208,
        child: Stack(alignment: Alignment.center, children: [
          Transform.scale(scale: 1.09, child: Container(width: 208, height: 208, decoration: const BoxDecoration(shape: BoxShape.circle))),
          Container(width: 152, height: 152, alignment: Alignment.center,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: SeoulColors.glass),
              child: Text('한', style: SeoulType.hangulGlyph.copyWith(fontSize: 58, fontWeight: FontWeight.w900))),
          Positioned(
            bottom: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(color: SeoulColors.neutralFill, borderRadius: BorderRadius.circular(999)),
              child: Text('KO', style: SeoulType.eyebrow),
            ),
          ),
        ]),
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(loadRealFonts);

  for (final size in <Size>[const Size(390, 844), const Size(360, 640), const Size(320, 568)]) {
    for (final scale in <double>[1.0, 1.15, 1.3, 1.5, 2.0]) {
      testWidgets('OLD ${size.width.toInt()} @$scale coaching', (t) async {
        final r = await probe(t, host(oldSkeleton(coaching: true, status: 'Connecting — your interviewer will greet you shortly...'), size: size, scale: scale));
        debugPrint('OLD|${size.width.toInt()}x${size.height.toInt()}|$scale|coaching|$r');
      });
    }
  }

  for (final scale in <double>[1.0, 2.0, 3.0]) {
    testWidgets('ORB @$scale', (t) async {
      final r = await probe(t, host(orb(), size: const Size(390, 844), scale: scale));
      debugPrint('ORB|@$scale|$r');
    });
  }

  for (final scale in <double>[1.15, 1.3]) {
    testWidgets('METRICS390 @$scale', (t) async {
      final r = await probe(t, host(
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Row(children: [
                Text("So'zlar: 1234", style: SeoulType.caption),
                const SizedBox(width: 16),
                Text('Belgilar: 11987', style: SeoulType.caption),
                const SizedBox(width: 16),
                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), child: Text('UZBEK', style: SeoulType.eyebrow)),
              ]),
              Row(children: [
                const Icon(Icons.cloud_off_outlined, size: 14),
                const SizedBox(width: 6),
                Text('Saqlash xatosi', style: SeoulType.caption),
              ]),
            ]),
          ),
          const Spacer(),
        ]),
        size: const Size(390, 844), scale: scale));
      debugPrint('METRICS390|@$scale|$r');
    });
  }
}
