import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../design_system/adaptive/hanguk_scaffold.dart';
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
  bool _showAnalytics = false;

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

    return HangukScaffold(
      appBar: AppBar(
        title: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(l.interviewPracticeTitle),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (state.status == 'active')
            TextButton(
              onPressed: () async {
                await ref
                    .read(interviewProvider.notifier)
                    .endSession(language: state.selectedLanguage);
                // Note: Vapi call cleanup is handled by InterviewActiveView.dispose()
                // via the centralized _stopCall() method.
              },
              child: Text(
                l.endSession,
                style: const TextStyle(color: AppColors.error),
              ),
            ),
        ],
      ),
      body: SafeArea(child: _buildCurrentView(state)),
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
              const CircularProgressIndicator(color: AppColors.vibrantLime),
              const SizedBox(height: 16),
              Text(
                l.interviewSettingUp,
                style: const TextStyle(color: Colors.white70),
              ),
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
