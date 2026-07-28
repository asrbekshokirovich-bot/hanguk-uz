import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';
import '../seoul_night_typography.dart';

/// The primary action. Lime gradient, ink label, lime glow beneath.
///
/// Spec §4: lime is rare — at most one of these per screen.
class LimeButton extends StatefulWidget {
  const LimeButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.expand = true,
    this.height = SeoulSizes.buttonHeight,
    this.radius = SeoulRadii.control,
    this.loading = false,
  });

  final String label;

  /// Null disables the button (dimmed, no glow, no press).
  final VoidCallback? onPressed;

  final IconData? icon;

  /// Stretch to the available width. Off for inline pills.
  final bool expand;

  final double height;
  final double radius;

  /// Swaps the label for a spinner and blocks taps.
  final bool loading;

  @override
  State<LimeButton> createState() => _LimeButtonState();
}

class _LimeButtonState extends State<LimeButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.loading;
    final borderRadius = BorderRadius.circular(widget.radius);

    final content = widget.loading
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.ink),
            ),
          )
        : Row(
            mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: 18, color: SeoulColors.ink),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.button,
                ),
              ),
            ],
          );

    final button = AnimatedOpacity(
      opacity: enabled ? 1.0 : 0.45,
      duration: SeoulMotion.fast,
      child: Container(
        height: widget.height,
        width: widget.expand ? double.infinity : null,
        padding: EdgeInsets.symmetric(horizontal: widget.expand ? 20 : 22),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: SeoulGradients.limeButton,
          borderRadius: borderRadius,
          boxShadow: enabled ? SeoulShadows.limeGlow : null,
        ),
        child: content,
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTap: enabled ? widget.onPressed : null,
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        child: AnimatedScale(
          scale: _pressed ? SeoulMotion.pressScale : 1.0,
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          child: button,
        ),
      ),
    );
  }
}

/// The secondary action: transparent with a hairline border. Never competes
/// with the lime button next to it.
class SeoulOutlineButton extends StatefulWidget {
  const SeoulOutlineButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.expand = true,
    this.height = SeoulSizes.buttonHeight,
    this.radius = SeoulRadii.control,
    this.trailing,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;
  final double height;
  final double radius;

  /// Optional widget after the label — e.g. a small hangul chip (탐색).
  final Widget? trailing;

  @override
  State<SeoulOutlineButton> createState() => _SeoulOutlineButtonState();
}

class _SeoulOutlineButtonState extends State<SeoulOutlineButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;

    final button = AnimatedOpacity(
      opacity: enabled ? 1.0 : 0.45,
      duration: SeoulMotion.fast,
      child: Container(
        height: widget.height,
        width: widget.expand ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(widget.radius),
          border: Border.all(color: const Color(0x40FFFFFF), width: 1),
        ),
        child: Row(
          mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (widget.icon != null) ...[
              Icon(widget.icon, size: 18, color: SeoulColors.textSecondary),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(
                widget.label,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: SeoulType.button.copyWith(
                  color: const Color(0xB3FFFFFF), // white 70%
                ),
              ),
            ),
            if (widget.trailing != null) ...[
              const SizedBox(width: 10),
              widget.trailing!,
            ],
          ],
        ),
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTap: widget.onPressed,
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        child: AnimatedScale(
          scale: _pressed ? SeoulMotion.pressScale : 1.0,
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          child: button,
        ),
      ),
    );
  }
}
