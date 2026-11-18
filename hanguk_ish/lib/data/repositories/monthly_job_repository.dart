import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../demo/demo_monthly_jobs.dart';
import '../models/monthly_job.dart';

/// Monthly jobs for the worker app. Errors are `ShiftActionException`s with
/// the backend's codes or an `OfflineException`.
abstract interface class MonthlyJobRepository {
  /// The open jobs, newest first, each with the worker's own «applied» flag.
  Future<List<MonthlyJob>> list();

  /// «Qiziqaman»: the staff will call both sides.
  Future<void> apply(String jobId);

  /// Takes the interest back.
  Future<void> withdraw(String jobId);
}

/// The repository the app uses. Demo data until a backend is configured.
final monthlyJobRepositoryProvider = Provider<MonthlyJobRepository>((ref) => DemoMonthlyJobRepository());
