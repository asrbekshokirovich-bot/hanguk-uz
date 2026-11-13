import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/worker_app.dart';
import 'package:hanguk_ish/data/repositories/auth_repository.dart';
import 'package:hanguk_ish/features/worker/onboarding/a01_login_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';
import '../../helpers/worker_harness.dart';

/// Records the deletion (Google Play's account-deletion rule).
class _DeletingAuth extends DemoAuthRepository {
  _DeletingAuth() : super(userId: 'u1');

  int deleted = 0;

  @override
  Future<void> deleteAccount() async {
    deleted++;
    await super.deleteAccount();
  }
}

void main() {
  setUpAll(loadHiFonts);

  testWidgets('A11 → Yordam → «Akkauntni o\'chirish»: asked first, then gone to the start', (tester) async {
    usePhone(tester);
    final auth = _DeletingAuth();
    final container = appContainer(location: WorkerRoutes.me, overrides: [authRepositoryProvider.overrideWithValue(auth)]);
    addTearDown(container.dispose);
    await tester.pumpWidget(appHarness(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yordam'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text("Akkauntni o'chirish"));
    await tester.tap(find.text("Akkauntni o'chirish"));
    await tester.pumpAndSettle();
    expect(find.text("Akkauntni o'chirasizmi?"), findsOneWidget);

    // «Orqaga» keeps the account.
    await tester.tap(find.text('Orqaga'));
    await tester.pumpAndSettle();
    expect(auth.deleted, 0);

    await tester.ensureVisible(find.text("Akkauntni o'chirish"));
    await tester.tap(find.text("Akkauntni o'chirish"));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Ha, o'chirish"));
    await tester.pumpAndSettle();
    expect(auth.deleted, 1);
    expect(auth.userId, isNull);
    expect(find.text("Akkauntingiz o'chirildi."), findsOneWidget);
    expect(find.byType(A01LoginScreen), findsOneWidget);
  });
}
