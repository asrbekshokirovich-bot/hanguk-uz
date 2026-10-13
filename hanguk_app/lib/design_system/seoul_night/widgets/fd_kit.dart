import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';
import '../seoul_night_typography.dart';
import 'hard_shadow.dart';
import 'lucide.dart';

/// The full design's ("Hanguk App — Full Design") palette. The design draws
/// on a light page; the app keeps its navy backdrop (owner, 2026-10-12), so
/// the page-level text that the design sets in ink is white here, and
/// everything inside a white card keeps the design's colours exactly.
abstract final class FdColors {
  static const Color ink = SeoulColors.ink; // #0A1A34
  static const Color lime = SeoulColors.lime; // #D4E94C
  static const Color navy = SeoulColors.royalBlue; // #1A3A6C
  static const Color card = Colors.white;

  /// Text on lime, on a white card's lime parts.
  static const Color onLime = Color(0xFF16203A);

  /// Secondary text inside a white card.
  static const Color muted = Color(0xFF52627A);

  /// Icon tiles and quiet fills inside a white card.
  static const Color tint = Color(0xFFE3EAF6);

  /// The empty segments of a meter on navy.
  static const Color deep = Color(0xFF0F213D);

  static const Color good = Color(0xFF16A34A);
  static const Color warn = Color(0xFFF59E0B);
  static const Color bad = Color(0xFFDC2626);

  /// "Xususiy" next to a city.
  static const Color privateBlue = Color(0xFF2E5FA8);

  /// Secondary text on a navy card.
  static const Color onNavyMuted = Color(0xFFD6DEEC);

  /// Page-level secondary text: the design's #52627A, read on the navy
  /// backdrop.
  static const Color pageMuted = Color(0xFFA9B7CE);

  /// Page-level hairlines (the design's 1.5px ink rules).
  static const Color pageRule = Color(0x2EFFFFFF);
}

/// Inter at the design's size and weight. [height] defaults to CSS
/// `line-height: normal`.
TextStyle fdText(
  double size,
  FontWeight weight,
  Color color, {
  double height = 1.21,
  double letterSpacing = 0,
}) => TextStyle(
  fontFamily: SeoulType.inter,
  fontFamilyFallback: const [SeoulType.korean, ...SeoulType.fallback],
  fontSize: size,
  fontWeight: weight,
  height: height,
  leadingDistribution: TextLeadingDistribution.even,
  letterSpacing: letterSpacing,
  color: color,
);

/// A word the design marks with its lime highlighter
/// (`linear-gradient(transparent 55%, #D4E94C 55%)`). On the navy page the
/// highlighter would sit under white text and wash it out, so the word is set
/// in lime instead — the way screen 02 marks "tanlang".
class LimeMark extends StatelessWidget {
  const LimeMark(this.text, {super.key, required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) => Text(text, style: style.copyWith(color: FdColors.lime));
}

/// A square hard-shadow button holding one icon: the 36px back button, the
/// 48px filter button, the share button.
class HardIconButton extends StatelessWidget {
  const HardIconButton({
    super.key,
    required this.glyph,
    required this.onTap,
    required this.semanticLabel,
    this.size = 36,
    this.radius = 11,
    this.iconSize = 16,
    this.fill = FdColors.card,
    this.iconColor = FdColors.ink,
    this.shadow = 0,
  });

  final LucideGlyph glyph;
  final VoidCallback? onTap;
  final String semanticLabel;
  final double size;
  final double radius;
  final double iconSize;
  final Color fill;
  final Color iconColor;

  /// The hard shadow's offset; 0 draws none (the design's back buttons).
  final double shadow;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox.square(
          dimension: size,
          child: HardShadowBox(
            fill: fill,
            radius: radius,
            offset: shadow,
            child: Center(child: Lucide(glyph, size: iconSize, color: iconColor)),
          ),
        ),
      ),
    );
  }
}

/// One choice of a group (a filter tile, a city chip, a degree, a TOPIK
/// level): white with an ink border, lime with a 2px hard shadow when picked.
class HardChoice extends StatelessWidget {
  const HardChoice({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.height = 40,
    this.radius = 12,
    this.fontSize = 13,
    this.fontWeight = FontWeight.w700,
    this.glyph,
    this.padding = EdgeInsets.zero,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final double? height;
  final double radius;
  final double fontSize;
  final FontWeight fontWeight;

  /// An icon above the label (the Yo'nalish tiles).
  final LucideGlyph? glyph;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? FdColors.onLime : FdColors.ink;
    final text = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: TextAlign.center,
      style: fdText(fontSize, fontWeight, fg),
    );
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: SeoulMotion.fast,
          height: height,
          padding: padding,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? FdColors.lime : FdColors.card,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: selected ? const [BoxShadow(color: FdColors.ink, offset: Offset(2, 2))] : null,
          ),
          child: glyph == null
              ? text
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Lucide(glyph!, size: 20, color: fg),
                    const SizedBox(height: 5),
                    text,
                  ],
                ),
        ),
      ),
    );
  }
}

/// The section label above a group of choices ("Yo'nalish", "Shahar").
class FdSectionLabel extends StatelessWidget {
  const FdSectionLabel(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final label = Text(text, style: fdText(13, FontWeight.w800, Colors.white));
    if (trailing == null) return label;
    return Row(children: [Expanded(child: label), trailing!]);
  }
}

/// The lime value tag beside a section label ("₩2 mln gacha", "4.2").
class LimeTag extends StatelessWidget {
  const LimeTag(this.text, {super.key, this.fontSize = 13});

  final String text;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: fdText(fontSize, FontWeight.w800, FdColors.onLime)),
    );
  }
}

/// The design's sticky bottom bar: a rule, then the primary button, then the
/// home-indicator gap.
class FdBottomBar extends StatelessWidget {
  const FdBottomBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.paddingOf(context).bottom;
    return DecoratedBox(
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: FdColors.pageRule, width: 1.5))),
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 12, 16, inset > 0 ? inset : 16),
        child: child,
      ),
    );
  }
}

/// The ink-and-lime primary button at the design's 52px height.
class FdPrimaryButton extends StatelessWidget {
  const FdPrimaryButton({super.key, required this.label, required this.onPressed, this.loading = false});

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) => HardButton(label: label, onPressed: onPressed, loading: loading);
}
