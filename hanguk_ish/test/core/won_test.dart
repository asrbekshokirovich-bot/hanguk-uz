import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/money/won.dart';

void main() {
  group('Won', () {
    test('worker format groups with no-break spaces, ₩ after', () {
      expect(Won.worker(10500), '10 500 ₩');
      expect(Won.worker(52500), '52 500 ₩');
      expect(Won.worker(343500), '343 500 ₩');
      expect(Won.worker(1262500), '1 262 500 ₩');
      expect(Won.worker(0), '0 ₩');
      expect(Won.worker(999), '999 ₩');
    });

    test('employer format groups with commas, 원 after', () {
      expect(Won.employer(10500), '10,500원');
      expect(Won.employer(1262500), '1,262,500원');
      expect(Won.employer(157500), '157,500원');
      expect(Won.employerDigits(10320), '10,320');
    });

    test('negative amounts keep the sign in front', () {
      expect(Won.group(-1500, ','), '-1,500');
    });
  });

  group('Pay', () {
    test('prototype example: 5 h × 10 500 ₩ = 52 500 ₩', () {
      expect(Pay.forMinutes(10500, 5 * 60), 52500);
    });

    test('partial hours are prorated by the minute, fractions of a won dropped', () {
      expect(Pay.forMinutes(10500, 90), 15750);
      expect(Pay.forMinutes(10320, 1), 172); // 172.0 exactly
      expect(Pay.forMinutes(10001, 1), 166); // 166.68 → 166
    });

    test('nothing for no time or no rate', () {
      expect(Pay.forMinutes(10500, 0), 0);
      expect(Pay.forMinutes(10500, -30), 0);
      expect(Pay.forMinutes(0, 60), 0);
    });
  });
}
