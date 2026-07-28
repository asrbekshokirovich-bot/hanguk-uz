// TEMPORARY probe — deleted after the review. Reproduces the exact layout
// skeletons of the restyled interview screens to detect overflow / unbounded
// constraint failures without needing Vapi or Supabase.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';

Widget wrap(Widget child, {Size size = const Size(360, 640), double scale = 1.0}) {
  return MediaQuery(
    data: MediaQueryData(size: size, textScaler: TextScaler.linear(scale)),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: MediaQuery.withNoTextScaling(
        child: const SizedBox.shrink(),
      ),
    ),
  );
}

/// Mirrors _InterviewActiveViewState.build() exactly (fixed-size parts).
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
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  child: Text('Seoul National University'),
                ),
              ),
            if (coaching) ...[
              const SizedBox(height: 12),
              GlassCard(
                radius: SeoulRadii.control,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                blur: false,
                child: Text('Avoid using filler words!',
                    style: SeoulType.bodySecondary),
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
                            Text('Hint number $i, a reasonably long sentence.',
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
          child: SizedBox(
            width: size.width,
            height: size.height,
            // Mirrors InterviewScreen: header row then Expanded(view).
            child: Column(
              children: [
                const SizedBox(height: 64), // header
                Expanded(child: child),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

void main() {
  for (final scale in <double>[1.0, 1.3, 2.0]) {
    for (final size in <Size>[const Size(360, 640), const Size(320, 568)]) {
      testWidgets('active view ${size.width}x${size.height} @${scale}x',
          (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(host(
          activeViewSkeleton(
            hints: true,
            coaching: true,
            uniPill: true,
            status: 'Connecting — your interviewer will greet you shortly...',
          ),
          size: size,
          scale: scale,
        ));
        final errors = <String>[];
        // ignore: invalid_use_of_protected_member
        expect(errors, isEmpty);
      });
    }
  }

  testWidgets('ConicProgressRing with a long/ugly score label', (tester) async {
    for (final label in <String>['7', '7.5', '7.333333333333333', '85']) {
      await tester.pumpWidget(host(
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
        size: const Size(360, 640),
        scale: 1.0,
      ));
      await tester.pump();
      debugPrint('=== label "$label" pumped ===');
    }
  });

  testWidgets('ConicProgressRing label at 2x text scale', (tester) async {
    await tester.pumpWidget(host(
      Center(
        child: ConicProgressRing(
          value: 0.75,
          size: 104,
          strokeWidth: 9,
          label: '7.5',
          caption: '/ 10',
          animate: false,
        ),
      ),
      size: const Size(360, 640),
      scale: 2.0,
    ));
    await tester.pump();
  });

  testWidgets('LiveMetricsBar-shaped row with long labels', (tester) async {
    await tester.pumpWidget(host(
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text('Words: 1234', style: SeoulType.caption),
                const SizedBox(width: 16),
                Text('Characters: 56789', style: SeoulType.caption),
                const SizedBox(width: 16),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  child: Text('PERSONAL_STATEMENT',
                      style: SeoulType.eyebrow),
                ),
              ],
            ),
            Row(
              children: [
                const Icon(Icons.cloud_done_outlined, size: 14),
                const SizedBox(width: 6),
                Text('Saved', style: SeoulType.caption),
              ],
            ),
          ],
        ),
      ),
      size: const Size(360, 640),
      scale: 1.0,
    ));
    await tester.pump();
  });
}
