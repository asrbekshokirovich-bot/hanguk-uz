import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../demo/demo_shifts.dart';
import '../models/account.dart';
import '../models/business.dart';
import '../models/my_shift.dart';
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

  /// A06: the worker's applications, newest shifts last.
  Future<List<MyShift>> myShifts();

  Future<MyShift?> myShift(String applicationId);

  /// A06 «Bekor qilish» → `cancel_application`.
  Future<MyShift> cancelApplication(String applicationId);

  /// A07 entry QR → `check_in`.
  Future<MyShift> checkIn(String payload);

  /// A07 exit QR → `check_out`.
  Future<MyShift> checkOut(String payload);

  /// A08 → `rate_business`.
  Future<void> rateBusiness(String applicationId, int stars, Set<RatingTag> tags);

  /// A10: the chat of one application, oldest first.
  Future<List<ChatMessage>> messages(String applicationId);

  /// A10: sends [text] to the business of the application.
  Future<ChatMessage> sendMessage(String applicationId, String text);
}

/// The repository the app uses. Demo data until a backend is configured.
final shiftRepositoryProvider = Provider<ShiftRepository>((ref) => DemoShiftRepository());
