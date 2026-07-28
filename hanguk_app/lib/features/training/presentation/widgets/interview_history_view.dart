import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/interview_repository.dart';
import 'interview_analytics_view.dart';

class InterviewHistoryView extends ConsumerStatefulWidget {
  const InterviewHistoryView({super.key});

  @override
  ConsumerState<InterviewHistoryView> createState() =>
      _InterviewHistoryViewState();
}

class _InterviewHistoryViewState extends ConsumerState<InterviewHistoryView> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _sessions = [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    // Reached from _confirmDelete after two awaits; the catch branch there
    // already guards, the success path did not.
    if (!mounted) return;
    setState(() => _isLoading = true);
    final history = await ref
        .read(interviewProvider.notifier)
        .getSessionHistory();
    if (mounted) {
      setState(() {
        _sessions = history;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return SeoulNightScaffold(
      body: Column(
        children: [
          Padding(
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
                    onTap: () => Navigator.pop(context),
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
                    en: l.interviewHistoryTitle,
                    ko: '면접 기록',
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: SeoulColors.lime),
                  )
                : _sessions.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.history,
                          size: 56,
                          color: SeoulColors.textFaint,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          l.noPastInterviews,
                          style: SeoulType.bodySecondary,
                        ),
                        const SizedBox(height: 6),
                        Text('기록 없음', style: SeoulType.hangulLabel),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadHistory,
                    color: SeoulColors.lime,
                    backgroundColor: SeoulColors.royalBlue,
                    child: ListView.builder(
                      padding: const EdgeInsets.fromLTRB(
                        SeoulSizes.screenPadding,
                        4,
                        SeoulSizes.screenPadding,
                        40,
                      ),
                      itemCount: _sessions.length,
                      itemBuilder: (context, index) {
                        final session = _sessions[index];
                        return _buildSessionCard(session);
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionCard(Map<String, dynamic> session) {
    final l = AppLocalizations.of(context)!;
    String uniName = l.unknownTarget;
    // Phase 3R-B renamed the FK column from `target_university_id` to
    // `target_institution_id`; the embed-relation alias in
    // InterviewNotifier.getSessionHistory() now reads `institution`.
    // Accept either alias for backwards compatibility with any cached
    // responses still in flight.
    final inst =
        (session['institution'] as Map?) ?? (session['universities'] as Map?);
    if (inst != null) {
      final en = inst['name_en'] as String?;
      final ko = inst['name_ko'] as String?;
      uniName = (en != null && en.isNotEmpty)
          ? en
          : ((ko != null && ko.isNotEmpty) ? ko : l.unknownUniversity);
    }

    final createdAt = DateTime.parse(session['created_at']).toLocal();
    // Audit H3: locale-aware date format. `Localizations.localeOf` is
    // safe to read here because the widget rebuilds on locale change.
    final locale = Localizations.localeOf(context).toLanguageTag();
    final formattedDate = DateFormat.yMMMd(locale).add_jm().format(createdAt);
    final status = session['status'] as String? ?? 'unknown';
    final isCompleted = status == 'completed';
    final isAbandoned = status == 'abandoned';

    // Korean status words (spec §1 Korean voice) stay Korean in every locale;
    // the tint and the icon carry the same meaning for non-Korean readers.
    final Color statusColor = isCompleted
        ? SeoulColors.lime
        : (isAbandoned ? SeoulColors.textFaint : SeoulColors.warningText);
    final String statusKo = isCompleted ? '완료' : (isAbandoned ? '중단' : '대기');
    final IconData statusIcon = isCompleted
        ? Icons.check_circle_outline
        : (isAbandoned ? Icons.cancel_outlined : Icons.pending_outlined);

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      blur: false,
      onTap: () {
        if (isCompleted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => InterviewAnalyticsView(
                overrideSessionId: session['id'],
                overrideVapiCallId: session['vapi_call_id'] as String?,
                onBackPressed: () => Navigator.pop(context),
              ),
            ),
          );
        } else {
          // Audit H1: explain why an in-progress session can't be opened.
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                isAbandoned ? l.abandonedSessionNote : l.activeSessionNote,
              ),
            ),
          );
        }
      },
      child: Row(
        children: [
          Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isCompleted
                  ? SeoulColors.limeFill
                  : SeoulColors.neutralFill,
              border: Border.all(
                color: isCompleted
                    ? SeoulColors.lime.withValues(alpha: 0.35)
                    : SeoulColors.glassBorder,
              ),
            ),
            child: Icon(statusIcon, size: 20, color: statusColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        uniName,
                        style: SeoulType.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      statusKo,
                      style: SeoulType.hangulStatus.copyWith(
                        color: statusColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(formattedDate, style: SeoulType.caption),
              ],
            ),
          ),
          // Audit H2: deletion. Confirms first because the row is gone
          // for good.
          IconButton(
            tooltip: l.deleteSessionTooltip,
            icon: const Icon(
              Icons.delete_outline,
              color: SeoulColors.textSecondary,
              size: 20,
            ),
            onPressed: () => _confirmDelete(session['id'] as String),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(String sessionId) async {
    final l = AppLocalizations.of(context)!;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final dl = AppLocalizations.of(ctx)!;
        return AlertDialog(
          // The deepest opaque navy in the token set — a dialog cannot be
          // glass, it has to occlude what is behind it.
          backgroundColor: SeoulColors.mapWater,
          shape: const RoundedRectangleBorder(
            borderRadius: SeoulRadii.cardR,
            side: BorderSide(color: SeoulColors.glassBorder),
          ),
          title: Text(dl.deleteInterviewDialogTitle, style: SeoulType.title),
          content: Text(
            dl.deleteInterviewDialogBody,
            style: SeoulType.bodySecondary,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(
                dl.cancel,
                style: SeoulType.button.copyWith(
                  color: SeoulColors.textSecondary,
                ),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(
                dl.deleteLabel,
                style: SeoulType.button.copyWith(color: SeoulColors.dangerText),
              ),
            ),
          ],
        );
      },
    );
    if (ok != true) return;
    try {
      await Supabase.instance.client
          .from('interview_sessions')
          .delete()
          .eq('id', sessionId);
      await _loadHistory();
    } on Exception catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l.deleteFailed(e))));
    }
  }
}
