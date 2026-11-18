import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/catalog/places.dart';
import 'package:hanguk_ish/features/worker/feed/feed_area.dart';

void main() {
  test('the work-area picker offers all 17 regions of Korea, then the districts of Seoul', () {
    expect(koreaRegions, hasLength(17));
    expect(workAreas.take(17).map((p) => p.code), koreaRegions.map((p) => p.code));
    expect(workAreas, hasLength(17 + seoulDistricts.length));
    expect(workAreas.map((p) => p.code).toSet(), hasLength(workAreas.length), reason: 'codes are unique');
    for (final code in ['busan', 'jeju', 'gyeonggi', 'seoul']) {
      expect(workAreas.any((p) => p.code == code), isTrue, reason: code);
    }
  });

  test('every place has a name in all four languages', () {
    for (final p in workAreas) {
      expect([p.uz, p.ru, p.en, p.ko].every((n) => n.trim().isNotEmpty), isTrue, reason: p.code);
    }
  });

  test('a region chosen on A02 names the feed area', () {
    expect(areaPlace('busan').en, 'Busan');
    expect(areaPlace('mapo').en, 'Mapo-gu, Seoul');
    expect(areaPlace(null).code, 'seoul');
  });
}
