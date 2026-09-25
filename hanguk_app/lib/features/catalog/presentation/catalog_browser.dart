import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../guest/data/guest_compare_provider.dart';
import '../data/campus_photos.dart';
import '../data/catalog_filters.dart';
import '../data/catalog_repository.dart';
import '../domain/catalog_models.dart';
import 'catalog_detail_screen.dart';
import 'catalog_filter_screen.dart';
import 'catalog_format.dart';

/// Design screen 01 — "Bosh sahifa: qidiruv va universitetlar": the search
/// row with its filter button, the active-filter chips, and the two-column
/// grid of university cards. Returned as slivers so both hosts can place it
/// under what they already show: Explore (guest mode) and the Applications
/// tab of a student with no applications yet.
///
/// [allowCompare] puts the ♡ on each card. In guest mode it adds the
/// university to Compare (비교) — it replaced the "+" that used to do that.
/// The Applications browse list has no compare, so it has no ♡ either.
class CatalogBrowser extends ConsumerWidget {
  const CatalogBrowser({super.key, required this.allowCompare, this.isGuest = false});

  final bool allowCompare;

  /// Guest mode: the detail screen's "Bog'lanish" keeps the magic-code login
  /// as the contact sheet's last row.
  final bool isGuest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final async = ref.watch(catalogProvider);
    final filter = ref.watch(catalogFilterProvider);

    return async.when(
      loading: () => const SliverFillRemaining(
        hasScrollBody: false,
        child: Center(child: CircularProgressIndicator(color: SeoulColors.lime)),
      ),
      error: (_, _) => SliverFillRemaining(
        hasScrollBody: false,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(SeoulSizes.screenPadding),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l.uniDbLoadFailed, textAlign: TextAlign.center, style: SeoulType.bodySecondary),
                const SizedBox(height: 16),
                SeoulOutlineButton(
                  label: l.commonRetry,
                  expand: false,
                  onPressed: () => ref.invalidate(catalogProvider),
                ),
              ],
            ),
          ),
        ),
      ),
      data: (all) {
        final list = applyCatalogFilter(all, filter);
        final compare = allowCompare ? ref.watch(guestCompareProvider) : const <String>[];
        final chips = _activeChips(l, all, filter);
        final title = filter.cities.length == 1
            ? l.catalogCityUniversities(filter.cities.first)
            : l.catalogListTitle;

        return SliverMainAxisGroup(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(SeoulSizes.screenPadding, 6, SeoulSizes.screenPadding, 14),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: SeoulColors.glassBorder)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _SearchField(
                            value: filter.query,
                            hint: l.catalogSearchHint,
                            onChanged: (v) => ref.read(catalogFilterProvider.notifier).setQuery(v),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _FilterButton(
                          count: filter.activeCount,
                          tooltip: l.catalogFilterTitle,
                          onTap: () => CatalogFilterScreen.open(context),
                        ),
                      ],
                    ),
                    if (chips.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final c in chips) ...[
                              _ActiveChip(label: c),
                              const SizedBox(width: 6),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              sliver: SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: SeoulType.subtitle.copyWith(fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.17),
                        ),
                      ),
                      Text(l.guestUniversitiesCount(list.length), style: SeoulType.caption),
                    ],
                  ),
                ),
              ),
            ),
            if (list.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 20),
                  child: Column(
                    children: [
                      Text(l.catalogEmptyTitle, textAlign: TextAlign.center, style: SeoulType.subtitle),
                      const SizedBox(height: 6),
                      Text(l.catalogEmptyBody, textAlign: TextAlign.center, style: SeoulType.bodySecondary.copyWith(fontSize: 13)),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, row) {
                      final left = row * 2;
                      final right = left + 1;
                      Widget card(int i) => CatalogCard(
                        university: list[i],
                        guideline: guidelineFor(list[i], filter)!,
                        coverIndex: i,
                        compareSelected: compare.contains(list[i].institutionId),
                        onToggleCompare: allowCompare
                            ? () => ref.read(guestCompareProvider.notifier).toggle(list[i].institutionId)
                            : null,
                        onTap: () => CatalogDetailScreen.open(
                          context,
                          university: list[i],
                          degree: filter.degree,
                          allowCompare: allowCompare,
                          isGuest: isGuest,
                        ),
                      );
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(child: card(left)),
                              const SizedBox(width: 12),
                              Expanded(child: right < list.length ? card(right) : const SizedBox.shrink()),
                            ],
                          ),
                        ),
                      );
                    },
                    childCount: (list.length + 1) ~/ 2,
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: SeoulSizes.orbClearance)),
          ],
        );
      },
    );
  }

  /// The chips under the search row: the intake season, then every active
  /// filter, in the order the Filtr screen lists them.
  static List<String> _activeChips(AppLocalizations l, List<CatalogUniversity> all, CatalogFilter f) {
    final chips = <String>[];
    final seasons = <String>{
      for (final u in all)
        for (final g in u.guidelines)
          if (seasonLabel(l, g) != null) seasonLabel(l, g)!,
    };
    chips.addAll(seasons);
    chips.addAll(f.cities);
    if (f.degree == CatalogDegree.bachelor) chips.add(l.catalogDegreeBachelor);
    if (f.degree == CatalogDegree.master) chips.add(l.catalogDegreeMaster);
    if (f.hasPrice) {
      final b = priceBounds(all);
      chips.add('${money(f.minPrice ?? b.min, 'KRW')}–${money(f.maxPrice ?? b.max, 'KRW')}');
    }
    if (f.ielts != null) chips.add('IELTS ${f.ielts!.toStringAsFixed(1)}');
    return chips;
  }
}

