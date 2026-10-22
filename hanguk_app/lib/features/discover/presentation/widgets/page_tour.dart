import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/analytics/app_events.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../data/board_tour.dart';

/// One place a page's tour lights, and what its label says.
@immutable
class TourStep {
  const TourStep(this.label, {required this.icon, this.align = TourAlign.center});

  final String label;
  final Widget icon;
  final TourAlign align;
}

/// A page's first-run tour (owner, 2026-10-20/21: every page explains
/// itself the first time it is opened): one place lit at a time,
/// everything else dimmed under it — the tab bar too — with a single lime
/// label beside it. Each step stays [stepDuration] and moves on by itself,
/// or at once on a tap anywhere; there are no buttons. The lit place stays
/// usable (a tap on it reaches the page as well), and the last step's tap
/// ends the tour. [PageTourScope.replay] runs it again (the page's ▷).
///
/// Moving on, the list first scrolls the next place into view with the light
/// still following the current one, then the light glides across — it never
/// jumps to where the next place was before the scroll.
class PageTour extends ConsumerStatefulWidget {
  const PageTour({
    super.key,
    required this.name,
    required this.seen,
    required this.steps,
    required this.builder,
    this.active = true,
  });

  /// False while the page is built but not on screen (a tab of the home
  /// that another tab covers): the tour waits, and pauses if it was running.
  final bool active;

  /// For the analytics event.
  final String name;
  final NotifierProvider<TourSeenNotifier, bool?> seen;

  /// The places, top to bottom; [builder] puts each key on its place.
  final List<TourStep> Function(BuildContext context) steps;
  final Widget Function(BuildContext context, List<GlobalKey> keys) builder;

  /// How long each place stays lit (owner, 2026-10-20: "2 yoki 3 sekund").
  static const Duration stepDuration = Duration(seconds: 3);

  @override
  ConsumerState<PageTour> createState() => _PageTourState();
}

/// Lets a page's ▷ run its tour again.
class PageTourScope extends InheritedWidget {
  const PageTourScope({super.key, required this.replay, required super.child});

  final VoidCallback replay;

  static VoidCallback? maybeReplayOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PageTourScope>()?.replay;

  @override
  bool updateShouldNotify(PageTourScope old) => false;
}

class _PageTourState extends ConsumerState<PageTour> with SingleTickerProviderStateMixin {
  final _keys = <GlobalKey>[];
  final _portal = OverlayPortalController();
  late final AnimationController _glide = AnimationController(vsync: this, duration: const Duration(milliseconds: 280));
  int _step = 0;
  Timer? _timer;
  List<TourStep> _steps = const [];

  /// Where the light starts its glide to the step's place.
  Rect? _from;

  /// Scrolling to the next place, or gliding to it.
  bool _moving = false;
  ScrollPosition? _scroll;

  /// Bumped when the lit place has moved on screen since the light was
  /// drawn (a section that loads late and pushes the rest down), so the
  /// light follows it (owner, 2026-10-22: it lit the wrong places).
  final _tick = ValueNotifier<int>(0);
  Rect? _drawn;
  bool _watching = false;

  /// The route still sliding in: the tour waits for it to finish
  /// (owner, 2026-10-22: it started before the page had opened).
  Animation<double>? _routeAnimation;

  @override
  void didUpdateWidget(PageTour old) {
    super.didUpdateWidget(old);
    if (old.active && !widget.active) _pause();
  }

