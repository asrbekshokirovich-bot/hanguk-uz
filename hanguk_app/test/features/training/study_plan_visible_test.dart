// The Study Plan, as a student meets it on a phone: what they type must be
// on screen and readable — with the keyboard closed and open, at the first
// line and at the 300th character, in every place the plan is written:
//
//  * the four-part builder, opened from Tayyorgarlik and from Arizam
//    (both inside the home's bottom nav and round BAHOLASH button);
//  * the four-minute Study Plan test of a university (three answers).
//
// Every check reads painted pixels (see helpers/screen_pixels.dart), and each
// step is saved to build/test_screens/ for a person to look at.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart' show HardButton;
import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/data/slots.dart';
import 'package:hanguk_app/features/discover/presentation/study_plan_test_screen.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/features/training/data/plan_sections.dart';
import 'package:hanguk_app/features/training/data/study_plan_repository.dart';
import 'package:hanguk_app/features/training/presentation/study_plan_builder_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

import '../../helpers/screen_pixels.dart';

final _uni = CatalogUniversity(
  institutionId: 'u1',
  guidelines: [
    CatalogGuideline(
      id: 'g-u1',
      institutionId: 'u1',
      univNameEn: 'Catholic University of Pusan',
      nameKoShort: '부산가톨릭대',
      city: 'Busan',
      degree: 'bakalavr',
    ),
  ],
);

/// What students write: Uzbek with o‘/g‘, a Korean phrase, digits.
const _goal =
    'Men Koreyada kompyuter injiniringi bo‘yicha o‘qib, sun’iy intellekt sohasida '
    'mutaxassis bo‘lmoqchiman. 한국어를 열심히 공부하고 있습니다. TOPIK 3-daraja.';
const _korea = 'Koreya texnologiya bo‘yicha dunyoda yetakchi, universitetlarda amaliyot imkoniyati ko‘p.';

/// 400 characters: more than a part may hold.
final String _long = List.filled(10, 'Bu mening rejamning davomi. ').join() * 2;

class _Slots extends SlotsNotifier {
  @override
  List<String?> build() => ['u1', null, null];
}

/// The trainer's sessions without a server: one plan, [existing] already
/// saved in it (empty for a first visit); every save is kept in [saved].
class _Plans extends StudyPlanSessionNotifier {
  _Plans({this.existing = ''});

  final String existing;
  final saved = <String>[];

  StudyPlanSession get _session => StudyPlanSession(
    id: 's1',
    studentId: 'me',
    documentType: 'study_plan',
    targetUniversityId: 'u1',
    currentStep: 0,
    status: 'in_progress',
  );

  @override
  Map<String, StudyPlanSessionState> build() => const {};

  @override
  Future<void> fetchSessions(String type) async {
    state = {...state, type: StudyPlanSessionState(sessions: existing.isEmpty ? const [] : [_session])};
  }

  @override
  Future<void> loadSession(String type, String sessionId) async {
    state = {
      ...state,
      type: StudyPlanSessionState(
        sessions: [_session],
        currentSession: _session,
        drafts: [StudyPlanDraft(id: 'd1', content: existing, version: 1)],
      ),
    };
  }

  @override
  Future<StudyPlanSession?> createSession(String type, {String? targetUniversityId, String? selectedTrack}) async {
    state = {...state, type: StudyPlanSessionState(sessions: [_session], currentSession: _session)};
    return _session;
  }

  @override
  Future<bool> saveDraft(String type, String content) async {
    saved.add(content);
    return true;
  }

  @override
  Future<StudyPlanAnalysis?> analyzeCurrentDraft(String type) async => StudyPlanAnalysis(
    id: 'a1',
    contentFeedback: 'Maqsadingiz aniq yozilgan.',
    strengths: const ['Aniq maqsad'],
    improvements: const ['Universitet nomini ham yozing'],
  );
}

Future<void> _settle(WidgetTester t, [int frames = 12]) async {
  for (var i = 0; i < frames; i++) {
    await t.pump(const Duration(milliseconds: 50));
  }
}

