import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';

/// One entry in the 한 orb speed-dial.
class HanOrbItem {
  const HanOrbItem({
    required this.label,
    required this.ko,
    required this.glyph,
    required this.onTap,
    this.active = false,
  });

  /// English title shown on the pill.
  final String label;

  /// Small hangul label under the title.
  final String ko;

  /// Single syllable rendered in the 52px tile.
  final String glyph;

  final VoidCallback onTap;

  /// The section the user is currently in — its tile goes lime.
  final bool active;
}

/// Lets the surrounding shell observe and close the speed-dial.
///
/// The shell needs both: Android's hardware BACK must close an open dial
/// instead of leaving the app, and that decision has to be made in the
/// shell's single [PopScope] (two competing PopScopes in one route both fire
/// on a blocked pop, which would close the dial *and* navigate).
class HanOrbController extends ValueNotifier<bool> {
  HanOrbController() : super(false);

  VoidCallback? _closeHandler;

  /// Collapse the dial if it is open. No-op otherwise.
  void close() => _closeHandler?.call();
}

/// The 한 orb: the app's only global navigation (DESIGN_SPEC §2).
///
/// A 62px lime circle in the bottom-right corner with a slow pulse ring. Tap
/// it and the glyph rotates into a ✕ while a blurred scrim dims the screen and
/// the items fan upward with a 40ms stagger.
///
/// This widget renders *only* the orb and its overlay — it expects to be the
/// last child of a [Stack] that fills the screen, so the scrim covers the
/// content beneath it.
class HanOrb extends StatefulWidget {
  const HanOrb({super.key, required this.items, this.tooltip, this.controller});

  final List<HanOrbItem> items;

  /// Accessibility label for the orb itself. This opens a menu — it must not
  /// be named after any single destination.
  final String? tooltip;

  final HanOrbController? controller;

  @override
  State<HanOrb> createState() => _HanOrbState();
}

class _HanOrbState extends State<HanOrb> with TickerProviderStateMixin {
  late final AnimationController _dial = AnimationController(
    vsync: this,
    duration: SeoulMotion.base,
  );

