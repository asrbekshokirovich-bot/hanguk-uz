import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/analytics/app_events.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/board_tour.dart';

/// What the tour points at, in order: the field tiles, the count, the visa
/// gauge, the "N ta universitetni ko'rish" button.
class BoardTourTargets {
  final field = GlobalKey(debugLabel: 'tour-field');
  final count = GlobalKey(debugLabel: 'tour-count');
  final visa = GlobalKey(debugLabel: 'tour-visa');
  final button = GlobalKey(debugLabel: 'tour-button');

  List<GlobalKey> get inOrder => [field, count, visa, button];
}

/// The home board's first-run tour (design 12a–12d): one section lit at a
/// time, everything else dimmed under it — the tab bar too — with a single
/// lime label beside the lit section and, at the top, "O'tkazish", the
/// progress dots and "Keyingi →" ("Boshlash ✓" on the last). The lit section
/// stays usable: a field can be picked on the first step.
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

  static const int _steps = 4;

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
        onNext: _next,
        onSkip: () => _finish('skip'),
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

  /// Scrolls the step's section into view (a short phone may have the
  /// field tiles below the fold), then redraws the light on it.
  Future<void> _reveal() async {
    final ctx = _targets.inOrder[_step].currentContext;
    if (ctx != null && Scrollable.maybeOf(ctx) != null) {
      await Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 250),
        alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
      );
    }
    if (mounted) setState(() {});
    // One more frame: the rect is read after layout settles.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  void _next() {
    if (_step == _steps - 1) {
      _finish('done');
      return;
    }
    setState(() => _step++);
    _reveal();
  }

  void _finish(String how) {
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
    required this.onNext,
    required this.onSkip,
    required this.onTargetTap,
  });

  final int step;
  final int steps;
  final Rect? target;
  final VoidCallback onNext;
  final VoidCallback onSkip;
  final VoidCallback? onTargetTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final media = MediaQuery.of(context);
    final screen = media.size;
    final hole = target?.inflate(step == 0 ? 8 : 6);
    final last = step == steps - 1;
    final (label, icon) = switch (step) {
      0 => (l.btField, Icons.touch_app_outlined),
      1 => (l.btCount, Icons.tag),
      2 => (l.btVisa, null),
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
              child: CustomPaint(
                painter: _DimPainter(rect, topBand: media.padding.top + 48),
                size: Size.infinite,
              ),
            ),
          ),
        ),
        if (hole != null)
          _Label(
            hole: hole,
            screen: screen,
            above: step == 0 || step == steps - 1,
            align: switch (step) {
              1 => _Align.start,
              2 => _Align.end,
              _ => _Align.center,
            },
            child: _Pill(
              label: label,
              icon: icon == null
                  ? const Lucide(LucideIcons.plane, size: 16, color: FdColors.onLime)
                  : Icon(icon, size: 17, color: FdColors.onLime),
            ),
          ),
        Positioned(
          top: media.padding.top + 6,
          right: 16,
          child: Row(
            children: [
              Semantics(
                button: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onSkip,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                    child: Text(l.btSkip, style: fdText(13, FontWeight.w800, Colors.white)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              for (var i = 0; i < steps; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: i == step ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i == step
                        ? Colors.white
                        : i < step
                        ? FdColors.lime
                        : Colors.white.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ],
              const SizedBox(width: 12),
              Semantics(
                button: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onNext,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                    child: Text(
                      last ? '${l.btStart} ✓' : '${l.fdNext} →',
                      style: fdText(13, FontWeight.w800, FdColors.ink, height: 1.1),
                    ),
                  ),
                ),
              ),
            ],
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
        Text(label, style: fdText(14, FontWeight.w800, FdColors.onLime, height: 1.1)),
      ],
    ),
  );
}

/// The dim over everything but the lit section, its lime outline and glow.
class _DimPainter extends CustomPainter {
  const _DimPainter(this.hole, {required this.topBand});

  final Rect? hole;

  /// The strip the tour's own bar sits on: dimmed further, so the board's
  /// title under it does not read through.
  final double topBand;

  static const double _radius = 20;

  @override
  void paint(Canvas canvas, Size size) {
    final screen = Path()..addRect(Offset.zero & size);
    final dim = Paint()..color = const Color(0xD9050B26);
    final h = hole;
    if (h == null) {
      canvas.drawPath(screen, dim);
      _band(canvas, size);
      return;
    }
    final rrect = RRect.fromRectAndRadius(h, const Radius.circular(_radius));
    canvas.drawPath(Path.combine(PathOperation.difference, screen, Path()..addRRect(rrect)), dim);
    _band(canvas, size);
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

  void _band(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, topBand),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xF2050B26), Color(0xE6050B26), Color(0x00050B26)],
          stops: [0, 0.75, 1],
        ).createShader(Rect.fromLTWH(0, 0, size.width, topBand)),
    );
  }

  @override
  bool shouldRepaint(_DimPainter old) => old.hole != hole || old.topBand != topBand;
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
