import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';
import '../seoul_night_typography.dart';

/// The full design's building block (`Hanguk App - Full Design`): a flat
/// surface with a 1.5px ink border and a hard, un-blurred offset shadow of the
/// same ink. Cards, language rows, search fields and buttons are all this.
///
/// It sits on the Seoul Night navy backdrop, so the default fill is white and
/// the border and shadow are the deep ink that already anchors the palette.
class HardShadowBox extends StatelessWidget {
  const HardShadowBox({
    super.key,
    required this.child,
    this.fill = Colors.white,
    this.border = SeoulColors.ink,
    this.shadow = SeoulColors.ink,
    this.radius = 16,
    this.offset = 4,
    this.borderWidth = 1.5,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final Color fill;
  final Color border;
  final Color shadow;
  final double radius;

  /// How far the shadow sits down and to the right; 0 draws none.
  final double offset;
  final double borderWidth;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: border, width: borderWidth),
        boxShadow: offset == 0
            ? null
            : [BoxShadow(color: shadow, offset: Offset(offset, offset))],
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// The primary action of the full design: lime, ink label, ink border and a
/// 4px hard shadow. Pressing moves it onto its shadow. Loading swaps the
/// label for an ink spinner and blocks taps; [onPressed] null disables it.
class HardButton extends StatefulWidget {
  const HardButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.fill = SeoulColors.lime,
    this.foreground = SeoulColors.ink,
    this.trailing,
    this.leading,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final Color fill;
  final Color foreground;

  /// Drawn after the label, e.g. the forward arrow of "Continue →".
  final Widget? trailing;

  /// Drawn before the label, e.g. the sparkle of "✦ Fikr-mulohaza olish".
  final Widget? leading;

  @override
  State<HardButton> createState() => _HardButtonState();
}

class _HardButtonState extends State<HardButton> {
  static const double _offset = 4;
  bool _down = false;

  bool get _enabled => widget.onPressed != null && !widget.loading;

  @override
  Widget build(BuildContext context) {
    final press = _down && _enabled;
    return Semantics(
      button: true,
      enabled: _enabled,
      label: widget.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _enabled ? (_) => setState(() => _down = true) : null,
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: _enabled ? widget.onPressed : null,
        child: AnimatedContainer(
          duration: SeoulMotion.fast,
          curve: Curves.easeOut,
          // The shadow stays put; the face slides onto it.
          transform: Matrix4.translationValues(
            press ? _offset : 0,
            press ? _offset : 0,
            0,
          ),
          child: HardShadowBox(
            fill: widget.fill,
            radius: 16,
            offset: press ? 0 : _offset,
            padding: const EdgeInsets.symmetric(vertical: 17),
            child: SizedBox(
              height: 22,
              child: Center(
                child: widget.loading
                    ? SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: widget.foreground,
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (widget.leading != null) ...[
                            widget.leading!,
                            const SizedBox(width: 8),
                          ],
                          Flexible(
                            child: Text(
                              widget.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontFamily: SeoulType.inter,
                                fontFamilyFallback: SeoulType.fallback,
                                fontSize: 17,
                                height: 1.2,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.2,
                                color: widget.foreground,
                              ),
                            ),
                          ),
                          if (widget.trailing != null) ...[
                            const SizedBox(width: 8),
                            widget.trailing!,
                          ],
                        ],
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
