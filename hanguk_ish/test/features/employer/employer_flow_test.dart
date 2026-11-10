import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/demo/demo_shifts.dart';
import 'package:hanguk_ish/data/models/shift.dart';

import '../../helpers/employer_harness.dart';
import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

void main() {
  setUpAll(loadHiFonts);

  Future<DemoEmployerRepository> open(
    WidgetTester tester, {
    String location = EmployerRoutes.home,
    RecordingSharer? sharer,
  }) async {
    final repo = DemoEmployerRepository(now: employerPrototypeNow, clock: () => employerPrototypeNow);
    final container = employerContainer(location: location, repository: repo, sharer: sharer);
    addTearDown(container.dispose);
    await tester.pumpWidget(employerHarness(container));
    await tester.pumpAndSettle();
    return repo;
  }

  Future<void> tapText(WidgetTester tester, String text, {bool rich = false}) async {
    final finder = find.text(text, findRichText: rich);
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  testWidgets('BA0 → code → BA1: the numbers are needed, then the SMS code, then the home', (tester) async {
    usePhone(tester);
    await open(tester, location: EmployerRoutes.login);
    await tester.tap(find.text('시작하기'));
    await tester.pumpAndSettle();
    expect(find.text('휴대폰 번호와 사업자등록번호를 모두 입력해 주세요'), findsOneWidget);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '01012345678');
    await tester.enterText(fields.at(1), '1234567890');
    await tester.tap(find.text('시작하기'));
    await tester.pumpAndSettle();
    expect(find.text('사업자등록번호를 확인해 주세요'), findsOneWidget, reason: 'the check digit is wrong');
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(1), '1234567891');
    await tester.tap(find.text('시작하기'));
    await tester.pumpAndSettle();

    expect(find.text('인증번호 입력'), findsOneWidget);
    expect(find.text('010-1234-5678 번호로 보낸 6자리 숫자를 입력해 주세요.'), findsOneWidget);
    expect(find.text('1:00 후 다시 받을 수 있어요'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    expect(find.text('오늘의 근무'), findsOneWidget);
  });

  testWidgets('BA1 shows the prototype\'s day', (tester) async {
    usePhone(tester);
    await open(tester);
    for (final text in [
      '달빛카페 신촌점',
      '오늘의 근무',
      '11월 10일 (화) · 18:20 기준',
      '확인이 필요해요',
      '마감 정리 보조 · 미출근 1명, 빈자리 1 (지원자 2명)',
      '지원자 확인하기',
      '오늘 근무',
      '8/9',
      '남은 자리',
      '오픈 바리스타 보조',
      '확정 2/2명',
      '완료',
      '확정 3/3명',
      '진행 중',
      '확정 3/4명 · 지원자 2',
      '긴급',
      '홈',
      '근무자',
      '근무 올리기',
      '리포트',
    ]) {
      expect(find.text(text), findsWidgets, reason: text);
    }
    expect(find.text('3건', findRichText: true), findsOneWidget);
    expect(find.text('1명', findRichText: true), findsOneWidget);
    expect(find.bySemanticsLabel('알림 2건'), findsOneWidget);
  });

  testWidgets('applicants: confirm one, the shift fills and the other is turned down', (tester) async {
    usePhone(tester);
    final repo = await open(tester);
    await tapText(tester, '지원자 확인하기');
    expect(find.text('지원자 2명'), findsOneWidget);
    expect(find.text('직접 확정해 주세요'), findsOneWidget);
    expect(find.text('Aruzhan Bekova'), findsOneWidget);
    expect(find.text('근무 31회'), findsOneWidget);
    expect(find.text('TOPIK 3급'), findsOneWidget);
    expect(find.text('카자흐어 · 러시아어 · 영어 · 한국어'), findsOneWidget);
    expect(find.text('출근 17:56'), findsOneWidget);
    expect(find.text('지각 2분'), findsOneWidget);
    expect(find.text('미출근 · 20분'), findsOneWidget);
    expect(find.text('긴급 1자리'), findsOneWidget);

    await tester.tap(find.text('확정').first);
    await tester.pumpAndSettle();
    expect(find.text('Aruzhan Bekova님을 확정했어요'), findsOneWidget);
    expect(find.text('지원자 2명'), findsNothing);
    expect(find.text('긴급 1자리'), findsNothing);
    expect(find.text('오늘 18:00–22:00 · 4시간\n시급 11,000원 · 확정 4/4명 · 자동 확정 꺼짐'), findsOneWidget);
    final close = (await repo.shift('demo-es-close'))!;
    expect(close.confirmed, 4);
    expect(close.applicants.where((a) => a.status == ApplicationStatus.rejected).single.worker.fullName, 'Sevara Nazarova');
    // The new worker is on the attendance list, not in yet.
    expect(find.text('Aruzhan Bekova'), findsOneWidget);

    // Back home: the attention card is gone (Aibek is still missing).
    await tester.tap(find.bySemanticsLabel('뒤로'));
    await tester.pumpAndSettle();
    expect(find.text('9/9'), findsOneWidget);
    expect(find.text('마감 정리 보조 · 미출근 1명'), findsOneWidget);
    expect(find.text('근무 확인하기'), findsOneWidget);
  });

  testWidgets('applicants: turning one down keeps the place', (tester) async {
    usePhone(tester);
    final repo = await open(tester, location: EmployerRoutes.shift('demo-es-close'));
    await tester.tap(find.text('거절').last);
    await tester.pumpAndSettle();
    expect(find.text('Sevara Nazarova님의 지원을 거절했어요'), findsOneWidget);
    expect(find.text('지원자 1명'), findsOneWidget);
    expect((await repo.shift('demo-es-close'))!.confirmed, 3);
  });

  testWidgets('QR 인쇄·공유 hands a PNG of the shift\'s code to the share sheet', (tester) async {
    usePhone(tester);
    final sharer = RecordingSharer();
    await open(tester, location: EmployerRoutes.shift('demo-es-close'), sharer: sharer);
    await tester.scrollUntilVisible(find.text('QR 인쇄·공유'), 300, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      await tester.tap(find.text('QR 인쇄·공유'));
      await Future<void>.delayed(const Duration(milliseconds: 500));
    });
    await tester.pumpAndSettle();
    expect(sharer.shared, hasLength(1));
    final file = sharer.shared.single;
    expect(file.mimeType, 'image/png');
    expect(file.bytes.sublist(1, 4), 'PNG'.codeUnits);
    expect(file.text, '달빛카페 신촌점 · 마감 정리 보조 · 11월 10일 18:00–22:00 출퇴근 QR');
  });

  testWidgets('BA2: post a shift from a template; it shows on the home', (tester) async {
    usePhone(tester);
    final repo = await open(tester);
    await tester.tap(find.text('근무 올리기').last);
    await tester.pumpAndSettle();
    expect(find.text('템플릿'), findsOneWidget);
    expect(find.text('주문 접수 · 음료 보조 · 홀 정리'), findsOneWidget);
    expect(find.text('14:00'), findsOneWidget);
    expect(find.text('19:00'), findsOneWidget);
    expect(find.text('5시간'), findsOneWidget);
    expect(find.text('3명'), findsOneWidget);
    expect(find.text('최저시급 10,320원 이상'), findsOneWidget);
    expect(find.text('3명 · 5시간 · 예상 인건비 157,500원', findRichText: true), findsOneWidget);

    // Another template fills the form with its own times and wage.
    await tester.tap(find.text('마감 정리 보조'));
    await tester.pumpAndSettle();
    expect(find.text('18:00'), findsOneWidget);
    expect(find.text('4명'), findsOneWidget);
    expect(find.text('4명 · 4시간 · 예상 인건비 176,000원', findRichText: true), findsOneWidget);

    // A wage under the legal minimum is flagged and refused.
    await tester.enterText(find.byType(TextField), '9900');
    await tester.pumpAndSettle();
    expect(find.text('최저시급 10,320원보다 낮아요'), findsOneWidget);
    await tester.tap(find.text('근무 올리기').last);
    await tester.pumpAndSettle();
    expect(find.text('최저시급 10,320원보다 낮아요'), findsNWidgets(2));
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '11500');
    await tester.pumpAndSettle();
    expect(find.text('11,500'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('인원 줄이기'));
    await tester.pumpAndSettle();
    expect(find.text('3명'), findsOneWidget);
    await tester.tap(find.text('목 11.12', findRichText: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('근무 올리기').last);
    await tester.pumpAndSettle();
    expect(find.text('근무를 올렸어요'), findsOneWidget);
    expect(find.text('오늘의 근무'), findsOneWidget);
    expect(find.text('다가오는 근무'), findsOneWidget);
    expect(find.text('11월 12일 (목) · 확정 0/3명'), findsOneWidget);
    final posted = (await repo.shifts(demoDalbit.id, Kst.instantOf(2026, 11, 12), Kst.instantOf(2026, 11, 13))).single;
    expect(posted.hourlyWage, 11500);
    expect(posted.slots, 3);
    expect(Kst.hm(posted.startsAt), '18:00');
  });

  testWidgets('BA2: start and end times from the lists', (tester) async {
    usePhone(tester);
    await open(tester, location: EmployerRoutes.create);
    await tester.tap(find.bySemanticsLabel('종료 시간 19:00'));
    await tester.pumpAndSettle();
    // The list opens around the current end time.
    expect(find.text('18:00'), findsOneWidget);
    await tester.tap(find.text('21:30'));
    await tester.pumpAndSettle();
    expect(find.text('7시간 30분'), findsOneWidget);
    expect(find.text('3명 · 7시간 30분 · 예상 인건비 236,250원', findRichText: true), findsOneWidget);
  });

  testWidgets('BA2: editing the template content', (tester) async {
    usePhone(tester);
    await open(tester, location: EmployerRoutes.create);
    await tester.tap(find.text('수정'));
    await tester.pumpAndSettle();
    expect(find.text('템플릿 수정'), findsOneWidget);
    await tester.enterText(find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextField)).at(2), '흰 셔츠, 검은 바지');
    await tester.tap(find.text('저장하기'));
    await tester.pumpAndSettle();
    expect(find.text('흰 셔츠, 검은 바지'), findsOneWidget);
    expect(find.text('템플릿을 저장했어요'), findsOneWidget);
  });

  testWidgets('BA3 수정: the form opens with the shift; places cannot drop below the crew', (tester) async {
    usePhone(tester);
    await open(tester, location: EmployerRoutes.shift('demo-es-close'));
    await tester.tap(find.text('수정'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('근무 수정'));
    await tester.pumpAndSettle();
    expect(find.text('근무 수정'), findsOneWidget);
    expect(find.text('4명'), findsOneWidget);
    expect(find.text('11,000'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('인원 줄이기'));
    await tester.pumpAndSettle();
    expect(find.text('3명'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('인원 줄이기'));
    await tester.pumpAndSettle();
    expect(find.text('3명'), findsOneWidget);
    expect(find.text('이미 3명이 확정돼서 더 줄일 수 없어요'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('시작 시간 18:00'));
    await tester.pumpAndSettle();
    expect(find.text('확정된 근무자가 있어 날짜와 시간은 바꿀 수 없어요'), findsWidgets);
    await tester.tap(find.bySemanticsLabel('인원 늘리기'));
    await tester.tap(find.bySemanticsLabel('인원 늘리기'));
    // The message bar covers the button until it goes.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.tap(find.text('저장하기'));
    await tester.pumpAndSettle();
    expect(find.text('근무를 수정했어요'), findsOneWidget);
    expect(find.text('오늘 18:00–22:00 · 4시간\n시급 11,000원 · 확정 3/5명 · 자동 확정 꺼짐'), findsOneWidget);
  });

  testWidgets('BA4: favourites, the recent list, search, ★ and 다시 요청', (tester) async {
    usePhone(tester);
    final repo = await open(tester, location: EmployerRoutes.workers);
    expect(find.text('즐겨찾기 6', findRichText: true), findsOneWidget);
    expect(find.text('최근 근무자 18', findRichText: true), findsOneWidget);
    expect(find.text('Aziz Karimov'), findsOneWidget);
    expect(find.text('우리 매장 7회 · TOPIK 4급'), findsOneWidget);
    expect(find.text('Bekzod Aliev'), findsNothing);

    await tester.tap(find.text('최근 근무자 18', findRichText: true));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'bek');
    await tester.pumpAndSettle();
    expect(find.text('Bekzod Aliev'), findsOneWidget);
    expect(find.text('Aziz Karimov'), findsNothing);
    await tester.tap(find.bySemanticsLabel('Bekzod Aliev 즐겨찾기 추가'));
    await tester.pumpAndSettle();
    expect(find.text('즐겨찾기 7', findRichText: true), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();
    expect(find.text('검색 결과가 없어요'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '');
    await tester.pumpAndSettle();

    await tester.tap(find.text('즐겨찾기 7', findRichText: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('다시 요청').first);
    await tester.pumpAndSettle();
    expect(find.text('근무 올리기'), findsWidgets);
    await tester.tap(find.text('목 11.12', findRichText: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('근무 올리기').last);
    await tester.pumpAndSettle();
    expect(find.text('Aziz Karimov님에게 요청을 보냈어요'), findsOneWidget);
    expect(repo.invitations.single.$2, 'demo-w-aziz6');
  });

  testWidgets('BA5: periods, paid marks and the CSV', (tester) async {
    usePhone(tester);
    final sharer = RecordingSharer();
    await open(tester, location: EmployerRoutes.report, sharer: sharer);
    expect(find.text('11월 1일–10일 총 지급액'), findsOneWidget);
    expect(find.text('1,262,500원', findRichText: true), findsOneWidget);
    expect(find.text('근무 9건 · 117시간 · 연인원 23명'), findsOneWidget);
    expect(find.text('지급 완료 · 7건'), findsOneWidget);
    expect(find.text('1,000,000원', findRichText: true), findsOneWidget);
    expect(find.text('지급 대기 · 2건'), findsOneWidget);
    expect(find.text('262,500원', findRichText: true), findsOneWidget);
    expect(find.text('9건'), findsOneWidget);

    await tester.tap(find.text('CSV 다운로드'));
    await tester.pumpAndSettle();
    expect(sharer.shared.single.mimeType, 'text/csv');
    expect(sharer.shared.single.fileName, 'hanguk-ish-report-2026-11-01.csv');
    expect(sharer.shared.single.text, '달빛카페 신촌점 리포트 11월 1일–10일');

    await tester.tap(find.text('오픈 바리스타 보조').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('지급 완료로 표시'));
    await tester.pumpAndSettle();
    expect(find.text('지급 완료 · 8건'), findsOneWidget);
    expect(find.text('157,500원', findRichText: true), findsWidgets);

    await tester.tap(find.text('이번 주'));
    await tester.pumpAndSettle();
    expect(find.text('11월 9일–10일 총 지급액'), findsOneWidget);
    expect(find.text('2건'), findsOneWidget);
    await tester.tap(find.text('지난달'));
    await tester.pumpAndSettle();
    expect(find.text('10월 1일–31일 총 지급액'), findsOneWidget);
    expect(find.text('지급 대기 · 0건'), findsOneWidget);
  });

  testWidgets('the bell: notifications open and the mark goes away', (tester) async {
    usePhone(tester);
    await open(tester);
    await tester.tap(find.bySemanticsLabel('알림 2건'));
    await tester.pumpAndSettle();
    expect(find.text('알림'), findsOneWidget);
    expect(find.text('Sevara Nazarova님이 마감 정리 보조에 지원했어요'), findsOneWidget);
    expect(find.text('어제'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('뒤로'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('알림'), findsOneWidget);
  });

  testWidgets('menu tabs keep their place', (tester) async {
    usePhone(tester);
    await open(tester);
    await tester.tap(find.text('근무자'));
    await tester.pumpAndSettle();
    expect(find.text('즐겨찾기 6', findRichText: true), findsOneWidget);
    await tester.tap(find.text('리포트'));
    await tester.pumpAndSettle();
    expect(find.text('CSV 다운로드'), findsOneWidget);
    await tester.tap(find.text('홈'));
    await tester.pumpAndSettle();
    expect(find.text('오늘의 근무'), findsOneWidget);
    expect(prototypeNow.isBefore(employerPrototypeNow), isTrue);
  });
}
