// «Hanguk Ish 사장님»: 계정 삭제 under the language list, signed in only
// (Google Play's account-deletion rule; the app has no settings screen).
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/features/employer/login/ba0_login_screen.dart';

import '../../helpers/employer_harness.dart';
import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

class _DeletingAuth extends DemoAuthRepository {
  _DeletingAuth({super.userId});

  int deleted = 0;

  @override
  Future<void> deleteAccount() async {
    deleted++;
    await super.deleteAccount();
  }
}

void main() {
  setUpAll(loadHiFonts);

  testWidgets('BA1 → 언어 → 계정 삭제: asked first, then back to BA0', (tester) async {
    usePhone(tester);
    final auth = _DeletingAuth(userId: 'owner-1');
    final container = employerContainer(overrides: [authRepositoryProvider.overrideWithValue(auth)]);
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel(RegExp('^언어')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('계정 삭제'));
    await tester.pumpAndSettle();
    expect(find.text('계정을 삭제할까요?'), findsOneWidget);
    expect(find.text('사업장과 등록한 근무, 지원 내역, 메시지가 영구적으로 삭제됩니다. 되돌릴 수 없습니다.'), findsOneWidget);

    await tester.tap(find.text('네, 삭제할게요'));
    await tester.pumpAndSettle();
    expect(auth.deleted, 1);
    expect(auth.userId, isNull);
    expect(find.byType(Ba0LoginScreen), findsOneWidget);
  });

  testWidgets('BA0 (not signed in): the language list has no 계정 삭제', (tester) async {
    usePhone(tester);
    final container = employerContainer(
      location: EmployerRoutes.login,
      overrides: [authRepositoryProvider.overrideWithValue(_DeletingAuth())],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel(RegExp('^언어')));
    await tester.pumpAndSettle();
    expect(find.text('한국어'), findsWidgets);
    expect(find.text('계정 삭제'), findsNothing);
  });
}
