import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../data/saved_universities.dart';
import 'chosen_screen.dart';
import 'discover_routes.dart';
import 'widgets/fd_parts.dart';

/// Design screen 16, "Saqlanganlar": the universities kept with ♡, newest
/// first. The heart takes one off the list; the first three can be compared
/// (screen 09) or weighed on the assessment (screen 11).
class SavedScreen extends ConsumerWidget {
  const SavedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final byId = {for (final u in all) u.institutionId: u};
    final saved = [
      for (final id in ref.watch(savedUniversitiesProvider))
        if (byId[id] != null) byId[id]!,
    ];
    final firstThree = [for (final u in saved.take(3)) u.institutionId];

    return Scaffold(
      backgroundColor: Colors.transparent,
      bottomNavigationBar: const GuestTabsBar(),
      body: FdPage(
        child: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              const GhostWord('저장', top: -14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FdTitleBar(
                    title: Text(l.fdSavedTitle, style: kFdTitleStyle),
                    trailing: l.fdCountTa(saved.length),
                  ),
                  const SizedBox(height: 14),
                  Expanded(
                    child: ListView(
                      padding: EdgeInsets.zero,
                      children: [
                        if (saved.isEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(24, 40, 24, 0),
                            child: Text(
                              l.fdSavedEmpty,
                              textAlign: TextAlign.center,
                              style: fdText(14, FontWeight.w600, FdColors.muted, height: 1.45),
                            ),
                          )
                        else ...[
                          const ColoredBox(color: FdColors.ink, child: SizedBox(height: 1.5)),
                          for (final u in saved)
                            SavedRow(
                              university: u,
                              onOpen: () => context.push(universityPath(u.institutionId)),
                              onUnsave: () => ref.read(savedUniversitiesProvider.notifier).remove(u.institutionId),
                            ),
                        ],
                        if (saved.length >= 2)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                            child: SavedCompareCard(
                              title: saved.length >= 3 ? l.fdSavedCompareThree : l.fdSavedCompareTwo,
                              onTap: () => context.push(kDiscoverComparePath, extra: firstThree),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (saved.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
                      child: HardButton(label: l.fdChosenAdmission, onPressed: () => openAssessmentFor(context, ref, firstThree)),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SavedRow extends StatelessWidget {
  const SavedRow({required this.university, required this.onOpen, required this.onUnsave});

  final CatalogUniversity university;
  final VoidCallback onOpen;
  final VoidCallback onUnsave;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: FdColors.ink, width: 1.5))),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              button: true,
              child: GestureDetector(
                onTap: onOpen,
                behavior: HitTestBehavior.opaque,
                child: Row(
                  children: [
                    UniThumb(university: university),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(university.displayName, style: fdText(14, FontWeight.w800, FdColors.ink, height: 1.2)),
                          const SizedBox(height: 2),
                          uniMetaLine(l, university, university.primary),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Semantics(
            button: true,
            label: l.fdUnsave,
            excludeSemantics: true,
            child: GestureDetector(
              onTap: onUnsave,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  shape: BoxShape.circle,
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: const Lucide(LucideIcons.heart, size: 16, color: FdColors.onLime),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "Uchalasini taqqoslash": the dashed card that opens screen 09.
class SavedCompareCard extends StatelessWidget {
  const SavedCompareCard({required this.title, required this.onTap});

  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: CustomPaint(
          foregroundPainter: const DashedPillPainter(color: FdColors.ink, radius: 16),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: FdColors.card, borderRadius: BorderRadius.circular(16)),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(12)),
                  child: const Lucide(LucideIcons.arrowLeftRight, size: 18, color: FdColors.navy),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: fdText(13, FontWeight.w800, FdColors.ink)),
                      const SizedBox(height: 2),
                      Text(l.fdSavedCompareBody, style: fdText(11, FontWeight.w400, FdColors.muted)),
                    ],
                  ),
                ),
                const Lucide(LucideIcons.arrowRight, size: 18, color: FdColors.ink),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
