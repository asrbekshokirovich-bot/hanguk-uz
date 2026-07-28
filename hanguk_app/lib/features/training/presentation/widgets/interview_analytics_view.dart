import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/interview_repository.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import 'package:audioplayers/audioplayers.dart';

class InterviewAnalyticsView extends ConsumerStatefulWidget {
  final VoidCallback? onBackPressed;
  final String?
  overrideSessionId; // Helpful for History View explicitly requesting a session
  final String?
  overrideVapiCallId; // Vapi call id for audio playback when viewing a past session

  const InterviewAnalyticsView({
    super.key,
    this.onBackPressed,
    this.overrideSessionId,
    this.overrideVapiCallId,
  });

  @override
  ConsumerState<InterviewAnalyticsView> createState() =>
      _InterviewAnalyticsViewState();
}

class _InterviewAnalyticsViewState
    extends ConsumerState<InterviewAnalyticsView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final targetId =
          widget.overrideSessionId ?? ref.read(interviewProvider).sessionId;
      if (targetId != null) {
        ref.read(interviewProvider.notifier).loadFeedback(targetId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(interviewProvider);

    // `onBackPressed` is only wired up when this view is pushed as its own
    // route from the history list. Embedded in InterviewScreen it inherits
    // that screen's Seoul Night background and header instead of drawing a
    // second one.
    final pushed = widget.onBackPressed != null;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (pushed)
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
                    onTap: widget.onBackPressed,
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
                    en: l.interviewAnalyticsTitle,
                    ko: '면접 결과',
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: state.isLoading
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const CircularProgressIndicator(color: SeoulColors.lime),
                      const SizedBox(height: 16),
                      Text(l.analyzingTranscript, style: SeoulType.bodySecondary),
                    ],
                  ),
                )
              : state.feedback == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(SeoulSizes.screenPadding),
                    child: Text(
                      state.error ?? l.noFeedbackAvailable,
                      textAlign: TextAlign.center,
                      style: SeoulType.body.copyWith(
                        color: SeoulColors.warningText,
                      ),
                    ),
                  ),
                )
              : _buildFeedbackContent(
                  l,
                  state.feedback!,
                  widget.overrideVapiCallId ?? state.vapiCallId,
                ),
        ),
      ],
    );

    return pushed ? SeoulNightScaffold(body: content) : content;
  }

  Widget _buildFeedbackContent(
    AppLocalizations l,
    Map<String, dynamic> fb,
    String? vapiCallId,
  ) {
    final overall = fb['overall_score'];
    final overallValue = overall is num ? overall.toDouble() : 0.0;

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        4,
        SeoulSizes.screenPadding,
        48,
      ),
      children: [
        // ── Overall + per-metric scores ─────────────────────────────────
        HeroCard(
          watermark: '면접',
          margin: const EdgeInsets.only(bottom: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ConicProgressRing(
                    value: overallValue / 10,
                    size: 104,
                    strokeWidth: 9,
                    // Number big, denominator small — a "7.5/10" on one line
                    // would not fit inside the ring.
                    label: '${overall ?? 0}',
                    caption: '/ 10',
                  ),
                  const SizedBox(width: 18),
                  Expanded(
                    child: HangulTag(
                      en: l.overallScoreLabel,
                      ko: '총점',
                      titleStyle: SeoulType.subtitle,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              _ScoreBar(
                label: l.metricCommunication,
                score: fb['communication_score'],
              ),
              _ScoreBar(
                label: l.metricConfidence,
                score: fb['confidence_score'],
              ),
              _ScoreBar(label: l.metricContent, score: fb['content_score']),
              _ScoreBar(
                label: l.metricLanguage,
                score: fb['language_score'],
                last: true,
              ),
            ],
          ),
        ),

        if (vapiCallId != null) _AudioPlayerWidget(callId: vapiCallId),

        // ── Long-form review ────────────────────────────────────────────
        GlassCard(
          margin: const EdgeInsets.only(bottom: 18),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HangulTag(
                en: l.detailedFeedbackTitle,
                ko: '상세 평가',
                titleStyle: SeoulType.subtitle,
              ),
              const SizedBox(height: 12),
              Text(
                fb['detailed_feedback'] ?? l.detailedFeedbackFallback,
                style: SeoulType.body,
              ),
            ],
          ),
        ),

        _buildListSection(
          l.strengthsLabel,
          '강점',
          StatusTone.lime,
          fb['strengths'] as List<dynamic>?,
          SeoulColors.lime,
        ),
        _buildListSection(
          l.areasToImproveLabel,
          '개선',
          StatusTone.warning,
          fb['improvements'] as List<dynamic>?,
          SeoulColors.warningText,
        ),

        // Answer-by-answer review. The feedback function has always produced
        // `message_scores` (a per-answer score with what went well, what to
        // fix, and a stronger sample answer) but nothing rendered it — so the
        // student was told their overall score without ever seeing WHERE they
        // went wrong. This section surfaces it.
        _buildPerAnswerSection(l, fb['message_scores']),

        const SizedBox(height: 12),
        // Audit U15: "Start another interview" preserves the in-memory
        // feedback (the prior implementation called resetSession which
        // wiped it). Routes back through the setup view by transitioning
        // status: 'completed' -> 'idle' via resetForNewSession.
        LimeButton(
          label: l.startAnotherInterview,
          icon: Icons.refresh,
          onPressed: () =>
              ref.read(interviewProvider.notifier).resetForNewSession(),
        ),
      ],
    );
  }

  /// Per-answer breakdown: for every answer the student gave, show its score,
  /// the answer itself (when the transcript is in memory), what worked, what
  /// to fix, and a stronger sample answer.
  Widget _buildPerAnswerSection(AppLocalizations l, dynamic rawScores) {
    if (rawScores is! List || rawScores.isEmpty) return const SizedBox.shrink();

    // Map message_id -> the student's actual words, so the review points at a
    // concrete answer instead of an opaque id. Empty for history replay,
    // where only the feedback row is loaded.
    final byId = <String, String>{
      for (final m in ref.read(interviewProvider).messages) m.id: m.content,
    };

    final entries = rawScores.whereType<Map>().toList();
    if (entries.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.fact_check,
              color: SeoulColors.lime,
              size: 18,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: HangulTag(
                en: l.perAnswerReviewTitle,
                ko: '답변별 분석',
                titleStyle: SeoulType.subtitle,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < entries.length; i++)
          _buildAnswerCard(l, entries[i], i + 1, byId),
      ],
    );
  }

  Widget _buildAnswerCard(
    AppLocalizations l,
    Map entry,
    int index,
    Map<String, String> byId,
  ) {
    final score = entry['score'];
    final answer = byId[entry['message_id']?.toString()];
    final strengths = (entry['strengths'] as List<dynamic>?) ?? const [];
    final suggestions = (entry['suggestions'] as List<dynamic>?) ?? const [];
    final idealHint = entry['ideal_hint']?.toString();

    final scoreValue = score is num ? score.toDouble() : null;
    // Seoul Night has no raw red: a weak answer reads as `warning`, a middling
    // one as `info`, a strong one as `lime`.
    final tone = scoreValue == null
        ? StatusTone.neutral
        : (scoreValue >= 8
              ? StatusTone.lime
              : (scoreValue >= 5 ? StatusTone.info : StatusTone.warning));

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      radius: SeoulRadii.tile,
      // Long list — skip the backdrop layer per card.
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '#$index',
                style: SeoulType.caption.copyWith(
                  color: SeoulColors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (scoreValue != null)
                StatusChip(
                  label: '${scoreValue.toStringAsFixed(0)}/10',
                  tone: tone,
                  dense: true,
                ),
            ],
          ),
          if (answer != null && answer.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              answer,
              style: SeoulType.bodySecondary.copyWith(
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          if (strengths.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...strengths.map(
              (s) => _bullet('✓', s.toString(), SeoulColors.lime),
            ),
          ],
          if (suggestions.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...suggestions.map(
              (s) => _bullet('!', s.toString(), SeoulColors.warningText),
            ),
          ],
          if (idealHint != null && idealHint.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            GlassCard(
              radius: SeoulRadii.control,
              padding: const EdgeInsets.all(12),
              fillColor: SeoulColors.limeFill,
              borderColor: SeoulColors.lime.withValues(alpha: 0.3),
              showShadow: false,
              blur: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.betterAnswerLabel,
                    style: SeoulType.eyebrow.copyWith(color: SeoulColors.lime),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    idealHint,
                    style: SeoulType.bodySecondary.copyWith(
                      color: SeoulColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _bullet(String marker, String text, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            marker,
            style: SeoulType.bodySecondary.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: SeoulType.bodySecondary)),
        ],
      ),
    );
  }

  Widget _buildListSection(
    String title,
    String ko,
    StatusTone tone,
    List<dynamic>? items,
    Color markerColor,
  ) {
    if (items == null || items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: StatusChip(label: title, tone: tone, ko: ko),
          ),
          const SizedBox(height: 10),
          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final e in items)
                  _bullet('•', e.toString(), markerColor),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// One sub-score: label, value, and a lime glow bar (spec §3.7).