  @override
  void dispose() {
    _routeAnimation?.removeStatusListener(_routeStatus);
    _tick.dispose();
    _timer?.cancel();
    _scroll?.removeListener(_follow);
    _glide.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _steps = widget.steps(context);
    while (_keys.length < _steps.length) {
      _keys.add(GlobalKey(debugLabel: '${widget.name}-tour-${_keys.length}'));
    }
    final show = ref.watch(widget.seen) == false;
    // Rebuilt when the route becomes the top one again.
    final route = ModalRoute.of(context);
    if (show && widget.active && !_portal.isShowing && (route?.isCurrent ?? true)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _whenOpen());
    }
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (context) => AnimatedBuilder(
        animation: Listenable.merge([_glide, _tick]),
        builder: (context, _) {
          final live = _rectOf(_keys[_step]);
          final from = _from;
          final gliding = _glide.isAnimating && from != null && live != null;
          return _TourLayer(
            step: _steps[_step],
            hole: (gliding ? Rect.lerp(from, live, Curves.easeOutCubic.transform(_glide.value)) : live)?.inflate(6),
            showLabel: !_moving,
            onTap: _onTap,
          );
        },
      ),
      child: PageTourScope(replay: () => _start(force: true), child: widget.builder(context, _keys)),
    );
  }

  /// Starts the first-run tour once the page has opened: its route done
  /// sliding in, and the page on screen.
  void _whenOpen() {
    if (!mounted || _portal.isShowing || !widget.active) return;
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return;
    final animation = route?.animation;
    if (animation != null && animation.status != AnimationStatus.completed) {
      if (_routeAnimation != animation) {
        _routeAnimation?.removeStatusListener(_routeStatus);
        _routeAnimation = animation..addStatusListener(_routeStatus);
      }
      return;
    }
    _start();
  }

  /// After every frame while the tour shows: if the lit place is no longer
  /// where the light was drawn, draw it again. It schedules no frame of its
  /// own, so a page at rest stays at rest.
  void _watchLayout() {
    if (!mounted || !_portal.isShowing) {
      _watching = false;
      return;
    }
    final now = _glide.isAnimating ? _drawn : _rectOf(_keys[_step]);
    if (now != _drawn) {
      _drawn = now;
      _tick.value++;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _watchLayout());
  }

  void _routeStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    _routeAnimation?.removeStatusListener(_routeStatus);
    _routeAnimation = null;
    _whenOpen();
  }

  /// Off screen: the tour stops where it is, not marked seen, and starts
  /// again from the top when the page is back.
  void _pause() {
    _timer?.cancel();
    _scroll?.removeListener(_follow);
    _scroll = null;
    if (_portal.isShowing) _portal.hide();
    _moving = false;
  }

  void _start({bool force = false}) {
    if (!mounted || _portal.isShowing || _steps.isEmpty) return;
    if (!force && ref.read(widget.seen) != false) return;
    AppEvents.track('page_tour', props: {'page': widget.name, 'action': force ? 'replay' : 'start'});
    // From the top, the light following its place while the list scrolls
    // under it.
    _scroll = _findScroll();
    if (_scroll case final pos? when pos.pixels > pos.minScrollExtent) pos.jumpTo(pos.minScrollExtent);
    _scroll?.addListener(_follow);
    setState(() {
      _step = 0;
      _moving = false;
    });
    _portal.show();
    _drawn = null;
    if (!_watching) {
      _watching = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _watchLayout());
    }
    // One more frame: the rects are read once the page is laid out.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
    _arm();
  }

  void _follow() {
    if (mounted && _portal.isShowing) setState(() {});
  }

  void _arm() {
    _timer?.cancel();
    _timer = Timer(PageTour.stepDuration, _next);
  }

  void _onTap() {
    if (_moving) return;
    if (_step == _steps.length - 1) {
      _finish('tap');
    } else {
      _next();
    }
  }

  Future<void> _next() async {
    if (!mounted || !_portal.isShowing || _moving) return;
    _timer?.cancel();
    if (_step == _steps.length - 1) {
      _finish('done');
      return;
    }
    setState(() => _moving = true);
    final next = _step + 1;
    // A lazy list builds the next place only near the screen: scroll on
    // until it is there.
    final pos = _scroll;
    for (var i = 0; i < 12 && _keys[next].currentContext == null && pos != null; i++) {
      if (pos.pixels >= pos.maxScrollExtent) break;
      await pos.animateTo(
        (pos.pixels + pos.viewportDimension * 0.6).clamp(pos.minScrollExtent, pos.maxScrollExtent),
        duration: const Duration(milliseconds: 120),
        curve: Curves.linear,
      );
      if (!mounted || !_portal.isShowing) return;
    }
    final ctx = _keys[next].currentContext;
    if (ctx != null && Scrollable.maybeOf(ctx) != null) {
      await Scrollable.ensureVisible(ctx, alignment: 0.45, duration: const Duration(milliseconds: 300));
    }
    if (!mounted || !_portal.isShowing) return;
    setState(() {
      _from = _rectOf(_keys[_step]);
      _step = next;
    });
    await _glide.forward(from: 0);
    if (!mounted) return;
    setState(() => _moving = false);
    _arm();
  }

  void _finish(String how) {
    _timer?.cancel();
    final pos = _scroll ?? _findScroll();
    _scroll?.removeListener(_follow);
    _scroll = null;
    // Back to the top of the page, where the student starts.
    pos?.animateTo(pos.minScrollExtent, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    AppEvents.track('page_tour', props: {'page': widget.name, 'action': how, 'step': _step + 1});
    ref.read(widget.seen.notifier).markSeen();
    if (_portal.isShowing) _portal.hide();
  }

  /// The page's list: the one any place sits in.
  ScrollPosition? _findScroll() {
    for (final k in _keys) {
      final ctx = k.currentContext;
      final pos = ctx == null ? null : Scrollable.maybeOf(ctx)?.position;
      if (pos != null) return pos;
    }
    return null;
  }

  Rect? _rectOf(GlobalKey key) {
    final box = key.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }
}

class _TourLayer extends StatelessWidget {
  const _TourLayer({required this.step, required this.hole, required this.showLabel, required this.onTap});

