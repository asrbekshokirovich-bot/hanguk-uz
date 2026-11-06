import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/uni_db/data/push_token_bootstrap.dart';
import 'package:hanguk_app/features/uni_db/data/push_token_registrar.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _Registrar implements PushTokenRegistrar {
  final tokens = <String>[];

  @override
  Future<void> register({
    required String token,
    String? platformOverride,
    String? appVersion,
    String? deviceLabel,
    String preferredLang = 'en',
  }) async => tokens.add(token);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Session _session({bool guest = false}) => Session.fromJson({
  'access_token': 'token',
  'token_type': 'bearer',
  'user': {
    'id': guest ? 'guest-user' : 'student-user',
    'aud': 'authenticated',
    'app_metadata': guest ? {'guest': true} : <String, dynamic>{},
    'user_metadata': <String, dynamic>{},
    'created_at': '2026-11-05T00:00:00Z',
  },
})!;

Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  test('a student session registers the token', () async {
    final registrar = _Registrar();
    final b = PushTokenBootstrap(registrar, currentSession: () => _session());
    var asked = 0;
    b.setTokenSource(() async {
      asked++;
      return const PlatformTokenInfo(token: 't1', platform: 'android');
    });
    await _settle();
    expect(asked, 1);
    expect(registrar.tokens, ['t1']);
  });

  test("a guest's test session does not open the push flow", () async {
    final registrar = _Registrar();
    final b = PushTokenBootstrap(registrar, currentSession: () => _session(guest: true));
    var asked = 0;
    b.setTokenSource(() async {
      asked++;
      return const PlatformTokenInfo(token: 't1', platform: 'android');
    });
    final events = StreamController<AuthState>();
    b.start(events.stream);
    events.add(AuthState(AuthChangeEvent.signedIn, _session(guest: true)));
    await _settle();
    expect(asked, 0, reason: 'no permission prompt, no token for a guest test account');
    expect(registrar.tokens, isEmpty);
    await b.dispose();
    await events.close();
  });

  test('a failing token source and a failing auth stream are caught', () async {
    final registrar = _Registrar();
    final b = PushTokenBootstrap(registrar, currentSession: () => _session());
    final uncaught = <Object>[];
    await runZonedGuarded(() async {
      b.setTokenSource(() async => throw StateError('FirebaseException stand-in'));
      final events = StreamController<AuthState>();
      b.start(events.stream);
      events.addError(StateError('AuthRetryableFetchException stand-in'));
      await _settle();
      await _settle();
      await b.dispose();
      await events.close();
    }, (e, _) => uncaught.add(e));
    expect(uncaught, isEmpty);
    expect(registrar.tokens, isEmpty);
  });

  test('nobody signed in: nothing happens', () async {
    final registrar = _Registrar();
    final b = PushTokenBootstrap(registrar, currentSession: () => null);
    var asked = 0;
    b.setTokenSource(() async {
      asked++;
      return const PlatformTokenInfo(token: 't1', platform: 'android');
    });
    await _settle();
    expect(asked, 0);
  });
}
