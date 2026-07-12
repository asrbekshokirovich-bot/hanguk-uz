import 'package:flutter/material.dart';

import '../tokens/sn_gradients.dart';
import '../tokens/sn_motion.dart';

/// A linear progress bar with a lime gradient fill and a soft lime glow
/// (see `DESIGN_SPEC.md` §3 Applications, Home).
///
/// The fill animates to [value] (0–1) using [SNMotion.base]. The track
/// is a faint glass groove; the fill carries [SNGradients.limeButton]
/// plus a glow so progress reads as "active".
class GlowProgressBar extends StatelessWidget {
  const GlowProgressBar({
    super.key,
    required this.value,
    this.height = 8,
    this.trackColor = const Color(0x14FFFFFF), // white 0.08
    this.animate = true,
  });

  /// Progress in the range 0.0–1.0.
  final double value;
  final double height;
  final Color trackColor;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);
    final radius = BorderRadius.circular(height);

    return ClipRRect(
      borderRadius: radius,
      child: Container(
        height: height,
        decoration: BoxDecoration(color: trackColor, borderRadius: radius),
        child: Align(
          alignment: Alignment.centerLeft,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth * clamped;
              final fill = Container(
                width: width,
                height: height,
                decoration: BoxDecoration(
                  gradient: SNGradients.limeButton,
                  borderRadius: radius,
                  boxShadow: clamped > 0
                      ? const [
                          BoxShadow(
                            color: Color(0x66D4E94C), // lime 0.4
                            blurRadius: 10,
                            offset: Offset(0, 0),
                          ),
                        ]
                      : null,
                ),
              );
              if (!animate) return fill;
              return AnimatedContainer(
                duration: SNMotion.base,
                curve: SNMotion.easeOut,
                width: width,
                height: height,
                decoration: BoxDecoration(
                  gradient: SNGradients.limeButton,
                  borderRadius: radius,
                  boxShadow: clamped > 0
                      ? const [
                          BoxShadow(
                            color: Color(0x66D4E94C),
                            blurRadius: 10,
                          ),
                        ]
                      : null,
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
