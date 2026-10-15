import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_slider.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../../catalog/data/campus_photos.dart';
import '../../assessment/presentation/assessment_widgets.dart' show shortUniversityName;
import '../data/chances.dart';
import '../data/field_filter.dart';
import 'discover_routes.dart';
import 'widgets/chance_badge.dart';
import 'widgets/fd_parts.dart';
import 'widgets/visa_gauge.dart';

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

/// The home, "Qanday universitet kerak?": the count of matching universities
/// beside the D-2 visa gauge, the strip of those matching now, then
/// Yo'nalish, Shahar, Daraja, the TOPIK requirement, the fee ceiling and the
/// type. Every choice updates the count and the strip at once.
///
/// It is the content of the round button's tab; [onShow] (the shell's switch
/// to the list) is what "N ta universitetni ko'rish" does. Pushed on its own
/// (`/guest/filter`) it has a back button and opens the results page.
class FilterBoardScreen extends ConsumerWidget {
  const FilterBoardScreen({super.key, this.onShow, this.showBack = true});

  /// Opens the list; null pushes the results page.
  final VoidCallback? onShow;
  final bool showBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final book = ref.watch(chanceBookProvider);
    final notifier = ref.read(catalogFilterProvider.notifier);
    final fieldLoading = f.field != null && ref.watch(fieldUniversitiesProvider(f.field!)).isLoading;
    var results = boardResults(ref, all, f);
    if (book.answered) {
      results = [...results]..sort((a, b) => (book.admission(b) ?? 0).compareTo(book.admission(a) ?? 0));
    }
    final bounds = priceBounds(all);

    void set(CatalogFilter next) => notifier.set(next);

    final fee = f.maxPrice;
    final feeShare = fee == null ? 1.0 : ((fee - bounds.min) / (bounds.max - bounds.min)).clamp(0.0, 1.0);

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
            child: Row(
              children: [
                if (showBack) ...[
                  HardIconButton(
                    glyph: LucideIcons.chevronLeft,
                    semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                    onTap: () => context.canPop() ? context.pop() : context.go(kDiscoverPath),
                  ),
                  const SizedBox(width: 10),
                ],
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
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      height: 34,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: FdColors.card,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: FdColors.ink, width: 1.5),
                      ),
                      child: Text(l.catalogFilterClear, style: fdText(12, FontWeight.w700, FdColors.ink)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
            child: _CountCard(
              count: results.length,
              total: all.length,
              loading: fieldLoading,
              visa: book.visa,
              onVisa: () => context.push(kAssessmentPath),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 8),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text(l.fdBoardStripTitle, style: fdText(13, FontWeight.w800, FdColors.onPage)),
                    ),
                    Text(l.fdBoardStripHint, style: fdText(10, FontWeight.w700, FdColors.pageMuted)),
                  ],
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 104,
                  // The strip runs to the screen's edges, as the prototype's does.
                  child: OverflowBox(
                    maxWidth: MediaQuery.sizeOf(context).width,
                    child: results.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.fromLTRB(18, 2, 18, 6),
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: CustomPaint(
                                painter: const DashedPillPainter(color: FdColors.pageMuted, radius: 12),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  child: Text(
                                    l.fdBoardStripEmpty,
                                    style: fdText(11, FontWeight.w700, FdColors.pageMuted),
                                  ),
                                ),
                              ),
                            ),
                          )
                        : ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.fromLTRB(18, 2, 18, 6),
                            itemCount: results.length > 14 ? 14 : results.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 8),
                            itemBuilder: (context, i) => _StripCard(
                              university: results[i],
                              guideline: guidelineFor(results[i], f) ?? results[i].primary,
                              percent: book.admission(results[i]),
                              onTap: () => context.push(universityPath(results[i].institutionId)),
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 10),
                FdSectionLabel(l.fdSectionField),
                const SizedBox(height: 8),
                _Grid(
                  columns: 4,
                  gap: 8,
                  children: [
                    for (final t in kFieldTiles)
                      HardChoice(
                        label: fieldLabel(l, t.key),
                        glyph: t.glyph,
                        height: 68,
                        radius: 14,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        selected: f.field == t.key,
                        onTap: () => set(f.copyWith(field: () => f.field == t.key ? null : t.key)),
                      ),
                    HardChoice(
                      label: l.fdOther,
                      glyph: LucideIcons.layers,
                      height: 68,
                      radius: 14,
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
                          height: 36,
                          radius: 999,
                          fontSize: 13,
                          padding: const EdgeInsets.symmetric(horizontal: 13),
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
                      if (i > 0) const SizedBox(width: 6),
                      Expanded(
                        flex: flex,
                        child: HardChoice(
                          label: label,
                          height: 40,
                          radius: 12,
                          fontSize: 12,
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
                  trailing: LimeTag(fee == null ? l.fdAny : l.fdFeeUpTo(money(fee, 'KRW', locale: l.localeName))),
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
                Row(
                  children: [
                    Text(
                      money(bounds.min, 'KRW', locale: l.localeName),
                      style: fdText(10, FontWeight.w700, FdColors.pageMuted),
                    ),
                    const Spacer(),
                    Text(l.fdAny, style: fdText(10, FontWeight.w700, FdColors.pageMuted)),
                  ],
                ),
                const SizedBox(height: 16),
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
                const SizedBox(height: 8),
              ],
            ),
          ),
          FdBottomBar(
            aboveNav: !showBack,
            child: HardButton(
              label: l.fdShowUniversities(results.length),
              onPressed: results.isEmpty
                  ? null
                  : () {
                      AppEvents.track(
                        'filter_apply',
                        props: {
                          'field': f.field,
                          'regions': f.regions.isEmpty ? null : (f.regions.toList()..sort()).join(','),
                          'degree': f.degree,
                          'topik': f.topik,
                          'type': f.type,
                          'max_price': f.maxPrice,
                          'results': results.length,
                        },
                      );
                      if (onShow != null) {
                        onShow!();
                      } else {
                        context.push(kDiscoverResultsPath);
                      }
                    },
            ),
          ),
        ],
      ),
    );
  }

  static final TextStyle _title = fdText(20, FontWeight.w800, FdColors.onPage, height: 1.15, letterSpacing: -0.4);
}

