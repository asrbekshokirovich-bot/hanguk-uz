import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/domain/catalog_models.dart';

/// What the AI gave the Study Plan (`admission-study-plan-test`).
@immutable
class StudyPlanTestResult {
  const StudyPlanTestResult({
    required this.score,
    required this.motivation,
    required this.plan,
    required this.career,
    required this.language,
    required this.strengths,
    required this.improvements,
    required this.summary,
  });

  factory StudyPlanTestResult.fromJson(Map<String, dynamic> j) {
    int n(String k) => (j[k] as num?)?.round() ?? 0;
    List<String> list(String k) => [for (final x in (j[k] as List?) ?? const []) '$x'];
    return StudyPlanTestResult(
      score: n('score'),
      motivation: n('motivation'),
      plan: n('plan'),
      career: n('career'),
      language: n('language'),
      strengths: list('strengths'),
      improvements: list('improvements'),
      summary: j['summary'] as String? ?? '',
    );
  }

  final int score;
  final int motivation;
  final int plan;
  final int career;
  final int language;
  final List<String> strengths;
  final List<String> improvements;
  final String summary;
}

/// The Study Plan test of one university: the three questions a study plan
/// answers, four minutes, taken once. When time runs out what is written is
/// sent as it stands.
class StudyPlanTestScreen extends StatefulWidget {
  const StudyPlanTestScreen({super.key, required this.university, this.minutes = 4, this.send});

  final CatalogUniversity university;
  final int minutes;

  /// Sends the answers for marking; the edge function by default (tests
  /// pass their own).
  final Future<StudyPlanTestResult> Function(List<String> answers, int seconds)? send;

  @override
  State<StudyPlanTestScreen> createState() => _StudyPlanTestScreenState();
}

class _StudyPlanTestScreenState extends State<StudyPlanTestScreen> {
  final _answers = List.generate(3, (_) => TextEditingController());
  late int _left = widget.minutes * 60;
  Timer? _timer;
  bool _sending = false;
  String? _error;
  StudyPlanTestResult? _result;

