import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../auth/data/auth_repository.dart';
import '../domain/university_choice.dart';

/// The universities the consultant offered this student, by rank. Read
/// through `my_university_choices()` (migration
/// 20261014200000_university_choice_confirmation.sql) — the catalog tables
/// behind the card are staff-only, so the function hands the student just
/// their own offers.
final myUniversityChoicesProvider = FutureProvider<List<UniversityChoice>>((ref) async {
  final authState = ref.watch(authStateProvider);
  final user = authState.value?.session?.user ?? Supabase.instance.client.auth.currentUser;
  if (user == null) return const [];
  final data = await Supabase.instance.client
      .rpc('my_university_choices')
      .timeout(const Duration(seconds: 20));
  final choices = [
    for (final row in (data as List? ?? const []))
      UniversityChoice.fromJson(Map<String, dynamic>.from(row as Map)),
  ];
  // Admission results (my_admission_results(), migration
  // 20261015120000_admission_results.sql). The choices still show if this
  // call fails — the results just stay hidden until the next refresh.
  final results = <String, Map<String, dynamic>>{};
  try {
    final rows = await Supabase.instance.client
        .rpc('my_admission_results')
        .timeout(const Duration(seconds: 20));
    for (final row in (rows as List? ?? const [])) {
      final r = Map<String, dynamic>.from(row as Map);
      results[r['institution_id'] as String] = r;
    }
  } catch (_) {}
  return [for (final c in choices) c.withResult(results[c.institutionId])];
});

/// "Shu universitetga boraman": the student confirms the final university the
/// consultant picked.
Future<void> confirmFinalUniversity(String institutionId) async {
  await Supabase.instance.client
      .rpc('confirm_final_university', params: {'p_institution_id': institutionId})
      .timeout(const Duration(seconds: 20));
}

/// "Roziman" ([accept] true) or "O'zgartirish so'rayman" with a [reason] and
/// an optional [note]. The server only lets the student answer their own,
/// not-yet-confirmed offers.
Future<void> respondToUniversityChoice({
  required String choiceId,
  required bool accept,
  ChangeReason? reason,
  String? note,
}) async {
  await Supabase.instance.client
      .rpc(
        'respond_university_choice',
        params: {
          'p_choice_id': choiceId,
          'p_accept': accept,
          'p_reason': accept ? null : reason?.name,
          'p_note': accept ? null : note,
        },
      )
      .timeout(const Duration(seconds: 20));
}
