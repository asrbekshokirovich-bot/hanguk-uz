import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../domain/assessment.dart';

/// How many universities the board weighs (design screen 11).
const int kAssessmentUniversities = 3;

/// The board's answers, kept while the app runs so the report and a second
/// visit see the same ones.
class AssessmentNotifier extends Notifier<AssessmentInput> {
  @override
  AssessmentInput build() => const AssessmentInput();

  /// A change the student made on the board.
  void set(AssessmentInput next) {
    state = next;
    ref.read(assessmentTouchedProvider.notifier).mark();
  }

  /// The universities to weigh, chosen elsewhere (the slots, the saved list,
  /// the comparison); the board's other answers stay as they are.
  void useUniversities(List<String> ids) =>
      state = state.copyWith(universityIds: ids.take(kAssessmentUniversities).toList());

  /// The universities to weigh, starting from [startId] (the card or page the
  /// student came from), then the saved ones, then the catalogue's first for
  /// the route — three in all.
  void startFrom(String? startId, List<CatalogUniversity> catalog, List<String> saved) {
    final degree = state.route.catalogDegree;
    bool fits(CatalogUniversity u) => degree == null || u.hasDegree(degree);
    final known = {for (final u in catalog) u.institutionId: u};
    final ids = <String>[];
    void add(String id) {
      final u = known[id];
      if (u != null && fits(u) && !ids.contains(id) && ids.length < kAssessmentUniversities) ids.add(id);
    }

    if (startId != null) add(startId);
    for (final id in state.universityIds) {
      add(id);
    }
    for (final id in saved) {
      add(id);
    }
    for (final u in catalog) {
      add(u.institutionId);
    }
    state = state.copyWith(universityIds: ids);
  }
}

final assessmentProvider = NotifierProvider<AssessmentNotifier, AssessmentInput>(AssessmentNotifier.new);

/// Whether the student has answered anything on the board yet: until then an
/// admission chance would rest on the defaults, so screens show "?%".
class AssessmentTouchedNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void mark() {
    if (!state) state = true;
  }
}

final assessmentTouchedProvider = NotifierProvider<AssessmentTouchedNotifier, bool>(AssessmentTouchedNotifier.new);

/// The board's outcome for the current answers; null until the catalogue is
/// read.
final assessmentOutcomeProvider = Provider<AssessmentOutcome?>((ref) {
  final catalog = ref.watch(catalogProvider).value;
  if (catalog == null) return null;
  final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
  return assess(ref.watch(assessmentProvider), catalog: catalog, rules: rules);
});

/// What the report's form sent (design screen 12 → 13).
typedef AssessmentSent = ({String name, String phone, String? linkCode});

class AssessmentSentNotifier extends Notifier<AssessmentSent?> {
  @override
  AssessmentSent? build() => null;

  void set(AssessmentSent sent) => state = sent;
}

final assessmentSentProvider = NotifierProvider<AssessmentSentNotifier, AssessmentSent?>(AssessmentSentNotifier.new);
