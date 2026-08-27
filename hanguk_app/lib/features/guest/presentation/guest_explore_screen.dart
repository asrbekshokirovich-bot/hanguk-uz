import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../map/domain/university.dart';
import '../../map/presentation/ieqas_label.dart';
import '../../uni_db/data/approved_universities_provider.dart';
import '../data/guest_compare_provider.dart';

/// Guest Explore — the catalogue browser (DESIGN_SPEC screen 8), redesigned
/// as a two-column card grid (2026-08 discovery-screen redesign).
///
/// The redesign mock (a Pinterest-style product grid) puts four stat rows
/// on every card — contract fee, entry requirement, deadline, dorm price —
/// plus a star rating. Read off `v_guest_approved_admissions` (via
/// [approvedCatalogueProvider], the same source [GuestCompareScreen] already
/// uses), three of those are real: tuition, the TOPIK floor and the document
/// deadline. There is no dorm-price column anywhere in the schema, no GPA
/// requirement, and no rating of any kind — the mock's "4.x" was a hash of
/// the name's length, not a measurement of anything. Only real fields are
/// rendered, and only where that institution's approved review actually
/// carries them: a card renders the rows it has, not a grid of dashes for
/// the fields most institutions don't.
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
    // The approved catalogue, not the bare map list: the redesigned card
    // shows tuition/TOPIK/deadline, which live in `details`
    // (`v_guest_approved_admissions`) alongside the university rows.
    final catalogueAsync = ref.watch(approvedCatalogueProvider);
    final query = ref.watch(guestSearchProvider);
    final city = ref.watch(guestCityFilterProvider);
    final compare = ref.watch(guestCompareProvider);
    final saved = ref.watch(guestSavedProvider);

    return catalogueAsync.when(
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
                onPressed: () => ref.invalidate(approvedCatalogueProvider),
              ),
            ],
          ),
        ),
      ),
      data: (catalogue) {
        final unis = catalogue.universities;
        final details = catalogue.details;
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
            _ExploreHero(
              title: l.guestExploreTitle,
              count: l.guestUniversitiesCount(unis.length),
            ),
            const SizedBox(height: 18),

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
              // Two-column grid, built as manual row pairs rather than a
              // GridView: cards render only the stat rows their university
              // actually has, so heights vary card to card — a fixed-height
              // GridDelegate would either clip the taller cards or leave the
              // shorter ones padded with dead space.
              for (var i = 0; i < results.length; i += 2)
                Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _GuestUniversityGridCard(
                          university: results[i],
                          admission: details[results[i].id],
                          compareSelected: compare.contains(results[i].id),
                          saved: saved.contains(results[i].id),
                          onToggleCompare: () => ref
                              .read(guestCompareProvider.notifier)
                              .toggle(results[i].id),
                          onToggleSaved: () => ref
                              .read(guestSavedProvider.notifier)
                              .toggle(results[i].id),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: i + 1 < results.length
                            ? _GuestUniversityGridCard(
                                university: results[i + 1],
                                admission: details[results[i + 1].id],
                                compareSelected: compare.contains(
                                  results[i + 1].id,
                                ),
                                saved: saved.contains(results[i + 1].id),
                                onToggleCompare: () => ref
                                    .read(guestCompareProvider.notifier)
                                    .toggle(results[i + 1].id),
                                onToggleSaved: () => ref
                                    .read(guestSavedProvider.notifier)
                                    .toggle(results[i + 1].id),
                              )
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
          ],
        );
      },
    );
  }
}

/// The lime-tinted promo card above the search field: title, hangul accent
/// and the catalogue size. Purely chrome — no per-university claim, so
/// unlike the redesign mock it does not carry a global "IEQAS accredited"
/// eyebrow (accreditation varies per institution; see
/// [_GuestUniversityGridCard]).
class _ExploreHero extends StatelessWidget {
  const _ExploreHero({required this.title, required this.count});

  final String title;
  final String count;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: SeoulRadii.cardR,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            SeoulColors.lime.withValues(alpha: 0.16),
            SeoulColors.glass,
          ],
        ),
        border: Border.all(color: SeoulColors.lime.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('나의 대학 찾기', style: SeoulType.hangulLabel),
          const SizedBox(height: 8),
          Text(title, style: SeoulType.display),
          const SizedBox(height: 6),
          Text(count, style: SeoulType.bodySecondary),
        ],
      ),
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

/// 3169000 → "3,169,000". Thousands separators only; the ₩ belongs to the
/// caller so the number formatting stays one job.
String _krw(int value) {
  final s = value.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return b.toString();
}

/// One card in the two-column grid: a logo tile with a save toggle, the
/// name and city, then whichever of tuition / TOPIK / deadline this
/// university's approved review actually established, and a compare toggle.
class _GuestUniversityGridCard extends StatelessWidget {
  const _GuestUniversityGridCard({
    required this.university,
    required this.admission,
    required this.compareSelected,
    required this.saved,
    required this.onToggleCompare,
    required this.onToggleSaved,
  });

  final University university;

  /// What the approved review established for this institution's most
  /// recent intake year, or null if it has none on record.
  final ApprovedAdmission? admission;

