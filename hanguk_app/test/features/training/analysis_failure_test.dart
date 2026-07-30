import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FunctionException;

import 'package:hanguk_app/l10n/app_localizations.dart';
import 'package:hanguk_app/features/training/data/study_plan_repository.dart';
import 'package:hanguk_app/features/training/presentation/widgets/study_plan_analysis_view.dart';

/// A failed analysis used to land on the same neutral "no analysis yet" as
/// never having run one. The student pressed Analyze, was moved to the
/// feedback step, and was told nothing at all — a plan-locked feature, a
/// dropped connection and an outage all looked identical, and identical to
/// having done nothing.
void main() {
  group('classifyAnalysisFailure', () {
    test('403 is the plan gate, not a malfunction', () {
      // The trainer is limited to the Premium and No Risk plans. This is the
      // one failure that is not a fault at all, and the one most in need of
      // an explanation.
      expect(
        StudyPlanSessionNotifier.classifyAnalysisFailure(
          const FunctionException(status: 403),
        ),
        analysisErrorPlanRequired,
      );
    });

    test('429 is rate limiting', () {
      expect(
        StudyPlanSessionNotifier.classifyAnalysisFailure(
          const FunctionException(status: 429),
        ),
        analysisErrorRateLimited,
      );
    });

    test('402 and 5xx are an outage', () {
      for (final status in [402, 500, 502, 503]) {
        expect(
          StudyPlanSessionNotifier.classifyAnalysisFailure(
            FunctionException(status: status),
          ),
          analysisErrorServiceDown,
          reason: 'status $status',
        );
      }
    });

    test('anything else is the generic failure', () {
      expect(
        StudyPlanSessionNotifier.classifyAnalysisFailure(
          Exception('SocketException: Failed host lookup'),
        ),
        analysisErrorFailed,
      );
      // A status with no dedicated message must still classify, never crash.
      expect(
        StudyPlanSessionNotifier.classifyAnalysisFailure(
          const FunctionException(status: 418),
        ),
        analysisErrorFailed,
      );
    });

    test('every produced code is one the UI knows', () {
      // A code the view cannot translate falls back to the neutral empty
      // state — i.e. silently reintroduces the bug. Keep the two in step.
      final produced = [
        for (final status in [403, 429, 402, 500, 502, 503, 418])
          StudyPlanSessionNotifier.classifyAnalysisFailure(
            FunctionException(status: status),
          ),
        StudyPlanSessionNotifier.classifyAnalysisFailure(Exception('x')),
      ];
      expect(produced, everyElement(isIn(analysisErrorCodes)));
    });
  });

  group('StudyPlanAnalysisView', () {
    Future<void> pump(WidgetTester tester, StudyPlanSessionState state) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            studyPlanSessionProvider.overrideWith(
              () => _StubNotifier({'study_plan': state}),
            ),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: StudyPlanAnalysisView(documentType: 'study_plan'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('explains a plan-gated failure and offers a retry', (
      tester,
    ) async {
      await pump(
        tester,
        const StudyPlanSessionState(error: analysisErrorPlanRequired),
      );

      expect(find.textContaining('Premium'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(
        find.textContaining('No analysis'),
        findsNothing,
        reason: 'a refusal must not read as "you have not run one yet"',
      );
    });

    testWidgets('explains a generic failure', (tester) async {
      await pump(
        tester,
        const StudyPlanSessionState(error: analysisErrorFailed),
      );
      expect(find.textContaining('could not be completed'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('no error means the plain empty state, with no retry', (
      tester,
    ) async {
      await pump(tester, const StudyPlanSessionState());

      expect(find.text('Try again'), findsNothing);
      // The neutral copy is still what a student who has not analysed sees.
      expect(find.textContaining('analysis'), findsWidgets);
    });

    testWidgets('an unrelated error falls back to the empty state', (
      tester,
    ) async {
      // Errors from other flows share this field. Showing one here would put
      // a log line in front of a student.
      await pump(
        tester,
        const StudyPlanSessionState(error: 'some_unrelated_failure'),
      );

      expect(find.text('Try again'), findsNothing);
      expect(find.textContaining('some_unrelated_failure'), findsNothing);
    });

    testWidgets('a finished analysis still wins over a stale error', (
      tester,
    ) async {
      await pump(
        tester,
        StudyPlanSessionState(
          error: analysisErrorFailed,
          analyses: [
            StudyPlanAnalysis.fromJson(const {
              'id': 'a1',
              'session_id': 's1',
              'draft_id': 'd1',
              'ai_response': 'Your draft is clear and specific.',
            }),
          ],
        ),
      );

      expect(find.textContaining('clear and specific'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });
  });
}

/// Seeds [studyPlanSessionProvider] with a fixed map.
class _StubNotifier extends StudyPlanSessionNotifier {
  _StubNotifier(this._seed);

  final Map<String, StudyPlanSessionState> _seed;

  @override
  Map<String, StudyPlanSessionState> build() => _seed;
}
