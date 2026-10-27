import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import 'app_events.dart';

/// A list of universities whose cards report being seen: `card_view` with the
/// university, its place in the list and the list's [name], once per card
/// while the list is on screen. A card counts as seen when at least half of
/// it rests on screen — after a scroll stops, or when the list first shows —
/// and nothing covers it (a sheet, another tab), so a fling past it does not.
///
/// A tap inside a card also carries the list and the place, and the
/// university's page then knows where it was opened from
/// ([AppEvents.cardOrigin]).
class SeenList extends StatefulWidget {
  const SeenList({super.key, required this.name, required this.child});

  /// 'universities', 'search', 'saved', … — stable, not translated.
  final String name;

  /// The list itself (its scrollable inside).
  final Widget child;

  @override
  State<SeenList> createState() => _SeenListState();
}

class _SeenListState extends State<SeenList> {
  final Set<_SeenState> _items = {};
  final Set<String> _reported = {};
  bool _scheduled = false;

  void _add(_SeenState item) {
    _items.add(item);
    _schedule();
  }

  void _remove(_SeenState item) => _items.remove(item);

  /// Checks after the next frame: the cards have their places by then.
  void _schedule() {
    if (_scheduled) return;
    _scheduled = true;
    WidgetsBinding.instance
      ..addPostFrameCallback((_) {
        _scheduled = false;
        if (mounted) _check();
      })
      // Idle after a scroll stops: ask for the frame the check waits for.
      ..ensureVisualUpdate();
  }

  void _check() {
    final list = context.findRenderObject();
    final listRect = list is RenderBox && list.attached && list.hasSize ? list.localToGlobal(Offset.zero) & list.size : null;
    for (final item in List.of(_items)) {
      final id = item.widget.id;
      if (_reported.contains(id) || !item.mounted) continue;
      if (item._seen(listRect)) {
        _reported.add(id);
        AppEvents.track('card_view', props: {'institution_id': id, 'position': item.widget.position, 'list': widget.name});
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n is ScrollEndNotification) _schedule();
        return false;
      },
      child: _SeenScope(state: this, child: widget.child),
    );
  }
}

class _SeenScope extends InheritedWidget {
  const _SeenScope({required this.state, required super.child});

  final _SeenListState state;

  @override
  bool updateShouldNotify(_SeenScope old) => old.state != state;
}

/// One university's card in a [SeenList]; [position] counts from 1.
class Seen extends StatefulWidget {
  const Seen({super.key, required this.id, required this.position, required this.child});

  final String id;
  final int position;
  final Widget child;

  @override
  State<Seen> createState() => _SeenState();
}

class _SeenState extends State<Seen> {
  _SeenListState? _list;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final list = context.getInheritedWidgetOfExactType<_SeenScope>()?.state;
    if (list != _list) {
      _list?._remove(this);
      _list = list?.._add(this);
    }
  }

  @override
  void didUpdateWidget(Seen old) {
    super.didUpdateWidget(old);
    // The same card slot now shows another university.
    if (old.id != widget.id) _list?._schedule();
  }

  @override
  void dispose() {
    _list?._remove(this);
    super.dispose();
  }

  /// Half of the card or more on screen (and inside the list), and on top.
  bool _seen(Rect? listRect) {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize || box.size.isEmpty) return false;
    final view = View.maybeOf(context);
    if (view == null) return false;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    var visible = rect.intersect(Offset.zero & (view.physicalSize / view.devicePixelRatio));
    if (listRect != null) visible = visible.intersect(listRect);
    if (visible.width <= 0 || visible.height <= 0) return false;
    if (visible.width * visible.height < 0.5 * rect.width * rect.height) return false;
    // Not under a sheet, not in a tab that is not showing: a tap there would
    // reach this card.
    final hit = HitTestResult();
    WidgetsBinding.instance.hitTestInView(hit, visible.center, view.viewId);
    return hit.path.any((e) => e.target == box);
  }

  void _tapped() {
    final list = _list;
    if (list == null) return;
    AppEvents.cardTapped(widget.id, list.widget.name, widget.position);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(behavior: HitTestBehavior.translucent, onPointerUp: (_) => _tapped(), child: widget.child);
  }
}
