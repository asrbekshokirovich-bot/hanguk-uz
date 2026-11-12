import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/design/typography.dart';

import '../helpers/fonts.dart';

/// Baseline of one line of [text] in [style] laid out with the CSS strut.
double _baseline(TextStyle style, {List<TextStyle> also = const [], String text = 'Ag'}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    strutStyle: hiStrut(style, also: also),
    textDirection: TextDirection.ltr,
  )..layout();
  final baseline = painter.computeDistanceToActualBaseline(TextBaseline.alphabetic);
  painter.dispose();
  return baseline;
}

void main() {
  setUpAll(loadHiFonts);

  test('text inherits the page body\'s line-height 1.45', () {
    expect(hiStyle(15, FontWeight.w600).height, 1.45);
    expect(hiStyle(28, FontWeight.w800, height: 1.15).height, 1.15);
  });

  test('CSS line boxes (Chrome)', () {
    expect(hiCssLineHeight(hiStyle(15, FontWeight.w600)), closeTo(21.75, 1e-9));
    expect(hiCssLineHeight(hiStyle(28, FontWeight.w800, height: 1.15)), closeTo(32.2, 1e-9));
    expect(hiCssLineHeight(hiStyle(20, FontWeight.w800, family: HiFamily.mono)), closeTo(29, 1e-9));
    // A monospace amount inside a 15 px sentence makes its line 1 px taller.
    expect(
      hiCssLineHeight(hiStyle(15, FontWeight.w600), also: [hiStyle(15, FontWeight.w800, family: HiFamily.mono)]),
      closeTo(22.75, 1e-9),
    );
  });

  test('baselines sit where Chrome puts them', () {
    expect(_baseline(hiStyle(15, FontWeight.w600)), closeTo(16, 0.01));
    expect(_baseline(hiStyle(15, FontWeight.w600), text: '마포구 신촌'), closeTo(16, 0.01));
    expect(_baseline(hiStyle(28, FontWeight.w800, height: 1.15)), closeTo(26, 0.01));
    expect(_baseline(hiStyle(20, FontWeight.w800, family: HiFamily.mono)), closeTo(21, 0.01));
    expect(
      _baseline(hiStyle(15, FontWeight.w600), also: [hiStyle(15, FontWeight.w800, family: HiFamily.mono)]),
      closeTo(16, 0.01),
    );
  });

  testWidgets('HiText reports the unrounded CSS height, so text stacks like the prototype', (tester) async {
    final style = hiStyle(15, FontWeight.w500);
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Align(
          alignment: Alignment.topLeft,
          child: SizedBox(
            width: 300,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HiText('one', key: const ValueKey(1), style: style),
                HiText('two', key: const ValueKey(2), style: style),
                HiText('three\nfour', key: const ValueKey(3), style: style),
                HiText('end', key: const ValueKey(4), style: style),
              ],
            ),
          ),
        ),
      ),
    );
    expect(tester.getSize(find.byKey(const ValueKey(1))).height, closeTo(21.75, 0.01));
    expect(tester.getTopLeft(find.byKey(const ValueKey(2))).dy, closeTo(21.75, 0.01));
    expect(tester.getSize(find.byKey(const ValueKey(3))).height, closeTo(43.5, 0.01));
    expect(tester.getTopLeft(find.byKey(const ValueKey(4))).dy, closeTo(87, 0.01));
  });
}
