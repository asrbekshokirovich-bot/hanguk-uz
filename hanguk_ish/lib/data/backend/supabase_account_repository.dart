import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/worker/profile/worker_profile_draft.dart';
import '../../features/worker/profile/worker_profile_repository.dart';
import '../models/account.dart';
import '../repositories/account_repository.dart';
import '../repositories/shift_repository.dart';
import 'backend.dart';
import 'json.dart';

/// [WorkerAccountRepository] on the Hanguk Ish database.
class SupabaseAccountRepository implements WorkerAccountRepository {
  SupabaseAccountRepository(this._client);

  final SupabaseClient _client;

  String get _me => _client.auth.currentUser?.id ?? (throw const ShiftActionException('NOT_AUTHENTICATED'));

  @override
  Future<WorkerStats> stats() => backendCall(() async {
        final rows = await _client.rpc('worker_stats', params: {'p_worker': _me}) as List;
        if (rows.isEmpty) return const WorkerStats(completedShifts: 0, ratingCount: 0, reliability: 100);
        return workerStatsFromJson(rows.first as Json);
      });

  @override
  Future<List<HiNotification>> notifications() => backendCall(() async {
        final cards = await _client.rpc('my_notifications',
            params: {'p_limit': 100, 'p_kinds': workerNotificationKinds}) as List;
        return [
          for (final card in cards) ?hiNotificationFromJson(card as Json),
        ];
      });

  @override
  Future<void> markNotificationsRead() => backendCall(() async {
        await _client.rpc('mark_notifications_read', params: {'p_kinds': workerNotificationKinds});
      });

  @override
  Future<void> report(ReportSubject subject, String text) => backendCall(() async {
        final body = text.trim();
        if (body.length > 2000) throw const ShiftActionException('INVALID');
        await _client.from('reports').insert({'reason': reportReason(subject), 'body': body});
      });
}

/// `reports.reason` of an A11 subject.
String reportReason(ReportSubject subject) => switch (subject) {
      ReportSubject.employer => 'employer',
      ReportSubject.payment => 'payment',
      ReportSubject.safety => 'safety',
      ReportSubject.other => 'other',
    };

/// Uploads a photo the worker picked and returns its Storage path.
typedef AvatarUpload = Future<String> Function(SupabaseClient client, String userId, String localPath);

Future<String> _uploadToStorage(SupabaseClient client, String userId, String localPath) async {
  final extension = localPath.contains('.') ? localPath.split('.').last.toLowerCase() : 'jpg';
  final type = switch (extension) { 'png' => 'image/png', 'webp' => 'image/webp', _ => 'image/jpeg' };
  final path = '$userId/avatar-${DateTime.now().millisecondsSinceEpoch}.${type.split('/').last}';
  await client.storage.from('avatars').upload(path, File(localPath), fileOptions: FileOptions(contentType: type));
  return path;
}

/// [WorkerProfileRepository] on the Hanguk Ish database: A02 is saved with
/// `save_worker_profile` (one transaction), the photo goes to the «avatars»
/// bucket first.
class SupabaseWorkerProfileRepository implements WorkerProfileRepository {
  SupabaseWorkerProfileRepository(this._client, this._config, {AvatarUpload upload = _uploadToStorage})
      : _upload = upload;

  final SupabaseClient _client;
  final BackendConfig _config;
  final AvatarUpload _upload;

  @override
  Future<void> save(WorkerProfileDraft draft) => backendCall(() async {
        final me = _client.auth.currentUser?.id;
        if (me == null) throw const ShiftActionException('NOT_AUTHENTICATED');
        final photo = draft.photoPath;
        // A URL is the photo saved before; only a newly picked file uploads.
        final avatarPath = photo == null || photo.startsWith('http') ? null : await _upload(_client, me, photo);
        await _client.rpc('save_worker_profile', params: {
          'p_first_name': draft.firstName.trim(),
          'p_last_name': draft.lastName.trim(),
          'p_languages': [for (final l in draft.languages) l],
          'p_topik': draft.topik,
          'p_university': draft.university,
          'p_district': draft.district,
          'p_availability': draft.availability,
          'p_visa': draft.visa,
          'p_avatar_path': avatarPath,
        });
      });

  @override
  Future<WorkerProfileDraft?> load() => backendCall(() async {
        final profile = await _client.rpc('my_profile');
        return workerProfileFromJson(profile as Json?, publicUrl: _config.publicUrl);
      });
}
