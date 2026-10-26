import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../l10n/app_localizations.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../assessment/domain/assessment.dart';
import '../../catalog/data/campus_photos.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../catalog/presentation/catalog_format.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../data/application_windows.dart';
import 'chosen_screen.dart';
import 'discover_routes.dart';
import 'widgets/fd_parts.dart';
import 'widgets/uni_stack_card.dart';

/// Design screen 09, "Taqqoslash": up to three universities side by side —
/// city, type, fee, language, document deadline, and the admission chance
/// once the student has filled the assessment ("?%" until then).
class CompareScreen extends ConsumerWidget {
  const CompareScreen({super.key, required this.institutionIds});

  final List<String> institutionIds;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final byId = {for (final u in all) u.institutionId: u};
    final unis = [
      for (final id in institutionIds.take(3))
        if (byId[id] != null) byId[id]!,
    ];
    final windows = ref.watch(applicationWindowsProvider).value ?? const {};
    final touched = ref.watch(assessmentTouchedProvider);
    final input = ref.watch(assessmentProvider);
    final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
    final ids = [for (final u in unis) u.institutionId];

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          child: Stack(
            children: [
              const GhostWord('비교', top: -10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FdTitleBar(
                    title: Text(l.fdCompareTitle, style: kFdTitleStyle),
                    trailing: l.fdCompareCount(unis.length),
                  ),
                  const SizedBox(height: 14),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
                      child: IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (var i = 0; i < unis.length; i++) ...[
                              if (i > 0) const SizedBox(width: 8),
                              Expanded(
                                child: _Column(
                                  university: unis[i],
                                  deadline: windows[unis[i].primary.id],
                                  percent: touched ? admissionPercent(input, unis[i].primary, rules: rules) : null,
                                  onOpen: tracked('compare.column_open', () => context.push(universityPath(unis[i].institutionId)), props: {'institution_id': unis[i].institutionId}),
                                  onAdmission: tracked('compare.column_admission', () => openAssessmentFor(context, ref, ids)),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (unis.isNotEmpty)
                    FdBottomBar(child: HardButton(label: l.fdUniCta, onPressed: tracked('compare.uni_cta', () => openAssessmentFor(context, ref, ids)))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Column extends StatelessWidget {
  const _Column({
    required this.university,
    required this.deadline,
    required this.percent,
    required this.onOpen,
    required this.onAdmission,
  });

  final CatalogUniversity university;
  final CatalogRound? deadline;
  final int? percent;
  final VoidCallback onOpen;
  final VoidCallback onAdmission;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = university;
    final g = u.primary;
    final photo = campusPhotoAsset(u.institutionId);
    final price = priceOf(g);
    final date = deadline?.endDate ?? deadline?.startDate;
    final p = percent;

    Widget field(String label, Widget value) => Padding(
      padding: const EdgeInsets.only(top: 9),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: fdText(9, FontWeight.w600, FdColors.muted)),
          const SizedBox(height: 1),
          value,
        ],
      ),
    );
    Text value(String? text) => Text(text ?? '—', style: fdText(11, FontWeight.w700, FdColors.ink));

    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('compare.column_open', onOpen),
        behavior: HitTestBehavior.opaque,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                height: 60,
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: FdColors.ink, width: 1.5))),
                child: photo != null
                    ? Image.asset(photo, fit: BoxFit.cover, cacheWidth: 360)
                    : NameCover(name: u.nameKoShort ?? u.displayName),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 30),
                      child: Text(u.displayName, style: fdText(12, FontWeight.w800, FdColors.ink, height: 1.2)),
                    ),
                    field(l.fdCompareCity, value(u.city == null ? null : shortCity(u.city!))),
                    field(l.fdCompareType, value(typeLabel(l, g.institutionType, short: true))),
                    field(
                      g.tuitionPeriod == 'yil' ? l.fdUniTuitionYear : l.fdUniTuitionSem,
                      price == null
                          ? value(null)
                          : Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(4)),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  money(price, g.currency, locale: l.localeName),
                                  style: fdText(10, FontWeight.w800, FdColors.onLime),
                                ),
                              ),
                            ),
                    ),
                    field(l.fdCellLanguage, value(g.topikMin == null ? null : 'TOPIK ${scoreText(g.topikMin!)}+')),
                    field(l.fdUniDeadline, value(date == null ? null : _shortDate(context, date))),
                  ],
                ),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _DashedRule(),
                    const SizedBox(height: 7),
                    Text(l.fdCompareAdmission, style: fdText(9, FontWeight.w600, FdColors.muted)),
                    const SizedBox(height: 1),
                    if (p != null)
                      Text(
                        '$p%',
                        style: fdText(18, FontWeight.w800, _percentColor(p), letterSpacing: -0.36),
                      )
                    else
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Semantics(
                          button: true,
                          child: GestureDetector(
                            onTap: tracked('compare.column_admission', onAdmission),
                            behavior: HitTestBehavior.opaque,
                            child: CustomPaint(
                              painter: const DashedPillPainter(color: FdColors.navy),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                child: Text('?%', style: fdText(13, FontWeight.w800, FdColors.navy)),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Color _percentColor(int p) => p >= kOpenPercent
      ? FdColors.good
      : p >= 40
      ? FdColors.warn
      : FdColors.bad;

  static String _shortDate(BuildContext context, String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    try {
      return DateFormat.MMMd(Localizations.localeOf(context).toLanguageTag()).format(d);
    } catch (_) {
      return iso;
    }
  }
}

/// `border-top: 1.5px dashed`.
class _DashedRule extends StatelessWidget {
  const _DashedRule();

  @override
  Widget build(BuildContext context) => const SizedBox(height: 1.5, child: CustomPaint(painter: _Dashes()));
}

class _Dashes extends CustomPainter {
  const _Dashes();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = FdColors.ink
      ..strokeWidth = size.height;
    final y = size.height / 2;
    for (var x = 0.0; x < size.width; x += 7) {
      canvas.drawLine(Offset(x, y), Offset((x + 4).clamp(0, size.width), y), paint);
    }
  }

  @override
  bool shouldRepaint(_Dashes old) => false;
}
