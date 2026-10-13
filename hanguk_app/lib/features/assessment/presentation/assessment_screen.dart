import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_slider.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/campus_photos.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../discover/data/saved_universities.dart';
import '../../discover/presentation/discover_routes.dart';
import '../../onboarding/domain/quiz_answers.dart';
import '../data/assessment_controller.dart';
import '../domain/assessment.dart';
import 'assessment_widgets.dart';

/// The certificate slider's ends (Uzbek school grades pass from 3).
const double kGpaMin = 3.0;
const double kGpaMax = 5.0;

/// Design screen 11, "Baholash doskasi": the admission and visa meters on
/// top move as the answers below change — TOPIK, the certificate, the bank,
/// the degree and a past refusal. "Hisobotni ko'rish" opens the report (12).
class AssessmentScreen extends ConsumerStatefulWidget {
  const AssessmentScreen({super.key, this.startId});

  /// The university the student came from, weighed first.
  final String? startId;

  @override
  ConsumerState<AssessmentScreen> createState() => _AssessmentScreenState();
}

class _AssessmentScreenState extends ConsumerState<AssessmentScreen> {
  bool _seeded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _seed());
  }

  void _seed() {
    final catalog = ref.read(catalogProvider).value;
    if (_seeded || catalog == null) return;
    _seeded = true;
    ref.read(assessmentProvider.notifier).startFrom(widget.startId, catalog, ref.read(savedUniversitiesProvider));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    ref.listen(catalogProvider, (_, _) => _seed());
    final input = ref.watch(assessmentProvider);
    final outcome = ref.watch(assessmentOutcomeProvider);
    final notifier = ref.read(assessmentProvider.notifier);
    void set(AssessmentInput next) => notifier.set(next);

    final required = outcome?.requiredBankKrw ?? 0;
    final bankMax = required * 2 > 40000000 ? required * 2 : 40000000;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          bottom: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: () => context.pop(),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: _AssessTitle(lead: l.fdAssessTitleLead, mark: l.fdAssessTitleMark)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: outcome == null
                    ? const SizedBox(height: 120, child: Center(child: CircularProgressIndicator(color: FdColors.navy)))
                    : _Meters(outcome: outcome, input: input),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                  children: [
                    FdSectionLabel(l.fdAssessTopik),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        for (var t = 0; t <= 6; t++) ...[
                          if (t > 0) const SizedBox(width: 4),
                          Expanded(
                            child: HardChoice(
                              label: t == 0 ? '—' : '$t',
                              radius: 10,
                              fontWeight: FontWeight.w800,
                              selected: input.topik == t,
                              onTap: () => set(input.copyWith(topik: t)),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 16),
                    FdSectionLabel(l.fdAssessGpa, trailing: LimeTag(input.gpa.toStringAsFixed(1))),
                    const SizedBox(height: 4),
                    HardSlider(
                      value: (input.gpa - kGpaMin) / (kGpaMax - kGpaMin),
                      semanticLabel: l.fdAssessGpa,
                      onChanged: (v) {
                        final g = kGpaMin + (kGpaMax - kGpaMin) * v;
                        set(input.copyWith(gpa: (g * 10).round() / 10));
                      },
                    ),
                    const SizedBox(height: 12),
                    FdSectionLabel(l.fdAssessBank, trailing: LimeTag(_mln(l, input.bankKrw))),
                    const SizedBox(height: 4),
                    HardSlider(
                      value: (input.bankKrw / bankMax).clamp(0.0, 1.0),
                      semanticLabel: l.fdAssessBank,
                      marker: required == 0 ? null : (required / bankMax).clamp(0.0, 1.0),
                      markerLabel: required == 0 ? null : l.fdAssessBankNeed(_mln(l, required)),
                      onChanged: (v) => set(input.copyWith(bankKrw: (bankMax * v / 1000000).round() * 1000000)),
                    ),
                    const SizedBox(height: 12),
                    FdSectionLabel(l.fdSectionDegree),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        for (final (i, (route, label)) in [
                          (StudyRoute.bachelor, l.catalogDegreeBachelor),
                          (StudyRoute.master, l.catalogDegreeMaster),
                          (StudyRoute.languageCourse, l.fdLanguageCourse),
                        ].indexed) ...[
                          if (i > 0) const SizedBox(width: 6),
                          Expanded(
                            child: HardChoice(
                              label: label,
                              selected: input.route == route,
                              onTap: () {
                                set(input.copyWith(route: route));
                                final catalog = ref.read(catalogProvider).value;
                                if (catalog != null) {
                                  notifier.startFrom(widget.startId, catalog, ref.read(savedUniversitiesProvider));
                                }
                              },
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 16),
                    FdSectionLabel(l.fdAssessRefused),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: HardChoice(
                            label: l.fdNo,
                            selected: !input.visaRefused,
                            onTap: () => set(input.copyWith(visaRefused: false)),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: HardChoice(
                            label: l.fdYes,
                            selected: input.visaRefused,
                            onTap: () => set(input.copyWith(visaRefused: true)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              FdBottomBar(
                child: HardButton(
                  label: l.fdAssessSeeReport,
                  onPressed: outcome == null ? null : () => context.push(kAssessmentReportPath),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// "₩18 mln".
  static String _mln(AppLocalizations l, int krw) => l.fdMln((krw / 1000000).round());
}

/// "Koreaga keta olamanmi o'zi?" with the last word marked.
class _AssessTitle extends StatelessWidget {
  const _AssessTitle({required this.lead, required this.mark});

  final String lead;
  final String mark;

  @override
  Widget build(BuildContext context) {
    final style = fdText(18, FontWeight.w800, FdColors.ink, letterSpacing: -0.36);
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.end,
      children: [Text('$lead ', style: style), LimeMark(mark, style: style)],
    );
  }
}

/// The navy card: one row per university and the D-2 visa row, then the
/// hint of what one more TOPIK level would change.
class _Meters extends StatelessWidget {
  const _Meters({required this.outcome, required this.input});

  final AssessmentOutcome outcome;
  final AssessmentInput input;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final hint = _topikHint(l);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: FdColors.navy,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.fdAssessAdmissionCount(outcome.chances.length), style: fdText(11, FontWeight.w700, FdColors.onNavyMuted)),
          for (final c in outcome.chances) ...[
            const SizedBox(height: 8),
            _MeterRow(
              thumb: _Thumb(institutionId: c.university.institutionId, name: c.university.nameKoShort ?? c.university.displayName),
              name: shortUniversityName(c.university.displayName),
              percent: c.percent,
            ),
          ],
          const SizedBox(height: 8),
          const ColoredBox(color: Color(0x26FFFFFF), child: SizedBox(height: 1.5)),
          const SizedBox(height: 8),
          _MeterRow(
            thumb: Container(
              width: 36,
              height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: FdColors.lime,
                borderRadius: BorderRadius.circular(5),
                border: Border.all(color: FdColors.ink, width: 1.5),
              ),
              child: Text('D-2', style: fdText(9, FontWeight.w800, FdColors.onLime)),
            ),
            name: l.fdVisa,
            percent: outcome.visaPercent,
          ),
          if (hint != null) ...[
            const SizedBox(height: 8),
            Text(hint, style: fdText(11, FontWeight.w400, FdColors.onNavyMuted)),
          ],
        ],
      ),
    );
  }

  /// "TOPIK 4 → Chonnam qabuli «Yuqori» bo'ladi": the university whose word
  /// one more TOPIK level would lift the most.
  String? _topikHint(AppLocalizations l) {
    if (input.topik >= 6) return null;
    final up = input.copyWith(topik: input.topik + 1);
    AdmissionChance? best;
    var bestGain = 0;
    for (final c in outcome.chances) {
      final p = admissionPercent(up, c.guideline);
      if (segmentsOf(p) > segmentsOf(c.percent) && p - c.percent > bestGain) {
        best = AdmissionChance(university: c.university, guideline: c.guideline, percent: p);
        bestGain = p - c.percent;
      }
    }
    if (best == null) return null;
    return l.fdAssessTopikHint(input.topik + 1, shortUniversityName(best.university.displayName), segmentWord(l, best.percent));
  }
}

class _MeterRow extends StatelessWidget {
  const _MeterRow({required this.thumb, required this.name, required this.percent});

  final Widget thumb;
  final String name;
  final int percent;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        thumb,
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: fdText(12, FontWeight.w700, Colors.white),
          ),
        ),
        const SizedBox(width: 8),
        SegmentMeter(percent: percent),
        SizedBox(width: 78, child: SegmentLabel(percent: percent)),
      ],
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.institutionId, required this.name});

  final String institutionId;
  final String name;

  @override
  Widget build(BuildContext context) {
    final photo = campusPhotoAsset(institutionId);
    return Container(
      width: 36,
      height: 22,
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: FdColors.deep,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: photo != null
          ? Image.asset(photo, width: 36, height: 22, fit: BoxFit.cover, cacheWidth: 108)
          : FittedBox(
              fit: BoxFit.scaleDown,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Text(name, maxLines: 1, style: fdText(7, FontWeight.w800, Colors.white)),
              ),
            ),
    );
  }
}
