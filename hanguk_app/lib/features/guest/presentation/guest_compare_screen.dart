import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../map/data/map_repository.dart';
import '../../map/domain/university.dart';
import '../data/guest_compare_provider.dart';

/// Guest Compare (DESIGN_SPEC screen 10) — two glass columns side by side.
///
/// The prototype's rows are City, Rank, Tuition, TOPIK, Deadline, Status.
/// Only City survives contact with the data: `v_institutions_for_map` has no
/// rank, no tuition, no TOPIK requirement, and `next_event_at` is null for
/// every row. Rather than render six labels with four blanks — or worse,
/// invent numbers — the grid shows the fields that exist: city, tier, IEQAS
/// accreditation, partner status and the official domain.
class GuestCompareScreen extends ConsumerWidget {
  const GuestCompareScreen({
    super.key,
    required this.onExplore,
    required this.onJoin,
  });

  final VoidCallback onExplore;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final ids = ref.watch(guestCompareProvider);
    final unisAsync = ref.watch(universitiesProvider);

    final picked = unisAsync.maybeWhen(
      data: (unis) => [
        for (final id in ids)
          unis
              .where((u) => u.id == id)
              .cast<University?>()
              .firstWhere((u) => true, orElse: () => null),
      ].whereType<University>().toList(growable: false),
      orElse: () => const <University>[],
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        4,
        SeoulSizes.screenPadding,
        SeoulSizes.orbClearance,
      ),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _CompareColumn(
                university: picked.isNotEmpty ? picked[0] : null,
                onRemove: picked.isNotEmpty
                    ? () => ref
                          .read(guestCompareProvider.notifier)
                          .remove(picked[0].id)
                    : null,
                onAdd: onExplore,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _CompareColumn(
                university: picked.length > 1 ? picked[1] : null,
                onRemove: picked.length > 1
                    ? () => ref
                          .read(guestCompareProvider.notifier)
                          .remove(picked[1].id)
                    : null,
                onAdd: onExplore,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        LimeButton(label: l.guestCompareApplyCta, onPressed: onJoin),
        const SizedBox(height: 10),
        Text(
          l.guestCompareReassurance,
          textAlign: TextAlign.center,
          style: SeoulType.caption,
        ),
      ],
    );
  }
}

/// One column: either a university card or the dashed empty slot.
class _CompareColumn extends StatelessWidget {
  const _CompareColumn({
    required this.university,
    required this.onRemove,
    required this.onAdd,
  });

  final University? university;
  final VoidCallback? onRemove;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = university;

    if (u == null) {
      return _EmptySlot(label: l.guestCompareEmptySlot, onTap: onAdd);
    }

    final rows = <({String label, String ko, String value, bool lime})>[
      (label: l.guestRowCity, ko: '도시', value: u.location, lime: false),
      if (u.tier != null)
        (
          label: l.guestRowTier,
          ko: '등급',
          value: u.tier.toString(),
          lime: false,
        ),
      if (u.ieqasStatus != null)
        (label: l.guestRowIeqas, ko: '인증', value: u.ieqasStatus!, lime: false),
      (
        label: l.guestRowPartner,
        ko: '파트너',
        value: u.isPartner ? l.guestValueYes : l.guestValueNo,
        lime: u.isPartner,
      ),
      if (u.primaryDomain != null)
        (
          label: l.guestRowWebsite,
          ko: '웹사이트',
          value: u.primaryDomain!,
          lime: false,
        ),
    ];

    return GlassCard(
      radius: SeoulRadii.tile,
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HangulGlyphTile(
                glyph: HangulGlyphTile.firstSyllable(u.nameKo),
                size: 38,
              ),
              const Spacer(),
              Semantics(
                button: true,
                label: MaterialLocalizations.of(context).deleteButtonTooltip,
                child: GestureDetector(
                  onTap: onRemove,
                  behavior: HitTestBehavior.opaque,
                  child: const SizedBox(
                    width: SeoulSizes.minTapTarget,
                    height: SeoulSizes.minTapTarget,
                    child: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: SeoulColors.textFaint,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            u.name,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: SeoulType.subtitle,
          ),
          if (u.nameKo != null) ...[
            const SizedBox(height: 2),
            Text(
              u.nameKo!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: SeoulType.hangulLabel,
            ),
          ],
          const SizedBox(height: 14),
          for (final r in rows) ...[
            _CompareRow(label: r.label, ko: r.ko, value: r.value, lime: r.lime),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _CompareRow extends StatelessWidget {
  const _CompareRow({
    required this.label,
    required this.ko,
    required this.value,
    required this.lime,
  });

  final String label;
  final String ko;
  final String value;
  final bool lime;

  @override
  Widget build(BuildContext context) {
    // Stacked, not a two-column Row: at two-per-screen these columns are
    // ~150dp wide, and a label beside a value overflows there in every
    // locale.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: SeoulType.caption.copyWith(color: SeoulColors.textFaint),
              ),
            ),
            const SizedBox(width: 4),
            Text(ko, style: SeoulType.hangulStatus),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: SeoulType.body.copyWith(
            fontWeight: FontWeight.w700,
            color: lime ? SeoulColors.lime : SeoulColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

/// The dashed "+ Add from Explore 탐색에서 추가" slot.
class _EmptySlot extends StatelessWidget {
  const _EmptySlot({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: CustomPaint(
          painter: const _DashedBorderPainter(),
          child: Container(
            height: 190,
            alignment: Alignment.center,
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.add_rounded,
                  color: SeoulColors.textFaint,
                  size: 26,
                ),
                const SizedBox(height: 10),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: SeoulType.caption,
                ),
                const SizedBox(height: 4),
                Text(
                  '탐색에서 추가',
                  textAlign: TextAlign.center,
                  style: SeoulType.hangulStatus,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = SeoulColors.glassBorder
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(SeoulRadii.tile),
    );

    // Walk the rounded rect and paint 6-on / 5-off.
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + 6;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0.0, metric.length)),
          paint,
        );
        distance = next + 5;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) => false;
}
