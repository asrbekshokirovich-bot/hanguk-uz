import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../data/saved_universities.dart';
import '../discover_routes.dart';
import '../saved_screen.dart' show SavedCompareCard, SavedRow;

/// How much of the section's heading shows at the foot of the first screen.
const double kSavedHeadPeek = 34;

/// The saved universities, continuing the home page below its first screen:
/// scroll down and they follow on. Only the heading's top edge shows until
/// then. The bottom tabs are not part of the page and never move.
class SavedSection extends ConsumerWidget {
  const SavedSection({super.key, required this.saved});

  final List<CatalogUniversity> saved;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final firstThree = [for (final u in saved.take(3)) u.institutionId];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: kSavedHeadPeek,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              children: [
                const Lucide(LucideIcons.heart, size: 14, color: FdColors.muted),
                const SizedBox(width: 6),
                Text(l.fdSavedTitle, style: fdText(13, FontWeight.w800, FdColors.muted)),
                const SizedBox(width: 6),
                Text(l.fdCountTa(saved.length), style: fdText(13, FontWeight.w700, FdColors.muted)),
                const Spacer(),
                const Lucide(LucideIcons.chevronDown, size: 16, color: FdColors.muted),
              ],
            ),
          ),
        ),
        const ColoredBox(color: FdColors.ink, child: SizedBox(height: 1.5)),
        for (final u in saved)
          SavedRow(
            university: u,
            onOpen: () => context.push(universityPath(u.institutionId)),
            onUnsave: () => ref.read(savedUniversitiesProvider.notifier).remove(u.institutionId),
          ),
        if (saved.length >= 2)
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
            child: SavedCompareCard(
              title: saved.length >= 3 ? l.fdSavedCompareThree : l.fdSavedCompareTwo,
              onTap: () => context.push(kDiscoverComparePath, extra: firstThree),
            ),
          ),
        const SizedBox(height: 24),
      ],
    );
  }
}
