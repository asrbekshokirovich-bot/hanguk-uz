// The End control must be on screen at every moment of an interview —
// connecting and mid-call — on every phone, at every OS font size.
//
// It used to be the last child of a single Column whose only slack was two
// Spacers. At large font settings on a small phone the column overflowed, and
// because End was last the whole overflow landed on it: laid out below the
// screen edge, invisible and untappable, with nothing to scroll. Pinning it
// outside the scrollable region is what this test protects.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';

/// Mirrors the live-call layout: a scrollable body of unbounded height with
/// the End control pinned beneath it.
Widget _liveCallShell({required Widget body, required Widget end}) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(
      SeoulSizes.screenPadding,
      4,
      SeoulSizes.screenPadding,
      20,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: LayoutBuilder(
            builder: (context, viewport) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: viewport.maxHeight),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [body],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        end,
      ],
    ),
  );
}

void main() {
  // The worst case the review measured: the 208px orb, a long error status,
  // the coaching banner and a hints list, all at once.
  final worstCaseBody = Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const SizedBox(height: 208, child: Placeholder()),
      const SizedBox(height: 22),
      const Text(
        'Connection interrupted: the interviewer did not respond in time. '
        'Check your network and try again.',
      ),
      const SizedBox(height: 12),
      const Text('You are using a lot of filler words — slow down.'),
      const SizedBox(height: 12),
      for (var i = 0; i < 4; i++)
        const Text('• A lifeline hint of some length'),
    ],
  );

  const sizes = <String, Size>{
    'iPhone SE 320x568': Size(320, 568),
    'small Android 360x640': Size(360, 640),
    'iPhone 13 390x844': Size(390, 844),
    'Pixel 412x915': Size(412, 915),
  };
  const scales = <double>[1.0, 1.3, 1.5, 2.0, 3.0];

  for (final entry in sizes.entries) {
    for (final scale in scales) {
      testWidgets('End control stays on screen — ${entry.key} @ ${scale}x', (
        tester,
      ) async {
        tester.view.physicalSize = entry.value;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        final endKey = GlobalKey();
        await tester.pumpWidget(
          MediaQuery(
            data: MediaQueryData(
              size: entry.value,
              textScaler: TextScaler.linear(scale),
            ),
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: MaterialApp(
                home: Scaffold(
                  body: _liveCallShell(
                    body: worstCaseBody,
                    end: SizedBox(
                      key: endKey,
                      height: SeoulSizes.buttonHeight,
                      child: const Placeholder(),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );

        // No overflow anywhere.
        expect(tester.takeException(), isNull);

        // And the control is fully inside the viewport, not merely present.
        final box = endKey.currentContext!.findRenderObject()! as RenderBox;
        final top = box.localToGlobal(Offset.zero).dy;
        final bottom = top + box.size.height;
        expect(
          top,
          greaterThanOrEqualTo(0),
          reason: 'End control pushed above the viewport',
        );
        expect(
          bottom,
          lessThanOrEqualTo(entry.value.height),
          reason:
              'End control laid out ${bottom - entry.value.height}px '
              'below the bottom edge — invisible and untappable',
        );
      });
    }
  }
}
