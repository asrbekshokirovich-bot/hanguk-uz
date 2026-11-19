import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart' show HiButton;

import '../../helpers/employer_harness.dart';
import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

/// BA6 «프로필»: the owner's own page, its edit form and its help.
void main() {
  setUpAll(loadHiFonts);

  Future<DemoEmployerRepository> open(WidgetTester tester, {String location = EmployerRoutes.profile}) async {
    final repo = DemoEmployerRepository(now: employerPrototypeNow, clock: () => employerPrototypeNow);
    final container = employerContainer(location: location, repository: repo);
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();
    return repo;
  }

  Future<void> scrollTo(WidgetTester tester, Finder finder) async {
    await tester.scrollUntilVisible(finder, 200, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
  }

  testWidgets('the menu has a profile tab: the business, this month, the settings', (tester) async {
    usePhone(tester);
    await open(tester, location: EmployerRoutes.home);
    expect(find.text('프로필'), findsOneWidget, reason: 'the fifth place of the menu');
    await tester.tap(find.text('프로필'));
    await tester.pumpAndSettle();
    expect(find.text('프로필'), findsNWidgets(2), reason: 'the menu and the title');
    expect(find.text('달빛카페 신촌점'), findsWidgets);
    expect(find.text('확인됨'), findsOneWidget);
    for (final text in ['근로자 평가', '완료한 근무', '이번 달', '근무', '근로자', '인건비', '사업장 정보 수정']) {
      expect(find.text(text), findsWidgets, reason: text);
    }
    await scrollTo(tester, find.text('로그아웃'));
    for (final text in ['단골 근로자', '도움말', '로그아웃']) {
      expect(find.text(text), findsWidgets, reason: text);
    }
  });

  testWidgets('the business details are edited from the profile', (tester) async {
    usePhone(tester);
    final repo = await open(tester);
    await tester.tap(find.text('사업장 정보 수정'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, '달빛카페 신촌점',
        reason: 'the form starts with what is there');
    expect(find.text('취소'), findsOneWidget, reason: 'cancel, not «later»');
    await tester.enterText(find.byType(TextField).first, '달빛카페 홍대점');
    await tester.tap(find.widgetWithText(HiButton, '저장하기'));
    await tester.pumpAndSettle();
    expect((await repo.businesses()).single.name, '달빛카페 홍대점');
    expect(find.text('저장했어요.'), findsOneWidget);
    expect(find.text('달빛카페 홍대점'), findsWidgets, reason: 'back on the profile');
  });

  testWidgets('help answers three questions; signing out asks first', (tester) async {
    usePhone(tester);
    await open(tester);
    await scrollTo(tester, find.text('도움말'));
    await tester.tap(find.text('도움말'));
    await tester.pumpAndSettle();
    expect(find.text('근무는 어떻게 올리나요?'), findsOneWidget);
    expect(find.text('근로자가 왔는지 어떻게 아나요?'), findsOneWidget);
    expect(find.text('근로자에게 문제가 있으면요?'), findsOneWidget);
    await tester.tap(find.text('닫기'));
    await tester.pumpAndSettle();

    await scrollTo(tester, find.text('로그아웃'));
    await tester.tap(find.text('로그아웃'));
    await tester.pumpAndSettle();
    expect(find.text('로그아웃할까요?'), findsOneWidget);
    await tester.tap(find.text('취소'));
    await tester.pumpAndSettle();
    expect(find.text('로그아웃할까요?'), findsNothing);
  });
}
