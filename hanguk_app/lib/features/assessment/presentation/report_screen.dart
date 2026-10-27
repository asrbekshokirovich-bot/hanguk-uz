import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/tracked.dart';
import '../../../core/push/guest_push.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../discover/presentation/discover_routes.dart';
import '../../discover/presentation/widgets/chance_badge.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../data/assessment_controller.dart';
import '../domain/assessment.dart';
import 'assessment_widgets.dart' show shortUniversityName;

/// The deep blue under the report's call button (the prototype's `#061B7A`).
const Color _kBlueShadow = Color(0xFF061B7A);

/// Prototype screen 6, "Koreaga keta olamanmi?": on a solid blue page the
/// verdict as a headline, the best admission chance and the D-2 chance, the
/// jobs that raise them, a bar per university, and the button that leads to
/// the lead form ([kAssessmentLeadPath]). The figures are the assessment's
/// own — nothing here is a mock.
class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  bool _resultSent = false;

  /// What the report showed, for the analytics: the visa's band and each
  /// university's chance, as tens of percent (S5: ranges, not figures); with
  /// the visa, what the lead's card shows — the weak point, the TOPIK level,
  /// whether the income is documented, the tariff (VisaHints).
  void _sendResult(AssessmentOutcome o) {
    if (_resultSent) return;
    _resultSent = true;
    final h = o.hints;
    AppEvents.track('assessment_result', props: {
      'kind': 'visa',
      'band': o.band.name,
      'score_bucket': o.visaPercent ~/ 10 * 10,
      if (h != null) ...{
        'low': h.low,
        'topik': ref.read(assessmentProvider).topikCounted,
        'income': h.formalIncome ? 'yes' : 'no',
        'tariff': h.tariff.code,
      },
    });
    for (final c in o.chances) {
      AppEvents.track('assessment_result', props: {
        'kind': 'admission',
        'institution_id': c.university.institutionId,
        'score_bucket': c.percent ~/ 10 * 10,
      });
    }
  }

  @override
  void initState() {
    super.initState();
    AppEvents.track('report_view', props: {'universities': ref.read(assessmentProvider).universityIds.length});
    // A guest is asked once, a moment after the report shows, whether we
    // may send news on deadlines and scholarships (GuestPush, plan stage 5).
    _pushAsk = Timer(const Duration(seconds: 3), () {
      if (mounted) unawaited(GuestPush.maybeAsk(context));
    });
  }

  Timer? _pushAsk;

  @override
  void dispose() {
    _pushAsk?.cancel();
    super.dispose();
  }

  String _shareText(AppLocalizations l, AssessmentOutcome o) => [
    '${l.fdAssessTitleLead} ${l.fdAssessTitleMark}',
    _head(l, o.band),
    for (final c in o.chances) '${c.university.displayName}: ${c.percent}%',
    '${l.fdVisa} D-2: ${o.visaPercent}%',
  ].join('\n');

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final outcome = ref.watch(assessmentOutcomeProvider);
    if (outcome == null) {
      return const Scaffold(
        backgroundColor: FdColors.blue,
        body: FdPage(solid: FdColors.blue, child: Center(child: CircularProgressIndicator(color: FdColors.lime))),
      );
    }
    _sendResult(outcome);
    final best = outcome.chances.isEmpty
        ? null
        : outcome.chances.reduce((a, b) => b.percent > a.percent ? b : a);
    final jobs = outcome.fixes.length;

    return Scaffold(
      backgroundColor: FdColors.blue,
      body: FdPage(
        solid: FdColors.blue,
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: tracked('report.back', () => context.pop()),
                    ),
                    const Spacer(),
                    HardIconButton(
                      glyph: LucideIcons.share2,
                      semanticLabel: l.fdShare,
                      onTap: tracked('report.share', () => Share.share(_shareText(l, outcome))),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
                  children: [
                    Text(l.fdReportEyebrow, style: fdText(14, FontWeight.w800, FdColors.lime, letterSpacing: 1.1)),
                    const SizedBox(height: 10),
                    Text(
                      jobs == 0 ? _head(l, outcome.band) : '${_head(l, outcome.band)} ${l.fdReportJobsLeft(jobs)}',
                      style: fdText(44, FontWeight.w800, Colors.white, height: 1.05, letterSpacing: -1.5),
                    ),
                    const SizedBox(height: 16),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(child: _BestCard(best: best)),
                          const SizedBox(width: 12),
                          Expanded(child: _VisaCard(visa: outcome.visaPercent, consultant: outcome.visaWithConsultantPercent ?? outcome.visaPercent)),
                        ],
                      ),
                    ),
                    if (jobs > 0) ...[
                      const SizedBox(height: 14),
                      _JobsCard(fixes: outcome.fixes),
                    ],
                    const SizedBox(height: 16),
                    for (final c in outcome.chances) _UniBar(chance: c),
                  ],
                ),
              ),
              FdBottomBar(
                child: HardButton(
                  label: l.fdReportCta,
                  shadow: _kBlueShadow,
                  onPressed: tracked('report.cta', () => context.push(kAssessmentLeadPath)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _head(AppLocalizations l, EligibilityBand b) => switch (b) {
  EligibilityBand.high => l.fdReportHeadYes,
  EligibilityBand.mid => l.fdReportHeadMaybe,
  EligibilityBand.low => l.fdReportHeadNotYet,
};

BoxDecoration _cardBox() => BoxDecoration(
  color: FdColors.card,
  borderRadius: BorderRadius.circular(20),
  border: Border.all(color: FdColors.ink, width: 1.5),
);

/// "ENG YAXSHI QABUL 86% Keimyung".
class _BestCard extends StatelessWidget {
  const _BestCard({required this.best});

  final AdmissionChance? best;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final b = best;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardBox(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.fdReportBestAdmission, style: fdText(11, FontWeight.w800, FdColors.muted, letterSpacing: 0.3)),
          const SizedBox(height: 2),
          Text(
            b == null ? '?%' : '${b.percent}%',
            style: fdText(44, FontWeight.w800, b == null ? FdColors.muted : chanceLook(b.percent).accent, height: 1.1, letterSpacing: -1.5),
          ),
          if (b != null)
            Text(
              shortUniversityName(b.university.displayName),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: fdText(14, FontWeight.w800, FdColors.ink, height: 1.25),
            ),
        ],
      ),
    );
  }
}

