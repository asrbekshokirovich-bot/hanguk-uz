import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/catalog_compare_provider.dart';
import '../data/catalog_repository.dart';
import 'catalog_compare_screen.dart';

/// The bar at the bottom of the catalogue while compare mode is on (design
/// 3a): the two picked universities, or "Tanlang" for an empty slot, and the
/// "Taqqoslash" button, which opens [CatalogCompareScreen] once both are
/// picked. It takes the 한 orb's place, so the host shows one or the other.
///
/// Positions itself: it must be a direct child of the host's full-screen
/// [Stack].
class CatalogCompareTray extends ConsumerWidget {
  const CatalogCompareTray({super.key, required this.isGuest});

  /// Passed on to the compare screen.
  final bool isGuest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final compare = ref.watch(catalogCompareProvider);
    if (!compare.active) return const SizedBox.shrink();

    final all = ref.watch(catalogProvider).value ?? const [];
    final names = [
      for (final id in compare.ids)
        all.where((u) => u.institutionId == id).firstOrNull?.displayName ?? '',
    ];
    final ready = compare.ids.length == CatalogCompareState.maxSlots;

    return Positioned(
      left: 10,
      right: 10,
      bottom: 10 + MediaQuery.paddingOf(context).bottom,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          // CSS `backdrop-filter: blur(16px)` — the value is the sigma.
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xF2132A4D), // rgba(19,42,77,.95)
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0x24FFFFFF)), // .14
            ),
            child: Row(
              children: [
                Expanded(child: _Slots(names: names, empty: l.compareTraySlotEmpty)),
                const SizedBox(width: 8),
                Semantics(
                  button: true,
                  enabled: ready,
                  child: GestureDetector(
                    onTap: ready ? () => CatalogCompareScreen.open(context, isGuest: isGuest) : null,
                    behavior: HitTestBehavior.opaque,
                    child: Opacity(
                      opacity: ready ? 1 : 0.4,
                      child: Container(
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: SeoulColors.lime,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(l.compareTrayCta, style: _inter(13, FontWeight.w700, SeoulColors.ink)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The two slots, sized like the design's flexbox: each takes half of the
/// free width on top of its own padding (20) or border (2), so a filled slot
/// next to an empty one is 18px wider.
class _Slots extends StatelessWidget {
  const _Slots({required this.names, required this.empty});

  final List<String> names;
  final String empty;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final bases = [
          for (var i = 0; i < CatalogCompareState.maxSlots; i++) i < names.length ? 20.0 : 2.0,
        ];
        final free = box.maxWidth - 8 * (bases.length - 1) - bases.fold(0.0, (a, b) => a + b);
        return Row(
          children: [
            for (var i = 0; i < bases.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              SizedBox(
                width: bases[i] + free / bases.length,
                child: i < names.length ? _FilledSlot(name: names[i]) : _EmptySlot(label: empty),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _FilledSlot extends StatelessWidget {
  const _FilledSlot({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: const Color(0x1AFFFFFF), // .1
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        name,
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.ellipsis,
        style: _inter(11, FontWeight.w700, Colors.white),
      ),
    );
  }
}

class _EmptySlot extends StatelessWidget {
  const _EmptySlot({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: const _DashedBorderPainter(),
      child: Container(
        height: 40,
        alignment: Alignment.center,
        child: Text(
          label,
          maxLines: 1,
          softWrap: false,
          overflow: TextOverflow.clip,
          style: _inter(11, FontWeight.w400, const Color(0x80FFFFFF)), // .5
        ),
      ),
    );
  }
}

/// 1px dashed rounded border, rgba(255,255,255,.3), 3 on / 3 off like
/// Chrome draws a 1px `dashed` border.
class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x4DFFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final rrect = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(0.5),
      const Radius.circular(11.5),
    );
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, (d + 3).clamp(0.0, metric.length)), paint);
        d += 6;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) => false;
}

/// Inter at the design's size and weight, CSS `line-height: normal`.
TextStyle _inter(double size, FontWeight weight, Color color) => TextStyle(
  fontFamily: SeoulType.inter,
  fontFamilyFallback: SeoulType.fallback,
  fontSize: size,
  fontWeight: weight,
  height: 1.21,
  color: color,
);
