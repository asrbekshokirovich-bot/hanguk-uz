import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_slider.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../data/field_filter.dart';
import 'discover_routes.dart';
import 'filter_board_screen.dart';
import 'widgets/grant_box.dart';
import 'widgets/region_map.dart';

/// "Filtr" (design 2026-10-21), opened from the Universitetlar list's filter
/// button: how many universities the choices leave, then Yo'nalish, the city
/// on the map, the contract, the type and the grant. Its choices are the
/// same as the home board's and the list's.
class FilterScreen extends ConsumerWidget {
  const FilterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final results = boardResults(ref, all, f);
    final bounds = priceBounds(all);
    final profile = ref.watch(assessmentProvider);
    void set(CatalogFilter next) => ref.read(catalogFilterProvider.notifier).set(next);

    // How many each city group would show with the other choices as they are.
    final regionCounts = <String, int>{};
    for (final u in boardResults(ref, all, f.copyWith(regions: const {}))) {
      final r = catalogRegionOf(guidelineFor(u, f)?.city ?? u.city);
      regionCounts[r] = (regionCounts[r] ?? 0) + 1;
    }

    final fee = f.maxPrice;
    final feeShare = fee == null || bounds.max <= bounds.min
        ? 1.0
        : ((fee - bounds.min) / (bounds.max - bounds.min)).clamp(0.0, 1.0);

    void back() => context.canPop() ? context.pop() : context.go(kDiscoverPath);