/// [home] as the app shows it: the app's theme, Uzbek, a phone, the
/// fake keyboard, and a signed-in student with one university picked.
Future<AppLocalizations> _pump(WidgetTester t, Widget home, {_Plans? plans}) async {
  usePhone(t);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        signedInProvider.overrideWith((ref) => true),
        catalogProvider.overrideWith((ref) async => [_uni]),
        slotsProvider.overrideWith(_Slots.new),
        if (plans != null) studyPlanSessionProvider.overrideWith(() => plans),
      ],
      child: RepaintBoundary(
        key: shotKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.materialTheme,
          locale: const Locale('uz'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          builder: (context, child) => FakeKeyboard(child: child!),
          home: home,
        ),
      ),
    ),
  );
  await _settle(t);
  return AppLocalizations.delegate.load(const Locale('uz'));
}

void main() {
  final stored = <String, String>{};

  setUpAll(loadAppFonts);

  // The caret always drawn (no blinking), so a capture always has it.
  setUp(() => EditableText.debugDeterministicCursor = true);
  tearDown(() => EditableText.debugDeterministicCursor = false);

  setUp(() {
    stored.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        final args = (call.arguments as Map?) ?? const {};
        final key = args['key'] as String?;
        switch (call.method) {
          case 'read':
            return stored[key];
          case 'write':
            stored[key!] = args['value'] as String;
        }
        return null;
      },
    );
  });

  group('Study Plan builder (Tayyorgarlik)', () {
    testWidgets('typed text is readable — keyboard closed and open, first line and the 300th character', (
      t,
    ) async {
      final plans = _Plans();
      final l = await _pump(
        t,
        const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        plans: plans,
      );
      final field = find.descendant(of: find.byType(StudyPlanField), matching: find.byType(TextField));
      expect(field, findsOneWidget);

      var shot = await capture(t, 'builder_1_empty');
      expectLabelVisible(t, shot, find.text(l.fdPlanHintField));

      await t.enterText(field, _goal);
      await _settle(t);
      shot = await capture(t, 'builder_2_typed');
      expectTypedTextVisible(t, shot, field, where: 'keyboard closed');

      openKeyboard(t);
      await _settle(t, 20);
      shot = await capture(t, 'builder_3_typed_keyboard');
      expectTypedTextVisible(t, shot, field, where: 'keyboard open');
      // The round button floats just above the keyboard: while it is up the
      // button and the bar step aside, so nothing sits on the line typed.
      expect(find.byType(AppNavOrb), findsNothing);
      expect(find.byType(AppNav), findsNothing);

      // To the limit: the box holds 300, the caret at the end stays in view.
      await t.enterText(field, _long);
      await _settle(t, 20);
      final typed = t.widget<TextField>(field).controller!.text;
      expect(typed.length, kPlanMaxChars);
      expect(find.text('$kPlanMaxChars / $kPlanMaxChars'), findsOneWidget);
      shot = await capture(t, 'builder_4_full_keyboard');
      expectTypedTextVisible(t, shot, field, where: 'full, keyboard open');

      closeKeyboard(t);
      await _settle(t, 20);
      expect(find.byType(AppNavOrb), findsOneWidget, reason: 'the bar comes back with the keyboard down');
      shot = await capture(t, 'builder_5_full');
      expectTypedTextVisible(t, shot, field, where: 'full, keyboard closed');
      expectLabelVisible(t, shot, find.text('$kPlanMaxChars / $kPlanMaxChars'));
    });

    testWidgets('each part keeps its text across steps, and leaving saves all of it', (t) async {
      final plans = _Plans();
      final l = await _pump(
        t,
        const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        plans: plans,
      );
      final field = find.descendant(of: find.byType(StudyPlanField), matching: find.byType(TextField));
      String text() => t.widget<TextField>(field).controller!.text;

      await t.enterText(field, _goal);
      await _settle(t);

      await t.tap(find.text(l.fdPlanStepKorea));
      await _settle(t);
      expect(text(), isEmpty, reason: 'step 2 starts empty');
      await t.enterText(field, _korea);
      await _settle(t);
      final shot = await capture(t, 'builder_6_step2');
      expectTypedTextVisible(t, shot, field, where: 'step 2');

      await t.tap(find.text(l.fdPlanStepGoal));
      await _settle(t);
      expect(text(), _goal, reason: 'step 1 text came back');

      await t.tap(find.bySemanticsLabel(MaterialLocalizations.of(t.element(field)).backButtonTooltip).first);
      await _settle(t);
      expect(plans.saved, isNotEmpty, reason: 'leaving saves the plan');
      expect(plans.saved.last, serializePlan([_goal, _korea, '', '']));
    });

    testWidgets('the trainer\'s feedback sheet is readable', (t) async {
      final plans = _Plans();
      final l = await _pump(
        t,
        const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        plans: plans,
      );
      final field = find.descendant(of: find.byType(StudyPlanField), matching: find.byType(TextField));
      await t.enterText(field, _goal);
      await _settle(t);
      await t.tap(find.widgetWithText(HardButton, l.fdPlanFeedback));
      await _settle(t, 20);
      final shot = await capture(t, 'builder_7_feedback');
      expectLabelVisible(t, shot, find.text('Maqsadingiz aniq yozilgan.'));
      expectLabelVisible(t, shot, find.text('Universitet nomini ham yozing'));
    });
  });

  testWidgets('Study Plan builder (Arizam → Imzolash): a saved plan opens readable', (t) async {
    final plans = _Plans(existing: serializePlan([_goal, _korea, '', '']));
    await _pump(
      t,
      const NavScaffold(current: AppTab.application, child: StudyPlanBuilderScreen()),
      plans: plans,
    );
    final field = find.descendant(of: find.byType(StudyPlanField), matching: find.byType(TextField));
    expect(t.widget<TextField>(field).controller!.text, _goal);
    var shot = await capture(t, 'arizam_1_resumed');
    expectTypedTextVisible(t, shot, field, where: 'resumed');

    await t.tap(field);
    openKeyboard(t);
    await _settle(t, 20);
    shot = await capture(t, 'arizam_2_resumed_keyboard');
    expectTypedTextVisible(t, shot, field, where: 'resumed, keyboard open');
  });

  group('Study Plan test of a university', () {
    testWidgets('all three answers are readable as they are typed, keyboard open', (t) async {
      var sent = <String>[];
      final l = await _pump(
        t,
        NavScaffold(
          current: AppTab.universities,
          child: StudyPlanTestScreen(
            university: _uni,
            send: (answers, seconds) async {
              sent = answers;
              return StudyPlanTestResult.fromJson(const {
                'score': 72,
                'motivation': 24,
                'plan': 20,
                'career': 15,
                'language': 13,
                'strengths': ['Maqsad aniq'],
                'improvements': ['Reja bosqichlarini yozing'],
                'summary': 'Yaxshi boshlang‘ich reja.',
              });
            },
          ),
        ),
      );
      final fields = find.byType(TextField);
      expect(fields, findsNWidgets(3));
      var shot = await capture(t, 'test_1_empty');
      expectLabelVisible(t, shot, find.text(l.sptHint).first);

      final answers = [_goal, _korea, 'Bitirgach Toshkentda IT kompaniya ochaman va Koreya bilan hamkorlik qilaman.'];
      for (var i = 0; i < 3; i++) {
        closeKeyboard(t);
        await _settle(t);
        await t.ensureVisible(fields.at(i));
        await t.enterText(fields.at(i), answers[i]);
        openKeyboard(t);
        await _settle(t, 20);
        shot = await capture(t, 'test_${i + 2}_answer${i + 1}_keyboard');
        expectTypedTextVisible(t, shot, fields.at(i), where: 'answer ${i + 1}, keyboard open');
        expect(find.byType(AppNavOrb), findsNothing);
      }

      // A long answer: the box scrolls, the end of it stays readable.
      await t.enterText(fields.at(2), List.filled(12, answers[2]).join(' '));
      await _settle(t, 20);
      shot = await capture(t, 'test_5_long_keyboard');
      expectTypedTextVisible(t, shot, fields.at(2), where: 'long answer, keyboard open');

      closeKeyboard(t);
      await _settle(t);
      await t.ensureVisible(find.widgetWithText(HardButton, l.sptSubmit));
      await t.tap(find.widgetWithText(HardButton, l.sptSubmit));
      await _settle(t, 20);
      expect(sent.length, 3);
      expect(sent.first, _goal);
      shot = await capture(t, 'test_6_result');
      expectLabelVisible(t, shot, find.text('Yaxshi boshlang‘ich reja.'));

      // The test's clock stops with the screen.
      await t.pumpWidget(const SizedBox());
    });
  });
}
