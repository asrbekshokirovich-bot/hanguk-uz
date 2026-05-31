import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../design_system/theme/app_colors.dart';
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
    return Container(
      color: AppColors.backgroundNavy,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    tooltip: l.a11yTooltipBack,
                    onPressed: () => Navigator.pop(context),
                  ),
                  Text(
                    l.interviewHistoryTitle,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.vibrantLime,
                      ),
                    )
                  : _sessions.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.history,
                            size: 64,
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            l.noPastInterviews,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadHistory,
                      color: AppColors.vibrantLime,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 8,
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

    return GestureDetector(
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
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surfaceGlass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderGlass),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isCompleted
                    ? Colors.greenAccent.withValues(alpha: 0.1)
                    : (isAbandoned
                          ? Colors.white12
                          : Colors.orangeAccent.withValues(alpha: 0.1)),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isCompleted
                    ? Icons.check_circle_outline
                    : (isAbandoned
                          ? Icons.cancel_outlined
                          : Icons.pending_outlined),
                color: isCompleted
                    ? Colors.greenAccent
                    : (isAbandoned ? Colors.white54 : Colors.orangeAccent),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    uniName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formattedDate,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Audit H2: deletion. Confirms first because the row is gone
            // for good.
            IconButton(
              tooltip: l.deleteSessionTooltip,
              icon: const Icon(
                Icons.delete_outline,
                color: Colors.white70,
                size: 20,
              ),
              onPressed: () => _confirmDelete(session['id'] as String),
            ),
            Icon(
              Icons.chevron_right,
              color: Colors.white.withValues(alpha: 0.3),
            ),
          ],
        ),
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
          backgroundColor: AppColors.backgroundNavy,
          title: Text(
            dl.deleteInterviewDialogTitle,
            style: const TextStyle(color: Colors.white),
          ),
          content: Text(
            dl.deleteInterviewDialogBody,
            style: const TextStyle(color: Colors.white70),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(
                dl.cancel,
                style: const TextStyle(color: Colors.white54),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(dl.deleteLabel),
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