  @override
  void initState() {
    super.initState();
    AppEvents.track('study_plan_test_open', props: {'institution_id': widget.university.institutionId});
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _left--);
      if (_left <= 0) {
        _timer?.cancel();
        _submit();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _answers) {
      c.dispose();
    }
    super.dispose();
  }

  Future<StudyPlanTestResult> _sendToServer(List<String> answers, int seconds) async {
    final res = await Supabase.instance.client.functions.invoke(
      'admission-study-plan-test',
      body: {
        'institutionId': widget.university.institutionId,
        'answers': answers,
        'language': AppLocalizations.of(context)!.localeName,
        'seconds': seconds,
      },
    );
    final data = res.data;
    if (data is! Map<String, dynamic> || data['error'] != null) throw Exception('$data');
    return StudyPlanTestResult.fromJson(data);
  }

  /// At least one answer long enough to be marked (the server gives 0
  /// without marking when every answer is under 20 characters).
  bool get _hasAnswer => _answers.any((c) => c.text.trim().length >= 20);

  Future<void> _submit() async {
    if (_sending || _result != null) return;
    _timer?.cancel();
    setState(() {
      _sending = true;
      _error = null;
    });
    final used = widget.minutes * 60 - _left.clamp(0, widget.minutes * 60);
    try {
      final answers = [for (final c in _answers) c.text.trim()];
      final r = await (widget.send ?? _sendToServer)(answers, used);
      if (!mounted) return;
      setState(() => _result = r);
    } catch (e) {
      debugPrint('[StudyPlanTest] $e');
      if (!mounted) return;
      setState(() => _error = AppLocalizations.of(context)!.sptError);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final result = _result;
    final m = (_left.clamp(0, 5999) ~/ 60).toString();
    final s = (_left.clamp(0, 5999) % 60).toString().padLeft(2, '0');
    final questions = [l.sptQ1, l.sptQ2, l.sptQ3];

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 8),
            child: Row(
              children: [
                HardIconButton(
                  glyph: LucideIcons.chevronLeft,
                  semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                  onTap: tracked('study_plan_test.chevron_left', () => Navigator.of(context).maybePop()),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(l.uaTestPlan, style: fdText(18, FontWeight.w800, FdColors.onPage, height: 1.1))),
                if (result == null) LimeTag('$m:$s'),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
              children: result != null
                  ? [_ResultCard(result: result)]
                  : [
                      Text(
                        l.sptIntro(widget.university.displayName, widget.minutes),
                        style: fdText(12, FontWeight.w500, FdColors.pageMuted, height: 1.45),
                      ),
                      const SizedBox(height: 12),
                      for (var i = 0; i < 3; i++) ...[
                        Container(
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                          decoration: BoxDecoration(
                            color: FdColors.card,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: FdColors.ink, width: 1.5),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                '${i + 1}. ${questions[i]}',
                                style: fdText(13, FontWeight.w800, FdColors.ink, height: 1.3),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _answers[i],
                                enabled: !_sending,
                                minLines: 3,
                                maxLines: 8,
                                maxLength: 1500,
                                style: fdText(13, FontWeight.w500, FdColors.ink, height: 1.4),
                                // Ink, not the theme's lime: lime on this near-white
                                // field all but disappears.
                                cursorColor: FdColors.ink,
                                decoration: InputDecoration(
                                  hintText: l.sptHint,
                                  hintStyle: fdText(13, FontWeight.w500, FdColors.muted),
                                  filled: true,
                                  fillColor: const Color(0xFFF4F6FB),
                                  isDense: true,
                                  contentPadding: const EdgeInsets.all(10),
                                  counterText: '',
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide.none,
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide.none,
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(color: FdColors.blue, width: 1.5),
                                  ),
                                  disabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide.none,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      if (_error != null) ...[
                        Text(_error!, style: fdText(12, FontWeight.w700, const Color(0xFFFFB4B4))),
                        const SizedBox(height: 10),
                      ],
                      if (_sending) ...[
                        Text(
                          l.sptChecking,
                          textAlign: TextAlign.center,
                          style: fdText(12, FontWeight.w700, FdColors.onPage),
                        ),
                        const SizedBox(height: 10),
                      ],
                      // Nothing written, nothing to send: the test is taken once,
                      // and a tap on an empty form used to spend that one try on
                      // a 0. When the time runs out, what is there is sent anyway.
                      ListenableBuilder(
                        listenable: Listenable.merge(_answers),
                        builder: (context, _) => HardButton(
                          label: l.sptSubmit,
                          loading: _sending,
                          onPressed: tracked('study_plan_test.spt_submit', _sending || !_hasAnswer ? null : _submit),
                        ),
                      ),
                    ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result});

  final StudyPlanTestResult result;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final rows = [
      (l.sptMotivation, result.motivation, 30),
      (l.sptPlan, result.plan, 30),
      (l.sptCareer, result.career, 20),
      (l.sptLanguage, result.language, 20),
    ];
    Widget list(String title, List<String> items) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 14),
        Text(title, style: fdText(12, FontWeight.w800, FdColors.ink)),
        const SizedBox(height: 4),
        for (final x in items)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text('• $x', style: fdText(12, FontWeight.w500, FdColors.muted, height: 1.4)),
          ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: FdColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.sptResultTitle, style: fdText(12, FontWeight.w800, FdColors.muted)),
              const SizedBox(height: 4),
              Text(l.uaTestScore(result.score), style: fdText(34, FontWeight.w800, FdColors.ink, height: 1.1)),
              if (result.summary.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(result.summary, style: fdText(12, FontWeight.w500, FdColors.muted, height: 1.4)),
              ],
              const SizedBox(height: 12),
              for (final (label, v, max) in rows) ...[
                Row(
                  children: [
                    Expanded(child: Text(label, style: fdText(12, FontWeight.w700, FdColors.ink))),
                    Text('$v/$max', style: fdText(12, FontWeight.w800, FdColors.ink)),
                  ],
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: max == 0 ? 0 : v / max,
                    minHeight: 6,
                    color: FdColors.lime,
                    backgroundColor: FdColors.tint,
                  ),
                ),
                const SizedBox(height: 8),
              ],
              if (result.strengths.isNotEmpty) list(l.sptStrengths, result.strengths),
              if (result.improvements.isNotEmpty) list(l.sptImprovements, result.improvements),
            ],
          ),
        ),
        const SizedBox(height: 14),
        HardButton(label: l.sptDone, onPressed: tracked('study_plan_test.spt_done', () => Navigator.of(context).maybePop())),
      ],
    );
  }
}
