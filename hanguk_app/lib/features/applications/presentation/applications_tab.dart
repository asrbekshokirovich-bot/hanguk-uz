import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../design_system/adaptive/hanguk_card.dart';
import '../../uni_db/presentation/widgets/home_recent_changes_banner.dart';
import '../../uni_db/presentation/widgets/verified_deadlines_overlay.dart';
import '../../map/data/map_repository.dart';
import '../../map/domain/university.dart';
import '../data/applications_repository.dart';
import 'widgets/application_card.dart';
import 'widgets/university_room_modal.dart';

/// Applications tab — VIEW ONLY.
///
/// Product decision (2026-07): students no longer self-apply from the app.
/// Staff attach universities to a student from the CRM ("Oqishga topshirish"),
/// which creates the application rows. So this tab now:
///   - shows the student's applications (the universities they were applied
///     to) when they have any, and
///   - shows the full read-only university list when they have none.
/// The old select-and-"Submit for Approval" flow (UniversitySelectionView)
/// is intentionally gone — there is no way to submit an application here.
class ApplicationsTab extends ConsumerWidget {
  const ApplicationsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appsAsync = ref.watch(applicationsProvider);
    final l = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            title: Text(l.applicationsTabTitle),
            floating: true,
            snap: true,
            actions: [
              // Account button hosts Sign out, Download my data, Delete account
              // (UI/UX audit P0 N1/N2). Keep it as the only AppBar action.
              IconButton(
                icon: const Icon(Icons.account_circle_outlined),
                tooltip: l.accountTooltip,
                onPressed: () => context.push('/account'),
              ),
            ],
          ),

          // University DB overlays (no-op unless UNI_DB_ENABLED + tracked unis).
          const HomeRecentChangesBannerSliver(),
          const VerifiedDeadlinesOverlaySliver(),

          appsAsync.when(
            data: (apps) {
              // No applications yet → let the student browse every university
              // (read-only). They cannot apply from here; staff do that in CRM.
              if (apps.isEmpty) {
                return _buildBrowseUniversities(ref, l);
              }

              final pending = apps
                  .where((a) => a.status == 'pending_approval')
                  .toList();
              final active = apps
                  .where((a) => a.status != 'pending_approval')
                  .toList();

              return SliverMainAxisGroup(
                slivers: [
                  if (pending.isNotEmpty)
                    ..._buildApplicationSection(l.appsPendingHeading, pending),
                  if (active.isNotEmpty)
                    ..._buildApplicationSection(l.appsActiveHeading, active),
                  const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              );
            },
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator.adaptive()),
            ),
            error: (err, stack) => _buildErrorSliver(
              l,
              onRetry: () => ref.invalidate(applicationsProvider),
            ),
          ),
        ],
      ),
    );
  }

  // ── Applications the student was attached to (staff-assigned) ────────────
  List<Widget> _buildApplicationSection(String heading, List<dynamic> apps) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            heading,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
      ),
      SliverList(
        delegate: SliverChildBuilderDelegate((context, index) {
          final app = apps[index];
          return ApplicationCard(
            application: app,
            onDiscussionTap: () {
              UniversityRoomModal.show(context, app, initialTabIndex: 1);
            },
          );
        }, childCount: apps.length),
      ),
    ];
  }

  // ── Read-only university list, shown when the student has no applications ─
  Widget _buildBrowseUniversities(WidgetRef ref, AppLocalizations l) {
    final unisAsync = ref.watch(universitiesProvider);
    return unisAsync.when(
      data: (unis) {
        if (unis.isEmpty) {
          return SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Text(
                l.appsEmptyTitle,
                style: const TextStyle(color: Colors.white70),
              ),
            ),
          );
        }
        return SliverMainAxisGroup(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
                child: Text(
                  l.appsEmptyTitle,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) => _UniversityTile(university: unis[index]),
                childCount: unis.length,
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        );
      },
      loading: () => const SliverFillRemaining(
        child: Center(child: CircularProgressIndicator.adaptive()),
      ),
      error: (err, stack) => _buildErrorSliver(
        l,
        onRetry: () => ref.invalidate(universitiesProvider),
      ),
    );
  }

  Widget _buildErrorSliver(AppLocalizations l, {required VoidCallback onRetry}) {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.white54, size: 40),
              const SizedBox(height: 12),
              Text(
                l.appsLoadError,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: Text(l.commonRetry),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A single read-only university row: logo + name + city. No selection, no
/// checkbox, no apply button — browsing only.
class _UniversityTile extends StatelessWidget {
  final University university;
  const _UniversityTile({required this.university});

  @override
  Widget build(BuildContext context) {
    final uni = university;
    return HangukCard(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            if (uni.logoUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  uni.logoUrl!,
                  width: 52,
                  height: 52,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                  errorBuilder: (_, __, ___) => _logoFallback(),
                  loadingBuilder: (context, child, progress) =>
                      progress == null ? child : _logoFallback(),
                ),
              )
            else
              _logoFallback(),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    uni.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Colors.white,
                    ),
                  ),
                  if (uni.location.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      uni.location,
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (uni.isPartner)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.vibrantLime.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Partner',
                  style: TextStyle(
                    color: AppColors.vibrantLime,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _logoFallback() {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        color: AppColors.vibrantLime.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Icon(Icons.school_outlined, color: AppColors.vibrantLime),
    );
  }
}
