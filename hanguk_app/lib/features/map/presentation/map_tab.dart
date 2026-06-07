import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';
import '../data/map_analytics.dart';
import '../data/map_repository.dart';
import '../domain/university.dart';
import 'map_deeplink_provider.dart';
import 'widgets/university_card.dart';
import 'widgets/university_detail_sheet.dart';
import 'widgets/university_map_view.dart';

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
            // ── Top Bar ─────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  // Title
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Text(
                      l.mapTabTitle,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  // Search field
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: l.searchHint,
                        hintStyle: const TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                        prefixIcon: const Icon(
                          Icons.search_rounded,
                          color: Colors.white70,
                          size: 20,
                        ),
                        filled: true,
                        fillColor: Colors.white.withValues(alpha: 0.07),
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? Semantics(
                                label: l.clearSearch,
                                button: true,
                                child: GestureDetector(
                                  onTap: () => _searchController.clear(),
                                  child: const Icon(
                                    Icons.close,
                                    color: Colors.white70,
                                    size: 18,
                                  ),
                                ),
                              )
                            : null,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // List / Map toggle
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
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  _FilterChip(
                    label: l.filterAll,
                    icon: Icons.school_outlined,
                    selected: _activeFilter == 'all',
                    onTap: () => setState(() => _activeFilter = 'all'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: l.filterPartner,
                    icon: Icons.handshake_outlined,
                    selected: _activeFilter == 'partner',
                    onTap: () => setState(() => _activeFilter = 'partner'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    // Audit M3 (2026-05-11): label changed from "Top
                    // 100" to "Top". The semantics moved from a
                    // numeric `ranking` cap to the categorical `tier`
                    // (0 or 1).
                    label: l.filterTop,
                    icon: Icons.workspace_premium_outlined,
                    selected: _activeFilter == 'top',
                    onTap: () => setState(() => _activeFilter = 'top'),
                  ),
                ],
              ),
            ),

            // ── Content ──────────────────────────────────
            Expanded(
              child: uniAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator.adaptive()),
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
                    duration: const Duration(milliseconds: 350),
                    switchInCurve: Curves.easeOut,
                    switchOutCurve: Curves.easeIn,
                    child: _isMapMode
                        ? Stack(
                            key: const ValueKey('map'),
                            children: [
                              UniversityMapView(universities: filtered),
                              if (showEmptyBadge)
                                Positioned(
                                  top: 16,
                                  left: 16,
                                  right: 16,
                                  child: _FilterEmptyBadge(
                                    onClear: () => setState(() {
                                      _activeFilter = 'all';
                                      _searchController.clear();
                                      _searchQuery = '';
                                    }),
                                  ),
                                ),
                            ],
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.search_off_rounded,
              color: Colors.white24,
              size: 64,
            ),
            const SizedBox(height: 16),
            Text(
              l.noUniversitiesMatch,
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                _searchController.clear();
                setState(() => _activeFilter = 'all');
              },
              child: Text(
                l.clearFilters,
                style: const TextStyle(color: AppColors.vibrantLime),
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      key: const ValueKey('list'),
      padding: const EdgeInsets.only(top: 4, bottom: 80),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.wifi_off_rounded,
              color: Colors.white70,
              size: 40,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            l.universitiesLoadError,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            l.checkConnectionRetry,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => ref.refresh(universitiesProvider),
            icon: const Icon(
              Icons.refresh_rounded,
              size: 18,
              color: AppColors.vibrantLime,
            ),
            label: Text(
              l.commonRetry,
              style: const TextStyle(color: AppColors.vibrantLime),
            ),
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                color: AppColors.vibrantLime.withValues(alpha: 0.4),
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Small reusable widgets ────────────────────────────────────────────────────

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
          duration: const Duration(milliseconds: 250),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: isMapMode
                ? AppColors.vibrantLime.withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.07),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isMapMode
                  ? AppColors.vibrantLime.withValues(alpha: 0.4)
                  : Colors.white.withValues(alpha: 0.08),
            ),
          ),
          child: Icon(
            isMapMode ? Icons.list_rounded : Icons.map_outlined,
            color: isMapMode ? AppColors.vibrantLime : Colors.white60,
            size: 20,
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      // Audit M21 (2026-05-12): explicit accessibility labels on the
      // filter chips and the list/map toggle so screen readers
      // announce "Top filter, selected" instead of falling back to
      // the empty Container default.
      button: true,
      selected: selected,
      label: '$label filter',
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.vibrantLime.withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected
                  ? AppColors.vibrantLime.withValues(alpha: 0.5)
                  : Colors.white.withValues(alpha: 0.08),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 14,
                color: selected ? AppColors.vibrantLime : Colors.white70,
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                  color: selected ? AppColors.vibrantLime : Colors.white54,
                ),
              ),
            ],
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
      child: Material(
        color: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white24),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.filter_list_off,
                color: AppColors.vibrantLime,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  l.noUniversitiesMatch,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
              TextButton(
                onPressed: onClear,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.vibrantLime,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                ),
                child: Text(l.clearFilters),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
