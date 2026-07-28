import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_motion.dart';
import '../tokens/sn_shadows.dart';
import '../tokens/sn_typography.dart';

/// The donut progress ring on the Home journey card and the Documents
/// collected card (DESIGN_SPEC.md §3.3, §3.6).
///
/// Reproduces
/// `conic-gradient(#D4E94C 0% p, rgba(255,255,255,0.14) p 100%)`
/// with a `0 0 24px rgba(212,233,76,0.35)` halo. The CSS is a *hard-stop*
/// conic gradient, i.e. two flat arcs rather than a blend — so this is
/// painted as two [Canvas.drawArc] calls, not a [SweepGradient].
///
/// Sweeps clockwise from 12 o'clock and animates to a new [value] over
/// [SnMotion.base].
class ConicProgressRing extends StatelessWidget {
  const ConicProgressRing({
    super.key,
    required this.value,
    this.size = 88,
    this.strokeWidth = 8,
    this.child,
    this.showPercentLabel = true,
    this.glow = true,
    this.semanticLabel,
  });

  /// 0.0–1.0, clamped.
  final double value;

  final double size;
  final double strokeWidth;

  /// Centre content. Defaults to the percentage when
  /// [showPercentLabel] is true; pass a widget to override (e.g. `3/6`).
  final Widget? child;

  final bool showPercentLabel;
  final bool glow;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);

    Widget? centre = child;
    if (centre == null && showPercentLabel) {
      centre = Text(
        '${(clamped * 100).round()}%',
        style: SnType.inter(size: size * 0.22, weight: 800),
      );
    }

    return Semantics(
      label: semanticLabel,
      value: '${(clamped * 100).round()}%',
      child: SizedBox(
        width: size,
        height: size,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: clamped),
          duration: SnMotion.base,
          curve: SnMotion.ease,
          builder: (context, animated, _) {
            return DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: glow && animated > 0 ? SnShadows.ringGlow : null,
              ),
              child: CustomPaint(
                // Explicit size so the ring still paints when there is
                // no centre child to derive it from.
                size: Size.square(size),
                painter: _ConicRingPainter(
                  value: animated,
                  strokeWidth: strokeWidth,
                ),
                child: centre == null
                    ? null
                    : Center(child: ExcludeSemantics(child: centre)),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ConicRingPainter extends CustomPainter {
  const _ConicRingPainter({required this.value, required this.strokeWidth});

  final double value;
  final double strokeWidth;

  /// `rgba(255,255,255,0.14)` — the unfilled arc.
  static const Color _track = Color(0x24FFFFFF);

  /// 12 o'clock. Canvas angles start at 3 o'clock and run clockwise.
  static const double _startAngle = -math.pi / 2;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(
      center: size.center(Offset.zero),
      radius: (size.shortestSide - strokeWidth) / 2,
    );

    final track = Paint()
      ..color = _track
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    final fill = Paint()
      ..color = SnColors.lime
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(rect, _startAngle, math.pi * 2, false, track);

    if (value > 0) {
      canvas.drawArc(rect, _startAngle, math.pi * 2 * value, false, fill);
    }
  }

  @override
  bool shouldRepaint(_ConicRingPainter old) =>
      old.value != value || old.strokeWidth != strokeWidth;
}
