import 'package:flutter/material.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';

/// The journey segment bar (DESIGN_SPEC §3.4).
///
/// One segment per stage of the application journey: every stage the student
/// has already cleared is solid lime with a glow, the stage in progress is
/// partially filled, and the stages ahead are empty track.
///
/// This replaces the vertical timeline that used to live here. The
/// status → stage mapping in [stepFor] is unchanged: those are the real
/// `applications.status` values the CRM writes (the app has never modelled
/// any others), so anything the mapping does not know about simply reads as
/// "not started" exactly as before.
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

  /// How many stages of the journey this status has reached (0 = not started,
  /// [stepCount] = the last stage). Unchanged from the timeline this widget
  /// replaced.
  static int stepFor(String status) {
    switch (status) {
      case 'rejected':
      case 'visa_issue':
        return 9;
      case 'visa_documents':
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
        return 3;
      case 'online_application':
        return 2;
      case 'documents_collection':
        return 1;
      case 'pending':
      case 'pending_approval':
        return 0; // Not actively processing yet.
      default:
        return 0; // Unknown / not-yet-modelled status.
    }
  }

  /// 0.0–1.0 progress along the journey, for a [GlowProgressBar].
  static double progressFor(String status) => stepFor(status) / stepCount;

  /// Label of the stage currently in progress, or null before the journey
  /// starts.
  static String? currentStageLabel(String status, AppLocalizations l) {
    final index = stepFor(status) - 1;
    final labels = stepLabels(l);
    if (index < 0 || index >= labels.length) return null;
    return labels[index];
  }

  /// Lime stage caption beside the step count.
  static final TextStyle _stageStyle = SeoulType.caption.copyWith(
    color: SeoulColors.lime,
    fontWeight: FontWeight.w700,
  );

  /// Done → full lime + glow, in progress → half filled, ahead → empty.
  static double _segmentValue(int index, int currentIndex) {
    if (index < currentIndex) return 1;
    if (index == currentIndex) return 0.5;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final step = stepFor(status);
    final currentIndex = step - 1;
    final stage = currentStageLabel(status, l);

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
              if (stage != null)
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
                    value: _segmentValue(i, currentIndex),
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
              // Last stage.
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
