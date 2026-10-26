import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_slider.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../assessment/domain/assessment.dart';
import '../../assessment/domain/visa_model.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../../onboarding/domain/quiz_answers.dart';
import '../data/board_tour.dart';
import '../data/slots.dart';
import 'filter_board_screen.dart' show boardResults;
import 'discover_routes.dart';
import 'widgets/app_nav.dart';
import 'widgets/assess_parts.dart';
import 'widgets/fd_bottom_nav.dart';
import 'widgets/page_tour.dart';

/// "Vizam chiqadimi?" (design, 2026-10-21): the D-2 visa chance on a
/// half-dial, and the questions in five groups — Ta'lim, Til, Moliya, Tarix,
/// Tayyorgarlik — each saying what its answer does to the visa and to
/// admission. The round "BAHOLASH" button opens it.
class VisaScreen extends ConsumerStatefulWidget {
  const VisaScreen({super.key, this.embedded = false, this.active = true});

  /// The home tab's content: the shell draws the page and the nav.
  final bool embedded;

  /// False while it is the home's tab under another tab: its tour waits.
  final bool active;

  @override
  ConsumerState<VisaScreen> createState() => _VisaScreenState();
}

class _VisaScreenState extends ConsumerState<VisaScreen> {
  final Set<int> _closed = {};

  /// `assessment_start` goes once per visit, with the first answer changed.
  bool _started = false;

  @override
  Widget build(BuildContext context) {
    final tour = _tour();
    if (widget.embedded) return tour;
    return Scaffold(
      backgroundColor: Colors.transparent,
      bottomNavigationBar: const AppNav(current: AppTab.home),
      floatingActionButton: AppNavOrb(current: AppTab.home, onTap: () {}),
      floatingActionButtonLocation: kFdNavOrbLocation,
      body: FdPage(child: tour),
    );
  }

  Widget _tour() => PageTour(
    name: 'visa',
    active: widget.active,
    seen: tourSeenProvider('visa'),
    steps: (context) {
      final l = AppLocalizations.of(context)!;
      Widget icon(LucideGlyph g) => Lucide(g, size: 16, color: FdColors.onLime);
      return [
        TourStep(l.vzTourGauge, icon: icon(LucideIcons.plane)),
        TourStep(l.vzTourEducation, icon: icon(LucideIcons.graduationCap)),
        TourStep(l.vzTourLanguage, icon: icon(LucideIcons.languages)),
        TourStep(l.vzTourMoney, icon: icon(LucideIcons.wallet)),
        TourStep(l.vzTourHistory, icon: icon(LucideIcons.history)),
        TourStep(l.vzTourPrep, icon: icon(LucideIcons.target)),
        TourStep(l.vzTourReplay, icon: icon(LucideIcons.chevronRight), align: TourAlign.end),
      ];
    },
    builder: (context, keys) => SafeArea(bottom: false, child: _body(context, keys)),
  );

