// QA audit evidence — not to be merged ("Audit dalili — merge qilinmaydi").
//
// «Tayyorgarlik» (Claude Design canvas «Tayyorgarlik», boards 1–4 and 6–7)
// beyond the Uzbek 360×780 screens the feature's own tests render: English,
// Russian and Korean, a 320×640 phone and a 1.3 text scale. Every state is
// saved as build/test_screens/qa_<state>.png (CI: test-screens/pr-<N>.zip)
// for a person to compare with the mockups; what each screen measures, and
// its semantics, are printed as "QA| …" lines into build/test_report.txt.
//
// The tests render and measure. Two groups at the end assert and are
// expected to fail on main 8d7a150: "screen-reader activation" (the Study
// Plan's buttons do not answer SemanticsAction.tap) and "board 1" (what the
// mockup draws under the sign-in button). The setup is copied from
// prepare_screens_pixels_test.dart and study_plan_visible_test.dart; nothing
// under lib/ is changed.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart' show HardButton;
import 'package:hanguk_app/design_system/seoul_night/widgets/fd_kit.dart' show HardIconButton;
import 'package:hanguk_app/design_system/theme/app_theme.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart' show catalogProvider;
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/discover/data/guest_ai_usage.dart';
import 'package:hanguk_app/features/discover/data/prepare_progress.dart';
import 'package:hanguk_app/features/discover/data/slots.dart';
import 'package:hanguk_app/features/discover/presentation/prepare_screen.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/features/training/data/study_plan_cache.dart';
import 'package:hanguk_app/features/training/data/study_plan_repository.dart';
import 'package:hanguk_app/features/training/presentation/study_plan_builder_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

import '../../helpers/screen_pixels.dart';

// ── Reporting ─────────────────────────────────────────────────────────────

void _qa(String line) => debugPrint('QA| $line');

String _r(Rect r) =>
    '(${r.left.toStringAsFixed(1)},${r.top.toStringAsFixed(1)})-(${r.right.toStringAsFixed(1)},${r.bottom.toStringAsFixed(1)}) '
    '${r.width.toStringAsFixed(1)}x${r.height.toStringAsFixed(1)}';

/// A Text on screen: its box, how many lines it took, how wide its glyphs
/// are, whether a one-line text was cut, and how much a FittedBox shrank it.
String _text(WidgetTester t, Finder f) {
  final p = t.renderObject<RenderParagraph>(f.first);
  final plain = p.text.toPlainText();
  final boxes = p.getBoxesForSelection(TextSelection(baseOffset: 0, extentOffset: plain.length));
  final lines = {for (final b in boxes) b.top.round()}.length;
  final ink = boxes.isEmpty
      ? 0.0
      : boxes.map((b) => b.right).reduce(math.max) - boxes.map((b) => b.left).reduce(math.min);
  final cut = p.maxLines == 1 && p.getMaxIntrinsicWidth(double.infinity) > p.size.width + 0.5;
  final shown = t.getRect(f.first);
  final factor = p.size.width == 0 ? 1.0 : shown.width / p.size.width;
  return '${_r(shown)} lines=$lines ink=${ink.toStringAsFixed(1)} cut=$cut'
      '${(factor - 1).abs() > 0.005 ? ' fittedTo=${factor.toStringAsFixed(2)}' : ''}';
}

/// The semantics node [f] belongs to, on one line.
String _node(WidgetTester t, Finder f) {
  if (f.evaluate().isEmpty) return 'not found';
  return t.getSemantics(f.first).toStringDeep().replaceAll('\n', ' ⏎ ');
}

/// The screen's semantics tree and the framework's tap-target and contrast
/// guidelines, printed (not asserted).
Future<void> _a11y(WidgetTester t, String name, List<(String, Finder)> nodes) async {
  final handle = t.ensureSemantics();
  try {
    await t.pump();
    for (final (label, f) in nodes) {
      _qa('$name node $label: ${_node(t, f)}');
    }
    _qa('$name semantics tree begin');
    debugDumpSemanticsTree();
    _qa('$name semantics tree end');
    for (final (label, guideline) in <(String, AccessibilityGuideline)>[
      ('tap target >= 44 (iOS)', iOSTapTargetGuideline),
      ('tap target >= 48 (Android)', androidTapTargetGuideline),
      ('tap targets labelled', labeledTapTargetGuideline),
      ('text contrast', textContrastGuideline),
    ]) {
      try {
        final e = await guideline.evaluate(t);
        _qa('$name guideline $label: ${e.passed ? 'passed' : 'FAILED: ${(e.reason ?? '').replaceAll('\n', ' | ')}'}');
      } catch (e) {
        _qa('$name guideline $label: could not run ($e)');
      }
    }
  } finally {
    handle.dispose();
  }
}

