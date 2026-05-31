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

    if (track == 'english' && hasKorean && !hasLatin) return true;
    if (track == 'korean' && hasLatin && !hasKorean) return true;

    return false;
  }

  Widget _buildTrackWarning() {
    return Builder(
      builder: (context) {
        // Hardcoded Uzbek copy was unreadable for Korean / English
        // speakers — see audit U2. Picks the message from the session
        // track until full intl wiring lands.
        return Consumer(
          builder: (context, ref, _) {
            final state = ref.watch(documentSessionProvider(documentType));
            final track = state.currentSession?.selectedTrack ?? 'uzbek';
            final message = switch (track) {
              'korean' => '선택한 작성 언어와 본문 언어가 다릅니다. 선택한 언어로 다시 작성해 주세요.',
              'english' =>
                'Your draft language does not match the selected track. Please rewrite in the selected language.',
              _ =>
                'Sening tracking boshqa edi! Draftini tanlangan tilda yozganingga ishonch hosil qil.',
            };
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
      },
    );
  }
}
