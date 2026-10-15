import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/uni_db/data/notification_service.dart';
import 'package:hanguk_app/features/university_choices/presentation/university_choices_screen.dart';

void main() {
  test('a survey push opens that survey', () {
    expect(notificationRoute({'type': 'survey', 'survey_id': 's1'}), '/surveys/s1');
    expect(notificationRoute({'type': 'survey'}), isNull);
  });

  test('a university stage opens the university choices, other stages the journey', () {
    expect(notificationRoute({'type': 'stage', 'kind': 'university_offered'}), kUniversityChoicesPath);
    expect(notificationRoute({'type': 'stage', 'kind': 'university_confirmed'}), kUniversityChoicesPath);
    expect(notificationRoute({'type': 'stage', 'kind': 'documents_ready'}), '/');
    expect(notificationRoute({'type': 'stage', 'kind': 'offline_sent'}), '/');
  });

  test('anything else opens nothing', () {
    expect(notificationRoute({}), isNull);
    expect(notificationRoute({'type': 'other'}), isNull);
  });
}
