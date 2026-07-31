import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
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

  /// Decorative hangul beside the title — stays Korean in every locale
  /// (DESIGN_SPEC §1 Korean voice).
  String get _hangulTitle => switch (widget.documentType) {
    'study_plan' => '학업계획서',
    'personal_statement' => '자기소개서',
    _ => '지난 초안',
  };

  String _formatTimestamp(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('yyyy-MM-dd HH:mm').format(dt);
    } on FormatException {
      return iso;
    }
  }

  StatusTone _statusTone(String status) {
    switch (status) {
      case 'completed':
        return StatusTone.lime;
      case 'in_progress':
        return StatusTone.warning;
      default:
        return StatusTone.neutral;
    }
  }

  /// Korean status word for the chip: 완료 done · 대기 pending (spec §1).
  String? _statusKo(String status) {
    switch (status) {
      case 'completed':
        return '완료';
      case 'in_progress':
        return '대기';
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(documentSessionProvider(widget.documentType));

    return SeoulNightScaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              12,
              SeoulSizes.screenPadding,
              8,
            ),
            child: Row(
              children: [
                _GlassCircleButton(
                  icon: Icons.arrow_back_rounded,
                  tooltip: l.a11yTooltipBack,
                  onTap: () => Navigator.of(context).maybePop(),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: HangulTag(
                    en: _localizedTitle(l),
                    ko: _hangulTitle,
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: SeoulColors.ink,
              backgroundColor: SeoulColors.lime,
              onRefresh: () => ref
                  .read(studyPlanSessionProvider.notifier)
                  .fetchSessions(widget.documentType),
              child: _buildBody(state),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(StudyPlanSessionState state) {
    final l = AppLocalizations.of(context)!;
    if (state.isSessionsLoading && state.sessions.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
        ),
      );
    }
    if (state.sessions.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(
          horizontal: SeoulSizes.screenPadding,
        ),
        children: [
          const SizedBox(height: 80),
          const Center(
            child: HangulGlyphTile(
              glyph: '초',
              size: 72,
              radius: SeoulRadii.hero,
            ),
          ),
          const SizedBox(height: 20),
          Center(child: Text(l.noPastDraftsYet, style: SeoulType.subtitle)),
          const SizedBox(height: 8),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                l.noPastDraftsBody,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
            ),
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        8,
        SeoulSizes.screenPadding,
        28,
      ),
      itemCount: state.sessions.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, i) => _buildSessionCard(state.sessions[i]),
    );
  }

  Widget _buildSessionCard(StudyPlanSession session) {
    final l = AppLocalizations.of(context)!;
    return GlassCard(
      // Long lists: one saved layer per card is not worth the blur.
      blur: false,
      padding: const EdgeInsets.all(16),
      onTap: () {
        ref
            .read(studyPlanSessionProvider.notifier)
            .loadSession(widget.documentType, session.id);
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => StudyPlanScreen(documentType: widget.documentType),
          ),
        );
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HangulGlyphTile(
            glyph: HangulGlyphTile.firstSyllable(_hangulTitle),
            active: session.status == 'completed',
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        session.universityNameEn ?? l.noTargetUniversity,
                        style: SeoulType.subtitle,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    StatusChip(
                      label: session.status,
                      tone: _statusTone(session.status),
                      ko: _statusKo(session.status),
                      dense: true,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.flag_outlined,
                      size: 14,
                      color: SeoulColors.textFaint,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      l.sessionStepLabel(session.currentStep),
                      style: SeoulType.caption,
                    ),
                    if (session.selectedTrack != null) ...[
                      const SizedBox(width: 14),
                      const Icon(
                        Icons.translate,
                        size: 14,
                        color: SeoulColors.textFaint,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        session.selectedTrack!.toUpperCase(),
                        style: SeoulType.caption,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  _formatTimestamp(session.updatedAt),
                  style: SeoulType.caption.copyWith(fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 44px glass circle holding one icon — the back affordance used across the
/// Seoul Night shell (spec §2).
class _GlassCircleButton extends StatelessWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: SeoulColors.glass,
              border: Border.all(color: SeoulColors.glassBorder),
            ),
            child: Icon(icon, size: 20, color: SeoulColors.textPrimary),
          ),
        ),
      ),
    );
  }
}
