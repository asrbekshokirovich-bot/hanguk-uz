import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/pyol_repository.dart';
import 'backend.dart';

/// [PyolRepository] on the functions of `…_ish_pyol_plan.sql` and
/// `…_ish_free_dates.sql`.
class SupabasePyolRepository implements PyolRepository {
  SupabasePyolRepository(this._client);

  final SupabaseClient _client;

  static int _int(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

  @override
  Future<PaymentDetails> paymentDetails() => backendCall(() async {
        final json = (await _client.rpc('payment_details') as Map).cast<String, dynamic>();
        final packs = [
          for (final p in (json['packs'] as List? ?? const []))
            if (p is Map) PyolPack(pyols: _int(p['pyols']), won: _int(p['won'])),
        ];
        final methods = <String, String>{
          for (final e in ((json['methods'] as Map?) ?? const {}).entries)
            if ('${e.value}'.trim().isNotEmpty) '${e.key}': '${e.value}',
        };
        final pending = [
          for (final r in (json['pending'] as List? ?? const []))
            if (r is Map)
              TopupRequest(
                id: '${r['id']}',
                pyols: _int(r['pyols']),
                won: _int(r['amount_won']),
                method: '${r['method']}',
              ),
        ];
        return PaymentDetails(packs: packs, methods: methods, pending: pending);
      });

  @override
  Future<void> requestTopup({required int pyols, required String method, required String payerName}) =>
      backendCall(() async {
        await _client.rpc('request_topup', params: {'p_pyols': pyols, 'p_method': method, 'p_payer_name': payerName});
      });

  @override
  Future<Referral?> referral() => backendCall(() async {
        final json = await _client.rpc('my_referral');
        if (json is! Map) return null;
        return Referral(code: '${json['code'] ?? ''}', invitedBy: json['invited_by'] == true);
      });

  @override
  Future<void> setReferrer(String code) => backendCall(() async {
        await _client.rpc('set_referrer', params: {'p_code': code.trim()});
      });

  static List<FreeDate> _dates(Object? rows) => [
        for (final r in (rows as List? ?? const []))
          if (r is Map && DateTime.tryParse('${r['day']}') != null)
            FreeDate(
              day: DateTime.parse('${r['day']}'),
              part: '${r['part']}',
              district: '${r['district']}',
              priority: '${r['priority'] ?? 'any'}',
            ),
      ];

  @override
  Future<List<FreeDate>> freeDates() => backendCall(() async => _dates(await _client.rpc('my_free_dates')));

  @override
  Future<List<FreeDate>> setFreeDates(List<FreeDate> dates) => backendCall(() async {
        final rows = await _client.rpc('set_free_dates', params: {
          'p_days': [
            for (final d in dates) {'day': d.dayText, 'part': d.part, 'district': d.district, 'priority': d.priority},
          ],
        });
        return _dates(rows);
      });
}
