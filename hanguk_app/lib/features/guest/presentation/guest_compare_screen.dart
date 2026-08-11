import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../map/data/map_repository.dart';
import '../../map/domain/university.dart';
import '../../map/presentation/ieqas_label.dart';
import '../data/guest_compare_provider.dart';

/// Guest Compare (DESIGN_SPEC screen 10) — two glass columns side by side.
///
/// The prototype's rows are City, Rank, Tuition, TOPIK, Deadline, Status.
/// Only City survives contact with the data: `v_institutions_for_map` has no
/// rank, no tuition, no TOPIK requirement, and `next_event_at` is null for
/// every row. Rather than render six labels with four blanks — or worse,
/// invent numbers — the grid shows the fields that exist: city, tier, IEQAS
/// accreditation, partner status and the official domain.
///
/// Which of those five appear is decided ONCE for the pair, not per column.
/// Each column used to build its own row list from its own university, so a
/// school with a tier but no accreditation sat beside one with accreditation
/// but no tier and the labels came out staggered — "Tier" on the left level
/// with "IEQAS" on the right. Two columns whose rows do not line up are not a
/// comparison. A field is now shown when EITHER university has it, and the one
/// that lacks it renders an em dash, so every label sits at the same height in
/// both columns and a missing value reads as missing rather than as absent.
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

    // Pair each id with its row so a slot always knows which id it came
    // from. Dropping unresolvable ids and then indexing the survivors meant
    // the ✕ removed the wrong university: with a tray of ['GHOST', 'a'] the
    // single visible card's ✕ removed 'a', leaving 'GHOST' stranded, one
    // slot permanently lost and no UI path to clear it.
    final catalogue = unisAsync.value;
    final slots = <({String id, University? uni})>[
      for (final id in ids)
        (id: id, uni: catalogue?.where((u) => u.id == id).firstOrNull),
    ];

    // An id the catalogue no longer has — the row left `is_visible_on_map`,
    // or Retry returned a changed set. Once we know it is gone, drop it:
    // silently keeping it would hold a slot hostage and leave Explore's
    // "Compare 1/2" disagreeing with an empty Compare screen.
    if (catalogue != null) {
      final stale = slots.where((s) => s.uni == null).map((s) => s.id).toList();
      if (stale.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final notifier = ref.read(guestCompareProvider.notifier);
          for (final id in stale) {
            notifier.remove(id);
          }
        });
      }
    }

    final picked = slots
        .where((s) => s.uni != null)
        .map((s) => s.uni!)
        .toList(growable: false);

    // The row schema both columns render, decided across the pair.
    final schema = _rowSchema(l, picked);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        4,
        SeoulSizes.screenPadding,
        SeoulSizes.orbClearance,
      ),
      children: [
        // Stretch, not start: with a shared schema the two columns hold the
        // same rows, so matching their heights lets the labels line up across
        // the gap instead of drifting apart under a longer university name.
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _CompareColumn(
                  university: picked.isNotEmpty ? picked[0] : null,
                  schema: schema,
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
                  schema: schema,
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

/// One comparable field: its labels, how to read it off a university, and
/// whether a present value is worth the lime accent.
typedef _RowSpec = ({
  String label,
  String ko,
  String? Function(University) read,
  bool lime,
});

/// Value shown for a university that has nothing for a row the other one does.
const String _missing = '—';

/// The rows to render, chosen across the pair: a field appears when ANY of the
/// picked universities has it. Order is fixed, so the schema is stable while
/// the tray changes and rows do not reshuffle under the reader.
List<_RowSpec> _rowSchema(AppLocalizations l, List<University> picked) {
  final all = <_RowSpec>[
    // `city_ko` is null for 87 of 204 institutions and the repository
    // substitutes the English literal 'South Korea'. Showing that under
    // "City" would present a country as a city, so the value stays null
    // rather than becoming a placeholder.
    (
      label: l.guestRowCity,
      ko: '도시',
      read: (u) => u.hasRealCity ? u.location : null,
      lime: false,
    ),
    (
      label: l.guestRowTier,
      ko: '등급',
      // Not the bare integer: the scale is inverted (0 is best) and
      // unlabelled, so "1" against "3" reads backwards.
      read: (u) => u.tier != null ? l.universityTier(u.tier!) : null,
      lime: false,
    ),
    // `ieqasLabel` returns null for 'none' — a real value for 74 of 204 rows,
    // meaning *not accredited*, which rendered verbatim put the word "none"
    // under "IEQAS status". It also keeps the database enum off the screen:
    // the value here used to be the bare English "outstanding".
    (
      label: l.guestRowIeqas,
      ko: '인증',
      read: (u) => ieqasLabel(l, u.ieqasStatus),
      lime: false,
    ),
    // Partnership is a claim, and it is false for every institution in the
    // catalogue today. Stating "Hanguk partner: No" on every column of every
    // comparison — on the same screen as the join CTA — is worse than saying
    // nothing, so a non-partner reads as the same em dash as any other
    // absent field rather than as a denial.
    (
      label: l.guestRowPartner,
      ko: '파트너',
      read: (u) => u.isPartner ? l.guestValueYes : null,
      lime: true,
    ),
    (
      label: l.guestRowWebsite,
      ko: '웹사이트',
      read: (u) => u.primaryDomain,
      lime: false,
    ),
  ];
  return all
      .where((r) => picked.any((u) => r.read(u) != null))
      .toList(growable: false);
}

/// One column: either a university card or the dashed empty slot.
class _CompareColumn extends StatelessWidget {
  const _CompareColumn({
    required this.university,
    required this.schema,
    required this.onRemove,
    required this.onAdd,
  });

  final University? university;
  final List<_RowSpec> schema;
  final VoidCallback? onRemove;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = university;

    if (u == null) {
      return _EmptySlot(label: l.guestCompareEmptySlot, onTap: onAdd);
    }

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
          for (final r in schema) ...[
            _CompareRow(
              label: r.label,
              ko: r.ko,
              value: r.read(u) ?? _missing,
              // The accent marks a value that is actually there; an em dash
              // in lime would read as a highlighted answer.
              lime: r.lime && r.read(u) != null,
            ),
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
                // `caption` already resolves to textSecondary; textFaint is
                // 3.57:1 here and these labels are the only thing naming
                // each value.
                style: SeoulType.caption,
              ),
            ),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                ko,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: SeoulType.hangulStatus,
              ),
            ),
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
            // A minimum, not a fixed height: at Android's "Large" font the
            // label was already clipped, and at 2x it lost 126px.
            constraints: const BoxConstraints(minHeight: 190),
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
