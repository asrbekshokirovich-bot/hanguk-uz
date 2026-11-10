// The Study Plan builder's way out (audit 2026-11-10): the back arrow, the
// system back, and a tab of the bottom nav (goOverPushed asks the screen to
// close, and it saves first).
//
//  * C-F2: one way out while another one saves waits for it — it used to
//    save again and close again, and the second close took the home page
//    under the builder (a blank screen);
//  * C-F5: a save that fails keeps the builder open, with its text, and says
//    so — it used to close, and the text was gone; the phone's copy keeps
//    the text too.
//
// The first test is the QA audit's evidence (qa/code-audit,
// test/qa/qa_study_plan_leave_test.dart), which failed on main 8d7a150.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hanguk_app/features/auth/data/auth_repository.dart' show signedInProvider;
import 'package:hanguk_app/features/catalog/data/catalog_repository.dart' show catalogProvider;
import 'package:hanguk_app/features/discover/data/slots.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/app_nav.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/fd_bottom_nav.dart';
import 'package:hanguk_app/features/training/data/plan_sections.dart';
import 'package:hanguk_app/features/training/data/study_plan_cache.dart';
import 'package:hanguk_app/features/training/data/study_plan_repository.dart';
import 'package:hanguk_app/features/training/presentation/study_plan_builder_screen.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

class _NoSlots extends SlotsNotifier {
  @override
  List<String?> build() => [null, null, null];
}

class _Copies implements StudyPlanCache {
  final copies = <String, StudyPlanCopy>{};

  @override
  Future<StudyPlanCopy?> read(String key) async => copies[key];

  @override
  Future<void> write(String key, StudyPlanCopy copy) async {
    copies[key] = copy;
  }
}

/// The phone's copy of the plan below: student 'me', no university chosen.
final String _copyKey = studyPlanCopyKey(userId: 'me', type: 'study_plan');

/// One open plan; each save takes 600 ms, as on a phone network, and fails
/// (as the server's would: the save error in the state) while [ok] is false.
class _SlowSaves extends StudyPlanSessionNotifier {
  final saved = <String>[];
  bool ok = true;

  final StudyPlanSession _session = StudyPlanSession(
    id: 's1',
    studentId: 'me',
    documentType: 'study_plan',
    currentStep: 1,
    status: 'in_progress',
  );

  @override
  String? get userId => 'me';

  @override
  Map<String, StudyPlanSessionState> build() => const {};

  @override
  Future<StudyPlanSession?> openLatest(String type, {String? targetUniversityId}) async {
    state = {...state, type: StudyPlanSessionState(currentSession: _session)};
    return _session;
  }

  @override
  Future<bool> saveDraft(String type, String content) async {
    saved.add(content);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final plan = state[type] ?? const StudyPlanSessionState();
    if (!ok) {
      state = {...state, type: plan.copyWith(error: studyPlanErrorSave)};
      return false;
    }
    final version = plan.drafts.fold<int>(0, (v, d) => d.version > v ? d.version : v) + 1;
    state = {
      ...state,
      type: plan.copyWith(drafts: [StudyPlanDraft(id: 'd$version', content: content, version: version), ...plan.drafts]),
    };
    return true;
  }
}

class _Home extends StatelessWidget {
  const _Home({required this.tab});

  final String tab;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('home tab $tab'),
          TextButton(
            // As PrepareScreen._push opens it.
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                settings: const RouteSettings(name: 'study_plan'),
                builder: (_) => const NavScaffold(current: AppTab.prepare, child: StudyPlanBuilderScreen()),
              ),
            ),
            child: const Text('open builder'),
          ),
        ],
      ),
    ),
  );
}

