import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../design_system/adaptive/empty_state.dart';
import '../../uni_db/presentation/widgets/home_recent_changes_banner.dart';
import '../../uni_db/presentation/widgets/verified_deadlines_overlay.dart';
import 'widgets/application_card.dart';
import 'widgets/university_selection_view.dart';
import 'widgets/university_room_modal.dart';
import 'applications_view_model.dart';

class ApplicationsTab extends ConsumerWidget {
  const ApplicationsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabStateAsync = ref.watch(applicationsTabProvider);
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
              // UI/UX audit P0 N1/N2 (2026-05-12): the bare sign-out
              // icon previously dropped users to /welcome with no
              // confirmation, and the account-deletion + data-export
              // flows in `account_screen.dart` were unreachable. Both
              // session management and the destructive flows now live
              // behind the Account button — `account_screen.dart`
              // hosts Sign out, Download my data, and Delete account.
              IconButton(
                icon: const Icon(Icons.account_circle_outlined),
                tooltip: l.accountTooltip,
                onPressed: () => context.push('/account'),
              ),
            ],
          ),

          // University DB overlay (gated by --dart-define=UNI_DB_ENABLED=true).
          // Renders nothing when the flag is off or the user has no
          // tracked institutions, so production builds are unaffected.
          const HomeRecentChangesBannerSliver(),
          const VerifiedDeadlinesOverlaySliver(),

          tabStateAsync.when(
            data: (state) {
              if (state.isEmpty) {
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyState(
                    icon: Icons.school_outlined,
                    headline: l.appsEmptyTitle,
                    subhead: l.appsEmptyBody,
                  ),
                );
              }

              return SliverMainAxisGroup(
                slivers: [
                  // Suggestions Section
                  if (state.shouldShowSuggestions)
                    SliverToBoxAdapter(
                      child: UniversitySelectionView(
                        suggestions: state.suggestions,
                        onSubmitted: () {
                          // The submit function in the view now handles refresh/invalidation
                        },
                      ),
                    )
                  else
                    const SliverToBoxAdapter(child: SizedBox.shrink()),

                  // Applications Section
                  if (state.pendingApps.isNotEmpty)
                    ..._buildPendingSection(l, state.pendingApps),

                  if (state.activeApps.isNotEmpty)
                    ..._buildActiveSection(l, state.activeApps),

                  if (state.hasActiveApplications)
                    const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              );
            },
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator.adaptive()),
            ),
            error: (err, stack) => SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        color: Colors.white54,
                        size: 40,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        l.appsLoadError,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white70),
                      ),
                      const SizedBox(height: 16),
                      TextButton.icon(
                        onPressed: () =>
                            ref.invalidate(applicationsTabProvider),
                        icon: const Icon(Icons.refresh),
                        label: Text(l.commonRetry),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPendingSection(
    AppLocalizations l,
    List<dynamic> pendingApps,
  ) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            l.appsPendingHeading,
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
          final app = pendingApps[index];
          return ApplicationCard(
            application: app,
            onDiscussionTap: () {
              UniversityRoomModal.show(context, app, initialTabIndex: 1);
            },
          );
        }, childCount: pendingApps.length),
      ),
    ];
  }

  List<Widget> _buildActiveSection(
    AppLocalizations l,
    List<dynamic> activeApps,
  ) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            l.appsActiveHeading,
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
          final app = activeApps[index];
          return ApplicationCard(
            application: app,
            onDiscussionTap: () {
              UniversityRoomModal.show(context, app, initialTabIndex: 1);
            },
          );
        }, childCount: activeApps.length),
      ),
    ];
  }
}
