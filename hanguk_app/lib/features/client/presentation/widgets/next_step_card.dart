import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/analytics/tracked.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../l10n/app_localizations.dart';
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
  const NextStepCard({super.key, this.daysLeft});

  /// Days to the nearest submission or interview (JourneySummary.nearest).
  final int? daysLeft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final uploaded = ref.watch(documentsProvider).value;
    if (uploaded == null) return const SizedBox.shrink();
    final missing = DocumentConstants.requiredDocuments.where((t) => !isUploaded(t, uploaded)).toList();
    if (missing.isEmpty) return const SizedBox.shrink();
    final names = missing.take(3).map((t) => t.localizedName(l)).join(', ');

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
                Text('$daysLeft ${l.guestPathDays}', style: fdText(12, FontWeight.w700, const Color(0xFFB45309))),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text('${l.nextStepUploadTitle}: ${missing.length}', style: fdText(18, FontWeight.w800, FdColors.ink, height: 1.25)),
          const SizedBox(height: 8),
          Text('$names. ${l.nextStepUploadBody}', style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
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
