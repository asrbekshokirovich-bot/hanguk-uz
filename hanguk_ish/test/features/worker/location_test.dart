import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/backend/supabase_account_repository.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/account_repository.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';
import 'package:hanguk_ish/features/worker/feed/feed_controller.dart';

/// A phone that answers with [position] (null: refused or no fix).
class FixedPosition implements PositionSource {
  FixedPosition(this.position);

  final (double, double)? position;
  int asked = 0;

  @override
  Future<(double, double)?> current() async {
    asked++;
    return position;
  }
}

/// Remembers what the feed asked for.
class RecordingShifts extends DemoShiftRepository {
  RecordingShifts() : super(now: prototypeNow);

  final queries = <FeedQuery>[];

  @override
  Future<List<ShiftListing>> feed(FeedQuery query) {
    queries.add(query);
    return super.feed(query);
  }
}

void main() {
  test('a position, named after the A02 district', () async {
    final service = DeviceLocationService(district: () => 'mapo', positions: FixedPosition((37.556, 126.937)));
    final area = await service.current();
    expect(area.located, isTrue);
    expect(area.lat, 37.556);
    expect(area.place.name('uz'), 'Mapo-gu, Seul');
    expect(area.place.name('ko'), '서울 마포구');
  });

  test('no position (refused, off, no fix): the district only, no distances', () async {
    final area = await DeviceLocationService(district: () => 'gangnam', positions: FixedPosition(null)).current();
    expect(area.located, isFalse);
    expect(area.lat, isNull);
    expect(area.place.name('en'), 'Gangnam-gu, Seoul');
  });

  test('a typed district, or none', () {
    expect(areaPlace('Suwon').name('ru'), 'Suwon');
    expect(areaPlace(null).name('uz'), 'Seul');
    expect(areaPlace('  ').name('ko'), '서울');
  });

  test('the feed asks without a position when there is none', () async {
    final shifts = RecordingShifts();
    final container = ProviderContainer(overrides: [
      locationServiceProvider.overrideWithValue(DeviceLocationService(district: () => null, positions: FixedPosition(null))),
      shiftRepositoryProvider.overrideWithValue(shifts),
    ]);
    addTearDown(container.dispose);
    final subscription = container.listen(feedProvider, (_, _) {});
    addTearDown(subscription.close);
    await container.read(feedProvider.future);
    expect(shifts.queries.single.lat, isNull);
    expect(shifts.queries.single.lng, isNull);
    expect((await container.read(feedAreaProvider.future)).place.name('uz'), 'Seul');
  });

  test('a known position is kept on the server; a failure there does not stop the feed', () async {
    final account = DemoAccountRepository();
    final container = ProviderContainer(overrides: [
      locationServiceProvider.overrideWithValue(
        DeviceLocationService(district: () => 'mapo', positions: FixedPosition((37.55612, 126.93678))),
      ),
      accountRepositoryProvider.overrideWithValue(account),
    ]);
    addTearDown(container.dispose);
    await container.read(feedAreaProvider.future);
    await pumpEventQueue();
    expect(account.positions, [(37.55612, 126.93678)]);

    final failing = ProviderContainer(overrides: [
      locationServiceProvider.overrideWithValue(
        DeviceLocationService(district: () => 'mapo', positions: FixedPosition((37.5, 126.9))),
      ),
      accountRepositoryProvider.overrideWithValue(_FailingAccount()),
    ]);
    addTearDown(failing.dispose);
    expect((await failing.read(feedAreaProvider.future)).located, isTrue);
  });

  test('positions are kept to about 100 m', () {
    expect(roundPosition(37.55612), 37.556);
    expect(roundPosition(126.93678), 126.937);
    expect(roundPosition(-0.0004), -0.0);
  });
}

class _FailingAccount extends DemoAccountRepository {
  @override
  Future<void> savePosition(double lat, double lng) async => throw const OfflineException();
}
