import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_motion.dart';

/// A circular "conic" progress ring with a lime sweep and a soft glow
/// (see `DESIGN_SPEC.md` §3 Home Journey card, Documents collected card).
///
/// Draws a faint full-circle track and a lime [SweepGradient] arc from
/// 12 o'clock, clockwise, to [value] (0–1). [center] renders inside the
/// ring (e.g. `57%` or `3/6`). Animates on value change with
/// [SNMotion.base] when [animate] is true.
class ConicProgressRing extends StatelessWidget {
  const ConicProgressRing({
    super.key,
    required this.value,
    this.size = 96,
    this.strokeWidth = 8,
    this.center,
    this.trackColor = const Color(0x1FFFFFFF), // white 0.12
    this.animate = true,
  });

  /// Progress in the range 0.0–1.0.
  final double value;
  final double size;
  final double strokeWidth;
  final Widget? center;
  final Color trackColor;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);

    Widget ringFor(double v) => CustomPaint(
          size: Size.square(size),
          painter: _ConicRingPainter(
            value: v,
            strokeWidth: strokeWidth,
            trackColor: trackColor,
          ),
        );

    final painted = animate
        ? TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: clamped),
            duration: SNMotion.base,
            curve: SNMotion.easeOut,
            builder: (context, v, _) => ringFor(v),
          )
        : ringFor(clamped);

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          painted,
          if (center != null) center!,
        ],
      ),
    );
  }
}

class _ConicRingPainter extends CustomPainter {
  _ConicRingPainter({
    required this.value,
    required this.strokeWidth,
    required this.trackColor,
  });

  final double value;
  final double strokeWidth;
  final Color trackColor;

  static const double _start = -math.pi / 2; // 12 o'clock

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - strokeWidth) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    // Track.
    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = trackColor;
    canvas.drawCircle(center, radius, trackPaint);

    if (value <= 0) return;

    final sweep = 2 * math.pi * value;

    // Glow underlay.
    final glowPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = SNColors.lime.withValues(alpha: 0.35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    canvas.drawArc(rect, _start, sweep, false, glowPaint);

    // Lime conic sweep.
    final progressPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: 2 * math.pi,
        colors: const [SNColors.limePressed, SNColors.limeBright, SNColors.lime],
        stops: const [0.0, 0.5, 1.0],
        transform: const GradientRotation(_start),
      ).createShader(rect);
    canvas.drawArc(rect, _start, sweep, false, progressPaint);
  }

  @override
  bool shouldRepaint(_ConicRingPainter old) =>
      old.value != value ||
      old.strokeWidth != strokeWidth ||
      old.trackColor != trackColor;
}