  final bool compareSelected;
  final bool saved;
  final VoidCallback onToggleCompare;
  final VoidCallback onToggleSaved;

  String? get _tuition {
    final a = admission;
    final min = a?.tuitionMinKrw;
    if (a == null || min == null) return null;
    final max = a.tuitionMaxKrw;
    return max != null && max != min
        ? '${_krw(min)}–${_krw(max)} ₩'
        : '${_krw(min)} ₩';
  }

  String? get _topik {
    final level = admission?.topikMinLevel;
    return level != null ? '≥ $level' : null;
  }

  /// Document deadline first — it is the date a student actually needs to
  /// hit — falling back to the application window's close.
  String? get _deadline =>
      admission?.documentDeadline ?? admission?.applicationEnd;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final ieqas = ieqasLabel(l, university.ieqasStatus);
    final rows = <(String, String)>[
      if (_tuition != null) (l.guestRowTuition, _tuition!),
      if (_topik != null) (l.guestRowTopik, _topik!),
      if (_deadline != null) (l.guestRowDocDeadline, _deadline!),
    ];

    return GlassCard(
      radius: SeoulRadii.tile,
      blur: false,
      padding: const EdgeInsets.all(12),
      borderColor: compareSelected ? SeoulColors.lime : null,
      fillColor: compareSelected ? SeoulColors.limeFill : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Stack(
              children: [
                Positioned.fill(child: _Logo(university: university)),
                Positioned(
                  top: 6,
                  right: 6,
                  child: _SaveButton(
                    label: l.guestSaveToggle,
                    active: saved,
                    onTap: onToggleSaved,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            university.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: SeoulType.subtitle.copyWith(fontSize: 14),
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
              if (ieqas != null) ...[
                const SizedBox(width: 6),
                Flexible(
                  child: StatusChip(
                    label: ieqas,
                    tone: StatusTone.info,
                    dense: true,
                  ),
                ),
              ],
            ],
          ),
          if (rows.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.only(top: 10),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: SeoulColors.glassBorder),
                ),
              ),
              child: Column(
                children: [
                  for (final r in rows) _StatRow(label: r.$1, value: r.$2),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          _CompareToggleButton(
            label: l.guestNavCompare,
            selected: compareSelected,
            onTap: onToggleCompare,
          ),
        ],
      ),
    );
  }
}

/// The institution's real logo, falling back to the hangul glyph avatar when
/// there is none (or it fails to load) — same treatment as the map detail
/// sheet's `_buildAvatar`, so a student sees the same image both places.
class _Logo extends StatelessWidget {
  const _Logo({required this.university});

  final University university;

  @override
  Widget build(BuildContext context) {
    final url = university.logoUrl;
    final glyph = HangulGlyphTile.firstSyllable(university.nameKo);

    return Container(
      decoration: BoxDecoration(
        color: SeoulColors.glass,
        borderRadius: SeoulRadii.tileR,
        border: Border.all(color: SeoulColors.glassBorder),
      ),
      child: url == null || url.isEmpty
          ? Center(
              child: Text(
                glyph,
                style: SeoulType.hangulGlyph.copyWith(fontSize: 30),
              ),
            )
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Image.network(
                url,
                fit: BoxFit.contain,
                excludeFromSemantics: true,
                errorBuilder: (_, _, _) => Center(
                  child: Text(
                    glyph,
                    style: SeoulType.hangulGlyph.copyWith(fontSize: 30),
                  ),
                ),
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          SeoulColors.textFaint,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

/// Heart toggle over the logo tile — an in-session shortlist, not a saved
/// application or anything persisted (see `guestSavedProvider`).
class _SaveButton extends StatelessWidget {
  const _SaveButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: active,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active
                ? SeoulColors.lime
                : SeoulColors.mapWater.withValues(alpha: 0.72),
            border: Border.all(
              color: active ? SeoulColors.lime : SeoulColors.glassBorder,
            ),
          ),
          child: Icon(
            active ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            size: 15,
            color: active ? SeoulColors.ink : SeoulColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: SeoulType.caption.copyWith(fontSize: 10.5),
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontFamily: SeoulType.inter,
                fontFamilyFallback: SeoulType.fallback,
                fontSize: 11,
                height: 1.3,
                fontWeight: FontWeight.w700,
                color: SeoulColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The per-card "add to compare" action. Reuses [l.guestNavCompare] for both
/// states — the nav tab, the tray count and this button all say the same
/// word ("Taqqoslash"), and the checkmark icon carries the selected state
/// rather than a second competing label.
class _CompareToggleButton extends StatelessWidget {
  const _CompareToggleButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: double.infinity,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: SeoulRadii.buttonR,
            color: selected ? SeoulColors.lime : SeoulColors.glass,
            border: Border.all(
              color: selected ? SeoulColors.lime : SeoulColors.glassBorder,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                selected ? Icons.check_rounded : Icons.add_rounded,
                size: 15,
                color: selected ? SeoulColors.ink : SeoulColors.textSecondary,
              ),
              const SizedBox(width: 5),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: SeoulType.inter,
                  fontFamilyFallback: SeoulType.fallback,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? SeoulColors.ink
                      : SeoulColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
