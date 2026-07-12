import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';
import '../tokens/sn_motion.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_shadows.dart';
import '../tokens/sn_typography.dart';

/// Wraps a child in a tactile press-scale (default 0.97) with the Seoul
/// Night [SNMotion.press] timing. Disables the gesture when [onTap] is
/// null. Shared by [LimeButton] and [OutlineButton].
class SNPressable extends StatefulWidget {
  const SNPressable({
    super.key,
    required this.child,
    this.onTap,
    this.pressedScale = 0.97,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double pressedScale;

  @override
  State<SNPressable> createState() => _SNPressableState();
}

class _SNPressableState extends State<SNPressable> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onTap == null) return;
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return GestureDetector(
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? widget.pressedScale : 1.0,
        duration: SNMotion.press,
        curve: SNMotion.easeOut,
        child: Opacity(
          opacity: enabled ? 1.0 : 0.5,
          child: widget.child,
        ),
      ),
    );
  }
}

/// The lime primary button — one per screen (see `DESIGN_SPEC.md` §1).
///
/// [SNGradients.limeButton] fill, [SNColors.ink] w700 label, radius 14,
/// [SNShadows.limeGlow], min height 52, press-scale 0.97. Optional
/// leading [icon].
class LimeButton extends StatelessWidget {
  const LimeButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.expand = false,
    this.minHeight = 52,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  /// Stretch to the parent's full width.
  final bool expand;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return SNPressable(
      onTap: onPressed,
      child: Container(
        constraints: BoxConstraints(minHeight: minHeight),
        width: expand ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          gradient: SNGradients.limeButton,
          borderRadius: SNRadii.brSm,
          boxShadow: enabled ? SNShadows.limeGlow : null,
        ),
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 18, color: SNColors.ink),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: SNTypography.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: SNColors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The secondary outline button (see `DESIGN_SPEC.md` §1).
///
/// Transparent fill, 1px `white/25` border, `white/70` label, radius
/// 14, min height 52, press-scale 0.97.
class OutlineButton extends StatelessWidget {
  const OutlineButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.expand = false,
    this.minHeight = 52,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    const labelColor = Color(0xB3FFFFFF); // white 0.70
    return SNPressable(
      onTap: onPressed,
      child: Container(
        constraints: BoxConstraints(minHeight: minHeight),
        width: expand ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: SNRadii.brSm,
          border: Border.all(
            color: const Color(0x40FFFFFF), // white 0.25
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 18, color: labelColor),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: SNTypography.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: labelColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