// ── Phones ────────────────────────────────────────────────────────────────

const Size _std = Size(360, 780);
const Size _small = Size(320, 640);

String _size(Size s) => '${s.width.toInt()}x${s.height.toInt()}';

void _phone(WidgetTester t, Size size) {
  t.view.physicalSize = size * 3;
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
}

/// The phone's font size setting (MediaQuery.textScaler).
TransitionBuilder? _scaled(double scale) => scale == 1
    ? null
    : (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
        child: child!,
      );

// ── Tayyorgarlik (boards 1–4) ─────────────────────────────────────────────

class _NoSlots extends SlotsNotifier {
  @override
  List<String?> build() => [null, null, null];
}

/// The D4 mockup's sample: 7 of 10 AI questions left, this week's interview free.
const GuestAiUsage _usage = GuestAiUsage(aiUsed: 3, aiLimit: 10, interviewUsed: 0, interviewLimit: 1);

/// The tab as the home shows it (page, nav, round button).
Future<AppLocalizations> _prepare(
  WidgetTester t, {
  required String lang,
  required bool signedIn,
  PrepareProgress? done,
  GuestAiUsage? usage = _usage,
  Size phone = _std,
  double scale = 1,
}) async {
  _phone(t, phone);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        signedInProvider.overrideWithValue(signedIn),
        catalogProvider.overrideWith((ref) async => const []),
        slotsProvider.overrideWith(_NoSlots.new),
        guestAiUsageProvider.overrideWith((ref) async => usage),
        prepareProgressProvider.overrideWith((ref) async => done),
      ],
      child: RepaintBoundary(
        key: shotKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.materialTheme,
          locale: Locale(lang),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          builder: _scaled(scale),
          home: NavScaffold(current: AppTab.prepare, child: PrepareScreen(signedIn: signedIn)),
        ),
      ),
    ),
  );
  await t.pump();
  await t.pump(const Duration(milliseconds: 50));
  return AppLocalizations.delegate.load(Locale(lang));
}

Finder _inPage(Finder f) => find.descendant(of: find.byType(PrepareScreen), matching: f);

Finder _signIn(AppLocalizations l) =>
    find.ancestor(of: find.text(l.prepGuestSignIn), matching: find.byType(Container)).first;

/// Taps the guest's interview row with the guest session held, so the row
/// says it is being prepared (board 2); [pending] completes it.
Future<void> _tapInterview(WidgetTester t, AppLocalizations l, Completer<bool> pending) async {
  final session = prepareGuestSession;
  addTearDown(() => prepareGuestSession = session);
  prepareGuestSession = () => pending.future;
  await t.tap(find.text(l.interviewPracticeTitle));
  await t.pump();
  // The spinner's arc is longest about 0.65 s into its turn.
  await t.pump(const Duration(milliseconds: 650));
}

void _measureGuest(WidgetTester t, String name, AppLocalizations l) {
  final body = t.getRect(find.byType(PrepareScreen));
  final orb = t.getRect(find.byType(AppNavOrb));
  final scroll = t.state<ScrollableState>(_inPage(find.byType(Scrollable)).first).position;
  _qa(
    '$name body ${_r(body)} orb ${_r(orb)} scroll max=${scroll.maxScrollExtent.toStringAsFixed(1)} '
    'viewport=${scroll.viewportDimension.toStringAsFixed(1)}',
  );
  if (find.text(l.prepGuestSignIn).evaluate().isNotEmpty) {
    final button = t.getRect(_signIn(l));
    final covered = orb.top < button.bottom && orb.left < button.right && orb.right > button.left;
    _qa(
      '$name sign-in ${_r(button)} below it to the body bottom=${(body.bottom - button.bottom).toStringAsFixed(1)} '
      '(board 1: 24) orb covers=${covered ? (button.bottom - orb.top).toStringAsFixed(1) : '0'}px '
      'fully on screen=${button.bottom <= body.bottom + 0.5}',
    );
  }
  for (final (label, f) in <(String, Finder)>[
    ('title', _inPage(find.text(l.fdNavPrepare))),
    ('intro', find.text(l.prepGuestIntro)),
    ('ai', find.text(l.prepGuestAi)),
    ('aiLimit', find.text(l.prepGuestAiLimit)),
    ('interview', find.text(l.interviewPracticeTitle)),
    ('interviewSub', find.text(l.prepGuestInterviewFree)),
    ('interviewLimit', find.text(l.prepGuestInterviewLimit)),
    ('preparing', find.text(l.interviewSettingUp)),
    ('error', find.text(l.entryErrorNetwork)),
    ('retry', find.text(l.commonRetry)),
    ('plan', _inPage(find.text(l.fdPlanTitle))),
    ('planSub', find.text(l.prepGuestStudyLocked)),
    ('signInLabel', find.text(l.prepGuestSignIn)),
  ]) {
    if (f.evaluate().isNotEmpty) _qa('$name text $label ${_text(t, f)}');
  }
}

