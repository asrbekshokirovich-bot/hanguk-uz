import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/employer/ko.dart';

import '../../helpers/employer_harness.dart';
import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

/// The demo business still waiting for 국세청 (BA0 had no key or no
/// answer). Asked again (BA0's function), 국세청 says [answer].
class WaitingEmployer extends DemoEmployerRepository {
  WaitingEmployer({this.answer = BusinessReview.pending})
      : super(now: employerPrototypeNow, clock: () => employerPrototypeNow);

  final BusinessReview answer;
  BusinessReview review = BusinessReview.pending;
  final List<String> asked = [];

  Business get _business => Business(
        id: demoDalbit.id,
        name: demoDalbit.name,
        names: demoDalbit.names,
        area: demoDalbit.area,
        areas: demoDalbit.areas,
        category: demoDalbit.category,
        address: demoDalbit.address,
        addressDetail: demoDalbit.addressDetail,
        lat: demoDalbit.lat,
        lng: demoDalbit.lng,
        logoIcon: demoDalbit.logoIcon,
        review: review,
        bizNo: '1234567891',
      );

  @override
  Future<List<Business>> businesses() async => [_business];

  @override
  Future<Business> registerBusiness(String businessNumber) async {
    asked.add(businessNumber);
    review = answer;
    if (answer == BusinessReview.rejected) throw const ShiftActionException('BUSINESS_CLOSED');
    return _business;
  }
}

void main() {
  setUpAll(loadHiFonts);

  Future<void> open(WidgetTester tester, WaitingEmployer repo) async {
    usePhone(tester);
    final container = employerContainer(repository: repo);
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();
  }

  testWidgets('BA1: a business still waiting says why its shifts reach nobody; asked again once', (tester) async {
    final repo = WaitingEmployer();
    await open(tester, repo);
    expect(find.text(Ko.reviewPendingTitle), findsOneWidget);
    expect(find.text(Ko.reviewPendingText), findsOneWidget);
    expect(find.text('오늘의 근무'), findsOneWidget, reason: 'the home is all there');
    expect(repo.asked, ['1234567891'], reason: '국세청 is asked again once a session');
  });

  testWidgets('BA1: verified when asked again, the notice goes', (tester) async {
    final repo = WaitingEmployer(answer: BusinessReview.verified);
    await open(tester, repo);
    expect(repo.asked, hasLength(1));
    expect(find.text(Ko.reviewPendingTitle), findsNothing);
    expect(find.text(Ko.reviewRejectedTitle), findsNothing);
  });

  testWidgets('BA1: found closed (폐업) when asked again, it says the shifts will not be seen', (tester) async {
    final repo = WaitingEmployer(answer: BusinessReview.rejected);
    await open(tester, repo);
    expect(find.text(Ko.reviewRejectedTitle), findsOneWidget);
    expect(find.text(Ko.reviewRejectedText), findsOneWidget);
    expect(find.text(Ko.reviewPendingTitle), findsNothing);
  });

  testWidgets('BA1: a verified business shows no notice and is not asked again', (tester) async {
    final repo = WaitingEmployer()..review = BusinessReview.verified;
    await open(tester, repo);
    expect(find.text(Ko.reviewPendingTitle), findsNothing);
    expect(repo.asked, isEmpty);
  });
}
