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
//
// And while the builder opens (Tayyorgarlik T3, canvas boards 6–7): the
// skeleton instead of a spinner, the phone's copy of the plan at once and
// read-only until the server answers, and a failed open's message readable
// on the page.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart' show HardButton;
import 'package:hanguk_app/design_system/seoul_night/widgets/fd_kit.dart' show FdColors;
import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart';
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/data/slots.dart';
import 'package:hanguk_app/features/discover/presentation/study_plan_test_screen.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/features/training/data/plan_sections.dart';
import 'package:hanguk_app/features/training/data/study_plan_cache.dart';
import 'package:hanguk_app/features/training/data/study_plan_repository.dart';
import 'package:hanguk_app/features/training/presentation/study_plan_builder_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

import '../../helpers/contrast.dart';
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
/// The open waits for [hold] when given, and answers nothing while [fail];
/// saves fail while [saveOk] is false.
class _Plans extends StudyPlanSessionNotifier {
  _Plans({this.existing = '', this.hold, this.fail = false});

  final String existing;
  final Completer<void>? hold;
  bool fail;
  bool saveOk = true;
  final saved = <String>[];

  @override
  String? get userId => 'me';

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

  /// The builder's one-request open: the plan with its newest draft, or a
  /// new one. [opens] counts the calls.
  int opens = 0;

  @override
  Future<StudyPlanSession?> openLatest(String type, {String? targetUniversityId}) async {
    opens++;
    if (hold != null) await hold!.future;
    if (fail) return null;
    if (existing.isEmpty) return createSession(type, targetUniversityId: targetUniversityId);
    await loadSession(type, _session.id);
    return _session;
  }

  /// As the server keeps it: each save is the plan's next version.
  @override
  Future<bool> saveDraft(String type, String content) async {
    if (!saveOk) return false;
    saved.add(content);
    final plan = state[type] ?? const StudyPlanSessionState();
    final version = plan.drafts.fold<int>(0, (v, d) => d.version > v ? d.version : v) + 1;
    state = {
      ...state,
      type: plan.copyWith(drafts: [StudyPlanDraft(id: 'd$version', content: content, version: version), ...plan.drafts]),
    };
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

/// The phone's copies of plans, in memory (secure storage is a platform
/// channel).
class _Copies implements StudyPlanCache {
  _Copies([Map<String, StudyPlanCopy> copies = const {}]) : copies = {...copies};

  final Map<String, StudyPlanCopy> copies;

  @override
  Future<StudyPlanCopy?> read(String key) async => copies[key];

  @override
  Future<void> write(String key, StudyPlanCopy copy) async {
    copies[key] = copy;
  }
}

/// The copy of [_Plans]' plan: the student 'me', the Study Plan, for 'u1'.
final String _copyKey = studyPlanCopyKey(userId: 'me', type: 'study_plan', targetUniversityId: 'u1');

/// The drop under the caret and the selection highlight: the app theme's
/// lime is all but invisible on a white field.
void _expectSelectionVisible(WidgetTester t, Finder field) {
  final sel = TextSelectionTheme.of(t.element(field));
  expect(contrastRatio(sel.selectionHandleColor!, FdColors.card), greaterThanOrEqualTo(3.0), reason: 'selection handle');
  final hl = Color.alphaBlend(sel.selectionColor!, FdColors.card);
  expect(contrastRatio(hl, FdColors.card), greaterThanOrEqualTo(1.3), reason: 'selection highlight');
  expect(contrastRatio(FdColors.ink, hl), greaterThanOrEqualTo(4.5), reason: 'text on the highlight');
}

Future<void> _settle(WidgetTester t, [int frames = 12]) async {
  for (var i = 0; i < frames; i++) {
    await t.pump(const Duration(milliseconds: 50));
  }
}

/// [home] as the app shows it: the app's theme, Uzbek, a phone, the
/// fake keyboard, and a signed-in student with one university picked; the
/// phone holds [cache]'s copies of plans (none when not given).
Future<AppLocalizations> _pump(WidgetTester t, Widget home, {_Plans? plans, _Copies? cache}) async {
  usePhone(t);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        signedInProvider.overrideWith((ref) => true),
        catalogProvider.overrideWith((ref) async => [_uni]),
        slotsProvider.overrideWith(_Slots.new),
        if (plans != null) studyPlanSessionProvider.overrideWith(() => plans),
        studyPlanCacheProvider.overrideWith((ref) => cache ?? _Copies()),
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
      _expectSelectionVisible(t, field);

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
    // One open (Tayyorgarlik T3), not the sessions list and then the session.
    expect(plans.opens, 1);
    var shot = await capture(t, 'arizam_1_resumed');
    expectTypedTextVisible(t, shot, field, where: 'resumed');

    await t.tap(field);
    openKeyboard(t);
    await _settle(t, 20);
    shot = await capture(t, 'arizam_2_resumed_keyboard');
    expectTypedTextVisible(t, shot, field, where: 'resumed, keyboard open');
  });

