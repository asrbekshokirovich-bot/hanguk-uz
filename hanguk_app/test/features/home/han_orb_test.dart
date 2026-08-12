// The 한 orb dial: layout guards for the open speed-dial.
//
// The dial nests an Expanded inside a Row inside an IntrinsicWidth inside a
// vertical SingleChildScrollView — the combination that throws at layout time
// if any one of them is wrong, and it only throws once the dial is open, which
// no other test opens.
//
// Note on pumping: the orb's pulse ring repeats forever, so `pumpAndSettle`
// never returns here. Every wait is an explicit `pump(duration)`.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/home/presentation/widgets/han_orb.dart';

void _noop() {}

const _labels = ['Bosh sahifa', 'Suhbatga tayyorgarlik', 'Xarita'];

List<HanOrbItem> _items() => const [
  HanOrbItem(label: 'Bosh sahifa', ko: '홈', glyph: '홈', onTap: _noop),
  HanOrbItem(
    label: 'Suhbatga tayyorgarlik',
    ko: '면접',
    glyph: '면',
    onTap: _noop,
    active: true,
  ),
  HanOrbItem(label: 'Xarita', ko: '지도', glyph: '도', onTap: _noop),
];

Future<HanOrbController> _pump(WidgetTester tester) async {
  final controller = HanOrbController();
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Stack(
          children: [
            const SizedBox.expand(),
            HanOrb(items: _items(), controller: controller),
          ],
        ),
      ),
    ),
  );
  return controller;
}

/// Open the dial and let the 300ms stagger finish.
///
/// Tapped by coordinate rather than by the 한 finder: the ✕ that cross-fades
/// in sits directly over the glyph, so a tap aimed at the text lands on the
/// icon. The same GestureDetector receives it either way — `tapAt` just skips
/// the framework's "finder was missed" warning for a hit that is correct.
Future<void> _open(WidgetTester tester) async {
  await tester.tapAt(tester.getCenter(find.text('한')));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  testWidgets('the closed orb renders', (tester) async {
    final controller = await _pump(tester);
    expect(find.text('한'), findsOneWidget);
    expect(controller.value, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('opening lays the dial out without an overflow', (tester) async {
    final controller = await _pump(tester);
    await _open(tester);

    expect(controller.value, isTrue);
    for (final label in _labels) {
      expect(find.text(label), findsOneWidget);
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('every pill takes the width of the longest label', (
    tester,
  ) async {
    await _pump(tester);
    await _open(tester);

    // One left edge down the column. Sized to their own text, "Xarita" and
    // "Suhbatga tayyorgarlik" step in and out, and a stack of seven reads as
    // scattered chips rather than a menu.
    final widths = <double>[
      for (final label in _labels)
        tester
            .getSize(
              find
                  .ancestor(
                    of: find.text(label),
                    matching: find.byType(Container),
                  )
                  .first,
            )
            .width,
    ];

    expect(widths.first, greaterThan(0));
    for (final w in widths) {
      expect(w, moreOrLessEquals(widths.first, epsilon: 0.5));
    }
  });

  testWidgets('the controller closes an open dial', (tester) async {
    final controller = await _pump(tester);
    await _open(tester);
    expect(controller.value, isTrue);

    // What the shell's PopScope calls when Android's BACK is pressed.
    controller.close();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(controller.value, isFalse);
    expect(tester.takeException(), isNull);
  });
}
