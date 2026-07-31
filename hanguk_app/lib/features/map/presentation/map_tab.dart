import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/map_analytics.dart';
import '../data/map_repository.dart';
import '../domain/university.dart';
import 'map_deeplink_provider.dart';
import 'widgets/university_card.dart';
import 'widgets/university_detail_sheet.dart';
import 'widgets/university_map_view.dart';

/// The Map section of the Seoul Night shell (DESIGN_SPEC §3.5).
///
/// The section title lives in `HomeScreen._sectionHeader` ("Map · 대학 지도"),
/// so this tab renders controls only — a glass search field, the list/map
/// toggle, the filter pills, and then either the dark map card or the glass
/// university list.
class MapTab extends ConsumerStatefulWidget {
  const MapTab({super.key});

  @override
  ConsumerState<MapTab> createState() => _MapTabState();
}

class _MapTabState extends ConsumerState<MapTab> {
  final TextEditingController _searchController = TextEditingController();
  bool _isMapMode = true;
  // Audit M3 (2026-05-11): replaced the legacy 'top100' filter with
  // 'top'. The new schema has a `tier` smallint (0–4) instead of an
  // open-ended `ranking` int — `tier ≤ 1` is the closest equivalent
  // to "top-100".
  String _activeFilter = 'all'; // 'all' | 'partner' | 'top'
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(
        () => _searchQuery = _searchController.text.toLowerCase().trim(),
      );
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<University> _applyFilters(List<University> all) {
    var filtered = all;

    // Text search
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((u) {
        return u.name.toLowerCase().contains(_searchQuery) ||
            u.location.toLowerCase().contains(_searchQuery);
      }).toList();
    }

    // Chip filter
    switch (_activeFilter) {
      case 'partner':
        filtered = filtered.where((u) => u.isPartner).toList();
        break;
      case 'top':
        // Audit M3 (2026-05-11): tier-based "top" filter replaces the
        // legacy `ranking <= 100` check. `tier` is the new 0–4 quality
        // tier on `institutions`; `isTopTier` returns true for tier
        // 0 or 1.
        filtered = filtered.where((u) => u.isTopTier).toList();
        break;
    }