/// "VIZA D-2 51% → 72% konsultant bilan".
class _VisaCard extends StatelessWidget {
  const _VisaCard({required this.visa, required this.consultant});

  final int visa;
  final int consultant;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardBox(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.fdReportVisaCard, style: fdText(11, FontWeight.w800, FdColors.muted, letterSpacing: 0.3)),
          const SizedBox(height: 2),
          Text(
            '$visa%',
            style: fdText(44, FontWeight.w800, chanceLook(visa).accent, height: 1.1, letterSpacing: -1.5),
          ),
          Text(
            l.fdReportWithConsultant(consultant),
            style: fdText(14, FontWeight.w800, FdColors.ink, height: 1.25),
          ),
        ],
      ),
    );
  }
}

/// "2 TA ISH": what raises the chances, numbered, with the points it adds.
class _JobsCard extends StatelessWidget {
  const _JobsCard({required this.fixes});

  final List<AssessmentFix> fixes;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      decoration: _cardBox(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.fdReportJobsTitle(fixes.length), style: fdText(13, FontWeight.w800, FdColors.muted, letterSpacing: 0.3)),
          const SizedBox(height: 10),
          for (var i = 0; i < fixes.length; i++) _JobRow(rank: i + 1, fix: fixes[i]),
        ],
      ),
    );
  }
}

class _JobRow extends StatelessWidget {
  const _JobRow({required this.rank, required this.fix});

  final int rank;
  final AssessmentFix fix;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final label = switch (fix.kind) {
      FixKind.bank => l.fdFixBank(l.fdMln((fix.value / 1000000).round())),
      FixKind.topik => l.fdFixTopik(fix.value),
    };
    final gain = switch (fix.kind) {
      FixKind.bank => l.fdGainVisa(fix.gain),
      FixKind.topik => l.fdGainAdmission(fix.gain),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: FdColors.lime,
              shape: BoxShape.circle,
              border: Border.all(color: FdColors.ink, width: 1.5),
            ),
            child: Text('$rank', style: fdText(15, FontWeight.w800, FdColors.onLime, height: 1)),
          ),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: fdText(15, FontWeight.w800, FdColors.ink, height: 1.2))),
          const SizedBox(width: 8),
          Text(gain, style: fdText(14, FontWeight.w800, FdColors.good)),
        ],
      ),
    );
  }
}

/// "Keimyung University ▬▬▬▬ 86%".
class _UniBar extends StatelessWidget {
  const _UniBar({required this.chance});

  final AdmissionChance chance;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            flex: 11,
            child: Text(
              shortUniversityName(chance.university.displayName),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: fdText(15, FontWeight.w800, Colors.white),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 11,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(5),
              child: Container(
                height: 10,
                color: const Color(0x4DFFFFFF),
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: (chance.percent / 100).clamp(0.0, 1.0),
                  child: const ColoredBox(color: FdColors.lime, child: SizedBox.expand()),
                ),
              ),
            ),
          ),
          SizedBox(
            width: 52,
            child: Text(
              '${chance.percent}%',
              textAlign: TextAlign.right,
              style: fdText(15, FontWeight.w800, FdColors.lime),
            ),
          ),
        ],
      ),
    );
  }
}
