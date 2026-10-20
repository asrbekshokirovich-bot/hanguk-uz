import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/analytics/app_events.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/board_tour.dart';

/// What the tour points at, top to bottom: the twelve places of the board
/// (owner, 2026-10-20) — the count, the visa gauge, the strip, each choice
/// section, and the "N ta universitetni ko'rish" button.
class BoardTourTargets {
  final count = GlobalKey(debugLabel: 'tour-count');
  final visa = GlobalKey(debugLabel: 'tour-visa');
  final strip = GlobalKey(debugLabel: 'tour-strip');
  final field = GlobalKey(debugLabel: 'tour-field');
  final city = GlobalKey(debugLabel: 'tour-city');
  final degree = GlobalKey(debugLabel: 'tour-degree');
  final topik = GlobalKey(debugLabel: 'tour-topik');
  final ielts = GlobalKey(debugLabel: 'tour-ielts');
  final fee = GlobalKey(debugLabel: 'tour-fee');
  final type = GlobalKey(debugLabel: 'tour-type');
  final grant = GlobalKey(debugLabel: 'tour-grant');
  final button = GlobalKey(debugLabel: 'tour-button');

  List<GlobalKey> get inOrder => [count, visa, strip, field, city, degree, topik, ielts, fee, type, grant, button];

  static const int _count = 12;
}

/// The home board's first-run tour (design 12a–12d, twelve places): one section lit at a
/// time, everything else dimmed under it — the tab bar too — with a single
/// lime label beside the lit section. Each step stays [stepDuration] and
/// moves on by itself; there are no buttons. The lit section stays usable: a
/// field can be picked on the first step, and the last step's button ends
/// the tour.
class BoardTour extends ConsumerStatefulWidget {
  const BoardTour({super.key, required this.builder});

  final Widget Function(BuildContext context, BoardTourTargets targets) builder;

  @override
  ConsumerState<BoardTour> createState() => _BoardTourState();
}

class _BoardTourState extends ConsumerState<BoardTour> {
  final _targets = BoardTourTargets();
  final _portal = OverlayPortalController();
  int _step = 0;
  Timer? _timer;

  static int get _steps => BoardTourTargets._count;

  /// How long each section stays lit (owner, 2026-10-20: "2 yoki 3 sekund").
  static const Duration stepDuration = Duration(seconds: 3);

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final show = ref.watch(boardTourProvider) == false;
    if (show && !_portal.isShowing) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _start());
    } else if (!show && _portal.isShowing) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _portal.isShowing) _portal.hide();
      });
    }
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (context) => _TourLayer(
        step: _step,
        steps: _steps,
        target: _rectOf(_targets.inOrder[_step]),
        onTargetTap: _step == _steps - 1 ? () => _finish('button') : null,
      ),
      child: widget.builder(context, _targets),
    );
  }

  void _start() {
    if (!mounted || _portal.isShowing || ref.read(boardTourProvider) != false) return;
    AppEvents.track('board_tour', props: {'action': 'start'});
    setState(() => _step = 0);
    _portal.show();
    _reveal();
  }

  /// Scrolls the step's section to the middle of the list (the lower ones
  /// start below the fold), then redraws the light on it.
  Future<void> _reveal() async {
    final ctx = _targets.inOrder[_step].currentContext;
    if (ctx != null && Scrollable.maybeOf(ctx) != null) {
      await Scrollable.ensureVisible(ctx, alignment: 0.45, duration: const Duration(milliseconds: 300));
    }
    if (!mounted) return;
    setState(() {});
    _timer?.cancel();
    _timer = Timer(stepDuration, _next);
    // One more frame: the rect is read after layout settles.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  void _next() {
    if (!mounted || !_portal.isShowing) return;
    if (_step == _steps - 1) {
      _finish('done');
      return;
    }
    setState(() => _step++);
    _reveal();
  }

  void _finish(String how) {
    _timer?.cancel();
    // Back to the top of the board, where the student starts.
    final first = _targets.strip.currentContext;
    if (first != null && Scrollable.maybeOf(first) != null) {
      Scrollable.ensureVisible(first, duration: const Duration(milliseconds: 300));
    }
    AppEvents.track('board_tour', props: {'action': how, 'step': _step + 1});
    ref.read(boardTourProvider.notifier).markSeen();
    if (_portal.isShowing) _portal.hide();
  }

  Rect? _rectOf(GlobalKey key) {
    final box = key.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }
}

