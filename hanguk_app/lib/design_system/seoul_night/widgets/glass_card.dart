import 'dart:ui';

import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';

/// A frosted surface: translucent fill, hairline border, soft shadow and a
/// 12px backdrop blur (DESIGN_SPEC §1 Surfaces).
///
/// Pass [onTap] to make it interactive — it then presses to 0.97 like every
/// other Seoul Night control.
class GlassCard extends StatefulWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin,
    this.radius = SeoulRadii.card,
    this.onTap,
    this.borderColor,
    this.fillColor,
    this.showShadow = true,
    this.blur = true,
    this.width,
    this.height,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;
  final VoidCallback? onTap;

  /// Override for selected/active states (e.g. a lime-tinted border).
  final Color? borderColor;
  final Color? fillColor;

  final bool showShadow;

  /// Blur costs a saved layer. Turn it off inside long scrolling lists where
  /// dozens of cards would otherwise each add one.
  final bool blur;

  final double? width;
  final double? height;

  @override
  State<GlassCard> createState() => _GlassCardState();
}

class _GlassCardState extends State<GlassCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(widget.radius);

    Widget surface = DecoratedBox(
      decoration: BoxDecoration(
        color: widget.fillColor ?? SeoulColors.glass,
        borderRadius: borderRadius,
        border: Border.all(
          color: widget.borderColor ?? SeoulColors.glassBorder,
          width: 1,
        ),
      ),
      child: Padding(padding: widget.padding, child: widget.child),
    );

    if (widget.blur) {
      surface = BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: surface,
      );
    }

    Widget card = Container(
      width: widget.width,
      height: widget.height,
      margin: widget.margin,
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: widget.showShadow ? SeoulShadows.card : null,
      ),
      child: ClipRRect(borderRadius: borderRadius, child: surface),
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
