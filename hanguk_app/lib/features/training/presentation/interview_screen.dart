import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../data/interview_repository.dart';

import 'widgets/interview_setup_view.dart';
import 'widgets/interview_active_view.dart';
import 'widgets/interview_analytics_view.dart';
import 'widgets/interview_history_view.dart';

class InterviewScreen extends ConsumerStatefulWidget {
  /// Optional initial configuration passed from the TrainingTab dialog.
  /// When provided, the session starts automatically in initState so the
  /// user sees the interview screen immediately (no dialog blocking).
  final String? initialSessionType;
  final String? initialUniversityId;
  final String? initialUniversityName;
  final String? initialLanguage;
  final String? initialPersona;

  const InterviewScreen({
    super.key,
    this.initialSessionType,
    this.initialUniversityId,
    this.initialUniversityName,
    this.initialLanguage,
    this.initialPersona,
  });

  @override
  ConsumerState<InterviewScreen> createState() => _InterviewScreenState();
}

class _InterviewScreenState extends ConsumerState<InterviewScreen> {
  @override
  void initState() {
    super.initState();
    // If launched from the training tab dialog with pre-filled config,
    // start the session immediately so users don't wait in a blocked dialog.
    if (widget.initialUniversityId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref
            .read(interviewProvider.notifier)
            .startSession(
              sessionType: widget.initialSessionType ?? 'university_specific',
              targetUniversityId: widget.initialUniversityId,
              targetUniversityName: widget.initialUniversityName,
              language: widget.initialLanguage ?? 'ko',
              persona: widget.initialPersona ?? 'friendly',
            );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(interviewProvider);

    // Seoul Night: the gradient + ambient glow blobs come from the scaffold,
    // and the section header replaces the old AppBar (spec §2 — a glass
    // back-circle, an English title with its small lime hangul label).
    return SeoulNightScaffold(
      body: Column(
        children: [
          _buildHeader(l, state),
          Expanded(child: _buildCurrentView(state)),
        ],
      ),
    );
  }

  Widget _buildHeader(AppLocalizations l, InterviewSessionState state) {
    final isCompleted = state.status == 'completed';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        10,
        SeoulSizes.screenPadding,
        10,
      ),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: l.a11yTooltipBack,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).maybePop(),
              child: Container(
                width: SeoulSizes.minTapTarget,
                height: SeoulSizes.minTapTarget,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: SeoulColors.glass,
                  border: Border.fromBorderSide(
                    BorderSide(color: SeoulColors.glassBorder),
                  ),
                ),
                child: const Icon(
                  Icons.arrow_back_rounded,
                  size: 20,
                  color: SeoulColors.textPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: HangulTag(
              en: isCompleted
                  ? l.interviewAnalyticsTitle
                  : l.interviewPracticeTitle,
              ko: isCompleted ? '면접 결과' : '면접 연습',
              titleStyle: SeoulType.title,
            ),
          ),
          // Unchanged behaviour: the header End control is rendered while the
          // session row is 'active' and asks the notifier to end it — the Vapi
          // teardown itself still runs in InterviewActiveView.dispose() via
          // the centralized _stopCall(). The always-visible, always-reachable
          // End control is the labelled one inside InterviewActiveView.
          if (state.status == 'active') ...[
            const SizedBox(width: 10),
            _HeaderEndAction(
              label: l.endSession,
              onTap: () async {
                await ref
                    .read(interviewProvider.notifier)
                    .endSession(language: state.selectedLanguage);
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCurrentView(InterviewSessionState state) {
    final l = AppLocalizations.of(context)!;
    if (state.status == 'idle') {
      // Loading state while startSession() runs after navigation
      if (state.isLoading) {
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(color: SeoulColors.lime),
              const SizedBox(height: 16),
              Text(l.interviewSettingUp, style: SeoulType.bodySecondary),
            ],
          ),
        );
      }
      return InterviewSetupView(
        onHistoryTapped: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const InterviewHistoryView()),
          );
        },
      );
    } else if (state.status == 'completed') {
      // Analytics is the richer post-session view — overall + per-metric
      // scores, strengths/improvements, and the audio player for replaying
      // the recorded session. The simpler InterviewFeedbackView is reachable
      // separately if needed.
      return const InterviewAnalyticsView();
    } else if (state.status == 'active') {
      return const InterviewActiveView();
    } else {
      // 'abandoned' (or anything unexpected): never remount the live-call
      // view against a dead session — return to setup instead.
      return InterviewSetupView(
        onHistoryTapped: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const InterviewHistoryView()),
          );
        },
      );
    }
  }
}

/// Compact destructive action in the section header. Warning-tinted rather
/// than red: Seoul Night has no raw red, and `warning*` is the token family
/// for "this needs your attention" (spec §1 Color tokens).
class _HeaderEndAction extends StatelessWidget {
  const _HeaderEndAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        label: label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: SeoulColors.warningFill,
              border: Border.all(
                color: SeoulColors.warning.withValues(alpha: 0.45),
              ),
            ),
            child: const Icon(
              Icons.call_end,
              size: 20,
              color: SeoulColors.warningText,
            ),
          ),
        ),
      ),
    );
  }
}
