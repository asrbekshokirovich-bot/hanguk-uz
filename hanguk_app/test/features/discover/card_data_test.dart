import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/presentation/catalog_format.dart';
import 'package:hanguk_app/features/discover/data/qs_ranking.dart';

void main() {
  group('QsRank.parse', () {
    test('a position, a tie and a band', () {
      expect(QsRank.parse('38')!.label, '38');
      final tied = QsRank.parse('=52')!;
      expect((tied.from, tied.tied, tied.label), (52, true, '=52'));
      final band = QsRank.parse('1201-1400')!;
      expect((band.from, band.to), (1201, 1400));
      final dash = QsRank.parse('1001–1200')!;
      expect((dash.from, dash.to), (1001, 1200));
      final last = QsRank.parse('1401+')!;
      expect((last.label, last.to, last.openEnded), ('1401+', null, true));
    });

    test('nonsense is no rank', () {
      expect(QsRank.parse(''), isNull);
      expect(QsRank.parse('top'), isNull);
    });

    test('every entry of the table parses and belongs to a catalogue id', () {
      for (final e in kQsRanks.entries) {
        expect(QsRank.parse(e.value), isNotNull, reason: e.key);
        expect(e.key, matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')));
      }
      expect(qsRankOf('11111111-1111-1111-1111-111111111111')!.from, 38);
      expect(qsRankOf('nope'), isNull);
    });
  });

  test('splitCity separates the province the Excel adds', () {
    expect(splitCity('Gangneung (Gangwon-do)'), (city: 'Gangneung', province: 'Gangwon'));
    expect(splitCity('Gongju (Chungcheongnam-do)'), (city: 'Gongju', province: 'Chungcheongnam'));
    expect(splitCity('Seoul'), (city: 'Seoul', province: null));
    expect(splitCity('Suwon (Gyeonggi-do) '), (city: 'Suwon', province: 'Gyeonggi'));
  });
}
