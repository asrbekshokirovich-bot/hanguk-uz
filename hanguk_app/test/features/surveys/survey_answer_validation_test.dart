import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/surveys/data/survey_repository.dart';
import 'package:hanguk_app/features/surveys/presentation/survey_detail_screen.dart';

SurveyQuestion q(String type, {String text = 'Savol'}) => SurveyQuestion(
      id: 'q1',
      questionText: text,
      questionType: type,
      sortOrder: 0,
      isRequired: true,
    );

void main() {
  group('email', () {
    test('accepts an ordinary address', () {
      expect(validateSurveyAnswer(q('email'), 'aziz@mail.uz'), isNull);
    });

    test('rejects a missing @ or domain', () {
      expect(validateSurveyAnswer(q('email'), 'azizmail.uz'), isNotNull);
      expect(validateSurveyAnswer(q('email'), 'aziz@mail'), isNotNull);
      expect(validateSurveyAnswer(q('email'), 'aziz@ mail.uz'), isNotNull);
    });

    test('blank is not an error — required-ness is checked separately', () {
      expect(validateSurveyAnswer(q('email'), ''), isNull);
      expect(validateSurveyAnswer(q('email'), '   '), isNull);
      expect(validateSurveyAnswer(q('email'), null), isNull);
    });

    test('the message names the question so the student knows which field', () {
      final error = validateSurveyAnswer(q('email', text: 'Otangiz emaili'), 'x');
      expect(error, contains('Otangiz emaili'));
    });
  });

  group('phone', () {
    test('accepts the formats staff actually type', () {
      expect(validateSurveyAnswer(q('phone'), '+998901234567'), isNull);
      expect(validateSurveyAnswer(q('phone'), '+998 90 123 45 67'), isNull);
      expect(validateSurveyAnswer(q('phone'), '901234567'), isNull);
      expect(validateSurveyAnswer(q('phone'), '010-1234-5678'), isNull);
    });

    test('rejects too few or too many digits', () {
      expect(validateSurveyAnswer(q('phone'), '12345'), isNotNull);
      expect(validateSurveyAnswer(q('phone'), '1234567890123456'), isNotNull);
    });
  });

  group('number', () {
    test('accepts integers and decimals', () {
      expect(validateSurveyAnswer(q('number'), '12345'), isNull);
      expect(validateSurveyAnswer(q('number'), '3.5'), isNull);
    });

    test('rejects letters', () {
      expect(validateSurveyAnswer(q('number'), '12a45'), isNotNull);
    });
  });

  group('untyped fields', () {
    test('text, long_text and date are not format-checked', () {
      for (final type in ['text', 'long_text', 'date', 'single_choice']) {
        expect(validateSurveyAnswer(q(type), 'anything at all'), isNull);
      }
    });

    test('a non-string answer (choice list, rating) is left alone', () {
      expect(validateSurveyAnswer(q('multiple_choice'), ['a', 'b']), isNull);
      expect(validateSurveyAnswer(q('rating'), 4), isNull);
    });
  });
}
