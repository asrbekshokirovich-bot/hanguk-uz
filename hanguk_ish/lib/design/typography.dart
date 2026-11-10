import 'dart:math' as math;

import 'package:flutter/rendering.dart';
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

/// The CSS line box height of [style] (plus inline runs in [also]).
double hiCssLineHeight(TextStyle style, {List<TextStyle> also = const []}) {
  var (lineHeight, baseline) = _cssLine(style);
  for (final other in also) {
    final (h, b) = _cssLine(other);
    final above = math.max(baseline, b);
    final below = math.max(lineHeight - baseline, h - b);
    baseline = above;
    lineHeight = above + below;
  }
  return lineHeight;
}

/// Flutter rounds every line of a paragraph to whole pixels; CSS keeps the
/// fraction (a 15 px / 1.45 line is 21.75 px, not 22). This reports the CSS
/// height of a paragraph whose lines are all [lineHeight] tall, so text
/// stacked down a screen lands where the prototype has it. The glyphs stay
/// where they are; only the box the next widget is placed after shrinks or
/// grows by the rounding.
class HiCssLines extends SingleChildRenderObjectWidget {
  const HiCssLines({super.key, required this.lineHeight, super.child});

  /// The unrounded line height, in logical pixels (text scale included).
  final double lineHeight;

  @override
  RenderObject createRenderObject(BuildContext context) => RenderHiCssLines(lineHeight);

  @override
  void updateRenderObject(BuildContext context, RenderHiCssLines renderObject) {
    renderObject.lineHeight = lineHeight;
  }
}

/// Render object of [HiCssLines].
class RenderHiCssLines extends RenderProxyBox {
  RenderHiCssLines(this._lineHeight);

  double _lineHeight;

  set lineHeight(double value) {
    if (value == _lineHeight) return;
    _lineHeight = value;
    markNeedsLayout();
  }

  double _css(double height) {
    final rounded = _lineHeight.roundToDouble();
    if (rounded <= 0 || height <= 0) return height;
    final lines = (height / rounded).round();
    if (lines <= 0 || (lines * rounded - height).abs() > 0.5) return height;
    return lines * _lineHeight;
  }

  @override
  void performLayout() {
    final child = this.child;
    if (child == null) {
      size = constraints.smallest;
      return;
    }
    child.layout(constraints, parentUsesSize: true);
    size = constraints.constrain(Size(child.size.width, _css(child.size.height)));
  }

  @override
  Size computeDryLayout(BoxConstraints constraints) {
    final child = this.child;
    if (child == null) return constraints.smallest;
    final childSize = child.getDryLayout(constraints);
    return constraints.constrain(Size(childSize.width, _css(childSize.height)));
  }

  @override
  double computeMinIntrinsicHeight(double width) => _css(super.computeMinIntrinsicHeight(width));

  @override
  double computeMaxIntrinsicHeight(double width) => _css(super.computeMaxIntrinsicHeight(width));
}

/// The CSS line height of [style] at the text scale of [context].
double _scaledLineHeight(BuildContext context, TextStyle style, TextScaler? textScaler, List<TextStyle> also) {
  final size = style.fontSize ?? 15;
  final scaler = textScaler ?? MediaQuery.textScalerOf(context);
  return hiCssLineHeight(style, also: also) * scaler.scale(size) / size;
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
    return HiCssLines(
      lineHeight: _scaledLineHeight(context, style, textScaler, const []),
      child: Text(
        data,
        style: style,
        strutStyle: hiStrut(style),
        textAlign: textAlign,
        maxLines: maxLines,
        overflow: overflow,
        softWrap: softWrap,
        textScaler: textScaler,
      ),
    );
  }
}

/// Rich text (runs in other weights or fonts) with the CSS line box of its
/// base [style] and the inline runs in [also].
class HiRichText extends StatelessWidget {
  const HiRichText(
    this.span, {
    super.key,
    required this.style,
    this.also = const [],
    this.textAlign,
    this.maxLines,
    this.overflow,
  });

  final InlineSpan span;
  final TextStyle style;
  final List<TextStyle> also;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;

  @override
  Widget build(BuildContext context) {
    return HiCssLines(
      lineHeight: _scaledLineHeight(context, style, null, also),
      child: Text.rich(
        TextSpan(style: style, children: [span]),
        strutStyle: hiStrut(style, also: also),
        textAlign: textAlign,
        maxLines: maxLines,
        overflow: overflow,
      ),
    );
  }
}
