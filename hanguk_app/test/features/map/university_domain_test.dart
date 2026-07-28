import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/map/domain/university.dart';

// Audit P0 sanity tests for the post-Phase-3R-B domain shape.
// Covers M2 (domain remodel) + M3 (tier filter).
void main() {
  group('University domain', () {
    test('isTopTier is true for tier 0 (flagship)', () {
      const u = University(
        id: 'i1',
        name: 'Seoul National',
        location: 'Seoul',
        tier: 0,
      );
      expect(u.isTopTier, isTrue);
    });

    test('isTopTier is true for tier 1 (top-ranked)', () {
      const u = University(
        id: 'i2',
        name: 'Yonsei',
        location: 'Seoul',
        tier: 1,
      );
      expect(u.isTopTier, isTrue);
    });

    test('isTopTier is false for tier 2', () {
      const u = University(
        id: 'i3',
        name: 'Mid-tier U.',
        location: 'Busan',
        tier: 2,
      );
      expect(u.isTopTier, isFalse);
    });

    test('isTopTier is false when tier is null', () {
      const u = University(id: 'i4', name: 'Unclassified', location: 'Daejeon');
      expect(u.isTopTier, isFalse);
    });

    test('isAccredited maps ieqas_status to a yes/no signal', () {
      const outstanding = University(
        id: 'a1',
        name: 'A',
        location: 'B',
        ieqasStatus: 'outstanding',
      );
      const accredited = University(
        id: 'a2',
        name: 'A',
        location: 'B',
        ieqasStatus: 'accredited',
      );
      const none = University(
        id: 'a3',
        name: 'A',
        location: 'B',
        ieqasStatus: 'none',
      );
      const unset = University(id: 'a4', name: 'A', location: 'B');

      expect(outstanding.isAccredited, isTrue);
      expect(accredited.isAccredited, isTrue);
      expect(none.isAccredited, isFalse);
      expect(unset.isAccredited, isFalse);
    });

    test('deprecated legacy fields are still accessible and null-able', () {
      // The legacy fields stay on the domain object so the UI keeps
      // compiling during the transition. They are emitted as null by
      // the repository.
      const u = University(id: 'l1', name: 'L', location: 'X');

      // ignore: deprecated_member_use_from_same_package
      expect(u.ranking, isNull);
      // ignore: deprecated_member_use_from_same_package
      expect(u.tuitionMin, isNull);
      // ignore: deprecated_member_use_from_same_package
      expect(u.descriptionEn, isNull);
    });

    // ── Audit M19 / M17 / M18 additions (2026-05-12) ───────────────
    test('nameForLocale prefers Korean labels for ko locale', () {
      const u = University(
        id: 'n1',
        name: 'Yonsei University',
        location: 'Seoul',
        nameKo: '연세대학교',
        nameKoShort: '연세',
        nameEn: 'Yonsei University',
        nameUz: 'Yonsei universiteti',
      );
      expect(u.nameForLocale('ko'), '연세');
    });

    test('nameForLocale falls back to ko when ko_short missing', () {
      const u = University(id: 'n2', name: 'X', location: 'X', nameKo: '서울대학교');
      expect(u.nameForLocale('ko'), '서울대학교');
    });

    test('nameForLocale prefers nameUz for uz locale', () {
      const u = University(
        id: 'n3',
        name: 'X',
        location: 'X',
        nameUz: 'Yonsei',
        nameEn: 'Yonsei University',
      );
      expect(u.nameForLocale('uz'), 'Yonsei');
    });

    test('nameForLocale falls back to nameEn for English-like locales', () {
      const u = University(
        id: 'n4',
        name: 'Fallback',
        location: 'X',
        nameEn: 'Yonsei University',
      );
      expect(u.nameForLocale('ru'), 'Yonsei University');
      expect(u.nameForLocale('vi'), 'Yonsei University');
      expect(u.nameForLocale('en'), 'Yonsei University');
    });

    test(
      'nameForLocale falls back to resolved name when no per-locale label exists',
      () {
        const u = University(id: 'n5', name: 'Resolved Name', location: 'X');
        expect(u.nameForLocale('en'), 'Resolved Name');
        expect(u.nameForLocale('ko'), 'Resolved Name');
      },
    );

    test('hasVirtualTour is true when virtualTour is non-null', () {
      const u = University(
        id: 'v1',
        name: 'Y',
        location: 'Seoul',
        virtualTour: {'scenes': []},
      );
      expect(u.hasVirtualTour, isTrue);
    });

    test('hasVirtualTour is false when virtualTour is null', () {
      const u = University(id: 'v2', name: 'Y', location: 'Seoul');
      expect(u.hasVirtualTour, isFalse);
    });
  });
}
