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

/// The line box CSS gives text with an explicit `line-height`.
///
/// CSS sizes such a line from the element's first font only (Inter for body
/// text), even where glyphs come from a fallback font; Flutter would grow the
/// line to fit Noto Sans KR's taller metrics, moving every Korean line ~1.5 px
/// down. A forced strut built from the same style restores the CSS line box.
/// Null when the style has no explicit height (CSS `line-height: normal`,
/// where both engines already agree).
StrutStyle? hiStrut(TextStyle style) {
  final height = style.height;
  if (height == null) return null;
  return StrutStyle(
    fontFamily: style.fontFamily,
    fontFamilyFallback: style.fontFamilyFallback,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    height: height,
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
      strutStyle: hiStrut(style),
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
      softWrap: softWrap,
      textScaler: textScaler,
    );
  }
}