  final TourStep step;
  final Rect? hole;
  final bool showLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context);
    final hole = this.hole;
    return Stack(
      children: [
        Positioned.fill(
          child: _Barrier(
            hole: hole,
            onTap: onTap,
            child: CustomPaint(painter: _DimPainter(hole), size: Size.infinite),
          ),
        ),
        if (hole != null && showLabel)
          _Label(
            hole: hole,
            screen: screen,
            // Below a place in the top half of the screen, above one in the
            // bottom half, so the label never covers it.
            above: hole.center.dy > screen.height / 2,
            align: step.align,
            child: IgnorePointer(
              child: _Pill(label: step.label, icon: step.icon),
            ),
          ),
      ],
    );
  }
}

/// Where the label sits beside the lit section.
enum TourAlign { start, center, end }

/// The lime label, just above or below the lit section.
class _Label extends StatelessWidget {
  const _Label({
    required this.hole,
    required this.screen,
    required this.above,
    required this.align,
    required this.child,
  });

  final Rect hole;
  final Size screen;
  final bool above;
  final TourAlign align;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    const gap = 10.0;
    const margin = 12.0;
    return Positioned(
      left: margin,
      right: margin,
      top: above ? null : hole.bottom + gap,
      bottom: above ? screen.height - hole.top + gap : null,
      child: Align(
        alignment: switch (align) {
          TourAlign.start => Alignment.centerLeft,
          TourAlign.center => Alignment.center,
          TourAlign.end => Alignment.centerRight,
        },
        child: Padding(
          padding: EdgeInsets.only(
            left: align == TourAlign.start ? (hole.left - margin).clamp(0, screen.width) : 0,
            right: align == TourAlign.end ? (screen.width - hole.right - margin).clamp(0, screen.width) : 0,
          ),
          child: child,
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.icon});

  final String label;
  final Widget icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
    decoration: BoxDecoration(
      color: FdColors.lime,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: FdColors.ink, width: 1.5),
      boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 4))],
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: fdText(14, FontWeight.w800, FdColors.onLime, height: 1.1),
          ),
        ),
      ],
    ),
  );
}

/// The dim over everything but the lit section, its lime outline and glow.
class _DimPainter extends CustomPainter {
  const _DimPainter(this.hole);

  final Rect? hole;

  static const double _radius = 20;

  @override
  void paint(Canvas canvas, Size size) {
    final screen = Path()..addRect(Offset.zero & size);
    final dim = Paint()..color = const Color(0xD9050B26);
    final h = hole;
    if (h == null) {
      canvas.drawPath(screen, dim);
      return;
    }
    final rrect = RRect.fromRectAndRadius(h, const Radius.circular(_radius));
    canvas.drawPath(Path.combine(PathOperation.difference, screen, Path()..addRRect(rrect)), dim);
    canvas.drawRRect(
      rrect.inflate(7),
      Paint()
        ..color = FdColors.lime.withValues(alpha: 0.22)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 12,
    );
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = FdColors.lime
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
  }

  @override
  bool shouldRepaint(_DimPainter old) => old.hole != hole;
}

/// Takes every touch: a tap anywhere moves the tour on ([onTap]). Touches on
/// the lit section also go through to the board underneath, so it stays
/// usable; elsewhere they stop here.
class _Barrier extends SingleChildRenderObjectWidget {
  const _Barrier({required this.hole, required this.onTap, super.child});

  final Rect? hole;
  final VoidCallback onTap;

  @override
  _RenderBarrier createRenderObject(BuildContext context) => _RenderBarrier(hole, onTap);

  @override
  void updateRenderObject(BuildContext context, _RenderBarrier renderObject) {
    renderObject
      ..hole = hole
      ..onTap = onTap;
  }
}

class _RenderBarrier extends RenderProxyBox {
  _RenderBarrier(this.hole, this.onTap);

  Rect? hole;
  VoidCallback onTap;
  final _downs = <int, Offset>{};

  /// Further than this between down and up is a drag (the strip, a slider),
  /// not a tap.
  static const double _slop = 18;

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    result.add(BoxHitTestEntry(this, position));
    final h = hole;
    // On the lit section: heard here and passed on to the board below.
    return !(h != null && h.contains(localToGlobal(position)));
  }

  @override
  void handleEvent(PointerEvent event, BoxHitTestEntry entry) {
    if (event is PointerDownEvent) {
      _downs[event.pointer] = event.position;
    } else if (event is PointerUpEvent) {
      final down = _downs.remove(event.pointer);
      if (down != null && (event.position - down).distance < _slop) {
        // After the board has had the touch.
        scheduleMicrotask(onTap);
      }
    } else if (event is PointerCancelEvent) {
      _downs.remove(event.pointer);
    }
  }
}
