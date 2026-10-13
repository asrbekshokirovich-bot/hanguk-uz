import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/data/map_pins.dart';

CatalogUniversity uni(String id, String? city) => CatalogUniversity(
  institutionId: id,
  guidelines: [
    CatalogGuideline(id: 'g-$id', institutionId: id, univNameEn: '$id University', city: city, degree: 'bakalavr'),
  ],
);

void main() {
  test('cityKey reads the first word of the Excel\'s city', () {
    expect(cityKey('Gyeongsan (Gyeongsangbuk-do)'), 'gyeongsan');
    expect(cityKey('Seoul / Sejong'), 'seoul');
    expect(cityKey('Incheon (Songdo)'), 'incheon');
    expect(cityKey('Seoul'), 'seoul');
  });

  test('every city the catalogue names has coordinates', () {
    const names = [
      'Seoul', 'Daejeon', 'Gwangju', 'Daegu', 'Busan', 'Gyeongsan (Gyeongsangbuk-do)', 'Pohang (Gyeongsangbuk-do)',
      'Hwaseong (Gyeonggi-do)', 'Ansan (Gyeonggi-do)', 'Seongnam', 'Incheon', 'Suwon (Gyeonggi-do)', 'Jeonju',
      'Cheongju (Chungcheongbuk-do)', 'Suncheon (Jeollanam-do)', 'Siheung', 'Yangpyeong (Gyeonggi-do)', 'Seoul / Sejong',
      'Mungyeong (Gyeongsangbuk-do)', 'Incheon (Songdo)', 'Jeju', 'Eumseong (Chungcheongbuk-do)', 'Ulsan', 'Anseong',
      'Yongin', 'Nonsan', 'Jinju (Gyeongsangnam-do)', 'Sejong', 'Gyeongsan', 'Changwon', 'Bucheon', 'Chuncheon', 'Anyang (Gyeonggi-do)',
      'Gwangju / Paju', 'Chungju (Chungcheongbuk-do)', 'Gongju (Chungcheongnam-do)', 'Gangneung (Gangwon State)', 'Yangju',
      'Asan (Chungcheongnam-do)', 'Yeonggwang (Jeollanam-do)', 'Bucheon (Gyeonggi-do)', 'Namyangju (Gyeonggi-do)',
      'Mokpo (Jeollanam-do)', 'Gimpo (Gyeonggi-do)',
    ];
    for (final n in names) {
      expect(kCityCoords.containsKey(cityKey(n)), isTrue, reason: n);
    }
  });

  group('clusterPins', () {
    final all = [
      uni('a', 'Seoul'),
      uni('b', 'Seoul'),
      uni('c', 'Suwon (Gyeonggi-do)'),
      uni('d', 'Incheon (Songdo)'),
      uni('e', 'Cheongju (Chungcheongbuk-do)'),
      uni('f', 'Daejeon'),
      uni('g', 'Gangneung (Gangwon State)'),
      uni('h', 'Gyeongsan (Gyeongsangbuk-do)'),
      uni('i', null),
      uni('j', 'Atlantis'),
    ];
    final pins = clusterPins(all);
    MapPin pin(String label) => pins.firstWhere((p) => p.label == label);

    test('a city near a hub goes under the hub\'s pin', () {
      expect(pin('Seul').universities.map((u) => u.institutionId), unorderedEquals(['a', 'b', 'c', 'd']));
      expect(pin('Daejeon').universities.map((u) => u.institutionId), unorderedEquals(['e', 'f']));
      expect(pin('Daegu').universities.single.institutionId, 'h');
    });

    test('a far city has a pin of its own, placed from its coordinates', () {
      final g = pin('Gangneung');
      expect(g.count, 1);
      expect(g.x, inInclusiveRange(60, 80));
      expect(g.y, inInclusiveRange(15, 40));
    });

    test('a hub sits where the design puts it', () {
      expect((pin('Seul').x, pin('Seul').y), (40, 16));
      expect((pin('Daejeon').x, pin('Daejeon').y), (45, 42));
    });

    test('biggest first; unknown cities have no pin', () {
      expect(pins.first.label, 'Seul');
      expect(pins.expand((p) => p.universities).map((u) => u.institutionId), isNot(containsAll(['i', 'j'])));
      expect(pins.map((p) => p.count).reduce((a, b) => a + b), 8);
    });
  });
}
