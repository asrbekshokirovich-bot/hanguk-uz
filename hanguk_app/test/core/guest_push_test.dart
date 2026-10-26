import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/push/guest_push.dart';

class _MemoryStore implements GuestPushStore {
  final Map<String, bool> values = {};

  @override
  Future<bool?> read(String key) async => values[key];

  @override
  Future<void> write(String key, bool value) async => values[key] = value;
}

void main() {
  late _MemoryStore store;

  setUp(() {
    store = _MemoryStore();
    GuestPush.store = store;
  });

  test('a guest on a phone is asked, once', () async {
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: true), isTrue);
    store.values['guest_push_asked_v1'] = true;
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: true), isFalse);
  });

  test('a signed-in student or the web app is not asked', () async {
    expect(await GuestPush.shouldAsk(signedIn: true, mobile: true), isFalse);
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: false), isFalse);
  });

  test('the token goes with the install id, platform and language', () {
    expect(GuestPush.registerParams('i-1', 'android', 'tok', 'ru', '1.1.3'), {
      'p_install_id': 'i-1',
      'p_platform': 'android',
      'p_token': 'tok',
      'p_lang': 'ru',
      'p_app_version': '1.1.3',
    });
  });
}
