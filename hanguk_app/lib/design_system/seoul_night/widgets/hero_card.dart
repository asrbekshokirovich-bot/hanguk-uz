import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';
import '../tokens/sn_motion.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_shadows.dart';
import '../tokens/sn_typography.dart';

/// The one card per screen that carries the weight
/// (DESIGN_SPEC.md §1 "Surfaces" → *Hero card*).
///
/// Navy 140deg gradient, radius 22, `0 24px 48px rgba(0,0,0,0.45)`,
/// a 1px `rgba(255,255,255,0.16)` border and a simulated inset top
/// highlight. Optionally a lime radial glow in the top-right corner and
/// a 한국 watermark at 5% white.
///
/// Used for: Home's Journey card, Documents' collected card, the AI
/// Interview header. **One per screen** — two heroes and neither reads
/// as the hero.
class HeroCard extends StatelessWidget {
  const HeroCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.borderRadius = SnRadii.heroR,
    this.showLimeGlow = true,
    this.watermark,
    this.onTap,
    this.height,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius borderRadius;

  /// The lime radial blob in the top-right corner.
  final bool showLimeGlow;

  /// Hangul watermark drawn bottom-right at 96px / w900 / 5% white.
  /// Pass `'한국'` for the brand mark, or a screen-specific word.
  final String? watermark;

  final VoidCallback? onTap;
  final double? height;

  static const double _glowSize = 200;

  @override
  Widget build(BuildContext context) {
    final card = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: SnShadows.hero,
      ),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: SnGradients.heroCard,
            borderRadius: borderRadius,
            border: Border.all(color: SnColors.heroBorder, width: 1),
          ),
          child: SizedBox(
            height: height,
            child: Stack(
              children: [
                // Decoration order matters: glow, then watermark, then
                // the 1px highlight, then content on top of all of it.
                if (showLimeGlow)
                  const Positioned(
                    top: -_glowSize * 0.4,
                    right: -_glowSize * 0.3,
                    width: _glowSize,
                    height: _glowSize,
                    child: IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: SnGradients.heroLimeGlow,
                        ),
                      ),
                    ),
                  ),
                if (watermark != null)
                  Positioned(
                    right: -8,
                    bottom: -28,
                    child: IgnorePointer(
                      child: ExcludeSemantics(
                        child: Text(
                          watermark!,
                          style: SnType.hangulWatermark,
                        ),
                      ),
                    ),
                  ),
                // Stand-in for `inset 0 1px 0 rgba(255,255,255,0.2)`.
                // Flutter has no inset shadow, so the highlight is a 1px
                // gradient hairline pinned to the top edge.
                const Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: SnGradients.heroInsetHighlight,
                      ),
                    ),
                  ),
                ),
                Padding(padding: padding, child: child),
              ],
            ),
          ),
        ),
      ),
    );

    if (onTap == null) return card;
    return _PressScale(onTap: onTap!, child: card);
  }
}

class _PressScale extends StatefulWidget {
  const _PressScale({required this.onTap, required this.child});

  final VoidCallback onTap;
  final Widget child;

  @override
  State<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<_PressScale> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      behavior: HitTestBehavior.opaque,
      child: AnimatedScale(
        scale: _pressed ? SnMotion.pressScale : 1.0,
        duration: SnMotion.press,
        curve: SnMotion.ease,
        child: widget.child,
      ),
    );
  }
}
