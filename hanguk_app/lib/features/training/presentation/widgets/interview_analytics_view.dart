import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/interview_repository.dart';
import '../../../../design_system/theme/app_colors.dart';
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

    return Container(
      color: AppColors.backgroundNavy,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                children: [
                  if (widget.onBackPressed != null)
                    IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      tooltip: l.a11yTooltipBack,
                      onPressed: widget.onBackPressed,
                    ),
                  Text(
                    l.interviewAnalyticsTitle,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Content
              Expanded(
                child: state.isLoading
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const CircularProgressIndicator(
                              color: AppColors.vibrantLime,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              l.analyzingTranscript,
                              style: const TextStyle(color: Colors.white70),
                            ),
                          ],
                        ),
                      )
                    : state.feedback == null
                    ? Center(
                        child: Text(
                          state.error ?? l.noFeedbackAvailable,
                          style: const TextStyle(color: Colors.redAccent),
                          textAlign: TextAlign.center,
                        ),
                      )
                    : _buildFeedbackContent(
                        l,
                        state.feedback!,
                        widget.overrideVapiCallId ?? state.vapiCallId,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeedbackContent(
    AppLocalizations l,
    Map<String, dynamic> fb,
    String? vapiCallId,
  ) {
    return ListView(
      physics: const BouncingScrollPhysics(),
      children: [
        // Overall Score Card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.surfaceGlass.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderGlass, width: 1),
          ),
          child: Column(
            children: [
              Text(
                l.overallScoreLabel,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${fb['overall_score'] ?? 0}/10',
                style: const TextStyle(
                  color: AppColors.vibrantLime,
                  fontSize: 48,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _Metric(l.metricCommunication, fb['communication_score']),
                  _Metric(l.metricConfidence, fb['confidence_score']),
                  _Metric(l.metricContent, fb['content_score']),
                  _Metric(l.metricLanguage, fb['language_score']),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        if (vapiCallId != null) _AudioPlayerWidget(callId: vapiCallId),

        // Strengths & Improvements
        Text(
          l.detailedFeedbackTitle,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          fb['detailed_feedback'] ?? l.detailedFeedbackFallback,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.9),
            fontSize: 15,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 24),

        _buildListSection(
          l.strengthsLabel,
          fb['strengths'] as List<dynamic>?,
          Icons.thumb_up,
          Colors.greenAccent,
        ),
        const SizedBox(height: 24),
        _buildListSection(
          l.areasToImproveLabel,
          fb['improvements'] as List<dynamic>?,
          Icons.build,
          Colors.orangeAccent,
        ),

        // Answer-by-answer review. The feedback function has always produced
        // `message_scores` (a per-answer score with what went well, what to
        // fix, and a stronger sample answer) but nothing rendered it — so the
        // student was told their overall score without ever seeing WHERE they
        // went wrong. This section surfaces it.
        _buildPerAnswerSection(l, fb['message_scores']),

        const SizedBox(height: 32),
        // Audit U15: "Start another interview" preserves the in-memory
        // feedback (the prior implementation called resetSession which
        // wiped it). Routes back through the setup view by transitioning
        // status: 'completed' -> 'idle' via resetForNewSession.
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.vibrantLime,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(30),
            ),
          ),
          icon: const Icon(Icons.refresh),
          label: Text(
            l.startAnotherInterview,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          ),
          onPressed: () =>
              ref.read(interviewProvider.notifier).resetForNewSession(),
        ),

        const SizedBox(height: 48),
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
        const SizedBox(height: 24),
        Row(
          children: [
            const Icon(Icons.fact_check, color: AppColors.vibrantLime, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                l.perAnswerReviewTitle,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
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
    final scoreColor = scoreValue == null
        ? Colors.white54
        : (scoreValue >= 8
              ? Colors.greenAccent
              : (scoreValue >= 5 ? Colors.orangeAccent : Colors.redAccent));

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '#$index',
                style: const TextStyle(
                  color: Colors.white54,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              if (scoreValue != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: scoreColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${scoreValue.toStringAsFixed(0)}/10',
                    style: TextStyle(
                      color: scoreColor,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          if (answer != null && answer.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              answer,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                fontStyle: FontStyle.italic,
                height: 1.4,
              ),
            ),
          ],
          if (strengths.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...strengths.map(
              (s) => _bullet('✓', s.toString(), Colors.greenAccent),
            ),
          ],
          if (suggestions.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...suggestions.map(
              (s) => _bullet('!', s.toString(), Colors.orangeAccent),
            ),
          ],
          if (idealHint != null && idealHint.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.vibrantLime.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.vibrantLime.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.betterAnswerLabel,
                    style: const TextStyle(
                      color: AppColors.vibrantLime,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    idealHint,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      height: 1.4,
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
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildListSection(
    String title,
    List<dynamic>? items,
    IconData icon,
    Color color,
  ) {
    if (items == null || items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...items
            .map(
              (e) => Padding(
                padding: const EdgeInsets.only(bottom: 8.0, left: 28.0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '• ',
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        e.toString(),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final dynamic score;
  const _Metric(this.label, this.score);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$score/10',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.5),
            fontSize: 11,
          ),
        ),
      ],
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
      return Container(
        margin: const EdgeInsets.only(bottom: 24),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.error),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                errorText,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.8),
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceGlass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderGlass),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.mic, color: AppColors.vibrantLime, size: 20),
              const SizedBox(width: 8),
              Text(
                l.sessionRecording,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (_isLoading) ...[
                const Spacer(),
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    color: AppColors.vibrantLime,
                    strokeWidth: 2,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // Audit P1: previously `padding: EdgeInsets.zero` with a
              // 48dp icon left the button visually unbounded — the tap
              // target met the minimum, but there was no hit-state
              // padding or static visual region. Wrap in a vibrantLime-
              // tinted circular surface and give IconButton real padding
              // so the Material ink ripple has somewhere to land.
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.vibrantLime.withValues(alpha: 0.08),
                ),
                child: IconButton(
                  icon: Icon(
                    _isPlaying
                        ? Icons.pause_circle_filled
                        : Icons.play_circle_fill,
                    color: _isLoading || _recordingUrl == null
                        ? Colors.white24
                        : AppColors.vibrantLime,
                  ),
                  iconSize: 48,
                  tooltip: _isPlaying
                      ? l.a11yTooltipPauseRecording
                      : l.a11yTooltipPlayRecording,
                  padding: const EdgeInsets.all(8),
                  onPressed: _isLoading || _recordingUrl == null
                      ? null
                      : () {
                          if (_isPlaying) {
                            _audioPlayer.pause();
                          } else {
                            _audioPlayer.play(UrlSource(_recordingUrl!));
                          }
                        },
                ),
              ),
              const SizedBox(width: 8),
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
                        activeTrackColor: AppColors.vibrantLime,
                        inactiveTrackColor: Colors.white24,
                        thumbColor: AppColors.vibrantLime,
                      ),
                      child: Slider(
                        min: 0,
                        max: _duration.inSeconds.toDouble() > 0
                            ? _duration.inSeconds.toDouble()
                            : 1.0,
                        value: _position.inSeconds.toDouble().clamp(
                          0.0,
                          _duration.inSeconds.toDouble() > 0
                              ? _duration.inSeconds.toDouble()
                              : 1.0,
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
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.5),
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            _formatDuration(_duration),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.5),
                              fontSize: 12,
                            ),
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
