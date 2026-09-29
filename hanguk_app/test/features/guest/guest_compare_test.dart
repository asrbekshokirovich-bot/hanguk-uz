// Guest Explorer's city filter.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/guest/data/guest_compare_provider.dart';

void main() {
  late ProviderContainer c;
  setUp(() => c = ProviderContainer());
  tearDown(() => c.dispose());

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
