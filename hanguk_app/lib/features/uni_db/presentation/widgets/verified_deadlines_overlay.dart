import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/feature_flags/uni_db_flag.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/uni_db_providers.dart';
import 'verified_deadline_card.dart';

/// Read-only sliver that surfaces the user's verified upcoming deadlines
/// above the existing free-text application entries (plan §H.5).
///
/// Renders nothing when:
///   * [kUniDbEnabled] is false (production app keeps its old layout), or
///   * the user has no tracked universities yet.
///
/// Seoul Night pass: the header matches the Applications tab's section
/// headers (SeoulType.title at the screen gutter) with the 마감 hangul accent
/// (spec §1 Korean voice). The host scroll view already reserves
/// `SeoulSizes.orbClearance` after its own content, so this sliver adds no
/// bottom clearance of its own — it never sits last.
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
        final l10n = AppLocalizations.of(context)!;
        return SliverMainAxisGroup(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  SeoulSizes.screenPadding,
                  12,
                  SeoulSizes.screenPadding,
                  6,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(
                      child: Text(
                        l10n.uniDbVerifiedDeadlinesTitle,
                        style: SeoulType.title,
                      ),
                    ),
                    // Padding, not SizedBox: it forwards the baseline the
                    // Row's baseline alignment needs.
                    const Padding(
                      padding: EdgeInsets.only(left: 8),
                      child: Text('마감', style: SeoulType.hangulLabel),
                    ),
                  ],
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
