import 'dart:ui';

import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_shadows.dart';

/// Frosted glass surface — the workhorse container of Seoul Night (see
/// `DESIGN_SPEC.md` §1 Surfaces).
///
/// Fill [SNColors.glass] over a 12px backdrop blur, 1px
/// [SNColors.glassBorder] hairline, radius 18–24, soft [SNShadows.card].
/// Depth comes from the blur + hairline over the background gradient,
/// never a flat panel.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.borderRadius = SNRadii.brLg,
    this.onTap,
    this.blur = 12,
    this.fill = SNColors.glass,
    this.borderColor = SNColors.glassBorder,
    this.shadows = SNShadows.card,
    this.width,
    this.height,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius borderRadius;
  final VoidCallback? onTap;
  final double blur;
  final Color fill;
  final Color borderColor;
  final List<BoxShadow> shadows;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    // The shadow must sit *outside* the ClipRRect (a clip would crop it),
    // so it lives on an outer DecoratedBox.
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: shadows,
      ),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: fill,
              borderRadius: borderRadius,
              border: Border.all(color: borderColor, width: 1),
            ),
            child: Material(
              type: MaterialType.transparency,
              child: InkWell(
                onTap: onTap,
                borderRadius: borderRadius,
                child: Container(
                  width: width,
                  height: height,
                  padding: padding,
                  child: child,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
