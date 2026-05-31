import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../l10n/app_localizations.dart';
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
                return const SliverFillRemaining(
                  child: Center(
                    child: Text(
                      'You have no active applications yet.',
                      style: TextStyle(color: Colors.white54),
                    ),
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
                    ..._buildPendingSection(state.pendingApps),

                  if (state.activeApps.isNotEmpty)
                    ..._buildActiveSection(state.activeApps),

                  if (state.hasActiveApplications)
                    const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              );
            },
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator.adaptive()),
            ),
            error: (err, stack) => SliverFillRemaining(
              child: Center(child: Text('Error loading applications: $err')),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPendingSection(List<dynamic> pendingApps) {
    return [
      const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            'Pending Applications',
            style: TextStyle(
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

  List<Widget> _buildActiveSection(List<dynamic> activeApps) {
    return [
      const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            'Active Applications',
            style: TextStyle(
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
