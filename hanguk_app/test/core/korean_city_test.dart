import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/text/korean_city.dart';

void main() {
  test('a Korean city reads in Latin letters, anything else as written', () {
    expect(latinCity('정읍'), 'Jeongeup');
    expect(latinCity('서울'), 'Seoul');
    expect(latinCity('Gyeongsan (Gyeongsangbuk-do)'), 'Gyeongsan (Gyeongsangbuk-do)');
  });
}
