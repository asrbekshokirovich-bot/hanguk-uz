import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/monthly_job.dart';
import '../repositories/monthly_job_repository.dart';
import 'backend.dart';
import 'json.dart';

/// [MonthlyJobRepository] on the tables `monthly_jobs` and
/// `monthly_applications` (row level security: open jobs for everyone, a
/// worker's own interest only).
class SupabaseMonthlyJobRepository implements MonthlyJobRepository {
  SupabaseMonthlyJobRepository(this._client);

  final SupabaseClient _client;

  String get _me => _client.auth.currentUser?.id ?? '';

  @override
  Future<List<MonthlyJob>> list() => backendCall(() async {
        final rows = await _client.from('monthly_jobs').select().eq('status', 'open').order('created_at', ascending: false).limit(200);
        final mine = await _client.from('monthly_applications').select('job_id').eq('worker_id', _me);
        final applied = {for (final r in mine) r['job_id'] as String};
        return [
          for (final row in rows) monthlyJobFromJson(row, applied: applied.contains(row['id'])),
        ];
      });

  @override
  Future<void> apply(String jobId) => backendCall(() async {
        await _client.from('monthly_applications').upsert({'job_id': jobId, 'worker_id': _me}, onConflict: 'job_id,worker_id');
      });

  @override
  Future<void> withdraw(String jobId) => backendCall(() async {
        await _client.from('monthly_applications').delete().eq('job_id', jobId).eq('worker_id', _me);
      });
}