String _planTag(AppLocalizations l, PrepareProgress? done) =>
    done == null ? '' : l.fdPrepareStudyPlanSteps(done.planParts, 4);

String _interviewTag(AppLocalizations l, PrepareProgress? done) => done == null
    ? ''
    : done.interviews > 0
    ? l.fdPrepareInterviewDone(done.interviews)
    : l.fdPrepareNew;

void _measureStudent(WidgetTester t, String name, AppLocalizations l, PrepareProgress? done) {
  final body = t.getRect(find.byType(PrepareScreen));
  final scroll = t.state<ScrollableState>(_inPage(find.byType(Scrollable)).first).position;
  _qa('$name body ${_r(body)} scroll max=${scroll.maxScrollExtent.toStringAsFixed(1)}');
  final planTag = _planTag(l, done);
  final interviewTag = _interviewTag(l, done);
  for (final (label, text) in <(String, String)>[
    ('title', '${l.fdPrepareEyebrow} ${l.fdPrepareTitle}'),
    ('planKicker', l.fdPrepareStudyKicker),
    ('planTag', planTag),
    ('planTitle', l.fdPrepareStudyPlanTitle),
    ('planBody', l.fdPrepareStudyPlanBody),
    ('interviewKicker', l.fdPrepareInterviewKicker),
    ('interviewTag', interviewTag),
    ('interviewTitle', l.fdPrepareInterviewTitle),
    ('interviewBody', l.fdPrepareInterviewBody),
    ('askTitle', l.fdPrepareAskTitle),
    ('askBody', l.fdPrepareAskBody),
  ]) {
    if (text.isEmpty) continue;
    final f = _inPage(find.text(text));
    if (f.evaluate().isNotEmpty) _qa('$name text $label ${_text(t, f)}');
  }
  // Board 4: the kicker and the tag share a row, 8px apart at least.
  for (final (kicker, tag) in [(l.fdPrepareStudyKicker, planTag), (l.fdPrepareInterviewKicker, interviewTag)]) {
    if (tag.isEmpty) continue;
    final k = _inPage(find.text(kicker)).first;
    final kRect = t.getRect(k);
    final kInk = math.min(t.renderObject<RenderParagraph>(k).getMaxIntrinsicWidth(double.infinity), kRect.width);
    final tagRect = t.getRect(_inPage(find.text(tag)).first);
    _qa(
      '$name kicker "$kicker" glyphs end at ${(kRect.left + kInk).toStringAsFixed(1)}, tag "$tag" starts at '
      '${tagRect.left.toStringAsFixed(1)}: gap ${(tagRect.left - kRect.left - kInk).toStringAsFixed(1)} (board 4: 8)',
    );
  }
}

// ── Study Plan builder (boards 6–7) ───────────────────────────────────────

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

class _Slots extends SlotsNotifier {
  @override
  List<String?> build() => ['u1', null, null];
}

/// The trainer's sessions without a server: the open waits for [hold] when
/// given, and answers nothing while [fail]; [opens] counts the opens.
class _Plans extends StudyPlanSessionNotifier {
  _Plans({this.hold, this.fail = false});

  final Completer<void>? hold;
  bool fail;
  int opens = 0;

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
  Future<StudyPlanSession?> createSession(String type, {String? targetUniversityId, String? selectedTrack}) async {
    state = {...state, type: StudyPlanSessionState(sessions: [_session], currentSession: _session)};
    return _session;
  }

  @override
  Future<StudyPlanSession?> openLatest(String type, {String? targetUniversityId}) async {
    opens++;
    if (hold != null) await hold!.future;
    if (fail) return null;
    return createSession(type, targetUniversityId: targetUniversityId);
  }
}

/// No copy of the plan on the phone.
class _Copies implements StudyPlanCache {
  final Map<String, StudyPlanCopy> copies = {};