class _ScoreBar extends StatelessWidget {
  const _ScoreBar({required this.label, required this.score, this.last = false});

  final String label;
  final dynamic score;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final value = score is num ? (score as num).toDouble() : 0.0;

    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.caption.copyWith(
                    color: SeoulColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${score ?? 0}/10',
                style: SeoulType.caption.copyWith(
                  color: SeoulColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          GlowProgressBar(value: value / 10),
        ],
      ),
    );
  }
}

class _AudioPlayerWidget extends ConsumerStatefulWidget {
  final String callId;
  const _AudioPlayerWidget({required this.callId});

  @override
  ConsumerState<_AudioPlayerWidget> createState() => _AudioPlayerWidgetState();
}

class _AudioPlayerWidgetState extends ConsumerState<_AudioPlayerWidget> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isPlaying = false;
  bool _isLoading = true;
  String? _recordingUrl;
  String? _error;

  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;

  @override
  void initState() {
    super.initState();
    _fetchAudioUrl();

    _audioPlayer.onPlayerStateChanged.listen((state) {
      if (mounted) setState(() => _isPlaying = state == PlayerState.playing);
    });

    _audioPlayer.onDurationChanged.listen((newDuration) {
      if (mounted) setState(() => _duration = newDuration);
    });

    _audioPlayer.onPositionChanged.listen((newPosition) {
      if (mounted) setState(() => _position = newPosition);
    });
  }

  Future<void> _fetchAudioUrl() async {
    final url = await ref
        .read(interviewProvider.notifier)
        .fetchRecordingUrl(widget.callId);
    if (!mounted) return;

    if (url != null) {
      setState(() {
        _recordingUrl = url;
        _isLoading = false;
      });
      await _audioPlayer.setSourceUrl(url);
    } else {
      setState(() {
        // Sentinel — translated at render time in build().
        _error = 'audio_recording_not_found';
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(d.inMinutes.remainder(60));
    final seconds = twoDigits(d.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    if (_error != null) {
      // _error is the 'audio_recording_not_found' sentinel set when
      // fetchRecordingUrl returned null. Translated at render time so
      // it follows the active locale.
      final errorText = _error == 'audio_recording_not_found'
          ? l.audioRecordingNotFound
          : _error!;
      return GlassCard(
        margin: const EdgeInsets.only(bottom: 18),
        padding: const EdgeInsets.all(14),
        fillColor: SeoulColors.warningFill,
        borderColor: SeoulColors.warning.withValues(alpha: 0.4),
        blur: false,
        child: Row(
          children: [
            const Icon(
              Icons.error_outline,
              size: 20,
              color: SeoulColors.warningText,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                errorText,
                style: SeoulType.bodySecondary.copyWith(
                  color: SeoulColors.warningText,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final canPlay = !_isLoading && _recordingUrl != null;
    final maxSeconds = _duration.inSeconds.toDouble() > 0
        ? _duration.inSeconds.toDouble()
        : 1.0;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.mic, color: SeoulColors.lime, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(l.sessionRecording, style: SeoulType.subtitle),
              ),
              const SizedBox(width: 8),
              Text('녹음', style: SeoulType.hangulLabel),
              if (_isLoading) ...[
                const SizedBox(width: 10),
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    color: SeoulColors.lime,
                    strokeWidth: 2,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // Audit P1: the play control needs a real, statically-sized
              // visual region so the tap target and the ink ripple agree.
              Semantics(
                button: true,
                label: _isPlaying
                    ? l.a11yTooltipPauseRecording
                    : l.a11yTooltipPlayRecording,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: canPlay
                      ? () {
                          if (_isPlaying) {
                            _audioPlayer.pause();
                          } else {
                            _audioPlayer.play(UrlSource(_recordingUrl!));
                          }
                        }
                      : null,
                  child: Container(
                    width: 56,
                    height: 56,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: canPlay
                          ? SeoulColors.limeFill
                          : SeoulColors.neutralFill,
                      border: Border.all(
                        color: canPlay
                            ? SeoulColors.lime.withValues(alpha: 0.4)
                            : SeoulColors.glassBorder,
                      ),
                      boxShadow: canPlay ? SeoulShadows.limeGlowSmall : null,
                    ),
                    child: Icon(
                      _isPlaying
                          ? Icons.pause
                          : Icons.play_arrow,
                      size: 28,
                      color: canPlay
                          ? SeoulColors.lime
                          : SeoulColors.textFaint,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  children: [
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 4,
                        thumbShape: const RoundSliderThumbShape(
                          enabledThumbRadius: 6,
                        ),
                        overlayShape: const RoundSliderOverlayShape(
                          overlayRadius: 14,
                        ),
                        activeTrackColor: SeoulColors.lime,
                        inactiveTrackColor: SeoulColors.neutralFill,
                        thumbColor: SeoulColors.lime,
                        overlayColor: SeoulColors.limeFill,
                      ),
                      child: Slider(
                        min: 0,
                        max: maxSeconds,
                        value: _position.inSeconds.toDouble().clamp(
                          0.0,
                          maxSeconds,
                        ),
                        onChanged: (value) {
                          if (_recordingUrl != null) {
                            _audioPlayer.seek(Duration(seconds: value.toInt()));
                          }
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _formatDuration(_position),
                            style: SeoulType.caption,
                          ),
                          Text(
                            _formatDuration(_duration),
                            style: SeoulType.caption,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