  /// Continuous breath behind the orb. Never stops — it is what makes the
  /// orb read as the live control on an otherwise still screen.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: SeoulMotion.pulse,
  )..repeat();

  bool _open = false;

  @override
  void initState() {
    super.initState();
    widget.controller?._closeHandler = _close;
  }

  @override
  void didUpdateWidget(covariant HanOrb oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.controller, widget.controller)) {
      oldWidget.controller?._closeHandler = null;
      widget.controller?._closeHandler = _close;
      widget.controller?.value = _open;
    }
  }

  @override
  void dispose() {
    widget.controller?._closeHandler = null;
    _dial.dispose();
    _pulse.dispose();
    super.dispose();
  }

  void _setOpen(bool open) {
    setState(() => _open = open);
    widget.controller?.value = open;
    if (open) {
      _dial.forward();
    } else {
      _dial.reverse();
    }
  }

  void _toggle() => _setOpen(!_open);

  void _close() {
    if (!_open) return;
    _setOpen(false);
  }

  void _select(HanOrbItem item) {
    _close();
    // Let the dial start collapsing before the section swaps, so the
    // transition doesn't happen behind a fully-opaque scrim. The shell can be
    // torn down inside that window (forced update dialog, sign-out redirect),
    // so the callback must not run against a dead element.
    Future<void>.delayed(SeoulMotion.fast).then((_) {
      if (mounted) item.onTap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    // Distance from the bottom of the screen to the first dial row.
    final dialBottom =
        SeoulSizes.orbBottom + SeoulSizes.orbSize + 18 + media.padding.bottom;
    // A seven-row dial is ~450px tall; on a short phone, or at the OS's
    // largest font setting, it would run off the top of a hard-clipping
    // Stack with no way to reach the first entries. Cap it and let it
    // scroll from the bottom up instead.
    final double dialMaxHeight = math.max(
      120,
      media.size.height - dialBottom - media.padding.top - 24,
    );

    return Stack(
      children: [
        // ── Scrim ────────────────────────────────────────────────────────
        // Only hit-testable while open, so the closed orb never blocks the
        // content underneath it.
        if (_open || _dial.value > 0)
          Positioned.fill(
            child: IgnorePointer(
              ignoring: !_open,
              child: FadeTransition(
                opacity: _dial,
                child: GestureDetector(
                  onTap: _close,
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: const ColoredBox(
                      color: SeoulColors.scrim,
                      child: SizedBox.expand(),
                    ),
                  ),
                ),
              ),
            ),
          ),

        // ── Dial items ───────────────────────────────────────────────────
        Positioned(
          right: SeoulSizes.orbRight,
          bottom: dialBottom,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: dialMaxHeight),
            child: IgnorePointer(
              ignoring: !_open,
              child: SingleChildScrollView(
                // Anchored at the bottom: the nearest-the-thumb entries are
                // always the ones on screen.
                reverse: true,
                physics: const ClampingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < widget.items.length; i++)
                      _DialRow(
                        item: widget.items[i],
                        controller: _dial,
                        // Bottom item leads; the stagger walks up the column.
                        order: widget.items.length - 1 - i,
                        onTap: () => _select(widget.items[i]),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // ── The orb ──────────────────────────────────────────────────────
        Positioned(
          right: SeoulSizes.orbRight,
          bottom: SeoulSizes.orbBottom + media.padding.bottom,
          child: _OrbButton(
            open: _open,
            pulse: _pulse,
            dial: _dial,
            onTap: _toggle,
            tooltip: widget.tooltip,
          ),
        ),
      ],
    );
  }
}

class _OrbButton extends StatelessWidget {
  const _OrbButton({
    required this.open,
    required this.pulse,
    required this.dial,
    required this.onTap,
    this.tooltip,
  });

  final bool open;
  final AnimationController pulse;
  final AnimationController dial;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      expanded: open,
      label: tooltip ?? 'Menu',
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: SeoulSizes.orbSize + 24,
          height: SeoulSizes.orbSize + 24,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Pulse ring — a lime halo that expands and fades, then repeats.
              AnimatedBuilder(
                animation: pulse,
                builder: (context, _) {
                  final t = pulse.value;
                  return IgnorePointer(
                    child: Opacity(
                      opacity: (1 - t) * 0.45,
                      child: Container(
                        width: SeoulSizes.orbSize * (1 + t * 0.38),
                        height: SeoulSizes.orbSize * (1 + t * 0.38),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: SeoulColors.lime.withValues(alpha: 0.55),
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),

              Container(
                width: SeoulSizes.orbSize,
                height: SeoulSizes.orbSize,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: SeoulGradients.limeButton,
                  boxShadow: SeoulShadows.limeGlow,
                ),
                child: AnimatedBuilder(
                  animation: dial,
                  builder: (context, _) {
                    final t = dial.value;
                    return Transform.rotate(
                      angle: t * (math.pi / 2),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Opacity(
                            opacity: 1 - t,
                            child: Text(
                              '한',
                              style: SeoulType.hangulGlyph.copyWith(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: SeoulColors.ink,
                              ),
                            ),
                          ),
                          Opacity(
                            opacity: t,
                            child: const Icon(
                              Icons.close_rounded,
                              size: 26,
                              color: SeoulColors.ink,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A label pill plus a hangul tile, sliding and fading in on its own beat.
class _DialRow extends StatelessWidget {
  const _DialRow({
    required this.item,
    required this.controller,
    required this.order,
    required this.onTap,
  });

  final HanOrbItem item;
  final AnimationController controller;

  /// 0 = first to appear.
  final int order;
  final VoidCallback onTap;

  /// The staggered curve, evaluated by hand.
  ///
  /// The obvious spelling is a [CurvedAnimation] with an [Interval], but its
  /// constructor registers a status listener on the parent that only
  /// `dispose()` removes — and this runs in `build()`, once per row, on every
  /// open, close and shell rebuild. Arithmetic keeps it allocation-free.
  double _progress() {
    final v = controller.value.clamp(0.0, 1.0);
    // Collapsing: every row leaves together, so the dial doesn't linger.
    if (controller.status == AnimationStatus.reverse) {
      return Curves.easeIn.transform(v);
    }
    // 40ms stagger expressed as an interval over the 300ms dial animation.
    final start = (order * 0.10).clamp(0.0, 0.6);
    final local = ((v - start) / (1.0 - start)).clamp(0.0, 1.0);
    return SeoulMotion.springy.transform(local);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        // `springy` overshoots past 1.0 — that is the point for the scale, but
        // Opacity rejects anything outside 0..1.
        final t = _progress();
        return Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 18),
            child: Transform.scale(scale: 0.9 + 0.1 * t, child: child),
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Semantics(
          button: true,
          selected: item.active,
          label: item.label,
          child: GestureDetector(
            onTap: onTap,
            behavior: HitTestBehavior.opaque,
            // The pill already carries the label; without this a screen
            // reader would read the English title, then the decorative
            // hangul, then the glyph tile.
            child: ExcludeSemantics(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Label pill
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: SeoulColors.glass,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: SeoulColors.glassBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          item.label,
                          style: SeoulType.subtitle.copyWith(fontSize: 14),
                        ),
                        Text(
                          item.ko,
                          style: SeoulType.hangulStatus.copyWith(
                            color: item.active
                                ? SeoulColors.lime
                                : SeoulColors.textFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Hangul tile — lime when this is the section you're in.
                  HangulGlyphTile(
                    glyph: item.glyph,
                    size: SeoulSizes.dialTile,
                    active: item.active,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