class _TourLayer extends StatelessWidget {
  const _TourLayer({
    required this.step,
    required this.steps,
    required this.target,
    required this.onTargetTap,
  });

  final int step;
  final int steps;
  final Rect? target;
  final VoidCallback? onTargetTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final media = MediaQuery.of(context);
    final screen = media.size;
    final hole = target?.inflate(6);
    final (label, icon) = switch (step) {
      0 => (l.btCount, Icons.tag),
      1 => (l.btVisa, null),
      2 => (l.btStrip, Icons.auto_awesome_outlined),
      3 => (l.btField, Icons.touch_app_outlined),
      4 => (l.btCity, Icons.place_outlined),
      5 => (l.btDegree, Icons.school_outlined),
      6 => (l.btTopik, Icons.translate),
      7 => (l.btIelts, Icons.language),
      8 => (l.btFee, Icons.payments_outlined),
      9 => (l.btType, Icons.account_balance_outlined),
      10 => (l.btGrant, Icons.card_giftcard_outlined),
      _ => (l.btList, Icons.format_list_bulleted),
    };

    return Stack(
      children: [
        Positioned.fill(
          child: TweenAnimationBuilder<Rect?>(
            tween: RectTween(end: hole),
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
            builder: (context, rect, _) => _Barrier(
              hole: rect,
              onHoleTap: onTargetTap,
              child: CustomPaint(painter: _DimPainter(rect), size: Size.infinite),
            ),
          ),
        ),
        if (hole != null)
          _Label(
            hole: hole,
            screen: screen,
            // Below a section in the top half of the screen, above one in
            // the bottom half, so the label never covers it.
            above: hole.center.dy > screen.height / 2,
            align: switch (step) {
              0 => _Align.start,
              1 => _Align.end,
              _ => _Align.center,
            },
            child: _Pill(
              label: label,
              icon: icon == null
                  ? const Lucide(LucideIcons.plane, size: 16, color: FdColors.onLime)
                  : Icon(icon, size: 17, color: FdColors.onLime),
            ),
          ),
      ],
    );
  }
}

enum _Align { start, center, end }

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
  final _Align align;
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
          _Align.start => Alignment.centerLeft,
          _Align.center => Alignment.center,
          _Align.end => Alignment.centerRight,
        },
        child: Padding(
          padding: EdgeInsets.only(
            left: align == _Align.start ? (hole.left - margin).clamp(0, screen.width) : 0,
            right: align == _Align.end ? (screen.width - hole.right - margin).clamp(0, screen.width) : 0,
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

/// Swallows every touch except those on the lit section, which go through to
/// the board underneath ([onHoleTap] hears them first).
class _Barrier extends SingleChildRenderObjectWidget {
  const _Barrier({required this.hole, required this.onHoleTap, super.child});

  final Rect? hole;
  final VoidCallback? onHoleTap;

  @override
  _RenderBarrier createRenderObject(BuildContext context) => _RenderBarrier(hole, onHoleTap);

  @override
  void updateRenderObject(BuildContext context, _RenderBarrier renderObject) {
    renderObject
      ..hole = hole
      ..onHoleTap = onHoleTap;
  }
}

class _RenderBarrier extends RenderProxyBox {
  _RenderBarrier(this.hole, this.onHoleTap);

  Rect? hole;
  VoidCallback? onHoleTap;

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    final h = hole;
    if (h != null && h.contains(localToGlobal(position))) {
      // Not from inside the hit test: the tour closes after the touch is
      // delivered to the board.
      final tap = onHoleTap;
      if (tap != null) scheduleMicrotask(tap);
      return false;
    }
    result.add(BoxHitTestEntry(this, position));
    return true;
  }
}
