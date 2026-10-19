import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/applications/data/applications_repository.dart';
import 'package:hanguk_app/features/applications/data/journey_repository.dart';
import 'package:hanguk_app/features/applications/domain/application_journey.dart';
import 'package:hanguk_app/features/applications/domain/application.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/client/presentation/client_documents_screen.dart';
import 'package:hanguk_app/features/client/presentation/client_shell.dart';
import 'package:hanguk_app/features/client/presentation/journey_screen.dart';
import 'package:hanguk_app/features/discover/data/application_windows.dart';
import 'package:hanguk_app/features/documents/data/documents_repository.dart';
import 'package:hanguk_app/features/documents/domain/document.dart';
import 'package:hanguk_app/features/documents/domain/document_type.dart';
import 'package:hanguk_app/features/map/domain/university.dart';
import 'package:hanguk_app/features/university_choices/data/university_choices_repository.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

StudentApplication app(String id, String status, {String name = 'Kongju National University'}) => StudentApplication(
  id: id,
  studentId: 's',
  universityId: 'u-$id',
  status: status,
  program: '',
  createdAt: DateTime(2026, 10, 1),
  university: University(id: 'u-$id', name: name, location: 'Gongju'),
);

AppDocument doc(String type, String status) => AppDocument(
  id: 'd-$type',
  studentId: 's',
  name: '[$type] file.pdf',
  filePath: 'x/$type-1.pdf',
  fileType: 'application/pdf',
  fileSize: 1,
  status: status,
  createdAt: DateTime(2026, 10, 10),
);

final journeyNow = DateTime(2026, 10, 19, 10);

/// The design's example on 19 October 2026: Keimyung at its interview, Sun
/// Moon waiting for the Study Plan, Dongseo under review.
final designJourney = ApplicationJourney.fromJson({
  'contract_date': '2026-09-12',
  'docs_complete': true,
  'docs_at': '2026-09-20T09:00:00',
  'translations_complete': true,
  'translations_at': '2026-10-03T09:00:00',
  'study_plan_ready': false,
  'universities': [
    {
      'institution_id': 'kmu', 'status': 'interview', 'name_en': 'Keimyung University', 'name_ko': '계명대학교',
      'city': 'Daegu', 'intake_year': 2027, 'semester': 'bahor', 'degree': 'bakalavr',
      'online_submitted_at': '2026-10-10T09:00:00', 'interview_at': '2026-10-24T14:00:00',
    },
    {
      'institution_id': 'smu', 'status': 'documents', 'name_en': 'Sun Moon University', 'name_ko': '선문대학교',
      'city': 'Asan', 'intake_year': 2027, 'semester': 'bahor', 'degree': 'bakalavr', 'online_deadline': '2026-10-28',
    },
    {
      'institution_id': 'dsu', 'status': 'application_submitted', 'name_en': 'Dongseo University', 'name_ko': '동서대학교',
      'city': 'Busan', 'intake_year': 2027, 'semester': 'bahor', 'degree': 'bakalavr',
      'online_submitted_at': '2026-10-12T09:00:00', 'result_round': '2026-11-02',
    },
  ],
});

