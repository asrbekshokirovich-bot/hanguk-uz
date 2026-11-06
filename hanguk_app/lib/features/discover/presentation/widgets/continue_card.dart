import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/analytics/tracked.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../assessment/data/assessment_controller.dart';
import '../../../assessment/domain/assessment.dart';
import '../../../catalog/data/catalog_repository.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../../onboarding/data/quiz_repository.dart';
import '../../../onboarding/domain/eligibility_engine.dart';
import '../../data/application_windows.dart';
import '../../data/slots.dart';
import '../discover_routes.dart';
import '../guest_application_path_screen.dart' show daysUntil, heartedUniversities;
import 'app_nav.dart';

/// «Davom etish» (ushlab qolish P22, Claude Design D7): a guest who comes
/// back with answers kept (P05) and ♥ universities sees them at the top of
/// the home: each one's admission percent, the nearest online deadline, and
/// the way on to the application path or the report.
class ContinueCard extends ConsumerWidget {
  const ContinueCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final touched = ref.watch(assessmentTouchedProvider);
    final catalog = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final hearted = heartedUniversities(ref.watch(slotsProvider), catalog);
    if (!touched || hearted.isEmpty) return const SizedBox.shrink();
    final input = ref.watch(assessmentProvider);
    final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
    final windows = ref.watch(applicationWindowsProvider).value ?? const <String, CatalogRound>{};
    final today = DateTime.now();

    CatalogGuideline guideline(CatalogUniversity u) {
      final d = input.route.catalogDegree;
      return d == null ? u.primary : u.forDegree(d) ?? u.primary;
    }

    // The nearest deadline still ahead among them.
    (CatalogUniversity, String)? nearest;
    for (final u in hearted) {
      final end = windows[guideline(u).id]?.endDate;
      final left = daysUntil(end, today);
      if (end == null || left == null || left < 0) continue;
      if (nearest == null || end.compareTo(nearest.$2) < 0) nearest = (u, end);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: FdColors.blue,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.continueEyebrow, style: fdText(12, FontWeight.w800, FdColors.onNavyMuted, letterSpacing: 0.5)),
          const SizedBox(height: 8),
          Text(l.continueTitle, style: fdText(18, FontWeight.w800, Colors.white, height: 1.25)),
          const SizedBox(height: 12),
          for (final u in hearted) ...[
            Row(
              children: [
                Expanded(child: Text(u.displayName, style: fdText(13.5, FontWeight.w600, Colors.white))),
                Text('${admissionPercent(input, guideline(u), rules: rules)}%',
                    style: fdText(13.5, FontWeight.w800, FdColors.lime)),
              ],
            ),
            const SizedBox(height: 8),
          ],
          if (nearest != null) ...[
            Text('${l.continueNearest}: ${nearest.$1.displayName} — ${MaterialLocalizations.of(context).formatShortMonthDay(DateTime.parse(nearest.$2))}',
                style: fdText(13, FontWeight.w600, FdColors.onNavyMuted, height: 1.35)),
            const SizedBox(height: 12),
          ],
          GestureDetector(
            onTap: tracked('continue.path', () => context.go('$kDiscoverPath?tab=${AppTab.application}')),
            child: Container(
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: FdColors.lime,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: FdColors.ink, width: 1.5),
                boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
              ),
              child: Text(l.continuePath, style: fdText(15, FontWeight.w800, FdColors.onLime)),
            ),
          ),
          TextButton(
            onPressed: tracked('continue.report', () => context.push(kAssessmentReportPath)),
            style: TextButton.styleFrom(minimumSize: const Size.fromHeight(44)),
            child: Text(l.continueReport, style: fdText(14, FontWeight.w700, Colors.white)),
          ),
        ],
      ),
    );
  }
}
