import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/survey_text.dart';

class Survey {
  const Survey({
    required this.id,
    required this.title,
    this.description,
    required this.startsAt,
    this.endsAt,
    required this.questionCount,
    required this.answeredCount,
    this.titleTranslations,
    this.descriptionTranslations,
  });

  final String id;
  final String title;
  final String? description;
  final DateTime startsAt;
  final DateTime? endsAt;
  final int questionCount;
  final int answeredCount;

  /// [title] / [description] in the other app languages; see [surveyText].
  final SurveyTextTranslations? titleTranslations;
  final SurveyTextTranslations? descriptionTranslations;

  bool get isCompleted => questionCount > 0 && answeredCount >= questionCount;
}

class SurveyQuestion {
  const SurveyQuestion({
    required this.id,
    required this.questionText,
    required this.questionType,
    this.options,
    required this.sortOrder,
    required this.isRequired,
    this.existingAnswer,
    this.questionTextTranslations,
    this.optionTranslations = const {},
  });

  final String id;
  final String questionText;
  final String questionType;

  /// The Uzbek option values. These are also what gets stored as the answer,
  /// so they are submitted and compared as-is; only the label is translated.
  final List<String>? options;
  final int sortOrder;
  final bool isRequired;
  final dynamic existingAnswer;

  /// [questionText] in the other app languages; see [surveyText].
  final SurveyTextTranslations? questionTextTranslations;

  /// Display translations per Uzbek option value in [options].
  final Map<String, SurveyTextTranslations> optionTranslations;

  bool get hasAnswer => existingAnswer != null;
}

/// Translations of survey texts from `app_text_translations`, keyed by the
/// exact Uzbek source text. Translations are a nicety: when the lookup fails
/// the survey is still shown, in Uzbek.
Future<Map<String, SurveyTextTranslations>> _fetchTextTranslations(
  SupabaseClient client,
  Iterable<String?> texts,
) async {
  final sources = {
    for (final t in texts)
      if (t != null && t.trim().isNotEmpty) t,
  }.toList();
  if (sources.isEmpty) return const {};

  try {
    final rows = await client
        .from('app_text_translations')
        .select('source, en, ko, ru')
        .inFilter('source', sources);
    final result = <String, SurveyTextTranslations>{};
    for (final r in rows) {
      final source = r['source'] as String?;
      if (source == null) continue;
      final translations = <String, String>{
        for (final lang in const ['en', 'ko', 'ru'])
          if (r[lang] is String && (r[lang] as String).trim().isNotEmpty)
            lang: r[lang] as String,
      };
      if (translations.isNotEmpty) result[source] = translations;
    }
    return result;
  } catch (_) {
    return const {};
  }
}

final activeSurveysProvider = FutureProvider<List<Survey>>((ref) async {
  final client = Supabase.instance.client;
  final userId = client.auth.currentUser?.id;
  if (userId == null) return [];

  final rows = await client
      .from('surveys')
      .select('id, title, description, starts_at, ends_at')
      .eq('is_active', true)
      .lte('starts_at', DateTime.now().toIso8601String())
      .order('created_at', ascending: false);

  final surveyIds = rows.map((r) => r['id'] as String).toList();
  if (surveyIds.isEmpty) return [];

  final questions = await client
      .from('survey_questions')
      .select('id, survey_id')
      .inFilter('survey_id', surveyIds);

  final responses = await client
      .from('survey_responses')
      .select('question_id, survey_id')
      .eq('user_id', userId)
      .inFilter('survey_id', surveyIds);

  final questionCounts = <String, int>{};
  for (final q in questions) {
    final sid = q['survey_id'] as String;
    questionCounts[sid] = (questionCounts[sid] ?? 0) + 1;
  }

  final answeredCounts = <String, int>{};
  for (final r in responses) {
    final sid = r['survey_id'] as String;
    answeredCounts[sid] = (answeredCounts[sid] ?? 0) + 1;
  }

  final translations = await _fetchTextTranslations(client, [
    for (final r in rows) ...[r['title'] as String?, r['description'] as String?],
  ]);

  return rows.map((r) {
    final id = r['id'] as String;
    final title = r['title'] as String;
    final description = r['description'] as String?;
    return Survey(
      id: id,
      title: title,
      description: description,
      titleTranslations: translations[title],
      descriptionTranslations: translations[description],
      startsAt: DateTime.parse(r['starts_at'] as String),
      endsAt: r['ends_at'] != null
          ? DateTime.parse(r['ends_at'] as String)
          : null,
      questionCount: questionCounts[id] ?? 0,
      answeredCount: answeredCounts[id] ?? 0,
    );
  }).toList();
});

final surveyQuestionsProvider =
    FutureProvider.family<List<SurveyQuestion>, String>((ref, surveyId) async {
  final client = Supabase.instance.client;
  final userId = client.auth.currentUser?.id;

  final rows = await client
      .from('survey_questions')
      .select()
      .eq('survey_id', surveyId)
      .order('sort_order', ascending: true);

  List<Map<String, dynamic>> existing = [];
  if (userId != null) {
    final questionIds = rows.map((r) => r['id'] as String).toList();
    if (questionIds.isNotEmpty) {
      existing = await client
          .from('survey_responses')
          .select('question_id, answer')
          .eq('user_id', userId)
          .inFilter('question_id', questionIds);
    }
  }

  final answerMap = <String, dynamic>{};
  for (final e in existing) {
    answerMap[e['question_id'] as String] = e['answer'];
  }

  List<String>? optionsOf(Map<String, dynamic> r) {
    final rawOptions = r['options'];
    return rawOptions is List ? rawOptions.cast<String>() : null;
  }

  final translations = await _fetchTextTranslations(client, [
    for (final r in rows) ...[
      r['question_text'] as String?,
      ...?optionsOf(r),
    ],
  ]);

  return rows.map((r) {
    final qId = r['id'] as String;
    final questionText = r['question_text'] as String;
    final options = optionsOf(r);
    return SurveyQuestion(
      id: qId,
      questionText: questionText,
      questionTextTranslations: translations[questionText],
      optionTranslations: {
        for (final option in options ?? const <String>[])
          if (translations[option] != null) option: translations[option]!,
      },
      questionType: r['question_type'] as String,
      options: options,
      sortOrder: r['sort_order'] as int? ?? 0,
      isRequired: r['is_required'] as bool? ?? true,
      existingAnswer: answerMap[qId],
    );
  }).toList();
});

Future<void> submitSurveyResponse({
  required String surveyId,
  required String questionId,
  required dynamic answer,
}) async {
  final client = Supabase.instance.client;
  final userId = client.auth.currentUser!.id;

  await client.from('survey_responses').upsert(
    {
      'survey_id': surveyId,
      'question_id': questionId,
      'user_id': userId,
      'answer': answer,
    },
    onConflict: 'question_id,user_id',
  );
}
