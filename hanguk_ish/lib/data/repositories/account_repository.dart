import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../demo/demo_account.dart';
import '../models/account.dart';

/// The signed-in worker's own data besides shifts: track record,
/// notifications, reports.
abstract interface class WorkerAccountRepository {
  /// A11 → `worker_stats`.
  Future<WorkerStats> stats();

  /// A12, newest first.
  Future<List<HiNotification>> notifications();

  Future<void> markNotificationsRead();

  /// A11 «Shikoyat qilish» → `reports`.
  Future<void> report(ReportSubject subject, String text);
}

/// The repository the app uses. Demo data until a backend is configured.
final accountRepositoryProvider = Provider<WorkerAccountRepository>((ref) => DemoAccountRepository());
