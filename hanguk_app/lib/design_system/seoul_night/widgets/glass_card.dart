import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_motion.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_shadows.dart';

/// The workhorse surface (DESIGN_SPEC.md §1 "Surfaces" → *Glass card*).
///
/// `rgba(255,255,255,0.07)` fill, 1px `rgba(255,255,255,0.12)` hairline,
/// radius 18 (override to 24 for full-bleed panels), backdrop blur 12,
/// `0 12px 28px rgba(0,0,0,0.3)` shadow.
///
/// The blur is what sells it: the card samples the page gradient and the
/// ambient blobs behind it, so a card near the bottom-right picks up the
/// lime blob for free. That also makes it the most expensive widget in
/// the system — see [blur] before putting one inside a long list.
class GlassCard extends StatefulWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.borderRadius = SnRadii.cardR,
    this.onTap,
    this.blur = 12,
    this.fill = SnColors.glass,
    this.borderColor = SnColors.glassBorder,
    this.shadows = SnShadows.card,
    this.width,
    this.height,
    this.semanticLabel,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius borderRadius;

  /// When set the whole card becomes tappable and scales to
  /// [SnMotion.pressScale] on press.
  final VoidCallback? onTap;

  /// Backdrop blur sigma. Set to `0` to skip the [BackdropFilter]
  /// entirely — worth doing for rows inside a scrolling list, where a
  /// per-row blur costs a saveLayer on every frame.
  final double blur;

  final Color fill;
  final Color borderColor;
  final List<BoxShadow> shadows;
  final double? width;
  final double? height;

  /// Announced by screen readers when [onTap] is set.
  final String? semanticLabel;

  @override
  State<GlassCard> createState() => _GlassCardState();
}

class _GlassCardState extends State<GlassCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    Widget surface = DecoratedBox(
      decoration: BoxDecoration(
        color: widget.fill,
        borderRadius: widget.borderRadius,
        border: Border.all(color: widget.borderColor, width: 1),
      ),
      child: Padding(padding: widget.padding, child: widget.child),
    );

    if (widget.blur > 0) {
      surface = BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: widget.blur, sigmaY: widget.blur),
        child: surface,
      );
    }

    // The shadow lives outside the ClipRRect so it is not clipped away,
    // and the clip lives outside the blur so the blur cannot bleed past
    // the corners.
    Widget card = SizedBox(
      width: widget.width,
      height: widget.height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: widget.borderRadius,
          boxShadow: widget.shadows,
        ),
        child: ClipRRect(borderRadius: widget.borderRadius, child: surface),
      ),
    );

    if (widget.onTap == null) return card;

    card = AnimatedScale(
      scale: _pressed ? SnMotion.pressScale : 1.0,
      duration: SnMotion.press,
      curve: SnMotion.ease,
      child: card,
    );

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        behavior: HitTestBehavior.opaque,
        child: card,
      ),
    );
  }
}