/// The blue card: how many universities match (with its 20-tick meter) beside
/// the D-2 visa gauge. The gauge half opens the assessment.
class _CountCard extends StatelessWidget {
  const _CountCard({
    required this.count,
    required this.total,
    required this.loading,
    required this.visa,
    required this.onVisa,
  });

  final int count;
  final int total;
  final bool loading;
  final int? visa;
  final VoidCallback onVisa;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final lit = total == 0 ? 0 : (20 * count / total).round().clamp(count > 0 ? 1 : 0, 20);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
      decoration: BoxDecoration(
        color: FdColors.blueDeep,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    l.fdBoardMatchLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: fdText(9, FontWeight.w800, FdColors.onNavyMuted, letterSpacing: 0.54),
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text('$count', style: fdText(46, FontWeight.w800, FdColors.lime, height: 1, letterSpacing: -1.84)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          l.fdOfTotalShort(total),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: fdText(12, FontWeight.w700, FdColors.onNavyMuted),
                        ),
                      ),
                      if (loading)
                        const Padding(
                          padding: EdgeInsets.only(left: 6),
                          child: SizedBox.square(
                            dimension: 11,
                            child: CircularProgressIndicator(strokeWidth: 1.6, color: FdColors.lime),
                          ),
                        ),
                    ],
                  ),
                  SizedBox(
                    height: 14,
                    child: Row(
                      children: [
                        for (var i = 0; i < 20; i++) ...[
                          if (i > 0) const SizedBox(width: 3),
                          Expanded(
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              decoration: BoxDecoration(
                                color: i < lit ? FdColors.lime : const Color(0x38FFFFFF),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            const ColoredBox(color: Color(0x40FFFFFF), child: SizedBox(width: 1)),
            const SizedBox(width: 12),
            Semantics(
              button: true,
              label: l.fdBoardVisaTitle,
              child: GestureDetector(onTap: onVisa, behavior: HitTestBehavior.opaque, child: VisaGauge(percent: visa)),
            ),
          ],
        ),
      ),
    );
  }
}

/// One of the strip's small cards: the campus (or the Korean name) with the
/// chance tag, the short name, "city · fee".
class _StripCard extends StatelessWidget {
  const _StripCard({required this.university, required this.guideline, required this.percent, required this.onTap});

  final CatalogUniversity university;
  final CatalogGuideline guideline;
  final int? percent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final photo = campusPhotoAsset(university.institutionId);
    final price = priceOf(guideline);
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: true,
      label: university.displayName,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 98,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(2, 2))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 42,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (photo != null)
                      Image.asset(photo, fit: BoxFit.cover, cacheWidth: 300)
                    else
                      KoCover(
                        name: university.nameKoShort ?? university.nameKo ?? university.displayName,
                        alignment: Alignment.topLeft,
                      ),
                    Positioned(
                      right: 5,
                      top: 5,
                      child: ChanceBadge(
                        percent: percent,
                        fontSize: 10,
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        radius: 5,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(7, 5, 7, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      shortUniversityName(university.displayName),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(10, FontWeight.w800, FdColors.ink, height: 1.25),
                    ),
                    Text(
                      [
                        if (university.city != null) shortCity(university.city!),
                        if (price != null) money(price, guideline.currency, locale: l.localeName),
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(8, FontWeight.w400, FdColors.muted, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Equal columns with the design's gaps.
class _Grid extends StatelessWidget {
  const _Grid({required this.columns, required this.children, this.gap = 6});

  final int columns;
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += columns) {
      rows.add(
        Row(
          children: [
            for (var j = 0; j < columns; j++) ...[
              if (j > 0) SizedBox(width: gap),
              Expanded(child: i + j < children.length ? children[i + j] : const SizedBox.shrink()),
            ],
          ],
        ),
      );
    }
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[if (i > 0) SizedBox(height: gap), rows[i]],
      ],
    );
  }
}
