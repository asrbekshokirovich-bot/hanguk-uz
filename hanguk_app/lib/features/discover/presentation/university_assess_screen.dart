import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_slider.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../assessment/data/admission_tests_repository.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../assessment/domain/admission_tests.dart';
import '../../assessment/domain/assessment.dart';
import '../../auth/data/auth_repository.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/domain/quiz_answers.dart';
import '../../training/presentation/interview_screen.dart';
import '../data/chances.dart';
import 'study_plan_test_screen.dart';
import 'widgets/assess_parts.dart';
import 'widgets/page_tour.dart';
import '../data/board_tour.dart';
import 'widgets/app_nav.dart';
import 'widgets/chance_cards.dart';
import 'widgets/fd_bottom_nav.dart';

/// The Study Plan test: three questions in four minutes.
const int kStudyPlanTestQuestions = 3;
const int kStudyPlanTestMinutes = 4;

/// The interview test: three questions in three minutes.
const int kInterviewTestQuestions = 3;
const int kInterviewTestMinutes = 3;

/// One university's assessment (design: "Baholash"): the twelve questions in
/// three groups — each with what its answer does to this university's
/// admission — the two tests, and the chance with how sure it is and what
/// would raise it.
class UniversityAssessScreen extends ConsumerStatefulWidget {
  const UniversityAssessScreen({super.key, required this.institutionId});

  final String institutionId;

  @override
  ConsumerState<UniversityAssessScreen> createState() => _UniversityAssessScreenState();
}

