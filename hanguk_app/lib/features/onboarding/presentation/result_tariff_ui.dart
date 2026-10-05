import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../design_system/seoul_night/seoul_night_tokens.dart';
import '../../../design_system/seoul_night/seoul_night_typography.dart';

/// The design values S03, S05 and S06 share (Claude Design export, "Seoul
/// Night" onboarding board). Where a Seoul Night token holds the same value it
/// is reused; the rest are the design's own numbers.
class OnbColors {
  const OnbColors._();

  static const Color white64 = Color(0xA3FFFFFF); // rgba(255,255,255,.64)
  static const Color white85 = Color(0xD9FFFFFF); // .85
  static const Color fill = SeoulColors.glass; // .07
  static const Color border = SeoulColors.heroBorder; // .16
  static const Color cellFill = Color(0x0FFFFFFF); // .06
  static const Color divider = Color(0x1FFFFFFF); // .12
  static const Color chipFill = Color(0x1AFFFFFF); // .10
  static const Color outline = Color(0x4DFFFFFF); // .30
  static const Color chipBorder = Color(0x33FFFFFF); // .20
  static const Color green = Color(0xFF4ADE80);
  static const Color red = Color(0xFFF87171);
  static const Color amber = Color(0xFFF5C451);
  static const Color lime = SeoulColors.lime;
  static const Color ink = SeoulColors.ink;
}

/// Inter at [size]/[weight]. [height] is a CSS line-height (null = "normal");
/// [spacingEm] a CSS letter-spacing in em.
TextStyle onbText(
  double size,
  FontWeight weight, {
  Color color = Colors.white,
  double? height,
  double spacingEm = 0,
}) {
  return TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height ?? cssNormalLineHeight(size),
    letterSpacing: spacingEm * size,
    leadingDistribution: TextLeadingDistribution.even,
  );
}

/// CSS `line-height: normal` for Inter as a browser lays it out: the font's
/// ascent (0.96875em) and descent (0.2421875em), each rounded to a pixel. The
/// bundled TTF's own metrics give a taller line, so it is set explicitly.
double cssNormalLineHeight(double size) => ((size * 0.96875).round() + (size * 0.2421875).round()) / size;

/// Holds a line at Inter's height for [size] when a glyph (the "→" arrow)
/// falls back to another font, whose metrics would otherwise make it taller.
StrutStyle onbStrut(double size) => StrutStyle(
  fontFamily: SeoulType.inter,
  fontSize: size,
  height: cssNormalLineHeight(size),
  leadingDistribution: TextLeadingDistribution.even,
  forceStrutHeight: true,
);

/// A decorative hangul accent ("결과", "대학", "요금"): 12px, 700, lime.
class OnbHangulAccent extends StatelessWidget {
  const OnbHangulAccent(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Text(
        text,
        style: const TextStyle(
          fontFamily: SeoulType.korean,
          fontFamilyFallback: [SeoulType.inter],
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: OnbColors.lime,
        ),
      ),
    );
  }
}

/// The screen background: `linear-gradient(150deg, #1A3A6C 0%, #132A4D 35%,
/// #0F213D 65%, #0A0A1A 100%)`, laid out the way CSS lays out an angled
/// gradient for the box's real size.
class OnbBackground extends StatelessWidget {
  const OnbBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final w = c.maxWidth.isFinite ? c.maxWidth : 390.0;
        final h = c.maxHeight.isFinite ? c.maxHeight : 844.0;
        const a = 150 * math.pi / 180;
        final dx = math.sin(a), dy = -math.cos(a);
        final len = (w * math.sin(a)).abs() + (h * math.cos(a)).abs();
        final ex = dx * len / 2 / (w / 2), ey = dy * len / 2 / (h / 2);
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment(-ex, -ey),
              end: Alignment(ex, ey),
              colors: const [Color(0xFF1A3A6C), Color(0xFF132A4D), Color(0xFF0F213D), Color(0xFF0A0A1A)],
              stops: const [0, 0.35, 0.65, 1],
            ),
          ),
          child: child,
        );
      },
    );
  }
}

/// A Scaffold painted with [OnbBackground].
class OnbScaffold extends StatelessWidget {
  const OnbScaffold({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: OnbBackground(child: SizedBox.expand(child: child)),
    );
  }
}

/// The glass card: radius 22, rgba(255,255,255,.07), 1px rgba(255,255,255,.16).
class OnbCard extends StatelessWidget {
  const OnbCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.borderColor = OnbColors.border,
    this.fillColor = OnbColors.fill,
    this.radius = 22,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color borderColor;
  final Color fillColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor),
      ),
      child: child,
    );
  }
}

/// A plain tappable area announced as a button (the design has no ripple).
class OnbTap extends StatelessWidget {
  const OnbTap({super.key, required this.onTap, required this.child, this.label});

  final VoidCallback? onTap;
  final Widget child;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: child),
    );
  }
}

/// The lime button: 56 high, radius 16, 180deg #E2F26A→#C7E04A, 700 16px ink,
/// `0 8px 24px rgba(212,233,76,.28)`.
class OnbPrimaryButton extends StatelessWidget {
  const OnbPrimaryButton({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      onTap: onTap,
      child: Container(
        height: 56,
        width: double.infinity,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [SeoulColors.limeBright, SeoulColors.limePressed],
          ),
          boxShadow: [BoxShadow(color: Color(0x47D4E94C), blurRadius: 24, offset: Offset(0, 8))],
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: onbText(16, FontWeight.w700, color: OnbColors.ink),
        ),
      ),
    );
  }
}

/// The outlined button: 52 high, radius 16, 1px rgba(255,255,255,.3), 600 15px.
class OnbOutlineButton extends StatelessWidget {
  const OnbOutlineButton({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      onTap: onTap,
      child: Container(
        height: 52,
        width: double.infinity,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: OnbColors.outline),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: onbText(15, FontWeight.w600),
        ),
      ),
    );
  }
}

/// The 44×44 back tile with "←" (S05, S06).
class OnbBackTile extends StatelessWidget {
  const OnbBackTile({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      onTap: onTap,
      label: MaterialLocalizations.of(context).backButtonTooltip,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: OnbColors.fill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: OnbColors.border),
        ),
        child: ExcludeSemantics(
          child: Text('←', strutStyle: onbStrut(20), style: onbText(20, FontWeight.w400)),
        ),
      ),
    );
  }
}

/// A round sign badge ("+" / "−") of [size] on [color] at 16% opacity.
class OnbSignBadge extends StatelessWidget {
  const OnbSignBadge({super.key, required this.sign, required this.color, this.size = 22});

  final String sign;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color.withValues(alpha: 0.16)),
      child: Text(sign, style: onbText(16, FontWeight.w800, color: color, height: 1)),
    );
  }
}

/// Top and bottom padding of a scrolling column: the design's own padding plus
/// the device's safe area.
EdgeInsets onbScrollPadding(BuildContext context, {double top = 10, double bottom = 28}) {
  final pad = MediaQuery.paddingOf(context);
  return EdgeInsets.fromLTRB(20, pad.top + top, 20, pad.bottom + bottom);
}

/// Places [gap] between [children].
List<Widget> onbGapped(List<Widget> children, double gap) => [
  for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(height: gap), children[i]],
];
