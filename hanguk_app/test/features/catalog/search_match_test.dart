import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';

void main() {
  test('a city typed the Uzbek or Russian way finds it', () {
    expect(catalogTextMatches('Yonsei University Seoul 서울', 'seul'), isTrue);
    expect(catalogTextMatches('Yonsei University Seoul 서울', 'Сеул'), isTrue);
    expect(catalogTextMatches('Pusan National University Busan', 'Пусан'), isTrue);
    expect(catalogTextMatches('Keimyung University Daegu', 'tegu'), isTrue);
  });

  test('case, spaces and apostrophes do not matter', () {
    expect(catalogTextMatches('Woosong University', 'woo song'), isTrue);
    expect(catalogTextMatches("Hankuk University", 'HANKUK'), isTrue);
    expect(catalogTextMatches('서울대학교', '서울'), isTrue);
  });

  test('no false hit', () {
    expect(catalogTextMatches('Keimyung University Daegu', 'seul'), isFalse);
    expect(catalogTextMatches('Keimyung University Daegu', 'xyz'), isFalse);
  });
}
