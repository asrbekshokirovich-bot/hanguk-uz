import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/account.dart';
import '../models/my_shift.dart';
import '../models/shift.dart';
import '../repositories/shift_repository.dart';
import 'backend.dart';
import 'json.dart';

/// [ShiftRepository] on the Hanguk Ish database (supabase/migrations): the
/// feed and shift cards come from `shift_feed` / `shift_details`, the
/// worker's applications from `my_shifts`, every change from the functions
/// that check the rules (`apply_to_shift`, `check_in`, …).
class SupabaseShiftRepository implements ShiftRepository {
  SupabaseShiftRepository(this._client, this._config);

  final SupabaseClient _client;
  final BackendConfig _config;

  /// Where the worker last looked from: details show the same distances as
  /// the feed.
  double? _lat;
  double? _lng;

  String get _me => _client.auth.currentUser?.id ?? (throw const ShiftActionException('NOT_AUTHENTICATED'));

  ShiftListing _listing(Object? json) => shiftListingFromJson(json as Json, publicUrl: _config.publicUrl);

  MyShift _myShift(Object? json) => myShiftFromJson(json as Json, publicUrl: _config.publicUrl);

  @override
  Future<List<ShiftListing>> feed(FeedQuery query) => backendCall(() async {
        _lat = query.lat;
        _lng = query.lng;
        final cards = await _client.rpc('shift_feed', params: {
          'p_from': query.from.toUtc().toIso8601String(),
          'p_to': query.to.toUtc().toIso8601String(),
          'p_lat': query.lat,
          'p_lng': query.lng,
          'p_max_km': query.radiusKm,
          'p_min_wage': query.minWage,
          'p_categories': query.categories.isEmpty ? null : [for (final c in query.categories) c.name],
        });
        final shifts = [for (final card in cards as List) _listing(card)];
        if (query.dayParts.isEmpty) return shifts;
        return [for (final s in shifts) if (query.dayParts.contains(FeedQuery.dayPartOf(s.startsAt))) s];
      });

  @override
  Future<ShiftListing?> shift(String id) => backendCall(() async {
        try {
          return _listing(await _client.rpc('shift_details', params: {'p_shift': id, 'p_lat': _lat, 'p_lng': _lng}));
        } on PostgrestException catch (e) {
          if (backendErrorCode(e.message, e.code) == 'NOT_FOUND') return null;
          rethrow;
        }
      });

  @override
  Future<ApplyResult> apply(String shiftId) => backendCall(() async {
        final row = await _client.rpc('apply_to_shift', params: {'p_shift': shiftId}) as Json;
        return ApplyResult(
          applicationId: row['id'] as String,
          status: applicationStatusFrom(row['status'] as String?) ?? ApplicationStatus.pending,
        );
      });

  @override
  Future<void> declineOffer(String shiftId) =>
      backendCall(() => _client.rpc('decline_job_offer', params: {'p_shift': shiftId}));

  @override
  Future<List<MyShift>> myShifts() => backendCall(() async {
        final cards = await _client.rpc('my_shifts');
        return [for (final card in cards as List) _myShift(card)];
      });

  @override
  Future<MyShift?> myShift(String applicationId) => backendCall(() => _myShiftOrNull(applicationId));

  Future<MyShift?> _myShiftOrNull(String applicationId) async {
    try {
      return _myShift(await _client.rpc('my_shift', params: {'p_application': applicationId}));
    } on PostgrestException catch (e) {
      if (backendErrorCode(e.message, e.code) == 'NOT_FOUND') return null;
      rethrow;
    }
  }

  /// Runs a function that returns an `applications` row, then reads the
  /// application back as the app shows it.
  Future<MyShift> _changeApplication(String function, Map<String, Object?> params) => backendCall(() async {
        final row = await _client.rpc(function, params: params) as Json;
        final updated = await _myShiftOrNull(row['id'] as String);
        if (updated == null) throw const ShiftActionException('NOT_FOUND');
        return updated;
      });

  @override
  Future<MyShift> cancelApplication(String applicationId) =>
      _changeApplication('cancel_application', {'p_application': applicationId});

  @override
  Future<MyShift> checkIn(String payload) => _changeApplication('check_in', {'p_payload': payload.trim()});

  @override
  Future<MyShift> checkOut(String payload) => _changeApplication('check_out', {'p_payload': payload.trim()});

  @override
  Future<void> rateBusiness(String applicationId, int stars, Set<RatingTag> tags) => backendCall(() async {
        if (stars < 1 || stars > 5) throw const ShiftActionException('INVALID');
        await _client.rpc('rate_business', params: {
          'p_application': applicationId,
          'p_stars': stars,
          'p_tags': [for (final t in tags) t.dbName],
        });
      });

  @override
  Future<List<ChatMessage>> messages(String applicationId) => backendCall(() async {
        final me = _me;
        final rows = await _client
            .from('messages')
            .select('id, application_id, sender_id, body, lang, translations, created_at')
            .eq('application_id', applicationId)
            .order('created_at', ascending: true)
            .order('id', ascending: true);
        final messages = [for (final row in rows) chatMessageFromJson(row, myId: me)];
        if (messages.any((m) => !m.fromMe)) {
          // Opening the chat reads what the business sent; a failure here
          // must not hide the messages.
          try {
            await _client
                .from('messages')
                .update({'read_at': DateTime.now().toUtc().toIso8601String()})
                .eq('application_id', applicationId)
                .neq('sender_id', me)
                .isFilter('read_at', null);
          } on Exception {
            // Marked next time.
          }
        }
        return messages;
      });

  @override
  Future<ChatMessage> sendMessage(String applicationId, String text) => backendCall(() async {
        final body = text.trim();
        if (body.isEmpty || body.length > 2000) throw const ShiftActionException('INVALID');
        final me = _me;
        final row = await _client
            .from('messages')
            .insert({
              'application_id': applicationId,
              'body': body,
              'lang': _hangul.hasMatch(body) ? 'ko' : null,
            })
            .select('id, application_id, sender_id, body, lang, translations, created_at')
            .single();
        return chatMessageFromJson(row, myId: me);
      });

  static final _hangul = RegExp('[가-힣]');
}
