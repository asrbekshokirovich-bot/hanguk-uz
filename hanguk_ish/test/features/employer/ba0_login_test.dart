import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/features/employer/login/ba0_login_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

void main() {
  setUpAll(loadHiFonts);

  testWidgets('employer app opens on BA0 with the prototype texts', (tester) async {
    usePhone(tester);
    await tester.pumpWidget(const ProviderScope(child: EmployerApp()));
    await tester.pumpAndSettle();
    for (final text in [
      'Hanguk Ish',
      '사장님용',
      '오늘 필요한 근무자, 바로 구하세요',
      '휴대폰 번호',
      '사업자등록번호',
      '처음 한 번만 입력해요',
      '시작하기',
    ]) {
      expect(find.text(text), findsOneWidget, reason: text);
    }
    expect(find.text('010-0000-0000'), findsOneWidget);
    expect(find.text('000-00-00000'), findsOneWidget);
  });

  testWidgets('numbers are formatted while typing and handed to 시작하기', (tester) async {
    usePhone(tester);
    String? phone;
    String? bizNo;
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        home: Ba0LoginScreen(onStart: (p, b) {
          phone = p;
          bizNo = b;
        }),
      ),
    ));
    final fields = find.byType(TextField);
    expect(fields, findsNWidgets(2));
    await tester.enterText(fields.at(0), '01012345678');
    await tester.enterText(fields.at(1), '1234567890');
    await tester.pump();
    expect(find.text('010-1234-5678'), findsOneWidget);
    expect(find.text('123-45-67890'), findsOneWidget);
    await tester.tap(find.text('시작하기'));
    expect(phone, '010-1234-5678');
    expect(bizNo, '123-45-67890');
  });

  testWidgets('fits a short screen without overflow', (tester) async {
    usePhone(tester, TestPhone.small);
    await tester.pumpWidget(const ProviderScope(child: EmployerApp()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
