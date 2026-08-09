import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../map/data/map_repository.dart';
import '../../map/domain/university.dart';
import '../../uni_db/data/uni_db_providers.dart';
import '../../uni_db/domain/institution_facts.dart';
import '../../uni_db/presentation/event_labels.dart';
import '../data/guest_compare_provider.dart';

/// Guest Compare (DESIGN_SPEC screen 10) — two glass columns side by side.
///
/// The prototype's rows are City, Rank, Tuition, TOPIK, Deadline, Status.
/// City, tier, IEQAS accreditation, partner status and the official domain
/// come from `v_institutions_for_map`, which the [University] rows carry.
///
/// Tuition, TOPIK and Deadline are *not* on that view — which is why this
/// screen used to omit them — but they do exist, one level down, in the
/// `tuition`, `requirements` and `cycle_dates` tables behind the reviewed
/// admission cycles. [compareFactsProvider] reduces those into an
/// [InstitutionFacts] per institution, so the prototype's rows can finally
/// be rendered from real data.
///
/// The rule the screen was built on still holds: a row appears only when its
/// value is real. An institution whose guideline has not been parsed and
/// reviewed yet simply shows fewer rows — nothing is invented, and nothing
/// blank is labelled.
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

    // One bulk fetch for both columns. Keyed by the csv of the picked ids,
    // so it re-runs when the tray changes and caches while it doesn't.
    final facts = ref
        .watch(compareFactsProvider(picked.map((u) => u.id).join(',')))
        .valueOrNull;

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
                facts: picked.isNotEmpty ? facts?[picked[0].id] : null,
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
                facts: picked.length > 1 ? facts?[picked[1].id] : null,
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
    required this.facts,
    required this.onRemove,
    required this.onAdd,
  });

  final University? university;

  /// Tuition / TOPIK / deadline / scholarships for this column, or null
  /// while the bulk query is in flight or if the institution has no
  /// reviewed guideline. Null simply means those rows are omitted.
  final InstitutionFacts? facts;

  final VoidCallback? onRemove;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = university;

    if (u == null) {
      return _EmptySlot(label: l.guestCompareEmptySlot, onTap: onAdd);
    }

    final f = facts;
    final rows = <({String label, String ko, String value, bool lime})>[
      // The three the prototype asked for, now that there is somewhere real
      // to read them from. Each is omitted rather than blanked when the
      // institution's guideline has not been parsed and reviewed yet.
      if (f != null && f.tuitionLabel != null)
        (
          label: l.uniDbColTuition,
          ko: '등록금',
          value: f.tuitionLabel!,
          lime: false,
        ),
      if (f != null && f.hasRequirementsRow)
        (
          label: l.uniDbColKorean,
          ko: '한국어',
          // A reviewed cycle that sets no TOPIK floor is a real answer, and
          // a materially good one for a beginner — worth the row.
          value: f.topikLabel ?? l.uniDbTopikNoMinimum,
          lime: false,
        ),
      if (f != null && f.nextDeadlineAt != null && f.nextDeadlineEvent != null)
        (
          label: eventLabel(l, f.nextDeadlineEvent!),
          ko: '일정',
          value: DateFormat.yMMMd().format(f.nextDeadlineAt!),
          lime: false,
        ),
      if (f != null && f.scholarshipCount > 0)
        (
          label: l.uniDbScholarshipsHeading,
          ko: '장학금',
          value: l.uniDbScholarshipsCount(f.scholarshipCount),
          lime: true,
        ),
      // `city_ko` is null for 87 of 204 institutions and the repository
      // substitutes the English literal 'South Korea'. Showing that under
      // "City" would present a country as a city, so the row is omitted
      // rather than filled with a placeholder.
      if (u.hasRealCity)
        (label: l.guestRowCity, ko: '도시', value: u.location, lime: false),
      if (u.tier != null)
        (
          label: l.guestRowTier,
          ko: '등급',
          // Not the bare integer: the scale is inverted (0 is best) and
          // unlabelled, so "1" against "3" reads backwards.
          value: l.universityTier(u.tier!),
          lime: false,
        ),
      // 'none' is a real value for 74 of 204 rows and means *not accredited*
      // — rendering it verbatim puts the word "none" in a blue chip under
      // "IEQAS status". Only an actual accreditation is worth a row.
      if (u.isAccredited)
        (label: l.guestRowIeqas, ko: '인증', value: u.ieqasStatus!, lime: false),
      // Partnership is a claim, and it is false for every institution in the
      // catalogue today. Stating "Hanguk partner: No" on every column of
      // every comparison — on the same screen as the join CTA — is worse
      // than saying nothing.
      if (u.isPartner)
        (
          label: l.guestRowPartner,
          ko: '파트너',
          value: l.guestValueYes,
          lime: true,
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
