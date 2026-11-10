import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/updater/data/play_in_app_update.dart';

class _FakeApi implements PlayUpdateApi {
  _FakeApi(this.info, {this.throwOnCheck = false, this.flexibleOk = true});

  PlayUpdateInfo info;
  bool throwOnCheck;
  bool flexibleOk;
  final calls = <String>[];

  @override
  Future<PlayUpdateInfo> check() async {
    calls.add('check');
    if (throwOnCheck) throw Exception('ERROR_API_NOT_AVAILABLE');
    return info;
  }

  @override
  Future<bool> performImmediate() async {
    calls.add('immediate');
    return true;
  }

  @override
  Future<bool> startFlexible() async {
    calls.add('flexible');
    return flexibleOk;
  }

  @override
  Future<void> completeFlexible() async {
    calls.add('complete');
  }
}

const _none = PlayUpdateInfo(
  updateAvailable: false,
  immediateAllowed: false,
  flexibleAllowed: false,
);

void main() {
  var clock = DateTime(2026, 11, 10, 9);
  DateTime now() => clock;

  setUp(() => clock = DateTime(2026, 11, 10, 9));

  PlayInAppUpdate make(_FakeApi api, {bool eligible = true}) =>
      PlayInAppUpdate(api: api, eligible: eligible, now: now);

  test('not an Android store build → Play is never called', () async {
    final api = _FakeApi(
      const PlayUpdateInfo(
        updateAvailable: true,
        immediateAllowed: true,
        flexibleAllowed: true,
        priority: 5,
      ),
    );
    final u = make(api, eligible: false);
    await u.onForeground();
    await u.onForeground();
    expect(api.calls, isEmpty);
  });

  test('available + immediate allowed + stale → immediate', () async {
    final api = _FakeApi(
      const PlayUpdateInfo(
        updateAvailable: true,
        immediateAllowed: true,
        flexibleAllowed: true,
        stalenessDays: 2,
      ),
    );
    await make(api).onForeground();
    expect(api.calls, ['check', 'immediate']);
  });

  test('available + immediate allowed + high priority → immediate', () async {
    final api = _FakeApi(
      const PlayUpdateInfo(
        updateAvailable: true,
        immediateAllowed: true,
        flexibleAllowed: false,
        stalenessDays: 0,
        priority: 4,
      ),
    );
    await make(api).onForeground();
    expect(api.calls, ['check', 'immediate']);
  });

  test('fresh low-priority update → flexible, installed on next foreground',
      () async {
    final api = _FakeApi(
      const PlayUpdateInfo(
        updateAvailable: true,
        immediateAllowed: true,
        flexibleAllowed: true,
        stalenessDays: 1,
        priority: 1,
      ),
    );
    final u = make(api);
    await u.onForeground();
    expect(api.calls, ['check', 'flexible']);

    clock = clock.add(const Duration(minutes: 5));
    await u.onForeground();
    expect(api.calls, ['check', 'flexible', 'complete']);
  });

  test('available + only flexible allowed → flexible + complete', () async {
    final api = _FakeApi(
      const PlayUpdateInfo(
        updateAvailable: true,
        immediateAllowed: false,
        flexibleAllowed: true,
        stalenessDays: 30,
        priority: 5,
      ),
    );
    final u = make(api);
    await u.onForeground();
    await u.onForeground();
    expect(api.calls, ['check', 'flexible', 'complete']);
  });

  test('flexible download not finished → nothing to complete', () async {
    final api = _FakeApi(
      const PlayUpdateInfo(
        updateAvailable: true,
        immediateAllowed: false,
        flexibleAllowed: true,
      ),
      flexibleOk: false,
    );
    final u = make(api);
    await u.onForeground();
    await u.onForeground();
    expect(api.calls, ['check', 'flexible']);
  });

  test('downloaded in an earlier session → completed on launch', () async {
    final api = _FakeApi(
      const PlayUpdateInfo(
        updateAvailable: false,
        immediateAllowed: false,
        flexibleAllowed: false,
        downloaded: true,
      ),
    );
    await make(api).onForeground();
    expect(api.calls, ['check', 'complete']);
  });

  test('no update → nothing after the check', () async {
    final api = _FakeApi(_none);
    await make(api).onForeground();
    expect(api.calls, ['check']);
  });

  test('checks once per launch, then again only after 6 hours', () async {
    final api = _FakeApi(_none);
    final u = make(api);
    await u.onForeground();
    clock = clock.add(const Duration(hours: 5, minutes: 59));
    await u.onForeground();
    expect(api.calls, ['check']);
    clock = clock.add(const Duration(minutes: 1));
    await u.onForeground();
    expect(api.calls, ['check', 'check']);
  });

  test('Play errors are swallowed', () async {
    final api = _FakeApi(_none, throwOnCheck: true);
    final u = make(api);
    await expectLater(u.onForeground(), completes);
    expect(api.calls, ['check']);
  });
}
