import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/discover/data/slots.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  group('slots', () {
    late ProviderContainer c;
    setUp(() => c = ProviderContainer());
    tearDown(() => c.dispose());

    SlotsNotifier n() => c.read(slotsProvider.notifier);

    test('add fills the first empty slot, three at most', () {
      expect(n().add('a'), isTrue);
      expect(n().add('b'), isTrue);
      expect(n().add('a'), isTrue, reason: 'already in, stays where it is');
      expect(n().add('c'), isTrue);
      expect(n().add('d'), isFalse);
      expect(c.read(slotsProvider), ['a', 'b', 'c']);
      expect(n().isFull, isTrue);
    });

    test('remove empties that slot only', () {
      n()
        ..add('a')
        ..add('b')
        ..remove('a');
      expect(c.read(slotsProvider), [null, 'b', null]);
      n().add('c');
      expect(c.read(slotsProvider), ['c', 'b', null]);
    });

    test('a drop takes the slot; one moved from another slot swaps', () {
      n()
        ..add('a')
        ..add('b');
      n().place(2, 'x');
      expect(c.read(slotsProvider), ['a', 'b', 'x']);
      n().place(0, 'b');
      expect(c.read(slotsProvider), ['b', 'a', 'x']);
      n().place(1, 'y');
      expect(c.read(slotsProvider), ['b', 'y', 'x'], reason: 'a new one replaces the one there');
    });
  });

  group('Duel', () {
    test('two wins make a champion, then two new ones come up', () {
      var d = Duel.start(['a', 'b', 'c', 'd', 'e'], open: 2);
      expect((d.a, d.b), ('a', 'b'));
      d = d.pick(first: true); // a beats b
      expect((d.a, d.b, d.winsA, d.winsB), ('a', 'c', 1, 0));
      d = d.pick(first: true); // a beats c: champion
      expect(d.champions, ['a']);
      expect((d.a, d.b, d.winsA, d.winsB), ('d', 'e', 0, 0));
      expect(d.compared, 2);
      expect(d.done, isFalse);
    });

    test('a loser leaves and the winner keeps its wins', () {
      var d = Duel.start(['a', 'b', 'c', 'd'], open: 1);
      d = d.pick(first: false); // b beats a
      expect((d.a, d.b, d.winsA, d.winsB), ('c', 'b', 0, 1));
      d = d.pick(first: true); // c beats b
      expect((d.a, d.b, d.winsA, d.winsB), ('c', 'd', 1, 0));
    });

    test('done once every open slot has a champion', () {
      var d = Duel.start(['a', 'b', 'c', 'd', 'e'], open: 1);
      d = d.pick(first: true).pick(first: true);
      expect(d.champions, ['a']);
      expect(d.done, isTrue);
      expect(d.pick(first: true).champions, ['a'], reason: 'no more picks once done');
    });

    test('the last one standing takes a slot when the list runs out', () {
      var d = Duel.start(['a', 'b'], open: 3);
      d = d.pick(first: true); // a beats b, no one left to meet
      expect(d.champions, ['a']);
      expect(d.done, isTrue);
    });

    test('a single candidate goes straight in; none means done', () {
      expect(Duel.start(['a'], open: 2).champions, ['a']);
      expect(Duel.start(const [], open: 2).done, isTrue);
      expect(Duel.start(['a', 'b'], open: 0).done, isTrue);
    });
  });
}
