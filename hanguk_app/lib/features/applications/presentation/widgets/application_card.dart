import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/application.dart';
import 'process_tracker.dart';
import 'university_room_modal.dart';

// ── Strings still missing an ARB key ────────────────────────────────────────
// These are kept exactly as the screen showed them before the restyle; there
// is no existing key that fits, and new keys can't be added without
// regenerating the five locales. Listed in the PR description.
const String _discussionLabel = 'Discussion';
const String _calendarLabel = 'Calendar';
const String _pendingApprovalNote =
    'Awaiting Counselor Approval.\nWe will notify you once reviewed.';

/// One application, as a Seoul Night glass card (DESIGN_SPEC §3.4):
/// hangul glyph tile, university name, city, status chip and a glow progress
/// bar. Tapping the header expands the journey bar plus the Discussion /
/// Calendar actions.
///
/// Read-only: nothing here submits or withdraws an application — staff attach
/// universities from the CRM.
class ApplicationCard extends StatefulWidget {
  const ApplicationCard({
    super.key,
    required this.application,
    this.onDiscussionTap,
  });

  final StudentApplication application;

  /// Optional override for the Discussion action. Defaults to opening the
  /// university room on its Discussion tab — the same thing the tab passes.
  final VoidCallback? onDiscussionTap;

  @override
  State<ApplicationCard> createState() => _ApplicationCardState();
}

class _ApplicationCardState extends State<ApplicationCard> {
  bool _isExpanded = false;

  void _toggleExpanded() => setState(() => _isExpanded = !_isExpanded);

  void _openRoom(int tabIndex) => UniversityRoomModal.show(
    context,
    widget.application,
    initialTabIndex: tabIndex,
  );

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final application = widget.application;
    final university = application.university;
    final status = application.status;
    final step = ProcessTracker.stepFor(status);
    final chip = _statusChip(status, l);
    final city = university?.location ?? '';

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      // A long list of cards would each cost a saved layer with the blur on.
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            button: true,
            expanded: _isExpanded,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _toggleExpanded,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      HangulGlyphTile(
                        glyph: HangulGlyphTile.firstSyllable(
                          university?.nameKo,
                        ),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              university?.name ?? l.unknownUniversity,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: SeoulType.subtitle,
                            ),
                            if (city.isNotEmpty ||
                                (university?.isPartner ?? false)) ...[
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  if (city.isNotEmpty)
                                    Flexible(
                                      child: Text(
                                        city,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: SeoulType.caption,
                                      ),
                                    ),
                                  if (university?.isPartner ?? false) ...[
                                    if (city.isNotEmpty)
                                      const SizedBox(width: 8),
                                    StatusChip(
                                      label: l.filterPartner,
                                      dense: true,
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Icon(
                        _isExpanded
                            ? Icons.expand_less_rounded
                            : Icons.expand_more_rounded,
                        size: 20,
                        color: SeoulColors.textFaint,
                      ),
                    ],
                  ),
                  const SizedBox(height: 13),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // The real status labels are far longer than the
                      // prototype's one-word chips, so the chip scales down
                      // instead of overflowing on a narrow screen.
                      Flexible(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: AlignmentDirectional.centerStart,
                          child: chip,
                        ),
                      ),
                      if (step > 0) ...[
                        const SizedBox(width: 10),
                        Text(
                          l.sessionStepLabel(step),
                          style: SeoulType.caption,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  GlowProgressBar(value: ProcessTracker.progressFor(status)),
                ],
              ),
            ),
          ),

          AnimatedSize(
            duration: SeoulMotion.base,
            curve: SeoulMotion.smooth,
            alignment: Alignment.topCenter,
            child: _isExpanded
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 16),
                      if (status == 'pending_approval')
                        const _PendingApprovalNote()
                      else
                        ProcessTracker(status: status),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          SeoulOutlineButton(
                            label: _discussionLabel,
                            icon: Icons.forum_outlined,
                            expand: false,
                            height: SeoulSizes.minTapTarget,
                            onPressed:
                                widget.onDiscussionTap ?? () => _openRoom(1),
                          ),
                          SeoulOutlineButton(
                            label: _calendarLabel,
                            icon: Icons.event_note_outlined,
                            expand: false,
                            height: SeoulSizes.minTapTarget,
                            onPressed: () => _openRoom(3),
                          ),
                        ],
                      ),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  /// Status → chip label and tone, per DESIGN_SPEC §3.4.
  ///
  /// The chip states *where the application stands*, in the short vocabulary
  /// the spec asks for — not the raw database value. `sessionStatusLabel` is
  /// deliberately not used here: it renders "Status: rejected", which shows a
  /// student an internal enum at the moment they most need a plain sentence.
  /// The long stage name lives in the journey bar below the chip.
  StatusChip _statusChip(String status, AppLocalizations l) {
    switch (status) {
      // ── Collecting paperwork ───────────────────────────────────────────
      case 'documents_collection':
      case 'visa_documents':
        return StatusChip(label: l.statusDocs, tone: StatusTone.info, ko: '서류');

      // ── Sent to the university ─────────────────────────────────────────
      case 'online_application':
      case 'offline_application':
        return StatusChip(
          label: l.statusSubmitted,
          tone: StatusTone.lime,
          ko: '제출',
        );

      // ── Someone is actively assessing it ───────────────────────────────
      case 'interview':
      case 'tuition_payment':
        return StatusChip(
          label: l.statusInReview,
          tone: StatusTone.warning,
          ko: '심사',
        );

      // ── Blocked on the university or the consulate ─────────────────────
      case 'waiting_invoice':
      case 'university_response':
      case 'visa_issue':
        return StatusChip(
          label: l.statusWaiting,
          tone: StatusTone.warning,
          ko: ProcessTracker.pendingKo,
        );

      // ── Waiting on our own staff ───────────────────────────────────────
      case 'pending':
      case 'pending_approval':
        return StatusChip(
          label: l.appsPendingHeading,
          ko: ProcessTracker.pendingKo,
        );

      // 'rejected' shares the last stage index with 'visa_issue', so it must
      // never borrow that stage's label — a rejection reading "Visa issue"
      // would tell the student the opposite of what happened.
      case 'rejected':
        return StatusChip(
          label: l.statusRejected,
          tone: StatusTone.danger,
          ko: '불합격',
        );

      // A status the CRM writes that this app does not model yet. The raw
      // value is the honest thing to show — inventing a friendly label for an
      // unknown state would be worse than admitting we don't know it.
      default:
        return StatusChip(label: l.sessionStatusLabel(status));
    }
  }
}

/// Shown in place of the journey bar while a counselor has not approved the
/// application yet.
class _PendingApprovalNote extends StatelessWidget {
  const _PendingApprovalNote();

  @override
  Widget build(BuildContext context) {
    return const GlassCard(
      blur: false,
      showShadow: false,
      radius: SeoulRadii.tile,
      fillColor: SeoulColors.limeFill,
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(
            Icons.hourglass_empty_rounded,
            color: SeoulColors.lime,
            size: 20,
          ),
          SizedBox(width: 12),
          Expanded(
            child: Text(_pendingApprovalNote, style: SeoulType.bodySecondary),
          ),
        ],
      ),
    );
  }
}
