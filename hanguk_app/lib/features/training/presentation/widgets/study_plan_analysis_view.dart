import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/study_plan_repository.dart';

/// Step 4 of the drafting wizard: the AI's read on the current draft.
///
/// Seoul Night: the feedback itself lives on a glass card, and the
/// track-mismatch notice is a warning-toned block carrying a [StatusChip]
/// with the track the session is actually on.
class StudyPlanAnalysisView extends ConsumerWidget {
  final String documentType;
  const StudyPlanAnalysisView({super.key, required this.documentType});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(documentSessionProvider(documentType));

    // Audit U6: use the dedicated isAnalyzing flag so we don't show a
    // spinner during unrelated state mutations (createSession,
    // loadSession, saveDraft all flip isLoading).
    if (state.isAnalyzing) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
        ),
      );
    }

    final analysis = state.analyses.isNotEmpty ? state.analyses.first : null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        4,
        SeoulSizes.screenPadding,
        20,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HangulTag(
            en: l.analysisFeedbackTitle,
            ko: '피드백',
            titleStyle: SeoulType.title,
          ),
          const SizedBox(height: 16),
          if (analysis == null) ...[
            const Spacer(),
            // A failed analysis used to land on the same neutral "nothing here
            // yet" as never having run one. The student pressed Analyze, was
            // moved to this step, and was told nothing — a locked feature, a
            // dropped connection and a bug all looked identical. Say which.
            if (_failureMessage(l, state.error) case final String message)
              _AnalysisFailure(
                message: message,
                retryLabel: l.analysisRetryButton,
                onRetry: () => ref
                    .read(studyPlanSessionProvider.notifier)
                    .analyzeCurrentDraft(documentType),
              )
            else
              Center(
                child: Text(l.noAnalysisYet, style: SeoulType.bodySecondary),
              ),
            const Spacer(),
          ] else ...[
            Expanded(
              child: GlassCard(
                padding: const EdgeInsets.all(18),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_detectTrackMismatch(
                        state.draftContent,
                        state.currentSession?.selectedTrack,
                      ))
                        _TrackWarning(
                          trackLabel: _trackLabel(
                            l,
                            state.currentSession?.selectedTrack,
                          ),
                        ),
                      if (analysis.aiResponse != null &&
                          analysis.aiResponse!.isNotEmpty)
                        Text(
                          analysis.aiResponse!,
                          style: SeoulType.bodySecondary,
                        )
                      else
                        Text(l.aiReviewedDraft, style: SeoulType.body),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          LimeButton(
            label: l.returnToDrafting,
            onPressed: () => ref
                .read(studyPlanSessionProvider.notifier)
                .updateSessionStep(documentType, 3),
          ),
        ],
      ),
    );
  }

  bool _detectTrackMismatch(String content, String? track) {
    if (track == null || content.isEmpty) return false;

    final koreanReg = RegExp(r'[가-힣]');
    final latinReg = RegExp(r'[a-zA-Z]');

    final hasKorean = koreanReg.hasMatch(content);
    final hasLatin = latinReg.hasMatch(content);

    // Sessions now store 'en'/'ko' (they used to store 'english'/'korean'),
    // so normalize both old and new codes — otherwise this check silently
    // never fires for any session created after the code switch.
    final normalized = switch (track) {
      'english' || 'en' => 'english',
      'korean' || 'ko' => 'korean',
      _ => track,
    };

    if (normalized == 'english' && hasKorean && !hasLatin) return true;
    if (normalized == 'korean' && hasLatin && !hasKorean) return true;

    return false;
  }

  /// Display name of the track the session is on. Accepts both the legacy
  /// ('english'/'korean') and current ('en'/'ko') codes, exactly like
  /// [_detectTrackMismatch] does.
  String _trackLabel(AppLocalizations l, String? track) => switch (track) {
    'korean' || 'ko' => l.trackKorean,
    _ => l.trackEnglish,
  };
}

/// "Your draft's language doesn't match your chosen track."
///
/// The notice is shown in the USER's UI language (not the track's language),
/// so every locale can read it. Previously it was hardcoded per-track
/// (ko/en/uz only) — see audit U2 / G3·4.
class _TrackWarning extends StatelessWidget {
  const _TrackWarning({required this.trackLabel});

  /// Localized name of the track the draft was supposed to be written in.
  final String trackLabel;

  @override
  Widget build(BuildContext context) {
    final message = AppLocalizations.of(context)!.trackMismatchWarning;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SeoulColors.warningFill,
        borderRadius: SeoulRadii.tileR,
        border: Border.all(color: SeoulColors.warning.withValues(alpha: 0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: SeoulColors.warningText,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: SeoulType.bodySecondary.copyWith(
                    color: SeoulColors.warningText,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: StatusChip(
                label: trackLabel,
                tone: StatusTone.warning,
                ko: '주의',
                dense: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The localized reason the analysis is missing, or null when it simply has
/// not been run yet.
///
/// Only codes this view knows are surfaced. Anything else — a stale or
/// unrelated error left on the session state — falls back to the neutral
/// empty state rather than showing a student a string meant for a log.
String? _failureMessage(AppLocalizations l, String? error) {
  switch (error) {
    case analysisErrorPlanRequired:
      return l.analysisErrorPlanRequired;
    case analysisErrorRateLimited:
      return l.analysisErrorRateLimited;
    case analysisErrorServiceDown:
      return l.analysisErrorServiceDown;
    case analysisErrorFailed:
      return l.analysisErrorFailed;
  }
  return null;
}

/// Why the analysis is not here, and a way to ask again.
class _AnalysisFailure extends StatelessWidget {
  const _AnalysisFailure({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.error_outline,
            color: SeoulColors.warningText,
            size: 28,
          ),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: SeoulType.bodySecondary,
          ),
          const SizedBox(height: 18),
          SeoulOutlineButton(
            label: retryLabel,
            expand: false,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}
