// QA audit evidence (Tayyorgarlik T1 + the Study Plan builder) — not to be
// merged.
//
// The builder's _leave() saves, then pops, with no guard against being run
// twice (study_plan_builder_screen.dart:286-291). goOverPushed (T1) now runs
// it through the PopScope when a nav tab is tapped, and its own flag only
// stops a second NAV tap; the screen's back arrow (and the system back) can
// still start a second _leave while the first one saves. Then the plan is
// saved twice and the second navigator.pop() pops the page under the
// builder — the home itself. go_router then has no page left (debug: an
// assertion; release: RouteBuilder.build draws SizedBox.shrink, a blank
// screen).
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

/// One open plan; each save takes 600 ms, as on a phone network.
class _SlowSaves extends StudyPlanSessionNotifier {
  final saved = <String>[];

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

void main() {
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  testWidgets('QA-BUG: a nav tab, then the back arrow while the plan saves: two saves and the home is popped', (t) async {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final plans = _SlowSaves();
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
          studyPlanCacheProvider.overrideWith((ref) => _Copies()),
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
    final l = await AppLocalizations.delegate.load(const Locale('uz'));

    await t.tap(find.text('open builder'));
    await _settle(t);
    final field = find.descendant(of: find.byType(StudyPlanField), matching: find.byType(TextField));
    expect(field, findsOneWidget, reason: 'the plan is open');
    await t.enterText(field, 'Men Koreyada kompyuter injiniringi bo‘yicha o‘qib, mutaxassis bo‘lmoqchiman.');
    await t.pump();
    final back = find.bySemanticsLabel(MaterialLocalizations.of(t.element(field)).backButtonTooltip).first;

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
}