  group('Study Plan builder while it opens (Tayyorgarlik T3, canvas boards 6 and 7)', () {
    final seen = <TrackedEvent>[];
    setUp(() {
      seen.clear();
      AppEvents.debugOnTrack = seen.add;
    });
    tearDown(() => AppEvents.debugOnTrack = null);

    /// `data_ready` prepare.study_plan, in the order sent.
    List<Map<String, Object?>> ready() => [
      for (final e in seen)
        if (e.event == 'data_ready' && e.props?['name'] == 'prepare.study_plan') e.props!,
    ];

    Finder field() => find.descendant(of: find.byType(StudyPlanField), matching: find.byType(TextField));
    Finder feedback(AppLocalizations l) => find.widgetWithText(HardButton, l.fdPlanFeedback);
    double barOpacity(WidgetTester t, AppLocalizations l) =>
        t.widget<Opacity>(find.ancestor(of: feedback(l), matching: find.byType(Opacity)).first).opacity;

    testWidgets('no copy on the phone: the skeleton until the plan opens, not a spinner (board 6)', (t) async {
      final plans = _Plans(hold: Completer<void>());
      final l = await _pump(
        t,
        const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        plans: plans,
      );

      expect(find.byType(CircularProgressIndicator), findsNothing);
      // The screen as it will be — the header, the four steps with the first
      // one on, step 1's card, the warning — with grey bars for the box.
      expect(find.text(l.fdPlanTitle), findsOneWidget);
      for (final label in [l.fdPlanStepGoal, l.fdPlanStepKorea, l.fdPlanStepUni, l.fdPlanStepFuture]) {
        expect(find.text(label), findsOneWidget);
      }
      expect(find.text(l.fdPlanStepOf(1, kPlanStepCount)), findsOneWidget);
      expect(find.text(l.fdPlanQ1Mark), findsOneWidget);
      expect(find.text(l.fdPlanQ1Hint), findsOneWidget);
      expect(find.text(l.fdPlanWarnTitle), findsOneWidget);
      expect(find.byType(StudyPlanField), findsNothing);
      final box = find.byType(StudyPlanFieldSkeleton);
      expect(box, findsOneWidget);
      final bars = find.descendant(of: box, matching: find.byType(FractionallySizedBox));
      expect(bars, findsNWidgets(3));

      // Board 6's box: 150 high, its inside 14 + 1.5 from the edge, the bars
      // 10 high and 10 apart, at 92 / 78 / 55 % of the inside.
      final outer = t.getRect(box);
      expect(outer.height, 150);
      final inside = outer.width - 2 * 15.5;
      final shot = await capture(t, 'builder_0_skeleton');
      for (var i = 0; i < 3; i++) {
        final bar = t.getRect(bars.at(i));
        expect(bar.height, 10);
        expect(bar.width, moreOrLessEquals(StudyPlanFieldSkeleton.bars[i] * inside, epsilon: 0.01));
        expect(bar.left, moreOrLessEquals(outer.left + 15.5, epsilon: 0.01));
        final above = i == 0 ? outer.top + 15.5 : t.getRect(bars.at(i - 1)).bottom + 10;
        expect(bar.top, moreOrLessEquals(above, epsilon: 0.01));
        final c = bar.center * shot.ratio;
        final painted = shot.pixel(c.dx.floor(), c.dy.floor());
        expect(contrastRatio(painted, FdColors.tint), lessThan(1.05), reason: 'bar ${i + 1} is painted: $painted');
      }

      // The bar is there but off: half see-through, and a press does nothing.
      expect(t.widget<HardButton>(feedback(l)).onPressed, isNull);
      expect(barOpacity(t, l), 0.5);
      await t.tap(feedback(l));
      await t.tap(find.bySemanticsLabel(l.fdPlanDictate));
      await _settle(t);
      expect(seen.where((e) => e.event == 'study_plan_feedback' || e.event == 'dictation_start'), isEmpty);
      expect(find.text(l.fdPlanDictateUnavailable), findsNothing, reason: 'the mic did not start');
      expect(find.text(l.fdPlanSheetTitle), findsNothing);
      expect(plans.saved, isEmpty);
      expect(ready(), isEmpty);

      // The plan opens: the box takes typing, the bar comes on.
      plans.hold!.complete();
      await _settle(t);
      expect(find.byType(StudyPlanFieldSkeleton), findsNothing);
      expect(t.widget<TextField>(field()).readOnly, isFalse);
      expect(t.widget<HardButton>(feedback(l)).onPressed, isNotNull);
      expect(barOpacity(t, l), 1);
      expect(ready().map((p) => p['source']), ['network']);
    });

    testWidgets("a copy on the phone: its text at once, read-only, then the server's", (t) async {
      final cache = _Copies({
        _copyKey: StudyPlanCopy(
          sessionId: 's1',
          version: 1,
          content: serializePlan([_korea, '', '', '']),
          savedAt: DateTime.now().subtract(const Duration(hours: 3)),
        ),
      });
      final plans = _Plans(existing: serializePlan([_goal, _korea, '', '']), hold: Completer<void>());
      final l = await _pump(
        t,
        const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        plans: plans,
        cache: cache,
      );
      String text() => t.widget<TextField>(field()).controller!.text;

      // Before the server answers: the phone's copy, readable but read-only,
      // and the bar off — nothing typed now could be lost.
      expect(find.byType(StudyPlanFieldSkeleton), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(text(), _korea);
      expect(t.widget<TextField>(field()).readOnly, isTrue);
      expect(t.widget<HardButton>(feedback(l)).onPressed, isNull);
      expect(barOpacity(t, l), 0.5);
      final shot = await capture(t, 'builder_0_cached');
      expectTypedTextVisible(t, shot, field(), where: "the phone's copy");
      final saved = ready().single;
      expect(saved['source'], 'saved');
      expect(saved['ms'], isA<int>());
      expect(saved['age_h'], 3);

      // The server answers: its newest draft takes the copy's place, and the
      // box takes typing.
      plans.hold!.complete();
      await _settle(t);
      expect(text(), _goal, reason: 'the server is the source of truth');
      expect(t.widget<TextField>(field()).readOnly, isFalse);
      expect(t.widget<HardButton>(feedback(l)).onPressed, isNotNull);
      expect(barOpacity(t, l), 1);
      expect(ready().map((p) => p['source']), ['saved', 'network']);
      await t.enterText(field(), _long);
      await _settle(t);
      expect(text().length, kPlanMaxChars);
      // The copy is the server's now.
      final copy = cache.copies[_copyKey]!;
      expect((copy.sessionId, copy.version, copy.content), ('s1', 1, serializePlan([_goal, _korea, '', ''])));
    });

    testWidgets('the copy follows the server: kept on the open and on each successful save', (t) async {
      final cache = _Copies();
      final plans = _Plans(existing: serializePlan([_goal, '', '', '']));
      final l = await _pump(
        t,
        const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        plans: plans,
        cache: cache,
      );
      StudyPlanCopy copy() => cache.copies[_copyKey]!;

      // The open keeps the server's newest draft.
      expect((copy().sessionId, copy().version, copy().content), ('s1', 1, serializePlan([_goal, '', '', ''])));

      await t.tap(find.text(l.fdPlanStepKorea));
      await _settle(t);
      await t.enterText(field(), _korea);
      await _settle(t);

      // A save the server did not take is not kept.
      plans.saveOk = false;
      await t.tap(feedback(l));
      await _settle(t, 20);
      expect(plans.saved, isEmpty);
      expect((copy().version, copy().content), (1, serializePlan([_goal, '', '', ''])));

      // One it took is, with the version it got.
      plans.saveOk = true;
      await t.tap(find.bySemanticsLabel(MaterialLocalizations.of(t.element(field())).backButtonTooltip).first);
      await _settle(t);
      expect(plans.saved, [serializePlan([_goal, _korea, '', ''])]);
      expect((copy().sessionId, copy().version, copy().content), ('s1', 2, serializePlan([_goal, _korea, '', ''])));
    });

    testWidgets('the open fails: its message is readable on the page, and the copy goes too (board 7)', (t) async {
      final cache = _Copies({
        _copyKey: StudyPlanCopy(
          sessionId: 's1',
          version: 1,
          content: serializePlan([_goal, '', '', '']),
          savedAt: DateTime.now(),
        ),
      });
      final plans = _Plans(existing: serializePlan([_goal, _korea, '', '']), hold: Completer<void>(), fail: true);
      final l = await _pump(
        t,
        const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        plans: plans,
        cache: cache,
      );
      expect(t.widget<TextField>(field()).controller!.text, _goal, reason: 'the copy, while it opens');

      plans.hold!.complete();
      await _settle(t);
      // The failed state, as without a copy: no box to type into.
      expect(find.byType(StudyPlanField), findsNothing);
      expect(find.text(l.fdPlanLoadFailed), findsOneWidget);
      // White on the page — it was ink, dark on the dark blue.
      final colour = t.widget<Text>(find.text(l.fdPlanLoadFailed)).style!.color!;
      expect(contrastRatio(colour, FdColors.page), greaterThanOrEqualTo(4.5), reason: '$colour on ${FdColors.page}');
      final shot = await capture(t, 'builder_0_failed');
      expectLabelVisible(t, shot, find.text(l.fdPlanLoadFailed));
      expect(ready().map((p) => p['source']), ['saved', 'failed']);

      // «Qayta urinish» opens it.
      plans.fail = false;
      await t.tap(find.text(l.commonRetry));
      await _settle(t);
      expect(find.text(l.fdPlanLoadFailed), findsNothing);
      expect(t.widget<TextField>(field()).controller!.text, _goal);
      expect(t.widget<TextField>(field()).readOnly, isFalse);
      expect(plans.opens, 2);
    });
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
      for (var i = 0; i < 3; i++) {
        _expectSelectionVisible(t, fields.at(i));
      }
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
