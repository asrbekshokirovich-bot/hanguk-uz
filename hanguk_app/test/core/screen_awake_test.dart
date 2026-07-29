import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/core/platform/screen_awake.dart';

/// The screen must stay on for the whole interview — and must not stay on a
/// moment longer.
///
/// The first half is the feature: a student talks for minutes without touching
/// the phone, so the idle timer would lock the screen mid-interview and take
/// the End control with it.
///
/// The second half is the part that bites. A hold that leaks outlives the
/// interview and burns the battery with the screen pinned on, and nothing in
/// the UI would show it. These tests pin both directions.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.hanguk.studentapp/screen_awake');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  late List<MethodCall> calls;

  /// Installs a handler that records calls and optionally throws.
  void mockPlatform({Object? throws}) {
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (throws != null) throw throws;
      return null;
    });
  }

  setUp(() {
    calls = <MethodCall>[];
    ScreenAwake.resetForTest();
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(channel, null);
    ScreenAwake.resetForTest();
  });

  test('enable asks the platform to hold the screen on', () async {
    mockPlatform();

    await ScreenAwake.enable();

    expect(calls, hasLength(1));
    expect(calls.single.method, 'setKeepScreenOn');
    expect(calls.single.arguments, {'enable': true});
    expect(ScreenAwake.isEnabled, isTrue);
  });

  test('disable hands the screen back to the idle timer', () async {
    mockPlatform();

    await ScreenAwake.enable();
    await ScreenAwake.disable();

    expect(calls.map((c) => c.arguments), [
      {'enable': true},
      {'enable': false},
    ]);
    expect(ScreenAwake.isEnabled, isFalse);
  });

  test('a repeated request does not cross the channel again', () async {
    mockPlatform();

    await ScreenAwake.enable();
    await ScreenAwake.enable();
    await ScreenAwake.enable();

    expect(calls, hasLength(1));
  });

  test('disable is a no-op when nothing is held', () async {
    mockPlatform();

    await ScreenAwake.disable();

    expect(calls, isEmpty);
  });

  group('the hold can always be released', () {
    test('a PlatformException on enable still leaves disable able to run', () async {
      // The failure mode that would strand a lit screen: if enable() recorded
      // no state because the platform threw, a later disable() could be
      // dismissed as "nothing to release" — while the OS had in fact applied
      // the flag before failing on something else.
      mockPlatform(throws: PlatformException(code: 'boom'));
      await ScreenAwake.enable();

      calls.clear();
      mockPlatform();
      await ScreenAwake.disable();

      expect(
        calls.map((c) => c.arguments),
        [
          {'enable': false},
        ],
        reason: 'disable must still reach the platform after a failed enable',
      );
      expect(ScreenAwake.isEnabled, isFalse);
    });

    test('enable does not throw when the platform reports an error', () async {
      mockPlatform(throws: PlatformException(code: 'boom'));

      // An interview must start even if the screen hold cannot be applied.
      await expectLater(ScreenAwake.enable(), completes);
    });
  });

  group('platforms without an implementation', () {
    test('enable is silently ignored on web/desktop', () async {
      // No mock handler installed at all -> MissingPluginException.
      messenger.setMockMethodCallHandler(channel, null);

      await expectLater(ScreenAwake.enable(), completes);
      await expectLater(ScreenAwake.disable(), completes);
    });
  });
}
