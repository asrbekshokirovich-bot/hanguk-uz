// «Hanguk Ish 사장님» in four languages (P43): Korean stays the prototype's
// word for word; Uzbek, Russian and English for people who give one another
// work too. The language is chosen on BA0 or BA1 and kept; the phone's
// language comes first when the app speaks it.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/core/time/kst.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/employer/biz.dart';
import 'package:hanguk_ish/features/employer/language.dart';
import 'package:hanguk_ish/features/worker/settings/app_language.dart';

import '../../helpers/employer_harness.dart';
import '../../helpers/fonts.dart';
import '../../helpers/phone.dart';

final _hangul = RegExp('[가-힣]');

/// The string literals of the Dart file at [path] (comments left out).
List<String> _literals(String path) {
  final found = <String>[];
  for (final line in File(path).readAsLinesSync()) {
    String? quote;
    final literal = StringBuffer();
    for (var i = 0; i < line.length; i++) {
      final c = line[i];
      if (quote == null) {
        if (line.startsWith('//', i)) break;
        if (c == "'" || c == '"') quote = c;
        continue;
      }
      if (c == r'\' && i + 1 < line.length) {
        literal.write(line[i + 1] == 'n' ? '\n' : line[i + 1]);
        i++;
      } else if (c == quote) {
        found.add(literal.toString());
        literal.clear();
        quote = null;
      } else {
        literal.write(c);
      }
    }
  }
  return found;
}

/// The Korean the demo data is written in (businesses, shifts, addresses,
/// chat) and the brand («Hanguk Ish 사장님», the 한 tile): shown as they are
/// in every language.
final _koreanData = <String>{
  'Hanguk Ish 사장님', '사장님', '한',
  // Kept in brackets after the translation on purpose: the registration
  // certificate is in Korean («Biznes raqami (사업자등록번호)»).
  '사업자등록번호',
  for (final file in ['demo_employer', 'demo_shifts', 'demo_account'])
    for (final literal in _literals('lib/data/demo/$file.dart'))
      if (_hangul.hasMatch(literal))
        for (final line in literal.split('\n'))
          if (line.trim().isNotEmpty) line.trim(),
}.toList()
  ..sort((a, b) => b.length.compareTo(a.length));

/// Whether [text] has Korean that is not data.
bool _koreanLabel(String text) {
  final t = text.trim();
  if (!_hangul.hasMatch(t) || _koreanData.any((d) => d.contains(t))) return false;
  var rest = t;
  for (final d in _koreanData) {
    rest = rest.replaceAll(d, '');
  }
  return _hangul.hasMatch(rest);
}

/// Every piece of text on the screen, span by span.
List<String> _shownTexts(WidgetTester tester) {
  final out = <String>[];
  void collect(InlineSpan span) {
    if (span is TextSpan) {
      if (span.text case final text? when text.trim().isNotEmpty) out.add(text);
      span.children?.forEach(collect);
    }
  }

  for (final rich in tester.widgetList<RichText>(find.byType(RichText))) {
    collect(rich.text);
  }
  return out;
}

