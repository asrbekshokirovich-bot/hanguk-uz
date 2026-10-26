import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/ai_search.dart';
import '../../catalog/data/campus_photos.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/presentation/catalog_browser.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../data/recent_searches.dart';
import 'discover_routes.dart';

/// Design screen 04, "Qidiruv": back, the search field with its clear
/// button, "So'nggi qidiruvlar", the results, and "Mashhur shaharlar". The
/// text is read by the AI search (a field of study finds every university
/// with a programme of it) and the Filtr board's choices still apply.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _text = TextEditingController(text: ref.read(catalogFilterProvider).query);
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _set(String q) {
    if (_text.text != q) {
      _text.value = TextEditingValue(text: q, selection: TextSelection.collapsed(offset: q.length));
    }
    ref.read(catalogFilterProvider.notifier).setQuery(q);
    setState(() {});
  }

  void _open(String institutionId) {
    ref.read(recentSearchesProvider.notifier).add(_text.text);
    context.push(universityPath(institutionId));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const [];
    final filter = ref.watch(catalogFilterProvider);
    final ai = ref.watch(aiSearchProvider);
    final recent = ref.watch(recentSearchesProvider);
    final searching = filter.query.trim().length >= kAiSearchMinLength;
    final rows = searching ? catalogSearchRows(all, filter, ai) : const <CatalogSearchRow>[];
    final cities = catalogCities(all).take(4).toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(18, 6, 18, 12),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: FdColors.pageRule, width: 1.5)),
                ),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      size: 48,
                      radius: 14,
                      iconSize: 18,
                      shadow: 3,
                      onTap: tracked('search.back', () => context.pop()),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: _Field(controller: _text, focus: _focus, hint: l.fdSearchHint, onChanged: _set, onSubmit: (q) {
                          // The words are not sent, only that a search was made.
                          AppEvents.track('search', props: {'chars': q.trim().length});
                          ref.read(recentSearchesProvider.notifier).add(q);
                        })),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.only(bottom: 24),
                  children: [
                    if (recent.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l.fdRecentSearches, style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [for (final r in recent) _RecentChip(label: r, onTap: tracked('search.recent_chip', () => _set(r)))],
                            ),
                          ],
                        ),
                      ),
                    if (searching) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(child: Text(l.catalogAiResultsTitle, style: fdText(13, FontWeight.w800, FdColors.onPage))),
                            if (ai.loading) ...[
                              const SizedBox.square(
                                dimension: 11,
                                child: CircularProgressIndicator(strokeWidth: 1.6, color: FdColors.lime),
                              ),
                              const SizedBox(width: 6),
                              Text(l.catalogAiSearching, style: fdText(11, FontWeight.w700, FdColors.lime)),
                            ] else
                              Text(l.fdCountTa(rows.length), style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
                          ],
                        ),
                      ),
                      const ColoredBox(color: FdColors.pageRule, child: SizedBox(height: 1.5)),
                      if (rows.isEmpty && !ai.loading)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 18),
                          child: Text(l.catalogEmptyTitle, textAlign: TextAlign.center, style: SeoulType.bodySecondary),
                        ),
                      for (final r in rows)
                        SearchResultRow(row: r, reason: catalogSearchReason(l, r), onTap: tracked('search.result_row', () => _open(r.university.institutionId), props: {'institution_id': r.university.institutionId})),
                    ],
                    if (cities.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(l.fdPopularCities, style: fdText(13, FontWeight.w800, FdColors.onPage)),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                for (var i = 0; i < 4; i++) ...[
                                  if (i > 0) const SizedBox(width: 6),
                                  Expanded(
                                    child: i < cities.length
                                        ? _CityTile(
                                            name: cities[i].name,
                                            count: l.fdCountTa(cities[i].count),
                                            onTap: tracked('search.city_tile', () => _set(cities[i].name)),
                                          )
                                        : const SizedBox.shrink(),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
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

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.focus,
    required this.hint,
    required this.onChanged,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final String hint;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.fromLTRB(14, 0, 12, 0),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
      ),
      child: Row(
        children: [
          const Lucide(LucideIcons.search, size: 18, color: FdColors.ink),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focus,
              onChanged: onChanged,
              onSubmitted: onSubmit,
              textInputAction: TextInputAction.search,
              cursorColor: FdColors.ink,
              style: fdText(15, FontWeight.w700, FdColors.ink),
              decoration: InputDecoration(
                isCollapsed: true,
                filled: false,
                contentPadding: EdgeInsets.zero,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                hintText: hint,
                hintStyle: fdText(15, FontWeight.w400, FdColors.muted),
              ),
            ),
          ),
          ValueListenableBuilder(
            valueListenable: controller,
            builder: (context, value, _) => value.text.isEmpty
                ? const SizedBox.shrink()
                : Semantics(
                    button: true,
                    label: MaterialLocalizations.of(context).deleteButtonTooltip,
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: tracked('search.clear', () {
                        controller.clear();
                        onChanged('');
                      }),
                      child: Container(
                        width: 20,
                        height: 20,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(color: Color(0xFFD9DFE8), shape: BoxShape.circle),
                        child: Text('×', style: fdText(12, FontWeight.w800, FdColors.ink, height: 1)),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _RecentChip extends StatelessWidget {
  const _RecentChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('search.recent_chip', onTap),
        child: Container(
          height: 30,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Lucide(LucideIcons.clock, size: 12, color: FdColors.muted),
              const SizedBox(width: 6),
              Text(label, style: fdText(12, FontWeight.w600, FdColors.ink)),
            ],
          ),
        ),
      ),
    );
  }
}

