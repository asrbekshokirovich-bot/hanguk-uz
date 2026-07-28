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
  const HanOrb({super.key, required this.items, this.tooltip});

  final List<HanOrbItem> items;
  final String? tooltip;

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
  void dispose() {
    _dial.dispose();
    _pulse.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _open = !_open);
    if (_open) {
      _dial.forward();
    } else {
      _dial.reverse();
    }
  }

  void _close() {
    if (!_open) return;
    setState(() => _open = false);
    _dial.reverse();
  }

  void _select(HanOrbItem item) {
    _close();
    // Let the dial start collapsing before the section swaps, so the
    // transition doesn't happen behind a fully-opaque scrim.
    Future<void>.delayed(SeoulMotion.fast, item.onTap);
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);

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
          bottom:
              SeoulSizes.orbBottom + SeoulSizes.orbSize + 18 + media.padding.bottom,
          child: IgnorePointer(
            ignoring: !_open,
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
                    total: widget.items.length,
                    onTap: () => _select(widget.items[i]),
                  ),
              ],
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
                      angle: t * 1.5708, // 90°
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
    required this.total,
    required this.onTap,
  });

  final HanOrbItem item;
  final AnimationController controller;

  /// 0 = first to appear.
  final int order;
  final int total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // 40ms stagger expressed as an interval over the 300ms dial animation.
    final start = (order * 0.10).clamp(0.0, 0.6);
    final anim = CurvedAnimation(
      parent: controller,
      curve: Interval(start, 1.0, curve: SeoulMotion.springy),
      reverseCurve: Interval(0.0, 1.0, curve: Curves.easeIn),
    );

    return AnimatedBuilder(
      animation: anim,
      builder: (context, child) {
        final t = anim.value.clamp(0.0, 1.0);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 18),
            child: Transform.scale(scale: 0.9 + 0.1 * t, child: child),
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
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
                  color: const Color(0x1FFFFFFF),
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
    );
  }
}
