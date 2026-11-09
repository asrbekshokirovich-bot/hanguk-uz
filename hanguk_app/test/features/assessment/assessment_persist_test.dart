import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/assessment/data/assessment_controller.dart';
import 'package:hanguk_app/features/assessment/domain/assessment.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';

class _MemoryStore implements AssessmentStore {
  _MemoryStore([this.value]);
  String? value;
  int writes = 0;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String? v) async {
    writes++;
    value = v;
  }
}

const _answered = AssessmentInput(
  topik: 3,
  gpa: 4.5,
  bankKrw: 25000000,
  route: StudyRoute.master,
  universityIds: ['a', 'b'],
  ielts: 6.5,
  age: 22,
  sponsor: 1,
  recommendation: true,
  interviewPrep: 2,
);

void main() {
  test('toJson and fromJson keep every answer', () {
    final back = AssessmentInput.fromJson(jsonDecode(jsonEncode(_answered.toJson())) as Map<String, dynamic>);
    expect(back.toJson(), _answered.toJson());
  });

  test('a missing or wrong key keeps its default', () {
    final back = AssessmentInput.fromJson({'topik': 'x', 'route': 'nope', 'gpa': 3});
    expect(back.topik, const AssessmentInput().topik);
    expect(back.route, const AssessmentInput().route);
    expect(back.gpa, 3.0);
  });

  test('stored answers come back on the next visit, touched', () async {
    AssessmentNotifier.store = _MemoryStore(jsonEncode({..._answered.toJson(), 'touched': true}));
    final c = ProviderContainer();
    addTearDown(c.dispose);
    c.read(assessmentProvider);
    await Future<void>.delayed(Duration.zero);
    expect(c.read(assessmentProvider).toJson(), _answered.toJson());
    expect(c.read(assessmentTouchedProvider), isTrue);
  });

  test('a change is written, and clear forgets it', () async {
    final store = _MemoryStore();
    AssessmentNotifier.store = store;
    final c = ProviderContainer();
    addTearDown(c.dispose);
    c.read(assessmentProvider.notifier).set(_answered);
    // Written after a pause, not on every tap.
    await Future<void>.delayed(Duration.zero);
    expect(store.value, isNull);
    await Future<void>.delayed(AssessmentNotifier.saveDelay + const Duration(milliseconds: 50));
    final saved = jsonDecode(store.value!) as Map<String, dynamic>;
    expect(saved['topik'], 3);
    expect(saved['touched'], isTrue);

    c.read(assessmentProvider.notifier).clear();
    await Future<void>.delayed(Duration.zero);
    expect(store.value, isNull);
    expect(c.read(assessmentTouchedProvider), isFalse);
  });

  test('an answer given before the stored copy arrives is not overwritten', () async {
    AssessmentNotifier.store = _MemoryStore(jsonEncode(_answered.toJson()));
    final c = ProviderContainer();
    addTearDown(c.dispose);
    c.read(assessmentProvider.notifier).set(const AssessmentInput(topik: 5));
    await Future<void>.delayed(Duration.zero);
    expect(c.read(assessmentProvider).topik, 5);
  });

  test('a burst of changes (a slider moving) is written once, with the last', () async {
    final store = _MemoryStore();
    AssessmentNotifier.store = store;
    final c = ProviderContainer();
    addTearDown(c.dispose);
    for (var t = 1; t <= 6; t++) {
      c.read(assessmentProvider.notifier).set(AssessmentInput(topik: t));
    }
    await Future<void>.delayed(AssessmentNotifier.saveDelay + const Duration(milliseconds: 50));
    expect(store.writes, 1);
    expect((jsonDecode(store.value!) as Map<String, dynamic>)['topik'], 6);
  });
}
