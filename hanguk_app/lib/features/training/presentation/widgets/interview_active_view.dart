import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:vapi/vapi.dart';
import 'dart:async';
import '../../../../design_system/theme/app_colors.dart';
import '../../../../core/config/app_config.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/interview_repository.dart';
import '../../data/vapi_event_parser.dart' as vapi;

class InterviewActiveView extends ConsumerStatefulWidget {
  const InterviewActiveView({super.key});

  @override
  ConsumerState<InterviewActiveView> createState() =>
      _InterviewActiveViewState();
}

class _InterviewActiveViewState extends ConsumerState<InterviewActiveView>
    with WidgetsBindingObserver {
  VapiClient? _client;
  VapiCall? _call;
  StreamSubscription? _eventSub;

  // Only one live Vapi call may exist at a time. Starting a second interview
  // before the first tore down left two WebRTC calls running at once —
  // overlapping voices and, with the doubled audio/WebRTC load, app freezes.
  // This static handle lets a newly-started interview stop the previous one
  // before it connects.
  static _InterviewActiveViewState? _liveInstance;
  bool _isCallActive = false;
  bool _isAI_Speaking = false;
  bool _firstMessageReceived = false;
  String _currentWords = '';
  Timer? _silenceTimer;
  bool _showCoachingWarning = false;
  // _errorMessage holds a raw (likely English) detail string from the
  // Vapi SDK or a status-update payload. The locale-aware "Connection
  // interrupted: …" wrapper is applied in _buildStatusText below.
  String? _errorMessage;
  bool _isStopping = false;
  bool _aiRequestedEnd = false;
  bool _didEndSession = false;
  Timer? _forceEndTimer;
  Timer? _timeLimitTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initVapi();
  }

  // Audit U18: backgrounding the app mid-call should end the session
  // cleanly instead of leaving an orphan Vapi WebRTC connection and a
  // permanently-`active` DB row.
  //
  // Conservative choice: **end on background.** The alternative is
  // pause-and-resume — much more complex, Vapi-side fragile (mic
  // permission may revoke, peers may renegotiate), and a longer-lived
  // session means more cost. The audit's stated default is correct;
  // we revisit if users complain that backgrounding for a Slack
  // notification kills their practice.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      if (_isCallActive && !_didEndSession) {
        _didEndSession = true;
        unawaited(_completeAutoEnd());
      }
    }
  }

  Future<void> _initVapi() async {
    // Await Web SDK JS injection securely before instantiating to prevent silent crashes
    try {
      await VapiClient.platformInitialized.future;
    } catch (e) {
      debugPrint('Vapi Web SDK initialization failed: $e');
    }

    // AppConfig centralizes the Vapi key — no more hardcoded strings in widgets
    _client = VapiClient(AppConfig.vapiPublicKey);
    _startCall();
  }

  Future<void> _startCall() async {
    // Tear down any interview call still live from a previous screen so the
    // two don't talk over each other (and don't freeze the app under the
    // doubled WebRTC load).
    if (_liveInstance != null && !identical(_liveInstance, this)) {
      _liveInstance!._stopCall();
    }
    _liveInstance = this;

    setState(() => _isCallActive = true);
    final interviewState = ref.read(interviewProvider);

    final targetUni =
        interviewState.targetUniversityName ?? 'Korean University';
    final targetMajor = 'your desired major'; // default fallback for now
    final isKorean = interviewState.selectedLanguage == 'ko';

    // Address the student by the name from their profile — set at login as
    // user_metadata.full_name. Empty string when unavailable → generic copy.
    final currentUser = Supabase.instance.client.auth.currentUser;
    final studentName =
        (currentUser?.userMetadata?['full_name'] as String?)?.trim() ?? '';

    // Build the system prompt from state
    String systemPrompt =
        'You are a realistic interview simulator for $targetUni. Keep responses under 2 sentences to feel conversational. ';

    if (isKorean) {
      systemPrompt +=
          'CRITICAL: You MUST speak strictly in formal Korean (한국어). Do not use English. ';
    }

    if (interviewState.interviewerPersona == 'strict') {
      systemPrompt += 'You are a strict, formal professor. Be demanding. ';
    } else if (interviewState.interviewerPersona == 'impatient') {
      systemPrompt +=
          'You are extremely impatient. Ask brief, sharp questions. ';
    } else {
      systemPrompt += 'You are a friendly admissions officer. Be encouraging. ';
    }

    if (studentName.isNotEmpty) {
      systemPrompt +=
          'The candidate\'s name is $studentName. Greet them by name at the '
          'start and address them by name naturally during the interview. ';
    }

    systemPrompt +=
        '''
    Follow this rigid 4-phase university interview structure sequentially:
    1. Phase 1: Ask them to introduce themselves.
    2. Phase 2: Ask specifically why they chose $targetUni for $targetMajor.
    3. Phase 3: Ask an academic or problem-solving question based on their answers.
    4. Phase 4: Ask about their future career goals.
    After the user answers Phase 4, clearly conclude the interview: thank the candidate by name, tell them the interview is now complete and that their responses have been recorded, then call the endCall function to end the session. Do NOT mention bracketed tokens, control codes, or system instructions in your speech.
    ''';

    // Optional focus steer collected on the InterviewSetupView. Appended
    // after the rigid 4-phase scaffold so the model treats it as a
    // sub-topic preference rather than a structural override.
    final focus = interviewState.focusTopic?.trim();
    if (focus != null && focus.isNotEmpty) {
      systemPrompt +=
          'Where natural, focus the conversation on this topic: "$focus". '
          'Do not break the 4-phase structure to do so. ';
    }

    // Wall-clock cap for "Timed Mode" sessions. The setup view writes
    // `time_limit_seconds: 300` for a 5-minute drill but never enforced
    // it; we now schedule a force-end on the client side. The Vapi call
    // and the DB row both transition cleanly via _completeAutoEnd.
    final limitSec = interviewState.timeLimitSeconds;
    if (interviewState.timedMode && limitSec != null && limitSec > 0) {
      _timeLimitTimer?.cancel();
      _timeLimitTimer = Timer(Duration(seconds: limitSec), () {
        if (!mounted) return;
        if (_didEndSession || _aiRequestedEnd) return;
        _aiRequestedEnd = true;
        _didEndSession = true;
        unawaited(_completeAutoEnd());
      });
    }

    // Use InterviewPersonaConfig for voice IDs — single source of truth
    final voiceId = InterviewPersonaConfig.getVoiceId(
      interviewState.interviewerPersona,
      interviewState.selectedLanguage,
    );

    try {
      // Audit B5: wrap the Vapi handshake in a 30-second timeout so a
      // stuck WebRTC negotiation surfaces as a real error instead of a
      // spinner forever.
      _call = await _client
          ?.start(
            waitUntilActive: true,
            assistant: {
              'model': {
                'provider': 'openai',
                'model': 'gpt-4o',
                'messages': [
                  {'role': 'system', 'content': systemPrompt},
                ],
              },
              'voice': {
                'provider': '11labs',
                'voiceId': voiceId,
                // eleven_turbo_v2_5 has materially better Korean prosody than
                // eleven_multilingual_v2. The voice ID itself must also be a
                // Korean-native voice for full effect (see AppConfig.voiceIdKo*).
                'model': 'eleven_turbo_v2_5',
              },
              'endCallFunctionEnabled': true,
              'recordingEnabled': true,
              // Force the AI to speak first on connect rather than waiting for
              // user voice activity. Without this flag, Vapi treats the call as
              // user-initiated and the firstMessage is never delivered.
              'firstMessageMode': 'assistant-speaks-first',
              'firstMessage': isKorean
                  ? (studentName.isNotEmpty
                        ? '안녕하세요 $studentName님! $targetUni 면접을 시작하겠습니다. 준비되셨나요?'
                        : '안녕하세요! $targetUni 지원자님, 면접을 시작할 준비가 되셨나요?')
                  : (studentName.isNotEmpty
                        ? 'Hello $studentName! Are you ready to begin our interview for $targetUni?'
                        : 'Hello! Are you ready to begin our interview for $targetUni?'),
            },
          )
          .timeout(
            const Duration(seconds: 30),
            onTimeout: () => throw TimeoutException(
              'Vapi handshake timed out after 30 seconds.',
            ),
          );

      // Notify the global provider that Vapi is now live
      ref.read(interviewProvider.notifier).setVapiConnected(true);
      if (_call != null) {
        ref.read(interviewProvider.notifier).setVapiCallId(_call!.id);
      }
      debugPrint('[VAPI] Connected successfully.');

      _eventSub = _call?.onEvent.listen((event) {
        if (!mounted) return;

        final eventLabel = event.label;
        final eventValue = event.value;

        // Catch internal Vapi connection failures and surface them immediately
        if (eventLabel == 'call-end') {
          debugPrint('[VAPI] Call ended organically.');
        } else if (eventLabel == 'status-update' ||
            eventLabel == 'statusUpdate') {
          debugPrint('[VAPI STATUS UPDATE] $eventValue');
          final statusString = eventValue.toString().toLowerCase();

          if (statusString.contains('error')) {
            ref.read(interviewProvider.notifier).setVapiConnected(false);
            if (mounted) {
              // Audit U12: surface the actual error string from the
              // event payload instead of a misleading generic message.
              // Fall back to the generic copy only when nothing usable
              // is available.
              String? extractedDetail;
              if (eventValue is Map) {
                final m = eventValue;
                final v =
                    m['errorMsg'] ??
                    m['message'] ??
                    m['error'] ??
                    m['detail'] ??
                    m['status'];
                if (v != null) extractedDetail = v.toString();
              }
              extractedDetail ??= eventValue.toString();
              if (extractedDetail.length > 240) {
                extractedDetail = '${extractedDetail.substring(0, 240)}…';
              }
              setState(() {
                _isCallActive = false;
                _isAI_Speaking = false;
                // Store raw detail; _buildStatusText wraps it with
                // l.connectionInterrupted at render time so the wrapper
                // follows the active locale.
                _errorMessage = extractedDetail;
              });
            }
          }
        }

        if (eventLabel == 'message' && eventValue is Map) {
          final eventType = eventValue['type'];

          if (eventType == 'speech-start') {
            setState(() {
              _isAI_Speaking = true;
              _firstMessageReceived = true;
              _currentWords = '';
            });
          } else if (eventType == 'speech-end') {
            setState(() {
              _isAI_Speaking = false;
            });
            // If the AI has invoked endCall, wait until its closing remark
            // finishes speaking before tearing down. This is the auto-end
            // path — Task 3 of interview-training-fixes.plan.md.
            if (_aiRequestedEnd && !_didEndSession) {
              _didEndSession = true;
              _forceEndTimer?.cancel();
              unawaited(_completeAutoEnd());
            }
          } else if (eventType == 'tool-calls' ||
              eventType == 'function-call') {
            // Vapi emits 'tool-calls' (newer) or 'function-call' (older) when
            // the AI invokes a built-in tool. Listen for the endCall function.
            if (_isEndCallTool(eventValue) && !_aiRequestedEnd) {
              _aiRequestedEnd = true;
              // Fallback: if speech-end never fires (network glitch), force
              // teardown after 8 seconds so the user is not stuck.
              _forceEndTimer = Timer(const Duration(seconds: 8), () {
                if (_aiRequestedEnd && !_didEndSession && mounted) {
                  _didEndSession = true;
                  unawaited(_completeAutoEnd());
                }
              });
            }
          } else if (eventType == 'transcript') {
            final transcriptRole = eventValue['role']?.toString();
            final transcriptText = eventValue['transcript'] as String?;
            final isFinal = eventValue['transcriptType'] == 'final';
            if (transcriptText == null || transcriptText.isEmpty) {
              // skip empty events
            } else if (transcriptRole == 'user') {
              setState(() {
                _currentWords = transcriptText;
              });
              _checkCoachingWarnings(transcriptText);
              if (isFinal) {
                ref
                    .read(interviewProvider.notifier)
                    .logTranscript(transcriptText);
                _resetSilenceTimer();
              }
            } else if (transcriptRole == 'assistant' && isFinal) {
              // Persist the interviewer's spoken response too — without it
              // the `interview-feedback` Edge Function scores a one-sided
              // conversation. See audit F9.
              ref
                  .read(interviewProvider.notifier)
                  .logTranscriptWithRole(transcriptText, 'assistant');
            }
          }
        }
      });
    } catch (e, st) {
      debugPrint('Vapi Start Error Type: ${e.runtimeType}');
      debugPrint('Vapi Start Error: $e');
      debugPrint('Vapi StackTrace: $st');
      // Notify provider of failed connection so UI can react globally
      ref.read(interviewProvider.notifier).setVapiConnected(false);
      if (mounted) {
        setState(() {
          _isCallActive = false;
          // Expose explicit native parsing errors and connection timeouts dynamically to the UI!
          _errorMessage = e
              .toString()
              .replaceFirst('Exception: ', '')
              .replaceAll('VapiStartCallException: ', 'Vapi Engine Error: ');
        });
      }
    }
  }

  /// Centralized stop/cleanup for the Vapi call.
  /// Always call this instead of calling _call?.dispose() directly.
  void _stopCall() {
    if (_isStopping) return;
    _isStopping = true;

    _silenceTimer?.cancel();
    _forceEndTimer?.cancel();
    _timeLimitTimer?.cancel();
    _eventSub?.cancel();
    _call
        ?.stop(); // Explicit hang-up BEFORE dispose to prevent orphaned WebRTC connections
    _call?.dispose();
    _client?.dispose();
    // Sync disconnected state to global provider safely
    if (mounted) {
      ref.read(interviewProvider.notifier).setVapiConnected(false);
      setState(() {
        _isCallActive = false;
        _isAI_Speaking = false;
      });
    }

    if (identical(_liveInstance, this)) _liveInstance = null;
  }

  /// Detects whether a Vapi 'tool-calls' or 'function-call' event
  /// represents the built-in `endCall` function being invoked by the
  /// AI. Delegates to the pure-Dart `vapi.isEndCallTool` helper so the
  /// logic is unit-testable without a widget tree.
  bool _isEndCallTool(Map eventValue) => vapi.isEndCallTool(eventValue);

  /// Tear down the call and ask the provider to fetch feedback. Riverpod will
  /// flip state.status to 'completed', which causes InterviewScreen to swap
  /// the active view out for the post-session view.
  Future<void> _completeAutoEnd() async {
    final lang = ref.read(interviewProvider).selectedLanguage;
    _stopCall();
    if (!mounted) return;
    await ref.read(interviewProvider.notifier).endSession(language: lang);
  }

  void _resetSilenceTimer() {
    _silenceTimer?.cancel();
    _silenceTimer = Timer(const Duration(seconds: 8), () {
      if (_isCallActive && !_isAI_Speaking && mounted && !_isStopping) {
        ref
            .read(interviewProvider.notifier)
            .getHint(
              _currentWords.isEmpty
                  ? 'The student is stuck and said nothing.'
                  : _currentWords,
            );
      }
    });
  }

  // Word-boundary aware. Audit U13: prior version split on raw substrings
  // so 'um' matched inside 'umbrella'. RegExp(r'\bum\b') etc. is correct
  // for Latin script; Korean fillers don't have word boundaries the same
  // way so we keep the substring match for those (they're short particles
  // that rarely produce false positives in practice).
  static final RegExp _enFillers = RegExp(
    r'\b(?:um+|uh+|like|you know)\b',
    caseSensitive: false,
  );
  static const List<String> _koFillers = ['그냥', '음', '어'];

  void _checkCoachingWarnings(String text) {
    if (text.isEmpty) return;
    final lower = text.toLowerCase();
    final enHits = _enFillers.allMatches(lower).length;
    var koHits = 0;
    for (final filler in _koFillers) {
      koHits += lower.split(filler).length - 1;
    }
    final fillerCount = enHits + koHits;
    if (fillerCount >= 4) {
      setState(() {
        _showCoachingWarning = true;
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // Delegate to _stopCall for centralized cleanup — ensures stop() is
    // always called before dispose().
    _stopCall();
    // Audit F14: if the user backs out without ever triggering
    // _completeAutoEnd (no AI-end, no manual end button, no time-limit
    // expiry), mark the row as 'abandoned' so history-replay isn't
    // littered with permanently-active sessions.
    if (!_didEndSession) {
      final notifier = ref.read(interviewProvider.notifier);
      // Fire-and-forget — the network call shouldn't block widget teardown.
      unawaited(notifier.markAbandoned());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(interviewProvider);

    return Stack(
      children: [
        Column(
          children: [
            // University Indicator
            if (state.targetUniversityName != null)
              Container(
                margin: const EdgeInsets.only(top: 20),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.vibrantLime.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppColors.vibrantLime.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.school,
                      color: AppColors.vibrantLime,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        state.targetUniversityName!,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.vibrantLime,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (_showCoachingWarning)
              Container(
                margin: const EdgeInsets.only(top: 16),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.error),
                ),
                child: Text(
                  '⚠️ ${l.coachingFiller}',
                  style: const TextStyle(
                    color: AppColors.error,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            const Spacer(),
            // AI Avatar
            Container(
              height: 150,
              width: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.05),
                border: Border.all(
                  color: _isAI_Speaking
                      ? AppColors.vibrantLime
                      : Colors.white10,
                  width: _isAI_Speaking ? 4 : 1,
                ),
                boxShadow: _isAI_Speaking
                    ? [
                        BoxShadow(
                          color: AppColors.vibrantLime.withValues(alpha: 0.5),
                          blurRadius: 40,
                        ),
                      ]
                    : [],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(Icons.psychology, color: Colors.white54, size: 80),
                  Positioned(
                    bottom: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black45,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        state.selectedLanguage.toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _buildStatusText(l),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _errorMessage != null
                    ? AppColors.error
                    : (_isAI_Speaking
                          ? AppColors.error
                          : (_isCallActive
                                ? AppColors.vibrantLime
                                : Colors.white54)),
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const Spacer(),

            // Transcript & controls panel
            Flexible(
              child: Container(
                padding: const EdgeInsets.all(24),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(32),
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (state.liveHints.isNotEmpty && _isCallActive) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: AppColors.royalBlue.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.royalBlue.withValues(alpha: 0.5),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l.lifelineHintsTitle,
                              style: const TextStyle(
                                color: AppColors.royalBlue,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ...state.liveHints.map(
                              (h) => Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(
                                  '• $h',
                                  style: const TextStyle(color: Colors.white),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    // Audit U14: show a two-sided ledger of the last few
                    // turns instead of just the very last student utterance.
                    // While Vapi is mid-utterance, live partial transcript
                    // is also shown at the top.
                    Flexible(
                      child: SingleChildScrollView(
                        reverse: true,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (_isCallActive && _currentWords.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 6,
                                ),
                                child: Text(
                                  _currentWords,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    height: 1.5,
                                  ),
                                ),
                              ),
                            for (final m in _lastTurns(state.messages, 6))
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 4,
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    SizedBox(
                                      width: 64,
                                      child: Text(
                                        m.role == 'interviewer'
                                            ? l.speakerAi
                                            : l.speakerYou,
                                        textAlign: TextAlign.right,
                                        style: TextStyle(
                                          color: m.role == 'interviewer'
                                              ? AppColors.vibrantLime
                                              : Colors.white54,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        m.content,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 14,
                                          height: 1.45,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: () {
                        // Manual end — converge on the same _completeAutoEnd
                        // path the AI-driven end uses, so feedback is
                        // generated and the row transitions to 'completed'.
                        // Previously this just called _stopCall + pop, which
                        // left status='active' forever and skipped feedback.
                        if (_didEndSession) return;
                        _didEndSession = true;
                        unawaited(_completeAutoEnd());
                      },
                      child: Container(
                        height: 64,
                        width: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white10,
                          border: Border.all(color: Colors.white30),
                        ),
                        child: const Icon(
                          Icons.close,
                          color: Colors.white,
                          size: 32,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l.endInterview,
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ],
        ),
        if (state.isProcessing || state.isLoading)
          const Center(
            child: CircularProgressIndicator(color: AppColors.vibrantLime),
          ),
      ],
    );
  }

  /// Returns the most-recent [maxTurns] interview messages in
  /// chronological order, after stripping the synthetic
  /// "[Interview started …]" sentinel a previous version of
  /// `sendMessage` used to emit.
  List<InterviewMessage> _lastTurns(
    List<InterviewMessage> messages,
    int maxTurns,
  ) {
    final cleaned = messages
        .where((m) => !m.content.contains('[Interview started'))
        .toList(growable: false);
    if (cleaned.length <= maxTurns) return cleaned;
    return cleaned.sublist(cleaned.length - maxTurns);
  }

  String _buildStatusText(AppLocalizations l) {
    if (_errorMessage != null) return l.connectionInterrupted(_errorMessage!);
    if (_aiRequestedEnd) return l.wrappingUp;
    if (_isAI_Speaking) return l.aiSpeaking;
    if (_isCallActive && !_firstMessageReceived) {
      return l.greetWait;
    }
    if (_isCallActive) return l.yourTurn;
    return l.connecting;
  }
}
