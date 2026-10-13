import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../assessment/data/assessment_controller.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../data/slots.dart';
import 'discover_routes.dart';
import 'widgets/fd_parts.dart';
import 'widgets/uni_stack_card.dart';

/// Opens the assessment (screen 11) on [ids].
void openAssessmentFor(BuildContext context, WidgetRef ref, List<String> ids) {
  ref.read(assessmentProvider.notifier).useUniversities(ids);
  context.push(kAssessmentPath);
}

/// Design screen 08, "Ajoyib tanlov → eng muhim savol": the slotted
/// universities, then the question the app answers next.
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

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: FdPage(
        child: SafeArea(
          child: Stack(
            children: [
              const GhostWord('최고', top: -10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const FdTitleBar(),
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            width: 56,
                            height: 56,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: FdColors.lime,
                              shape: BoxShape.circle,
                              border: Border.all(color: FdColors.ink, width: 1.5),
                              boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
                            ),
                            child: const Lucide(LucideIcons.trophy, size: 26, color: FdColors.onLime),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.end,
                          children: [
                            LimeMark(l.fdChosenTitleMark, style: _title),
                            Text(' ${l.fdChosenTitleTail}', style: _title),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          chosen.isEmpty
                              ? l.fdChosenEmpty
                              : chosen.length == kSlotCount
                              ? l.fdChosenBodyThree
                              : l.fdChosenBody(chosen.length),
                          style: fdText(13, FontWeight.w400, FdColors.muted, height: 1.45),
                        ),
                        const SizedBox(height: 18),
                        for (var i = 0; i < chosen.length; i++) ...[
                          if (i > 0) const SizedBox(height: 10),
                          _ChosenRow(
                            rank: i + 1,
                            university: chosen[i],
                            onTap: () => context.push(universityPath(chosen[i].institutionId)),
                            onAdmission: () => openAssessmentFor(context, ref, ids),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (chosen.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(l.fdChosenNext, style: fdText(12, FontWeight.w700, FdColors.muted)),
                              const SizedBox(width: 4),
                              const Lucide(LucideIcons.arrowDown, size: 13, color: FdColors.muted),
                            ],
                          ),
                          const SizedBox(height: 10),
                          HardButton(label: l.fdChosenAdmission, onPressed: () => openAssessmentFor(context, ref, ids)),
                          const SizedBox(height: 10),
                          HardChoice(
                            label: l.fdChosenVisa,
                            selected: false,
                            height: 48,
                            radius: 16,
                            fontSize: 14,
                            onTap: () => openAssessmentFor(context, ref, ids),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static final TextStyle _title = fdText(34, FontWeight.w800, FdColors.ink, height: 1.1, letterSpacing: -1.02);
}

class _ChosenRow extends StatelessWidget {
  const _ChosenRow({required this.rank, required this.university, required this.onTap, required this.onAdmission});

  final int rank;
  final CatalogUniversity university;
  final VoidCallback onTap;
  final VoidCallback onAdmission;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FdColors.ink, width: 1.5),
            boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(3, 3))],
          ),
          child: Row(
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  shape: BoxShape.circle,
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Text('$rank', style: fdText(12, FontWeight.w800, FdColors.onLime)),
              ),
              const SizedBox(width: 10),
              UniThumb(university: university, width: 56, height: 48),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(university.displayName, style: fdText(14, FontWeight.w800, FdColors.ink, height: 1.2)),
                    const SizedBox(height: 2),
                    uniMetaLine(l, university, university.primary, topik: false, maxLines: 1),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Semantics(
                button: true,
                child: GestureDetector(
                  onTap: onAdmission,
                  behavior: HitTestBehavior.opaque,
                  child: CustomPaint(
                    painter: const DashedPillPainter(color: FdColors.navy),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      child: Text('?%', style: fdText(11, FontWeight.w800, FdColors.navy)),
                    ),
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
