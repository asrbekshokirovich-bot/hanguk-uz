import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/analytics/tracked.dart';
import '../seoul_night_tokens.dart';
import '../seoul_night_typography.dart';
import 'hard_shadow.dart';
import 'lucide.dart';

/// The full design's ("Hanguk App — Full Design") palette, on the 2026-10-15
/// prototype's dark blue page (owner: "Hanguk_Prototype", flow 5a).
///
/// Two surfaces meet here. The *page* is deep blue, so what sits directly on it
/// (titles, section labels, hints) is [onPage] / [pageMuted]. The *cards* on it
/// stay white with ink text ([ink], [muted]), a 1.5px ink border and a hard
/// ink shadow — which on the page is barely visible, as in the design.
abstract final class FdColors {
  static const Color ink = SeoulColors.ink; // #0A1A34

  /// The prototype's lime (`#CCFF00`), brighter than the legacy [SeoulColors.lime].
  static const Color lime = SeoulColors.limeFd;

  /// The legacy deep blue (`#1A3A6C`); the prototype's cards use [blue] and
  /// [blueDeep] instead.
  static const Color navy = SeoulColors.royalBlue;
  static const Color card = Colors.white;

  /// Vivid blue: the report's page, the info cards.
  static const Color blue = Color(0xFF2447D6);

  /// The count card's blue.
  static const Color blueDeep = Color(0xFF0F2690);

  /// The darkest blue: the end of a cover's gradient.
  static const Color blueNight = Color(0xFF060D2B);

  /// The page behind everything (`#0A1440`).
  static const Color page = Color(0xFF0A1440);

  /// The lighter blue the page glows with at its top left.
  static const Color pageGlow = Color(0xFF1A3FD0);

  /// Text straight on the page.
  static const Color onPage = Colors.white;

  /// The big pale hangul behind a title.
  static const Color ghost = Color(0x14FFFFFF);

  /// Text on lime, on a white card's lime parts.
  static const Color onLime = Color(0xFF16203A);

  /// Secondary text inside a white card.
  static const Color muted = Color(0xFF52627A);

  /// Icon tiles and quiet fills inside a white card.
  static const Color tint = Color(0xFFE3EAF6);

  /// The empty segments of a meter on blue.
  static const Color deep = Color(0xFF0F213D);

  static const Color good = Color(0xFF16A34A);
  static const Color warn = Color(0xFFF59E0B);
  static const Color bad = Color(0xFFDC2626);

  /// "Xususiy" next to a city.
  static const Color privateBlue = Color(0xFF2E5FA8);

  /// Secondary text on a blue card.
  static const Color onNavyMuted = Color(0xFFD6DEEC);

  /// Page-level secondary text (the design's `--mut` on the page).
  static const Color pageMuted = Color(0xFFAEB8D6);

  /// Page-level hairlines (the design's 1.5px ink rules).
  static const Color pageRule = ink;

  /// The bottom nav's top rule.
  static const Color navRule = Color(0x2EFFFFFF);
}

/// Selection on a white field: the app theme's lime handles and highlight
/// all but vanish on white, so a light field uses blue ones and an ink caret.
const TextSelectionThemeData kLightFieldSelection = TextSelectionThemeData(
  cursorColor: FdColors.ink,
  selectionColor: Color(0x552447D6),
  selectionHandleColor: FdColors.blue,
);

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

/// A word the prototype marks with a lime chip: the whole word on lime, in
/// ink, with rounded corners ("Qanday universitet [kerak?]"). [style] sets the
/// size and weight; the colour is always the ink on lime.
class LimeMark extends StatelessWidget {
  const LimeMark(this.text, {super.key, required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(8)),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Text(text, style: style.copyWith(color: FdColors.onLime)),
    ),
  );
}

/// The design's page: deep blue with a lighter glow at the top left
/// (`radial-gradient(ellipse 90% 60% at 20% 0%, #1A3FD0, transparent 70%)` on
/// `#0A1440`), light status-bar icons. [solid] swaps it for one flat colour:
/// the splash and the report are plain blue.
class FdPage extends StatelessWidget {
  const FdPage({super.key, required this.child, this.solid});

  final Widget child;
  final Color? solid;

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
    child: solid != null
        ? ColoredBox(color: solid!, child: child)
        : CustomPaint(painter: const _PageGlow(), child: child),
  );
}

class _PageGlow extends CustomPainter {
  const _PageGlow();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = FdColors.page);
    // An ellipse 90% of the width by 60% of the height, centred 20% across the
    // top edge: a unit circle scaled to it.
    final rx = size.width * 0.9;
    final ry = size.height * 0.6;
    canvas.save();
    canvas.translate(size.width * 0.2, 0);
    canvas.scale(rx, ry);
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [FdColors.pageGlow, FdColors.pageGlow.withValues(alpha: 0)],
        stops: const [0, 0.7],
      ).createShader(Rect.fromCircle(center: Offset.zero, radius: 1));
    canvas.drawRect(Rect.fromLTWH(-size.width * 0.2 / rx, 0, size.width / rx, size.height / ry), paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_PageGlow old) => false;
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
        onTap: tracked('fd_kit.hard_icon_button', onTap),
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
        onTap: tracked('fd_kit.hard_choice', onTap),
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
    final label = Text(text, style: fdText(14, FontWeight.w800, FdColors.onPage));
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

/// The design's sticky bottom bar: an ink rule, then the primary button, then
/// the home-indicator gap. [aboveNav] drops that gap and the side room: the
/// bottom nav under it already stands clear of the home indicator.
class FdBottomBar extends StatelessWidget {
  const FdBottomBar({super.key, required this.child, this.aboveNav = false});

  final Widget child;
  final bool aboveNav;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.paddingOf(context).bottom;
    return DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: FdColors.pageRule, width: 1.5)),
      ),
      child: Padding(
        padding: aboveNav
            ? const EdgeInsets.fromLTRB(18, 10, 18, 12)
            : EdgeInsets.fromLTRB(16, 12, 16, inset > 0 ? inset : 16),
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
  Widget build(BuildContext context) => HardButton(label: label, onPressed: tracked('fd_kit.fd_primary_button', onPressed), loading: loading);
}

/// A 1.5px dashed pill outline (`border: 1.5px dashed`).
class DashedPillPainter extends CustomPainter {
  const DashedPillPainter({required this.color, this.radius});

  final Color color;

  /// Null for a full pill.
  final double? radius;

  @override
  void paint(Canvas canvas, Size size) {
    final r = radius ?? size.height / 2;
    final rect = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(r)).deflate(0.75);
    final path = Path()..addRRect(rect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, d + 4), paint);
        d += 7;
      }
    }
  }

  @override
  bool shouldRepaint(DashedPillPainter old) => old.color != color || old.radius != radius;
}

/// The prototype's segmented switch: a white pill holding the options, the
/// picked one lime with an ink border.
class FdSegments extends StatelessWidget {
  const FdSegments({super.key, required this.labels, required this.selected, required this.onSelect});

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Semantics(
                button: true,
                selected: i == selected,
                label: labels[i],
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: tracked('fd_kit.fd_segments_select', () => onSelect(i), props: {'value': i}),
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedContainer(
                    duration: SeoulMotion.fast,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: i == selected ? FdColors.lime : Colors.transparent,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: i == selected ? FdColors.ink : Colors.transparent, width: 1.5),
                    ),
                    child: Text(
                      labels[i],
                      style: fdText(12, FontWeight.w800, i == selected ? FdColors.onLime : FdColors.muted),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