  @override
  Future<StudyPlanCopy?> read(String key) async => copies[key];

  @override
  Future<void> write(String key, StudyPlanCopy copy) async {
    copies[key] = copy;
  }
}

Future<void> _settle(WidgetTester t, [int frames = 12]) async {
  for (var i = 0; i < frames; i++) {
    await t.pump(const Duration(milliseconds: 50));
  }
}

/// The builder opened from Tayyorgarlik (inside the home's nav), a signed-in
/// student with one university picked.
Future<AppLocalizations> _builder(
  WidgetTester t, {
  required String lang,
  required _Plans plans,
  Size phone = _std,
  double scale = 1,
}) async {
  _phone(t, phone);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        signedInProvider.overrideWith((ref) => true),
        catalogProvider.overrideWith((ref) async => [_uni]),
        slotsProvider.overrideWith(_Slots.new),
        studyPlanSessionProvider.overrideWith(() => plans),
        studyPlanCacheProvider.overrideWith((ref) => _Copies()),
      ],
      child: RepaintBoundary(
        key: shotKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.materialTheme,
          locale: Locale(lang),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          builder: _scaled(scale),
          home: const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
        ),
      ),
    ),
  );
  await _settle(t);
  return AppLocalizations.delegate.load(Locale(lang));
}

final Finder _subtitle = find.byWidgetPredicate((w) => w is Text && w.textAlign == TextAlign.right && w.maxLines == 1);

final Finder _mic = find.byWidgetPredicate(
  (w) => w is Container && w.constraints == const BoxConstraints.tightFor(width: 52, height: 52),
);

void _measureBuilder(WidgetTester t, String name, AppLocalizations l, {double scale = 1}) {
  final screen = t.getRect(find.byType(StudyPlanBuilderScreen));
  final back = t.getRect(find.byType(HardIconButton));
  _qa('$name screen ${_r(screen)} back button ${_r(back)} (board 6: 36x36, its chevron 18)');
  if (_subtitle.evaluate().isNotEmpty) _qa('$name text subtitle ${_text(t, _subtitle)}');
  _qa('$name text title ${_text(t, find.text(l.fdPlanTitle))}');
  for (final label in [l.fdPlanStepGoal, l.fdPlanStepKorea, l.fdPlanStepUni, l.fdPlanStepFuture]) {
    final f = find.text(label);
    if (f.evaluate().isEmpty) continue;
    final p = t.renderObject<RenderParagraph>(f.first);
    final shown = t.getRect(f.first);
    final factor = p.size.width == 0 ? 1.0 : shown.width / p.size.width;
    _qa(
      '$name chip "$label" ${_r(shown)} fitted=${factor.toStringAsFixed(2)} '
      'drawn at ${(8 * scale * factor).toStringAsFixed(1)}px (board 6: 8px, a long one ellipsized)',
    );
  }
  for (final (label, text) in <(String, String)>[
    ('stepOf', l.fdPlanStepOf(1, 4)),
    ('head', l.fdPlanQ1Head),
    ('mark', l.fdPlanQ1Mark),
    ('hint', l.fdPlanQ1Hint),
    ('warnTitle', l.fdPlanWarnTitle),
    ('warnBody', l.fdPlanWarnBody),
    ('warnIcon', '⚠️'),
    ('failed', l.fdPlanLoadFailed),
    ('retry', l.commonRetry),
  ]) {
    final f = find.text(text);
    if (f.evaluate().isNotEmpty) _qa('$name text $label ${_text(t, f)}');
  }
  final feedback = find.descendant(of: find.byType(HardButton), matching: find.byType(Text));
  if (feedback.evaluate().isNotEmpty) {
    _qa('$name feedback button ${_r(t.getRect(find.byType(HardButton)))} label ${_text(t, feedback)}');
  }
  if (_mic.evaluate().isNotEmpty) {
    final m = t.getRect(_mic.first);
    _qa('$name mic button ${_r(m)} left edge at ${(m.left - screen.left).toStringAsFixed(1)} (board 6: 18)');
  }
  final skeleton = find.byType(StudyPlanFieldSkeleton);
  if (skeleton.evaluate().isNotEmpty) _qa('$name skeleton ${_r(t.getRect(skeleton))}');
  final failed = find.text(l.fdPlanLoadFailed);
  if (failed.evaluate().isNotEmpty) {
    final text = t.getRect(failed);
    final retry = t.getRect(find.ancestor(of: find.text(l.commonRetry), matching: find.byType(Container)).first);
    final top = back.bottom + 14;
    final area = screen.bottom - top;
    final centre = (text.top + retry.bottom) / 2;
    _qa(
      '$name failed message+button ${text.top.toStringAsFixed(1)}..${retry.bottom.toStringAsFixed(1)}, centred at '
      '${((centre - top) / area * 100).toStringAsFixed(1)}% of the space under the header '
      '(board 7: 44.6%, from its 80px bottom padding) retry ${_r(retry)}',
    );
  }
}

