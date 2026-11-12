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
      '휴대폰 번호',
      '시작하기',
    ]) {
      expect(find.text(text), findsOneWidget, reason: text);
    }
    expect(find.text('010-0000-0000'), findsOneWidget);
    // P54: the phone (SMS code) only; P50: no 사업자등록번호.
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('사업자등록번호'), findsNothing);
  });

  testWidgets('the number is formatted while typing and handed to 시작하기 once', (tester) async {
    usePhone(tester);
    final phones = <String>[];
    final done = Completer<void>();
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        home: Ba0LoginScreen(onStart: (phone) {
          phones.add(phone);
          return done.future;
        }),
      ),
    ));
    await tester.enterText(find.byType(TextField), '01012345678');
    await tester.pump();
    expect(find.text('010-1234-5678'), findsOneWidget);
    await tester.tap(find.text('시작하기'));
    await tester.pump();
    expect(phones, ['010-1234-5678']);
    HiButton start() => tester.widget<HiButton>(find.widgetWithText(HiButton, '시작하기'));
    expect(start().onPressed, isNull, reason: 'one tap, one code');
    await tester.tap(find.text('시작하기'));
    await tester.pump();
    expect(phones, hasLength(1));
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
