import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/upcoming_deadline.dart';

/// Read-only card surfacing one verified upcoming deadline.
///
/// Plan §H.5. The "verified" badge differentiates these from the
/// user-typed free-text application entries.
///
/// Seoul Night pass: glass card with the university's hangul glyph tile and a
/// countdown [StatusChip] whose tone tracks urgency — lime while the date is
/// comfortably ahead, warning inside a week, danger once it has passed.
class VerifiedDeadlineCard extends StatelessWidget {
  const VerifiedDeadlineCard({super.key, required this.deadline, this.onTap});

  final UpcomingDeadline deadline;
  final VoidCallback? onTap;

  /// Days within which a deadline reads as urgent (warning tone).
  static const int _urgentDays = 7;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final eventLabel = _formatEventType(l10n, deadline.eventType);
    final cycleLabel = _cycleLabel(l10n, deadline.cycleTrack);
    final nameEn = deadline.nameEn;

    return GlassCard(
      margin: const EdgeInsets.symmetric(
        horizontal: SeoulSizes.screenPadding,
        vertical: 6,
      ),
      padding: const EdgeInsets.all(16),
      radius: SeoulRadii.tile,
      // These render in a list; a saved layer per card is not worth it.
      blur: false,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HangulGlyphTile(
                glyph: HangulGlyphTile.firstSyllable(
                  deadline.nameKoShort ?? deadline.nameKo,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      deadline.nameKo,
                      style: SeoulType.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (nameEn != null && nameEn.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        nameEn,
                        style: SeoulType.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              // The point of the card: this date came from the verified DB,
              // not from a student's free-text entry.
              StatusChip(
                label: l10n.universityVerified,
                tone: StatusTone.info,
                dense: true,
              ),
              if (cycleLabel != null)
                StatusChip(label: cycleLabel, dense: true),
              StatusChip(label: eventLabel, dense: true),
              if (deadline.applicantCategory != null)
                StatusChip(label: deadline.applicantCategory!, dense: true),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(
                Icons.event_outlined,
                size: 16,
                color: SeoulColors.textFaint,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  _formatDate(deadline.startsAt),
                  style: SeoulType.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              _countdownChip(l10n),
            ],
          ),
        ],
      ),
    );
  }

  /// Countdown chip, toned by urgency: danger once the date has passed (with
  /// the 마감 status word), warning within [_urgentDays] days, lime while the
  /// student is comfortably ahead.
  StatusChip _countdownChip(AppLocalizations l10n) {
    final delta = deadline.startsAt.difference(DateTime.now());
    if (delta.isNegative) {
      return StatusChip(
        label: l10n.deadlineClosed,
        ko: '마감',
        tone: StatusTone.danger,
        dense: true,
      );
    }
    final String label;
    if (delta.inDays >= 1) {
      label = l10n.deadlineInDays(delta.inDays);
    } else if (delta.inHours >= 1) {
      label = l10n.deadlineInHours(delta.inHours);
    } else {
      label = l10n.deadlineInMinutes(delta.inMinutes);
    }
    return StatusChip(
      label: label,
      tone: delta.inDays < _urgentDays ? StatusTone.warning : StatusTone.lime,
      dense: true,
    );
  }

  static String _formatDate(DateTime when) {
    final local = when.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  static String _formatEventType(AppLocalizations l10n, String raw) {
    return switch (raw) {
      'apply_open' => l10n.eventApplyOpen,
      'apply_close' => l10n.eventApplyClose,
      'document_submission_deadline' => l10n.eventDocumentsDue,
      'first_stage_results' => l10n.eventFirstStageResults,
      'interview' => l10n.eventInterviewLabel,
      'practical_exam' => l10n.eventPracticalExam,
      'final_results' => l10n.eventFinalResults,
      'additional_admit' => l10n.eventAdditionalAdmit,
      'registration_open' => l10n.eventRegistrationOpen,
      'registration_close' => l10n.eventRegistrationClose,
      // An event type the DB writes that this app does not model yet — the
      // raw value is the honest thing to show.
      _ => raw,
    };
  }

  static String? _cycleLabel(AppLocalizations l10n, String? track) {
    if (track == null) return null;
    return switch (track) {
      'foreign' => l10n.cycleForeign,
      'overseas_korean_full' => l10n.cycleOverseasKoreanFull,
      'overseas_korean_partial' => l10n.cycleOverseasKoreanPartial,
      'susi' => l10n.cycleSusi,
      'jeongsi' => l10n.cycleJeongsi,
      'transfer' => l10n.cycleTransfer,
      'grad_general' => l10n.cycleGradGeneral,
      'grad_foreign' => l10n.cycleGradForeign,
      _ => track,
    };
  }
}