    return filtered;
  }

  void _showDetail(BuildContext ctx, University u) {
    // Audit M20 (2026-05-12): record the marker / row click. Sink is
    // overridable via the mapAnalyticsProvider.
    ref.read(mapAnalyticsProvider).mapMarkerClick(u.id);
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => UniversityDetailSheet(university: u),
    );
  }

  void _clearFilters() {
    _searchController.clear();
    setState(() {
      _activeFilter = 'all';
      _searchQuery = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final uniAsync = ref.watch(universitiesProvider);
    final l = AppLocalizations.of(context)!;

    // Audit M11 (2026-05-11): deep-link handler. When the router or a
    // push notification writes an institution id into
    // `pendingMapDetailProvider`, raise the detail sheet for that
    // institution and clear the provider so the sheet doesn't reopen
    // on rebuild. We listen rather than watch+raise-in-build to avoid
    // showModalBottomSheet during the build phase.
    ref.listen<String?>(pendingMapDetailProvider, (prev, next) {
      if (next == null || next.isEmpty) return;
      final unis = uniAsync.value;
      if (unis == null) return;
      final match = unis.where((u) => u.id == next).firstOrNull;
      ref.read(pendingMapDetailProvider.notifier).set(null);
      if (match == null) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showDetail(context, match);
      });
    });

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Controls ────────────────────────────────
            // No title here: HomeScreen already renders the section
            // header ("Map · 대학 지도") above this tab (spec §2).
            Padding(
              padding: const EdgeInsets.fromLTRB(
                SeoulSizes.screenPadding,
                6,
                SeoulSizes.screenPadding,
                0,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _SearchField(
                      controller: _searchController,
                      hasQuery: _searchQuery.isNotEmpty,
                    ),
                  ),
                  const SizedBox(width: 10),
                  _ToggleButton(
                    isMapMode: _isMapMode,
                    onTap: () => setState(() => _isMapMode = !_isMapMode),
                  ),
                ],
              ),
            ),

            // ── Filter Chips ─────────────────────────────
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: SeoulSizes.screenPadding,
                vertical: 10,
              ),
              child: Row(
                children: [
                  SeoulFilterChip(
                    label: l.filterAll,
                    ko: '전체',
                    selected: _activeFilter == 'all',
                    onTap: () => setState(() => _activeFilter = 'all'),
                  ),
                  const SizedBox(width: 8),
                  SeoulFilterChip(
                    label: l.filterPartner,
                    ko: '파트너',
                    selected: _activeFilter == 'partner',
                    onTap: () => setState(() => _activeFilter = 'partner'),
                  ),
                  const SizedBox(width: 8),
                  SeoulFilterChip(
                    // Audit M3 (2026-05-11): label changed from "Top
                    // 100" to "Top". The semantics moved from a
                    // numeric `ranking` cap to the categorical `tier`
                    // (0 or 1).
                    label: l.filterTop,
                    ko: '상위',
                    selected: _activeFilter == 'top',
                    onTap: () => setState(() => _activeFilter = 'top'),
                  ),
                ],
              ),
            ),

            // ── Content ──────────────────────────────────
            Expanded(
              child: uniAsync.when(
                loading: () => const Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        SeoulColors.lime,
                      ),
                    ),
                  ),
                ),
                error: (e, _) => _buildErrorState(),
                data: (unis) {
                  final filtered = _applyFilters(unis);
                  // Audit M25 (2026-05-12): when map mode is active
                  // and the current filter/search produces 0 results,
                  // overlay an explanatory badge so the user knows
                  // the map looks empty because of their filter, not
                  // because no universities are mapped.
                  final showEmptyBadge =
                      _isMapMode && filtered.isEmpty && unis.isNotEmpty;
                  return AnimatedSwitcher(
                    duration: SeoulMotion.base,
                    switchInCurve: SeoulMotion.smooth,
                    switchOutCurve: SeoulMotion.smooth,
                    child: _isMapMode
                        ? _MapCard(
                            key: const ValueKey('map'),
                            universities: filtered,
                            emptyBadge: showEmptyBadge
                                ? _FilterEmptyBadge(onClear: _clearFilters)
                                : null,
                          )
                        : _buildList(filtered),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(List<University> unis) {
    if (unis.isEmpty) {
      final l = AppLocalizations.of(context)!;
      return Center(
        key: const ValueKey('empty'),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            SeoulSizes.screenPadding,
            0,
            SeoulSizes.screenPadding,
            SeoulSizes.orbClearance,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const HangulGlyphTile(glyph: '찾', size: 64),
              const SizedBox(height: 18),
              Text(
                l.noUniversitiesMatch,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
              const SizedBox(height: 18),
              LimeButton(
                label: l.clearFilters,
                expand: false,
                onPressed: _clearFilters,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      key: const ValueKey('list'),
      // Spec §4 / orb clearance: the last row must clear the floating 한 orb.
      padding: const EdgeInsets.only(top: 4, bottom: SeoulSizes.orbClearance),
      itemCount: unis.length,
      itemBuilder: (ctx, i) => UniversityCard(
        university: unis[i],
        onTap: () => _showDetail(ctx, unis[i]),
      ),
    );
  }

  Widget _buildErrorState() {
    final l = AppLocalizations.of(context)!;
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          SeoulSizes.screenPadding,
          0,
          SeoulSizes.screenPadding,
          SeoulSizes.orbClearance,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: SeoulColors.glass,
                shape: BoxShape.circle,
                border: Border.all(color: SeoulColors.glassBorder, width: 1),
              ),
              child: const Icon(
                Icons.wifi_off_rounded,
                color: SeoulColors.textSecondary,
                size: 32,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              l.universitiesLoadError,
              textAlign: TextAlign.center,
              style: SeoulType.subtitle,
            ),
            const SizedBox(height: 6),
            Text(
              l.checkConnectionRetry,
              textAlign: TextAlign.center,
              style: SeoulType.bodySecondary,
            ),
            const SizedBox(height: 20),
            LimeButton(
              label: l.commonRetry,
              icon: Icons.refresh_rounded,
              expand: false,
              onPressed: () => ref.refresh(universitiesProvider),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Small reusable widgets ────────────────────────────────────────────────────

/// The dark map surface (spec §3.5): a rounded, hairline-bordered card filled
/// with `mapWater` so the WebView never flashes white while the tiles load.
class _MapCard extends StatelessWidget {
  const _MapCard({super.key, required this.universities, this.emptyBadge});

  final List<University> universities;
  final Widget? emptyBadge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        2,
        SeoulSizes.screenPadding,
        // The orb floats over this card and swallows taps in its 86x86 box,
        // so the map has to end above it — a pin in the bottom-right corner
        // was simply not tappable. Less than a list's full clearance, since
        // handing the map 128px of dead space would gut it.
        SeoulSizes.orbBottom + 8,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: SeoulColors.mapWater,
          borderRadius: SeoulRadii.cardR,
          border: Border.all(color: SeoulColors.glassBorder, width: 1),
          boxShadow: SeoulShadows.card,
        ),
        child: ClipRRect(
          borderRadius: SeoulRadii.cardR,
          child: Stack(
            children: [
              Positioned.fill(
                child: UniversityMapView(universities: universities),
              ),
              if (emptyBadge != null)
                Positioned(top: 14, left: 14, right: 14, child: emptyBadge!),
            ],
          ),
        ),
      ),
    );
  }
}

/// Glass search pill. 44px minimum so the field itself is a legal tap target,
/// and the clear affordance gets its own 44px box (spec §4).
class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.hasQuery});

  final TextEditingController controller;
  final bool hasQuery;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return Container(
      constraints: const BoxConstraints(minHeight: SeoulSizes.minTapTarget),
      decoration: BoxDecoration(
        color: SeoulColors.glass,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: SeoulColors.glassBorder, width: 1),
      ),
      child: TextField(
        controller: controller,
        style: SeoulType.bodySecondary.copyWith(
          color: SeoulColors.textPrimary,
          fontWeight: FontWeight.w500,
        ),
        cursorColor: SeoulColors.lime,
        textAlignVertical: TextAlignVertical.center,
        decoration: InputDecoration(
          isDense: true,
          hintText: l.searchHint,
          hintStyle: SeoulType.bodySecondary,
          filled: false,
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          prefixIcon: const Padding(
            padding: EdgeInsets.only(left: 15, right: 9),
            child: Icon(
              Icons.search_rounded,
              color: SeoulColors.textFaint,
              size: 18,
            ),
          ),
          prefixIconConstraints: const BoxConstraints(
            minWidth: 0,
            minHeight: 0,
          ),
          suffixIcon: hasQuery
              ? Semantics(
                  label: l.clearSearch,
                  button: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: controller.clear,
                    child: const SizedBox(
                      width: SeoulSizes.minTapTarget,
                      height: SeoulSizes.minTapTarget,
                      child: Center(
                        child: Icon(
                          Icons.close_rounded,
                          color: SeoulColors.textFaint,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                )
              : null,
          suffixIconConstraints: const BoxConstraints(
            minWidth: SeoulSizes.minTapTarget,
            minHeight: SeoulSizes.minTapTarget,
          ),
        ),
      ),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  final bool isMapMode;
  final VoidCallback onTap;

  const _ToggleButton({required this.isMapMode, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      // Audit M21 (2026-05-12): screen-reader label for the list/map
      // toggle. The icon is purely visual; without this Semantics
      // node the toggle is announced as an empty button.
      button: true,
      label: isMapMode ? l.switchToListView : l.switchToMapView,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          width: SeoulSizes.minTapTarget,
          height: SeoulSizes.minTapTarget,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isMapMode ? SeoulColors.lime : SeoulColors.glass,
            borderRadius: SeoulRadii.controlR,
            border: Border.all(
              color: isMapMode ? SeoulColors.lime : SeoulColors.glassBorder,
              width: 1,
            ),
            boxShadow: isMapMode ? SeoulShadows.limeGlowSmall : null,
          ),
          child: Icon(
            isMapMode ? Icons.list_rounded : Icons.map_outlined,
            color: isMapMode ? SeoulColors.ink : SeoulColors.textSecondary,
            size: 20,
          ),
        ),
      ),
    );
  }
}

class _FilterEmptyBadge extends StatelessWidget {
  final VoidCallback onClear;
  const _FilterEmptyBadge({required this.onClear});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      // Audit M21 (2026-05-12): screen readers announce this badge
      // so non-sighted users know the map is empty because of an
      // active filter.
      liveRegion: true,
      label: l.noUniversitiesMatch,
      child: GlassCard(
        padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
        radius: SeoulRadii.tile,
        // Wrap, not Row: the clear-filters chip is intrinsically sized, so a
        // Row gave the message whatever was left — which on a 320pt screen in
        // English at the default font size was less than nothing. The badge
        // that exists to explain an empty map was itself striped with
        // overflow warnings. Wrapping drops the chip to its own line instead.
        child: Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 10,
          runSpacing: 8,
          children: [
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 140),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.filter_list_off,
                    color: SeoulColors.lime,
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      l.noUniversitiesMatch,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: SeoulType.bodySecondary.copyWith(
                        color: SeoulColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SeoulFilterChip(
              label: l.clearFilters,
              selected: false,
              onTap: onClear,
            ),
          ],
        ),
      ),
    );
  }
}
