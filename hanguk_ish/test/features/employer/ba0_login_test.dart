import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/design/widgets/buttons.dart';
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
      '사업자등록번호',
      '처음 한 번만 입력해요',
      '시작하기',
    ]) {
      expect(find.text(text), findsOneWidget, reason: text);
    }
    // P49: no phone number (there is no SMS any more).
    expect(find.text('휴대폰 번호'), findsNothing);
    expect(find.text('010-0000-0000'), findsNothing);
    expect(find.text('000-00-00000'), findsOneWidget);
  });

  testWidgets('the number is formatted while typing and handed to 시작하기, which waits for it', (tester) async {
    usePhone(tester);
    String? bizNo;
    final done = Completer<void>();
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        home: Ba0LoginScreen(onStart: (b) {
          bizNo = b;
          return done.future;
        }),
      ),
    ));
    final fields = find.byType(TextField);
    expect(fields, findsOneWidget);
    await tester.enterText(fields, '1234567890');
    await tester.pump();
    expect(find.text('123-45-67890'), findsOneWidget);
    await tester.tap(find.text('시작하기'));
    await tester.pump();
    expect(bizNo, '123-45-67890');
    HiButton start() => tester.widget<HiButton>(find.widgetWithText(HiButton, '시작하기'));
    expect(start().onPressed, isNull, reason: 'one tap, one account');
    done.complete();
    await tester.pump();
    expect(start().onPressed, isNotNull);
  });

  testWidgets('fits a short screen without overflow', (tester) async {
    usePhone(tester, TestPhone.small);
    await tester.pumpWidget(const ProviderScope(child: EmployerApp()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
