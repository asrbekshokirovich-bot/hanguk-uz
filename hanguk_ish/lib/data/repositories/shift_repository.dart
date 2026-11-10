import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../demo/demo_shifts.dart';
import '../models/business.dart';
import '../models/shift.dart';

/// What the feed asks for (A03 / A04 filters).
class FeedQuery {
  const FeedQuery({
    required this.from,
    required this.to,
    this.lat,
    this.lng,
    this.radiusKm,
    this.minWage,
    this.categories = const {},
    this.dayParts = const {},
  });

  final DateTime from;
  final DateTime to;
  final double? lat;
  final double? lng;
  final double? radiusKm;
  final int? minWage;
  final Set<BusinessCategory> categories;

  /// 0 = 06–12, 1 = 12–18, 2 = 18–24, 3 = 00–06 (start time, Korean clock).
  final Set<int> dayParts;
}

/// A refusal from the server, with its stable code ('SHIFT_FULL', …).
class ShiftActionException implements Exception {
  const ShiftActionException(this.code);

  final String code;

  @override
  String toString() => 'ShiftActionException($code)';
}

/// No connection to the server.
class OfflineException implements Exception {
  const OfflineException();
}

/// Result of taking a shift.
class ApplyResult {
  const ApplyResult({required this.applicationId, required this.status});

  final String applicationId;
  final ApplicationStatus status;
}

/// Shifts for the worker app.
abstract interface class ShiftRepository {
  Future<List<ShiftListing>> feed(FeedQuery query);

  Future<ShiftListing?> shift(String id);

  /// A05 «Tasdiqlash» → `apply_to_shift`.
  Future<ApplyResult> apply(String shiftId);
}

/// The repository the app uses. Demo data until a backend is configured.
final shiftRepositoryProvider = Provider<ShiftRepository>((ref) => DemoShiftRepository());