void main() {
  setUpAll(loadHiFonts);
  tearDown(() => Biz.use(AppLanguage.ko));

  group('Biz texts', () {
    final tuesday = Kst.instantOf(2026, 11, 10, 18, 20);

    test('Korean is the prototype\'s, unchanged', () {
      Biz.use(AppLanguage.ko);
      expect(Biz.start, '시작하기');
      expect(Biz.asOf(tuesday), '11월 10일 (화) · 18:20 기준');
      expect(Biz.attention('마감 정리 보조', noShows: 1, open: 1, waiting: 2), '마감 정리 보조 · 미출근 1명, 빈자리 1 (지원자 2명)');
      expect(Biz.crewLine(3, 4, 2), '확정 3/4명 · 지원자 2');
      expect(Biz.costLead(3, 300), '3명 · 5시간 · 예상 인건비 ');
      expect(Biz.duration(270), '4시간 30분');
      expect(Biz.money(157500), '157,500원');
      expect(Biz.shiftTerms(10500, 1, 3, true), '시급 10,500원 · 확정 1/3명 · 자동 확정 켜짐');
      expect(Biz.range(DateTime(2026, 10, 27), DateTime(2026, 11, 2)), '10월 27일–11월 2일');
      expect(Biz.range(DateTime(2026, 11, 1), DateTime(2026, 11, 10)), '11월 1일–10일');
      expect(Biz.bell(0), '알림');
      expect(Biz.bell(2), '알림 2건');
      expect(Biz.urgentSlots(1), '긴급 1자리');
      expect(Biz.topik(0), 'TOPIK 없음');
      expect(Biz.weekdayLong(tuesday), '화요일');
      expect(Biz.dotDate(Kst.instantOf(2026, 11, 12, 9)), '11.12');
      expect(Biz.error(const ShiftActionException('SHIFT_FULL')), '자리가 모두 찼어요');
      expect(Biz.spokenLanguage('uz'), '우즈베크어');
    });

    test('Uzbek', () {
      Biz.use(AppLanguage.uz);
      expect(Biz.start, 'Boshlash');
      expect(Biz.asOf(tuesday), '10-noyabr (Se) · 18:20 holatiga');
      expect(Biz.attention('Yopilish', noShows: 1, open: 1, waiting: 2), "Yopilish · 1 kishi kelmadi, 1 ta bo'sh joy (2 ta ariza)");
      expect(Biz.crewLine(3, 4, 0), 'Tasdiqlangan 3/4');
      expect(Biz.duration(270), '4 soat 30 daq');
      expect(Biz.money(157500), '157,500 won');
      expect(Biz.range(DateTime(2026, 11, 1), DateTime(2026, 11, 10)), '1–10-noyabr');
      expect(Biz.range(DateTime(2026, 10, 27), DateTime(2026, 11, 2)), '27-oktabr – 2-noyabr');
      expect(Biz.dotDate(Kst.instantOf(2026, 11, 12, 9)), '12.11');
      expect(Biz.dayWord(Kst.instantOf(2026, 11, 11, 9), tuesday), 'Ertaga');
      expect(Biz.dayWord(Kst.instantOf(2026, 11, 13, 9), tuesday), '13-noyabr (Ju)');
      expect(Biz.weekdayLong(tuesday), 'Seshanba');
      expect(Biz.error(const OfflineException()), 'Internet aloqasini tekshiring');
      expect(Biz.spokenLanguage('ru'), 'Ruscha');
    });

    test('Russian plurals and English', () {
      Biz.use(AppLanguage.ru);
      expect(Biz.people(1), '1 человек');
      expect(Biz.people(3), '3 человека');
      expect(Biz.people(5), '5 человек');
      expect(Biz.urgentSlots(2), 'Срочно: 2 места');
      expect(Biz.range(DateTime(2026, 11, 1), DateTime(2026, 11, 10)), '1–10 ноября');
      Biz.use(AppLanguage.en);
      expect(Biz.people(1), '1 person');
      expect(Biz.people(4), '4 people');
      expect(Biz.bell(1), '1 notification');
      expect(Biz.range(DateTime(2026, 10, 27), DateTime(2026, 11, 2)), 'Oct 27 – Nov 2');
      expect(Biz.dotDate(Kst.instantOf(2026, 11, 12, 9)), '11/12');
      expect(Biz.money(10500), '10,500 KRW');
    });

    test('the small parts: units, the weekday under a date, the headcount box', () {
      Biz.use(AppLanguage.ko);
      expect(Biz.unitAfter('명'), '명');
      expect(Biz.headcountValue(3), '3명');
      expect(Biz.weekdayUnderDate(tuesday), '화요일');
      Biz.use(AppLanguage.uz);
      expect(Biz.unitAfter('kishi'), ' kishi');
      expect(Biz.unitAfter(''), '');
      expect(Biz.headcountValue(3), '3 kishi');
      expect(Biz.weekdayUnderDate(tuesday), 'Se');
      Biz.use(AppLanguage.ru);
      expect(Biz.headcountValue(3), '3 чел.');
      expect(Biz.weekdayUnderDate(tuesday), 'Вт');
      Biz.use(AppLanguage.en);
      expect(Biz.headcountValue(3), '3');
      expect(Biz.weekdayUnderDate(tuesday), 'Tue');
    });

    test('the phone\'s language comes first when the app speaks it, else Korean', () {
      expect(employerLanguageFor(const [Locale('ru', 'RU'), Locale('ko')]), AppLanguage.ru);
      expect(employerLanguageFor(const [Locale('de'), Locale('uz')]), AppLanguage.uz);
      expect(employerLanguageFor(const [Locale('de')]), AppLanguage.ko);
      expect(employerLanguageFor(const []), AppLanguage.ko);
    });

    test('the screens have no Korean of their own: it is all in Biz', () {
      final found = <String>[];
      for (final file in Directory('lib/features/employer').listSync(recursive: true).whereType<File>()) {
        if (!file.path.endsWith('.dart') || file.path.endsWith('/biz.dart')) continue;
        for (final literal in _literals(file.path)) {
          // The BA0 watermark is the brand («Hanguk Ish 사장님»).
          if (_hangul.hasMatch(literal) && literal != '사장님') found.add('${file.path}: $literal');
        }
      }
      expect(found, isEmpty);
    });
  });

  group('the app', () {
    Future<ProviderContainer> open(WidgetTester tester, String location,
        {AppLanguage? language, TestPhone phone = TestPhone.prototype}) async {
      usePhone(tester, phone);
      final container = employerContainer(
        location: location,
        overrides: [if (language != null) employerDefaultLanguageProvider.overrideWithValue(language)],
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(employerHarness(container));
      await tester.pumpAndSettle();
      return container;
    }

    testWidgets('Korean by default, as the prototype', (tester) async {
      await open(tester, EmployerRoutes.login);
      expect(find.text('시작하기'), findsOneWidget);
      expect(find.text('휴대폰 번호'), findsOneWidget);
    });

    testWidgets('BA0: the badge stands beside the name, as in the prototype', (tester) async {
      await open(tester, EmployerRoutes.login);
      final title = tester.getRect(find.text('Hanguk Ish'));
      final badge = tester.getRect(find.text('사장님용'));
      expect(badge.left, greaterThan(title.right), reason: 'on the same line, after the name');
      expect((badge.center.dy - title.center.dy).abs(), lessThan(6));
    });

    testWidgets('BA0: the globe changes the language at once and keeps it', (tester) async {
      final container = await open(tester, EmployerRoutes.login);
      await tester.tap(find.bySemanticsLabel(RegExp('^언어')));
      await tester.pumpAndSettle();
      await tester.tap(find.text("O'zbekcha"));
      await tester.pumpAndSettle();
      expect(find.text('Boshlash'), findsOneWidget);
      expect(find.text('Telefon raqam'), findsOneWidget);
      expect(find.text('Ish beruvchi'), findsOneWidget);
      expect(find.text('시작하기'), findsNothing);
      expect(container.read(employerLanguageProvider), AppLanguage.uz);
      expect(container.read(languageStoreProvider).load(), AppLanguage.uz, reason: 'kept for the next launch');
    });

    testWidgets('BA1 in Russian; the globe there switches to English', (tester) async {
      await open(tester, EmployerRoutes.home, language: AppLanguage.ru);
      expect(find.text('Смены сегодня'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(RegExp('^Язык')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();
      expect(find.text("Today's shifts"), findsOneWidget);
      expect(find.text('Смены сегодня'), findsNothing);
      expect(_shownTexts(tester).where(_koreanLabel), isEmpty);
    });

    final screens = [
      EmployerRoutes.login,
      EmployerRoutes.code('010-1234-5678', '123-45-67891'),
      EmployerRoutes.home,
      EmployerRoutes.create,
      EmployerRoutes.invite('demo-w-jasur'),
      EmployerRoutes.shift('demo-es-close'),
      EmployerRoutes.shift('demo-es-open'),
      EmployerRoutes.shift('demo-es-p1'),
      EmployerRoutes.edit('demo-es-hall'),
      EmployerRoutes.workers,
      EmployerRoutes.report,
      EmployerRoutes.notifications,
    ];
    // Tall enough for the lists to build every row.
    const tall = TestPhone('tall', Size(390, 4000), top: 47, bottom: 34);
    for (final language in [AppLanguage.uz, AppLanguage.ru, AppLanguage.en]) {
      testWidgets('every screen speaks ${language.code}: no Korean label is left', (tester) async {
        final left = <String>[];
        for (final location in screens) {
          await open(tester, location, language: language, phone: tall);
          left.addAll(_shownTexts(tester).where(_koreanLabel).map((t) => '$location: $t'));
          await tester.pumpWidget(const SizedBox());
        }
        expect(left, isEmpty);
      });
    }

    testWidgets('BA5 in English: a short weekday under the date, a space before the unit', (tester) async {
      await open(tester, EmployerRoutes.report, language: AppLanguage.en, phone: tall);
      expect(find.text('Tue'), findsWidgets);
      expect(find.textContaining('105,000 KRW', findRichText: true), findsOneWidget);
    });

    testWidgets('BA1 in Uzbek: «1 kishi» with a space', (tester) async {
      await open(tester, EmployerRoutes.home, language: AppLanguage.uz);
      expect(find.textContaining('1 kishi', findRichText: true), findsWidgets);
    });

    testWidgets('BA3 in English', (tester) async {
      await open(tester, EmployerRoutes.shift('demo-es-close'), language: AppLanguage.en, phone: tall);
      expect(find.textContaining('/h · confirmed 3/4'), findsOneWidget);
      expect(find.text('Applicants: 2'), findsOneWidget);
      expect(find.text('Confirm them yourself'), findsOneWidget);
      expect(find.text('Attendance'), findsOneWidget);
    });
  });
}
