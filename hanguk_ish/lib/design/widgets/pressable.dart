import 'package:flutter/widgets.dart';

/// Tap target that tells its [builder] whether a finger is down on it.
///
/// Used by every tappable surface so the press feedback is the same
/// everywhere: hard-shadowed surfaces sink toward their shadow, flat ones dim.
class HiPressable extends StatefulWidget {
  const HiPressable({
    super.key,
    required this.onTap,
    required this.builder,
    this.semanticsLabel,
    this.button = true,
    this.selected,
  });

  /// Null disables the target.
  final VoidCallback? onTap;

  final Widget Function(BuildContext context, bool pressed) builder;

  /// Overrides the label read by screen readers (defaults to the text inside).
  final String? semanticsLabel;

  final bool button;

  /// For toggles: whether the option is currently on.
  final bool? selected;

  @override
  State<HiPressable> createState() => _HiPressableState();
}

class _HiPressableState extends State<HiPressable> {
  bool _pressed = false;

  void _set(bool value) {
    if (_pressed != value && mounted) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return Semantics(
      button: widget.button,
      enabled: enabled,
      selected: widget.selected,
      label: widget.semanticsLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onTapDown: enabled ? (_) => _set(true) : null,
        onTapUp: enabled ? (_) => _set(false) : null,
        onTapCancel: enabled ? () => _set(false) : null,
        // A label replaces what the content would read (the tap action
        // stays on this node).
        child: widget.semanticsLabel == null
            ? widget.builder(context, enabled && _pressed)
            : ExcludeSemantics(child: widget.builder(context, enabled && _pressed)),
      ),
    );
  }
}
