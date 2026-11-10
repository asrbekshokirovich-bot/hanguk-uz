import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../training/data/plan_sections.dart';
import 'slots.dart';

/// What a signed-in student has done in Tayyorgarlik (Claude Design
/// «Tayyorgarlik», board 4, owner-approved 2026-11-10): the Study Plan's
/// written parts — of the plan the builder opens, the first chosen
/// university's — and the finished interview practices.
class PrepareProgress {
  const PrepareProgress({required this.planParts, required this.interviews});

  /// Parts of four with at least [kPlanMinChars] characters, as the
  /// builder's step chips count them.
  final int planParts;

  /// Interview sessions the student finished.
  final int interviews;
}

/// Null until loaded, or when it cannot be read: the cards then show no
/// number rather than a guessed one (they used to say «0 / 4» and «Yangi»
/// to everyone).
final prepareProgressProvider = FutureProvider.autoDispose<PrepareProgress?>((ref) async {
  final target = ref.watch(slotsProvider).firstWhere((id) => id != null, orElse: () => null);
  final client = Supabase.instance.client;
  final uid = client.auth.currentUser?.id;
  if (uid == null) return null;
  try {
    var plan = client
        .from('study_plan_sessions')
        .select('study_plan_drafts(content, version)')
        .eq('student_id', uid)
        .eq('document_type', 'study_plan')
        .neq('status', 'completed');
    if (target != null) plan = plan.eq('target_institution_id', target);
    final both = await Future.wait<List<Map<String, dynamic>>>([
      plan
          .order('updated_at', ascending: false)
          .order('version', ascending: false, referencedTable: 'study_plan_drafts')
          .limit(1, referencedTable: 'study_plan_drafts')
          .limit(1),
      client.from('interview_sessions').select('id').eq('student_id', uid).eq('status', 'completed'),
    ]);
    final sessions = both[0];
    final drafts = sessions.isEmpty ? const [] : (sessions.first['study_plan_drafts'] as List? ?? const []);
    final content = drafts.isEmpty ? '' : ((drafts.first as Map)['content'] as String? ?? '');
    return PrepareProgress(planParts: writtenParts(parsePlan(content)), interviews: both[1].length);
  } catch (_) {
    return null;
  }
});
