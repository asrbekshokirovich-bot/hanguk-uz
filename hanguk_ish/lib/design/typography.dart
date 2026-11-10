import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Font families bundled in `assets/fonts` (see pubspec.yaml).
abstract final class HiFonts {
  static const inter = 'Inter';
  static const korean = 'NotoSansKR';
  static const mono = 'JetBrainsMono';

  /// The ₩ glyph the browser takes from DejaVu Sans Mono for monospace text.
  static const wonSign = 'HiWonSign';
}

/// The prototype's three `font-family` stacks.
enum HiFamily {
  /// `'Inter','Noto Sans KR',system-ui,sans-serif` — body text everywhere.
  /// Inter has no Hangul and no ₩, so those glyphs come from Noto Sans KR,
  /// exactly as in the browser.
  inter(HiFonts.inter, [HiFonts.korean]),

  /// `'Noto Sans KR','Inter',sans-serif` — Korean-first elements (the brand
  /// tile, watermarks, the 한국어 button).
  korean(HiFonts.korean, [HiFonts.inter]),

  /// `'JetBrains Mono',ui-monospace,monospace` — numbers, times, money.
  /// JetBrains Mono has no ₩; the browser's monospace fallback draws it.
  mono(HiFonts.mono, [HiFonts.wonSign, HiFonts.inter, HiFonts.korean]);

  const HiFamily(this.family, this.fallback);

  final String family;
  final List<String> fallback;
}

/// The `line-height` every prototype screen inherits from the page body
/// (`body{font-size:15px;line-height:1.45}`): text without its own
/// `line-height` uses it, not `normal`.
const double hiInheritedLineHeight = 1.45;

/// A text style written the way the prototype's CSS is.
///
/// [size] is `font-size` in px, [height] is a unitless CSS `line-height`
/// (null = the inherited [hiInheritedLineHeight]), [letterSpacingEm] is
/// `letter-spacing` in em. Leading is split evenly above and below the
/// glyphs, as CSS does, so a line sits at the same place as in the prototype.
///
/// The style does not inherit: Material's default text style (M3 body: 1.43
/// line height, 0.25 px letter spacing) would otherwise fill every property
/// left unset here and widen the text.
TextStyle hiStyle(
  double size,
  FontWeight weight, {
  Color? color,
  double? height,
  double letterSpacingEm = 0,
  HiFamily family = HiFamily.inter,
  TextDecoration? decoration,
}) {
  return TextStyle(
    inherit: false,
    fontFamily: family.family,
    fontFamilyFallback: family.fallback,
    fontSize: size,
    fontWeight: weight,
    fontStyle: FontStyle.normal,
    color: color ?? const Color(0xFFFFFFFF),
    height: height ?? hiInheritedLineHeight,
    letterSpacing: letterSpacingEm * size,
    wordSpacing: 0,
    textBaseline: TextBaseline.alphabetic,
    leadingDistribution: TextLeadingDistribution.even,
    decoration: decoration ?? TextDecoration.none,
  );
}

/// Vertical metrics (hhea ascent, descent in em) of the bundled fonts.
const _fontMetrics = <String, (double, double)>{
  HiFonts.inter: (1984 / 2048, 494 / 2048),
  HiFonts.korean: (1.160, 0.288),
  HiFonts.mono: (1.020, 0.300),
};

/// The line box the prototype's browser gives text in [style].
///
/// CSS sizes a line from the element's first font only (Inter for body
/// text), even where glyphs come from a fallback font; Flutter would grow it
/// to Noto Sans KR's taller metrics. Chrome also rounds that font's ascent
/// and descent to whole pixels and floors the leading above the text, so the
/// baseline of a 15 px / 1.45 line is 16 px from its top, not 16.33.
///
/// Flutter puts the baseline of an evenly led strut at `(L + (a − d)·s)/2`
/// for a strut of size `s`, so a forced strut whose size is solved for
/// Chrome's baseline gives the same line height and the same baseline:
/// stacked text does not drift from the prototype.
StrutStyle hiStrut(TextStyle style, {List<TextStyle> also = const []}) {
  final size = style.fontSize ?? 15;
  final family = style.fontFamily ?? HiFonts.inter;
  final (a, d) = _fontMetrics[family] ?? _fontMetrics[HiFonts.inter]!;
  var (lineHeight, baseline) = _cssLine(style);
  // Inline runs in other fonts (a monospace amount in a sentence) can push
  // the line box up or down, as their own boxes do in CSS.
  for (final other in also) {
    final (h, b) = _cssLine(other);
    final above = math.max(baseline, b);
    final below = math.max(lineHeight - baseline, h - b);
    baseline = above;
    lineHeight = above + below;
  }
  final strutSize = 2 * (baseline - lineHeight / 2) / (a - d);
  if (strutSize <= 0) {
    return StrutStyle(
      fontFamily: family,
      fontSize: size,
      fontWeight: style.fontWeight,
      height: lineHeight / size,
      leadingDistribution: TextLeadingDistribution.even,
      forceStrutHeight: true,
    );
  }
  return StrutStyle(
    fontFamily: family,
    fontSize: strutSize,
    fontWeight: style.fontWeight,
    height: lineHeight / strutSize,
    leadingDistribution: TextLeadingDistribution.even,
    forceStrutHeight: true,
  );
}

/// Chrome's line box for [style]: its height and the baseline's distance
/// from its top.
(double, double) _cssLine(TextStyle style) {
  final size = style.fontSize ?? 15;
  final family = style.fontFamily ?? HiFonts.inter;
  final factor = style.height ?? hiInheritedLineHeight;
  final (a, d) = _fontMetrics[family] ?? _fontMetrics[HiFonts.inter]!;
  final lineHeight = factor * size;
  final ascent = (a * size).roundToDouble();
  final descent = (d * size).roundToDouble();
  final leadingAbove = ((lineHeight - ascent - descent) / 2 + 1e-6).floorToDouble();
  return (lineHeight, leadingAbove + ascent);
}

/// [Text] with the CSS line box of [hiStrut].
class HiText extends StatelessWidget {
  const HiText(
    this.data, {
    super.key,
    required this.style,
    this.textAlign,
    this.maxLines,
    this.overflow,
    this.softWrap,
    this.textScaler,
  });

  final String data;
  final TextStyle style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;
  final bool? softWrap;
  final TextScaler? textScaler;

  @override
  Widget build(BuildContext context) {
    return Text(
      data,
      style: style,
      strutStyle: hiStrut(style),
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
      softWrap: softWrap,
      textScaler: textScaler,
    );
  }
}