/// One result: the 72×44 photo, the name, "city · fee · TOPIK", the line of
/// matching programmes when the AI search found it, and the chevron.
class SearchResultRow extends StatelessWidget {
  const SearchResultRow({super.key, required this.row, required this.reason, required this.onTap});

  final CatalogSearchRow row;
  final String? reason;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = row.university;
    final g = row.guideline;
    final photo = campusPhotoAsset(u.institutionId);
    final price = priceOf(g);
    final topik = g.topikMin;
    final meta = <InlineSpan>[
      if (u.city != null) TextSpan(text: u.city),
      if (price != null)
        TextSpan(text: money(price, g.currency, locale: l.localeName), style: fdText(11, FontWeight.w800, FdColors.onPage)),
      if (topik != null) TextSpan(text: 'TOPIK ${scoreText(topik)}+'),
    ];
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('search.result_row', onTap),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: FdColors.pageRule, width: 1.5))),
          child: Row(
            children: [
              Container(
                width: 72,
                height: 44,
                clipBehavior: Clip.antiAlias,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FdColors.navy,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: photo != null
                    ? Image.asset(photo, width: 72, height: 44, fit: BoxFit.cover, cacheWidth: 216)
                    : Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            u.nameKoShort ?? u.displayName,
                            maxLines: 1,
                            style: fdText(9, FontWeight.w800, Colors.white),
                          ),
                        ),
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      u.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(14, FontWeight.w800, FdColors.onPage, height: 1.2),
                    ),
                    if (meta.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text.rich(
                        TextSpan(children: [
                          for (var i = 0; i < meta.length; i++) ...[if (i > 0) const TextSpan(text: ' · '), meta[i]],
                        ]),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: fdText(11, FontWeight.w400, FdColors.pageMuted),
                      ),
                    ],
                    if (reason != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        reason!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: fdText(11, FontWeight.w700, FdColors.lime, height: 1.3),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              const Lucide(LucideIcons.chevronRight, size: 16, color: FdColors.pageMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _CityTile extends StatelessWidget {
  const _CityTile({required this.name, required this.count, required this.onTap});

  final String name;
  final String count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('search.city_tile', onTap),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(12, FontWeight.w800, FdColors.ink)),
              const SizedBox(height: 1),
              Text(count, style: fdText(10, FontWeight.w700, FdColors.muted)),
            ],
          ),
        ),
      ),
    );
  }
}
