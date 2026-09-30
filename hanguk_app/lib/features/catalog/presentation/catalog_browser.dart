import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/svg_path_icon.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart' show cssLinearGradient;
import '../data/campus_photos.dart';
import '../data/catalog_compare_provider.dart';
import '../data/catalog_filters.dart';
import '../data/catalog_repository.dart';
import '../domain/catalog_models.dart';
import 'catalog_detail_screen.dart';
import 'catalog_filter_screen.dart';
import 'catalog_format.dart';

/// Design screen 01 — "Bosh sahifa: qidiruv va universitetlar": the search
/// row with its filter button, the chips, and the two-column grid of
/// university cards. Returned as slivers so both hosts can place it under
/// what they already show: Explore (guest mode) and the Applications tab of a
/// student with no applications yet.
///
/// Both hosts get compare mode (design 3a "Kashf etish"): the "Taqqoslash"
/// chip turns it on, or a long press on a card, which also picks that card.
/// While it is on, a tap picks or unpicks a card instead of opening it, and
/// the host swaps its 한 orb for [CatalogCompareTray].
class CatalogBrowser extends ConsumerWidget {
  const CatalogBrowser({super.key, this.isGuest = false});

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
        final compare = ref.watch(catalogCompareProvider);
        final compareNotifier = ref.read(catalogCompareProvider.notifier);
        final title = filter.cities.length == 1
            ? l.catalogCityUniversities(filter.cities.first)
            : l.catalogListTitle;

        return SliverMainAxisGroup(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(17, 16, 17, 0),
                    child: Row(
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
                  ),
                  // The intake season, the compare chip, then every active
                  // filter.
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(17, 13, 17, 13),
                    child: Row(
                      children: [
                        for (final c in _seasonChips(l, all)) ...[
                          _ActiveChip(label: c),
                          const SizedBox(width: 8),
                        ],
                        _CompareChip(
                          active: compare.active,
                          label: compare.active
                              ? l.catalogCompareChipCount(compare.ids.length)
                              : l.catalogCompareChip,
                          onTap: compare.active ? compareNotifier.exit : compareNotifier.enter,
                        ),
                        for (final c in _filterChips(l, all, filter)) ...[
                          const SizedBox(width: 8),
                          _ActiveChip(label: c),
                        ],
                      ],
                    ),
                  ),
                  const ColoredBox(color: Color(0x1FFFFFFF), child: SizedBox(height: 1)),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(17, 16, 17, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: _inter(15, FontWeight.w700, Colors.white, height: 19 / 15),
                      ),
                    ),
                    Text(
                      compare.active ? l.catalogComparePickTwo : l.guestUniversitiesCount(list.length),
                      style: _inter(11, FontWeight.w400, const Color(0x8CFFFFFF)),
                    ),
                  ],
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
                padding: const EdgeInsets.symmetric(horizontal: 14),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, row) {
                      final left = row * 2;
                      final right = left + 1;
                      Widget card(int i) {
                        final id = list[i].institutionId;
                        return CatalogCard(
                          university: list[i],
                          guideline: guidelineFor(list[i], filter)!,
                          coverIndex: i,
                          compareMode: compare.active,
                          selected: compare.active && compare.contains(id),
                          compareFull: compare.full,
                          onTap: compare.active
                              ? () => compareNotifier.toggle(id)
                              : () => CatalogDetailScreen.open(
                                  context,
                                  university: list[i],
                                  degree: filter.degree,
                                  isGuest: isGuest,
                                ),
                          onLongPress: () => compareNotifier.startWith(id),
                        );
                      }
                      return Padding(
                        padding: EdgeInsets.only(bottom: right + 1 < list.length ? 11 : 0),
                        child: IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(child: card(left)),
                              const SizedBox(width: 11),
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
            // Clear of the 한 orb, and of the compare tray that replaces it.
            const SliverToBoxAdapter(child: SizedBox(height: SeoulSizes.orbClearance)),
          ],
        );
      },
    );
  }

  /// The intake seasons, first in the chip row.
  static List<String> _seasonChips(AppLocalizations l, List<CatalogUniversity> all) => <String>{
    for (final u in all)
      for (final g in u.guidelines)
        if (seasonLabel(l, g) != null) seasonLabel(l, g)!,
  }.toList();

  /// Every active filter, in the order the Filtr screen lists them.
  static List<String> _filterChips(AppLocalizations l, List<CatalogUniversity> all, CatalogFilter f) {
    final chips = <String>[];
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

/// Inter at the design's size and weight. [height] defaults to CSS
/// `line-height: normal` for Inter.
TextStyle _inter(double size, FontWeight weight, Color color, {double height = 1.21}) => TextStyle(
  fontFamily: SeoulType.inter,
  fontFamilyFallback: SeoulType.fallback,
  fontSize: size,
  fontWeight: weight,
  height: height,
  color: color,
);

// The design's icons (24x24 viewBox).
const _searchPath = 'm20 20-3.5-3.5';
const _slidersPath = 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0';
const _arrowsPath = 'M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4';
const _xPath = 'M6 6l12 12M18 6L6 18';
const _heartPath =
    'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z';
const _checkPath = 'M5 12l5 5L20 7';
const _pinPath = 'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z';

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
  bool _focused = false;

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
    const faint = Color(0x80FFFFFF); // .5
    return Focus(
      onFocusChange: (f) => setState(() => _focused = f),
      child: Container(
        height: 41,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: const BoxDecoration(
          color: Color(0x14FFFFFF), // .08
          borderRadius: BorderRadius.all(Radius.circular(12)),
        ),
        foregroundDecoration: _focused
            ? BoxDecoration(
                borderRadius: const BorderRadius.all(Radius.circular(12)),
                border: Border.all(color: SeoulColors.lime),
              )
            : null,
        child: Row(
          children: [
            const SvgPathIcon(
              paths: [_searchPath],
              circles: [(11, 11, 7)],
              size: 15,
              strokeWidth: 2.2,
              color: faint,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: TextField(
                controller: _c,
                onChanged: widget.onChanged,
                style: _inter(13, FontWeight.w400, Colors.white),
                cursorColor: SeoulColors.lime,
                // Every border and fill spelled out: the app theme's input
                // decoration must not draw inside the design's box.
                decoration: InputDecoration(
                  isCollapsed: true,
                  filled: false,
                  contentPadding: EdgeInsets.zero,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  hintText: widget.hint,
                  hintStyle: _inter(13, FontWeight.w400, faint),
                ),
              ),
            ),
          ],
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
          width: 42,
          height: 41,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 42,
                height: 41,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.all(Radius.circular(12)),
                  color: const Color(0xFF1E4A8A),
                  border: Border.all(color: const Color(0x38FFFFFF)), // .22
                ),
                child: const SvgPathIcon(
                  paths: [_slidersPath],
                  circles: [(16, 6, 2), (10, 12, 2), (18, 18, 2)],
                  size: 16,
                  color: Colors.white,
                ),
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

/// The "2027 Bahor" chip; active filters wear the same.
class _ActiveChip extends StatelessWidget {
  const _ActiveChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 11),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0x386E96D2), // rgba(110,150,210,.22)
        borderRadius: BorderRadius.circular(SeoulRadii.pill),
      ),
      child: Text(label, style: _inter(11, FontWeight.w700, const Color(0xFFB8CCEB))),
    );
  }
}