class _UniversityAssessScreenState extends ConsumerState<UniversityAssessScreen> {
  final Set<int> _closed = {};

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = ref.watch(catalogProvider).value?.where((u) => u.institutionId == widget.institutionId).firstOrNull;
    return Scaffold(
      backgroundColor: Colors.transparent,
      bottomNavigationBar: const AppNav(current: AppTab.universities),
      floatingActionButton: const AppNavOrb(current: AppTab.universities),
      floatingActionButtonLocation: kFdNavOrbLocation,
      body: FdPage(
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 8),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: () => context.canPop() ? context.pop() : context.go('/'),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        u?.displayName ?? l.uaTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: fdText(18, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.36),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: u == null
                    ? const Center(child: CircularProgressIndicator(color: FdColors.lime))
                    : PageTour(
                        name: 'university_assess',
                        seen: tourSeenProvider('university_assess'),
                        steps: (context) {
                          Widget icon(LucideGlyph g) => Lucide(g, size: 16, color: FdColors.onLime);
                          return [
                            TourStep(l.taAcademic, icon: icon(LucideIcons.graduationCap)),
                            TourStep(l.taLanguage, icon: icon(LucideIcons.languages)),
                            TourStep(l.taDocuments, icon: icon(LucideIcons.fileText)),
                            TourStep(l.taTests, icon: icon(LucideIcons.target)),
                            TourStep(l.taResult, icon: icon(LucideIcons.award)),
                          ];
                        },
                        builder: (context, keys) => _body(context, l, u, keys),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, AppLocalizations l, CatalogUniversity u, List<GlobalKey> keys) {
    final input = ref.watch(assessmentProvider);
    final book = ref.watch(chanceBookProvider);
    final tests = book.testsOf(u);
    void set(AssessmentInput next) => ref.read(assessmentProvider.notifier).set(next);

    // What an answer does to this university's admission: against the
    // answer that changes nothing (its "Yo'q", a 3.5 certificate, bachelor).
    final g = book.guidelineOf(u);
    int profile(AssessmentInput i) => admissionPercent(i, g, rules: book.rules);
    int gain(AssessmentInput Function(AssessmentInput) neutral) => profile(input) - profile(neutral(input));

    Widget section(int id, LucideGlyph glyph, String title, List<AssessQuestion> questions) {
      final total = gain((i) => questions.fold(i, (x, q) => q.neutral(x)));
      return AssessSection(
        glyph: glyph,
        title: title,
        trailing: total == 0 ? null : AssessImpact(admission: total),
        open: !_closed.contains(id),
        onToggle: () => setState(() => _closed.contains(id) ? _closed.remove(id) : _closed.add(id)),
        children: [
          for (final q in questions) ...[
            AssessQuestionHead(
              label: q.label,
              impact: AssessImpact(admission: gain(q.neutral)),
            ),
            const SizedBox(height: 8),
            q.answer,
            const SizedBox(height: 14),
          ],
        ],
      );
    }

    final no = l.uaNo;
    final academic = [
      AssessQuestion(
        l.uaQDegree,
        (i) => i.copyWith(route: StudyRoute.bachelor),
        assessPills(
          [
            (StudyRoute.languageCourse, l.uaDegLanguage),
            (StudyRoute.bachelor, l.uaDegBachelor),
            (StudyRoute.master, l.uaDegMaster),
          ],
          input.route,
          (v) => set(input.copyWith(route: v)),
        ),
      ),
      AssessQuestion(
        l.uaQGpa,
        (i) => i.copyWith(gpa: 3.5),
        Row(
          children: [
            Expanded(
              child: HardSlider(
                value: (input.gpa - 1) / 4,
                semanticLabel: l.uaQGpa,
                onChanged: (v) => set(input.copyWith(gpa: ((1 + 4 * v) * 10).round() / 10)),
              ),
            ),
            const SizedBox(width: 10),
            AssessValue(l.uaGpaValue(input.gpa.toStringAsFixed(1))),
          ],
        ),
      ),
      AssessQuestion(
        l.uaQGap,
        (i) => i.copyWith(gapYears: 0),
        assessPills(
          [(0, l.uaGap0), (1, l.uaGap1), (2, l.uaGap2), (3, l.uaGap3)],
          input.gapYears,
          (v) => set(input.copyWith(gapYears: v)),
        ),
      ),
      AssessQuestion(
        l.uaQExperience,
        (i) => i.copyWith(experience: 0),
        assessPills(
          [(0, no), (1, l.uaExpCourse), (2, l.uaExpProject), (3, l.uaExpWork)],
          input.experience,
          (v) => set(input.copyWith(experience: v)),
        ),
      ),
      AssessQuestion(
        l.uaQOlympiad,
        (i) => i.copyWith(olympiad: 0),
        assessPills(
          [(0, no), (1, l.uaOlSchool), (2, l.uaOlNational), (3, l.uaOlInternational)],
          input.olympiad,
          (v) => set(input.copyWith(olympiad: v)),
        ),
      ),
    ];
    final language = [
      AssessQuestion(
        l.uaQTopik,
        (i) => i.copyWith(topik: 0),
        assessPills(
          [(0, no), for (var t = 1; t <= 6; t++) (t, '$t')],
          input.topik,
          (v) => set(input.copyWith(topik: v)),
        ),
      ),
      AssessQuestion(
        l.uaQTopikCert,
        (i) => i.copyWith(topikFresh: true),
        assessPills(
          [(false, l.uaCertOld), (true, l.uaCertFresh)],
          input.topikFresh,
          (v) => set(input.copyWith(topikFresh: v)),
        ),
      ),
      AssessQuestion(
        l.uaQIelts,
        (i) => i.copyWith(ielts: 0),
        assessPills(
          [(0.0, no), (5.0, '5.0'), (5.5, '5.5'), (6.0, '6.0'), (6.5, '6.5'), (7.0, '7.0+')],
          input.ielts,
          (v) => set(input.copyWith(ielts: v)),
        ),
      ),
    ];
    final documents = [
      AssessQuestion(
        l.uaQMotivation,
        (i) => i.copyWith(motivation: 0),
        assessPills(
          [(0, no), (1, l.uaMotDraft), (2, l.uaMotReady)],
          input.motivation,
          (v) => set(input.copyWith(motivation: v)),
        ),
      ),
      AssessQuestion(
        l.uaQRecommendation,
        (i) => i.copyWith(recommendation: false),
        assessPills(
          [(false, no), (true, l.uaHave)],
          input.recommendation,
          (v) => set(input.copyWith(recommendation: v)),
        ),
      ),
      AssessQuestion(
        l.uaQPortfolio,
        (i) => i.copyWith(portfolio: false),
        assessPills([(false, no), (true, l.uaHave)], input.portfolio, (v) => set(input.copyWith(portfolio: v))),
      ),
      AssessQuestion(
        l.uaQActivity,
        (i) => i.copyWith(activity: 0),
        assessPills(
          [(0, no), (1, l.uaActVolunteer), (2, l.uaActSportArt), (3, l.uaActLeader)],
          input.activity,
          (v) => set(input.copyWith(activity: v)),
        ),
      ),
    ];

    final admission = book.admission(u);
    final ways = _ways(l, book, u, input, tests);
    final taken = (tests.studyPlan != null ? 1 : 0) + (tests.interview != null ? 1 : 0);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
      children: [
        KeyedSubtree(key: keys[0], child: section(0, LucideIcons.graduationCap, l.uaSecAcademic, academic)),
        const SizedBox(height: 12),
        KeyedSubtree(key: keys[1], child: section(1, LucideIcons.languages, l.uaSecLanguage, language)),
        const SizedBox(height: 12),
        KeyedSubtree(key: keys[2], child: section(2, LucideIcons.fileText, l.uaSecDocuments, documents)),
        const SizedBox(height: 12),
        AssessSection(
          key: keys[3],
          glyph: LucideIcons.target,
          title: l.uaSecTests,
          trailing: Text(l.uaTestsCount, style: fdText(11, FontWeight.w800, FdColors.good)),
          open: true,
          children: [
            _TestRow(
              glyph: LucideIcons.filePen,
              title: l.uaTestPlan,
              meta: l.uaTestMeta(u.displayName, kStudyPlanTestQuestions, kStudyPlanTestMinutes),
              score: tests.studyPlanAttempts > 0 ? tests.studyPlan : null,
              taken: tests.studyPlanAttempts > 0,
              onStart: () => _start(context, l, u, interview: false),
            ),
            const SizedBox(height: 8),
            _TestRow(
              glyph: LucideIcons.mic,
              title: l.uaTestTalk,
              meta: l.uaTestMeta(u.displayName, kInterviewTestQuestions, kInterviewTestMinutes),
              score: tests.interviewAttempts > 0 ? tests.interview : null,
              taken: tests.interviewAttempts > 0,
              onStart: () => _start(context, l, u, interview: true),
            ),
            const SizedBox(height: 4),
          ],
        ),
        const SizedBox(height: 16),
        ChanceCard(
          key: keys[4],
          label: l.uaResultTitle,
          percent: admission,
          note: switch (taken) {
            0 => l.uaAccuracyLow,
            1 => l.uaAccuracyMid,
            _ => l.uaAccuracyHigh,
          },
        ),
        if (tests.interview case final i? when i < kInterviewPass) ...[
          const SizedBox(height: 8),
          Text(l.uaInterviewFailed, style: fdText(12, FontWeight.w600, const Color(0xFFFFB4B4), height: 1.4)),
        ],
        if (ways.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(l.uaWays, style: fdText(11, FontWeight.w800, FdColors.pageMuted)),
          const SizedBox(height: 6),
          for (final w in ways) ...[
            BoostRow(label: w.$1, gain: l.uaImpactUp(w.$2), onTap: w.$3),
            const SizedBox(height: 6),
          ],
        ],
      ],
    );
  }

