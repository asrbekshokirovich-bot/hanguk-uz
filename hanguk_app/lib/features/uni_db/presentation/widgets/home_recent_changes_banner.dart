import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/feature_flags/uni_db_flag.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/recent_changes_provider.dart';
import '../../domain/recent_change.dart';

/// Quick-win home banner from plan §N — shows the user's tracked
/// universities' most-recent changes (correction notices first).
///
/// Surfaces nothing when the flag is off or the user isn't tracking any
/// institution. The banner is a Sliver so it slots into existing
/// CustomScrollViews.
///
/// Seoul Night pass: a glass card matching the Applications tab it sits in.
/// 변경 — "changes" — is the decorative hangul accent (spec §1 Korean voice);
/// a correction notice keeps its Korean term 정정공고 on a warning chip, since
/// that is the word the student meets on the university's own site.
class HomeRecentChangesBannerSliver extends ConsumerWidget {
  const HomeRecentChangesBannerSliver({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!kUniDbEnabled) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }
    final asyncRows = ref.watch(recentChangesProvider);
    return asyncRows.when(
      loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
      error: (_, _) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (rows) {
        if (rows.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        // Promote correction notices to the top.
        final sorted = [...rows]
          ..sort((a, b) {
            if (a.isCorrectionNotice && !b.isCorrectionNotice) return -1;
            if (!a.isCorrectionNotice && b.isCorrectionNotice) return 1;
            return b.detectedAt.compareTo(a.detectedAt);
          });
        final top = sorted.take(3).toList(growable: false);
        final l10n = AppLocalizations.of(context)!;
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              8,
              SeoulSizes.screenPadding,
              8,
            ),
            child: GlassCard(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              // One saved layer saved — the card reads the same without the
              // backdrop blur against the app gradient (GlassCard guidance).
              blur: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          l10n.uniDbRecentChangesTitle,
                          style: SeoulType.subtitle,
                        ),
                      ),
                      // Padding, not SizedBox: it forwards the baseline the
                      // Row's baseline alignment needs.
                      const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: Text('변경', style: SeoulType.hangulLabel),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  for (final change in top) _ChangeLine(change: change),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ChangeLine extends StatelessWidget {
  const _ChangeLine({required this.change});

  final RecentChange change;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final correction = change.isCorrectionNotice;
    final name = change.nameKo.isNotEmpty
        ? change.nameKo
        : (change.nameEn ?? '');

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          // Status dot — warning-toned for a correction notice, faint
          // otherwise. Never lime: nothing here is an action or progress.
          SizedBox(
            width: 8,
            height: 8,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: correction ? SeoulColors.warning : SeoulColors.textFaint,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.bodySecondary.copyWith(
                    color: SeoulColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _relative(l10n, change.detectedAt),
                  style: SeoulType.caption,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // 정정공고 stays Korean in every locale — it is the official term
          // the student encounters on Korean university sites.
          StatusChip(
            label: correction
                ? '정정공고'
                : (change.fieldName ?? change.entityType),
            tone: correction ? StatusTone.warning : StatusTone.neutral,
            dense: true,
          ),
        ],
      ),
    );
  }

  static String _relative(AppLocalizations l10n, DateTime when) {
    final delta = DateTime.now().difference(when);
    if (delta.inMinutes < 1) return l10n.timeJustNow;
    if (delta.inHours < 1) return l10n.timeMinutesAgo(delta.inMinutes);
    if (delta.inDays < 1) return l10n.timeHoursAgo(delta.inHours);
    return l10n.timeDaysAgo(delta.inDays);
  }
}