/// "Taqqoslash": outlined while compare mode is off; lime with a ✕ and the
/// "n/2" count while it is on.
class _CompareChip extends StatelessWidget {
  const _CompareChip({required this.active, required this.label, required this.onTap});

  final bool active;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ink = active ? SeoulColors.ink : SeoulColors.lime;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 26,
          padding: const EdgeInsets.symmetric(horizontal: 11),
          decoration: BoxDecoration(
            color: active ? SeoulColors.lime : null,
            borderRadius: BorderRadius.circular(SeoulRadii.pill),
            border: active ? null : Border.all(color: const Color(0x8CD4E94C)), // .55
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              active
                  ? SvgPathIcon(paths: const [_xPath], size: 10, strokeWidth: 3.2, color: ink)
                  : SvgPathIcon(paths: const [_arrowsPath], size: 12, strokeWidth: 2.4, color: ink),
              const SizedBox(width: 5),
              Text(label, style: _inter(11, FontWeight.w700, ink)),
            ],
          ),
        ),
      ),
    );
  }
}

/// One card of the grid: the campus photo (or the university's name when no
/// photo was found), the fee, the type, the name and "city · TOPIK".
///
/// Pressed it shrinks to 0.96; held for 450 ms it starts compare mode
/// ([onLongPress]) and the tap that would follow is not sent. In compare mode
/// the ♡ gives way to the pick circle.
class CatalogCard extends StatefulWidget {
  const CatalogCard({
    super.key,
    required this.university,
    required this.guideline,
    required this.coverIndex,
    required this.onTap,
    required this.onLongPress,
    this.compareMode = false,
    this.selected = false,
    this.compareFull = false,
  });

  final CatalogUniversity university;
  final CatalogGuideline guideline;

  /// Position in the grid — picks the cover colour when there is no photo,
  /// alternating like the design does.
  final int coverIndex;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final bool compareMode;

  /// Picked for comparison (only while [compareMode] is on).
  final bool selected;

  /// Both slots are taken: the empty pick circles fade.
  final bool compareFull;

  @override
  State<CatalogCard> createState() => _CatalogCardState();
}

class _CatalogCardState extends State<CatalogCard> {
  static const _press = Duration(milliseconds: 200);
  static const _longPress = Duration(milliseconds: 450);

  bool _pressed = false;

