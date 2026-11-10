import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/design/typography.dart';

import '../helpers/fonts.dart';

/// Line height and baseline of one line of [text] in [style] laid out with
/// the CSS strut.
(double, double) _line(TextStyle style, {List<TextStyle> also = const [], String text = 'Ag'}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    strutStyle: hiStrut(style, also: also),
    textDirection: TextDirection.ltr,
  )..layout();
  final result = (painter.height, painter.computeDistanceToActualBaseline(TextBaseline.alphabetic));
  painter.dispose();
  return result;
}

void main() {
  setUpAll(loadHiFonts);

  test('text inherits the page body\'s line-height 1.45', () {
    expect(hiStyle(15, FontWeight.w600).height, 1.45);
    expect(hiStyle(28, FontWeight.w800, height: 1.15).height, 1.15);
  });

  test('a 15 px / 1.45 Inter line is 21.75 px with the baseline at 16 (Chrome)', () {
    final (h, b) = _line(hiStyle(15, FontWeight.w600));
    expect(h, closeTo(21.75, 0.01));
    expect(b, closeTo(16, 0.01));
  });

  test('Hangul does not grow a line with an explicit line height', () {
    final (h, b) = _line(hiStyle(15, FontWeight.w600), text: '마포구 신촌');
    expect(h, closeTo(21.75, 0.01));
    expect(b, closeTo(16, 0.01));
  });

  test('h1 28 px / 1.15: 32.2 px, baseline at 26', () {
    final (h, b) = _line(hiStyle(28, FontWeight.w800, height: 1.15));
    expect(h, closeTo(32.2, 0.01));
    expect(b, closeTo(26, 0.01));
  });

  test('monospace 20 px / 1.45: 29 px, baseline at 21', () {
    final (h, b) = _line(hiStyle(20, FontWeight.w800, family: HiFamily.mono));
    expect(h, closeTo(29, 0.01));
    expect(b, closeTo(21, 0.01));
  });

  test('a monospace run in a 15 px sentence makes the line 22.75 px', () {
    final (h, b) = _line(
      hiStyle(15, FontWeight.w600),
      also: [hiStyle(15, FontWeight.w800, family: HiFamily.mono)],
    );
    expect(h, closeTo(22.75, 0.01));
    expect(b, closeTo(16, 0.01));
  });

  test('several lines stack at the line height', () {
    final painter = TextPainter(
      text: TextSpan(text: 'a\nb\nc', style: hiStyle(15, FontWeight.w500)),
      strutStyle: hiStrut(hiStyle(15, FontWeight.w500)),
      textDirection: TextDirection.ltr,
    )..layout();
    expect(painter.height, closeTo(3 * 21.75, 0.02));
    painter.dispose();
  });
}
