import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_shadows.dart';
import '../tokens/sn_typography.dart';

/// The premium centrepiece surface (see `DESIGN_SPEC.md` §1 Surfaces).
///
/// [SNGradients.heroCard] fill, 1px [SNColors.heroBorder], radius 22–24,
/// deep [SNShadows.hero] plus an inset top highlight. Optionally paints
/// a lime radial glow blob (top-right) and a faint 한국 watermark.
///
/// Layer order (bottom → top): gradient → lime glow → watermark → inset
/// highlight → [child].
class HeroCard extends StatelessWidget {
  const HeroCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.borderRadius = SNRadii.brXl,
    this.limeGlow = true,
    this.watermark = '한국',
    this.onTap,
    this.width,
    this.height,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius borderRadius;

  /// Paint the lime radial glow blob in the top-right.
  final bool limeGlow;

  /// Faint hangul watermark (bottom-right). Null / empty hides it.
  final String? watermark;

  final VoidCallback? onTap;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: SNShadows.hero,
      ),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            gradient: SNGradients.heroCard,
            borderRadius: borderRadius,
            border: Border.all(color: SNColors.heroBorder, width: 1),
          ),
          child: Stack(
            children: [
              // Lime radial glow blob, top-right.
              if (limeGlow)
                Positioned(
                  right: -40,
                  top: -40,
                  child: IgnorePointer(
                    child: Container(
                      width: 180,
                      height: 180,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: SNGradients.heroLimeGlow,
                      ),
                    ),
                  ),
                ),
              // Hangul watermark, bottom-right.
              if (watermark != null && watermark!.isNotEmpty)
                Positioned(
                  right: 12,
                  bottom: -8,
                  child: IgnorePointer(
                    child: Text(
                      watermark!,
                      style: SNTypography.hangul(
                        fontSize: 96,
                        fontWeight: FontWeight.w900,
                        color: SNColors.heroWatermark,
                        height: 1,
                      ),
                    ),
                  ),
                ),
              // Inset top highlight — a soft white gradient fading down.
              Positioned(
                left: 0,
                right: 0,
                top: 0,
                child: IgnorePointer(
                  child: Container(
                    height: 64,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          SNColors.heroHighlight,
                          SNColors.heroHighlight.withValues(alpha: 0),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              // Content.
              Material(
                type: MaterialType.transparency,
                child: InkWell(
                  onTap: onTap,
                  borderRadius: borderRadius,
                  child: Padding(padding: padding, child: child),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
