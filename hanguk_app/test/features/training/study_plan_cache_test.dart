// The phone's copy of a Study Plan (Tayyorgarlik T3): kept per student, plan
// and university in secure storage, read back as it was written — and
// anything else in its place, or a storage that fails, is simply no copy.
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/features/training/data/study_plan_cache.dart';

const _channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final stored = <String, String>{};

  setUp(() {
    stored.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_channel, (call) async {
      final args = (call.arguments as Map?) ?? const {};
      final key = args['key'] as String?;
      switch (call.method) {
        case 'read':
          return stored[key];
        case 'write':
          stored[key!] = args['value'] as String;
      }
      return null;
    });
  });
  tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(_channel, null));

  test('a copy is read back as it was kept', () async {
    const cache = SecureStudyPlanCache();
    final key = studyPlanCopyKey(userId: 'me', type: 'study_plan', targetUniversityId: 'u1');
    final copy = StudyPlanCopy(
      sessionId: 's1',
      version: 3,
      content: '## Goal\nMen Koreyada o‘qimoqchiman. 한국어',
      savedAt: DateTime.utc(2026, 11, 10, 9, 30),
    );
    expect(await cache.read(key), isNull);

    await cache.write(key, copy);
    expect(jsonDecode(stored[key]!), {
      'sessionId': 's1',
      'version': 3,
      'content': '## Goal\nMen Koreyada o‘qimoqchiman. 한국어',
      'savedAt': '2026-11-10T09:30:00.000Z',
    });
    final back = (await cache.read(key))!;
    expect((back.sessionId, back.version, back.content, back.savedAt), (copy.sessionId, copy.version, copy.content, copy.savedAt));
  });

  test('text that could not be saved is kept, and read back, as such (audit C-F5)', () async {
    const cache = SecureStudyPlanCache();
    final key = studyPlanCopyKey(userId: 'me', type: 'study_plan', targetUniversityId: 'u1');
    final copy = StudyPlanCopy(
      sessionId: 's1',
      version: 2,
      content: '## Goal\nSaqlanmagan matn.',
      savedAt: DateTime.utc(2026, 11, 10, 9, 30),
      unsaved: true,
    );
    await cache.write(key, copy);
    expect(jsonDecode(stored[key]!), {
      'sessionId': 's1',
      'version': 2,
      'content': '## Goal\nSaqlanmagan matn.',
      'savedAt': '2026-11-10T09:30:00.000Z',
      'unsaved': true,
    });
    final back = (await cache.read(key))!;
    expect((back.sessionId, back.version, back.content, back.unsaved), ('s1', 2, '## Goal\nSaqlanmagan matn.', true));

    // A copy kept before the mark existed is the server's text.
    stored[key] = jsonEncode({'sessionId': 's1', 'version': 1, 'content': 'x', 'savedAt': '2026-11-10T09:30:00Z'});
    expect((await cache.read(key))!.unsaved, isFalse);
  });

  test('one copy per student, document type and university', () {
    final keys = {
      studyPlanCopyKey(userId: 'me', type: 'study_plan', targetUniversityId: 'u1'),
      studyPlanCopyKey(userId: 'me', type: 'study_plan', targetUniversityId: 'u2'),
      studyPlanCopyKey(userId: 'me', type: 'study_plan'),
      studyPlanCopyKey(userId: 'you', type: 'study_plan', targetUniversityId: 'u1'),
      studyPlanCopyKey(userId: 'me', type: 'personal_statement', targetUniversityId: 'u1'),
    };
    expect(keys, hasLength(5));
    expect(studyPlanCopyKey(userId: 'me', type: 'study_plan'), endsWith(':any'));
  });

  test('anything else in its place is no copy', () async {
    const cache = SecureStudyPlanCache();
    stored['k'] = 'not json';
    expect(await cache.read('k'), isNull);
    stored['k'] = jsonEncode({'sessionId': 's1', 'content': 'x', 'savedAt': '2026-11-10T09:30:00Z'});
    expect(await cache.read('k'), isNull, reason: 'no version');
    stored['k'] = jsonEncode(['s1', 1, 'x']);
    expect(await cache.read('k'), isNull);
  });

  test('a storage that fails is no copy, and no crash', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      _channel,
      (call) async => throw PlatformException(code: 'keystore'),
    );
    const cache = SecureStudyPlanCache();
    expect(await cache.read('k'), isNull);
    await cache.write('k', StudyPlanCopy(sessionId: 's1', version: 1, content: 'x', savedAt: DateTime.now()));
  });
}
