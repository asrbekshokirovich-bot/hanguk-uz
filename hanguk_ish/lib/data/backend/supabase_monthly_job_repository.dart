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
        // Company, address and contact come only after an unlock (the
        // server hides them in `public_monthly_jobs`).
        final rows = (await _client.rpc('public_monthly_jobs') as List?) ?? const [];
        final mine = await _client.from('monthly_applications').select('job_id').eq('worker_id', _me);
        final applied = {for (final r in mine) r['job_id'] as String};
        return [
          for (final row in rows)
            if (row is Map) monthlyJobFromJson(row.cast<String, dynamic>(), applied: applied.contains(row['id'])),
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

  @override
  Future<MonthlyJob> unlock(String jobId) => backendCall(() async {
        final json = await _client.rpc('unlock_monthly_job', params: {'p_job': jobId}) as Map;
        return monthlyJobFromJson(json.cast<String, dynamic>(), applied: true);
      });
}