void main() {
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  group('documents', () {
    test('a required slot finds its upload by the type stamped into the row', () {
      final passport = DocumentConstants.requiredDocuments.firstWhere((t) => t.id == 'foreign_passport');
      final docs = [doc('photo', 'approved'), doc('foreign_passport', 'uploaded')];
      expect(documentMatchFor(passport, docs)!.id, 'd-foreign_passport');
      expect(documentMatchFor(DocumentConstants.requiredDocuments.firstWhere((t) => t.id == 'diploma'), docs), isNull);
    });

    test('only an approved upload is accepted; any other is under review; none is needed', () {
      expect(docStateOf(doc('photo', 'approved')), DocState.accepted);
      expect(docStateOf(doc('photo', 'uploaded')), DocState.review);
      expect(docStateOf(doc('photo', 'rejected')), DocState.review);
      expect(docStateOf(null), DocState.needed);
    });
  });

  Future<void> pump(
    WidgetTester t,
    Widget home, {
    List<StudentApplication> apps = const [],
    List<AppDocument> docs = const [],
    ApplicationJourney journey = const ApplicationJourney(facts: JourneyFacts(), universities: []),
  }) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          applicationsProvider.overrideWith((ref) async => apps),
          applicationJourneyProvider.overrideWith((ref) async => journey),
          documentsProvider.overrideWith((ref) async => docs),
          studentFullNameProvider.overrideWith((ref) async => 'Dilnoza Karimova'),
          catalogProvider.overrideWith((ref) async => const []),
          applicationWindowsProvider.overrideWith((ref) async => const {}),
          myUniversityChoicesProvider.overrideWith((ref) async => const []),
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

  testWidgets('the Ariza list (design 7b): ring, summary and one card per university', (t) async {
    await pump(t, Scaffold(body: JourneyScreen(onBrowse: () {}, now: journeyNow)), journey: designJourney);
    expect(find.text('Ariza jarayoni'), findsOneWidget);
    expect(find.text('48%'), findsOneWidget);
    expect(find.text('3 universitet · 4 / 8 bosqich'), findsOneWidget);
    expect(find.text('Eng yaqin: suhbat · 5 kun qoldi'), findsOneWidget);
    // Keimyung: at its interview.
    expect(find.text('Suhbat 24-okt'), findsOneWidget);
    expect(find.text('Daegu · Suhbat bosqichi'), findsOneWidget);
    expect(find.text('Topshirildi · suhbat 24-\u2060okt, 14:00'), findsOneWidget);
    // Sun Moon: the Study Plan is wanted.
    expect(find.text('Sizdan kerak'), findsOneWidget);
    expect(find.text('Asan · Topshirishga tayyorlanmoqda'), findsOneWidget);
    expect(find.text('Study Plan imzongiz kerak · 28-\u2060okt gacha'), findsOneWidget);
    expect(find.text('Imzolash →'), findsOneWidget);
    // Dongseo: under review.
    expect(find.text('Kutilmoqda'), findsOneWidget);
    expect(find.text('Busan · Hujjatlar tekshirilmoqda'), findsOneWidget);
    expect(find.text('Universitet tekshirmoqda · javob ~2-\u2060noy'), findsOneWidget);
    for (final label in ['Hujjat', 'Topshirish', 'Suhbat', 'Qabul', 'Viza']) {
      expect(find.text(label), findsNWidgets(3), reason: label);
    }
    expect(find.text('Universitet xonasi'), findsNothing);
  });

  testWidgets("a card opens the university's page (design 8a) and back returns", (t) async {
    await pump(t, Scaffold(body: JourneyScreen(onBrowse: () {}, now: journeyNow)), journey: designJourney);
    await t.tap(find.text('Sun Moon University'));
    await t.pump();
    expect(find.text('ARIZA · 2 / 3'), findsOneWidget);
    expect(find.text('HANGUK AIR · 2027 BAHOR'), findsOneWidget);
    expect(find.text('D-2 talaba'), findsOneWidget);
    expect(find.text('TAS'), findsOneWidget);
    expect(find.text('Toshkent'), findsOneWidget);
    expect(find.text('CJJ'), findsOneWidget);
    expect(find.text('Cheongju'), findsOneWidget);
    expect(find.text('Imzo kutilmoqda'), findsOneWidget);
    expect(find.text('124 kun'), findsOneWidget);
    expect(find.text('Pasportingizdagi muhrlar'), findsOneWidget);
    expect(find.text('3 / 8 bosildi'), findsOneWidget);
    for (final label in ['SHARTNOMA', "HUJJATLAR YIG'ISH", 'TARJIMA VA APOSTIL', 'UNIVERSITETGA TOPSHIRISH', 'SUHBAT', 'QABUL XATI', 'VIZA D-2', 'PARVOZ VA TURAR JOY']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('12-sen'), findsOneWidget);
    expect(find.text('20-sen'), findsOneWidget);
    expect(find.text('3-okt'), findsOneWidget);
    expect(find.text('28-okt gacha'), findsOneWidget);
    expect(find.text('fevral'), findsOneWidget);
    expect(find.text('Study Plan imzongiz kerak — shundan keyin topshiramiz'), findsOneWidget);
    expect(find.text('Imzolash'), findsOneWidget);
    await t.tap(find.bySemanticsLabel('Orqaga'));
    await t.pump();
    expect(find.text('3 universitet · 4 / 8 bosqich'), findsOneWidget);
  });

  testWidgets('without an application the journey says so and offers the universities', (t) async {
    var browsed = false;
    await pump(t, Scaffold(body: JourneyScreen(onBrowse: () => browsed = true)));
    expect(find.text("Hali ariza yo'q"), findsOneWidget);
    await t.tap(find.text("Universitetlarni ko'rish"));
    expect(browsed, isTrue);
  });

  testWidgets('the documents screen counts accepted ones and offers upload on those still needed', (t) async {
    await pump(
      t,
      const Scaffold(body: ClientDocumentsScreen()),
      docs: [doc('photo', 'approved'), doc('diploma', 'uploaded')],
    );
    expect(find.text('Hujjatlarim'), findsOneWidget);
    expect(find.text('1 / 5 tayyor'), findsOneWidget);
    expect(find.text('Keyingi hujjatni yuklash'), findsOneWidget);
    expect(find.text('Yuklash'), findsNWidgets(3));
    expect(find.text('Qabul qilindi'), findsOneWidget);
    expect(find.text('Tekshirilmoqda'), findsOneWidget);
  });

  testWidgets('the client shell opens on Ariza and has five tabs', (t) async {
    await pump(t, const ClientShell(), apps: [app('a', 'interview')], journey: designJourney);
    for (final label in ['Universitetlar', 'Tayyorgarlik', 'BAHOLASH', 'Ariza', 'Hujjatlar']) {
      expect(find.text(label), findsWidgets, reason: label);
    }
    expect(find.text('Ariza jarayoni'), findsOneWidget);
    await t.tap(find.text('Hujjatlar').last);
    await t.pump();
    await t.pump();
    expect(find.text('Hujjatlarim'), findsOneWidget);
  });
}
