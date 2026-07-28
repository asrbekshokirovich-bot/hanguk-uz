import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/training_contracts.dart';

void main() {
  group('SuperviseResult.parse', () {
    test('parses a well-formed envelope', () {
      final r = SuperviseResult.parse({
        'response':
            '{"ghostText":" — and beyond.","issues":[{"originalText":"alot","suggestion":"a lot"}]}',
      });
      expect(r, isNotNull);
      expect(r!.ghostText, ' — and beyond.');
      expect(r.issues, hasLength(1));
      expect(r.issues.first.originalText, 'alot');
      expect(r.issues.first.suggestion, 'a lot');
    });

    test('returns null on error envelope', () {
      expect(SuperviseResult.parse({'error': 'RATE_LIMITED'}), isNull);
    });

    test('returns null when response is plain prose', () {
      expect(
        SuperviseResult.parse({'response': 'Looks great overall!'}),
        isNull,
      );
    });
  });

  group('AnalyzeResult.parse', () {
    test('extracts structured fields when present', () {
      final a = AnalyzeResult.parse({
        'response':
            '{"overall_score":82,"content_feedback":"Strong intro","strengths":["clarity"],"improvements":["depth"]}',
      });
      expect(a.overallScore, 82);
      expect(a.contentFeedback, 'Strong intro');
      expect(a.strengths, ['clarity']);
      expect(a.improvements, ['depth']);
    });

    test('falls back to ai-response prose on legacy shape', () {
      final a = AnalyzeResult.parse({'response': 'You made some points.'});
      expect(a.aiResponseText, 'You made some points.');
      expect(a.overallScore, isNull);
    });
  });

  group('InterviewFeedback.parse', () {
    test('reads 1–10 score fields straight through', () {
      final fb = InterviewFeedback.parse({
        'feedback': {
          'overall_score': 8,
          'communication_score': 7,
          'detailed_feedback': 'Be more concise.',
          'message_scores': [
            {'score': 8, 'ideal_hint': 'Trim filler words.'},
          ],
        },
      });
      expect(fb, isNotNull);
      expect(fb!.overallScore, 8);
      expect(fb.communicationScore, 7);
      expect(fb.detailedFeedback, 'Be more concise.');
      expect(fb.messageScores, hasLength(1));
    });

    test('returns null on malformed envelope', () {
      expect(InterviewFeedback.parse(null), isNull);
      expect(InterviewFeedback.parse(const <String, dynamic>{}), isNull);
      expect(InterviewFeedback.parse({'feedback': 'not-a-map'}), isNull);
    });
  });
}
