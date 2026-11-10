import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';
import 'package:hanguk_ish/features/worker/feed/feed_controller.dart';
import 'package:hanguk_ish/features/worker/map/map_screen.dart';
import 'package:hanguk_ish/features/worker/shift/shift_detail_screen.dart';
import 'package:hanguk_ish/features/worker/shift/take_shift.dart';
import 'package:hanguk_ish/l10n/gen/worker_l10n.dart';
import 'package:flutter/widgets.dart';

void main() {
  final now = prototypeNow; // Tuesday 10 Nov 2026, 11:20 KST

  group('FeedFilter.window', () {
    test('today: from now to midnight', () {
      final (from, to) = const FeedFilter().window(now);
      expect(from, now);
      expect(to, Kst.instantOf(2026, 11, 11));
    });
    test('tomorrow: the whole next day', () {
      final (from, to) = const FeedFilter(day: FeedDay.tomorrow).window(now);
      expect(from, Kst.instantOf(2026, 11, 11));
      expect(to, Kst.instantOf(2026, 11, 12));
    });
    test('weekend: Saturday 00:00 to Monday 00:00', () {
      final (from, to) = const FeedFilter(day: FeedDay.weekend).window(now);
      expect(from, Kst.instantOf(2026, 11, 14));
      expect(to, Kst.instantOf(2026, 11, 16));
    });
    test('weekend, on Sunday: from now', () {
      final sunday = Kst.instantOf(2026, 11, 15, 10);
      final (from, to) = const FeedFilter(day: FeedDay.weekend).window(sunday);
      expect(from, sunday);
      expect(to, Kst.instantOf(2026, 11, 16));
    });
  });

  group('DemoShiftRepository', () {
    late DemoShiftRepository repo;
    setUp(() => repo = DemoShiftRepository(now: now));

    FeedQuery today({double? radius = 3, int? minWage, Set<BusinessCategory> categories = const {}, Set<int> parts = const {}}) {
      final (from, to) = const FeedFilter().window(now);
      return FeedQuery(from: from, to: to, radiusKm: radius, minWage: minWage, categories: categories, dayParts: parts);
    }

    test('today within 3 km: the prototype\'s 12 shifts, nearest first', () async {
      final list = await repo.feed(today());
      expect(list, hasLength(12));
      expect(list.first.business.id, 'demo-dalbit');
      expect(list[1].business.id, 'demo-ttukbaegi');
      for (var i = 1; i < list.length; i++) {
        expect(list[i - 1].distanceKm! <= list[i].distanceKm!, isTrue);
      }
    });

    test('filters: radius, pay, category, time of day', () async {
      expect(await repo.feed(today(radius: 1)), isEmpty);
      expect((await repo.feed(today(radius: null))).length, 12);
      final rich = await repo.feed(today(minWage: 13000));
      expect(rich.map((s) => s.hourlyWage).toSet(), {13000});
      final cafes = await repo.feed(today(categories: {BusinessCategory.cafe}));
      expect(cafes.every((s) => s.business.category == BusinessCategory.cafe), isTrue);
      final evenings = await repo.feed(today(parts: {2}));
      expect(evenings.every((s) => Kst.wallClock(s.startsAt).hour >= 18), isTrue);
      expect(evenings, isNotEmpty);
    });

    test('apply: auto-confirmed takes a place; manual stays pending', () async {
      final a = await repo.apply('demo-1');
      expect(a.status, ApplicationStatus.confirmed);
      expect((await repo.shift('demo-1'))!.slotsLeft, 1);
      final b = await repo.apply('demo-2');
      expect(b.status, ApplicationStatus.pending);
      expect((await repo.shift('demo-2'))!.slotsLeft, 1);
    });

    test('apply refusals', () async {
      await repo.apply('demo-1');
      await expectLater(repo.apply('demo-1'), throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'ALREADY_APPLIED')));
      await expectLater(repo.apply('nope'), throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', 'SHIFT_CLOSED')));
      await repo.apply('demo-11'); // 1 place, auto-confirmed
      final other = DemoShiftRepository(now: now);
      await other.apply('demo-11');
      expect((await other.shift('demo-11'))!.slotsLeft, 0);
    });
  });

  test('money and pay of the sample shift', () async {
    final dalbit = (await DemoShiftRepository(now: now).shift('demo-1'))!;
    expect(dalbit.plannedMinutes, 300);
    expect(dalbit.totalPay, 52500);
    expect(dalbit.business.fullAddress('uz'), 'Mapo-gu, Sinchon-ro 12-gil, 2-qavat');
    expect(dalbit.business.displayAddress('uz'), 'Mapo-gu, Sinchon-ro 12-gil');
    expect(dalbit.business.nameWithArea('uz'), 'Dalbit Kafe · Sinchon');
  });

  group('where the shift is', () {
    const business = Business(
      id: 'b',
      name: '해운대 카페',
      category: BusinessCategory.cafe,
      address: '부산 해운대구 해운대해변로 264',
      addresses: {'uz': 'Busan, Haeundae-gu, Haeundaehaebyeon-ro 264'},
      addressDetail: '1층',
      addressDetails: {'uz': '1-qavat'},
    );
    ShiftListing at(String address, {Business b = business, Map<String, ShiftText> translations = const {}}) =>
        ShiftListing(
          id: 's',
          business: b,
          title: '홀 보조',
          address: address,
          translations: translations,
          startsAt: now,
          endsAt: now.add(const Duration(hours: 4)),
          hourlyWage: 10320,
          slots: 1,
          slotsLeft: 1,
        );

    test("no address of its own, or the business's: the business's, translated", () {
      for (final s in [at(''), at('부산 해운대구 해운대해변로 264'), at('부산 해운대구 해운대해변로 264, 1층')]) {
        expect(s.placeAddress('uz'), 'Busan, Haeundae-gu, Haeundaehaebyeon-ro 264, 1-qavat');
        expect(s.placeStreet('uz'), 'Busan, Haeundae-gu, Haeundaehaebyeon-ro 264');
      }
    });

    test('another address written in BA2: that one, translated when it is', () {
      final s = at('부산 해운대구 구남로 30');
      expect(s.placeAddress('uz'), '부산 해운대구 구남로 30', reason: 'no translation yet: the Korean original');
      expect(s.placeStreet('ru'), '부산 해운대구 구남로 30');
      final translated =
          at('부산 해운대구 구남로 30', translations: const {'uz': ShiftText(address: 'Busan, Haeundae-gu, Gunam-ro 30')});
      expect(translated.placeAddress('uz'), 'Busan, Haeundae-gu, Gunam-ro 30');
      expect(translated.placeStreet('uz'), 'Busan, Haeundae-gu, Gunam-ro 30');
    });

    test("a business registered with only its number: the shift's address is the only one", () {
      const bare = Business(id: 'n', name: '사업장 123-45-67891', category: BusinessCategory.other);
      expect(at('서울 마포구 양화로 160', b: bare).placeAddress('uz'), '서울 마포구 양화로 160');
      expect(at('', b: bare).placeAddress('uz'), '');
    });

    test('the sample shifts keep the business address with its floor', () async {
      final dalbit = (await DemoShiftRepository(now: now).shift('demo-1'))!;
      expect(dalbit.placeAddress('uz'), 'Mapo-gu, Sinchon-ro 12-gil, 2-qavat');
      expect(dalbit.placeStreet('uz'), 'Mapo-gu, Sinchon-ro 12-gil');
    });
  });

  test('rating, walking time', () {
    expect(formatRating(4.8, 'uz'), '4,8');
    expect(formatRating(4.8, 'ru'), '4,8');
    expect(formatRating(4.8, 'en'), '4.8');
    expect(formatRating(5, 'ko'), '5.0');
    expect(walkingMinutes(1.2), 15);
    expect(walkingMinutes(0.01), 1);
  });

  test('the stylised map puts the sample pins where the prototype has them', () async {
    final shifts = await DemoShiftRepository(now: now).feed(FeedQuery(
      from: now,
      to: Kst.instantOf(2026, 11, 11),
      radiusKm: 3,
    ));
    Offset at(String id) {
      final b = shifts.firstWhere((s) => s.business.id == id).business;
      return mapOffset(sinchonArea, b.lat!, b.lng!);
    }

    void near(Offset actual, Offset expected) {
      expect((actual - expected).distance, lessThan(0.6), reason: '$actual vs $expected');
    }

    near(at('demo-dalbit'), const Offset(221.9, 378));
    near(at('demo-ttukbaegi'), const Offset(75.1, 305));
    near(at('demo-sangam'), const Offset(279.1, 279));
    near(at('demo-nanum'), const Offset(87.1, 469));
    near(at('demo-haeoreum'), const Offset(273.1, 457));
    near(at('demo-yeonnam'), const Offset(175.1, 513));
  });

  test('refusal messages', () async {
    final l10n = await WorkerL10n.delegate.load(const Locale('uz'));
    expect(takeShiftError(l10n, const ShiftActionException('SHIFT_FULL')), l10n.errShiftFull);
    expect(takeShiftError(l10n, const ShiftActionException('TIME_CONFLICT')), l10n.errTimeConflict);
    expect(takeShiftError(l10n, const ShiftActionException('ALREADY_APPLIED')), l10n.errAlreadyApplied);
    expect(takeShiftError(l10n, const ShiftActionException('SHIFT_STARTED')), l10n.errShiftClosed);
    expect(takeShiftError(l10n, const ShiftActionException('PROFILE_INCOMPLETE')), l10n.errProfileIncomplete);
    expect(takeShiftError(l10n, const OfflineException()), l10n.errOffline);
    expect(takeShiftError(l10n, StateError('x')), l10n.errorGeneric);
  });
}
