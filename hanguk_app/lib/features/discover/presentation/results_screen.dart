import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import 'discover_routes.dart';
import 'filter_board_screen.dart';
import 'search_screen.dart';

/// What the filter board leaves, as the search's rows. Screen 06 (the
/// results with the three slots) takes this list over in the next step.
class ResultsScreen extends ConsumerWidget {
  const ResultsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final f = ref.watch(catalogFilterProvider);
    final list = boardResults(ref, all, f);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: () => context.pop(),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(l.catalogAiResultsTitle, style: fdText(18, FontWeight.w800, FdColors.ink))),
                    Text(l.fdCountTa(list.length), style: fdText(11, FontWeight.w700, FdColors.pageMuted)),
                  ],
                ),
              ),
              const ColoredBox(color: FdColors.pageRule, child: SizedBox(height: 1.5)),
              Expanded(
                child: ListView(
                  children: [
                    for (final u in list)
                      SearchResultRow(
                        row: (university: u, guideline: guidelineFor(u, f)!, hit: null),
                        reason: null,
                        onTap: () => context.push(universityPath(u.institutionId)),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
