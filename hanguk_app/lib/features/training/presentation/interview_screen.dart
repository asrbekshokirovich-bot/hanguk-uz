import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../core/analytics/tracked.dart';
import '../data/interview_repository.dart';

import 'widgets/interview_setup_view.dart';
import 'widgets/interview_active_view.dart';
import 'widgets/interview_analytics_view.dart';
import 'widgets/interview_history_view.dart';
import '../../../features/discover/presentation/widgets/app_nav.dart';

class InterviewScreen extends ConsumerStatefulWidget {
  /// Optional initial configuration passed by the caller.
  /// When provided, the session starts automatically in initState so the
  /// user sees the interview screen immediately (no dialog blocking).
  final String? initialSessionType;
  final String? initialUniversityId;
  final String? initialUniversityName;
  final String? initialLanguage;
  final String? initialPersona;

  /// The university assessment's interview test: timed, on a set topic.
  final int? initialTimeLimitSeconds;
  final String? initialFocusTopic;

  /// The university's interview test: exactly this many questions, then the
  /// result, then back to the university page.
  final int? initialQuestionLimit;

  const InterviewScreen({
    super.key,
    this.initialSessionType,
    this.initialUniversityId,
    this.initialUniversityName,
    this.initialLanguage,
    this.initialPersona,
    this.initialTimeLimitSeconds,
    this.initialFocusTopic,
    this.initialQuestionLimit,
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
              focusTopic: widget.initialFocusTopic,
              timedMode: widget.initialTimeLimitSeconds != null,
              timeLimitSeconds: widget.initialTimeLimitSeconds,
              questionLimit: widget.initialQuestionLimit,
            );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(interviewProvider);

    // The university's interview test: when it ends without a result (the
    // student never answered, or scoring failed — the live view says which),
    // go back to the university page, not to the general practice setup.
    if (widget.initialTimeLimitSeconds != null) {
      ref.listen(interviewProvider, (prev, next) {
        final wasLive = prev?.status == 'active' || prev?.status == 'abandoned';
        if (wasLive && next.status == 'idle' && mounted) Navigator.of(context).maybePop();
      });
    }

    // The live call is design screen 20, on the light page with its own
    // header (the X there ends the call).
    if (state.status == 'active') {
      return const Scaffold(
        backgroundColor: Colors.transparent,
        body: FdPage(child: SafeArea(child: InterviewActiveView())),
      );
    }

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
              onTap: tracked('interview.arrow_back', isCompleted && widget.initialTimeLimitSeconds != null
                  ? _done
                  : () => Navigator.of(context).maybePop()),
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
        ],
      ),
    );
  }

  /// Back to the university page, then clear the finished test out of the
  /// shared interview state (after the route has gone), so the practice
  /// interview does not open on this result.
  void _done() {
    final notifier = ref.read(interviewProvider.notifier);
    Navigator.of(context).maybePop();
    Future<void>.delayed(const Duration(milliseconds: 400), notifier.resetForNewSession);
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
        onHistoryTapped: tracked('interview.setup_view_history_tapped', () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const NavScaffold(current: AppTab.prepare, child: InterviewHistoryView()),
            ),
          );
        }),
      );
    } else if (state.status == 'completed') {
      // Analytics is the richer post-session view — overall + per-metric
      // scores, strengths/improvements, and the audio player for replaying
      // the recorded session. The simpler InterviewFeedbackView is reachable
      // separately if needed.
      // The university's test is taken once: its result ends with "Tayyor"
      // back to the university page, not a new practice interview.
      return InterviewAnalyticsView(
        onDone: widget.initialTimeLimitSeconds != null ? _done : null,
      );
    } else if (state.status == 'active') {
      return const InterviewActiveView();
    } else {
      // 'abandoned' (or anything unexpected): never remount the live-call
      // view against a dead session — return to setup instead.
      return InterviewSetupView(
        onHistoryTapped: tracked('interview.setup_view_history_tapped', () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const NavScaffold(current: AppTab.prepare, child: InterviewHistoryView()),
            ),
          );
        }),
      );
    }
  }
}
