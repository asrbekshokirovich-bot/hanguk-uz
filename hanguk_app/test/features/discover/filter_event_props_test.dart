import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/discover/presentation/filter_screen.dart';

void main() {
  test('filter_apply says what was chosen, regions sorted, 1% only when on', () {
    const f = CatalogFilter(field: 'it', regions: {'Seul', 'Busan'}, topik: '3', maxPrice: 4500000, onePercent: true);
    final p = filterEventProps(f, 12);
    expect(p['field'], 'it');
    expect(p['regions'], 'Busan,Seul');
    expect(p['topik'], '3');
    expect(p['max_price'], 4500000);
    expect(p['one_percent'], true);
    expect(p['results'], 12);

    final none = filterEventProps(const CatalogFilter(), null);
    expect(none['regions'], isNull);
    expect(none['one_percent'], isNull);
    expect(none['results'], isNull);
  });
}
