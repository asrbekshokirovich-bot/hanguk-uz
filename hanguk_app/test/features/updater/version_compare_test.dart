import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/updater/data/version_compare.dart';

void main() {
  group('compareVersions', () {
    test('equal strings return 0', () {
      expect(compareVersions('1.0.0', '1.0.0'), 0);
      expect(compareVersions('1.0.18+2031', '1.0.18+2031'), 0);
      expect(compareVersions('', ''), 0);
    });

    test('newer major wins', () {
      expect(compareVersions('2.0.0', '1.99.99'), greaterThan(0));
      expect(compareVersions('1.0.0', '2.0.0'), lessThan(0));
    });

    test('newer minor wins when major equal', () {
      expect(compareVersions('1.2.0', '1.1.99'), greaterThan(0));
      expect(compareVersions('1.1.0', '1.2.0'), lessThan(0));
    });

    test('newer patch wins when major+minor equal', () {
      expect(compareVersions('1.0.10', '1.0.9'), greaterThan(0));
      expect(compareVersions('1.0.9', '1.0.10'), lessThan(0));
    });

    test('build number only matters when version equal', () {
      expect(compareVersions('1.0.0+5', '1.0.0+4'), greaterThan(0));
      expect(compareVersions('1.0.0+4', '1.0.0+5'), lessThan(0));
      // Newer version trumps even a higher build on the older.
      expect(compareVersions('1.0.1+1', '1.0.0+9999'), greaterThan(0));
    });

    test('missing build is treated as 0', () {
      expect(compareVersions('1.0.0', '1.0.0+0'), 0);
      expect(compareVersions('1.0.0', '1.0.0+1'), lessThan(0));
      expect(compareVersions('1.0.0+1', '1.0.0'), greaterThan(0));
    });

    test('missing minor and patch default to 0', () {
      expect(compareVersions('1', '1.0.0'), 0);
      expect(compareVersions('1.2', '1.2.0'), 0);
      expect(compareVersions('1.2', '1.1'), greaterThan(0));
    });

    test('non-numeric segments compare as 0 (defensive)', () {
      // Pre-release suffix is dropped — `1.0.0-beta` becomes 1.0.0.
      expect(compareVersions('1.0.0', '1.0.0-beta'), 0);
      expect(compareVersions('not.a.version', '0.0.0'), 0);
    });

    test('empty string compares as 0.0.0+0', () {
      expect(compareVersions('', '0'), 0);
      expect(compareVersions('', '1.0.0'), lessThan(0));
    });

    test('whitespace tolerated', () {
      expect(compareVersions(' 1.0.0 ', '1.0.0'), 0);
      expect(compareVersions('1.0.0+  5', '1.0.0+5'), 0);
    });

    test('large build numbers compare correctly (no overflow on int)', () {
      expect(
        compareVersions('1.0.0+10000000', '1.0.0+9999999'),
        greaterThan(0),
      );
    });

    test('Hanguk production sample ordering', () {
      // The current production version compared against future bumps.
      expect(compareVersions('1.0.18+2031', '1.0.18+2032'), lessThan(0));
      expect(compareVersions('1.0.18+2031', '1.0.19+1'), lessThan(0));
      expect(compareVersions('1.0.19+1', '1.0.18+2031'), greaterThan(0));
    });
  });

  group('isNewerVersion', () {
    test('returns true when candidate strictly newer', () {
      expect(
        isNewerVersion(current: '1.0.18+2031', candidate: '1.0.19+2032'),
        isTrue,
      );
      expect(isNewerVersion(current: '1.0.0', candidate: '1.0.0+1'), isTrue);
    });

    test('returns false when candidate equal or older', () {
      expect(
        isNewerVersion(current: '1.0.18+2031', candidate: '1.0.18+2031'),
        isFalse,
      );
      expect(
        isNewerVersion(current: '1.0.18+2031', candidate: '1.0.17'),
        isFalse,
      );
    });
  });

  group('isBelowFloor', () {
    test('returns true when candidate strictly below floor', () {
      expect(isBelowFloor(floor: '1.0.18+0', candidate: '1.0.17+9999'), isTrue);
      expect(isBelowFloor(floor: '2.0.0', candidate: '1.99.99+99'), isTrue);
    });

    test('returns false when candidate at or above floor', () {
      expect(isBelowFloor(floor: '1.0.18+0', candidate: '1.0.18+0'), isFalse);
      expect(isBelowFloor(floor: '1.0.18+0', candidate: '1.0.19'), isFalse);
    });

    test('practical Hanguk floor scenario', () {
      // Hanguk decides to enforce a floor of 1.0.10 — anyone below must update.
      expect(isBelowFloor(floor: '1.0.10', candidate: '1.0.9+99'), isTrue);
      expect(isBelowFloor(floor: '1.0.10', candidate: '1.0.10'), isFalse);
      expect(isBelowFloor(floor: '1.0.10', candidate: '1.0.18+2031'), isFalse);
    });
  });
}
