import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/discover/presentation/discover_routes.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
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
    expect(notificationRoute({'type': 'stage', 'kind': 'admission_accepted'}), kUniversityChoicesPath);
    expect(notificationRoute({'type': 'stage', 'kind': 'final_university'}), kUniversityChoicesPath);
    expect(notificationRoute({'type': 'stage', 'kind': 'documents_ready'}), '/?tab=${AppTab.documents}');
    expect(notificationRoute({'type': 'stage', 'kind': 'deadline', 'campaign': 'deadline_3'}), kUniversityChoicesPath);
    expect(notificationRoute({'type': 'stage', 'kind': 'offline_sent'}), '/');
  });

  test("a guest's reminder opens the university it is about", () {
    const id = '0b4c2f3e-1d2a-4c5b-8e9f-0a1b2c3d4e5f';
    expect(notificationRoute({'type': 'guest_deadline', 'institution_id': id}), '/university/$id');
    expect(notificationRoute({'type': 'guideline_new', 'institution_id': id}), '/university/$id');
    expect(notificationRoute({'type': 'guest_deadline'}), kDiscoverPath);
    expect(notificationRoute({'type': 'guest_deadline', 'institution_id': '../x'}), kDiscoverPath);
  });

  test('push events carry the kind and the university', () {
    final p = pushProps({'type': 'guest_deadline', 'kind': 'deadline_7', 'institution_id': 'u', 'campaign': 'c', 'x': 1});
    expect(p, {'type': 'guest_deadline', 'campaign': 'c', 'kind': 'deadline_7', 'institution_id': 'u'});
  });

  test('anything else opens nothing', () {
    expect(notificationRoute({}), isNull);
    expect(notificationRoute({'type': 'other'}), isNull);
  });
}
