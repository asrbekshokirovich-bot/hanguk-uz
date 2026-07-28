import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';
import '../seoul_night_typography.dart';

/// The one raised surface per screen: navy gradient, inset top highlight, a
/// lime glow blob in the top-right corner and an optional 한국 watermark
/// (DESIGN_SPEC §1 Surfaces / §3.3).
///
/// Use it for the Home "Journey" card and the Documents "collected" card —
/// never twice on the same screen, or the hierarchy flattens.
class HeroCard extends StatefulWidget {
  const HeroCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.margin,
    this.radius = SeoulRadii.hero,
    this.onTap,
    this.showGlow = true,
    this.watermark,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final VoidCallback? onTap;

  /// The lime radial bloom behind the top-right corner.
  final bool showGlow;

  /// Oversized hangul set at 5% white behind the content, e.g. '한국'.
  final String? watermark;

  @override
  State<HeroCard> createState() => _HeroCardState();
}

class _HeroCardState extends State<HeroCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(widget.radius);

    Widget card = Container(
      margin: widget.margin,
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: SeoulShadows.hero,
      ),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: SeoulGradients.heroCard,
            borderRadius: borderRadius,
            border: Border.all(color: SeoulColors.heroBorder, width: 1),
          ),
          child: Stack(
            children: [
              if (widget.showGlow)
                const Positioned(
                  right: -60,
                  top: -70,
                  child: IgnorePointer(
                    child: SizedBox(
                      width: 200,
                      height: 200,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: SeoulGradients.glowLime,
                        ),
                      ),
                    ),
                  ),
                ),

              if (widget.watermark != null)
                Positioned(
                  right: -8,
                  bottom: -28,
                  child: IgnorePointer(
                    child: Text(
                      widget.watermark!,
                      style: SeoulType.hangulWatermark,
                    ),
                  ),
                ),

              // 1px inset highlight along the top edge — the detail that
              // makes the card read as lit from above.
              const Positioned(
                left: 0,
                right: 0,
                top: 0,
                child: IgnorePointer(
                  child: SizedBox(
                    height: 1,
                    child: ColoredBox(color: SeoulColors.heroHighlight),
                  ),
                ),
              ),

              Padding(padding: widget.padding, child: widget.child),
            ],
          ),
        ),
      ),
    );

    if (widget.onTap == null) return card;

    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? SeoulMotion.pressScale : 1.0,
        duration: SeoulMotion.fast,
        curve: SeoulMotion.smooth,
        child: card,
      ),
    );
  }
}
