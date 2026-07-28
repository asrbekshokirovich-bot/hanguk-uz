// TEMPORARY probe — deleted after the review.
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';

Widget activeViewSkeleton({
  required bool hints,
  required bool coaching,
  required bool uniPill,
  required String status,
}) {
  return Stack(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(
          SeoulSizes.screenPadding,
          4,
          SeoulSizes.screenPadding,
          20,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (uniPill)
              Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.school, size: 16),
                    const SizedBox(width: 8),
                    Flexible(
                        child: Text('Seoul National University',
                            overflow: TextOverflow.ellipsis,
                            style: SeoulType.caption.copyWith(fontSize: 12.5))),
                  ]),
                ),
              ),
            if (coaching) ...[
              const SizedBox(height: 12),
              GlassCard(
                radius: SeoulRadii.control,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                blur: false,
                child: Row(children: [
                  const Icon(Icons.warning_amber_rounded, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text('Avoid using filler words!',
                          style: SeoulType.bodySecondary)),
                ]),
              ),
            ],
            const Spacer(),
            const Center(child: SizedBox(width: 208, height: 208)),
            const SizedBox(height: 22),
            GlassCard(
              blur: false,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: Text(status,
                  textAlign: TextAlign.center, style: SeoulType.subtitle),
            ),
            const Spacer(),
            if (hints)
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: SingleChildScrollView(
                    child: GlassCard(
                      radius: SeoulRadii.control,
                      blur: false,
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Lifeline Hints:', style: SeoulType.subtitle),
                          const SizedBox(height: 8),
                          for (var i = 0; i < 3; i++)
                            Text('Hint $i, a reasonably long sentence here.',
                                style: SeoulType.bodySecondary),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            Container(
              height: SeoulSizes.buttonHeight,
              alignment: Alignment.center,
              child: Text('End Interview', style: SeoulType.button),
            ),
          ],
        ),
      ),
    ],
  );
}

Widget host(Widget child, {required Size size, required double scale}) {
  return MediaQuery(
    data: MediaQueryData(size: size, textScaler: TextScaler.linear(scale)),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: Localizations(
        locale: const Locale('en'),
        delegates: const [
          DefaultMaterialLocalizations.delegate,
          DefaultWidgetsLocalizations.delegate,
        ],
        child: Material(
          color: SeoulColors.royalBlue,
          child: Center(
            child: SizedBox(
            width: size.width,
            height: size.height,
            child: Column(children: [
              const SizedBox(height: 64), // InterviewScreen header
              Expanded(child: child),
            ]),
          ),
          ),
        ),
      ),
    ),
  );
}

/// Pumps and reports overflow pixels (0 = clean) instead of failing.
Future<String> probe(WidgetTester tester, Widget w) async {
  final errors = <String>[];
  final prev = FlutterError.onError;
  FlutterError.onError = (d) => errors.add(d.toString());
  await tester.pumpWidget(w);
  await tester.pump();
  FlutterError.onError = prev;
  if (errors.isEmpty) return 'CLEAN';
  return errors
      .map((e) => e
          .split('\n')
          .where((l) =>
              l.contains('overflowed') ||
              l.contains('in question') ||
              l.contains('constraints:') ||
              l.contains('creator:'))
          .join(' // '))
      .join(' | ');
}

Future<void> loadRealFonts() async {
  for (final e in <String, List<String>>{
    'Inter': [
      'assets/fonts/Inter-400.ttf',
      'assets/fonts/Inter-500.ttf',
      'assets/fonts/Inter-700.ttf',
      'assets/fonts/Inter-800.ttf',
    ],
    'NotoSansKR': ['assets/fonts/NotoSansKR-500.ttf'],
  }.entries) {
    final loader = FontLoader(e.key);
    for (final path in e.value) {
      loader.addFont(File(path).readAsBytes().then(
          (b) => ByteData.view(Uint8List.fromList(b).buffer)));
    }
    await loader.load();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(loadRealFonts);
  final cases = <String, Widget Function()>{
    'bare (no pill/coach/hints), status=Connecting': () => activeViewSkeleton(
        hints: false,
        coaching: false,
        uniPill: false,
        status: 'Connecting...'),
    'pill only, long greetWait status': () => activeViewSkeleton(
        hints: false,
        coaching: false,
        uniPill: true,
        status: 'Connecting — your interviewer will greet you shortly...'),
    'pill + coaching, greetWait': () => activeViewSkeleton(
        hints: false,
        coaching: true,
        uniPill: true,
        status: 'Connecting — your interviewer will greet you shortly...'),
    'pill + hints, greetWait': () => activeViewSkeleton(
        hints: true,
        coaching: false,
        uniPill: true,
        status: 'Connecting — your interviewer will greet you shortly...'),
    'pill + coaching + hints, greetWait': () => activeViewSkeleton(
        hints: true,
        coaching: true,
        uniPill: true,
        status: 'Connecting — your interviewer will greet you shortly...'),
    'pill, long error status': () => activeViewSkeleton(
        hints: false,
        coaching: false,
        uniPill: true,
        status:
            'Connection interrupted: The interviewer did not respond. Please go back and try again.'),
  };

  for (final size in <Size>[
    const Size(412, 915),
    const Size(390, 844),
    const Size(360, 640),
    const Size(320, 568),
  ]) {
    for (final scale in <double>[1.0, 1.15, 1.3, 1.5, 2.0]) {
      for (final entry in cases.entries) {
        testWidgets(
            'ACTIVE ${size.width.toInt()}x${size.height.toInt()} @$scale ${entry.key}',
            (tester) async {
          final r =
              await probe(tester, host(entry.value(), size: size, scale: scale));
          debugPrint(
              'RESULT|${size.width.toInt()}x${size.height.toInt()}|$scale|${entry.key}|$r');
        });
      }
    }
  }

  testWidgets('RING labels', (tester) async {
    for (final label in <String>['7', '7.0', '7.5', '7.25', '10']) {
      for (final scale in <double>[1.0, 1.3, 1.5, 2.0, 3.0]) {
        final r = await probe(
          tester,
          host(
            Center(
              child: ConicProgressRing(
                value: 0.75,
                size: 104,
                strokeWidth: 9,
                label: label,
                caption: '/ 10',
                animate: false,
              ),
            ),
            size: const Size(390, 844),
            scale: scale,
          ),
        );
        debugPrint('RING|"$label"|@$scale|$r');
      }
    }
  });

  testWidgets('LIVE METRICS BAR', (tester) async {
    for (final size in <Size>[const Size(390, 844), const Size(320, 568)]) {
      for (final scale in <double>[1.0, 1.15, 1.3]) {
        final r = await probe(
          tester,
          host(
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(children: [
                      Text("So'zlar: 1234", style: SeoulType.caption),
                      const SizedBox(width: 16),
                      Text('Belgilar: 11987', style: SeoulType.caption),
                      const SizedBox(width: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        child: Text('UZBEK', style: SeoulType.eyebrow),
                      ),
                    ]),
                    Row(children: [
                      const Icon(Icons.cloud_done_outlined, size: 14),
                      const SizedBox(width: 6),
                      Text('Saqlash xatosi', style: SeoulType.caption),
                    ]),
                  ],
                ),
              ),
              const Spacer(),
            ]),
            size: size,
            scale: scale,
          ),
        );
        debugPrint('METRICS|${size.width.toInt()}|@$scale|$r');
      }
    }
  });
}
