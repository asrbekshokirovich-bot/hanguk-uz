import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../training/data/plan_sections.dart';
import '../../training/data/study_plan_repository.dart';
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
///
/// The plan is the one the builder opens: the same rows, chosen the same way
/// ([fetchStudyPlanCandidates], [pickStudyPlanSession]) — a plan written
/// before a university was chosen included (audit P-F1). Reading changes
/// nothing: only the builder's open adopts such a plan.
final prepareProgressProvider = FutureProvider.autoDispose<PrepareProgress?>((ref) async {
  final target = ref.watch(slotsProvider).firstWhere((id) => id != null, orElse: () => null);
  final client = Supabase.instance.client;
  final uid = client.auth.currentUser?.id;
  if (uid == null) return null;
  try {
    final both = await Future.wait<List<Map<String, dynamic>>>([
      fetchStudyPlanCandidates(client, userId: uid, type: 'study_plan', targetUniversityId: target),
      client.from('interview_sessions').select('id').eq('student_id', uid).eq('status', 'completed'),
    ]);
    final plan = pickStudyPlanSession(both[0], targetUniversityId: target);
    final content = plan?.content ?? '';
    return PrepareProgress(planParts: writtenParts(parsePlan(content)), interviews: both[1].length);
  } catch (_) {
    return null;
  }
});
