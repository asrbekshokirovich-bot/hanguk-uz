import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/theme/app_colors.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/study_plan_repository.dart';
import '../study_plan_screen.dart';

/// Past Study Plan / Personal Statement sessions, scoped to one
/// document type. Mirrors `InterviewHistoryView` and ports the React
/// web app's session-history list to Flutter (training-system-parity
/// plan §1, smallest viable slice).
///
/// Tapping a row resumes the session in [StudyPlanScreen].
class StudyPlanHistoryView extends ConsumerStatefulWidget {
  const StudyPlanHistoryView({super.key, required this.documentType});

  /// Either `'study_plan'` or `'personal_statement'`. Drives the
  /// fetch filter and the title.
  final String documentType;

  @override
  ConsumerState<StudyPlanHistoryView> createState() =>
      _StudyPlanHistoryViewState();
}

class _StudyPlanHistoryViewState extends ConsumerState<StudyPlanHistoryView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(studyPlanSessionProvider.notifier)
          .fetchSessions(widget.documentType);
    });
  }

  String _localizedTitle(AppLocalizations l) {
    switch (widget.documentType) {
      case 'study_plan':
        return l.studyPlanHistoryTitle;
      case 'personal_statement':
        return l.personalStatementHistoryTitle;
      default:
        return l.draftingHistoryTitle;
    }
  }

  String _formatTimestamp(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('yyyy-MM-dd HH:mm').format(dt);
    } on FormatException {
      return iso;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed':
        return AppColors.vibrantLime;
      case 'in_progress':
        return Colors.amberAccent;
      default:
        return Colors.white70;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(documentSessionProvider(widget.documentType));

    return Scaffold(
      backgroundColor: AppColors.backgroundNavy,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          _localizedTitle(l),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.vibrantLime,
          onRefresh: () => ref
              .read(studyPlanSessionProvider.notifier)
              .fetchSessions(widget.documentType),
          child: _buildBody(state),
        ),
      ),
    );
  }

  Widget _buildBody(StudyPlanSessionState state) {
    final l = AppLocalizations.of(context)!;
    if (state.isSessionsLoading && state.sessions.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.vibrantLime),
      );
    }
    if (state.sessions.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 120),
          Icon(
            Icons.history,
            size: 64,
            color: Colors.white.withValues(alpha: 0.2),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              l.noPastDraftsYet,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                l.noPastDraftsBody,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ),
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      itemCount: state.sessions.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, i) => _buildSessionCard(state.sessions[i]),
    );
  }

  Widget _buildSessionCard(StudyPlanSession session) {
    final l = AppLocalizations.of(context)!;
    return Material(
      color: Colors.white.withValues(alpha: 0.04),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          ref
              .read(studyPlanSessionProvider.notifier)
              .loadSession(widget.documentType, session.id);
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) =>
                  StudyPlanScreen(documentType: widget.documentType),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      session.universityNameEn ?? l.noTargetUniversity,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: _statusColor(
                        session.status,
                      ).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      session.status,
                      style: TextStyle(
                        color: _statusColor(session.status),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(
                    Icons.flag_outlined,
                    size: 14,
                    color: Colors.white70,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    l.sessionStepLabel(session.currentStep),
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                  const SizedBox(width: 14),
                  if (session.selectedTrack != null) ...[
                    const Icon(
                      Icons.translate,
                      size: 14,
                      color: Colors.white70,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      session.selectedTrack!,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _formatTimestamp(session.updatedAt),
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
