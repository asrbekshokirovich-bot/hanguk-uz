import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/university_choices/data/university_choices_repository.dart';
import 'package:hanguk_app/features/university_choices/domain/university_choice.dart';
import 'package:hanguk_app/features/university_choices/presentation/university_choices_entry.dart';
import 'package:hanguk_app/features/university_choices/presentation/university_choices_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

UniversityChoice choice(
  String id,
  int rank,
  UniversityChoiceStatus status, {
  String name = 'Kyungpook National University',
  bool partner = false,
  double? ieltsMin = 6,
  double? studentIelts = 6,
  AdmissionOutcome? outcome,
  bool isFinal = false,
  bool finalConfirmed = false,
}) => UniversityChoice(
  id: id,
  rank: rank,
  status: status,
  name: name,
  city: 'Daegu',
  isPartner: partner,
  ieltsMin: ieltsMin,
  contractMin: 2100000,
  currency: 'KRW',
  studentIelts: studentIelts,
  outcome: outcome,
  isFinal: isFinal,
  finalConfirmed: finalConfirmed,
);

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  group('UniversityChoice', () {
    test('reads the row my_university_choices() returns', () {
      final c = UniversityChoice.fromJson({
        'id': 'c1',
        'rank': 3,
        'status': 'change_requested',
        'name_en': 'Daegu Haany University',
        'name_ko': '대구한의대학교',
        'city': 'Gyeongsan',
        'is_partner': true,
        'ielts_min': '5.5',
        'topik_min': null,
        'kontrakt_min': 3000000,
        'narx_valyuta': 'KRW',
        'online_deadline': '2026-10-21',
        'student_ielts': 6,
        'student_topik': null,
      });
      expect(c.rank, 3);
      expect(c.status, UniversityChoiceStatus.changeRequested);
      expect(c.isPartner, isTrue);
      expect(c.ieltsMin, 5.5);
      expect(c.onlineDeadline, DateTime(2026, 10, 21));
      expect(c.fit, LanguageFit.ok);
      expect(c.canAnswer, isFalse);
    });

    test('language fit: either track is enough; no score or no minimum is unknown', () {
      expect(choice('a', 1, UniversityChoiceStatus.offered, ieltsMin: 6.5).fit, LanguageFit.gap);
      expect(choice('a', 1, UniversityChoiceStatus.offered, ieltsMin: null).fit, LanguageFit.unknown);
      expect(choice('a', 1, UniversityChoiceStatus.offered, studentIelts: null).fit, LanguageFit.unknown);
    });

    test('money keeps the currency sign', () {
      expect(formatMoney(2100000, 'KRW', 'en'), '₩2,100,000');
    });
  });

  Future<void> pump(WidgetTester t, Widget home, List<UniversityChoice> choices) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          myUniversityChoicesProvider.overrideWith((ref) async => choices),
          signedInProvider.overrideWithValue(true),
        ],
        child: MaterialApp(
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: home,
        ),
      ),
    );
    await t.pump();
    await t.pump();
  }

  testWidgets('offers waiting for an answer show both buttons; answered ones show their status', (t) async {
    await pump(t, const UniversityChoicesScreen(), [
      choice('c1', 1, UniversityChoiceStatus.offered),
      choice('c2', 2, UniversityChoiceStatus.accepted, name: 'Pusan National University'),
      choice('c3', 3, UniversityChoiceStatus.confirmed, name: 'Daegu Haany University', partner: true),
    ]);
    expect(find.text('Universitet tanlovi'), findsOneWidget);
    expect(find.text('Tasdiqlashingiz kerak'), findsOneWidget);
    expect(find.text('1 ta universitet javobingizni kutmoqda'), findsOneWidget);
    expect(find.text('1-TANLOV'), findsOneWidget);
    expect(find.text('Roziman'), findsOneWidget);
    expect(find.text("O'zgartirish so'rayman"), findsOneWidget);
    expect(find.text('Konsultant tasdiqlamoqda'), findsOneWidget);
    expect(find.text('Biriktirildi'), findsOneWidget);
    expect(find.text('Hamkor'), findsOneWidget);
    expect(find.text('✓ Balingiz mos'), findsNWidgets(3));
  });

  testWidgets('asking for a change needs a reason before it can be sent', (t) async {
    await pump(t, const UniversityChoicesScreen(), [choice('c1', 1, UniversityChoiceStatus.offered)]);
    await t.tap(find.text("O'zgartirish so'rayman"));
    await t.pumpAndSettle();
    expect(find.text("Nima uchun bu universitet sizga to'g'ri kelmaydi?"), findsOneWidget);
    expect(find.text('Kontrakt narxi qimmat'), findsOneWidget);
    expect(find.text('Konsultantga yuborish'), findsOneWidget);
  });

  testWidgets('results: congratulations, admitted / not admitted, and the final pick to confirm', (t) async {
    await pump(t, const UniversityChoicesScreen(), [
      choice('c1', 1, UniversityChoiceStatus.confirmed, outcome: AdmissionOutcome.accepted, isFinal: true),
      choice('c2', 2, UniversityChoiceStatus.confirmed, name: 'Pusan National University', outcome: AdmissionOutcome.accepted),
      choice('c3', 3, UniversityChoiceStatus.confirmed, name: 'Sejong University', outcome: AdmissionOutcome.rejected),
    ]);
    expect(find.text('Tabriklaymiz!'), findsOneWidget);
    expect(find.text('2 ta universitetga qabul qilindingiz'), findsOneWidget);
    expect(find.text('Qabul qilindingiz 🎓'), findsNWidgets(2));
    expect(find.text('Qabul qilinmadi'), findsOneWidget);
    expect(find.text('Shu universitetga boraman'), findsOneWidget);
  });

  testWidgets('a confirmed final university says so instead of asking again', (t) async {
    await pump(t, const UniversityChoicesScreen(), [
      choice('c1', 1, UniversityChoiceStatus.confirmed, outcome: AdmissionOutcome.accepted, isFinal: true, finalConfirmed: true),
    ]);
    expect(find.text('Shu universitetga boraman'), findsNothing);
    expect(find.text('✓ Siz shu universitetni tanladingiz'), findsOneWidget);
  });

  test('withResult reads my_admission_results rows', () {
    final base = UniversityChoice.fromJson({'id': 'c1', 'rank': 1, 'status': 'confirmed', 'name_en': 'KNU', 'institution_id': 'knu'});
    expect(base.institutionId, 'knu');
    final r = base.withResult({'result': 'accepted', 'is_final': true, 'student_confirmed_at': null});
    expect(r.outcome, AdmissionOutcome.accepted);
    expect(r.needsFinalConfirm, isTrue);
    expect(base.withResult(null).outcome, isNull);
  });

  testWidgets('the journey entry stays hidden without offers', (t) async {
    await pump(t, const Scaffold(body: UniversityChoicesEntry()), const []);
    expect(find.text('Universitet tanlovi'), findsNothing);
  });

  testWidgets('the partner slot needs no answer from the student', (t) async {
    await pump(t, const UniversityChoicesScreen(), [
      choice('c1', 1, UniversityChoiceStatus.confirmed),
      choice('c3', 3, UniversityChoiceStatus.offered, name: 'Daegu Haany University', partner: true),
    ]);
    expect(find.text('Hamkor — javob shart emas'), findsOneWidget);
    expect(find.text('Roziman'), findsNothing);
    expect(find.text('Tasdiqlashingiz kerak'), findsNothing);
  });

  testWidgets('the journey entry counts the offers waiting for an answer', (t) async {
    await pump(t, const Scaffold(body: UniversityChoicesEntry()), [
      choice('c1', 1, UniversityChoiceStatus.offered),
      choice('c2', 2, UniversityChoiceStatus.offered),
      choice('c3', 3, UniversityChoiceStatus.offered, partner: true),
    ]);
    expect(find.text('Universitet tanlovi'), findsOneWidget);
    expect(find.text('2 ta universitet javobingizni kutmoqda'), findsOneWidget);
  });
}
