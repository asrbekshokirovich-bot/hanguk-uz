import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/uni_db_providers.dart';
import '../domain/upcoming_deadline.dart';

/// `/applications/tracker` — every upcoming deadline across the user's
/// tracked universities (v_user_upcoming_deadlines).
///
/// Seoul Night pass: one glass row per deadline — hangul glyph tile,
/// university name, event + cycle chips and an urgency-toned countdown
/// [StatusChip] — the same presentation an application card uses.
class ApplicationTrackerScreen extends ConsumerWidget {
  const ApplicationTrackerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(userTrackedProvider);
    final l = AppLocalizations.of(context)!;

    return SeoulNightScaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Pushed route → no shell header, so the screen carries its own
          // glass back circle + hangul-tagged title.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              12,
              SeoulSizes.screenPadding,
              4,
            ),
            child: Row(
              children: [
                _GlassCircleButton(
                  icon: Icons.arrow_back_rounded,
                  tooltip: l.a11yTooltipBack,
                  onTap: () => Navigator.of(context).maybePop(),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: HangulTag(
                    en: l.uniDbTrackerTitle,
                    ko: '지원 현황',
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: asyncRows.when(
              loading: () => const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
                ),
              ),
              error: (e, _) => _CenteredMessage(
                icon: Icons.error_outline,
                title: l.genericError(e),
              ),
              data: (rows) {
                if (rows.isEmpty) {
                  return _CenteredMessage(
                    icon: Icons.event_note,
                    title: l.uniDbTrackerEmptyTitle,
                    body: l.uniDbTrackerEmptyBody,
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(
                    SeoulSizes.screenPadding,
                    8,
                    SeoulSizes.screenPadding,
                    32,
                  ),
                  itemCount: rows.length,
                  itemBuilder: (_, i) =>
                      _TrackedDeadlineCard(deadline: rows[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// One tracked deadline as a Seoul Night glass row.
class _TrackedDeadlineCard extends StatelessWidget {
  const _TrackedDeadlineCard({required this.deadline});
  final UpcomingDeadline deadline;

  /// Days within which a deadline reads as urgent (warning tone) — same
  /// threshold as VerifiedDeadlineCard.
  static const int _urgentDays = 7;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final cycleLabel = _cycleLabel(deadline.cycleTrack, l);
    final nameEn = (deadline.nameEn ?? '').trim();

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      radius: SeoulRadii.tile,
      // These render in a list; a saved layer per card is not worth it.
      blur: false,
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
                    if (nameEn.isNotEmpty) ...[
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
              StatusChip(
                label: _eventLabel(deadline.eventType, l),
                tone: StatusTone.info,
                dense: true,
              ),
              if (cycleLabel != null)
                StatusChip(label: cycleLabel, dense: true),
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
              _countdownChip(l),
            ],
          ),
        ],
      ),
    );
  }

  /// Countdown chip, toned by urgency — mirrors VerifiedDeadlineCard so the
  /// same deadline reads identically on both surfaces.
  StatusChip _countdownChip(AppLocalizations l) {
    final delta = deadline.startsAt.difference(DateTime.now());
    if (delta.isNegative) {
      return StatusChip(
        label: l.deadlineClosed,
        ko: '마감',
        tone: StatusTone.danger,
        dense: true,
      );
    }
    final String label;
    if (delta.inDays >= 1) {
      label = l.deadlineInDays(delta.inDays);
    } else if (delta.inHours >= 1) {
      label = l.deadlineInHours(delta.inHours);
    } else {
      label = l.deadlineInMinutes(delta.inMinutes);
    }
    return StatusChip(
      label: label,
      tone: delta.inDays < _urgentDays ? StatusTone.warning : StatusTone.lime,
      dense: true,
    );
  }

  /// The legacy tile showed `startsAt.toLocal()` — same instant, without the
  /// sub-minute noise.
  static String _formatDate(DateTime when) {
    final local = when.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  /// event_type → localized label. Same mapping as VerifiedDeadlineCard.
  static String _eventLabel(String eventType, AppLocalizations l) =>
      switch (eventType) {
        'apply_open' => l.eventApplyOpen,
        'apply_close' => l.eventApplyClose,
        'document_submission_deadline' => l.eventDocumentsDue,
        'first_stage_results' => l.eventFirstStageResults,
        'interview' => l.eventInterviewLabel,
        'practical_exam' => l.eventPracticalExam,
        'final_results' => l.eventFinalResults,
        'additional_admit' => l.eventAdditionalAdmit,
        'registration_open' => l.eventRegistrationOpen,
        'registration_close' => l.eventRegistrationClose,
        'orientation' => l.eventOrientation,
        'semester_start' => l.eventSemesterStart,
        // An event type the DB writes that this app does not model yet — the
        // raw value is the honest thing to show.
        _ => eventType.replaceAll('_', ' '),
      };

  /// cycle_track → localized label, raw value as fallback. Same mapping as
  /// VerifiedDeadlineCard.
  static String? _cycleLabel(String? track, AppLocalizations l) {
    if (track == null) return null;
    return switch (track) {
      'foreign' => l.cycleForeign,
      'overseas_korean_full' => l.cycleOverseasKoreanFull,
      'overseas_korean_partial' => l.cycleOverseasKoreanPartial,
      'susi' => l.cycleSusi,
      'jeongsi' => l.cycleJeongsi,
      'transfer' => l.cycleTransfer,
      'grad_general' => l.cycleGradGeneral,
      'grad_foreign' => l.cycleGradForeign,
      _ => track,
    };
  }
}

class _CenteredMessage extends StatelessWidget {
  const _CenteredMessage({required this.icon, required this.title, this.body});

  final IconData icon;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: SeoulColors.textFaint),
            const SizedBox(height: 12),
            Text(title, textAlign: TextAlign.center, style: SeoulType.subtitle),
            if (body != null) ...[
              const SizedBox(height: 8),
              Text(
                body!,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Glass back circle — the section-header affordance from DESIGN_SPEC §2.
class _GlassCircleButton extends StatelessWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: SeoulColors.glass,
              border: Border.all(color: SeoulColors.glassBorder),
            ),
            child: Icon(icon, size: 20, color: SeoulColors.textPrimary),
          ),
        ),
      ),
    );
  }
}
