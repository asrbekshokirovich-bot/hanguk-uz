import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/feature_flags/uni_db_flag.dart';
import '../domain/review_queue_item.dart';

/// True if the current user may review uni_db extractions.
///
/// Authoritative source is the `fn_can_review_uni_db()` DB function, which
/// returns true for the legacy reviewer roles OR any non-student staff
/// member (user_roles app_role). Keeping the gate server-side means the UI
/// and the RLS/RPC authorization can never drift apart.
final canReviewUniDbProvider = FutureProvider<bool>((ref) async {
  if (!kUniDbEnabled) return false;
  final client = Supabase.instance.client;
  if (client.auth.currentUser == null) return false;
  final result = await client.rpc('fn_can_review_uni_db');
  return result == true;
});

/// Number of items currently in the HITL queue — drives the staff entry
/// badge on the home screen. Only queries when the caller can review.
final reviewQueueCountProvider = FutureProvider<int>((ref) async {
  if (!kUniDbEnabled) return 0;
  final canReview = await ref.watch(canReviewUniDbProvider.future);
  if (!canReview) return 0;
  final client = Supabase.instance.client;
  final rows = await client.from('v_review_queue_dashboard').select('id');
  return (rows as List).length;
});

/// Pending HITL queue, sorted by priority then queued_at (oldest first
/// inside priority).
final reviewQueueProvider = FutureProvider<List<ReviewQueueItem>>((ref) async {
  if (!kUniDbEnabled) return const [];
  final client = Supabase.instance.client;
  final rows = await client
      .from('v_review_queue_dashboard')
      .select()
      .order('priority')
      .order('created_at')
      .limit(50);
  return (rows as List)
      .map((r) => ReviewQueueItem.fromMap(r as Map<String, dynamic>))
      .toList(growable: false);
});

/// Service wrapping the three SQL helper RPCs.
class ReviewActionsService {
  ReviewActionsService(this._client);

  final SupabaseClient _client;

  Future<void> accept(String queueItemId) async {
    await _client.rpc(
      'fn_review_accept',
      params: {'queue_item_id': queueItemId},
    );
  }

  Future<void> editAccept(
    String queueItemId,
    Map<String, dynamic> correctedPayload,
  ) async {
    await _client.rpc(
      'fn_review_edit_accept',
      params: {
        'queue_item_id': queueItemId,
        'corrected_payload': correctedPayload,
      },
    );
  }

  Future<void> reject(
    String queueItemId, {
    required String reason,
    String? reasonDetail,
  }) async {
    await _client.rpc(
      'fn_review_reject',
      params: {
        'queue_item_id': queueItemId,
        'reason': reason,
        'reason_detail': reasonDetail,
      },
    );
  }
}

final reviewActionsProvider = Provider<ReviewActionsService>(
  (ref) => ReviewActionsService(Supabase.instance.client),
);
