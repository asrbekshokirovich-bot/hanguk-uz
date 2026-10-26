import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

import 'app_events.dart';

/// [fn] that first records a `tap` on [element] — the name the CRM shows for
/// what was pressed ("uni_card.heart", "visa.q.route"). Null stays null, so a
/// disabled button stays disabled.
///
/// Names are `<where>.<what>` in lower_snake_case, stable across languages:
/// never the button's text. [props] carries what the tap was about (a
/// university id, the value chosen) — no typed text, no personal data.
VoidCallback? tracked(String element, VoidCallback? fn, {Map<String, Object?>? props}) {
  if (fn == null) return null;
  return () {
    AppEvents.tap(element, props: props);
    fn();
  };
}

/// [tracked] for callbacks that take the chosen value; [props] builds the
/// details from it (the value itself only when it is not personal).
ValueChanged<T>? trackedValue<T>(
  String element,
  ValueChanged<T>? fn, {
  Map<String, Object?> Function(T value)? props,
}) {
  if (fn == null) return null;
  return (value) {
    AppEvents.tap(element, props: props?.call(value));
    fn(value);
  };
}

/// [tracked] for long presses.
VoidCallback? trackedLong(String element, VoidCallback? fn, {Map<String, Object?>? props}) {
  if (fn == null) return null;
  return () {
    AppEvents.longPress(element, props: props);
    fn();
  };
}

/// Sits over the whole app (MaterialApp.builder): every tap anywhere is
/// recorded with where on the screen it landed (a fraction of the width and
/// height), named by a [tracked] callback when one runs for it; and how far
/// each screen is scrolled.
///
/// A tap is a pointer that goes down and up before a long press would start
/// and without moving further than the touch slop — a drag or a scroll is not
/// one.
class AnalyticsRoot extends StatefulWidget {
  const AnalyticsRoot({super.key, required this.child});

  final Widget child;

  @override
  State<AnalyticsRoot> createState() => _AnalyticsRootState();
}

class _Down {
  _Down(this.position, this.at);

  final Offset position;
  final Duration at;
  bool moved = false;
}

class _AnalyticsRootState extends State<AnalyticsRoot> {
  final Map<int, _Down> _downs = {};

  void _down(PointerDownEvent e) => _downs[e.pointer] = _Down(e.position, e.timeStamp);

  void _move(PointerMoveEvent e) {
    final d = _downs[e.pointer];
    if (d != null && (e.position - d.position).distance > kTouchSlop) d.moved = true;
  }

  void _up(PointerUpEvent e) {
    final d = _downs.remove(e.pointer);
    if (d == null || d.moved || e.timeStamp - d.at >= kLongPressTimeout) return;
    final size = MediaQuery.maybeSizeOf(context);
    if (size == null || size.width <= 0 || size.height <= 0) return;
    AppEvents.pointerTap(e.position.dx / size.width, e.position.dy / size.height, e.position);
  }

  bool _scroll(ScrollNotification n) {
    // The screen's own list: not one nested in it, not a sideways carousel.
    if (n.depth == 0 && n.metrics.axis == Axis.vertical && n.metrics.maxScrollExtent > 0) {
      AppEvents.scrolled(n.metrics.pixels / n.metrics.maxScrollExtent);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: _scroll,
      child: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: _down,
        onPointerMove: _move,
        onPointerUp: _up,
        onPointerCancel: (e) => _downs.remove(e.pointer),
        child: widget.child,
      ),
    );
  }
}
