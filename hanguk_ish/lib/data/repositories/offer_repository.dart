import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../demo/demo_offers.dart';
import '../demo/demo_account.dart';
import '../models/job_offer.dart';
import 'account_repository.dart';

/// «10 qadam»: the jobs Hanguk's staff send to the worker personally, opened
/// with puyl. Errors are `ShiftActionException`s with the database's codes
/// (OFFER_EXPIRED, SHIFT_FULL, SHIFT_CLOSED, TIME_CONFLICT, NO_COINS, …) or
/// an `OfflineException`.
abstract interface class OfferRepository {
  /// «Ishlar» → `my_offers`: the waiting ones first, then what ended lately.
  Future<List<JobOffer>> offers();

  /// «Telefon va manzilni ochish» → `unlock_offer`: the price is taken and
  /// the job is the worker's.
  Future<OpenedJob> unlock(String shiftId);

  /// «Mening ishlarim» → `my_jobs`, newest first.
  Future<List<OpenedJob>> jobs();

  /// «Qo'ng'iroq qildim», «Ishga chiqdim» → `set_job_step`.
  Future<void> setStep(String applicationId, JobStep step);

  /// «Ish beruvchini baholang» → `rate_job` (1–5).
  Future<void> rate(String applicationId, int stars);
}

/// The repository the app uses. Demo data until a backend is configured.
final offerRepositoryProvider = Provider<OfferRepository>((ref) {
  final account = ref.watch(accountRepositoryProvider);
  return DemoOfferRepository(account: account is DemoAccountRepository ? account : null);
});
