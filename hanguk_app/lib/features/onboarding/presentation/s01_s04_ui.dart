import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/svg_path_icon.dart';

/// Shared pieces of the S01, S02 and S04 designs ("Imkoniyatni baholash
/// oqimi"). Values are the design's own CSS values; where they coincide with
/// a Seoul Night token the token is used.
class OnbColors {
  const OnbColors._();

  static const Color lime = SeoulColors.lime;
  static const Color limeTop = SeoulColors.limeBright; // #E2F26A
  static const Color limeBottom = SeoulColors.limePressed; // #C7E04A
  static const Color ink = SeoulColors.ink; // #0A1A34

  /// rgba(255,255,255,.64) — secondary text.
  static const Color text64 = Color.fromRGBO(255, 255, 255, .64);

  /// rgba(255,255,255,.4) — placeholders, disabled text, idle radio ring.
  static const Color text40 = Color.fromRGBO(255, 255, 255, .4);

  /// rgba(255,255,255,.07) — glass fill.
  static const Color glass = SeoulColors.glass;

  /// rgba(255,255,255,.16) — glass hairline.
  static const Color line = SeoulColors.heroBorder;

  /// rgba(255,255,255,.3) — outline button border, sheet handle.
  static const Color line30 = Color.fromRGBO(255, 255, 255, .3);

  static const Color error = Color(0xFFF87171);
  static const Color amber = Color(0xFFF5C451);
  static const Color green = Color(0xFF4ADE80);
}

/// CSS `blur` of a box-shadow as a Flutter [BoxShadow.blurRadius]: CSS blurs
/// with sigma = blur / 2, Flutter with sigma = radius * 0.57735 + 0.5.
double cssBlur(double blur) => (blur / 2 - 0.5) / 0.57735;

/// `0 8px 24px rgba(212,233,76,.28)` under the lime buttons.
final List<BoxShadow> onbLimeShadow = [
  BoxShadow(
    color: const Color.fromRGBO(212, 233, 76, .28),
    offset: const Offset(0, 8),
    blurRadius: cssBlur(24),
  ),
];

/// `linear-gradient(180deg,#E2F26A,#C7E04A)`.
const LinearGradient onbLimeGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [OnbColors.limeTop, OnbColors.limeBottom],
);

/// A CSS `linear-gradient(<deg>, …)` for a box of [size]: CSS sizes the
/// gradient line so the corners get the end colours, which in Flutter means
/// alignments beyond ±1 on a non-square box.
LinearGradient cssLinearGradient(
  double degrees,
  Size size, {
  required List<Color> colors,
  List<double>? stops,
}) {
  final rad = degrees * math.pi / 180;
  final dx = math.sin(rad);
  final dy = -math.cos(rad);
  if (size.width <= 0 || size.height <= 0) {
    return LinearGradient(colors: colors, stops: stops);
  }
  final half = ((size.width * dx).abs() + (size.height * dy).abs()) / 2;
  final ax = dx * half / (size.width / 2);
  final ay = dy * half / (size.height / 2);
  return LinearGradient(
    begin: Alignment(-ax, -ay),
    end: Alignment(ax, ay),
    colors: colors,
    stops: stops,
  );
}

/// The screens' background:
/// `linear-gradient(150deg,#1A3A6C 0%,#132A4D 35%,#0F213D 65%,#0A0A1A 100%)`.
class OnbBackground extends StatelessWidget {
  const OnbBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: cssLinearGradient(
            150,
            c.biggest,
            colors: const [
              Color(0xFF1A3A6C),
              Color(0xFF132A4D),
              Color(0xFF0F213D),
              Color(0xFF0A0A1A),
            ],
            stops: const [0, .35, .65, 1],
          ),
        ),
        child: child,
      ),
    );
  }
}

/// CSS `line-height: normal` for Inter: (hhea ascender + descender) / upm =
/// (1984 + 494) / 2048. Set explicitly because Flutter's own "normal" is
/// platform-dependent (some backends take the taller usWin metrics, 1.43).
const double kCssNormalLineHeight = 2478 / 2048;

/// [kCssNormalLineHeight] as the browser lays it out at [size]: ascent and
/// descent are each rounded to whole pixels.
double cssNormalLineHeight(double size) =>
    ((1984 / 2048 * size).roundToDouble() +
        (494 / 2048 * size).roundToDouble()) /
    size;

/// Inter at the design's size/weight. [height] is the CSS line-height
/// (null = `normal`); half-leading is split evenly, as CSS does.
TextStyle onbText(
  double size,
  FontWeight weight, {
  Color color = Colors.white,
  double? height,
  double? letterSpacingEm,
}) {
  return TextStyle(
    fontFamily: SeoulType.inter,
    fontFamilyFallback: SeoulType.fallback,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height ?? cssNormalLineHeight(size),
    // Explicit 0, never inherited: Material's body styles carry tracking.
    letterSpacing: (letterSpacingEm ?? 0) * size,
    wordSpacing: 0,
    leadingDistribution: TextLeadingDistribution.even,
  );
}

