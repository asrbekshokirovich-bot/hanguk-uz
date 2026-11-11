// Sahifa turi: sahifa aylanayotganda yoritilgan ramka bo'limdan ajralmaydi
// (Asrbek, 2026-11-11). Ramka har kadrda sahifa shu kadr uchun joylashgandan
// keyin chiziladi — avval bir kadr orqada qolardi.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/discover/data/board_tour.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/page_tour.dart';

class _Unseen extends TourSeenNotifier {
  _Unseen() : super('test_tour_seen');

  @override
  bool? build() => false;
}

final _unseen = NotifierProvider<TourSeenNotifier, bool?>(_Unseen.new);

Rect _rect(GlobalKey key) {
  final box = key.currentContext!.findRenderObject()! as RenderBox;
  return box.localToGlobal(Offset.zero) & box.size;
}

void main() {
  testWidgets('the light stays on its place in the same frame the page scrolls', (t) async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
    final controller = ScrollController();
    addTearDown(controller.dispose);
    late List<GlobalKey> keys;
    await t.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: PageTour(
              name: 'test',
              seen: _unseen,
              steps: (context) => const [
                TourStep('A', icon: SizedBox()),
                TourStep('B', icon: SizedBox()),
              ],
              builder: (context, k) {
                keys = k;
                return ListView(
                  controller: controller,
                  children: [
                    SizedBox(key: k[0], height: 300),
                    SizedBox(key: k[1], height: 300),
                    const SizedBox(height: 2000),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
    await t.pump();
    await t.pump(const Duration(milliseconds: 50));
    expect(find.text('A'), findsOneWidget);
    expect(_debugHole(), _rect(keys[0]).inflate(6));

    for (final to in [120.0, 260.0, 40.0]) {
      controller.jumpTo(to);
      await t.pump();
      expect(_debugHole(), _rect(keys[0]).inflate(6), reason: 'scrolled to $to');
    }
    await t.pumpWidget(const SizedBox());
  });
}

Rect? _debugHole() => debugTourHole();
