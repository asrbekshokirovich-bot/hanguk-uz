import 'eligibility_engine.dart';
import 'quiz_answers.dart';

/// What S04 sends as `p_result` to `app_quiz_submit`, and what the CRM's
/// "Ilova" block reads back from `leads.eligibility_result`.
///
/// Codes, not text, wherever the CRM shows its own label; [planText] is the
/// plan in the visitor's language, which the Telegram bot sends when the
/// visitor opens Telegram from the result screen.
Map<String, dynamic> resultPayload(
  EligibilityResult r,
  QuizAnswers a, {
  required String planText,
}) {
  return {
    'band': r.band.code,
    'score': r.score,
    'tariff': r.tariff.code,
    'needs_operator': r.needsOperator,
    'budget_label': a.budget?.crmLabel,
    'factors': [
      for (final f in r.factors) {'kind': f.kind.name, 'positive': f.positive},
    ],
    'universities': [
      for (final m in r.universities)
        {
          'name': m.university.displayName,
          'city': m.university.city,
          'tuition_semester_usd': m.tuitionPerSemesterUsd,
          'topik_min': m.topikMin,
          'bank_usd': m.bankStatementUsd,
          'accredited': m.accredited,
        },
    ],
    if (r.yearlyCostUsd != null) 'yearly_cost_usd': [r.yearlyCostUsd!.$1, r.yearlyCostUsd!.$2],
    if (r.bankStatementUsd != null) 'bank_usd': r.bankStatementUsd,
    'steps': [for (final s in r.steps) s.name],
    'paths': [for (final p in r.paths) p.name],
    'plan_text': planText,
  };
}
