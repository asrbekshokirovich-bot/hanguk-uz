import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_detail_screen.dart';
import 'package:hanguk_app/features/discover/data/application_windows.dart';

CatalogRound r(int stage, int step, {String? start, String? end, String status = 'tasdiqlangan'}) =>
    CatalogRound(stage: stage, step: step, startDate: start, endDate: end, status: status);

void main() {
  // Jeonbuk-like guideline: round 1 is over on 9-noyabr, round 2 is open.
  final rounds = [
    r(2, 3, start: '2026-11-09', end: '2026-11-27'),
    r(1, 2, start: '2026-10-01', end: '2026-10-14'),
    r(1, 1, status: 'etap_yoq'),
    r(2, 2, start: '2026-11-09', end: '2026-11-20'),
    r(1, 3, start: '2026-10-01', end: '2026-10-21'),
    r(2, 11, status: 'nisbiy'),
    r(3, 2, start: '2026-12-21', end: '2027-01-07'),
  ];

  test('the round open today, its steps in order', () {
    final s = catalogFirstStage(rounds, DateTime(2026, 11, 9));
    expect(s.map((x) => (x.stage, x.step)), [(2, 2), (2, 3), (2, 11)]);
  });

  test('before any deadline passes, the first round', () {
    final s = catalogFirstStage(rounds, DateTime(2026, 9, 1));
    expect(s.map((x) => x.step), [2, 3]);
    expect(s.every((x) => x.stage == 1), isTrue);
  });

  test('every round over: the last one', () {
    final s = catalogFirstStage(rounds, DateTime(2027, 3, 1));
    expect(s.single.stage, 3);
  });

  test('a past step is marked, today is not past', () {
    final today = DateTime(2026, 11, 9);
    expect(catalogStepPast(r(1, 2, end: '2026-10-14'), today), isTrue);
    expect(catalogStepPast(r(2, 2, end: '2026-11-09'), today), isFalse);
    expect(catalogStepPast(r(2, 11, status: 'nisbiy'), today), isFalse);
  });

  test('the card "Muddat" takes the current round', () {
    final rows = [
      for (final x in rounds)
        {
          'guideline_id': 'g',
          'bosqich': x.stage,
          'etap_raqam': x.step,
          'boshlanish_sana': x.startDate,
          'tugash_sana': x.endDate,
          'holat': x.status,
        },
    ];
    final w = applicationWindowsFrom(rows)['g']!;
    // Relative to the real clock: never a deadline already behind today
    // while a later round is still open.
    expect(catalogStepPast(w) && DateTime.now().isBefore(DateTime(2027, 1, 7)), isFalse);
  });
}
