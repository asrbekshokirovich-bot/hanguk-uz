import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../data/chances.dart';
import '../data/slots.dart';
import 'discover_routes.dart';
import 'widgets/app_nav.dart';
import 'widgets/chance_badge.dart';
import 'widgets/fd_parts.dart';

/// Opens the assessment (screen 11) on [ids].
void openAssessmentFor(BuildContext context, WidgetRef ref, List<String> ids) {
  ref.read(assessmentProvider.notifier).useUniversities(ids);
  context.push(kAssessmentPath);
}

/// "Ajoyib tanlov!": the three picked universities with their chances, the
/// overall D-2 visa chance, and the question the app answers next — "Koreaga
/// keta olamanmi?". A cross takes a university out of the picks.
class ChosenScreen extends ConsumerWidget {
  const ChosenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final byId = {for (final u in all) u.institutionId: u};
    final chosen = [
      for (final id in ref.watch(slotsProvider))
        if (id != null && byId[id] != null) byId[id]!,
    ];
    final ids = [for (final u in chosen) u.institutionId];
    final book = ref.watch(chanceBookProvider);

    return NavScaffold(
      current: AppTab.universities,
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FdTitleBar(
              title: Wrap(
                crossAxisAlignment: WrapCrossAlignment.end,
                children: [
                  Text('${l.fdChosenTitleMark} ', style: kFdTitleStyle),
                  Text(l.fdChosenTitleTail, style: kFdTitleStyle),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 12),
                children: [
                  Text(
                    chosen.isEmpty ? l.fdChosenEmpty : l.fdPickedHint(chosen.length),
                    style: fdText(13, FontWeight.w400, FdColors.pageMuted, height: 1.4),
                  ),
                  const SizedBox(height: 8),
                  for (var i = 0; i < chosen.length; i++) ...[
                    const SizedBox(height: 8),
                    _Row(
                      rank: i + 1,
                      university: chosen[i],
                      percent: book.admission(chosen[i]),
                      onTap: tracked('chosen.row', () => context.push(universityPath(chosen[i].institutionId)), props: {'institution_id': chosen[i].institutionId}),
                      onRemove: tracked('chosen.row_remove', () => ref.read(slotsProvider.notifier).remove(chosen[i].institutionId), props: {'institution_id': chosen[i].institutionId}),
                    ),
                  ],
                  const SizedBox(height: 12),
                  _VisaCard(visa: book.visa, consultant: book.visaConsultant),
                ],
              ),
            ),
            if (chosen.isNotEmpty)
              FdBottomBar(
                aboveNav: true,
                child: HardButton(
                  label: l.fdPickedCta,
                  onPressed: tracked('chosen.picked_cta', () {
                    ref.read(assessmentProvider.notifier).useUniversities(ids);
                    context.push(kAssessmentReportPath);
                  }),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.rank,
    required this.university,
    required this.percent,
    required this.onTap,
    required this.onRemove,
  });

  final int rank;
  final CatalogUniversity university;
  final int? percent;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final look = percent == null ? null : chanceLook(percent!);
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: tracked('chosen.row', onTap),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
          ),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  shape: BoxShape.circle,
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Text('$rank', style: fdText(12, FontWeight.w800, FdColors.onLime)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      university.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(14, FontWeight.w800, FdColors.ink, height: 1.2),
                    ),
                    uniMetaLine(l, university, university.primary, topik: false, maxLines: 1),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                percent == null ? '?%' : '$percent%',
                style: fdText(16, FontWeight.w800, look?.accent ?? FdColors.muted),
              ),
              const SizedBox(width: 8),
              Semantics(
                button: true,
                label: l.fdPickedRemove,
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: tracked('chosen.row_remove', onRemove),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: FdColors.ink, width: 1.5),
                    ),
                    child: const Lucide(LucideIcons.x, size: 12, color: FdColors.ink),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "UMUMIY VIZA D-2 56% · konsultant bilan ~77%" on a blue card with a lime
/// shadow and a bar.
class _VisaCard extends StatelessWidget {
  const _VisaCard({required this.visa, required this.consultant});

  final int? visa;
  final int? consultant;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final v = visa;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FdColors.blue,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.lime, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.fdPickedVisaTitle, style: fdText(10, FontWeight.w800, FdColors.onNavyMuted)),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(v == null ? '?%' : '$v%', style: fdText(40, FontWeight.w800, FdColors.lime, height: 1, letterSpacing: -1.2)),
              const SizedBox(width: 10),
              if (v != null && consultant != null)
                Flexible(
                  child: Text(
                    l.fdPickedWithConsultant(consultant!),
                    style: fdText(12, FontWeight.w700, Colors.white),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Container(
              height: 8,
              color: const Color(0x40FFFFFF),
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: ((v ?? 0) / 100).clamp(0.0, 1.0),
                child: const ColoredBox(color: FdColors.lime, child: SizedBox.expand()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
