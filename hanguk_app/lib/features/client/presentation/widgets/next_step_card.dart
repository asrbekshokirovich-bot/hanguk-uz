import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/analytics/tracked.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../applications/domain/application_journey.dart';
import '../../../documents/data/documents_repository.dart';
import '../../../documents/domain/document.dart';
import '../../../documents/domain/document_type.dart';
import '../client_shell.dart';

/// Whether [type] is among [uploaded] — the same test the notifications page
/// makes (a document's name or path carries the type id).
bool isUploaded(DocumentType type, List<AppDocument> uploaded) =>
    uploaded.any((d) => d.name.contains('[${type.id}]') || d.filePath.contains('${type.id}-'));

/// «Keyingi qadam» (ushlab qolish P23, Claude Design D8): the one thing the
/// student has to do now — the required documents still missing — with the
/// days to the nearest deadline and the way to the documents tab.
class NextStepCard extends ConsumerWidget {
  const NextStepCard({super.key, this.daysLeft, this.all = const []});

  /// Days to the nearest submission or interview (JourneySummary.nearest).
  final int? daysLeft;

  /// The student's universities, for the «TARTIB» list under the card.
  final List<UniversityProgress> all;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final uploaded = ref.watch(documentsProvider).value;
    if (uploaded == null) return const SizedBox.shrink();
    final missing = DocumentConstants.requiredDocuments.where((t) => !isUploaded(t, uploaded)).toList();
    if (missing.isEmpty) return const SizedBox.shrink();
    final named = missing.take(3).map((t) => t.localizedName(l)).toList();
    final names = named.length < 2
        ? named.join()
        : '${named.sublist(0, named.length - 1).join(', ')} ${l.nextStepAnd} ${named.last}';
    final stages = nextStepStages(docsDone: false, all: all);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _card(context, l, missing.length, names),
        _Order(stages: stages),
      ],
    );
  }

  Widget _card(BuildContext context, AppLocalizations l, int count, String names) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: FdColors.lime,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Text(l.nextStepBadge, style: fdText(12, FontWeight.w800, FdColors.onLime)),
              ),
              if (daysLeft != null && daysLeft! >= 0) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    l.catalogDaysLeft(daysLeft!),
                    overflow: TextOverflow.ellipsis,
                    style: fdText(12, FontWeight.w700, const Color(0xFFB45309)),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(l.nextStepUploadCount('$count'), style: fdText(18, FontWeight.w800, FdColors.ink, height: 1.25)),
          const SizedBox(height: 8),
          Text('${l.nextStepUploadNeeded(names)} ${l.nextStepUploadBody}', style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: tracked('next_step.documents', () => context.go('/?tab=${ClientShell.tabDocuments}')),
            child: Container(
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: FdColors.lime,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: FdColors.ink, width: 1.5),
                boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
              ),
              child: Text(l.nextStepUploadButton, style: fdText(15, FontWeight.w800, FdColors.onLime)),
            ),
          ),
        ],
      ),
    );
  }
}

/// The five steps of the «TARTIB» list (D8), in order.
enum NextStepStage { contract, documents, university, online, result }

/// Each step's state: done from the student's records, the first one not done
/// is the current one, the rest are ahead — the list reads as an order.
List<(NextStepStage, StampState)> nextStepStages({required bool docsDone, required List<UniversityProgress> all}) {
  bool any(JourneyStamp s) => all.any((p) => p.view(s).state == StampState.done);
  final done = {
    NextStepStage.contract: true,
    NextStepStage.documents: docsDone,
    NextStepStage.university: all.isNotEmpty,
    NextStepStage.online: any(JourneyStamp.submission),
    NextStepStage.result: any(JourneyStamp.visa),
  };
  final out = <(NextStepStage, StampState)>[];
  var currentGiven = false;
  for (final st in NextStepStage.values) {
    if (!currentGiven && done[st]!) {
      out.add((st, StampState.done));
    } else if (!currentGiven) {
      out.add((st, StampState.current));
      currentGiven = true;
    } else {
      out.add((st, StampState.ahead));
    }
  }
  return out;
}

class _Order extends StatelessWidget {
  const _Order({required this.stages});

  final List<(NextStepStage, StampState)> stages;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    String name(NextStepStage s) => switch (s) {
      NextStepStage.contract => l.nextStepStageContract,
      NextStepStage.documents => l.nextStepStageDocuments,
      NextStepStage.university => l.nextStepStageUniversity,
      NextStepStage.online => l.nextStepStageOnline,
      NextStepStage.result => l.nextStepStageResult,
    };
    Widget dot(StampState st) => switch (st) {
      StampState.done => Container(
        width: 22,
        height: 22,
        decoration: const BoxDecoration(color: FdColors.good, shape: BoxShape.circle),
        child: const Icon(Icons.check, size: 12, color: Colors.white),
      ),
      StampState.current => Container(
        width: 22,
        height: 22,
        decoration: BoxDecoration(
          color: FdColors.lime,
          shape: BoxShape.circle,
          border: Border.all(color: FdColors.ink, width: 1.5),
        ),
      ),
      _ => Container(
        width: 22,
        height: 22,
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: FdColors.pageMuted, width: 1.5)),
      ),
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.nextStepOrder, style: fdText(12, FontWeight.w800, FdColors.pageMuted, letterSpacing: 0.48)),
          const SizedBox(height: 14),
          for (final (st, state) in stages) ...[
            Row(
              children: [
                dot(state),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    name(st),
                    style: fdText(13.5, FontWeight.w600, state == StampState.ahead ? FdColors.pageMuted : FdColors.onPage),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}
