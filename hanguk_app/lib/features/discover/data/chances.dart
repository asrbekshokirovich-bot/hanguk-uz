import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../assessment/data/admission_tests_repository.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../assessment/domain/admission_tests.dart';
import '../../assessment/domain/assessment.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';

/// What the student's profile says about each university, for every list, pin
/// and card that shows a chance. The profile is the one on the home board
/// ([assessmentProvider]: TOPIK, certificate, bank, degree, past refusal), so
/// a figure is always there and moves with the board.
@immutable
class ChanceBook {
  const ChanceBook({required this.input, required this.rules, this.visa, this.visaConsultant, this.tests = const {}});

  final AssessmentInput input;
  final EligibilityRules rules;

  /// The Study Plan and interview results by university ([combinedAdmission]).
  final Map<String, AdmissionTests> tests;

  AdmissionTests testsOf(CatalogUniversity u) => tests[u.institutionId] ?? AdmissionTests.none;

  /// The D-2 visa chance, and with a consultant.
  final int? visa;
  final int? visaConsultant;

  /// The guideline the student's route reads of [u].
  CatalogGuideline guidelineOf(CatalogUniversity u) {
    final degree = input.route.catalogDegree;
    return degree == null ? u.primary : u.forDegree(degree) ?? u.primary;
  }

  /// [u]'s admission chance: the profile's, with the tests taken for it.
  int admission(CatalogUniversity u) => combinedAdmission(profileAdmission(u), testsOf(u));

  /// The profile's part alone (TOPIK, certificate, partner).
  int profileAdmission(CatalogUniversity u) => admissionPercent(input, guidelineOf(u), rules: rules);

  /// What the same student would have with [topik].
  int admissionWithTopik(CatalogUniversity u, int topik) =>
      combinedAdmission(admissionPercent(input.copyWith(topik: topik), guidelineOf(u), rules: rules), testsOf(u));
}

final chanceBookProvider = Provider<ChanceBook>((ref) {
  final input = ref.watch(assessmentProvider);
  final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
  final catalog = ref.watch(catalogProvider).value;
  final outcome = catalog == null ? null : assess(input, catalog: catalog, rules: rules);
  final tests = ref.watch(admissionTestsProvider).value ?? const {};
  return ChanceBook(
    input: input,
    rules: rules,
    visa: outcome?.visaPercent,
    visaConsultant: outcome?.visaWithConsultantPercent,
    tests: tests,
  );
});

/// The best admission chance among [universities] and "N%" for the round
/// button; null when there is none to show.
int? bestChance(ChanceBook book, Iterable<CatalogUniversity> universities) {
  int? best;
  for (final u in universities) {
    final p = book.admission(u);
    if (best == null || p > best) best = p;
  }
  return best;
}
