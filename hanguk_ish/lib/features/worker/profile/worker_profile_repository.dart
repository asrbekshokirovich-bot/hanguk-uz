import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'worker_profile_draft.dart';

/// Saves the worker profile (A02 «Saqlash va boshlash»).
abstract interface class WorkerProfileRepository {
  /// Stores [draft] and marks onboarding done.
  Future<void> save(WorkerProfileDraft draft);

  /// The saved profile, or null before onboarding.
  Future<WorkerProfileDraft?> load();
}

/// Keeps the profile in memory: the app's demo mode (no backend configured)
/// and the tests.
class InMemoryWorkerProfileRepository implements WorkerProfileRepository {
  WorkerProfileDraft? _saved;

  @override
  Future<void> save(WorkerProfileDraft draft) async => _saved = draft;

  @override
  Future<WorkerProfileDraft?> load() async => _saved;
}

final workerProfileRepositoryProvider = Provider<WorkerProfileRepository>(
  (ref) => InMemoryWorkerProfileRepository(),
);