class _SearchField extends StatefulWidget {
  const _SearchField({required this.value, required this.hint, required this.onChanged});

  final String value;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<_SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<_SearchField> {
  late final TextEditingController _c = TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(covariant _SearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _c.text) _c.text = widget.value;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: TextField(
        controller: _c,
        onChanged: widget.onChanged,
        style: SeoulType.body.copyWith(fontSize: 14),
        cursorColor: SeoulColors.lime,
        textAlignVertical: TextAlignVertical.center,
        decoration: InputDecoration(
          hintText: widget.hint,
          hintStyle: SeoulType.bodySecondary,
          prefixIcon: const Icon(Icons.search_rounded, color: SeoulColors.textFaint, size: 18),
          filled: true,
          fillColor: SeoulColors.glass,
          contentPadding: EdgeInsets.zero,
          border: const OutlineInputBorder(borderRadius: SeoulRadii.controlR, borderSide: BorderSide.none),
          enabledBorder: const OutlineInputBorder(borderRadius: SeoulRadii.controlR, borderSide: BorderSide.none),
          focusedBorder: const OutlineInputBorder(
            borderRadius: SeoulRadii.controlR,
            borderSide: BorderSide(color: SeoulColors.lime),
          ),
        ),
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.count, required this.tooltip, required this.onTap});

  final int count;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: SeoulRadii.controlR,
                  gradient: SeoulGradients.heroCard,
                  border: Border.all(color: SeoulColors.heroBorder),
                ),
                child: const Icon(Icons.tune_rounded, color: Colors.white, size: 18),
              ),
              if (count > 0)
                Positioned(
                  top: -5,
                  right: -5,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 20),
                    height: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: SeoulColors.lime,
                      borderRadius: BorderRadius.circular(SeoulRadii.pill),
                      border: Border.all(color: SeoulColors.ink, width: 2),
                    ),
                    child: Text(
                      '$count',
                      style: SeoulType.caption.copyWith(fontSize: 11, fontWeight: FontWeight.w800, color: SeoulColors.ink),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActiveChip extends StatelessWidget {
  const _ActiveChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 30,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: SeoulColors.infoFill,
        borderRadius: BorderRadius.circular(SeoulRadii.pill),
      ),
      child: Text(
        label,
        style: SeoulType.caption.copyWith(fontWeight: FontWeight.w700, color: SeoulColors.infoText),
      ),
    );
  }
}