  /// What would raise this university's chance most, best first: the tests
  /// not yet taken, then the answers a student can still change.
  List<(String, int, VoidCallback)> _ways(
    AppLocalizations l,
    ChanceBook book,
    CatalogUniversity u,
    AssessmentInput input,
    AdmissionTests tests,
  ) {
    final g = book.guidelineOf(u);
    final now = book.admission(u);
    int with_(AssessmentInput i) => combinedAdmission(admissionPercent(i, g, rules: book.rules), tests);
    final out = <(String, int, VoidCallback)>[];
    void add(String label, int gain) {
      if (gain > 0) out.add((label, gain, () {}));
    }

    if (input.topikCounted < 6) {
      final next = input.topikCounted + 1;
      add(l.uaWayTopik(next), with_(input.copyWith(topik: next, topikFresh: true)) - now);
    }
    if (input.motivation < 2) add(l.uaWayMotivation, with_(input.copyWith(motivation: 2)) - now);
    if (!input.recommendation) add(l.uaWayRecommendation, with_(input.copyWith(recommendation: true)) - now);
    out.sort((a, b) => b.$2.compareTo(a.$2));
    return out.take(3).toList();
  }

  Future<void> _start(BuildContext context, AppLocalizations l, CatalogUniversity u, {required bool interview}) async {
    if (!ref.read(signedInProvider)) {
      context.push('/login', extra: {'notice': l.uaTestsNeedCode});
      return;
    }
    final page = interview
        ? InterviewScreen(
            initialSessionType: 'university_specific',
            initialUniversityId: u.institutionId,
            initialUniversityName: u.displayName,
            initialTimeLimitSeconds: kInterviewTestMinutes * 60,
            initialFocusTopic: 'Admission interview test: ask exactly $kInterviewTestQuestions questions',
          )
        : StudyPlanTestScreen(university: u);
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        settings: RouteSettings(name: interview ? 'interview_test' : 'study_plan_test'),
        builder: (_) => NavScaffold(current: AppTab.universities, child: page),
      ),
    );
    ref.invalidate(admissionTestsProvider);
  }
}

/// One test: its icon, name and terms, and "Boshlash" — or the score once
/// taken, as each is taken once.
class _TestRow extends StatelessWidget {
  const _TestRow({
    required this.glyph,
    required this.title,
    required this.meta,
    required this.taken,
    required this.score,
    required this.onStart,
  });

  final LucideGlyph glyph;
  final String title;
  final String meta;
  final bool taken;
  final int? score;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: !taken,
      child: GestureDetector(
        onTap: taken ? null : onStart,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.fromLTRB(10, 10, 12, 10),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(9)),
                child: Lucide(glyph, size: 16, color: FdColors.navy),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: fdText(14, FontWeight.w800, FdColors.ink, height: 1.2)),
                    const SizedBox(height: 2),
                    Text(taken ? l.uaTestTaken : meta, style: fdText(11, FontWeight.w500, FdColors.muted, height: 1.3)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                taken ? (score == null ? '—' : l.uaTestScore(score!)) : l.uaTestStart,
                style: fdText(13, FontWeight.w800, taken ? FdColors.good : FdColors.blue),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
