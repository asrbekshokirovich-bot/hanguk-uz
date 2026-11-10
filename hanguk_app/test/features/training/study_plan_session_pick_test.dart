// Which Study Plan the builder opens and the Tayyorgarlik card counts (audit
// P-F1, 2026-11-10): a plan written before the student chose a university
// (no target) disappeared from both once one was chosen — for 14 of the 23
// students with an open plan, the newest session had no target. Both choose
// with pickStudyPlanSession among the rows of fetchStudyPlanCandidates.
//
// The choice is checked as a pure function over rows; the requests (the
// read, the adoption of a plan with no university, the touch after a save)
// as the pinned postgrest builds them, against a fake server.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/plan_sections.dart';
import 'package:hanguk_app/features/training/data/study_plan_repository.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// A session row as fetchStudyPlanCandidates reads it: [target] null for a
/// plan written before a university was chosen; [text] its newest draft
/// (none when null).
Map<String, dynamic> _row(String id, {String? target, String? text}) => {
  'id': id,
  'student_id': 'me',
  'document_type': 'study_plan',
  'target_institution_id': target,
  'current_step': 1,
  'status': 'in_progress',
  'updated_at': '2026-11-10T09:00:00+00:00',
  'institution': target == null ? null : {'name_en': 'Uni $target', 'name_ko': null},
  'study_plan_drafts': [
    if (text != null) {'id': 'd-$id', 'content': text, 'version': 1},
  ],
};

final String _plan = serializePlan(['Men Koreyada kompyuter injiniringi bo‘yicha o‘qimoqchiman.', '', '', '']);

/// [rows] are newest first, as the read orders them.
String? _picked(List<Map<String, dynamic>> rows, {String? target}) =>
    pickStudyPlanSession(rows, targetUniversityId: target)?.row['id'] as String?;

bool _adopts(List<Map<String, dynamic>> rows, {String? target}) =>
    pickStudyPlanSession(rows, targetUniversityId: target)!.adopt;