/// One card of the grid: the campus photo (or the university's name when no
/// photo was found), the fee, the type, the name and "city · TOPIK".
class CatalogCard extends StatelessWidget {
  const CatalogCard({
    super.key,
    required this.university,
    required this.guideline,
    required this.coverIndex,
    required this.onTap,
    this.compareSelected = false,
    this.onToggleCompare,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;

  /// Position in the grid — picks the cover colour when there is no photo,
  /// cycling like the design does.
  final int coverIndex;
  final VoidCallback onTap;
  final bool compareSelected;
  final VoidCallback? onToggleCompare;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final photo = campusPhotoAsset(university.institutionId);
    final price = priceOf(guideline);
    final type = typeLabel(l, guideline.institutionType);
    final typeColor = catalogType(guideline.institutionType) == CatalogType.state
        ? SeoulColors.successText
        : SeoulColors.infoText;
    final topik = guideline.topikMin;
    final meta = [
      if (university.city != null) university.city!,
      if (topik != null) 'TOPIK ${scoreText(topik)}+',
    ].join(' · ');

    return GlassCard(
      radius: 20,
      blur: false,
      padding: const EdgeInsets.all(8),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 118,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: photo != null
                      ? Image.asset(photo, fit: BoxFit.cover, cacheWidth: 480)
                      : _NameCover(name: university.nameKoShort ?? university.displayName, index: coverIndex),
                ),
                if (onToggleCompare != null)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: _HeartButton(
                      selected: compareSelected,
                      label: l.catalogFavorite,
                      onTap: onToggleCompare!,
                    ),
                  ),
                if (price != null)
                  Positioned(
                    left: 8,
                    bottom: 8,
                    child: Container(
                      height: 24,
                      padding: const EdgeInsets.symmetric(horizontal: 9),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: SeoulColors.royalBlue,
                        borderRadius: BorderRadius.circular(SeoulRadii.pill),
                        border: Border.all(color: SeoulColors.heroBorder),
                      ),
                      child: Text(
                        money(price, guideline.currency),
                        style: SeoulType.caption.copyWith(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 9),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (type != null) ...[
                  Text(type, style: SeoulType.caption.copyWith(fontSize: 11, fontWeight: FontWeight.w600, color: typeColor)),
                  const SizedBox(height: 4),
                ],
                Text(
                  university.displayName,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle.copyWith(fontSize: 13.5, height: 1.25, letterSpacing: -0.13),
                ),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 12, color: SeoulColors.textSecondary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          meta,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: SeoulType.caption.copyWith(fontSize: 11.5),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The cover when there is no campus photo: the university's Korean name on
/// one of the three cover colours.
class _NameCover extends StatelessWidget {
  const _NameCover({required this.name, required this.index});

  final String name;
  final int index;

  @override
  Widget build(BuildContext context) {
    final (Gradient? gradient, Color? fill, Color ink) = switch (index % 3) {
      0 => (SeoulGradients.heroCard, null, Colors.white),
      1 => (null, SeoulColors.infoFill, SeoulColors.infoText),
      _ => (null, SeoulColors.limeFill, SeoulColors.lime),
    };
    return Container(
      decoration: BoxDecoration(gradient: gradient, color: fill),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      alignment: Alignment.center,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          name,
          style: SeoulType.hangulGlyph.copyWith(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.48, color: ink),
        ),
      ),
    );
  }
}

class _HeartButton extends StatelessWidget {
  const _HeartButton({required this.selected, required this.label, required this.onTap});

  final bool selected;
  final String label;
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
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xEBFFFFFF)),
          child: Icon(
            selected ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            size: 15,
            color: selected ? const Color(0xFFE0463C) : SeoulColors.ink,
          ),
        ),
      ),
    );
  }
}