/// The decorative hangul accents (유학 진단, 한국어): 12px, 700, lime.
TextStyle onbHangul({double letterSpacingEm = 0}) => TextStyle(
  fontFamily: SeoulType.korean,
  fontFamilyFallback: const [SeoulType.inter],
  fontSize: 12,
  fontWeight: FontWeight.w700,
  color: OnbColors.lime,
  letterSpacing: letterSpacingEm * 12,
  leadingDistribution: TextLeadingDistribution.even,
);

/// A tappable area without Material ink — the design has no press effect.
class OnbTap extends StatelessWidget {
  const OnbTap({
    super.key,
    required this.child,
    this.onTap,
    this.label,
    this.selected,
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? label;
  final bool? selected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onTap != null,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: child,
      ),
    );
  }
}

/// The lime CTA: 56px, radius 16, 180deg lime gradient, ink 700 16px, lime
/// shadow. Disabled (`onPressed == null`, not [loading]) it is the S02
/// passive look: rgba(255,255,255,.1) fill, .4 text, no shadow.
class OnbPrimaryButton extends StatelessWidget {
  const OnbPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final on = onPressed != null || loading;
    return OnbTap(
      label: label,
      onTap: loading ? null : onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: on ? onbLimeGradient : null,
          color: on ? null : const Color.fromRGBO(255, 255, 255, .1),
          boxShadow: on ? onbLimeShadow : const [],
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: OnbColors.ink,
                ),
              )
            : Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: onbText(
                  16,
                  FontWeight.w700,
                  color: on ? OnbColors.ink : OnbColors.text40,
                ),
              ),
      ),
    );
  }
}

/// The secondary button: 52px, radius 16, 1px rgba(255,255,255,.3) border,
/// transparent, white 600 15px.
class OnbOutlineButton extends StatelessWidget {
  const OnbOutlineButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      label: label,
      onTap: onPressed,
      child: Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: OnbColors.line30),
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

/// Scrollable column that fills the screen when the content is shorter, so
/// `Spacer`s inside behave like the design's `flex:1` gaps.
class OnbFillScroll extends StatelessWidget {
  const OnbFillScroll({super.key, required this.padding, required this.child});

  final EdgeInsets padding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) => SingleChildScrollView(
        padding: padding,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: math.max(0, c.maxHeight - padding.vertical),
          ),
          child: IntrinsicHeight(child: child),
        ),
      ),
    );
  }
}

/// The bottom sheet's shape (S04): radius 30 on top,
/// `linear-gradient(180deg,#1B3766,#0F213D)`, and a 1px rgba(255,255,255,.16)
/// top border that thins out round the corners, as CSS draws `border-top`.
class OnbSheetSurface extends StatelessWidget {
  const OnbSheetSurface({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _SheetPainter(), child: child);
  }
}

class _SheetPainter extends CustomPainter {
  static const double _r = 30;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final outer = RRect.fromRectAndCorners(
      rect,
      topLeft: const Radius.circular(_r),
      topRight: const Radius.circular(_r),
    );
    canvas.drawRRect(
      outer,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1B3766), Color(0xFF0F213D)],
        ).createShader(rect),
    );
    final inner = RRect.fromRectAndCorners(
      Rect.fromLTRB(0, 1, size.width, size.height),
      topLeft: const Radius.elliptical(_r, _r - 1),
      topRight: const Radius.elliptical(_r, _r - 1),
    );
    canvas.drawDRRect(outer, inner, Paint()..color = OnbColors.line);
  }

  @override
  bool shouldRepaint(_SheetPainter oldDelegate) => false;
}

/// The sheet's grab handle: 40×5, rgba(255,255,255,.3).
class OnbSheetHandle extends StatelessWidget {
  const OnbSheetHandle({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 40,
        height: 5,
        decoration: BoxDecoration(
          color: OnbColors.line30,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }
}

/// Opens a sheet in the S04 style (scrim rgba(5,8,16,.62), [OnbSheetSurface],
/// handle, padding 12 20 34, 16px gaps).
Future<T?> showOnbSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: false,
    backgroundColor: Colors.transparent,
    elevation: 0,
    barrierColor: const Color.fromRGBO(5, 8, 16, .62),
    builder: (sheetContext) {
      final mq = MediaQuery.of(sheetContext);
      return Padding(
        padding: EdgeInsets.only(
          top: mq.padding.top + 24,
          bottom: mq.viewInsets.bottom,
        ),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: OnbSheetSurface(
            child: SingleChildScrollView(
              // 12 + the 1px top border the surface paints.
              padding: EdgeInsets.fromLTRB(
                20,
                13,
                20,
                math.max(34, mq.viewPadding.bottom),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const OnbSheetHandle(),
                  const SizedBox(height: 16),
                  builder(sheetContext),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}

/// The back arrow glyph (←) of the 44px back tile, drawn — the bundled Inter
/// subset has no U+2190.
class OnbBackArrow extends StatelessWidget {
  const OnbBackArrow({super.key});

  @override
  Widget build(BuildContext context) {
    return const SvgPathIcon(
      paths: ['M19 12H5', 'M11 6l-6 6 6 6'],
      size: 20,
      color: Colors.white,
      strokeWidth: 2,
    );
  }
}
