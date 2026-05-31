import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../design_system/theme/app_colors.dart';
import '../../data/map_analytics.dart';
import '../../domain/university.dart';
import 'virtual_tour_screen.dart';

class UniversityDetailSheet extends ConsumerWidget {
  final University university;

  const UniversityDetailSheet({super.key, required this.university});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Audit M20 (2026-05-12): cache the analytics sink up-front so
    // every action callback gets the same instance and doesn't
    // re-read on rebuild.
    final analytics = ref.read(mapAnalyticsProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(0xFF0F213D),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Drag handle
              Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 4),
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header: Logo + Name
                      Row(
                        children: [
                          _buildLogo(80),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  university.name,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.location_on_outlined,
                                      size: 14,
                                      color: Colors.white70,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      university.location,
                                      style: const TextStyle(
                                        color: Colors.white54,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                                if (university.isPartner)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.vibrantLime.withValues(
                                          alpha: 0.12,
                                        ),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: AppColors.vibrantLime
                                              .withValues(alpha: 0.3),
                                        ),
                                      ),
                                      child: const Text(
                                        'Partner University',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: AppColors.vibrantLime,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Audit M4 (2026-05-11): the legacy stats row
                      // showed `ranking` and `localRank` from columns
                      // that no longer exist on `institutions`.
                      // Replaced with the new tier + next-event
                      // signals sourced from `v_institutions_for_map`.
                      _buildSignalsRow(),

                      const SizedBox(height: 20),
                      const Divider(color: AppColors.borderGlass),
                      const SizedBox(height: 16),

                      // Audit M4 (2026-05-11): the legacy rows for
                      // Annual Tuition, Acceptance Rate and the
                      // "About" description block were removed. Those
                      // signals lived on the dropped `universities`
                      // table and don't have a 1:1 mapping on
                      // `institutions`. They are surfaced in
                      // `InstitutionDetailScreen` (uni_db feature)
                      // when present. Leaving the rows here would
                      // always render them empty and make the sheet
                      // look broken.
                      const SizedBox(height: 24),

                      // Audit M17 / M18 (2026-05-12): when this
                      // institution has a curated Pannellum tour
                      // (`virtualTour` JSONB) OR an external VR URL
                      // (`walkaroundUrl`), surface a "Virtual Tour"
                      // button ABOVE the Kakao Roadview walkaround.
                      // Roadview remains as a fallback for everything
                      // else.
                      if (university.hasVirtualTour)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () {
                                analytics.virtualTourOpen(university.id);
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => VirtualTourScreen(
                                      institutionName: university.name,
                                      tourSpec: university.virtualTour!,
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(
                                Icons.threesixty,
                                size: 18,
                                color: AppColors.pureBlack,
                              ),
                              label: const Text(
                                'Virtual Tour',
                                style: TextStyle(
                                  color: AppColors.pureBlack,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.vibrantLime,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                        )
                      else if (university.walkaroundUrl != null &&
                          university.walkaroundUrl!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () {
                                analytics.virtualTourOpen(
                                  university.id,
                                  sceneId: 'external',
                                );
                                _launchWebsite(university.walkaroundUrl!);
                              },
                              icon: const Icon(
                                Icons.open_in_new_rounded,
                                size: 18,
                                color: AppColors.vibrantLime,
                              ),
                              label: const Text(
                                'Virtual Tour',
                                style: TextStyle(color: AppColors.vibrantLime),
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                side: BorderSide(
                                  color: AppColors.vibrantLime.withValues(
                                    alpha: 0.4,
                                  ),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                        ),

                      // Walkaround Campus Button (Kakao Roadview)
                      //
                      // Audit M9 (2026-05-11): navigation goes through
                      // go_router (`/walkaround/:institutionId`) so
                      // deep-links work. When a curated Virtual Tour
                      // exists, this is the secondary entry point;
                      // otherwise it's the only one.
                      if (university.latitude != null &&
                          university.longitude != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () {
                                analytics.walkaroundOpen(university.id);
                                context.push(
                                  '/walkaround/${university.id}',
                                  extra: university,
                                );
                              },
                              icon: const Icon(
                                Icons.threesixty,
                                size: 18,
                                color: AppColors.pureBlack,
                              ),
                              label: const Text(
                                'Virtual Walkaround',
                                style: TextStyle(
                                  color: AppColors.pureBlack,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.vibrantLime,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                        ),

                      // Visit Website Button
                      if (university.website != null &&
                          university.website!.isNotEmpty)
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: () {
                              analytics.universityWebsiteOpen(
                                university.id,
                                university.website!,
                              );
                              _launchWebsite(university.website!);
                            },
                            icon: const Icon(
                              Icons.open_in_browser_rounded,
                              size: 18,
                              color: AppColors.vibrantLime,
                            ),
                            label: const Text(
                              'Visit University Website',
                              style: TextStyle(color: AppColors.vibrantLime),
                            ),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: BorderSide(
                                color: AppColors.vibrantLime.withValues(
                                  alpha: 0.4,
                                ),
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLogo(double size) {
    if (university.logoUrl != null && university.logoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        // Decorative — the university name appears in the same header.
        child: Image.network(
          university.logoUrl!,
          width: size,
          height: size,
          fit: BoxFit.contain,
          excludeFromSemantics: true,
          errorBuilder: (_, __, ___) => _fallbackIconBox(size),
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return _loadingBox(size);
          },
        ),
      );
    }
    return _fallbackIconBox(size);
  }

  Widget _fallbackIconBox(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.vibrantLime.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.vibrantLime.withValues(alpha: 0.2)),
      ),
      child: Icon(
        Icons.school_outlined,
        color: AppColors.vibrantLime,
        size: size * 0.45,
      ),
    );
  }

  // Low-contrast placeholder shown during slow logo loads (audit P1).
  Widget _loadingBox(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: SizedBox(
          width: size * 0.35,
          height: size * 0.35,
          child: const CircularProgressIndicator(
            strokeWidth: 2,
            color: Colors.white24,
          ),
        ),
      ),
    );
  }

  /// Audit M4 (2026-05-11): replaces the legacy ranking-based stats
  /// row with the new institutions-shape signals — Tier, Verified
  /// (IEQAS) status, and the next admission-cycle event. Renders
  /// nothing when no signals are present (rather than rendering an
  /// empty card).
  Widget _buildSignalsRow() {
    final items = <_StatItem>[];

    if (university.tier != null) {
      final isTop = university.isTopTier;
      items.add(
        _StatItem(
          label: isTop ? 'Top Tier' : 'Tier',
          value: isTop ? 'Top' : 'T${university.tier}',
          highlight: isTop,
        ),
      );
    }

    if (university.isAccredited) {
      items.add(
        const _StatItem(label: 'Verified', value: 'IEQAS', highlight: true),
      );
    }

    if (university.nextEventAt != null) {
      items.add(
        _StatItem(
          label: 'Next event',
          value: DateFormat.MMMd().format(university.nextEventAt!),
        ),
      );
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Row(
      children: items
          .map(
            (item) => Expanded(
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(
                  vertical: 12,
                  horizontal: 8,
                ),
                decoration: BoxDecoration(
                  color: item.highlight
                      ? AppColors.vibrantLime.withValues(alpha: 0.08)
                      : Colors.white.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: item.highlight
                        ? AppColors.vibrantLime.withValues(alpha: 0.25)
                        : Colors.white.withValues(alpha: 0.07),
                  ),
                ),
                child: Column(
                  children: [
                    Text(
                      item.value,
                      style: TextStyle(
                        color: item.highlight
                            ? AppColors.vibrantLime
                            : Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.label,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  Future<void> _launchWebsite(String url) async {
    // Audit M10 (P1; pulled forward as a hygiene fix during the P0
    // batch): use `Uri.tryParse` so a malformed url doesn't throw on
    // the UI thread.
    final uri = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _StatItem {
  final String label;
  final String value;
  final bool highlight;

  const _StatItem({
    required this.label,
    required this.value,
    this.highlight = false,
  });
}
