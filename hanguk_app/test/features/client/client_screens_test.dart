import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/applications/data/applications_repository.dart';
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

  test('the furthest-along application leads; a rejected one only when alone', () {
    final a = app('a', 'documents_collection');
    final b = app('b', 'interview');
    final c = app('c', 'rejected');
    expect(leadingApplication([a, b, c]).id, 'b');
    expect(leadingApplication([c]).id, 'c');
  });

  Future<void> pump(WidgetTester t, Widget home, {List<StudentApplication> apps = const [], List<AppDocument> docs = const []}) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      ProviderScope(
        overrides: [
          applicationsProvider.overrideWith((ref) async => apps),
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

  testWidgets('the journey shows the stage, its count and the nine stages', (t) async {
    await pump(t, Scaffold(body: JourneyScreen(onBrowse: () {})), apps: [app('a', 'online_application')]);
    expect(find.text('Ariza jarayoni'), findsOneWidget);
    expect(find.text('Dilnoza Karimova · Kongju'), findsOneWidget);
    expect(find.text('Hozirgi bosqich'), findsOneWidget);
    expect(find.textContaining('/9'), findsOneWidget);
    expect(find.text('Universitet xonasi'), findsOneWidget);
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
    expect(find.text('Yana 3 ta kerak'), findsOneWidget);
    expect(find.textContaining('/5', findRichText: true), findsOneWidget);
    expect(find.text('Yuklash'), findsNWidgets(3));
    expect(find.text('Qabul qilindi'), findsOneWidget);
    expect(find.text('Tekshirilmoqda'), findsOneWidget);
  });

  testWidgets('the client shell opens on Ariza and has five tabs', (t) async {
    await pump(t, const ClientShell(), apps: [app('a', 'interview')]);
    for (final label in ['Universitetlar', '360° xarita', 'Tayyorgarlik', 'Ariza', 'Hujjatlar']) {
      expect(find.text(label), findsWidgets, reason: label);
    }
    expect(find.text('Ariza jarayoni'), findsOneWidget);
    await t.tap(find.text('Hujjatlar').last);
    await t.pump();
    await t.pump();
    expect(find.text('Hujjatlarim'), findsOneWidget);
  });
}
