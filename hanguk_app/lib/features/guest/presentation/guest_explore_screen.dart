import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../map/data/map_repository.dart';
import '../../map/domain/university.dart';
import '../data/guest_compare_provider.dart';

/// Guest Explore — the catalogue browser (DESIGN_SPEC screen 8).
///
/// What the prototype shows and this does not: a faculty filter row, a
/// tuition figure, a rank, and an Open 모집 중 / Closed 마감 status chip.
/// None of those exist in `v_institutions_for_map` — `next_event_at` in
/// particular is null for all 204 rows, so an "open for Spring 2027" chip
/// would be telling a student something nobody knows. Only real fields are
/// rendered; the layout is the prototype's.
class GuestExploreScreen extends ConsumerWidget {
  const GuestExploreScreen({super.key, required this.onOpenCompare});

  final VoidCallback onOpenCompare;

  /// Cities offered as filters: the ones that actually have institutions,
  /// most-populated first, capped so the row stays scannable.
  static List<String> _cityOptions(List<University> unis) {
    final counts = <String, int>{};
    for (final u in unis) {
      // `hasRealCity`, not just non-empty: `city_ko` is null for 87 of 204
      // institutions and the repository substitutes 'South Korea'. Counted as
      // a city it outranked 서울 and led the filter row — a country offered
      // as a city filter, in English.
      if (!u.hasRealCity) continue;
      counts[u.location.trim()] = (counts[u.location.trim()] ?? 0) + 1;
    }
    final cities = counts.keys.toList()
      ..sort((a, b) {
        final byCount = counts[b]!.compareTo(counts[a]!);
        return byCount != 0 ? byCount : a.compareTo(b);
      });
    return cities.take(6).toList(growable: false);
  }

