import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'shift_repository.dart' show ShiftActionException;

/// One pyol pack sold outside the app stores.
@immutable
class PyolPack {
  const PyolPack({required this.pyols, required this.won});

  final int pyols;
  final int won;
}

/// A top-up the worker asked for, waiting for the staff to check the money.
@immutable
class TopupRequest {
  const TopupRequest({required this.id, required this.pyols, required this.won, required this.method});

  final String id;
  final int pyols;
  final int won;

  /// 'bank', 'kakaopay' or 'toss'.
  final String method;
}

/// «Buy pyols»: the packs, where to send the money, and the waiting requests.
@immutable
class PaymentDetails {
  const PaymentDetails({required this.packs, required this.methods, required this.pending});

  final List<PyolPack> packs;

  /// 'bank' / 'kakaopay' / 'toss' / 'note' → the text the staff wrote
  /// (account number, KakaoPay link, …). Empty: not set up yet.
  final Map<String, String> methods;
  final List<TopupRequest> pending;
}

/// A bank-transfer order on the web / mini app (2026-11-26): the code the
/// worker writes as the sender's name (입금자명), and where it stands.
@immutable
class TopupOrder {
  const TopupOrder({
    required this.id,
    required this.code,
    required this.pyols,
    required this.won,
    required this.status,
    required this.createdAt,
  });

  final String id;

  /// HP4K7Q.
  final String code;
  final int pyols;
  final int won;

  /// 'unpaid' (not marked paid yet), 'pending' (the staff check), 'approved',
  /// 'rejected' or 'expired'.
  final String status;
  final DateTime createdAt;

  bool get open => status == 'unpaid' || status == 'pending';
}

/// The worker's invite code.
@immutable
class Referral {
  const Referral({required this.code, required this.invitedBy});

  final String code;

  /// A friend's code is already saved.
  final bool invitedBy;
}

/// One day the worker can work: 'day', 'night' or 'any', where, and what
/// matters most for that day's job.
@immutable
class FreeDate {
  const FreeDate({required this.day, required this.part, required this.district, this.priority = 'any'});

  /// The date (Korea), time part ignored.
  final DateTime day;
  final String part;
  final String district;

  /// 'pay' (the most money), 'easy' (lighter work), 'near' (close to home)
  /// or 'any' (2026-11-26).
  final String priority;

  String get dayText =>
      '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
}

/// Buying pyols, the invite code and «my free dates». Errors are
/// [ShiftActionException]s with the database's codes (INVALID, TOO_MANY,
/// NOT_FOUND, TOO_LATE, DISTRICT_REQUIRED, …) or an `OfflineException`.
abstract interface class PyolRepository {
  /// `payment_details`.
  Future<PaymentDetails> paymentDetails();

  /// `request_topup`: the staff add the pyols once the money came.
  Future<void> requestTopup({required int pyols, required String method, required String payerName});

  /// `start_topup`: a bank-transfer order for a pack, with its code.
  Future<TopupOrder> startTopup(int pyols);

  /// `topup_paid`: «Pul o'tkazdim» — the staff check now. EXPIRED after a day.
  Future<TopupOrder> topupPaid(String id);

  /// `my_topups`: the worker's orders, newest first.
  Future<List<TopupOrder>> myTopups();

  /// `my_referral`.
  Future<Referral?> referral();

  /// `set_referrer`: a friend's code, once.
  Future<void> setReferrer(String code);

  /// `my_free_dates`: today and later.
  Future<List<FreeDate>> freeDates();

  /// `set_free_dates`: replaces the coming free dates.
  Future<List<FreeDate>> setFreeDates(List<FreeDate> dates);
}

/// In-memory [PyolRepository] for the demo build.
class DemoPyolRepository implements PyolRepository {
  final List<TopupRequest> _pending = [];
  List<FreeDate> _dates = const [];
  bool _invited = false;

  @override
  Future<PaymentDetails> paymentDetails() async => PaymentDetails(
        packs: const [PyolPack(pyols: 30, won: 3300), PyolPack(pyols: 100, won: 9900), PyolPack(pyols: 300, won: 24000)],
        methods: const {
          'bank': 'Demo Bank 000-00-0000',
          'bank_name': '하나은행',
          'bank_account': '000-000000-00000',
          'bank_holder': '김민수',
        },
        pending: List.unmodifiable(_pending),
      );

  @override
  Future<void> requestTopup({required int pyols, required String method, required String payerName}) async {
    if (_pending.length >= 3) throw const ShiftActionException('TOO_MANY');
    final won = switch (pyols) { 30 => 3300, 100 => 9900, 300 => 24000, _ => throw const ShiftActionException('INVALID') };
    _pending.add(TopupRequest(id: 'demo-${_pending.length}', pyols: pyols, won: won, method: method));
  }

  final List<TopupOrder> _orders = [];

  @override
  Future<TopupOrder> startTopup(int pyols) async {
    if (_orders.where((o) => o.open).length >= 3) throw const ShiftActionException('TOO_MANY');
    final won = switch (pyols) { 30 => 3300, 100 => 9900, 300 => 24000, _ => throw const ShiftActionException('INVALID') };
    final order = TopupOrder(
      id: 'demo-${_orders.length}',
      code: 'HP${(2345 + _orders.length * 7).toString()}'.substring(0, 6),
      pyols: pyols,
      won: won,
      status: 'unpaid',
      createdAt: DateTime.now(),
    );
    _orders.insert(0, order);
    return order;
  }

  @override
  Future<TopupOrder> topupPaid(String id) async {
    final i = _orders.indexWhere((o) => o.id == id);
    if (i < 0) throw const ShiftActionException('NOT_FOUND');
    final o = _orders[i];
    if (o.status != 'unpaid') return o;
    return _orders[i] = TopupOrder(
        id: o.id, code: o.code, pyols: o.pyols, won: o.won, status: 'pending', createdAt: o.createdAt);
  }

  @override
  Future<List<TopupOrder>> myTopups() async => List.unmodifiable(_orders);

  @override
  Future<Referral?> referral() async => Referral(code: 'DEMO01', invitedBy: _invited);

  @override
  Future<void> setReferrer(String code) async {
    if (_invited) throw const ShiftActionException('TOO_LATE');
    _invited = true;
  }

  @override
  Future<List<FreeDate>> freeDates() async => _dates;

  @override
  Future<List<FreeDate>> setFreeDates(List<FreeDate> dates) async => _dates = List.unmodifiable(dates);
}

/// The repository the app uses. Demo data until a backend is configured.
final pyolRepositoryProvider = Provider<PyolRepository>((ref) => DemoPyolRepository());