    Widget link(String text, VoidCallback? onTap) => GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Text(text, style: fdText(12, FontWeight.w800, onTap == null ? FdColors.pageMuted : FdColors.lime)),
    );

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Zero-size: lives as long as the screen, to send filter_apply on leaving.
          _FilterUsage(filter: f, results: results.length),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
            child: Row(
              children: [
                HardIconButton(
                  glyph: LucideIcons.chevronLeft,
                  semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                  onTap: back,
                ),
                const SizedBox(width: 10),
                Text(l.fltTitle, style: fdText(18, FontWeight.w800, FdColors.onPage, letterSpacing: -0.36)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
            child: _Count(count: results.length, total: all.length),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
              children: [
                FdSectionLabel(
                  l.fdSectionField,
                  trailing: link(l.fltAllFields, f.field == null ? null : () => set(f.copyWith(field: () => null))),
                ),
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
                const SizedBox(height: 20),
                FdSectionLabel(
                  l.fdSectionCityMap,
                  trailing: link(l.fdAllRegions, f.regions.isEmpty ? null : () => set(f.copyWith(regions: const {}))),
                ),
                const SizedBox(height: 8),
                RegionMap(
                  counts: regionCounts,
                  selected: f.regions,
                  labels: (r) => r == CatalogRegion.other ? l.fdRegionGangwonPlus : regionLabel(l, r),
                  onToggle: (r) {
                    final next = {...f.regions};
                    next.contains(r) ? next.remove(r) : next.add(r);
                    set(f.copyWith(regions: next));
                  },
                ),
                const SizedBox(height: 20),
                FdSectionLabel(
                  l.fltFeeSem,
                  trailing: _Pill(fee == null ? l.fdAny : l.fdFeeUpTo(money(fee, 'KRW', locale: l.localeName))),
                ),
                const SizedBox(height: 4),
                HardSlider(
                  value: feeShare,
                  semanticLabel: l.fltFeeSem,
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
                const SizedBox(height: 20),
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
                      HardChoice(
                        label: label,
                        selected: f.type == value,
                        onTap: () => set(f.copyWith(type: () => value)),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                FdSectionLabel(l.fltOnePercent),
                const SizedBox(height: 8),
                _Grid(
                  columns: 2,
                  children: [
                    for (final (value, label) in [(true, l.fltOnePercentOnly), (false, l.fdAny)])
                      HardChoice(
                        label: label,
                        selected: f.onePercent == value,
                        onTap: () => set(f.copyWith(onePercent: value)),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                FdSectionLabel(
                  l.fdSectionGrant,
                  trailing: Text(l.fdGrantOrder, style: fdText(10, FontWeight.w700, FdColors.onNavyMuted)),
                ),
                const SizedBox(height: 8),
                GrantBox(
                  topik: profile.topik,
                  ielts: profile.ielts,
                  grant: f.grant ?? 0,
                  onTopik: (t) {
                    ref.read(assessmentProvider.notifier).set(profile.copyWith(topik: t));
                    set(f.copyWith(topik: () => t == 0 ? null : '$t'));
                  },
                  onIelts: (v) => ref.read(assessmentProvider.notifier).set(profile.copyWith(ielts: v)),
                  onGrant: (g) => set(f.copyWith(grant: () => g == 0 ? null : g)),
                ),
              ],
            ),
          ),
          FdBottomBar(
            aboveNav: true,
            child: HardButton(label: l.fdShowUniversities(results.length), onPressed: back),
          ),
        ],
      ),
    );
  }
}

/// What a `filter_apply` event says about [f]: the same fields the old filter
/// board sent, so the CRM reads both alike. [results] is how many
/// universities the choices left.
@visibleForTesting
Map<String, Object?> filterEventProps(CatalogFilter f, int? results) => {
  'field': f.field,
  'regions': f.regions.isEmpty ? null : (f.regions.toList()..sort()).join(','),
  'degree': f.degree,
  'topik': f.topik,
  'type': f.type,
  'ielts': f.ielts,
  'grant': f.grant,
  'max_price': f.maxPrice,
  'one_percent': f.onePercent ? true : null,
  'results': results,
};

/// Sends `filter_apply` once, when the visitor leaves the Filtr screen — by
/// "N ta universitetni ko'rsatish", the back arrow or the system back alike —
/// and only if the choices changed while it was open. The screen applies each
/// choice at once, so there is no "apply" press to hang the event on.
class _FilterUsage extends StatefulWidget {
  const _FilterUsage({required this.filter, required this.results});

  final CatalogFilter filter;
  final int results;

  @override
  State<_FilterUsage> createState() => _FilterUsageState();
}

class _FilterUsageState extends State<_FilterUsage> {
  late final Map<String, Object?> _initial = filterEventProps(widget.filter, null);
  late CatalogFilter _filter = widget.filter;
  late int _results = widget.results;

  @override
  void didUpdateWidget(_FilterUsage old) {
    super.didUpdateWidget(old);
    _filter = widget.filter;
    _results = widget.results;
  }

  @override
  void dispose() {
    if (!mapEquals(filterEventProps(_filter, null), _initial)) {
      AppEvents.track('filter_apply', screen: '/guest/filter', props: filterEventProps(_filter, _results));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// "24  MOS UNIVERSITETLAR · 24 TADAN" over a lime bar of segments.
class _Count extends StatelessWidget {
  const _Count({required this.count, required this.total});

  final int count;
  final int total;

  static const int _segments = 14;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final lit = total == 0 ? 0 : (count / total * _segments).ceil().clamp(0, _segments);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 14, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FdColors.ink, width: 1.5),
        gradient: const LinearGradient(colors: [FdColors.blueDeep, FdColors.blue]),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
      ),
      child: Row(
        children: [
          Text('$count', style: fdText(46, FontWeight.w800, FdColors.lime, height: 1, letterSpacing: -1.4)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.fltCount(total),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(11, FontWeight.w800, FdColors.onPage, letterSpacing: 0.4),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (var i = 0; i < _segments; i++) ...[
                      if (i > 0) const SizedBox(width: 3),
                      Expanded(
                        child: Container(
                          height: 12,
                          decoration: BoxDecoration(
                            color: i < lit ? FdColors.lime : const Color(0x33FFFFFF),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
    decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: fdText(12, FontWeight.w800, FdColors.onLime)),
  );
}

class _Grid extends StatelessWidget {
  const _Grid({required this.columns, required this.children, this.gap = 6});

  final int columns;
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < children.length; i += columns) ...[
        if (i > 0) SizedBox(height: gap),
        Row(
          children: [
            for (var j = 0; j < columns; j++) ...[
              if (j > 0) SizedBox(width: gap),
              Expanded(child: i + j < children.length ? children[i + j] : const SizedBox.shrink()),
            ],
          ],
        ),
      ],
    ],
  );
}
