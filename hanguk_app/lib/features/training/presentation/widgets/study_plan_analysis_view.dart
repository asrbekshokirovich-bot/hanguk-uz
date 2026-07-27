import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/study_plan_repository.dart';

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
        child: CircularProgressIndicator(color: AppColors.vibrantLime),
      );
    }

    final analysis = state.analyses.isNotEmpty ? state.analyses.first : null;

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.analysisFeedbackTitle,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          if (analysis == null) ...[
            const Spacer(),
            Center(
              child: Text(
                l.noAnalysisYet,
                style: const TextStyle(color: Colors.white54),
              ),
            ),
            const Spacer(),
          ] else ...[
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.royalBlue.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_detectTrackMismatch(
                        state.draftContent,
                        state.currentSession?.selectedTrack,
                      ))
                        _buildTrackWarning(),
                      if (analysis.aiResponse != null &&
                          analysis.aiResponse!.isNotEmpty)
                        Text(
                          analysis.aiResponse!,
                          style: const TextStyle(
                            color: Colors.white70,
                            height: 1.5,
                            fontSize: 14,
                          ),
                        )
                      else
                        Text(
                          l.aiReviewedDraft,
                          style: const TextStyle(color: Colors.white),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onPressed: () => ref
                .read(studyPlanSessionProvider.notifier)
                .updateSessionStep(documentType, 3),
            child: Text(
              l.returnToDrafting,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
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

  Widget _buildTrackWarning() {
    return Builder(
      builder: (context) {
        // Show the "your draft language doesn't match your chosen track"
        // notice in the USER's UI language (not the track's language), so
        // every locale can read it. Previously it was hardcoded per-track
        // (ko/en/uz only) — see audit U2 / G3·4.
        final message = AppLocalizations.of(context)!.trackMismatchWarning;
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.redAccent.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Colors.redAccent.withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Colors.redAccent,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    color: Colors.redAccent,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