  void _setPressed(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final university = widget.university;
    final guideline = widget.guideline;
    final photo = campusPhotoAsset(university.institutionId);
    final price = priceOf(guideline);
    final type = typeLabel(l, guideline.institutionType);
    final typeColor = catalogType(guideline.institutionType) == CatalogType.state
        ? const Color(0xFF5EE0B0)
        : SeoulColors.infoText;
    final topik = guideline.topikMin;
    final meta = [
      ?cityName(context, university),
      if (topik != null) 'TOPIK ${scoreText(topik)}+',
    ].join(' · ');
    const faint = Color(0x8CFFFFFF); // .55

    return RawGestureDetector(
      behavior: HitTestBehavior.opaque,
      gestures: {
        TapGestureRecognizer: GestureRecognizerFactoryWithHandlers<TapGestureRecognizer>(
          TapGestureRecognizer.new,
          (r) => r.onTap = widget.onTap,
        ),
        // Wins the arena once the 450 ms are up, so the tap is not sent.
        LongPressGestureRecognizer: GestureRecognizerFactoryWithHandlers<LongPressGestureRecognizer>(
          () => LongPressGestureRecognizer(duration: _longPress),
          (r) {
            r.onLongPressDown = (_) => _setPressed(true);
            r.onLongPressCancel = () => _setPressed(false);
            r.onLongPressStart = (_) {
              _setPressed(false);
              widget.onLongPress();
            };
          },
        ),
      },
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: _press,
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: _press,
          curve: Curves.easeOut,
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: const Color(0x0AFFFFFF), // .04
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: widget.selected ? SeoulColors.lime : const Color(0x24FFFFFF), // .14
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 103,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (photo != null)
                        ColoredBox(
                          color: const Color(0xFF1C3764),
                          child: Image.asset(photo, fit: BoxFit.cover, cacheWidth: 480),
                        )
                      else
                        _NameCover(name: university.nameKoShort ?? university.displayName, index: widget.coverIndex),
                      if (price != null)
                        Positioned(
                          left: 7,
                          bottom: 6,
                          child: Container(
                            height: 21,
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: const Color(0xFF1C3764),
                              borderRadius: BorderRadius.circular(SeoulRadii.pill),
                              border: Border.all(color: const Color(0x33FFFFFF)), // .2
                            ),
                            child: Text(
                              money(price, guideline.currency),
                              style: _inter(10.5, FontWeight.w700, Colors.white),
                            ),
                          ),
                        ),
                      if (!widget.compareMode)
                        // Decorative only: the ♡ has no action of its own.
                        Positioned(
                          top: 5,
                          right: 6,
                          child: Container(
                            width: 27,
                            height: 27,
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                            child: const SvgPathIcon(paths: [_heartPath], size: 14, color: SeoulColors.ink),
                          ),
                        )
                      else if (widget.selected)
                        Positioned(
                          top: 4,
                          right: 5,
                          child: Container(
                            width: 29,
                            height: 29,
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(shape: BoxShape.circle, color: SeoulColors.lime),
                            child: const SvgPathIcon(paths: [_checkPath], size: 15, strokeWidth: 3.2, color: SeoulColors.ink),
                          ),
                        )
                      else
                        Positioned(
                          top: 4,
                          right: 5,
                          child: Opacity(
                            opacity: widget.compareFull ? 0.35 : 1,
                            child: Container(
                              width: 29,
                              height: 29,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF1C3764),
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 7),
              Padding(
                padding: const EdgeInsets.fromLTRB(3, 0, 3, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (type != null) ...[
                      Text(type, style: _inter(10, FontWeight.w600, typeColor)),
                      const SizedBox(height: 3),
                    ],
                    ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 30),
                      child: Text(
                        universityName(context, university),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: _inter(12.5, FontWeight.w700, Colors.white, height: 1.2),
                      ),
                    ),
                    if (meta.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const SvgPathIcon(
                            paths: [_pinPath],
                            circles: [(12, 10, 2.5)],
                            size: 10,
                            strokeWidth: 2.2,
                            color: faint,
                          ),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              meta,
                              maxLines: 1,
                              softWrap: false,
                              overflow: TextOverflow.ellipsis,
                              style: _inter(11, FontWeight.w400, faint),
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
        ),
      ),
    );
  }
}

/// The cover when there is no campus photo: the university's Korean name on
/// one of the design's two cover colours.
class _NameCover extends StatelessWidget {
  const _NameCover({required this.name, required this.index});

  final String name;
  final int index;

  @override
  Widget build(BuildContext context) {
    final blue = index.isEven;
    return LayoutBuilder(
      builder: (context, box) => Container(
        decoration: BoxDecoration(
          gradient: blue
              ? cssLinearGradient(150, box.biggest, colors: const [Color(0xFF2B5096), Color(0xFF1C3A6E)])
              : null,
          color: blue ? null : const Color(0xFF3A4533),
        ),
        padding: const EdgeInsets.only(bottom: 10),
        alignment: Alignment.center,
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            name,
            maxLines: 1,
            style: SeoulType.hangulGlyph.copyWith(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: blue ? Colors.white : const Color(0xFFCFE24E),
            ),
          ),
        ),
      ),
    );
  }
}