Future<void> _settle(WidgetTester t, [int frames = 20]) async {
  for (var i = 0; i < frames; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

/// The home on '/?tab=1' (a signed-in student) with the builder opened over
/// it; the plan is open.
Future<AppLocalizations> _openBuilder(WidgetTester t, _SlowSaves plans, {_Copies? copies}) async {
  t.view.physicalSize = const Size(390 * 3, 844 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final router = GoRouter(
    initialLocation: '/?tab=1',
    routes: [GoRoute(path: '/', builder: (_, s) => _Home(tab: s.uri.queryParameters['tab'] ?? '3'))],
  );
  addTearDown(router.dispose);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        signedInProvider.overrideWithValue(true),
        catalogProvider.overrideWith((ref) async => const []),
        slotsProvider.overrideWith(_NoSlots.new),
        studyPlanSessionProvider.overrideWith(() => plans),
        studyPlanCacheProvider.overrideWith((ref) => copies ?? _Copies()),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('uz'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
      ),
    ),
  );
  await _settle(t, 5);
  await t.tap(find.text('open builder'));
  await _settle(t);
  expect(_field, findsOneWidget, reason: 'the plan is open');
  return AppLocalizations.delegate.load(const Locale('uz'));
}

final Finder _field = find.descendant(of: find.byType(StudyPlanField), matching: find.byType(TextField));

Finder _back(WidgetTester t) =>
    find.bySemanticsLabel(MaterialLocalizations.of(t.element(_field)).backButtonTooltip).first;

/// The phone's back, as the system sends it.
Future<void> _systemBack(WidgetTester t) async {
  final message = SystemChannels.navigation.codec.encodeMethodCall(const MethodCall('popRoute'));
  unawaited(t.binding.defaultBinaryMessenger.handlePlatformMessage(SystemChannels.navigation.name, message, (_) {}));
  await t.pump();
}

const String _goal = 'Men Koreyada kompyuter injiniringi bo‘yicha o‘qib, mutaxassis bo‘lmoqchiman.';

void main() {
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  testWidgets('a nav tab, then the back arrow while the plan saves: one save, and the home on the tab asked for', (
    t,
  ) async {
    final plans = _SlowSaves();
    final l = await _openBuilder(t, plans);
    await t.enterText(_field, _goal);
    await t.pump();
    final back = _back(t);

    // «Universitetlar» in the builder's own bottom nav: goOverPushed asks it
    // to close, and it saves first. Nothing on screen says so.
    final nav = find.descendant(of: find.byType(NavScaffold), matching: find.byType(FdBottomNav));
    await t.tap(find.descendant(of: nav, matching: find.text(l.fdNavUniversities)).first);
    await t.pump(const Duration(milliseconds: 100));
    // So the student taps the screen's back arrow.
    await t.tap(back);
    await _settle(t);

    expect(plans.saved, hasLength(1), reason: 'one way out, one save (saved ${plans.saved.length} times)');
    expect(find.text('home tab 0'), findsOneWidget, reason: 'the home, on the tab asked for, is still there');
  });

  testWidgets('the back arrow twice while the plan saves: one save, and only the builder closes', (t) async {
    final plans = _SlowSaves();
    await _openBuilder(t, plans);
    await t.enterText(_field, _goal);
    await t.pump();
    await t.tap(_back(t));
    await t.pump(const Duration(milliseconds: 100));
    await t.tap(_back(t));
    await _settle(t);

    expect(plans.saved, [serializePlan([_goal, '', '', ''])]);
    expect(find.byType(StudyPlanBuilderScreen), findsNothing);
    expect(find.text('home tab 1'), findsOneWidget, reason: 'the home is still there');
  });

  testWidgets('a save that fails on the way out keeps the builder open with its text, and says so', (t) async {
    final plans = _SlowSaves()..ok = false;
    final copies = _Copies();
    final l = await _openBuilder(t, plans, copies: copies);
    await t.enterText(_field, _goal);
    await t.pump();
    final plan = serializePlan([_goal, '', '', '']);

    // The phone's back: the save fails, the builder stays.
    await _systemBack(t);
    await _settle(t);
    expect(plans.saved, [plan], reason: 'it tried to save');
    expect(find.byType(StudyPlanBuilderScreen), findsOneWidget, reason: 'the builder is still open');
    expect(find.text('home tab 1'), findsNothing, reason: 'the home is still under the builder');
    expect(t.widget<TextField>(_field).controller!.text, _goal, reason: 'the text is kept');
    expect(find.text(l.saveStatusError), findsOneWidget, reason: 'it says the plan was not saved');
    // The phone keeps it too: closing the app now loses nothing.
    final unsaved = copies.copies[_copyKey]!;
    expect((unsaved.sessionId, unsaved.version, unsaved.content, unsaved.unsaved), ('s1', 0, plan, true));

    // The back arrow, again while the save fails: the same.
    await t.tap(_back(t));
    await _settle(t);
    expect(plans.saved, [plan, plan]);
    expect(find.byType(StudyPlanBuilderScreen), findsOneWidget);
    expect(find.text(l.saveStatusError), findsOneWidget, reason: 'one message, not one queued per try');

    // Once the save goes through, the way out saves and closes the builder,
    // and the copy is the server's again.
    plans.ok = true;
    await t.tap(_back(t));
    await _settle(t, 40);
    expect(plans.saved, [plan, plan, plan]);
    expect(find.byType(StudyPlanBuilderScreen), findsNothing);
    expect(find.text('home tab 1'), findsOneWidget);
    final saved = copies.copies[_copyKey]!;
    expect((saved.sessionId, saved.version, saved.content, saved.unsaved), ('s1', 1, plan, false));
  });
}
