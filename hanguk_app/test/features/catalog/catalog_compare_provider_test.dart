// Compare mode of the catalogue: the chip or a long press turns it on, only
// two universities can be picked, and a third is refused until one is removed.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/catalog/data/catalog_compare_provider.dart';

void main() {
  late ProviderContainer c;
  setUp(() => c = ProviderContainer());
  tearDown(() => c.dispose());

  CatalogCompareNotifier get() => c.read(catalogCompareProvider.notifier);
  CatalogCompareState state() => c.read(catalogCompareProvider);

  test('starts off and empty', () {
    expect(state().active, isFalse);
    expect(state().ids, isEmpty);
  });

  test('a tap does nothing while compare mode is off', () {
    get().toggle('a');
    expect(state().ids, isEmpty);
  });

  test('the chip turns it on; taps pick up to two', () {
    get().enter();
    get().toggle('a');
    get().toggle('b');
    expect(state().active, isTrue);
    expect(state().ids, ['a', 'b']);
    expect(state().full, isTrue);
  });

  test('a third is refused, not swapped in', () {
    get()
      ..enter()
      ..toggle('a')
      ..toggle('b')
      ..toggle('c');
    expect(state().ids, ['a', 'b']);
  });

  test('a second tap unpicks', () {
    get()
      ..enter()
      ..toggle('a')
      ..toggle('a');
    expect(state().ids, isEmpty);
    expect(state().active, isTrue);
  });

  test('a long press turns it on with that card picked', () {
    get().startWith('a');
    expect(state().active, isTrue);
    expect(state().ids, ['a']);
    get().startWith('a');
    expect(state().ids, ['a']);
  });

  test('a long press when both are picked keeps the two', () {
    get()
      ..startWith('a')
      ..startWith('b')
      ..startWith('c');
    expect(state().ids, ['a', 'b']);
  });

  test('removing a column keeps compare mode on', () {
    get()
      ..enter()
      ..toggle('a')
      ..toggle('b')
      ..remove('a');
    expect(state().active, isTrue);
    expect(state().ids, ['b']);
  });

  test("the chip's ✕ leaves the mode and forgets the picks", () {
    get()
      ..enter()
      ..toggle('a')
      ..exit();
    expect(state().active, isFalse);
    expect(state().ids, isEmpty);
  });
}
