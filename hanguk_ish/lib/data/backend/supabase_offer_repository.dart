import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/job_offer.dart';
import '../repositories/offer_repository.dart';
import 'backend.dart';
import 'json.dart';

/// [OfferRepository] on the functions of `…_ish_puyl_offers.sql`.
class SupabaseOfferRepository implements OfferRepository {
  SupabaseOfferRepository(this._client);

  final SupabaseClient _client;

  @override
  Future<List<JobOffer>> offers() => backendCall(() async {
        final rows = await _client.rpc('my_offers') as List? ?? const [];
        return [for (final r in rows) if (r is Map) jobOfferFromJson(r.cast<String, dynamic>())];
      });

  @override
  Future<OpenedJob> unlock(String shiftId) => backendCall(() async {
        final json = await _client.rpc('unlock_offer', params: {'p_shift': shiftId}) as Map;
        return openedJobFromJson(json.cast<String, dynamic>());
      });

  @override
  Future<List<OpenedJob>> jobs() => backendCall(() async {
        final rows = await _client.rpc('my_jobs') as List? ?? const [];
        return [for (final r in rows) if (r is Map) openedJobFromJson(r.cast<String, dynamic>())];
      });

  @override
  Future<void> setStep(String applicationId, JobStep step) => backendCall(() async {
        await _client.rpc('set_job_step', params: {'p_application': applicationId, 'p_step': step.index});
      });

  @override
  Future<void> rate(String applicationId, int stars) => backendCall(() async {
        await _client.rpc('rate_job', params: {'p_application': applicationId, 'p_stars': stars});
      });
}
