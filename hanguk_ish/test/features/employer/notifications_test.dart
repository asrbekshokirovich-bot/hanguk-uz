import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/features/employer/ko.dart';

import '../../helpers/employer_harness.dart';
import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

/// The demo business with [bell] as its notifications.
class BellEmployer extends DemoEmployerRepository {
  BellEmployer(this.bell) : super(now: employerPrototypeNow, clock: () => employerPrototypeNow);

  final List<EmployerNotification> bell;

  @override
  Future<List<EmployerNotification>> notifications() async => bell;

  @override
  Future<void> markNotificationsRead() async {}
}

void main() {
  setUpAll(loadHiFonts);

  testWidgets('알림: an applicant of a 자동 확정 shift reads as confirmed, the others as applied', (tester) async {
    usePhone(tester);
    final repo = BellEmployer([
      EmployerNotification(
        id: '1',
        kind: EmployerNotificationKind.newApplicant,
        createdAt: employerPrototypeNow,
        shiftId: 'demo-es-open',
        shiftTitle: '오픈 바리스타 보조',
        workerName: 'Aziz Karimov',
        autoConfirmed: true,
      ),
      EmployerNotification(
        id: '2',
        kind: EmployerNotificationKind.newApplicant,
        createdAt: employerPrototypeNow.subtract(const Duration(minutes: 5)),
        shiftId: 'demo-es-close',
        shiftTitle: '마감 정리 보조',
        workerName: 'Malika Yusupova',
      ),
    ]);
    final container = employerContainer(location: EmployerRoutes.notifications, repository: repo);
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();
    expect(find.text(Ko.notifAutoConfirmed), findsOneWidget);
    expect(find.text(Ko.notifAutoConfirmedText('Aziz Karimov', '오픈 바리스타 보조')), findsOneWidget);
    expect(find.text(Ko.notifNewApplicant), findsOneWidget);
    expect(find.text(Ko.notifNewApplicantText('Malika Yusupova', '마감 정리 보조')), findsOneWidget);
  });
}
