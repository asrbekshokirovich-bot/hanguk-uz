import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/phone.dart';
import 'shift_repository.dart';

/// Phone sign-in (T1 number → T2 code) and who is signed in. Both apps use
/// it. Failures are [ShiftActionException]s — `PHONE_INVALID`,
/// `CODE_INVALID`, `TOO_MANY_REQUESTS`, `SMS_FAILED` — or an
/// [OfflineException].
abstract interface class AuthRepository {
  /// The signed-in account, or null.
  String? get userId;

  /// The account after every sign-in and sign-out.
  Stream<String?> get changes;

  /// Texts a 6-digit code to [phone] (a Korean mobile number, as typed).
  Future<void> sendCode(String phone);

  /// Signs in with the code sent to [phone].
  Future<void> verifyCode(String phone, String code);

  Future<void> signOut();

  /// Deletes the signed-in account and everything it made (Google Play's
  /// account-deletion rule): the edge function `ish-delete-account`, then a
  /// local sign-out.
  Future<void> deleteAccount();
}

/// Demo sign-in (no backend configured): no SMS is sent and any six digits
/// are accepted.
class DemoAuthRepository implements AuthRepository {
  DemoAuthRepository({String? userId}) : _user = userId;

  static const demoUser = 'demo-user';

  String? _user;
  final _changes = StreamController<String?>.broadcast();

  @override
  String? get userId => _user;

  @override
  Stream<String?> get changes => _changes.stream;

  @override
  Future<void> sendCode(String phone) async {
    if (KoreanPhone.toE164(phone) == null) throw const ShiftActionException('PHONE_INVALID');
  }

  @override
  Future<void> verifyCode(String phone, String code) async {
    if (KoreanPhone.toE164(phone) == null) throw const ShiftActionException('PHONE_INVALID');
    if (!RegExp(r'^\d{6}$').hasMatch(code.trim())) throw const ShiftActionException('CODE_INVALID');
    _user = demoUser;
    _changes.add(_user);
  }

  @override
  Future<void> signOut() async {
    _user = null;
    _changes.add(null);
  }

  @override
  Future<void> deleteAccount() => signOut();
}

/// The sign-in the apps use: the demo until a backend is configured.
final authRepositoryProvider = Provider<AuthRepository>((ref) => DemoAuthRepository());
