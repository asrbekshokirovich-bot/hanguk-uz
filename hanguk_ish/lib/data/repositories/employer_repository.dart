import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../demo/demo_employer.dart';
import '../models/business.dart';
import '../models/employer.dart';

/// Everything the employer app («Hanguk Ish 사장님») reads and changes.
/// Errors are `ShiftActionException`s with the backend's codes
/// ('SHIFT_FULL', 'NOT_PENDING', …) or an `OfflineException`.
abstract interface class EmployerRepository {
  /// The businesses the signed-in owner or manager runs.
  Future<List<Business>> businesses();

  /// BA0 «시작하기» for an owner with no business yet (P50): opens one at
  /// once, without a 사업자등록번호 or a check (`open_business`); pressing
  /// again gives the same business.
  Future<Business> openBusiness();

  /// A 사업자등록번호 checked with 국세청 (`ish-business-register`): BA1 asks
  /// again for a business still waiting. Codes: BIZ_NO_INVALID,
  /// BIZ_NO_UNKNOWN, BIZ_NO_TAKEN, BUSINESS_CLOSED.
  Future<Business> registerBusiness(String businessNumber);

  /// Shifts of [businessId] starting in [from, to), earliest first.
  Future<List<EmployerShift>> shifts(String businessId, DateTime from, DateTime to);

  Future<EmployerShift?> shift(String shiftId);

  /// BA3 확정 / 거절 → `decide_application`. When the last place fills, the
  /// other waiting applicants are turned down.
  Future<EmployerShift> decide(String applicationId, {required bool accept});

  /// BA3 출퇴근 QR → `shift_qr`: the payload printed in the code.
  Future<String> shiftQr(String shiftId);

  /// Cancels a whole shift → `cancel_shift`.
  Future<EmployerShift> cancelShift(String shiftId);

  /// BA2 템플릿 → `shift_templates`.
  Future<List<ShiftTemplate>> templates(String businessId);

  /// BA2 «수정» of a template.
  Future<ShiftTemplate> saveTemplate(String businessId, ShiftTemplate template);

  /// The legal minimum hourly wage at [at] → `minimum_wages`.
  Future<int> minimumWage(DateTime at);

  /// BA2 «근무 올리기».
  Future<EmployerShift> createShift(ShiftDraft draft);

  /// BA3 «수정» → BA2 «저장하기». Times can change only while nobody holds a
  /// place; places never drop below the confirmed workers.
  Future<EmployerShift> updateShift(String shiftId, ShiftDraft draft);

  /// BA4: everyone who has worked at [businessId], most recent first, with
  /// the favourite flag.
  Future<List<WorkerCard>> workers(String businessId);

  /// BA4 ★ → `toggle_favorite`. Returns the new state.
  Future<bool> toggleFavorite(String businessId, String workerId);

  /// BA4 «다시 요청» → `request_again`: invites a worker to a shift.
  Future<void> requestAgain(String shiftId, String workerId);

  /// BA5: completed work of [businessId] between two Korean dates
  /// (inclusive) → `business_report`.
  Future<BusinessReport> report(String businessId, DateTime from, DateTime to);

  /// BA5 지급 대기 ⇄ 지급 완료 → `set_shift_paid`.
  Future<void> setShiftPaid(String shiftId, {required bool paid});

  /// The bell on BA1, newest first.
  Future<List<EmployerNotification>> notifications();

  Future<void> markNotificationsRead();
}

/// The repository the employer app uses. Demo data until a backend is
/// configured.
final employerRepositoryProvider = Provider<EmployerRepository>((ref) => DemoEmployerRepository());
