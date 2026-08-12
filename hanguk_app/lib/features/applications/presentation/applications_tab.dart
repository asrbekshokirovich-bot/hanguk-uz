import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../map/domain/university.dart';
import '../../uni_db/data/approved_universities_provider.dart';
import '../../uni_db/presentation/widgets/home_recent_changes_banner.dart';
import '../../uni_db/presentation/widgets/verified_deadlines_overlay.dart';
import '../data/applications_repository.dart';
import '../domain/application.dart';
import 'widgets/application_card.dart';
import 'widgets/process_tracker.dart';
import 'widgets/university_room_modal.dart';

const EdgeInsets _gutter = EdgeInsets.symmetric(
  horizontal: SeoulSizes.screenPadding,
);

/// Applications tab — VIEW ONLY (DESIGN_SPEC §3.4).
///
/// Product decision (2026-07): students no longer self-apply from the app.
/// Staff attach universities to a student from the CRM ("Oqishga topshirish"),
/// which creates the application rows. So this tab now:
///   - shows the journey segment bar plus the student's applications (the
///     universities they were applied to) when they have any, and
///   - shows the full read-only university list when they have none.
/// The old select-and-"Submit for Approval" flow (UniversitySelectionView)
/// is intentionally gone — there is no way to submit an application here.
///
/// The section header (back circle + "Applications 지원 현황") is drawn by the
/// Seoul Night shell, so this screen starts straight at its content.
class ApplicationsTab extends ConsumerWidget {
  const ApplicationsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appsAsync = ref.watch(applicationsProvider);
    final l = AppLocalizations.of(context)!;

