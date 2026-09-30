import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/application.dart';
import 'process_tracker.dart';
import 'university_room_modal.dart';

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
    // City names stay as stored; an institution without one (the repository
    // leaves the [University.unknownCity] placeholder) reads as the country,
    // in the app language.
    final String city;
    if (university == null) {
      city = '';
    } else if (university.hasRealCity) {
      city = university.location;
    } else {
      city = l.appCountrySouthKorea;
    }
    final universityName = (university?.name.isNotEmpty ?? false)
        ? university!.name
        : l.unknownUniversity;

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
                              universityName,
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
                      if (ProcessTracker.isPending(status))
                        const _PendingApprovalNote()
                      else
                        ProcessTracker(status: status),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          SeoulOutlineButton(
                            label: l.roomTabDiscussion,
                            icon: Icons.forum_outlined,
                            expand: false,
                            height: SeoulSizes.minTapTarget,
                            onPressed:
                                widget.onDiscussionTap ?? () => _openRoom(1),
                          ),
                          SeoulOutlineButton(
                            label: l.roomTabCalendar,
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

  /// Status → chip tone, per DESIGN_SPEC §3.4: Submitted = lime,
  /// In Review = warning, Docs stage = info. A rejection gets the danger tone
  /// (added to the palette for exactly this); a status this app does not know
  /// stays neutral rather than guessing at a meaning. The label always comes
  /// from [ProcessTracker.statusLabel], so the chip and the journey bar name
  /// the status the same way.
  StatusChip _statusChip(String status, AppLocalizations l) {
    final label = ProcessTracker.statusLabel(status, l);
    switch (status) {
      case 'documents_collection':
      case 'documents_translation':
      case 'apostille':
      case 'documents':
      case 'visa_documents':
      case 'visa':
        return StatusChip(label: label, tone: StatusTone.info);

      case 'application_submitted':
      case 'submitted':
      case 'online_ariza':
      case 'online_application':
      case 'offline_application':
      case 'originals_sent':
      case 'university_response':
        return StatusChip(label: label, tone: StatusTone.lime);

      case 'in_review':
      case 'review':
      case 'interview':
      case 'tuition_payment':
        return StatusChip(label: label, tone: StatusTone.warning);

      case 'waiting_invoice':
      case 'visa_issue':
        return StatusChip(
          label: label,
          tone: StatusTone.warning,
          ko: ProcessTracker.pendingKo,
        );

      case 'completed':
      case 'accepted':
      case 'enrolled':
        return StatusChip(label: label, tone: StatusTone.lime);

      case 'pending':
      case 'pending_approval':
      case 'new':
      case 'draft':
        return StatusChip(label: label, ko: ProcessTracker.pendingKo);

      case 'rejected':
        return StatusChip(label: label, tone: StatusTone.danger);

      default:
        return StatusChip(label: label);
    }
  }
}

/// Shown in place of the journey bar while a counselor has not approved the
/// application yet.
class _PendingApprovalNote extends StatelessWidget {
  const _PendingApprovalNote();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return GlassCard(
      blur: false,
      showShadow: false,
      radius: SeoulRadii.tile,
      fillColor: SeoulColors.limeFill,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          const Icon(
            Icons.hourglass_empty_rounded,
            color: SeoulColors.lime,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              l.appPendingApprovalNote,
              style: SeoulType.bodySecondary,
            ),
          ),
        ],
      ),
    );
  }
}
