import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_slider.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../data/field_filter.dart';
import 'discover_routes.dart';

/// What the filter board's choices leave of [all], with the field search's
/// answer for the chosen field folded in.
List<CatalogUniversity> boardResults(WidgetRef ref, List<CatalogUniversity> all, CatalogFilter f) {
  final matches = f.field == null ? null : ref.watch(fieldUniversitiesProvider(f.field!)).value;
  return applyCatalogFilter(all, f.copyWith(query: ''), fieldMatches: matches);
}

/// A field tile's label ("IT", "Muhandislik").
String fieldLabel(AppLocalizations l, String key) => switch (key) {
  'it' => l.fdFieldIt,
  'business' => l.fdFieldBusiness,
  'engineering' => l.fdFieldEngineering,
  'medicine' => l.fdFieldMedicine,
  'design' => l.fdFieldDesign,
  'tourism' => l.fdFieldTourism,
  'education' => l.fdFieldEducation,
  _ => key,
};

/// A city group's label: the design's own names, two of them translated.
String regionLabel(AppLocalizations l, String region) => switch (region) {
  CatalogRegion.seoul => l.fdRegionSeoul,
  CatalogRegion.other => l.fdOther,
  _ => region,
};

/// "Muhandislik · TOPIK ≤3 · ₩2 000 000 gacha": the board's choices in one
/// line, for the results' search field (design screen 06). Null when none.
String? filterSummary(AppLocalizations l, CatalogFilter f) {
  final parts = [
    if (f.field != null) fieldLabel(l, f.field!),
    for (final r in f.regions) regionLabel(l, r),
    if (f.degree == CatalogDegree.bachelor) l.catalogDegreeBachelor,
    if (f.degree == CatalogDegree.master) l.catalogDegreeMaster,
    if (f.topik == CatalogTopik.none) 'TOPIK: ${l.fdTopikNone}' else if (f.topik != null) 'TOPIK ≤${f.topik}',
    if (f.maxPrice != null) l.fdFeeUpTo(money(f.maxPrice!, 'KRW', locale: l.localeName)),
    if (f.type == 'state') l.catalogTypeStateShort,
    if (f.type == 'private') l.catalogTypePrivateShort,
  ];
  return parts.isEmpty ? null : parts.join(' · ');
}

/// Design screen 05, "Filtr doskasi — son jonli o'zgaradi": the count of
/// matching universities and its 50-tick meter, then Yo'nalish, Shahar,
/// Daraja, the TOPIK requirement, the fee ceiling and the type. Every choice
/// updates the count at once.
class FilterBoardScreen extends ConsumerWidget {
  const FilterBoardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final notifier = ref.read(catalogFilterProvider.notifier);
    final fieldLoading = f.field != null && ref.watch(fieldUniversitiesProvider(f.field!)).isLoading;
    final results = boardResults(ref, all, f);
    final bounds = priceBounds(all);

    void set(CatalogFilter next) => notifier.set(next);



