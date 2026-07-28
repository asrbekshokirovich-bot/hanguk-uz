import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';
import '../tokens/sn_motion.dart';
import '../tokens/sn_radii.dart';
import '../tokens/sn_shadows.dart';
import '../tokens/sn_typography.dart';

/// Minimum tappable height (spec §4: min hit target 44×44). Buttons are
/// specced at 52 so they clear it comfortably.
const double _kMinHeight = 52;

/// The primary action (DESIGN_SPEC.md §1 → *Lime primary button*).
///
/// 145deg `#E2F26A → #C7E04A`, ink text w700, radius 14,
/// `0 14px 32px rgba(212,233,76,0.28)` glow, press scale 0.97.
///
/// **One per screen.** Lime is the scarcest resource in this design
/// language; a second lime button on the same screen means neither is
/// the action.
class LimeButton extends StatefulWidget {
  const LimeButton({
    super.key,
    required this.label,
    this.onPressed,
    this.hangul,
    this.icon,
    this.expand = true,
    this.minHeight = _kMinHeight,
    this.borderRadius = SnRadii.buttonR,
  });

  final String label;
  final VoidCallback? onPressed;

  /// Optional small hangul word trailing the label (가입, 탐색 …).
  /// Rendered in [SnColors.ink] at 70% — on lime, ink is the only
  /// legible ink, so the hangul accent darkens rather than tints.
  final String? hangul;

  final IconData? icon;

  /// Fill the available width. Turn off for inline pills.
  final bool expand;

  final double minHeight;
  final BorderRadius borderRadius;

  bool get _enabled => onPressed != null;

  @override
  State<LimeButton> createState() => _LimeButtonState();
}

class _LimeButtonState extends State<LimeButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget._enabled;

    final content = Row(
      mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.icon != null) ...[
          Icon(widget.icon, size: 18, color: SnColors.ink),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(
            widget.label,
            style: SnType.inter(size: 15, weight: 700, color: SnColors.ink),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (widget.hangul != null) ...[
          const SizedBox(width: 8),
          Text(
            widget.hangul!,
            style: SnType.hangul(
              size: 12,
              weight: 700,
              color: SnColors.ink.withValues(alpha: 0.7),
            ),
          ),
        ],
      ],
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
        behavior: HitTestBehavior.opaque,
        child: AnimatedScale(
          scale: _pressed ? SnMotion.pressScale : 1.0,
          duration: SnMotion.press,
          curve: SnMotion.ease,
          child: AnimatedOpacity(
            // Disabled reads as "not yet" rather than a different
            // colour — the gradient is the brand and we keep it.
            opacity: enabled ? 1.0 : 0.35,
            duration: SnMotion.base,
            child: Container(
              constraints: BoxConstraints(minHeight: widget.minHeight),
              width: widget.expand ? double.infinity : null,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: SnGradients.limeButton,
                borderRadius: widget.borderRadius,
                boxShadow: enabled ? SnShadows.limeGlow : null,
              ),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

/// The secondary action (DESIGN_SPEC.md §1 → *Outline button*).
///
/// Transparent, 1px `rgba(255,255,255,0.25)`, white/70 label. Pairs
/// under a [LimeButton]; also the "Explore Universities · 탐색" guest
/// entry point on Welcome (Phase 2).
///
/// Named with the `Sn` prefix because Flutter shipped an `OutlineButton`
/// of its own until v3.1 and the name still reads as Material's.
class SnOutlineButton extends StatefulWidget {
  const SnOutlineButton({
    super.key,
    required this.label,
    this.onPressed,
    this.hangul,
    this.icon,
    this.expand = true,
    this.minHeight = _kMinHeight,
    this.borderRadius = SnRadii.buttonR,
  });

  final String label;
  final VoidCallback? onPressed;

  /// Optional lime hangul accent trailing the label.
  final String? hangul;

  final IconData? icon;
  final bool expand;
  final double minHeight;
  final BorderRadius borderRadius;

  bool get _enabled => onPressed != null;

  @override
  State<SnOutlineButton> createState() => _SnOutlineButtonState();
}

class _SnOutlineButtonState extends State<SnOutlineButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget._enabled;

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTap: widget.onPressed,
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        behavior: HitTestBehavior.opaque,
        child: AnimatedScale(
          scale: _pressed ? SnMotion.pressScale : 1.0,
          duration: SnMotion.press,
          curve: SnMotion.ease,
          child: AnimatedOpacity(
            opacity: enabled ? 1.0 : 0.35,
            duration: SnMotion.base,
            child: Container(
              constraints: BoxConstraints(minHeight: widget.minHeight),
              width: widget.expand ? double.infinity : null,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: _pressed ? SnColors.glass : Colors.transparent,
                borderRadius: widget.borderRadius,
                border: Border.all(
                  color: const Color(0x40FFFFFF),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: widget.expand
                    ? MainAxisSize.max
                    : MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (widget.icon != null) ...[
                    Icon(
                      widget.icon,
                      size: 18,
                      color: SnColors.textPrimary.withValues(alpha: 0.7),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Flexible(
                    child: Text(
                      widget.label,
                      style: SnType.inter(
                        size: 15,
                        weight: 600,
                        color: SnColors.textPrimary.withValues(alpha: 0.7),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (widget.hangul != null) ...[
                    const SizedBox(width: 8),
                    Text(widget.hangul!, style: SnType.hangulLabel),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
