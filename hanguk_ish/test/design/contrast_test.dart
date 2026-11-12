import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/design/tokens.dart';

/// WCAG 2.x contrast ratio of two opaque colours.
double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final (hi, lo) = la > lb ? (la, lb) : (lb, la);
  return (hi + 0.05) / (lo + 0.05);
}

/// The prototype's text and icon colours on the backgrounds they sit on:
/// body text needs 4.5:1 (WCAG AA), icons and other graphics 3:1.
void main() {
  const text = <(String, Color, Color)>[
    ('white on navy', HiColors.white, HiColors.navy),
    ('textSoft on navy', HiColors.textSoft, HiColors.navy),
    ('textMuted on navy', HiColors.textMuted, HiColors.navy),
    ('lime on navy', HiColors.lime, HiColors.navy),
    ('ink on white', HiColors.ink, HiColors.white),
    ('inkMuted on white', HiColors.inkMuted, HiColors.white),
    ('ink on surface', HiColors.ink, HiColors.surface),
    ('inkMuted on surface', HiColors.inkMuted, HiColors.surface),
    ('onLime on lime', HiColors.onLime, HiColors.lime),
    ('ink on lime', HiColors.ink, HiColors.lime),
    ('redInk on redSoft', HiColors.redInk, HiColors.redSoft),
    ('greenInk on greenSoft', HiColors.greenInk, HiColors.greenSoft),
    ('ink on amberSoft', HiColors.ink, HiColors.amberSoft),
    ('white on blue', HiColors.white, HiColors.blue),
    ('textSoft on blue', HiColors.textSoft, HiColors.blue),
    ('white on blueDeep', HiColors.white, HiColors.blueDeep),
  ];
  for (final (name, fg, bg) in text) {
    test('text: $name ≥ 4.5', () => expect(contrast(fg, bg), greaterThanOrEqualTo(4.5)));
  }

  const graphics = <(String, Color, Color)>[
    ('green icon on greenSoft (A12 confirmed / paid)', Color(0xFF15803D), HiColors.greenSoft),
    ('green logo on mint (retail)', Color(0xFF15803D), Color(0xFFD9F2E1)),
    ('red icon on redSoft', HiColors.redInk, HiColors.redSoft),
  ];
  for (final (name, fg, bg) in graphics) {
    test('graphic: $name ≥ 3', () => expect(contrast(fg, bg), greaterThanOrEqualTo(3)));
  }
}
