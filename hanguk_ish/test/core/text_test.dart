import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/format/text.dart';

void main() {
  test('a slash before a word or number is kept with it, as Chrome does', () {
    expect(keepSlashTogether('12 000 ₩/soat'), '12 000 ₩/⁠soat');
    expect(keepSlashTogether('10 500–11 500 ₩/час'), '10 500–11 500 ₩/⁠час');
    expect(keepSlashTogether('12,000원/시간'), '12,000원/⁠시간');
    expect(keepSlashTogether('1/3'), '1/⁠3');
  });

  test('other slashes and texts stay as they are', () {
    expect(keepSlashTogether('Profil · 1 / 3'), 'Profil · 1 / 3');
    expect(keepSlashTogether('a/ b'), 'a/ b');
    expect(keepSlashTogether('Smenalar'), 'Smenalar');
    expect(keepSlashTogether(''), '');
  });

  test('dotJoin leaves out the parts that have no text', () {
    expect(dotJoin(['Sinchon', '1,2 km']), 'Sinchon · 1,2 km');
    expect(dotJoin(['', '1,2 km']), '1,2 km', reason: 'no area yet: not «· 1,2 km»');
    expect(dotJoin([' ', '1,2 km']), '1,2 km');
    expect(dotJoin(['Sinchon']), 'Sinchon');
    expect(dotJoin(['', '']), '');
    expect(dotJoin(const []), '');
  });
}