  Widget _body(BuildContext context, List<GlobalKey> keys) {
    final l = AppLocalizations.of(context)!;
    final input = ref.watch(assessmentProvider);
    final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final picked = {for (final id in ref.watch(slotsProvider)) ?id};
    final pool = picked.isEmpty
        ? boardResults(ref, all, ref.watch(catalogFilterProvider)).take(40).toList()
        : all.where((u) => picked.contains(u.institutionId)).toList();
    final chosen = all.where((u) => picked.contains(u.institutionId)).toList();
    final need = requiredBank(input.route, chosen, rules: rules);
    void set(AssessmentInput next) {
      if (!_started) {
        _started = true;
        AppEvents.track('assessment_start', props: {'kind': 'visa', 'universities': chosen.length});
      }
      ref.read(assessmentProvider.notifier).set(next);
    }

    int visa(AssessmentInput i) => visaScore(i, requiredBankKrw: need);
    // Admission: the best of the picked universities (or of the board's).
    int admission(AssessmentInput i) {
      var best = 0;
      for (final u in pool) {
        final degree = i.route.catalogDegree;
        final g = degree == null ? u.primary : u.forDegree(degree) ?? u.primary;
        final p = admissionPercent(i, g, rules: rules);
        if (p > best) best = p;
      }
      return best;
    }

    final nowVisa = visa(input);
    final nowAdmission = admission(input);
    AssessImpact impact(AssessmentInput Function(AssessmentInput) neutral) {
      final n = neutral(input);
      return AssessImpact(visa: nowVisa - visa(n), admission: pool.isEmpty ? 0 : nowAdmission - admission(n));
    }

    Widget section(int id, GlobalKey key, LucideGlyph glyph, String title, List<_Q> questions) {
      final n = questions.fold(input, (x, q) => q.neutral(x));
      final total = nowVisa - visa(n);
      return KeyedSubtree(
        key: key,
        child: AssessSection(
          glyph: glyph,
          title: title,
          trailing: total == 0 ? null : AssessImpact(visa: total),
          open: !_closed.contains(id),
          onToggle: () => setState(() => _closed.contains(id) ? _closed.remove(id) : _closed.add(id)),
          children: [
            for (final q in questions) ...[
              AssessQuestionHead(label: q.label, impact: impact(q.neutral)),
              const SizedBox(height: 8),
              q.answer,
              const SizedBox(height: 14),
            ],
          ],
        ),
      );
    }

    final no = l.uaNo;
    final yesNo = [(false, no), (true, l.vzYes)];
    final noHave = [(false, no), (true, l.uaHave)];
    final counts = [(0, no), (1, l.vzOne), (2, l.vzTwoPlus)];
    Widget slider(String label, double value, ValueChanged<double> onChanged, String shown) => Row(
      children: [
        Expanded(
          child: HardSlider(value: value, semanticLabel: label, onChanged: onChanged),
        ),
        const SizedBox(width: 10),
        AssessValue(shown),
      ],
    );

    final education = [
      _Q(
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
      _Q(
        l.vzQEducation,
        (i) => i.copyWith(education: 0),
        assessPills(
          [(0, l.vzEduSchool), (1, l.vzEduCollege), (2, l.uaDegBachelor), (3, l.uaDegMaster)],
          input.education,
          (v) => set(input.copyWith(education: v)),
        ),
      ),
      _Q(
        l.uaQGpa,
        (i) => i.copyWith(gpa: 3.5),
        slider(
          l.uaQGpa,
          (input.gpa - 1) / 4,
          (v) => set(input.copyWith(gpa: ((1 + 4 * v) * 10).round() / 10)),
          l.uaGpaValue(input.gpa.toStringAsFixed(1)),
        ),
      ),
      _Q(
        l.uaQGap,
        (i) => i.copyWith(gapYears: 0),
        assessPills(
          [(0, l.uaGap0), (1, l.uaGap1), (2, l.uaGap2), (3, l.uaGap3)],
          input.gapYears,
          (v) => set(input.copyWith(gapYears: v)),
        ),
      ),
      _Q(
        l.vzQAge,
        (i) => i.copyWith(age: 19),
        slider(
          l.vzQAge,
          (input.age - kVisaAgeMin) / (kVisaAgeMax - kVisaAgeMin),
          (v) => set(input.copyWith(age: (kVisaAgeMin + (kVisaAgeMax - kVisaAgeMin) * v).round())),
          l.vzAgeValue(input.age),
        ),
      ),
    ];
    final language = [
      _Q(
        l.uaQTopik,
        (i) => i.copyWith(topik: 0),
        assessPills(
          [(0, no), for (var t = 1; t <= 6; t++) (t, '$t')],
          input.topik,
          (v) => set(input.copyWith(topik: v)),
        ),
      ),
      _Q(
        l.uaQTopikCert,
        (i) => i.copyWith(topikFresh: true),
        assessPills(
          [(false, l.uaCertOld), (true, l.uaCertFresh)],
          input.topikFresh,
          (v) => set(input.copyWith(topikFresh: v)),
        ),
      ),
      _Q(
        l.uaQIelts,
        (i) => i.copyWith(ielts: 0),
        assessPills(
          [
            (0.0, no),
            for (final b in const [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]) (b, b.toStringAsFixed(1)),
          ],
          input.ielts,
          (v) => set(input.copyWith(ielts: v)),
        ),
      ),
    ];
    final money = [
      _Q(
        l.vzQIncome,
        (i) => i.copyWith(income: 0),
        assessPills(
          [(0, l.vzIncome0), (1, l.vzIncome1), (2, l.vzIncome2), (3, l.vzIncome3)],
          input.income,
          (v) => set(input.copyWith(income: v)),
        ),
      ),
      _Q(
        l.vzQIncomeDocumented,
        (i) => i.copyWith(incomeDocumented: false),
        assessPills(yesNo, input.incomeDocumented, (v) => set(input.copyWith(incomeDocumented: v))),
      ),
      _Q(
        l.vzQSponsor,
        (i) => i.copyWith(sponsor: 0),
        assessPills(
          [(0, l.vzSponsorSelf), (1, l.vzSponsorParents), (2, l.vzSponsorRelative)],
          input.sponsor,
          (v) => set(input.copyWith(sponsor: v)),
        ),
      ),
      _Q(
        l.vzQRelationDoc,
        (i) => i.copyWith(relationDoc: false),
        assessPills(noHave, input.relationDoc, (v) => set(input.copyWith(relationDoc: v))),
      ),
      _Q(
        l.vzQStability,
        (i) => i.copyWith(incomeStability: 0),
        assessPills(
          [(0, l.vzStable0), (1, l.vzStable1), (2, l.vzStable2), (3, l.vzStable3)],
          input.incomeStability,
          (v) => set(input.copyWith(incomeStability: v)),
        ),
      ),
      _Q(
        l.vzQProperty,
        (i) => i.copyWith(property: 0),
        assessPills(counts, input.property, (v) => set(input.copyWith(property: v))),
      ),
      _Q(l.vzQCar, (i) => i.copyWith(car: 0), assessPills(counts, input.car, (v) => set(input.copyWith(car: v)))),
      _Q(
        l.vzQBusiness,
        (i) => i.copyWith(business: 0),
        assessPills(
          [(0, no), (1, l.vzBusinessIp), (2, l.vzBusinessLlc)],
          input.business,
          (v) => set(input.copyWith(business: v)),
        ),
      ),
    ];
    final history = [
      _Q(
        l.vzQRefused,
        (i) => i.copyWith(visaRefused: false),
        assessPills(yesNo, input.visaRefused, (v) => set(input.copyWith(visaRefused: v))),
      ),
      _Q(
        l.vzQKoreaBefore,
        (i) => i.copyWith(koreaBefore: 0),
        assessPills(
          [(0, no), (1, l.vzKoreaOnTime), (2, l.vzKoreaOverstay)],
          input.koreaBefore,
          (v) => set(input.copyWith(koreaBefore: v)),
        ),
      ),
      _Q(
        l.vzQIllegalRelatives,
        (i) => i.copyWith(illegalRelatives: false),
        assessPills(yesNo, input.illegalRelatives, (v) => set(input.copyWith(illegalRelatives: v))),
      ),
      _Q(
        l.vzQLegalRelatives,
        (i) => i.copyWith(legalRelatives: false),
        assessPills(yesNo, input.legalRelatives, (v) => set(input.copyWith(legalRelatives: v))),
      ),
    ];
    final prep = [
      _Q(
        l.vzQStudyPlan,
        (i) => i.copyWith(studyPlan: 0),
        assessPills(
          [(0, no), (1, l.uaMotDraft), (2, l.uaMotReady)],
          input.studyPlan,
          (v) => set(input.copyWith(studyPlan: v)),
        ),
      ),
      _Q(
        l.vzQInterview,
        (i) => i.copyWith(interviewPrep: 0),
        assessPills(
          [(0, no), (1, l.vzInterviewSelf), (2, l.vzInterviewAi)],
          input.interviewPrep,
          (v) => set(input.copyWith(interviewPrep: v)),
        ),
      ),
      _Q(
        l.uaQMotivation,
        (i) => i.copyWith(motivation: 0),
        assessPills(
          [(0, no), (1, l.uaMotDraft), (2, l.uaMotReady)],
          input.motivation,
          (v) => set(input.copyWith(motivation: v)),
        ),
      ),
      _Q(
        l.uaQRecommendation,
        (i) => i.copyWith(recommendation: false),
        assessPills(noHave, input.recommendation, (v) => set(input.copyWith(recommendation: v))),
      ),
    ];

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 6, 18, 10),
          child: Row(
            children: [
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  children: [
                    Text(l.vzTitle, style: fdText(22, FontWeight.w800, FdColors.onPage, letterSpacing: -0.44)),
                    LimeMark(l.vzTitleMark, style: fdText(22, FontWeight.w800, FdColors.onPage, letterSpacing: -0.44)),
                  ],
                ),
              ),
              _ClearButton(
                label: l.catalogFilterClear,
                onTap: () => ref
                    .read(assessmentProvider.notifier)
                    .set(AssessmentInput(universityIds: input.universityIds, bankKrw: input.bankKrw)),
              ),
              const SizedBox(width: 8),
              KeyedSubtree(
                key: keys[6],
                child: Builder(
                  builder: (context) =>
                      _PlayButton(label: l.vzTourReplay, onTap: () => PageTourScope.maybeReplayOf(context)?.call()),
                ),
              ),
            ],
          ),
        ),
        // The gauge stays put; the questions scroll under it.
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
          child: KeyedSubtree(
            key: keys[0],
            child: _GaugeCard(
              percent: nowVisa,
              consultant: visaWithConsultant(input, requiredBankKrw: need),
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 16),
            children: [
              section(0, keys[1], LucideIcons.graduationCap, l.vzSecEducation, education),
              const SizedBox(height: 12),
              section(1, keys[2], LucideIcons.languages, l.uaSecLanguage, language),
              const SizedBox(height: 12),
              section(2, keys[3], LucideIcons.wallet, l.vzSecMoney, money),
              const SizedBox(height: 12),
              section(3, keys[4], LucideIcons.history, l.vzSecHistory, history),
              const SizedBox(height: 12),
              section(4, keys[5], LucideIcons.target, l.vzSecPrep, prep),
            ],
          ),
        ),
        FdBottomBar(
          aboveNav: true,
          child: HardButton(
            label: l.vzReport,
            onPressed: () {
              final picks = ref.read(slotsProvider).whereType<String>().toList();
              final ids = picks.isNotEmpty ? picks : [for (final u in pool.take(3)) u.institutionId];
              ref.read(assessmentProvider.notifier).useUniversities(ids);
              context.push(kAssessmentReportPath);
            },
          ),
        ),
      ],
    );
  }
}

