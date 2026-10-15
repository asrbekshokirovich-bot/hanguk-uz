import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';

/// The prototype's "VIZA D-2" half-dial: red, amber and green arcs, a lime
/// needle that swings to [percent] (0 at the far left, 100 at the far
/// right), the figure under it and a word. With no [percent] — the
/// assessment is still unanswered — the needle is left out and "?%" asks to
/// be tapped. Sits on [FdColors.blueDeep].
class VisaGauge extends StatelessWidget {
  const VisaGauge({super.key, required this.percent});

  final int? percent;

  static const double width = 118;
  static const double dialHeight = 62;

  /// "yuqori" from 70, "o'rta" from 40, "past" below.
  static String word(AppLocalizations l, int percent) => percent >= 70
      ? l.fdGaugeHigh
      : percent >= 40
      ? l.fdGaugeMid
      : l.fdGaugeLow;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final p = percent;
    return SizedBox(
      width: width,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Lucide(LucideIcons.plane, size: 14, color: FdColors.lime),
              const SizedBox(width: 5),
              Text(
                l.fdBoardVisaTitle,
                style: fdText(11, FontWeight.w800, FdColors.lime, letterSpacing: 0.88),
              ),
            ],
          ),
          const SizedBox(height: 3),
          SizedBox(
            width: width,
            height: dialHeight,
            child: Stack(
              children: [
                Positioned.fill(
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(end: p == null ? -1 : p.toDouble()),
                    duration: const Duration(milliseconds: 700),
                    curve: const Cubic(0.3, 1.4, 0.4, 1),
                    builder: (context, v, _) => CustomPaint(painter: _DialPainter(value: v, hasNeedle: p != null)),
                  ),
                ),
                Positioned(
                  left: 2,
                  bottom: 2,
                  child: Text(l.fdGaugeLow, style: fdText(7, FontWeight.w800, const Color(0xFFFCA5A5), height: 1)),
                ),
                Positioned(
                  right: 2,
                  bottom: 2,
                  child: Text(l.fdGaugeHigh, style: fdText(7, FontWeight.w800, const Color(0xFF86EFAC), height: 1)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text(p == null ? '?%' : '$p%', style: fdText(22, FontWeight.w800, FdColors.lime, height: 1)),
          const SizedBox(height: 1),
          p == null
              ? Text(
                  l.fdBoardVisaAsk,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(9, FontWeight.w700, FdColors.onNavyMuted),
                )
              : Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: l.fdBoardVisaSub),
                      TextSpan(
                        text: word(l, p),
                        style: const TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(9, FontWeight.w700, FdColors.onNavyMuted),
                ),
        ],
      ),
    );
  }
}

class _DialPainter extends CustomPainter {
  const _DialPainter({required this.value, required this.hasNeedle});

  /// 0–100 (the needle's place).
  final double value;
  final bool hasNeedle;

  @override
  void paint(Canvas canvas, Size size) {
    const ring = 15.0;
    const outer = 59.0;
    final c = const Offset(outer, outer);
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    final rect = Rect.fromCircle(center: c, radius: outer - ring / 2);
    Paint arc(Color color) => Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = ring
      ..strokeCap = StrokeCap.butt;
    double rad(double deg) => deg * math.pi / 180;
    // Red 0–54°, amber 54–126°, green 126–180°, from the far left clockwise.
    canvas.drawArc(rect, math.pi, rad(54), false, arc(FdColors.bad));
    canvas.drawArc(rect, math.pi + rad(54), rad(72), false, arc(FdColors.warn));
    canvas.drawArc(rect, math.pi + rad(126), rad(54), false, arc(FdColors.good));
    // The pivot is on the bottom edge, in the middle.
    final pivot = Offset(size.width / 2, size.height);
    if (hasNeedle) {
      canvas.save();
      canvas.translate(pivot.dx, pivot.dy);
      canvas.rotate(rad(-90 + value * 1.8));
      canvas.drawRRect(
        RRect.fromRectAndRadius(const Rect.fromLTWH(-1.5, -52, 3, 52), const Radius.circular(2)),
        Paint()..color = FdColors.lime,
      );
      canvas.restore();
    }
    canvas.drawCircle(pivot, 7, Paint()..color = hasNeedle ? FdColors.lime : FdColors.onNavyMuted);
    canvas.drawCircle(
      pivot,
      6.25,
      Paint()
        ..color = FdColors.ink
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_DialPainter old) => old.value != value || old.hasNeedle != hasNeedle;
}
