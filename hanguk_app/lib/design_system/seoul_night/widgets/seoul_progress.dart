import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';
import '../seoul_night_typography.dart';

/// A thin track with a lime gradient fill and a soft glow — the progress bar
/// on application cards (DESIGN_SPEC §3.4).
class GlowProgressBar extends StatelessWidget {
  const GlowProgressBar({
    super.key,
    required this.value,
    this.height = 6,
    this.animate = true,
  });

  /// 0.0–1.0. Values outside the range are clamped.
  final double value;

  final double height;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final v = value.clamp(0.0, 1.0);

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final fillW = maxW * v;

        Widget fill = Container(
          width: fillW,
          height: height,
          decoration: BoxDecoration(
            gradient: SeoulGradients.limeButton,
            borderRadius: BorderRadius.circular(999),
            boxShadow: v > 0 ? SeoulShadows.limeGlowSmall : null,
          ),
        );

        if (animate) {
          fill = TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: fillW),
            duration: SeoulMotion.base,
            curve: SeoulMotion.smooth,
            builder: (context, w, _) => Container(
              width: w,
              height: height,
              decoration: BoxDecoration(
                gradient: SeoulGradients.limeButton,
                borderRadius: BorderRadius.circular(999),
                boxShadow: w > 0 ? SeoulShadows.limeGlowSmall : null,
              ),
            ),
          );
        }

        return Container(
          height: height,
          decoration: BoxDecoration(
            color: SeoulColors.neutralFill,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Align(alignment: Alignment.centerLeft, child: fill),
        );
      },
    );
  }
}

/// The circular progress ring on hero cards: "Step 4 of 7", "3/6 collected"
/// (DESIGN_SPEC §3.3 / §3.6).
///
/// [label] and [caption] render stacked in the middle.
class ConicProgressRing extends StatelessWidget {
  const ConicProgressRing({
    super.key,
    required this.value,
    this.size = 92,
    this.strokeWidth = 8,
    this.label,
    this.caption,
    this.animate = true,
  });

  /// 0.0–1.0.
  final double value;

  final double size;
  final double strokeWidth;

  /// Big centred text, e.g. '57%' or '3/6'.
  final String? label;

  /// Small text under the label.
  final String? caption;

  final bool animate;

  @override
  Widget build(BuildContext context) {
    final v = value.clamp(0.0, 1.0);

    // No `size:` — CustomPaint ignores it when a child is present; the
    // SizedBox below defines the layout size.
    Widget ring(double t) => CustomPaint(
      painter: _RingPainter(value: t, strokeWidth: strokeWidth),
      child: SizedBox(
        width: size,
        height: size,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (label != null)
                Text(
                  label!,
                  style: SeoulType.title.copyWith(
                    fontSize: size * 0.24,
                    height: 1.1,
                  ),
                ),
              if (caption != null) ...[
                const SizedBox(height: 2),
                Text(
                  caption!,
                  textAlign: TextAlign.center,
                  style: SeoulType.caption.copyWith(fontSize: size * 0.115),
                ),
              ],
            ],
          ),
        ),
      ),
    );

    if (!animate) return ring(v);

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: v),
      duration: SeoulMotion.base,
      curve: SeoulMotion.smooth,
      builder: (context, t, _) => ring(t),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.value, required this.strokeWidth});

  final double value;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = (math.min(size.width, size.height) - strokeWidth) / 2;

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = SeoulColors.neutralFill;

    canvas.drawCircle(center, radius, track);

    if (value <= 0) return;

    // Start at 12 o'clock and sweep clockwise.
    const start = -math.pi / 2;
    final sweep = 2 * math.pi * value;
    final arcRect = Rect.fromCircle(center: center, radius: radius);

    final progress = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..shader = const SweepGradient(
        startAngle: 0,
        endAngle: 2 * math.pi,
        colors: [SeoulColors.limeBright, SeoulColors.limePressed],
        transform: GradientRotation(-math.pi / 2),
      ).createShader(arcRect);

    // Glow pass underneath, then the crisp arc on top.
    final glow = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = SeoulColors.lime.withValues(alpha: 0.35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);

    canvas.drawArc(arcRect, start, sweep, false, glow);
    canvas.drawArc(arcRect, start, sweep, false, progress);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) =>
      old.value != value || old.strokeWidth != strokeWidth;
}
