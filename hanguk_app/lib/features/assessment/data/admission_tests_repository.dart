import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../auth/data/auth_repository.dart';
import '../domain/admission_tests.dart';

/// The signed-in student's Study Plan and interview results, by university:
/// the latest AI score of each (1–10, read as out of 100) and how many times
/// each was taken — the student's, or a guest's under their anonymous
/// session. Empty with no session.
final admissionTestsProvider = FutureProvider<Map<String, AdmissionTests>>((ref) async {
  ref.watch(authStateProvider);
  final client = Supabase.instance.client;
  final uid = client.auth.currentUser?.id;
  if (uid == null) return const {};
  try {
    final results = await Future.wait([
      client
          .from('study_plan_sessions')
          .select('target_institution_id, study_plan_analyses(overall_score, ai_response, created_at)')
          .eq('student_id', uid)
          .not('target_institution_id', 'is', null),
      client
          .from('interview_sessions')
          .select('target_institution_id, interview_feedback(overall_score, created_at)')
          .eq('student_id', uid)
          .not('target_institution_id', 'is', null),
    ]).timeout(const Duration(seconds: 20));
    return admissionTestsFrom(studyPlans: results[0] as List, interviews: results[1] as List);
  } catch (e) {
    debugPrint('[AdmissionTests] $e');
    return const {};
  }
});

/// [admissionTestsProvider]'s rows, grouped. Only scored attempts count.
@visibleForTesting
Map<String, AdmissionTests> admissionTestsFrom({required List<dynamic> studyPlans, required List<dynamic> interviews}) {
  List<(String, DateTime, int)> scored(List<dynamic> rows, String child) => [
    for (final r in rows.cast<Map<String, dynamic>>())
      if (r['target_institution_id'] case final String id)
        for (final a in _list(r[child]))
          if ((a['overall_score'], DateTime.tryParse(a['created_at'] as String? ?? '')) case (
            final num s,
            final DateTime at,
          ))
            (id, at, _exactScore(a['ai_response']) ?? (s * 10).round().clamp(0, 100)),
  ];

  final plans = scored(studyPlans, 'study_plan_analyses');
  final talks = scored(interviews, 'interview_feedback');
  final ids = {for (final x in plans) x.$1, for (final x in talks) x.$1};
  (int?, int) latest(List<(String, DateTime, int)> all, String id) {
    final mine = all.where((x) => x.$1 == id).toList()..sort((a, b) => b.$2.compareTo(a.$2));
    return (mine.firstOrNull?.$3, mine.length);
  }

  return {
    for (final id in ids)
      id: () {
        final (sp, spN) = latest(plans, id);
        final (iv, ivN) = latest(talks, id);
        return AdmissionTests(studyPlan: sp, interview: iv, studyPlanAttempts: spN, interviewAttempts: ivN);
      }(),
  };
}

List<Map<String, dynamic>> _list(Object? v) => switch (v) {
  final List<dynamic> l => l.cast<Map<String, dynamic>>(),
  final Map<String, dynamic> m => [m],
  _ => const [],
};

/// The Study Plan test's own mark out of 100, kept in `ai_response` by
/// `admission-study-plan-test`. `overall_score` holds it rounded to 1–10, so
/// read from there a 73 showed as 70 and a blank 0 as 10.
int? _exactScore(Object? aiResponse) {
  if (aiResponse is! String || !aiResponse.trimLeft().startsWith('{')) return null;
  try {
    final j = jsonDecode(aiResponse);
    if (j is Map && j['score'] is num) return (j['score'] as num).round().clamp(0, 100);
  } catch (_) {}
  return null;
}
