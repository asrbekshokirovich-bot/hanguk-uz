import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/answer_review.dart';

void main() {
  group('reviewedAnswer', () {
    test('the words stored with the review come first', () {
      expect(
        reviewedAnswer(
          {'message_id': 'db-1', 'answer': '  For study and the language  '},
          {'db-1': 'For'},
        ),
        'For study and the language',
      );
    });

    test('a review without stored words falls back to the transcript line', () {
      expect(reviewedAnswer({'message_id': 'm1'}, {'m1': ' Because of work '}), 'Because of work');
    });

    test('nothing to show: no stored words and an id this screen does not hold', () {
      expect(reviewedAnswer({'message_id': 'db-uuid'}, {'vapi-student-1': 'Hello'}), isNull);
      expect(reviewedAnswer({'message_id': 'm1', 'answer': '   '}, {'m1': '  '}), isNull);
      expect(reviewedAnswer({'answer': 42}, const {}), isNull);
      expect(reviewedAnswer(const {}, const {}), isNull);
    });
  });
}
