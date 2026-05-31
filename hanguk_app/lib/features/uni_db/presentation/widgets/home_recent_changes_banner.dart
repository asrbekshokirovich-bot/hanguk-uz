import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/feature_flags/uni_db_flag.dart';
import '../../data/recent_changes_provider.dart';
import '../../domain/recent_change.dart';

/// Quick-win home banner from plan §N — shows the user's tracked
/// universities' most-recent changes (correction notices first).
///
/// Surfaces nothing when the flag is off or the user isn't tracking any
/// institution. The banner is a Sliver so it slots into existing
/// CustomScrollViews.
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
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.notifications_active, size: 16),
                        SizedBox(width: 6),
                        Text(
                          'Updates from your tracked universities',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    for (final change in top) _ChangeLine(change: change),
                  ],
                ),
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
    final icon = change.isCorrectionNotice
        ? const Icon(Icons.priority_high, size: 14)
        : const Icon(Icons.fiber_manual_record, size: 8);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          icon,
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _summarise(change),
              style: const TextStyle(fontSize: 13),
            ),
          ),
          Text(
            _relative(change.detectedAt),
            style: const TextStyle(fontSize: 12),
          ),
        ],
      ),
    );
  }

  static String _summarise(RecentChange change) {
    final name = change.nameKo.isNotEmpty
        ? change.nameKo
        : (change.nameEn ?? '');
    final tag = change.isCorrectionNotice
        ? '정정공고'
        : (change.fieldName ?? change.entityType);
    return '$name · $tag';
  }

  static String _relative(DateTime when) {
    final delta = DateTime.now().difference(when);
    if (delta.inMinutes < 1) return 'just now';
    if (delta.inHours < 1) return '${delta.inMinutes}m ago';
    if (delta.inDays < 1) return '${delta.inHours}h ago';
    return '${delta.inDays}d ago';
  }
}
