import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/feature_flags/uni_db_flag.dart';
import '../../data/uni_db_providers.dart';
import 'verified_deadline_card.dart';

/// Read-only sliver that surfaces the user's verified upcoming deadlines
/// above the existing free-text application entries (plan §H.5).
///
/// Renders nothing when:
///   * [kUniDbEnabled] is false (production app keeps its old layout), or
///   * the user has no tracked universities yet.
class VerifiedDeadlinesOverlaySliver extends ConsumerWidget {
  const VerifiedDeadlinesOverlaySliver({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!kUniDbEnabled) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }
    final asyncRows = ref.watch(userTrackedProvider);
    return asyncRows.when(
      loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
      error: (_, _) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (rows) {
        if (rows.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        return SliverMainAxisGroup(
          slivers: [
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text(
                  'Verified upcoming deadlines',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            SliverList.builder(
              itemCount: rows.length,
              itemBuilder: (_, i) => VerifiedDeadlineCard(deadline: rows[i]),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
          ],
        );
      },
    );
  }
}
