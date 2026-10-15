import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../assessment/data/assessment_controller.dart';
import '../../assessment/domain/assessment.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../../onboarding/domain/quiz_answers.dart';

/// What the student's profile says about each university, for every list, pin
/// and card that shows a chance.
///
/// Once the student has answered the assessment board its answers are the
/// profile. Until then the profile is read off the filter board (owner,
/// 2026-10-15): the degree filter is the route and "TOPIK ≤ N" is a TOPIK N;
/// everything else stays at the assessment's defaults. So a chance is always
/// there, and it moves as the filters do.
@immutable
class ChanceBook {
  const ChanceBook({required this.input, required this.rules, required this.answered, this.visa});

  final AssessmentInput input;
  final EligibilityRules rules;

  /// The student has answered something on the assessment board (false while
  /// the figures are read off the filters).
  final bool answered;

  /// The D-2 visa chance.
  final int? visa;

  /// The guideline the student's route reads of [u].
  CatalogGuideline guidelineOf(CatalogUniversity u) {
    final degree = input.route.catalogDegree;
    return degree == null ? u.primary : u.forDegree(degree) ?? u.primary;
  }

  /// [u]'s admission chance.
  int? admission(CatalogUniversity u) => admissionPercent(input, guidelineOf(u), rules: rules);

  /// What the same student would have with [topik].
  int? admissionWithTopik(CatalogUniversity u, int topik) =>
      admissionPercent(input.copyWith(topik: topik), guidelineOf(u), rules: rules);
}

/// The profile the filter board stands for.
AssessmentInput inputFromFilter(CatalogFilter f, AssessmentInput base) => base.copyWith(
  route: f.degree == CatalogDegree.master ? StudyRoute.master : StudyRoute.bachelor,
  topik: int.tryParse(f.topik ?? '') ?? 0,
);

final chanceBookProvider = Provider<ChanceBook>((ref) {
  final answered = ref.watch(assessmentTouchedProvider);
  final base = ref.watch(assessmentProvider);
  final input = answered ? base : inputFromFilter(ref.watch(catalogFilterProvider), base);
  final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
  final catalog = ref.watch(catalogProvider).value;
  final visa = catalog == null ? null : assess(input, catalog: catalog, rules: rules).visaPercent;
  return ChanceBook(input: input, rules: rules, answered: answered, visa: visa);
});

/// The best admission chance among [universities] and "N%" for the round
/// button; null when there is none to show.
int? bestChance(ChanceBook book, Iterable<CatalogUniversity> universities) {
  int? best;
  for (final u in universities) {
    final p = book.admission(u);
    if (p != null && (best == null || p > best)) best = p;
  }
  return best;
}