    final fee = f.maxPrice;
    final feeShare = fee == null ? 1.0 : ((fee - bounds.min) / (bounds.max - bounds.min)).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          bottom: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: () => context.pop(),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Wrap(
                        crossAxisAlignment: WrapCrossAlignment.end,
                        children: [
                          Text('${l.fdFilterTitleLead} ', style: _title),
                          LimeMark(l.fdFilterTitleMark, style: _title),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Semantics(
                      button: true,
                      child: GestureDetector(
                        onTap: () => set(f.cleared()),
                        child: Container(
                          height: 30,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: FdColors.ink, width: 1.5),
                          ),
                          child: Text(l.catalogFilterClear, style: fdText(11, FontWeight.w700, FdColors.ink)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _CountCard(count: results.length, total: all.length, loading: fieldLoading),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                  children: [
                    FdSectionLabel(l.fdSectionField),
                    const SizedBox(height: 8),
                    _Grid(
                      columns: 4,
                      children: [
                        for (final t in kFieldTiles)
                          HardChoice(
                            label: fieldLabel(l, t.key),
                            glyph: t.glyph,
                            height: 64,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            selected: f.field == t.key,
                            onTap: () => set(f.copyWith(field: () => f.field == t.key ? null : t.key)),
                          ),
                        HardChoice(
                          label: l.fdOther,
                          glyph: LucideIcons.layers,
                          height: 64,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          selected: false,
                          onTap: () => context.push(kDiscoverSearchPath),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FdSectionLabel(l.fdSectionCity),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final r in CatalogRegion.all)
                          // As wide as its label: a centred choice would
                          // otherwise fill the Wrap's whole row.
                          IntrinsicWidth(
                            child: HardChoice(
                              label: regionLabel(l, r),
                              height: 34,
                              radius: 999,
                              fontSize: 12,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              selected: f.regions.contains(r),
                              onTap: () {
                                final next = {...f.regions};
                                next.contains(r) ? next.remove(r) : next.add(r);
                                set(f.copyWith(regions: next));
                              },
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FdSectionLabel(l.fdSectionDegree),
                    const SizedBox(height: 8),
                    _Grid(
                      columns: 2,
                      children: [
                        for (final d in const [CatalogDegree.bachelor, CatalogDegree.master])
                          HardChoice(
                            label: d == CatalogDegree.bachelor ? l.catalogDegreeBachelor : l.catalogDegreeMaster,
                            selected: f.degree == d,
                            onTap: () => set(f.copyWith(degree: f.degree == d ? CatalogDegree.all : d)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FdSectionLabel(l.fdSectionTopik),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        for (final (i, (value, label, flex)) in [
                          (null, l.fdAny, 3),
                          (CatalogTopik.none, l.fdTopikNone, 3),
                          ('2', '≤ 2', 2),
                          ('3', '≤ 3', 2),
                          ('4', '≤ 4', 2),
                        ].indexed) ...[
                          if (i > 0) const SizedBox(width: 4),
                          Expanded(
                            flex: flex,
                            child: HardChoice(
                              label: label,
                              height: 38,
                              radius: 10,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              selected: f.topik == value,
                              onTap: () => set(f.copyWith(topik: () => value)),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 16),
                    FdSectionLabel(
                      l.fdSectionFee,
                      trailing: LimeTag(
                        fee == null ? l.fdAny : l.fdFeeUpTo(money(fee, 'KRW', locale: l.localeName)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    HardSlider(
                      value: feeShare,
                      semanticLabel: l.fdSectionFee,
                      onChanged: (v) {
                        if (v >= 0.995) {
                          set(f.copyWith(maxPrice: () => null));
                          return;
                        }
                        final raw = bounds.min + (bounds.max - bounds.min) * v;
                        set(f.copyWith(maxPrice: () => (raw / 100000).round() * 100000));
                      },
                    ),
                    const SizedBox(height: 12),
                    FdSectionLabel(l.fdSectionType),
                    const SizedBox(height: 8),
                    _Grid(
                      columns: 3,
                      children: [
                        for (final (value, label) in [
                          ('state', l.catalogTypeStateShort),
                          ('private', l.catalogTypePrivateShort),
                          (null, l.fdAny),
                        ])
                          HardChoice(label: label, selected: f.type == value, onTap: () => set(f.copyWith(type: () => value))),
                      ],
                    ),
                  ],
                ),
              ),
              FdBottomBar(
                child: HardButton(
                  label: l.fdShowUniversities(results.length),
                  onPressed: results.isEmpty ? null : () => context.push(kDiscoverResultsPath),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static final TextStyle _title = fdText(18, FontWeight.w800, FdColors.ink, letterSpacing: -0.36);
}

/// "28 ta mos universitet · 350 tadan" over a 50-tick meter.
class _CountCard extends StatelessWidget {
  const _CountCard({required this.count, required this.total, required this.loading});

  final int count;
  final int total;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final lit = total == 0 ? 0 : (50 * count / total).round().clamp(count > 0 ? 1 : 0, 50);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
      decoration: BoxDecoration(
        color: FdColors.navy,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('$count', style: fdText(46, FontWeight.w800, FdColors.lime, height: 1, letterSpacing: -1.84)),
              const SizedBox(width: 8),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Text(l.fdMatchingUniversities, style: fdText(14, FontWeight.w700, Colors.white)),
                ),
              ),
              if (loading)
                const Padding(
                  padding: EdgeInsets.only(bottom: 6, right: 8),
                  child: SizedBox.square(
                    dimension: 12,
                    child: CircularProgressIndicator(strokeWidth: 1.6, color: SeoulColors.lime),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Text(l.fdOfTotal(total), style: fdText(11, FontWeight.w400, FdColors.onNavyMuted)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 0; i < 50; i++) ...[
                if (i > 0) const SizedBox(width: 2),
                Expanded(
                  child: Container(
                    height: 16,
                    decoration: BoxDecoration(
                      color: i < lit ? FdColors.lime : FdColors.deep,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// Equal columns with the design's 6px gaps.
class _Grid extends StatelessWidget {
  const _Grid({required this.columns, required this.children});

  final int columns;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      rows.add(
        Row(
          children: [
            for (var j = 0; j < columns; j++) ...[
              if (j > 0) const SizedBox(width: 6),
              Expanded(child: i + j < children.length ? children[i + j] : const SizedBox.shrink()),
            ],
          ],
        ),
      );
    }
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[if (i > 0) const SizedBox(height: 6), rows[i]],
      ],
    );
  }
}
