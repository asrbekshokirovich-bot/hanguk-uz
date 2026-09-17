import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class Survey {
  const Survey({
    required this.id,
    required this.title,
    this.description,
    required this.startsAt,
    this.endsAt,
    required this.questionCount,
    required this.answeredCount,
  });

  final String id;
  final String title;
  final String? description;
  final DateTime startsAt;
  final DateTime? endsAt;
  final int questionCount;
  final int answeredCount;

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
  });

  final String id;
  final String questionText;
  final String questionType;
  final List<String>? options;
  final int sortOrder;
  final bool isRequired;
  final dynamic existingAnswer;

  bool get hasAnswer => existingAnswer != null;
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

  return rows.map((r) {
    final id = r['id'] as String;
    return Survey(
      id: id,
      title: r['title'] as String,
      description: r['description'] as String?,
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

  return rows.map((r) {
    final qId = r['id'] as String;
    final rawOptions = r['options'];
    List<String>? options;
    if (rawOptions is List) {
      options = rawOptions.cast<String>();
    }
    return SurveyQuestion(
      id: qId,
      questionText: r['question_text'] as String,
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
