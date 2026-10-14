import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/client_code_qr.dart';

void main() {
  test('a QR holding the code itself', () {
    expect(clientCodeFromQr('HG7K2M9P'), 'HG7K2M9P');
    expect(clientCodeFromQr(' hg7k-2m9p '), 'HG7K2M9P');
  });

  test('a link carrying the code', () {
    expect(clientCodeFromQr('https://hanguk.uz/app?code=hg7k2m9p'), 'HG7K2M9P');
    expect(clientCodeFromQr('https://hanguk.uz/login?magic_code=HG7K2M9P&x=1'), 'HG7K2M9P');
    expect(clientCodeFromQr('https://hanguk.uz/c/HG7K2M9P'), 'HG7K2M9P');
  });

  test('anything else holds no code', () {
    expect(clientCodeFromQr(null), isNull);
    expect(clientCodeFromQr(''), isNull);
    expect(clientCodeFromQr('HG7K'), isNull);
    expect(clientCodeFromQr('https://hanguk.uz/about'), isNull);
    expect(clientCodeFromQr('WIFI:S:home;T:WPA;P:secret;;'), isNull);
  });
}
