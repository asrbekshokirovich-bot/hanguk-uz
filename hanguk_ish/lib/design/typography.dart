import 'package:flutter/painting.dart';

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
    fontFamily: family.family,
    fontFamilyFallback: family.fallback,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: letterSpacingEm == 0 ? null : letterSpacingEm * size,
    leadingDistribution: TextLeadingDistribution.even,
    decoration: decoration,
  );
}
