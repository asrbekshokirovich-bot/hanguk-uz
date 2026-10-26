import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/seen.dart';
import 'package:hanguk_app/core/analytics/tracked.dart';
import 'package:hanguk_app/features/assessment/domain/assessment.dart';

void main() {
  final seen = <TrackedEvent>[];
  setUp(() {
    seen.clear();
    AppEvents.debugReset();
    AppEvents.debugOnTrack = seen.add;
  });
  tearDown(() => AppEvents.debugOnTrack = null);

  List<Object?> viewed() => [for (final e in seen.where((e) => e.event == 'card_view')) e.props?['institution_id']];

  Widget list({int count = 20, ScrollController? controller}) => SeenList(
    name: 'universities',
    child: ListView(
      controller: controller,
      children: [
        for (var i = 0; i < count; i++)
          Seen(
            id: 'u$i',
            position: i + 1,
            child: GestureDetector(
              onTap: tracked('test.card', () {}, props: {'institution_id': 'u$i'}),
              child: SizedBox(height: 100, child: ColoredBox(color: Colors.white, child: Text('u$i'))),
            ),
          ),
      ],
    ),
  );

  Widget app(Widget home) => MaterialApp(
    builder: (context, child) => AnalyticsRoot(child: child!),
    home: Scaffold(body: home),
  );

  testWidgets('cards resting on screen are seen once, with their place', (t) async {
    final scroll = ScrollController();
    addTearDown(scroll.dispose);
    await t.pumpWidget(app(list(controller: scroll)));
    await t.pump();
    // 600 px tall: six cards of 100 fit.
    expect(viewed(), ['u0', 'u1', 'u2', 'u3', 'u4', 'u5']);
    final first = seen.firstWhere((e) => e.event == 'card_view');
    expect(first.props, {'institution_id': 'u0', 'position': 1, 'list': 'universities'});

    scroll.jumpTo(300);
    await t.pump();
    await t.pump();
    expect(viewed(), ['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']);

    // Back up: nothing is counted twice.
    scroll.jumpTo(0);
    await t.pump();
    await t.pump();
    expect(viewed(), hasLength(9));
  });

  testWidgets('a list in a tab that is not showing sees nothing', (t) async {
    await t.pumpWidget(app(IndexedStack(index: 1, children: [list(), const SizedBox.expand()])));
    await t.pump();
    expect(viewed(), isEmpty);
  });

  testWidgets('a tap on a card carries the list and the place; its page knows where it came from', (t) async {
    await t.pumpWidget(app(list()));
    await t.pump();
    await t.tap(find.text('u2'));
    await t.pump();
    final tap = seen.lastWhere((e) => e.event == 'tap');
    expect(tap.element, 'test.card');
    expect(tap.props, containsPair('list', 'universities'));
    expect(tap.props, containsPair('position', 3));
    expect(tap.props, containsPair('institution_id', 'u2'));
    expect(AppEvents.cardOrigin('u2'), {'from': 'universities', 'position': 3});
    expect(AppEvents.cardOrigin('u3'), isEmpty);
  });

  testWidgets('stepping into a form field is recorded, not what is typed', (t) async {
    await t.pumpWidget(app(const TrackedField(form: 'lead', field: 'phone', child: TextField())));
    await t.tap(find.byType(TextField));
    await t.pump();
    await t.enterText(find.byType(TextField), '901234567');
    await t.pump();
    final focus = seen.where((e) => e.event == 'field_focus').toList();
    expect(focus.single.props, {'form': 'lead', 'field': 'phone'});
    expect(seen.any((e) => e.props?.values.contains('901234567') ?? false), isFalse);
  });

  test('typed text is cleaned: no phone numbers, no e-mails, at most 80 characters', () {
    expect(AppEvents.cleanText('  Seoul   National '), 'seoul national');
    expect(AppEvents.cleanText('90 123 45 67'), isNull);
    expect(AppEvents.cleanText('me@mail.uz'), isNull);
    expect(AppEvents.cleanText('topik 3'), 'topik 3');
    expect(AppEvents.cleanText('a' * 100)!.length, 80);
    expect(AppEvents.cleanText('   '), isNull);
  });

  test('answers are recorded as ranges, not figures', () {
    const input = AssessmentInput(gpa: 4.37, age: 23, bankKrw: 23500000, sponsor: 1);
    final b = input.answerBands();
    expect(b['gpa'], 4.0);
    expect(b['age'], 22);
    expect(b['bank'], 20);
    expect(b['sponsor'], 1);
    expect(const AssessmentInput(bankKrw: 90000000).answerBands()['bank'], 30);
    expect(const AssessmentInput(age: 16).answerBands()['age'], 17);
  });
}
