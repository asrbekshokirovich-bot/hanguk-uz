import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';

/// The journey segment bar (DESIGN_SPEC §3.4).
///
/// One segment per stage of the application journey: every stage the student
/// has already cleared is solid lime with a glow, the stage in progress is
/// partially filled, and the stages ahead are empty track.
///
/// This is also the one place that knows what an `applications.status` code
/// means: [stepFor] places it on the journey and [statusLabel] names it in
/// the app language, so no screen ever prints a raw code. The codes are the
/// CRM's (`src/components/crm/StudentDetail.tsx` `allStatusSteps`, plus the
/// older pipeline codes and aliases the CRM still accepts).
class ProcessTracker extends StatelessWidget {
  const ProcessTracker({super.key, required this.status});

  /// Raw `applications.status` value.
  final String status;

  /// The nine stages of the journey, in order.
  static List<String> stepLabels(AppLocalizations l) => <String>[
    l.journeyStageDocumentPrep,
    l.journeyStageOnlineApplication,
    l.journeyStageOfflineApplication,
    l.journeyStageInterview,
    l.journeyStageWaitingInvoice,
    l.journeyStageTuitionPayment,
    l.journeyStageWaitingAdmission,
    l.journeyStageVisaPreparation,
    l.journeyStageWaitingVisa,
  ];

  /// Number of stages. A constant rather than `stepLabels.length` so callers
  /// that only need the denominator don't have to hold a BuildContext.
  static const int stepCount = 9;

  /// Korean status word for an application that has not started moving yet
  /// (spec §1 Korean voice: 대기 = pending). Stays literal Korean in every
  /// locale.
  static const String pendingKo = '대기';

  /// Height of one journey segment. Not a colour/radius/shadow, so a local
  /// layout constant rather than a token.
  static const double _segmentHeight = 8;
  static const double _segmentGap = 5;

  /// Which stage of the journey this status belongs to (0 = not started,
  /// [stepCount] = the last stage).
  ///
  /// The CRM's own sequence is documents collected → translated → apostille
  /// → application submitted → admission letter (university response) → visa
  /// documents → completed (visa applied). Its three document steps are all
  /// part of the first journey stage; the older codes keep the stage they
  /// always had.
  static int stepFor(String status) {
    switch (status) {
      case 'completed':
      case 'accepted':
      case 'enrolled':
      case 'rejected':
      case 'visa_issue':
        return 9;
      case 'visa_documents':
      case 'visa':
        return 8;
      case 'university_response':
        return 7;
      case 'tuition_payment':
        return 6;
      case 'waiting_invoice':
        return 5;
      case 'interview':
        return 4;
      case 'offline_application':
      case 'originals_sent':
        return 3;
      case 'application_submitted':
      case 'submitted':
      case 'online_ariza':
      case 'in_review':
      case 'review':
      case 'online_application':
        return 2;
      case 'documents_collection':
      case 'documents_translation':
      case 'apostille':
      case 'documents':
        return 1;
      case 'pending':
      case 'pending_approval':
      case 'new':
      case 'draft':
        return 0; // Not actively processing yet.
      default:
        return 0; // Unknown / not-yet-modelled status.
    }
  }

  /// Whether the journey is over and succeeded — every segment full.
  static bool isCompleted(String status) =>
      status == 'completed' || status == 'accepted' || status == 'enrolled';

  /// Whether the status is still waiting on a counselor's approval.
  static bool isPending(String status) =>
      status == 'pending' ||
      status == 'pending_approval' ||
      status == 'new' ||
      status == 'draft';

  /// 0.0–1.0 progress along the journey, for a [GlowProgressBar].
  static double progressFor(String status) => stepFor(status) / stepCount;

  /// Label of the stage this status belongs to, or null before the journey
  /// starts.
  static String? currentStageLabel(String status, AppLocalizations l) {
    final index = stepFor(status) - 1;
    final labels = stepLabels(l);
    if (index < 0 || index >= labels.length) return null;
    return labels[index];
  }

  /// What the status means, in the app language — never the raw code.
  static String statusLabel(String status, AppLocalizations l) {
    switch (status) {
      case 'pending':
      case 'pending_approval':
      case 'new':
      case 'draft':
        return l.statusPendingApproval;
      case 'documents_collection':
      case 'documents':
        return l.statusDocumentsCollection;
      case 'documents_translation':
        return l.statusDocumentsTranslation;
      case 'apostille':
        return l.statusApostille;
      case 'application_submitted':
      case 'submitted':
      case 'online_ariza':
        return l.statusApplicationSubmitted;
      case 'in_review':
      case 'review':
        return l.statusInReview;
      case 'online_application':
        return l.journeyStageOnlineApplication;
      case 'offline_application':
      case 'originals_sent':
        return l.journeyStageOfflineApplication;
      case 'interview':
        return l.journeyStageInterview;
      case 'waiting_invoice':
        return l.journeyStageWaitingInvoice;
      case 'tuition_payment':
        return l.journeyStageTuitionPayment;
      case 'university_response':
        return l.statusUniversityResponse;
      case 'visa_documents':
      case 'visa':
        return l.statusVisaDocuments;
      case 'visa_issue':
        return l.journeyStageWaitingVisa;
      case 'completed':
      case 'accepted':
      case 'enrolled':
        return l.statusCompleted;
      case 'rejected':
        return l.statusRejected;
      default:
        return l.statusInProgress;
    }
  }

  /// Lime stage caption beside the step count.
  static final TextStyle _stageStyle = SeoulType.caption.copyWith(
    color: SeoulColors.lime,
    fontWeight: FontWeight.w700,
  );

  /// Done → full lime + glow, in progress → half filled, ahead → empty.
  static double _segmentValue(int index, int currentIndex, bool completed) {
    if (completed || index < currentIndex) return 1;
    if (index == currentIndex) return 0.5;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final step = stepFor(status);
    final currentIndex = step - 1;
    final completed = isCompleted(status);
    // What the status means, not only which stage it sits in — "Documents
    // translated" and "Apostille ready" share the first stage.
    final stage = statusLabel(status, l);

    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (step > 0)
                Text(l.sessionStepLabel(step), style: SeoulType.eyebrow)
              else
                const Text(pendingKo, style: SeoulType.hangulLabel),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  stage,
                  textAlign: TextAlign.end,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _stageStyle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (var i = 0; i < stepCount; i++) ...[
                if (i > 0) const SizedBox(width: _segmentGap),
                Expanded(
                  child: GlowProgressBar(
                    value: _segmentValue(i, currentIndex, completed),
                    height: _segmentHeight,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              // First stage of the journey — the localized "Docs" label.
              Text(l.navDocs, style: SeoulType.caption),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  stepLabels(l).last,
                  textAlign: TextAlign.end,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.caption,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