void main() {
  group('pickStudyPlanSession, for a chosen university', () {
    test("its own plan with text first, even with a newer one with no university", () {
      final rows = [_row('loose', text: _plan), _row('own', target: 'u1', text: _plan)];
      expect(_picked(rows, target: 'u1'), 'own');
      expect(_adopts(rows, target: 'u1'), isFalse);
    });

    test('else the newest plan with text written before a university was chosen — to be adopted', () {
      final rows = [
        _row('own-empty', target: 'u1'),
        _row('loose-empty'),
        _row('loose-newer', text: _plan),
        _row('loose-older', text: 'Eski reja.'),
      ];
      expect(_picked(rows, target: 'u1'), 'loose-newer');
      expect(_adopts(rows, target: 'u1'), isTrue);
      expect(pickStudyPlanSession(rows, targetUniversityId: 'u1')!.content, _plan);
    });

    test('else its own plan even with nothing written', () {
      final rows = [_row('loose-empty'), _row('own-newer', target: 'u1'), _row('own-older', target: 'u1')];
      expect(_picked(rows, target: 'u1'), 'own-newer');
      expect(_adopts(rows, target: 'u1'), isFalse);
      expect(pickStudyPlanSession(rows, targetUniversityId: 'u1')!.content, isEmpty);
    });

    test('else none: a new plan is started', () {
      expect(pickStudyPlanSession(const [], targetUniversityId: 'u1'), isNull);
      expect(pickStudyPlanSession([_row('loose-empty')], targetUniversityId: 'u1'), isNull);
    });

    test("another university's plan is never taken", () {
      expect(pickStudyPlanSession([_row('other', target: 'u2', text: _plan)], targetUniversityId: 'u1'), isNull);
    });

    test('a draft of part markers only is nothing written', () {
      final rows = [_row('loose', text: '## Goal\n\n## Why Korea\n'), _row('own', target: 'u1')];
      expect(_picked(rows, target: 'u1'), 'own');
    });
  });

  group('pickStudyPlanSession, with no university chosen', () {
    test('the newest plan with text, of any university', () {
      final rows = [_row('newest-empty'), _row('u1-text', target: 'u1', text: _plan), _row('loose-text', text: _plan)];
      expect(_picked(rows), 'u1-text');
      expect(_adopts(rows), isFalse);
    });

    test('else the newest; else none', () {
      expect(_picked([_row('newer', target: 'u1'), _row('older')]), 'newer');
      expect(pickStudyPlanSession(const []), isNull);
    });
  });

  group('the requests, as the pinned postgrest sends them', () {
    late List<http.Request> sent;
    late List<Object?> answers;
    late SupabaseClient client;

    setUp(() {
      sent = [];
      answers = [];
      client = SupabaseClient(
        'https://test.supabase.co',
        'anon-key',
        authOptions: const AuthClientOptions(autoRefreshToken: false),
        httpClient: MockClient((request) async {
          sent.add(request);
          return http.Response(
            jsonEncode(answers.isEmpty ? const [] : answers.removeAt(0)),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
            // postgrest reads the method back from the response's request.
            request: request,
          );
        }),
      );
    });
    tearDown(() => client.dispose());

    test("the read: the university's sessions and those with none, newest first, each with its newest draft", () async {
      answers.add([_row('loose', text: _plan)]);
      final rows = await fetchStudyPlanCandidates(client, userId: 'me', type: 'study_plan', targetUniversityId: 'u1');
      expect(rows.single['id'], 'loose');

      final request = sent.single;
      expect(request.method, 'GET');
      expect(request.url.path, '/rest/v1/study_plan_sessions');
      expect(request.url.queryParametersAll, {
        'select': ['*,institution:target_institution_id(name_en,name_ko),study_plan_drafts(id,content,version)'],
        'student_id': ['eq.me'],
        'document_type': ['eq.study_plan'],
        'status': ['neq.completed'],
        'or': ['(target_institution_id.eq.u1,target_institution_id.is.null)'],
        'order': ['updated_at.desc.nullslast'],
        'study_plan_drafts.order': ['version.desc.nullslast'],
        'study_plan_drafts.limit': ['1'],
        'limit': ['50'],
      });
    });

    test('the read with no university: every session', () async {
      await fetchStudyPlanCandidates(client, userId: 'me', type: 'study_plan');
      final params = sent.single.url.queryParametersAll;
      expect(params.containsKey('or'), isFalse);
      expect(params.containsKey('target_institution_id'), isFalse);
      expect(params['student_id'], ['eq.me']);
    });

    test("the adoption: the student's own session, and only while it has no university", () async {
      answers.add([_row('loose', target: 'u1')]);
      final row = await adoptStudyPlanSession(client, sessionId: 'loose', userId: 'me', targetUniversityId: 'u1');
      expect(row!['target_institution_id'], 'u1');

      final request = sent.single;
      expect(request.method, 'PATCH');
      expect(request.url.path, '/rest/v1/study_plan_sessions');
      expect(jsonDecode(request.body), {'target_institution_id': 'u1'});
      expect(request.url.queryParametersAll, {
        'id': ['eq.loose'],
        'student_id': ['eq.me'],
        'target_institution_id': ['is.null'],
        'select': ['*,institution:target_institution_id(name_en,name_ko)'],
      });
      expect(request.headers['Prefer'], contains('return=representation'));
    });

    test('the adoption, when the session had a university by then: nothing changed', () async {
      answers.add(const []);
      expect(await adoptStudyPlanSession(client, sessionId: 'loose', userId: 'me', targetUniversityId: 'u1'), isNull);
    });

    test("the touch after a save: the session's updated_at", () async {
      await touchStudyPlanSession(client, 's1');
      final request = sent.single;
      expect(request.method, 'PATCH');
      expect(request.url.queryParametersAll, {
        'id': ['eq.s1'],
      });
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      expect(body.keys, ['updated_at']);
      expect(DateTime.parse(body['updated_at'] as String).isUtc, isTrue);
    });
  });
}