    return CustomScrollView(
      slivers: [
        // Account (sign out, download my data, delete account) — audit P0
        // N1/N2. The shell header has no trailing slot, so it lives at the
        // top of the content as a glass circle.
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              0,
              SeoulSizes.screenPadding,
              8,
            ),
            child: Align(
              alignment: Alignment.centerRight,
              child: _AccountButton(tooltip: l.accountTooltip),
            ),
          ),
        ),

        // University DB overlays (no-op unless UNI_DB_ENABLED + tracked unis).
        const HomeRecentChangesBannerSliver(),
        const VerifiedDeadlinesOverlaySliver(),

        appsAsync.when(
          data: (apps) {
            // No applications yet → let the student browse the approved
            // universities (read-only). They cannot apply from here; staff do
            // that in CRM.
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
                SliverToBoxAdapter(
                  child: Padding(
                    padding: _gutter,
                    child: ProcessTracker(status: _journeyStatus(apps)),
                  ),
                ),
                if (pending.isNotEmpty)
                  ..._buildApplicationSection(l.appsPendingHeading, pending),
                if (active.isNotEmpty)
                  ..._buildApplicationSection(l.appsActiveHeading, active),
                const SliverToBoxAdapter(
                  child: SizedBox(height: SeoulSizes.orbClearance),
                ),
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
    );
  }

  /// The status the journey bar reflects: the furthest-along application.
  /// A rejected application sits on the last stage, so it never speaks for
  /// the journey unless it is the only one left.
  String _journeyStatus(List<StudentApplication> apps) {
    final live = apps.where((a) => a.status != 'rejected').toList();
    final pool = live.isEmpty ? apps : live;

    var best = pool.first.status;
    var bestStep = ProcessTracker.stepFor(best);
    for (final app in pool.skip(1)) {
      final step = ProcessTracker.stepFor(app.status);
      if (step > bestStep) {
        bestStep = step;
        best = app.status;
      }
    }
    return best;
  }

  // ── Applications the student was attached to (staff-assigned) ────────────
  List<Widget> _buildApplicationSection(
    String heading,
    List<StudentApplication> apps,
  ) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            SeoulSizes.screenPadding,
            24,
            SeoulSizes.screenPadding,
            12,
          ),
          child: Text(heading, style: SeoulType.title),
        ),
      ),
      SliverPadding(
        padding: _gutter,
        sliver: SliverList(
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
      ),
    ];
  }

  // ── Read-only university list, shown when the student has no applications ─
  //
  // Only the institutions the review queue has approved. This listed the whole
  // catalogue — 204 institutions, most of them a name and a pin — so a student
  // who had not applied anywhere opened Applications onto a wall of schools we
  // hold nothing for. `approvedUniversitiesProvider` is the same list Explore
  // shows, so the two can never disagree.
  Widget _buildBrowseUniversities(WidgetRef ref, AppLocalizations l) {
    final unisAsync = ref.watch(approvedUniversitiesProvider);
    return unisAsync.when(
      data: (unis) {
        if (unis.isEmpty) {
          return SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(SeoulSizes.screenPadding),
                child: Text(
                  l.appsEmptyTitle,
                  textAlign: TextAlign.center,
                  style: SeoulType.bodySecondary,
                ),
              ),
            ),
          );
        }
        return SliverMainAxisGroup(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  SeoulSizes.screenPadding,
                  4,
                  SeoulSizes.screenPadding,
                  12,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.appsEmptyTitle, style: SeoulType.title),
                    const SizedBox(height: 4),
                    Text(l.appsEmptyBody, style: SeoulType.bodySecondary),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: _gutter,
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => _UniversityTile(university: unis[index]),
                  childCount: unis.length,
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: SizedBox(height: SeoulSizes.orbClearance),
            ),
          ],
        );
      },
      loading: () => const SliverFillRemaining(
        child: Center(child: CircularProgressIndicator.adaptive()),
      ),
      error: (err, stack) => _buildErrorSliver(
        l,
        onRetry: () => ref.invalidate(approvedUniversitiesProvider),
      ),
    );
  }

  Widget _buildErrorSliver(
    AppLocalizations l, {
    required VoidCallback onRetry,
  }) {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline,
                color: SeoulColors.textFaint,
                size: 40,
              ),
              const SizedBox(height: 12),
              Text(
                l.appsLoadError,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
              const SizedBox(height: 4),
              Text(
                l.checkConnectionRetry,
                textAlign: TextAlign.center,
                style: SeoulType.caption,
              ),
              const SizedBox(height: 16),
              SeoulOutlineButton(
                label: l.commonRetry,
                icon: Icons.refresh,
                expand: false,
                height: SeoulSizes.minTapTarget,
                onPressed: onRetry,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Glass circle that opens the account screen. Same route as before.
class _AccountButton extends StatelessWidget {
  const _AccountButton({required this.tooltip});

  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: SeoulSizes.minTapTarget,
      height: SeoulSizes.minTapTarget,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: SeoulColors.glass,
        border: Border.fromBorderSide(
          BorderSide(color: SeoulColors.glassBorder),
        ),
      ),
      child: IconButton(
        padding: EdgeInsets.zero,
        icon: const Icon(
          Icons.account_circle_outlined,
          size: 20,
          color: SeoulColors.textPrimary,
        ),
        tooltip: tooltip,
        onPressed: () => context.push('/account'),
      ),
    );
  }
}

/// A single read-only university row: hangul glyph tile + name + city. No
/// selection, no checkbox, no apply button — browsing only.
class _UniversityTile extends StatelessWidget {
  const _UniversityTile({required this.university});

  final University university;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final uni = university;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(15),
      // One saved layer per row would be costly in a 38-row list.
      blur: false,
      radius: SeoulRadii.tile,
      child: Row(
        children: [
          HangulGlyphTile(glyph: HangulGlyphTile.firstSyllable(uni.nameKo)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  uni.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle,
                ),
                if (uni.location.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    uni.location,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.caption,
                  ),
                ],
              ],
            ),
          ),
          if (uni.isPartner) ...[
            const SizedBox(width: 10),
            StatusChip(label: l.filterPartner, dense: true),
          ],
        ],
      ),
    );
  }
}
