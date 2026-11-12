// A12: each notification's link leads where it says — the reminder's
// «Yo'nalish» to the map app, «Smenani ko'rish» to A06, «Ko'rish» to the
// shift, the feed, the chat or the earnings.
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/core/links/directions.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/demo/demo_account.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/repositories/account_repository.dart';
import 'package:hanguk_ish/features/worker/chat/chat_screen.dart';
import 'package:hanguk_ish/features/worker/earnings/earnings_screen.dart';
import 'package:hanguk_ish/features/worker/feed/feed_screen.dart';
import 'package:hanguk_ish/features/worker/my_shifts/my_shifts_screen.dart';
import 'package:hanguk_ish/features/worker/shift/shift_detail_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// An account whose A12 shows [list].
class _Notices extends DemoAccountRepository {
  _Notices(this.list) : super(now: prototypeNow);

  final List<HiNotification> list;

  @override
  Future<List<HiNotification>> notifications() async => list;
}

const _dalbit = {'uz': 'Dalbit Kafe · Sinchon', 'ko': '달빛카페 · 신촌'};

void main() {
  setUpAll(loadHiFonts);

  DateTime at(int day, int hour) => Kst.instantOf(2026, 11, day, hour, 0);

  Future<void> open(WidgetTester tester, {WorkerAccountRepository? account, LinkOpener? opener}) async {
    usePhone(tester);
    final container = appContainer(
      location: WorkerRoutes.notifications,
      account: account,
      overrides: [if (opener != null) linkOpenerProvider.overrideWithValue(opener)],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();
  }

  Future<void> follow(WidgetTester tester, String label) async {
    await tester.ensureVisible(find.text(label));
    await tester.pumpAndSettle();
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  testWidgets("the reminder's «Yo'nalish» opens the route to the business", (tester) async {
    Uri? opened;
    await open(tester, opener: (uri) async {
      opened = uri;
      return true;
    });
    await follow(tester, "Yo'nalish");
    expect(opened, directionsUriTo('Dalbit Kafe · Sinchon', 37.55798, 126.950147));
  });

  testWidgets("a confirmation's «Smenani ko'rish» opens A06", (tester) async {
    await open(tester);
    await follow(tester, "Smenani ko'rish");
    expect(find.byType(MyShiftsScreen), findsOneWidget);
  });

  testWidgets('a new shift without its id opens the feed', (tester) async {
    await open(tester);
    // The prototype's third notice (Sangam, no shift id); the fourth is «nearby».
    await tester.ensureVisible(find.text("Ko'rish").first);
    await tester.pumpAndSettle();
    await tester.tap(find.text("Ko'rish").first);
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
  });

  testWidgets('«shifts nearby» opens the feed', (tester) async {
    await open(tester);
    await tester.ensureVisible(find.text("Ko'rish").last);
    await tester.pumpAndSettle();
    await tester.tap(find.text("Ko'rish").last);
    await tester.pumpAndSettle();
    expect(find.byType(FeedScreen), findsOneWidget);
  });

  testWidgets('a new shift with its id opens that shift', (tester) async {
    await open(tester, account: _Notices([
      HiNotification(
        id: 'n1',
        kind: NotificationKind.newShift,
        createdAt: at(10, 10),
        businessNames: const {'uz': 'Nanum Tadbir'},
        shiftId: 'demo-5',
        startsAt: at(10, 16),
        endsAt: at(10, 21),
        wage: 13000,
        distanceKm: 2.8,
      ),
    ]));
    await follow(tester, "Ko'rish");
    expect(find.byType(ShiftDetailScreen), findsOneWidget);
    expect(tester.widget<ShiftDetailScreen>(find.byType(ShiftDetailScreen)).shiftId, 'demo-5');
  });

  testWidgets('a shift moved to another time opens it at its new time', (tester) async {
    await open(tester, account: _Notices([
      HiNotification(
        id: 'n2',
        kind: NotificationKind.timeChanged,
        createdAt: at(10, 9),
        businessNames: _dalbit,
        shiftId: 'demo-1',
        startsAt: at(10, 14),
        endsAt: at(10, 19),
      ),
    ]));
    await follow(tester, "Ko'rish");
    expect(tester.widget<ShiftDetailScreen>(find.byType(ShiftDetailScreen)).shiftId, 'demo-1');
  });

  testWidgets('a payment opens the earnings', (tester) async {
    await open(tester, account: _Notices([
      HiNotification(
        id: 'n3',
        kind: NotificationKind.paid,
        createdAt: at(10, 8),
        businessNames: _dalbit,
        startsAt: at(8, 14),
        endsAt: at(8, 19),
        amount: 52500,
      ),
    ]));
    await follow(tester, "Ko'rish");
    expect(find.byType(EarningsScreen), findsOneWidget);
  });

  testWidgets('a message opens the chat of its shift', (tester) async {
    await open(tester, account: _Notices([
      HiNotification(
        id: 'n4',
        kind: NotificationKind.message,
        createdAt: at(10, 11),
        businessNames: _dalbit,
        applicationId: 'app-7',
      ),
    ]));
    await follow(tester, "Ko'rish");
    expect(tester.widget<ChatScreen>(find.byType(ChatScreen)).applicationId, 'app-7');
  });
}
