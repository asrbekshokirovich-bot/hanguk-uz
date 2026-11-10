import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/business.dart';
import '../models/employer.dart';
import '../repositories/employer_repository.dart';
import '../repositories/shift_repository.dart';
import 'backend.dart';
import 'json.dart';

/// [EmployerRepository] on the Hanguk Ish database: the board and one shift
/// from `business_board` / `employer_shift`, decisions and payments through
/// the functions that check the rules, shifts and templates written to their
/// tables (the `shifts_guard` and minimum-wage triggers refuse what breaks a
/// rule).
class SupabaseEmployerRepository implements EmployerRepository {
  SupabaseEmployerRepository(this._client, this._config);

  final SupabaseClient _client;
  final BackendConfig _config;

  Future<EmployerShift> _readShift(String shiftId) async {
    final json = await _client.rpc('employer_shift', params: {'p_shift': shiftId});
    return employerShiftFromJson(json as Json);
  }

  @override
  Future<List<Business>> businesses() => backendCall(() async {
        final cards = await _client.rpc('my_businesses') as List;
        return [for (final card in cards) businessFromJson(card as Json, publicUrl: _config.publicUrl)];
      });

  @override
  Future<List<EmployerShift>> shifts(String businessId, DateTime from, DateTime to) => backendCall(() async {
        final boards = await _client.rpc('business_board', params: {
          'p_business': businessId,
          'p_from': from.toUtc().toIso8601String(),
          'p_to': to.toUtc().toIso8601String(),
        }) as List;
        return [for (final board in boards) employerShiftFromJson(board as Json)];
      });

  @override
  Future<EmployerShift?> shift(String shiftId) => backendCall(() async {
        try {
          return await _readShift(shiftId);
        } on PostgrestException catch (e) {
          if (backendErrorCode(e.message, e.code) == 'NOT_FOUND') return null;
          rethrow;
        }
      });

  @override
  Future<EmployerShift> decide(String applicationId, {required bool accept}) => backendCall(() async {
        final row = await _client.rpc('decide_application',
            params: {'p_application': applicationId, 'p_accept': accept}) as Json;
        return _readShift(row['shift_id'] as String);
      });

  @override
  Future<String> shiftQr(String shiftId) => backendCall(() async {
        return await _client.rpc('shift_qr', params: {'p_shift': shiftId}) as String;
      });

  @override
  Future<EmployerShift> cancelShift(String shiftId) => backendCall(() async {
        await _client.rpc('cancel_shift', params: {'p_shift': shiftId});
        return _readShift(shiftId);
      });

  @override
  Future<List<ShiftTemplate>> templates(String businessId) => backendCall(() async {
        final rows = await _client
            .from('shift_templates')
            .select()
            .eq('business_id', businessId)
            .order('created_at', ascending: true)
            .order('id', ascending: true);
        return [for (final row in rows) shiftTemplateFromJson(row)];
      });

  @override
  Future<ShiftTemplate> saveTemplate(String businessId, ShiftTemplate template) => backendCall(() async {
        final row = await _client
            .from('shift_templates')
            .upsert(shiftTemplateToJson(businessId, template))
            .select()
            .single();
        return shiftTemplateFromJson(row);
      });

  @override
  Future<int> minimumWage(DateTime at) => backendCall(() async {
        final wage = await _client.rpc('minimum_wage', params: {'p_at': at.toUtc().toIso8601String()});
        return wage is num ? wage.toInt() : 0;
      });

  /// The checks the database also makes, answered without a round trip.
  void _checkDraft(ShiftDraft draft) {
    if (draft.title.trim().isEmpty || draft.slots < 1 || draft.hourlyWage <= 0) {
      throw const ShiftActionException('INVALID');
    }
    if (!draft.endsAt.isAfter(draft.startsAt)) throw const ShiftActionException('INVALID_TIME');
    if (draft.endsAt.difference(draft.startsAt) > const Duration(hours: 16)) {
      throw const ShiftActionException('TOO_LONG');
    }
  }

  @override
  Future<EmployerShift> createShift(ShiftDraft draft) => backendCall(() async {
        _checkDraft(draft);
        final row = await _client.from('shifts').insert(shiftDraftToJson(draft)).select('id').single();
        return _readShift(row['id'] as String);
      });

  @override
  Future<EmployerShift> updateShift(String shiftId, ShiftDraft draft) => backendCall(() async {
        _checkDraft(draft);
        final rows = await _client
            .from('shifts')
            .update(shiftDraftToJson(draft, includeBusiness: false))
            .eq('id', shiftId)
            .select('id');
        if (rows.isEmpty) throw const ShiftActionException('NOT_FOUND');
        return _readShift(shiftId);
      });

  @override
  Future<List<WorkerCard>> workers(String businessId) => backendCall(() async {
        final cards = await _client.rpc('business_workers', params: {'p_business': businessId}) as List;
        return [for (final card in cards) workerCardFromJson(card as Json)];
      });

  @override
  Future<bool> toggleFavorite(String businessId, String workerId) => backendCall(() async {
        return await _client.rpc('toggle_favorite', params: {'p_business': businessId, 'p_worker': workerId}) as bool;
      });

  @override
  Future<void> requestAgain(String shiftId, String workerId) => backendCall(() async {
        await _client.rpc('request_again', params: {'p_shift': shiftId, 'p_worker': workerId});
      });

  @override
  Future<BusinessReport> report(String businessId, DateTime from, DateTime to) => backendCall(() async {
        final rows = await _client.rpc('business_report', params: {
          'p_business': businessId,
          'p_from': _koreanDate(from),
          // The function's end is exclusive; the report's last day is not.
          'p_to': _koreanDate(DateTime.utc(to.year, to.month, to.day + 1)),
        }) as List;
        return BusinessReport(from: from, to: to, rows: [for (final row in rows) reportRowFromJson(row as Json)]);
      });

  @override
  Future<void> setShiftPaid(String shiftId, {required bool paid}) => backendCall(() async {
        await _client.rpc('set_shift_paid', params: {'p_shift': shiftId, 'p_paid': paid});
      });

  @override
  Future<List<EmployerNotification>> notifications() => backendCall(() async {
        final cards = await _client.rpc('my_notifications',
            params: {'p_limit': 100, 'p_kinds': employerNotificationKinds}) as List;
        return [
          for (final card in cards)
            if (employerNotificationFromJson(card as Json) case final notification?) notification,
        ];
      });

  @override
  Future<void> markNotificationsRead() => backendCall(() async {
        await _client.rpc('mark_notifications_read', params: {'p_kinds': employerNotificationKinds});
      });
}

/// `2026-11-10`. Report periods are Korean calendar dates held in the fields
/// of a UTC [DateTime] (`reportRange`), not instants.
String _koreanDate(DateTime day) =>
    '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
