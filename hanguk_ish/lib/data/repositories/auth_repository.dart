import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Who is signed in, and signing in. Since P49 there is no SMS: «Boshlash»
/// (A01) and «시작하기» (BA0) start an account on this phone — an anonymous
/// one, without a phone number or a code. Both apps use it. Failures are
/// ShiftActionException (`TOO_MANY_REQUESTS`, `SIGN_IN_UNAVAILABLE`) or
/// OfflineException.
abstract interface class AuthRepository {
  /// The signed-in account, or null.
  String? get userId;

  /// The account after every sign-in and sign-out.
  Stream<String?> get changes;

  /// Starts an account on this phone. It stays between launches; signing out
  /// or removing the app loses it.
  Future<void> signIn();

  Future<void> signOut();
}

/// Demo sign-in (no backend configured): the demo account at once.
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
  Future<void> signIn() async {
    _user = demoUser;
    _changes.add(_user);
  }

  @override
  Future<void> signOut() async {
    _user = null;
    _changes.add(null);
  }
}

/// The sign-in the apps use: the demo until a backend is configured.
final authRepositoryProvider = Provider<AuthRepository>((ref) => DemoAuthRepository());
