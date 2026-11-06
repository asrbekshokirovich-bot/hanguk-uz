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

  test('the first ♥ asks once more, on its own flag (two asks at most)', () async {
    store.values['guest_push_asked_v1'] = true;
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: true, reason: GuestPushReason.heart), isTrue);
    store.values['guest_push_asked_heart_v1'] = true;
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: true, reason: GuestPushReason.heart), isFalse);
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: true), isFalse);
  });

  test('an allowed phone is not asked again for any reason', () async {
    store.values['guest_push_allowed_v1'] = true;
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: true), isFalse);
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: true, reason: GuestPushReason.heart), isFalse);
  });

  test('a signed-in student or the web app is not asked', () async {
    expect(await GuestPush.shouldAsk(signedIn: true, mobile: true, reason: GuestPushReason.heart), isFalse);
    expect(await GuestPush.shouldAsk(signedIn: true, mobile: true), isFalse);
    expect(await GuestPush.shouldAsk(signedIn: false, mobile: false), isFalse);
  });

  test('only a guest iPhone, not yet allowed, starts quietly, once', () {
    expect(GuestPush.wantsQuiet(ios: true, signedIn: false, allowed: false, done: false), isTrue);
    expect(GuestPush.wantsQuiet(ios: false, signedIn: false, allowed: false, done: false), isFalse);
    expect(GuestPush.wantsQuiet(ios: true, signedIn: true, allowed: false, done: false), isFalse);
    expect(GuestPush.wantsQuiet(ios: true, signedIn: false, allowed: true, done: false), isFalse);
    expect(GuestPush.wantsQuiet(ios: true, signedIn: false, allowed: false, done: true), isFalse);
  });

  test('the reminders switch shows only for a guest phone that takes pushes', () async {
    expect(await GuestPush.remindersVisible(), isFalse); // not a phone in tests
    expect(await GuestPush.remindersOn(), isTrue);
    store.values['guest_reminders_off_v1'] = true;
    expect(await GuestPush.remindersOn(), isFalse);
    expect(GuestPush.remindersParams('i-1', 'tok', false), {'p_install_id': 'i-1', 'p_token': 'tok', 'p_enabled': false});
  });

  test('the Telegram link carries the phone code', () {
    expect(GuestPush.subLink('HangukBot', 'ABCDEFGH23').toString(), 'https://t.me/HangukBot?start=D_ABCDEFGH23');
    expect(GuestPush.subLink(null, 'ABCDEFGH23'), isNull);
    expect(GuestPush.subLink('HangukBot', 'bad'), isNull);
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
