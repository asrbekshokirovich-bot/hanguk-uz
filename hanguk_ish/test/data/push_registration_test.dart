// P56: the phone's push token on the signed-in account — after sign-in,
// when the push service replaces it, and off the account before signing
// out. No Firebase here: a pretend push service and token store.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/data/repositories/push_service.dart';

import '../helpers/push.dart';

/// Lets the streams and futures run.
Future<void> settle() async {
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  ProviderContainer containerWith(FakePush push, FakePushTokens tokens, AuthRepository auth) {
    final container = ProviderContainer(overrides: [
      pushServiceProvider.overrideWithValue(push),
      pushTokensProvider.overrideWithValue(tokens),
      authRepositoryProvider.overrideWithValue(auth),
    ]);
    addTearDown(container.dispose);
    return container;
  }

  /// The registration, kept alive as the routers keep it.
  PushRegistration? registrationOf(ProviderContainer container) {
    container.listen(pushRegistrationProvider, (_, _) {});
    return container.read(pushRegistrationProvider);
  }

  test('signed in: permission asked, the token on the account; a new token too', () async {
    final push = FakePush(token: 't1');
    final tokens = FakePushTokens();
    final container = containerWith(push, tokens, DemoAuthRepository(userId: 'u1'));
    registrationOf(container);
    await settle();
    expect(push.asked, 1);
    expect(tokens.registered, ['t1']);
    push.refresh('t2');
    await settle();
    expect(tokens.registered, ['t1', 't2']);
  });

  test('signed out at launch: nothing until the sign-in', () async {
    final push = FakePush(token: 't1');
    final tokens = FakePushTokens();
    final auth = DemoAuthRepository();
    final container = containerWith(push, tokens, auth);
    registrationOf(container);
    await settle();
    expect(push.asked, 0);
    expect(tokens.registered, isEmpty);
    await auth.verifyCode('010-1234-5678', '123456');
    await settle();
    expect(push.asked, 1);
    expect(tokens.registered, ['t1']);
  });

  test('a build without Firebase: nothing asked, nothing registered', () async {
    final push = FakePush(token: 't1', available: false);
    final tokens = FakePushTokens();
    final container = containerWith(push, tokens, DemoAuthRepository(userId: 'u1'));
    registrationOf(container);
    await settle();
    expect(push.asked, 0);
    expect(tokens.registered, isEmpty);
  });

  test('no token yet: none registered; the one that comes later is', () async {
    final push = FakePush(token: null);
    final tokens = FakePushTokens();
    final container = containerWith(push, tokens, DemoAuthRepository(userId: 'u1'));
    registrationOf(container);
    await settle();
    expect(tokens.registered, isEmpty);
    push.refresh('t9');
    await settle();
    expect(tokens.registered, ['t9']);
  });

  test('before signing out the token comes off the account; later tokens are not registered', () async {
    final push = FakePush(token: 't1');
    final tokens = FakePushTokens();
    final container = containerWith(push, tokens, DemoAuthRepository(userId: 'u1'));
    final registration = registrationOf(container)!;
    await settle();
    push.refresh('t2');
    await settle();
    await registration.signingOut();
    expect(tokens.forgotten, ['t2'], reason: 'the token in use');
    push.refresh('t3');
    await settle();
    expect(tokens.registered, ['t1', 't2']);
  });

  test('a registration the server refuses is quiet, and sign-out then has nothing to take off', () async {
    final push = FakePush(token: 't1');
    final tokens = FakePushTokens()..failing = true;
    final container = containerWith(push, tokens, DemoAuthRepository(userId: 'u1'));
    final registration = registrationOf(container)!;
    await settle();
    expect(tokens.registered, isEmpty);
    await registration.signingOut();
    expect(tokens.forgotten, isEmpty);
  });

  test('without a backend there is no registration', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(pushRegistrationProvider), isNull);
    expect(container.read(pushServiceProvider), isA<NoPushService>());
  });
}
