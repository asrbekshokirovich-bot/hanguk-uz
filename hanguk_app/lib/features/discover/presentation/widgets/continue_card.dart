import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/analytics/tracked.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../assessment/data/assessment_controller.dart';
import '../../../assessment/domain/assessment.dart';
import '../../../catalog/data/catalog_repository.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../../client/presentation/widgets/journey_parts.dart' show journeyMonth;
import '../../../onboarding/data/quiz_repository.dart';
import '../../../onboarding/domain/eligibility_engine.dart';
import '../../data/application_windows.dart';
import '../discover_routes.dart';
import '../guest_application_path_screen.dart' show daysUntil;
import 'app_nav.dart';

/// «Davom etish» (ushlab qolish P22, Claude Design D7): a guest who comes
/// back with answers kept (P05) sees the assessment's universities at the top
/// of the home — «Baholashingiz saqlangan: 3 ta universitet», each one's
/// admission percent, the nearest online deadline — and the way on to the
/// application path or the report.
class ContinueCard extends ConsumerWidget {
  const ContinueCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final touched = ref.watch(assessmentTouchedProvider);
    final input = ref.watch(assessmentProvider);
    final unis = continueUniversities(ref);
    if (!touched || unis.isEmpty) return const SizedBox.shrink();
    final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
    final windows = ref.watch(applicationWindowsProvider).value ?? const <String, CatalogRound>{};
    final today = DateTime.now();

    CatalogGuideline guideline(CatalogUniversity u) {
      final d = input.route.catalogDegree;
      return d == null ? u.primary : u.forDegree(d) ?? u.primary;
    }

    // The nearest deadline still ahead among them.
    (CatalogUniversity, String)? nearest;
    for (final u in unis) {
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
          Text(l.continueTitleCount('${unis.length}'), style: fdText(18, FontWeight.w800, Colors.white, height: 1.25)),
          const SizedBox(height: 12),
          for (final u in unis) ...[
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
            Text(l.continueNearestLine(nearest.$1.displayName, continueDay(context, DateTime.parse(nearest.$2))),
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

/// The assessment's universities the card lists (D7).
List<CatalogUniversity> continueUniversities(WidgetRef ref) {
  final catalog = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
  final known = {for (final u in catalog) u.institutionId: u};
  return [for (final id in ref.watch(assessmentProvider).universityIds) ?known[id]];
}

/// Whether the «Davom etish» card shows — the home then greets the guest
/// with «Xush kelibsiz qaytib!» (D7) instead of its usual title.
bool continueCardShown(WidgetRef ref) => ref.watch(assessmentTouchedProvider) && continueUniversities(ref).isNotEmpty;

/// «20-noyabr» in Uzbek (the design's «20-noyabrgacha»), the locale's day and
/// full month elsewhere.
String continueDay(BuildContext context, DateTime d) {
  final locale = AppLocalizations.of(context)!.localeName;
  return locale.startsWith('uz') ? '${d.day}-${journeyMonth(context, d)}' : DateFormat.MMMMd(locale).format(d);
}
