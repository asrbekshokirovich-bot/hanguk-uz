// Guest Explorer's compare tray (DESIGN_SPEC 3b): at most two universities,
// and picking a third evicts the OLDEST rather than refusing the tap.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/guest/data/guest_compare_provider.dart';

void main() {
  late ProviderContainer c;
  setUp(() => c = ProviderContainer());
  tearDown(() => c.dispose());

  GuestCompareNotifier get() => c.read(guestCompareProvider.notifier);
  List<String> state() => c.read(guestCompareProvider);

  test('starts empty', () => expect(state(), isEmpty));

  test('holds two', () {
    get()
      ..toggle('a')
      ..toggle('b');
    expect(state(), ['a', 'b']);
  });

  test('a third evicts the oldest, never refuses the tap', () {
    get()
      ..toggle('a')
      ..toggle('b')
      ..toggle('c');
    expect(state(), ['b', 'c'], reason: 'oldest out, newest in');
    expect(state().length, GuestCompareNotifier.maxSlots);
  });

  test('toggling a selected one removes it', () {
    get()
      ..toggle('a')
      ..toggle('b')
      ..toggle('a');
    expect(state(), ['b']);
  });

  test('re-adding after eviction works', () {
    get()
      ..toggle('a')
      ..toggle('b')
      ..toggle('c')
      ..toggle('a');
    expect(state(), ['c', 'a']);
  });

  test('remove and clear', () {
    get()
      ..toggle('a')
      ..toggle('b');
    get().remove('a');
    expect(state(), ['b']);
    get().clear();
    expect(state(), isEmpty);
  });

  test('city filter toggles off when re-tapped', () {
    final n = c.read(guestCityFilterProvider.notifier);
    n.toggle('서울');
    expect(c.read(guestCityFilterProvider), '서울');
    n.toggle('서울');
    expect(
      c.read(guestCityFilterProvider),
      isNull,
      reason: 'a filter you cannot undo is a trap',
    );
  });
}
