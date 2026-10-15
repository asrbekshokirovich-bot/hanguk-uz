import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../assessment/data/assessment_controller.dart';
import '../../assessment/domain/assessment.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';

/// What the student's answers on the assessment board say about each
/// university, for every list, pin and card that shows a chance.
///
/// Until the board has been touched there are no answers to speak of, so
/// every figure is null and the screens draw "?%" (owner, 2026-10-13); the
/// prototype's defaults are not used.
@immutable
class ChanceBook {
  const ChanceBook({required this.input, required this.rules, required this.answered, this.visa});

  final AssessmentInput input;
  final EligibilityRules rules;

  /// The student has answered something on the board.
  final bool answered;

  /// The D-2 visa chance; null until [answered].
  final int? visa;

  /// The guideline the student's route reads of [u].
  CatalogGuideline guidelineOf(CatalogUniversity u) {
    final degree = input.route.catalogDegree;
    return degree == null ? u.primary : u.forDegree(degree) ?? u.primary;
  }

  /// [u]'s admission chance; null until [answered].
  int? admission(CatalogUniversity u) => answered ? admissionPercent(input, guidelineOf(u), rules: rules) : null;

  /// What the same student would have with [topik].
  int? admissionWithTopik(CatalogUniversity u, int topik) =>
      answered ? admissionPercent(input.copyWith(topik: topik), guidelineOf(u), rules: rules) : null;
}

final chanceBookProvider = Provider<ChanceBook>((ref) {
  final input = ref.watch(assessmentProvider);
  final answered = ref.watch(assessmentTouchedProvider);
  final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
  final visa = answered ? ref.watch(assessmentOutcomeProvider)?.visaPercent : null;
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
