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
      '시작하기',
    ]) {
      expect(find.text(text), findsOneWidget, reason: text);
    }
    // P49: no phone number (no SMS); P50: no 사업자등록번호 either.
    expect(find.byType(TextField), findsNothing, reason: 'nothing to type');
    expect(find.text('휴대폰 번호'), findsNothing);
    expect(find.text('사업자등록번호'), findsNothing);
  });

  testWidgets('시작하기 waits for the start: one tap, one account', (tester) async {
    usePhone(tester);
    var starts = 0;
    final done = Completer<void>();
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        home: Ba0LoginScreen(onStart: () {
          starts++;
          return done.future;
        }),
      ),
    ));
    await tester.tap(find.text('시작하기'));
    await tester.pump();
    expect(starts, 1);
    HiButton start() => tester.widget<HiButton>(find.widgetWithText(HiButton, '시작하기'));
    expect(start().onPressed, isNull, reason: 'one tap, one account');
    await tester.tap(find.text('시작하기'));
    await tester.pump();
    expect(starts, 1);
    done.complete();
    // The start ends in a microtask; nothing else asks for a frame here (no
    // text field blinking any more), so let it settle.
    await tester.pumpAndSettle();
    expect(start().onPressed, isNotNull);
  });

  testWidgets('fits a short screen without overflow', (tester) async {
    usePhone(tester, TestPhone.small);
    await tester.pumpWidget(const ProviderScope(child: EmployerApp()));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
