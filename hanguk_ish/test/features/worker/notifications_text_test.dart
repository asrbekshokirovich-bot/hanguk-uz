import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/account.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// A12 with one notification of a new shift: an invitation (BA4 «다시
/// 요청») of a business with no point yet, so no distance; [marks]: whether
/// the server keeps the read mark.
class OneNotice extends DemoAccountRepository {
  OneNotice({this.km, this.marks = true}) : super(now: prototypeNow);

  final double? km;
  final bool marks;
  int markCalls = 0;
  bool _read = false;

  @override
  Future<List<HiNotification>> notifications() async => [
        HiNotification(
          id: 'invite',
          kind: NotificationKind.newShift,
          createdAt: prototypeNow,
          read: _read,
          businessNames: const {'uz': 'E2E Kafe'},
          startsAt: prototypeNow.add(const Duration(days: 1)),
          endsAt: prototypeNow.add(const Duration(days: 1, hours: 3)),
          wage: 11000,
          distanceKm: km,
        ),
      ];

  @override
  Future<void> markNotificationsRead() async {
    markCalls++;
    if (marks) _read = true;
  }
}

void main() {
  setUpAll(loadHiFonts);

  Future<void> open(WidgetTester tester, OneNotice account) async {
    usePhone(tester);
    final container = appContainer(location: WorkerRoutes.notifications, account: account);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
  }

  String line(WidgetTester tester) => tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data ?? '')
      .singleWhere((t) => t.startsWith('E2E Kafe · '));

  testWidgets('A12: a new shift with no distance ends at the wage, not in « · »', (tester) async {
    await open(tester, OneNotice());
    final text = line(tester);
    expect(text, endsWith('/soat'));
    expect(text, isNot(endsWith('·')));
  });

  testWidgets('A12: with a distance it ends with it', (tester) async {
    await open(tester, OneNotice(km: 1.2));
    expect(line(tester), endsWith('/soat · 1,2 km'));
  });

  testWidgets('A12: a server that keeps nothing read is asked once, not in a loop', (tester) async {
    final account = OneNotice(marks: false);
    await open(tester, account);
    expect(account.markCalls, 1);
  });
}
