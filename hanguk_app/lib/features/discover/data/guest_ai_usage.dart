import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/analytics/app_events.dart';

/// What a guest has used of the free tools (Claude Design D4): Hanguk AI
/// questions today and interview practices this week, from the server's own
/// counters (`app_guest_ai_usage`, migration 20261106170000).
class GuestAiUsage {
  const GuestAiUsage({required this.aiUsed, required this.aiLimit, required this.interviewUsed, required this.interviewLimit});

  factory GuestAiUsage.fromJson(Map<String, dynamic> j) => GuestAiUsage(
    aiUsed: (j['ai_used'] as num?)?.toInt() ?? 0,
    aiLimit: (j['ai_limit'] as num?)?.toInt() ?? 10,
    interviewUsed: (j['interview_used'] as num?)?.toInt() ?? 0,
    interviewLimit: (j['interview_limit'] as num?)?.toInt() ?? 1,
  );

  final int aiUsed;
  final int aiLimit;
  final int interviewUsed;
  final int interviewLimit;

  int get aiLeft => (aiLimit - aiUsed).clamp(0, aiLimit);
  bool get interviewFree => interviewUsed < interviewLimit;
}

/// Null when the phone has no install id yet or the server cannot be reached:
/// the screen then shows the plain limits, never a guessed count.
final guestAiUsageProvider = FutureProvider.autoDispose<GuestAiUsage?>((ref) async {
  final install = AppEvents.installId;
  if (install == null) return null;
  try {
    final res = await Supabase.instance.client.rpc('app_guest_ai_usage', params: {'p_install_id': install});
    return res is Map ? GuestAiUsage.fromJson(Map<String, dynamic>.from(res)) : null;
  } catch (_) {
    return null;
  }
});