const int kVisaAgeMin = 16;
const int kVisaAgeMax = 40;

typedef _Q = AssessQuestion;

class _ClearButton extends StatelessWidget {
  const _ClearButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: FdColors.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
        child: Text(label, style: fdText(13, FontWeight.w800, FdColors.ink)),
      ),
    ),
  );
}

/// The ▷ that runs the page's tour again.
class _PlayButton extends StatelessWidget {
  const _PlayButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    excludeSemantics: true,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: FdColors.lime,
          shape: BoxShape.circle,
          border: Border.all(color: FdColors.ink, width: 1.5),
          boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(2, 2))],
        ),
        child: const Icon(Icons.play_arrow_outlined, size: 20, color: FdColors.onLime),
      ),
    ),
  );
}

/// The blue card: the half-dial with the chance in it, and beside it "VIZA
/// D-2", the word, what it asks, and the chance with a consultant.
class _GaugeCard extends StatelessWidget {
  const _GaugeCard({required this.percent, required this.consultant});

  final int percent;
  final int consultant;

  static const _red = Color(0xFFF87171);
  static const _amber = Color(0xFFFDBA4D);
  static const _green = Color(0xFF4ADE80);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final (color, word, hint) = percent >= 65
        ? (_green, l.vzBandHigh, l.vzBandHighHint)
        : percent >= 40
        ? (_amber, l.vzBandMid, l.vzBandMidHint)
        : (_red, l.vzBandLow, l.vzBandLowHint);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [FdColors.blue, FdColors.blueDeep],
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 140,
            height: 80,
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: percent.toDouble()),
              duration: const Duration(milliseconds: 600),
              curve: Curves.easeOutCubic,
              builder: (context, v, _) => CustomPaint(
                painter: _ArcPainter(value: v, color: color),
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${v.round()}', style: fdText(30, FontWeight.w800, Colors.white, height: 1)),
                        TextSpan(text: '%', style: fdText(16, FontWeight.w800, color, height: 1)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.fdBoardVisaTitle, style: fdText(11, FontWeight.w800, FdColors.lime, letterSpacing: 0.6)),
                const SizedBox(height: 3),
                Text(word, style: fdText(16, FontWeight.w800, color, height: 1.15)),
                Text(hint, style: fdText(11, FontWeight.w600, Colors.white, height: 1.3)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    color: FdColors.lime,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: FdColors.ink, width: 1.5),
                  ),
                  child: Text(
                    l.vzWithConsultant(consultant),
                    style: fdText(11, FontWeight.w800, FdColors.onLime, height: 1.2),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The half-dial: a dark track, the chance's arc in its colour, and a white
/// knob at its end.
class _ArcPainter extends CustomPainter {
  const _ArcPainter({required this.value, required this.color});

  final double value;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 12.0;
    final r = math.min(size.width / 2, size.height) - stroke / 2 - 2;
    final c = Offset(size.width / 2, size.height - 4);
    final rect = Rect.fromCircle(center: c, radius: r);
    final track = Paint()
      ..color = const Color(0x40FFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, math.pi, math.pi, false, track);
    final sweep = math.pi * (value.clamp(0, 100) / 100);
    canvas.drawArc(rect, math.pi, sweep, false, track..color = color);
    final end = c + Offset(math.cos(math.pi + sweep), math.sin(math.pi + sweep)) * r;
    canvas.drawCircle(end, stroke / 2 + 2, Paint()..color = Colors.white);
    canvas.drawCircle(
      end,
      stroke / 2 + 2,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.value != value || old.color != color;
}