void main() {
  setUpAll(loadAppFonts);

  setUp(() {
    final stored = <String, String>{};
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

  group('QA guest page (boards 1–3)', () {
    for (final lang in ['en', 'ru', 'ko']) {
      testWidgets('qa_guest_$lang', (t) async {
        final l = await _prepare(t, lang: lang, signedIn: false);
        await capture(t, 'qa_guest_$lang');
        _measureGuest(t, 'qa_guest_$lang', l);
      });

      testWidgets('qa_guest_preparing_$lang, qa_guest_failed_$lang', (t) async {
        final l = await _prepare(t, lang: lang, signedIn: false);
        final pending = Completer<bool>();
        await _tapInterview(t, l, pending);
        await capture(t, 'qa_guest_preparing_$lang');
        _measureGuest(t, 'qa_guest_preparing_$lang', l);
        pending.complete(false);
        await t.pump();
        await capture(t, 'qa_guest_failed_$lang');
        _measureGuest(t, 'qa_guest_failed_$lang', l);
      });
    }

    for (final lang in ['uz', 'ru']) {
      testWidgets('qa_guest_${lang}_320x640', (t) async {
        final l = await _prepare(t, lang: lang, signedIn: false, phone: _small);
        await capture(t, 'qa_guest_${lang}_320x640');
        _measureGuest(t, 'qa_guest_${lang}_320x640', l);
      });
    }

    testWidgets('qa_guest_failed_uz_320x640', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: false, phone: _small);
      final pending = Completer<bool>();
      await _tapInterview(t, l, pending);
      pending.complete(false);
      await t.pump();
      await capture(t, 'qa_guest_failed_uz_320x640');
      _measureGuest(t, 'qa_guest_failed_uz_320x640', l);
    });

    testWidgets('qa_guest_uz_ts130', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: false, scale: 1.3);
      await capture(t, 'qa_guest_uz_ts130');
      _measureGuest(t, 'qa_guest_uz_ts130', l);
    });

    testWidgets('qa_guest_failed_uz_ts130', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: false, scale: 1.3);
      final pending = Completer<bool>();
      await _tapInterview(t, l, pending);
      pending.complete(false);
      await t.pump();
      await capture(t, 'qa_guest_failed_uz_ts130');
      _measureGuest(t, 'qa_guest_failed_uz_ts130', l);
    });

    testWidgets('qa_guest_failed_ru_320x640_ts130 (worst case)', (t) async {
      final l = await _prepare(t, lang: 'ru', signedIn: false, phone: _small, scale: 1.3);
      final pending = Completer<bool>();
      await _tapInterview(t, l, pending);
      pending.complete(false);
      await t.pump();
      await capture(t, 'qa_guest_failed_ru_320x640_ts130');
      _measureGuest(t, 'qa_guest_failed_ru_320x640_ts130', l);
    });

    testWidgets('qa_guest_usage_unknown_uz (the server count could not be read)', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: false, usage: null);
      await capture(t, 'qa_guest_usage_unknown_uz');
      _measureGuest(t, 'qa_guest_usage_unknown_uz', l);
    });
  });

  group('QA student page (board 4, variant A)', () {
    const progress = PrepareProgress(planParts: 1, interviews: 2);
    for (final lang in ['en', 'ru', 'ko']) {
      testWidgets('qa_student_progress_$lang', (t) async {
        final l = await _prepare(t, lang: lang, signedIn: true, done: progress);
        await capture(t, 'qa_student_progress_$lang');
        _measureStudent(t, 'qa_student_progress_$lang', l, progress);
      });
    }

    testWidgets('qa_student_null_uz (progress unknown)', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: true);
      await capture(t, 'qa_student_null_uz');
      _measureStudent(t, 'qa_student_null_uz', l, null);
    });

    testWidgets('qa_student_zero_uz (nothing done)', (t) async {
      const zero = PrepareProgress(planParts: 0, interviews: 0);
      final l = await _prepare(t, lang: 'uz', signedIn: true, done: zero);
      await capture(t, 'qa_student_zero_uz');
      _measureStudent(t, 'qa_student_zero_uz', l, zero);
    });

    for (final lang in ['uz', 'ru']) {
      testWidgets('qa_student_${lang}_320x640', (t) async {
        final l = await _prepare(t, lang: lang, signedIn: true, done: progress, phone: _small);
        await capture(t, 'qa_student_${lang}_320x640');
        _measureStudent(t, 'qa_student_${lang}_320x640', l, progress);
      });
    }

    testWidgets('qa_student_uz_ts130', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: true, done: progress, scale: 1.3);
      await capture(t, 'qa_student_uz_ts130');
      _measureStudent(t, 'qa_student_uz_ts130', l, progress);
    });

    testWidgets('qa_student_ru_320x640_ts130 (worst case for the kicker and the tag)', (t) async {
      final l = await _prepare(t, lang: 'ru', signedIn: true, done: progress, phone: _small, scale: 1.3);
      await capture(t, 'qa_student_ru_320x640_ts130');
      _measureStudent(t, 'qa_student_ru_320x640_ts130', l, progress);
    });
  });

  group('QA Study Plan builder while it opens (boards 6–7)', () {
    for (final lang in ['ru', 'ko', 'en']) {
      testWidgets('qa_builder_skeleton_$lang', (t) async {
        final l = await _builder(t, lang: lang, plans: _Plans(hold: Completer<void>()));
        expect(find.byType(StudyPlanFieldSkeleton), findsOneWidget);
        await capture(t, 'qa_builder_skeleton_$lang');
        _measureBuilder(t, 'qa_builder_skeleton_$lang', l);
      });

      testWidgets('qa_builder_failed_$lang', (t) async {
        final l = await _builder(t, lang: lang, plans: _Plans(fail: true));
        expect(find.text(l.fdPlanLoadFailed), findsOneWidget);
        await capture(t, 'qa_builder_failed_$lang');
        _measureBuilder(t, 'qa_builder_failed_$lang', l);
      });
    }

    testWidgets('qa_builder_skeleton_uz_320x640', (t) async {
      final l = await _builder(t, lang: 'uz', plans: _Plans(hold: Completer<void>()), phone: _small);
      await capture(t, 'qa_builder_skeleton_uz_320x640');
      _measureBuilder(t, 'qa_builder_skeleton_uz_320x640', l);
    });

    testWidgets('qa_builder_skeleton_uz_ts130', (t) async {
      final l = await _builder(t, lang: 'uz', plans: _Plans(hold: Completer<void>()), scale: 1.3);
      await capture(t, 'qa_builder_skeleton_uz_ts130');
      _measureBuilder(t, 'qa_builder_skeleton_uz_ts130', l, scale: 1.3);
    });

    testWidgets('qa_builder_failed_uz_320x640', (t) async {
      final l = await _builder(t, lang: 'uz', plans: _Plans(fail: true), phone: _small);
      await capture(t, 'qa_builder_failed_uz_320x640');
      _measureBuilder(t, 'qa_builder_failed_uz_320x640', l);
    });
  });

  group('QA semantics and tap targets (uz, 360x780)', () {
    testWidgets('a11y guest: ready, preparing, failed', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: false);
      List<(String, Finder)> nodes() => [
        ('title', _inPage(find.text(l.fdNavPrepare))),
        ('ai row', find.text(l.prepGuestAi)),
        ('interview row', find.text(l.interviewPracticeTitle)),
        ('preparing text', find.text(l.interviewSettingUp)),
        ('error text', find.text(l.entryErrorNetwork)),
        ('retry', find.text(l.commonRetry)),
        ('locked plan row', find.text(l.prepGuestStudyLocked)),
        ('sign-in', find.text(l.prepGuestSignIn)),
      ];
      await _a11y(t, 'a11y_guest', nodes());
      final pending = Completer<bool>();
      await _tapInterview(t, l, pending);
      await _a11y(t, 'a11y_guest_preparing', nodes());
      pending.complete(false);
      await t.pump();
      await _a11y(t, 'a11y_guest_failed', nodes());
    });

    testWidgets('a11y student', (t) async {
      const progress = PrepareProgress(planParts: 1, interviews: 2);
      final l = await _prepare(t, lang: 'uz', signedIn: true, done: progress);
      await _a11y(t, 'a11y_student', [
        ('title', _inPage(find.text('${l.fdPrepareEyebrow} ${l.fdPrepareTitle}'))),
        ('plan card', find.text(l.fdPrepareStudyPlanTitle)),
        ('interview card', find.text(l.fdPrepareInterviewTitle)),
        ('ask row', find.text(l.fdPrepareAskTitle)),
      ]);
    });

    testWidgets('a11y builder: skeleton, failed', (t) async {
      var l = await _builder(t, lang: 'uz', plans: _Plans(hold: Completer<void>()));
      await _a11y(t, 'a11y_builder_skeleton', [
        ('back', find.byType(HardIconButton)),
        ('title', find.text(l.fdPlanTitle)),
        ('chip 1', find.text(l.fdPlanStepGoal)),
        ('skeleton', find.byType(StudyPlanFieldSkeleton)),
        ('feedback', find.byType(HardButton)),
      ]);
      await t.pumpWidget(const SizedBox());
      l = await _builder(t, lang: 'uz', plans: _Plans(fail: true));
      await _a11y(t, 'a11y_builder_failed', [
        ('failed text', find.text(l.fdPlanLoadFailed)),
        ('retry', find.text(l.commonRetry)),
      ]);
    });
  });

  // A screen reader activates a control with SemanticsAction.tap (TalkBack's
  // and VoiceOver's double tap). Each test does that first, then taps the
  // same control with a finger to show the setup itself works, and only then
  // checks the screen reader's tap. The guest's retry button is the control
  // (it passes); the Study Plan's three are expected to FAIL on main 8d7a150:
  // `Semantics(button: true, excludeSemantics: true)` around a GestureDetector
  // drops the detector's tap action and gives none of its own.
  group('QA screen-reader activation (SemanticsAction.tap)', () {
    /// Performs a screen reader's tap on the semantics node of [f].
    Future<void> srTap(WidgetTester t, String name, Finder f) async {
      final node = t.getSemantics(f.first);
      _qa('$name node before the screen-reader tap: ${node.toStringDeep().replaceAll('\n', ' ⏎ ')}');
      node.owner!.performAction(node.id, SemanticsAction.tap);
      await _settle(t);
    }

    testWidgets('control · board 3: the guest\'s «Qayta urinish» answers a screen reader', (t) async {
      final l = await _prepare(t, lang: 'uz', signedIn: false);
      var calls = 0;
      final session = prepareGuestSession;
      addTearDown(() => prepareGuestSession = session);
      prepareGuestSession = () async {
        calls++;
        return false;
      };
      await t.tap(find.text(l.interviewPracticeTitle));
      await _settle(t);
      expect(find.text(l.commonRetry), findsOneWidget, reason: 'setup: the failed row (board 3)');
      final handle = t.ensureSemantics();
      try {
        await t.pump();
        await srTap(t, 'sr guest retry', find.text(l.commonRetry));
        _qa('sr guest retry: guest session asked $calls times (1 = the row, 2 = the screen reader retried)');
        expect(calls, 2, reason: 'the screen reader\'s tap did not retry');
      } finally {
        handle.dispose();
      }
    });

    testWidgets('board 7: the Study Plan\'s «Qayta urinish» answers a screen reader', (t) async {
      final plans = _Plans(fail: true);
      final l = await _builder(t, lang: 'uz', plans: plans);
      expect(find.text(l.fdPlanLoadFailed), findsOneWidget, reason: 'setup: the failed state (board 7)');
      plans.fail = false;
      final handle = t.ensureSemantics();
      try {
        await t.pump();
        await srTap(t, 'sr builder retry', find.text(l.commonRetry));
        final bySr = plans.opens;
        if (find.text(l.commonRetry).evaluate().isNotEmpty) {
          await t.tap(find.text(l.commonRetry));
          await _settle(t);
        }
        _qa('sr builder retry: opens after the screen-reader tap=$bySr, after a finger tap=${plans.opens}');
        expect(plans.opens, 2, reason: 'setup: a finger tap retries');
        expect(bySr, 2, reason: 'the screen reader\'s tap on «Qayta urinish» did nothing (its node has no tap action)');
      } finally {
        handle.dispose();
      }
    });

    testWidgets('board 6, once open: «Fikr-mulohaza olish» answers a screen reader', (t) async {
      final seen = <TrackedEvent>[];
      AppEvents.debugOnTrack = seen.add;
      addTearDown(() => AppEvents.debugOnTrack = null);
      int asked() => seen.where((e) => e.event == 'study_plan_feedback').length;
      final l = await _builder(t, lang: 'uz', plans: _Plans());
      expect(t.widget<HardButton>(find.byType(HardButton)).onPressed, isNotNull, reason: 'setup: the plan is open');
      final handle = t.ensureSemantics();
      try {
        await t.pump();
        await srTap(t, 'sr builder feedback', find.byType(HardButton));
        final bySr = asked();
        var byFinger = bySr;
        if (bySr == 0) {
          await t.tap(find.widgetWithText(HardButton, l.fdPlanFeedback));
          await _settle(t);
          byFinger = asked();
        }
        _qa('sr builder feedback: study_plan_feedback after the screen-reader tap=$bySr, after a finger tap=$byFinger');
        expect(byFinger, 1, reason: 'setup: a finger tap asks for feedback');
        expect(bySr, 1, reason: 'the screen reader\'s tap on «Fikr-mulohaza olish» did nothing (HardButton\'s node has no tap action)');
      } finally {
        handle.dispose();
      }
    });

    testWidgets('boards 6–7: the back button «Orqaga» answers a screen reader', (t) async {
      _phone(t, _std);
      final nav = GlobalKey<NavigatorState>();
      await t.pumpWidget(
        ProviderScope(
          overrides: [
            signedInProvider.overrideWith((ref) => true),
            catalogProvider.overrideWith((ref) async => [_uni]),
            slotsProvider.overrideWith(_Slots.new),
            studyPlanSessionProvider.overrideWith(_Plans.new),
            studyPlanCacheProvider.overrideWith((ref) => _Copies()),
          ],
          child: MaterialApp(
            navigatorKey: nav,
            theme: AppTheme.materialTheme,
            locale: const Locale('uz'),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            home: const Scaffold(body: Center(child: Text('home'))),
          ),
        ),
      );
      unawaited(
        nav.currentState!.push(
          MaterialPageRoute<void>(
            builder: (_) => const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
          ),
        ),
      );
      await _settle(t, 20);
      expect(find.byType(StudyPlanBuilderScreen), findsOneWidget, reason: 'setup: the builder is open over a page');
      final handle = t.ensureSemantics();
      try {
        await t.pump();
        await srTap(t, 'sr builder back', find.byType(HardIconButton));
        final closedBySr = find.byType(StudyPlanBuilderScreen).evaluate().isEmpty;
        var closedByFinger = closedBySr;
        if (!closedBySr) {
          await t.tap(find.byType(HardIconButton));
          await _settle(t, 20);
          closedByFinger = find.byType(StudyPlanBuilderScreen).evaluate().isEmpty;
        }
        _qa('sr builder back: closed by the screen-reader tap=$closedBySr, by a finger tap=$closedByFinger');
        expect(closedByFinger, isTrue, reason: 'setup: a finger tap closes the builder');
        expect(closedBySr, isTrue, reason: 'the screen reader\'s tap on «Orqaga» did nothing (HardIconButton\'s node has no tap action)');
      } finally {
        handle.dispose();
      }
    });
  });

  // What board 1 draws under «Mijoz kodi bilan kirish»: 24px, nothing over
  // the button, and a page that does not scroll when everything fits.
  // Expected to FAIL on main 8d7a150 (audit evidence).
  group('QA board 1 evidence: under the sign-in button', () {
    for (final phone in [_std, _small]) {
      testWidgets('guest page ${_size(phone)}: 24px under the sign-in button, the round button clear of it, no scroll', (
        t,
      ) async {
        final l = await _prepare(t, lang: 'uz', signedIn: false, phone: phone);
        await capture(t, 'qa_evidence_guest_bottom_${_size(phone)}');
        final body = t.getRect(find.byType(PrepareScreen));
        final orb = t.getRect(find.byType(AppNavOrb));
        final button = t.getRect(_signIn(l));
        final scroll = t.state<ScrollableState>(_inPage(find.byType(Scrollable)).first).position;
        final problems = [
          if (scroll.maxScrollExtent > 0.5)
            'the page scrolls by ${scroll.maxScrollExtent.toStringAsFixed(1)}px although everything fits',
          if (body.bottom - button.bottom < 23.5)
            'board 1 keeps 24px under the button, the screen ${(body.bottom - button.bottom).toStringAsFixed(1)}px',
          if (orb.top < button.bottom && orb.left < button.right && orb.right > button.left)
            'the round QABUL button covers the bottom ${(button.bottom - orb.top).toStringAsFixed(1)}px of the sign-in button',
        ];
        _qa('evidence ${_size(phone)}: ${problems.isEmpty ? 'as board 1' : problems.join('; ')}');
        expect(problems, isEmpty, reason: 'sign-in ${_r(button)}, round button ${_r(orb)}, page ${_r(body)}');
      });
    }
  });
}
