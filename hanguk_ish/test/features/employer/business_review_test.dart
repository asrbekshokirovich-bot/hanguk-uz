import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/employer/biz.dart';

import '../../helpers/employer_harness.dart';
import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

/// The demo business still waiting for 국세청 (BA0 had no key or no
/// answer). Asked again (BA0's function), 국세청 says [answer].
class WaitingEmployer extends DemoEmployerRepository {
  WaitingEmployer({this.answer = BusinessReview.pending, this.bizNo = '1234567891'})
      : super(now: employerPrototypeNow, clock: () => employerPrototypeNow);

  final BusinessReview answer;

  /// Null: opened by «시작하기» without a number (P50).
  final String? bizNo;
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
        bizNo: bizNo,
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
    expect(find.text(Biz.reviewPendingTitle), findsOneWidget);
    expect(find.text(Biz.reviewPendingText), findsOneWidget);
    expect(find.text('오늘의 근무'), findsOneWidget, reason: 'the home is all there');
    expect(repo.asked, ['1234567891'], reason: '국세청 is asked again once a session');
  });

  testWidgets('BA1: verified when asked again, the notice goes', (tester) async {
    final repo = WaitingEmployer(answer: BusinessReview.verified);
    await open(tester, repo);
    expect(repo.asked, hasLength(1));
    expect(find.text(Biz.reviewPendingTitle), findsNothing);
    expect(find.text(Biz.reviewRejectedTitle), findsNothing);
  });

  testWidgets('BA1: found closed (폐업) when asked again, it says the shifts will not be seen', (tester) async {
    final repo = WaitingEmployer(answer: BusinessReview.rejected);
    await open(tester, repo);
    expect(find.text(Biz.reviewRejectedTitle), findsOneWidget);
    expect(find.text(Biz.reviewRejectedText), findsOneWidget);
    expect(find.text(Biz.reviewPendingTitle), findsNothing);
  });

  testWidgets('BA1: opened without a number and suspended by Hanguk (P52), it says so — not 국세청', (tester) async {
    final repo = WaitingEmployer(bizNo: null)..review = BusinessReview.rejected;
    await open(tester, repo);
    expect(find.text(Biz.reviewSuspendedTitle), findsOneWidget);
    expect(find.text(Biz.reviewSuspendedText), findsOneWidget);
    expect(find.text(Biz.reviewRejectedTitle), findsNothing);
    expect(find.textContaining('국세청'), findsNothing);
    expect(repo.asked, isEmpty, reason: 'no number: 국세청 is not asked');
  });

  testWidgets('BA1: let back (verified again), the notice goes', (tester) async {
    final repo = WaitingEmployer(bizNo: null)..review = BusinessReview.verified;
    await open(tester, repo);
    expect(find.text(Biz.reviewSuspendedTitle), findsNothing);
    expect(repo.asked, isEmpty);
  });

  testWidgets('BA1: a verified business shows no notice and is not asked again', (tester) async {
    final repo = WaitingEmployer()..review = BusinessReview.verified;
    await open(tester, repo);
    expect(find.text(Biz.reviewPendingTitle), findsNothing);
    expect(repo.asked, isEmpty);
  });
}
