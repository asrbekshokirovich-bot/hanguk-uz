import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../insets.dart';
import '../tokens.dart';
import '../typography.dart';

/// The radial glow behind every screen:
/// `radial-gradient(<rx> <ry> at 0% 0%, rgba(26,63,208,a) 0%, transparent 64%)`.
enum HiGlow {
  /// Entry screens (A01, BA0): `130% 60%`, alpha 0.65.
  entry(1.30, 0.60, 0.65),

  /// Every other screen: `120% 52%`, alpha 0.6.
  screen(1.20, 0.52, 0.60);

  const HiGlow(this.radiusX, this.radiusY, this.alpha);

  /// Horizontal radius as a fraction of the screen width.
  final double radiusX;

  /// Vertical radius as a fraction of the screen height.
  final double radiusY;

  /// Opacity of the glow colour at the corner.
  final double alpha;
}

/// Navy screen background with the corner glow and an optional giant
/// translucent Korean watermark, as in the prototype.
class HiBackdrop extends StatelessWidget {
  const HiBackdrop({
    super.key,
    this.glow = HiGlow.screen,
    this.watermark,
    this.watermarkSize = 230,
    this.watermarkTop = 150,
    required this.child,
  });

  final HiGlow glow;

  /// Korean text drawn at the right edge (`일`, `사장님`, …); null = none.
  final String? watermark;

  /// Watermark `font-size` in px.
  final double watermarkSize;

  /// Watermark `top:` in the prototype frame.
  final double watermarkTop;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mark = watermark;
    return ColoredBox(
      color: HiColors.navy,
      child: Stack(
        fit: StackFit.expand,
        children: [
          CustomPaint(painter: _GlowPainter(glow)),
          if (mark != null)
            Positioned(
              top: watermarkTop + HiInsets.shift(context),
              right: -40,
              child: ExcludeSemantics(
                child: IgnorePointer(
                  child: Text(
                    mark,
                    maxLines: 1,
                    softWrap: false,
                    textScaler: TextScaler.noScaling,
                    style: hiStyle(
                      watermarkSize,
                      FontWeight.w900,
                      color: HiColors.white07,
                      height: 1,
                      family: HiFamily.korean,
                    ),
                  ),
                ),
              ),
            ),
          child,
        ],
      ),
    );
  }
}

class _GlowPainter extends CustomPainter {
  const _GlowPainter(this.glow);

  final HiGlow glow;

  @override
  void paint(Canvas canvas, Size size) {
    final rx = size.width * glow.radiusX;
    final ry = size.height * glow.radiusY;
    if (rx <= 0 || ry <= 0) return;
    final inner = HiColors.glow.withValues(alpha: glow.alpha);
    final outer = HiColors.glow.withValues(alpha: 0);
    // A unit circle scaled by (rx, ry) is the CSS ellipse; the gradient fades
    // out at 64 % of the ray and stays transparent beyond it.
    canvas
      ..save()
      ..scale(rx, ry)
      ..drawRect(
        Rect.fromLTWH(0, 0, size.width / rx, size.height / ry),
        Paint()
          ..shader = ui.Gradient.radial(
            Offset.zero,
            1,
            [inner, outer],
            const [0, 0.64],
          ),
      )
      ..restore();
  }

  @override
  bool shouldRepaint(_GlowPainter old) => old.glow != glow;
}
