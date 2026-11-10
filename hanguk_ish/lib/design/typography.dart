import 'package:flutter/widgets.dart';

/// Font families bundled in `assets/fonts` (see pubspec.yaml).
abstract final class HiFonts {
  static const inter = 'Inter';
  static const korean = 'NotoSansKR';
  static const mono = 'JetBrainsMono';
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
  mono(HiFonts.mono, [HiFonts.inter, HiFonts.korean]);

  const HiFamily(this.family, this.fallback);

  final String family;
  final List<String> fallback;
}

/// A text style written the way the prototype's CSS is.
///
/// [size] is `font-size` in px, [height] is a unitless CSS `line-height`
/// (null = `normal`), [letterSpacingEm] is `letter-spacing` in em.
/// Leading is split evenly above and below the glyphs, as CSS does, so a
/// line sits at the same place as in the prototype.
///
/// The style does not inherit: Material's default text style (M3 body: 1.43
/// line height, 0.25 px letter spacing) would otherwise fill every property
/// left unset here, widening text and changing `line-height: normal` lines.
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
    height: height,
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

/// Whether [text] has glyphs that Inter lacks and Noto Sans KR supplies
/// (Hangul, CJK punctuation, ₩) — they make the browser use Noto's taller
/// metrics for a `line-height: normal` line.
bool _usesKoreanFallback(String text) {
  for (final r in text.runes) {
    if ((r >= 0xAC00 && r <= 0xD7A3) ||
        (r >= 0x1100 && r <= 0x11FF) ||
        (r >= 0x3000 && r <= 0x303F) ||
        (r >= 0x3130 && r <= 0x318F) ||
        r == 0x20A9) {
      return true;
    }
  }
  return false;
}

/// The line box the prototype's browser gives [text] in [style].
///
/// * Explicit `line-height`: CSS sizes the line from the element's first font
///   only (Inter for body text), even where glyphs come from a fallback font;
///   Flutter would grow it to Noto Sans KR's taller metrics.
/// * `line-height: normal` (no [TextStyle.height]): Chrome rounds each font's
///   ascent and descent to whole pixels and the line takes the largest of
///   each, so a 15 px Inter line is 19 px tall, not 18.16.
///
/// A forced strut of the font whose ascent wins, stretched evenly to that
/// height, puts every line and baseline within a fraction of a pixel of the
/// browser's, so stacked text does not drift from the prototype.
StrutStyle hiStrut(TextStyle style, [String text = '']) {
  final size = style.fontSize ?? 14;
  final family = style.fontFamily ?? HiFonts.inter;
  final height = style.height;
  if (height != null) {
    return StrutStyle(
      fontFamily: family,
      fontSize: size,
      fontWeight: style.fontWeight,
      height: height,
      leadingDistribution: TextLeadingDistribution.even,
      forceStrutHeight: true,
    );
  }
  final (a, d) = _fontMetrics[family] ?? _fontMetrics[HiFonts.inter]!;
  var ascent = (a * size).roundToDouble();
  var descent = (d * size).roundToDouble();
  var strutFamily = family;
  if (family != HiFonts.korean && _usesKoreanFallback(text)) {
    final (ka, kd) = _fontMetrics[HiFonts.korean]!;
    final koreanAscent = (ka * size).roundToDouble();
    final koreanDescent = (kd * size).roundToDouble();
    if (koreanAscent >= ascent) {
      ascent = koreanAscent;
      strutFamily = HiFonts.korean;
    }
    if (koreanDescent > descent) descent = koreanDescent;
  }
  return StrutStyle(
    fontFamily: strutFamily,
    fontSize: size,
    fontWeight: style.fontWeight,
    height: (ascent + descent) / size,
    leadingDistribution: TextLeadingDistribution.even,
    forceStrutHeight: true,
  );
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
      strutStyle: hiStrut(style, data),
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
      softWrap: softWrap,
      textScaler: textScaler,
    );
  }
}