  static List<University> _apply(
    List<University> unis,
    String query,
    String? city,
  ) {
    final q = query.trim().toLowerCase();
    return unis
        .where((u) {
          if (city != null && u.location.trim() != city) return false;
          if (q.isEmpty) return true;
          // Spec: search matches name or city.
          return u.name.toLowerCase().contains(q) ||
              u.location.toLowerCase().contains(q) ||
              (u.nameKo?.toLowerCase().contains(q) ?? false);
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final unisAsync = ref.watch(universitiesProvider);
    final query = ref.watch(guestSearchProvider);
    final city = ref.watch(guestCityFilterProvider);
    final compare = ref.watch(guestCompareProvider);

    return unisAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: SeoulColors.lime),
      ),
      error: (_, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(SeoulSizes.screenPadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l.uniDbLoadFailed,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
              const SizedBox(height: 16),
              SeoulOutlineButton(
                label: l.commonRetry,
                onPressed: () => ref.invalidate(universitiesProvider),
              ),
            ],
          ),
        ),
      ),
      data: (all) {
        // Only the institutions we hold researched admission data for. The
        // catalogue carries 204 visible rows but a published guideline for 45
        // of them; listing all 204 presented a name-and-a-pin as an equal to a
        // school whose deadlines, requirements and documents we have actually
        // read. `hasIntakeData` tracks the CRM's default intake, so a newly
        // approved guideline joins this list on the next refresh and a season
        // rollover drops last season's coverage — no list to maintain.
        final unis = all
            .where((u) => u.hasIntakeData)
            .toList(growable: false);
        final cities = _cityOptions(unis);
        final results = _apply(unis, query, city);

        return ListView(
          padding: const EdgeInsets.fromLTRB(
            SeoulSizes.screenPadding,
            4,
            SeoulSizes.screenPadding,
            SeoulSizes.orbClearance,
          ),
          children: [
            Text(l.guestExploreTitle, style: SeoulType.display),
            const SizedBox(height: 5),
            // The Hangul label and the catalogue size share a line. Stacked,
            // the header ran four deep — title, Hangul, count, then the search
            // field — and pushed the first result off a small screen.
            Row(
              children: [
                Flexible(
                  child: Text(
                    '나의 대학 찾기',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.hangulLabel,
                  ),
                ),
                const SizedBox(width: 8),
                Text('·', style: SeoulType.caption),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    l.guestUniversitiesCount(unis.length),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.caption,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            _SearchField(
              value: query,
              hint: l.searchHint,
              onChanged: (v) => ref.read(guestSearchProvider.notifier).set(v),
            ),
            const SizedBox(height: 14),

            // 도시 — city filter. Values are real `city_ko` strings.
            Text(
              '도시',
              style: SeoulType.eyebrow.copyWith(color: SeoulColors.textFaint),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                SeoulFilterChip(
                  label: l.filterAll,
                  selected: city == null,
                  onTap: () =>
                      ref.read(guestCityFilterProvider.notifier).set(null),
                ),
                for (final c in cities)
                  SeoulFilterChip(
                    label: c,
                    selected: city == c,
                    onTap: () =>
                        ref.read(guestCityFilterProvider.notifier).toggle(c),
                  ),
              ],
            ),
            const SizedBox(height: 18),

            Row(
              children: [
                Expanded(
                  child: Text(
                    // Only once the list is narrowed. Unfiltered, this said
                    // exactly what the header two lines up already said, and
                    // the repetition made the second one read as a different
                    // number the reader had to reconcile.
                    results.length == unis.length
                        ? ''
                        : l.guestUniversitiesCount(results.length),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.caption,
                  ),
                ),
                if (compare.isNotEmpty)
                  Semantics(
                    button: true,
                    label: l.guestCompareCount(compare.length),
                    child: GestureDetector(
                      onTap: onOpenCompare,
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        constraints: const BoxConstraints(
                          minHeight: SeoulSizes.minTapTarget,
                        ),
                        alignment: Alignment.centerRight,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              l.guestCompareCount(compare.length),
                              style: SeoulType.caption.copyWith(
                                color: SeoulColors.lime,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              '비교',
                              style: SeoulType.hangulStatus.copyWith(
                                color: SeoulColors.lime,
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              size: 18,
                              color: SeoulColors.lime,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),

            if (results.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 28),
                child: Column(
                  children: [
                    Text(
                      l.noUniversitiesMatch,
                      textAlign: TextAlign.center,
                      style: SeoulType.bodySecondary,
                    ),
                    const SizedBox(height: 14),
                    SeoulOutlineButton(
                      label: l.clearFilters,
                      onPressed: () {
                        ref.read(guestSearchProvider.notifier).set('');
                        ref.read(guestCityFilterProvider.notifier).set(null);
                      },
                    ),
                  ],
                ),
              )
            else
              for (final u in results)
                _GuestUniversityCard(
                  university: u,
                  selected: compare.contains(u.id),
                  onToggleCompare: () =>
                      ref.read(guestCompareProvider.notifier).toggle(u.id),
                ),
          ],
        );
      },
    );
  }
}

class _SearchField extends StatefulWidget {
  const _SearchField({
    required this.value,
    required this.hint,
    required this.onChanged,
  });

  final String value;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<_SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<_SearchField> {
  late final TextEditingController _c = TextEditingController(
    text: widget.value,
  );

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _SearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Keep in sync when the filter is cleared from elsewhere on the screen.
    if (widget.value != _c.text) _c.text = widget.value;
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _c,
      onChanged: widget.onChanged,
      style: SeoulType.body,
      cursorColor: SeoulColors.lime,
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: SeoulType.bodySecondary,
        prefixIcon: const Icon(
          Icons.search_rounded,
          color: SeoulColors.textFaint,
          size: 20,
        ),
        filled: true,
        fillColor: SeoulColors.glass,
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        border: OutlineInputBorder(
          borderRadius: SeoulRadii.controlR,
          borderSide: const BorderSide(color: SeoulColors.glassBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: SeoulRadii.controlR,
          borderSide: const BorderSide(color: SeoulColors.glassBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: SeoulRadii.controlR,
          borderSide: const BorderSide(color: SeoulColors.lime),
        ),
      ),
    );
  }
}

/// One result row: glyph tile, name, city, and the compare toggle.
class _GuestUniversityCard extends StatelessWidget {
  const _GuestUniversityCard({
    required this.university,
    required this.selected,
    required this.onToggleCompare,
  });

  final University university;
  final bool selected;
  final VoidCallback onToggleCompare;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      radius: SeoulRadii.tile,
      blur: false,
      fillColor: selected ? SeoulColors.limeFill : null,
      borderColor: selected ? SeoulColors.lime : null,
      child: Row(
        children: [
          HangulGlyphTile(
            glyph: HangulGlyphTile.firstSyllable(university.nameKo),
            active: selected,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  university.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        university.location,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SeoulType.caption,
                      ),
                    ),
                    // `isAccredited`, not a null check: `ieqas_status` is
                    // 'none' for 74 of 204 rows, which would render a blue
                    // pill reading "none" next to the university's city.
                    if (university.isAccredited) ...[
                      const SizedBox(width: 8),
                      Flexible(
                        child: StatusChip(
                          label: university.ieqasStatus!,
                          tone: StatusTone.info,
                          dense: true,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Semantics(
            button: true,
            selected: selected,
            label: l.guestNavCompare,
            child: GestureDetector(
              onTap: onToggleCompare,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: SeoulSizes.minTapTarget,
                height: SeoulSizes.minTapTarget,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? SeoulColors.lime : SeoulColors.glass,
                  border: Border.all(
                    color: selected
                        ? SeoulColors.lime
                        : SeoulColors.glassBorder,
                  ),
                  boxShadow: selected ? SeoulShadows.limeGlowSmall : null,
                ),
                child: Icon(
                  selected ? Icons.check_rounded : Icons.add_rounded,
                  size: 20,
                  color: selected ? SeoulColors.ink : SeoulColors.textSecondary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
