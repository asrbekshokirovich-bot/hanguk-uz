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
  screen(1.20, 0.52, 0.60),

  /// «Smena olindi!» (A05): `120% 56%`, alpha 0.6.
  success(1.20, 0.56, 0.60),

  /// The long shift detail page (A05): `120% 40%`, alpha 0.5.
  detail(1.20, 0.40, 0.50),

  /// The employer's shift page (BA3, 1 380 px): `120% 34%`, alpha 0.55.
  employerDetail(1.20, 0.34, 0.55);

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
    this.watermarkRight = -40,
    this.watermarkColor = HiColors.white07,
    required this.child,
  });

  final HiGlow glow;

  /// Korean text drawn at the right edge (`일`, `사장님`, …); null = none.
  final String? watermark;

  /// Watermark `font-size` in px.
  final double watermarkSize;

  /// Watermark `top:` / `right:` in the prototype frame.
  final double watermarkTop;
  final double watermarkRight;

  /// `rgba(255,255,255,0.07)` on entry screens, 0.08 on the feed.
  final Color watermarkColor;

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
              right: watermarkRight,
              child: ExcludeSemantics(
                child: IgnorePointer(
                  child: HiText(
                    mark,
                    maxLines: 1,
                    softWrap: false,
                    textScaler: TextScaler.noScaling,
                    style: hiStyle(
                      watermarkSize,
                      FontWeight.w900,
                      color: watermarkColor,
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

/// Navy plus the corner glow, sized to its parent — for pages whose glow
/// scrolls with long content (A05 detail).
class HiGlowLayer extends StatelessWidget {
  const HiGlowLayer({super.key, required this.glow});

  final HiGlow glow;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: HiColors.navy,
      child: CustomPaint(painter: _GlowPainter(glow), child: const SizedBox.expand()),
    );
  }
}
