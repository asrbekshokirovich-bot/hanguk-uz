import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../catalog/data/catalog_repository.dart';
import '../domain/eligibility_engine.dart';
import '../domain/quiz_answers.dart';
import 'quiz_repository.dart';

/// The quiz in progress (S02) and what happened after the result (S04).
@immutable
class QuizState {
  const QuizState({
    this.answers = const QuizAnswers(),
    this.step = 1,
    this.submittedPhone,
    this.submittedName,
    this.linkCode,
  });

  final QuizAnswers answers;

  /// The question on screen, 1–6.
  final int step;

  /// Set once S04 went through.
  final String? submittedPhone;
  final String? submittedName;
  final String? linkCode;

  bool get submitted => submittedPhone != null;

  QuizState copyWith({
    QuizAnswers? answers,
    int? step,
    String? submittedPhone,
    String? submittedName,
    String? linkCode,
  }) {
    return QuizState(
      answers: answers ?? this.answers,
      step: step ?? this.step,
      submittedPhone: submittedPhone ?? this.submittedPhone,
      submittedName: submittedName ?? this.submittedName,
      linkCode: linkCode ?? this.linkCode,
    );
  }
}

class QuizNotifier extends Notifier<QuizState> {
  @override
  QuizState build() => const QuizState();

  void update(QuizAnswers Function(QuizAnswers) change) {
    state = state.copyWith(answers: change(state.answers));
  }

  /// Next question; false on the last one.
  bool next() {
    if (state.step >= kQuizSteps) return false;
    state = state.copyWith(step: state.step + 1);
    return true;
  }

  /// Previous question; false on the first one.
  bool back() {
    if (state.step <= 1) return false;
    state = state.copyWith(step: state.step - 1);
    return true;
  }

  void restart() => state = const QuizState();

  void markSubmitted({required String phone, required String name, String? linkCode}) {
    state = state.copyWith(submittedPhone: phone, submittedName: name, linkCode: linkCode);
  }
}

final quizProvider = NotifierProvider<QuizNotifier, QuizState>(QuizNotifier.new);

/// The result for the current answers. Recomputed when the answers, the
/// catalogue or the rules change; null until the catalogue and the rules are
/// loaded (the rules fall back to their defaults offline).
final eligibilityResultProvider = Provider<AsyncValue<EligibilityResult>>((ref) {
  final answers = ref.watch(quizProvider.select((s) => s.answers));
  final catalog = ref.watch(catalogProvider);
  final rules = ref.watch(eligibilityRulesProvider);
  if (rules.isLoading || catalog.isLoading) return const AsyncValue.loading();
  return AsyncValue.data(
    evaluateEligibility(
      answers,
      catalog: catalog.value ?? const [],
      rules: rules.value ?? const EligibilityRules(),
    ),
  );
});
