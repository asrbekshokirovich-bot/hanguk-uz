import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/presentation/guest_application_path_screen.dart';
import 'package:hanguk_app/features/discover/presentation/guest_documents_screen.dart';

void main() {
  test('days left to a step end, counted by calendar day', () {
    final today = DateTime(2026, 11, 6, 15);
    expect(daysUntil('2026-11-20', today), 14);
    expect(daysUntil('2026-11-06', today), 0);
    expect(daysUntil('2026-11-05', today), -1);
    expect(daysUntil(null, today), isNull);
  });

  test('a document reads in the phone language', () {
    const d = CatalogDoc(name: 'Foto', translations: {'en': 'Photo', 'ru': 'Фото'});
    expect(docName(d, 'uz'), 'Foto');
    expect(docName(d, 'ru'), 'Фото');
    expect(docName(d, 'ko'), 'Foto');
  });
}
