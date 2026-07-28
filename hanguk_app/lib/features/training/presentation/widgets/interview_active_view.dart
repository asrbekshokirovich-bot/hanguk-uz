import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:vapi/vapi.dart';
import 'dart:async';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../core/config/app_config.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/interview_repository.dart';
import '../../data/vapi_event_parser.dart' as vapi;

class InterviewActiveView extends ConsumerStatefulWidget {
  const InterviewActiveView({super.key});

  /// End the live call from outside this widget — currently the header
  /// control in [InterviewScreen].
  ///
  /// There must be exactly one end path. Calling `endSession()` directly
  /// runs the feedback analysis first, and only its completion swaps the view
  /// and disposes this widget, so the microphone stays open for the whole
  /// analysis window. Routing through here hangs up first, then analyses.
  static void endActiveCall() => _InterviewActiveViewState._endLiveCall();

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

  /// The single manual-end path, shared by the body button and the header
  /// control. Latches so a double tap cannot start two teardowns.
  static void _endLiveCall() {
    final live = _liveInstance;
    if (live == null || !live.mounted) return;
    live._endFromUser();
  }

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
  Timer? _greetTimer;

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
      // Only auto-end once the interview has actually started. During the
      // handshake the OS mic-permission dialog (or a notification shade)
      // can drive the activity to `paused` on some OEMs — auto-ending there
      // consumed the one-shot _didEndSession latch mid-connect and left the
      // screen stuck with a dead End button.
      if (_isCallActive && _firstMessageReceived && !_didEndSession) {
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
    // doubled WebRTC load). Guarded: a poisoned previous instance must never
    // abort THIS start.
    if (_liveInstance != null && !identical(_liveInstance, this)) {
      try {
        _liveInstance!._stopCall();
      } catch (e) {
        debugPrint('[VAPI] Previous-instance teardown failed: $e');
      }
    }
    // `_initVapi` awaited platform init to get here; on web that genuinely
    // takes time, so a fast back-tap can land first. Registering a dead
    // instance as the live one would leave the next interview trying to stop
    // a disposed widget.
    if (!mounted) return;
    _liveInstance = this;

    setState(() => _isCallActive = true);

    // Connect watchdog, armed BEFORE anything that can hang or throw: if the
    // interviewer hasn't spoken within 25s of entering this screen — the
    // handshake stalled, the assistant pipeline died silently ("dead air"),
    // or a pre-connect exception was swallowed — stop waiting forever and
    // surface a retryable error. Cancelled by the first speech-start event.
    _greetTimer?.cancel();
    _greetTimer = Timer(const Duration(seconds: 25), () {
      if (!mounted || _firstMessageReceived || _errorMessage != null) return;
      setState(() {
        _isCallActive = false;
        _errorMessage =
            'The interviewer did not respond. Please go back and try again.';
      });
      // Kill whatever half-open call/mic is lingering.
      try {
        _stopCall();
      } catch (_) {}
    });

    final interviewState = ref.read(interviewProvider);

    final targetUni =
        interviewState.targetUniversityName ?? 'Korean University';
    final targetMajor = 'your desired major'; // default fallback for now
    final isKorean = interviewState.selectedLanguage == 'ko';

    // Address the student by the name from their profile — set at login as
    // user_metadata.full_name. Type-checked (not cast): a non-String value
    // here used to throw before the try block and silently kill the whole
    // start sequence.
    final currentUser = Supabase.instance.client.auth.currentUser;
    final rawName = currentUser?.userMetadata?['full_name'];
    final studentName = rawName is String ? rawName.trim() : '';

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

    Future<VapiCall>? startFuture;
    try {
      // Audit B5: wrap the Vapi handshake in a 30-second timeout so a
      // stuck WebRTC negotiation surfaces as a real error instead of a
      // spinner forever. The raw future is kept so a join that completes
      // AFTER we gave up is torn down instead of lingering as a ghost call
      // with a live microphone.
      startFuture = _client?.start(
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
          // Speech-to-text for the STUDENT's side. Without this Vapi
          // falls back to its English default, so a Korean-language
          // interview transcribed the candidate's Korean answers as
          // garbled English: the interviewer "didn't understand" anything
          // the student said, and the saved transcript (which the
          // feedback is scored from) was nonsense.
          'transcriber': {
            'provider': 'deepgram',
            'model': 'nova-2',
            'language': isKorean ? 'ko' : 'en',
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
      );
      final connected = await startFuture?.timeout(
        const Duration(seconds: 30),
        onTimeout: () => throw TimeoutException(
          'Vapi handshake timed out after 30 seconds.',
        ),
      );

      // The handshake can finish AFTER we already gave up on it: the 25s
      // watchdog fired, the user tapped End, or the screen was disposed —
      // all while the join was still in flight. Wiring this call up now
      // would leave a live WebRTC call with an open microphone that no
      // later _stopCall() can reach (teardown is already latched). Tear the
      // late arrival down instead.
      if (connected != null &&
          (_isStopping ||
              _didEndSession ||
              !mounted ||
              _errorMessage != null)) {
        debugPrint('[VAPI] Handshake completed after teardown — disposing.');
        _disposeCallSafely(connected);
        return;
      }
      _call = connected;

      // Notify the global provider that Vapi is now live
      ref.read(interviewProvider.notifier).setVapiConnected(true);
      if (_call != null) {
        ref.read(interviewProvider.notifier).setVapiCallId(_call!.id);
      }
      debugPrint('[VAPI] Connected successfully.');
      // (Connect watchdog was armed at the top of _startCall — it stays
      // armed until the first speech-start event cancels it.)

      _eventSub = _call?.onEvent.listen((event) {
        if (!mounted) return;

        final eventLabel = event.label;
        final eventValue = event.value;

        // The vendored Vapi SDK emits speech/call lifecycle as TOP-LEVEL
        // labels ('speech-start', 'speech-end', 'call-start', 'call-end') —
        // NOT nested inside 'message' payloads. The app previously matched
        // only the nested variants, which never fire, so the status text
        // could never leave "…will greet you shortly" even when the AI was
        // audibly speaking (root cause of the stuck-greetWait bug).
        if (eventLabel == 'speech-start') {
          _greetTimer?.cancel();
          setState(() {
            _isAI_Speaking = true;
            _firstMessageReceived = true;
            _currentWords = '';
          });
          return;
        }
        if (eventLabel == 'speech-end') {
          setState(() {
            _isAI_Speaking = false;
          });
          // If the AI has invoked endCall, wait until its closing remark
          // finishes speaking before tearing down (auto-end path).
          if (_aiRequestedEnd && !_didEndSession) {
            _didEndSession = true;
            _forceEndTimer?.cancel();
            unawaited(_completeAutoEnd());
          }
          return;
        }

        // Catch internal Vapi connection failures and surface them immediately
        if (eventLabel == 'call-end') {
          debugPrint('[VAPI] Call ended.');
          if (_didEndSession) {
            // Already tearing down (manual End, AI endCall, time limit).
          } else if (!_firstMessageReceived) {
            // The call died before the interviewer ever spoke (assistant
            // pipeline failure, rejected config, TTS dead-air, network) —
            // surface it instead of leaving "will greet you shortly" forever.
            if (_errorMessage == null) {
              _greetTimer?.cancel();
              ref.read(interviewProvider.notifier).setVapiConnected(false);
              setState(() {
                _isCallActive = false;
                _errorMessage =
                    'The call ended before the interviewer could speak. '
                    'Please try again.';
              });
            }
          } else {
            // The call dropped mid-interview (network loss, server hang-up).
            // There is a transcript, so finish the session properly rather
            // than leaving the screen on "Your turn" with a dead call.
            _didEndSession = true;
            _forceEndTimer?.cancel();
            unawaited(_completeAutoEnd());
          }
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
            _greetTimer?.cancel();
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
      // Ghost-call cleanup: our .timeout only abandons the await — the SDK
      // keeps joining in the background. If that late join eventually
      // succeeds, stop and dispose the resulting call so no orphaned WebRTC
      // call keeps the microphone open (the historical "two overlapping
      // voices" bug).
      final sf = startFuture;
      if (sf != null) {
        unawaited(
          sf.then((lateCall) {
            if (identical(lateCall, _call)) return;
            _disposeCallSafely(lateCall);
          }, onError: (_) {}),
        );
      }
      // Notify provider of failed connection so UI can react globally
      ref.read(interviewProvider.notifier).setVapiConnected(false);
      // Don't overwrite a message the connect watchdog already surfaced.
      if (mounted && _errorMessage == null) {
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
  ///
  /// Every teardown step is individually guarded: `stop()` returns a failed
  /// Future (VapiCallEndedException) when the call already ended, and
  /// `dispose()` can throw on a half-initialized CallClient. An unguarded
  /// throw here used to abort the whole end-flow before the UI sync ran,
  /// leaving the screen stuck with a dead End button.
  void _stopCall() {
    if (_isStopping) return;
    _isStopping = true;

    _silenceTimer?.cancel();
    _forceEndTimer?.cancel();
    _timeLimitTimer?.cancel();
    _greetTimer?.cancel();

    // Sync UI/provider state FIRST so no SDK-teardown failure can prevent it.
    if (mounted) {
      ref.read(interviewProvider.notifier).setVapiConnected(false);
      setState(() {
        _isCallActive = false;
        _isAI_Speaking = false;
      });
    }

    try {
      _eventSub?.cancel();
    } catch (_) {}

    final call = _call;
    if (call != null) _disposeCallSafely(call);
    try {
      _client?.dispose();
    } catch (_) {}

    if (identical(_liveInstance, this)) _liveInstance = null;
  }

  /// Hang up and release a Vapi call without ever throwing.
  ///
  /// `stop()` returns a failed Future (VapiCallEndedException) when the call
  /// has already ended, and `dispose()` can throw on a half-initialized
  /// CallClient — so both are guarded, and dispose runs only after stop()
  /// settles (disposing while `leave()` is in flight is unsafe).
  void _disposeCallSafely(VapiCall call) {
    try {
      unawaited(
        call.stop().catchError((_) {}).whenComplete(() {
          try {
            call.dispose();
          } catch (_) {}
        }),
      );
    } catch (_) {
      try {
        call.dispose();
      } catch (_) {}
    }
  }

  /// Detects whether a Vapi 'tool-calls' or 'function-call' event
  /// represents the built-in `endCall` function being invoked by the
  /// AI. Delegates to the pure-Dart `vapi.isEndCallTool` helper so the
  /// logic is unit-testable without a widget tree.
  bool _isEndCallTool(Map eventValue) => vapi.isEndCallTool(eventValue);

  /// Tear down the call and ask the provider to fetch feedback. Riverpod will
  /// flip state.status to 'completed', which causes InterviewScreen to swap
  /// the active view out for the post-session view.
  ///
  /// Guaranteed-exit contract: every step is guarded and, whatever happens,
  /// the provider is left in a state that unmounts this screen — the End
  /// button must NEVER be a no-op.
  Future<void> _completeAutoEnd() async {
    // Capture provider handles up-front: the notifier outlives this widget,
    // so the flow keeps working even if the view unmounts mid-way.
    final notifier = ref.read(interviewProvider.notifier);
    final lang = ref.read(interviewProvider).selectedLanguage;
    try {
      _stopCall();
    } catch (e) {
      debugPrint('[Interview] _stopCall failed during end: $e');
    }
    try {
      await notifier.endSession(language: lang);
    } catch (e) {
      debugPrint('[Interview] endSession failed: $e');
    }
    // Last-resort escape hatch: if the session is somehow still 'active'
    // (or parked on 'abandoned'), force it to idle so the screen exits.
    notifier.forceIdleIfActive();

    // The analysis failed (network, or the model couldn't produce a real
    // evaluation). Say so — dropping the student back on the setup screen
    // with no explanation reads like the End button ate their session.
    if (!mounted) return;
    final s = ref.read(interviewProvider);
    if (s.error == 'feedback_failed' && s.feedback == null) {
      final l = AppLocalizations.of(context);
      if (l != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              l.noFeedbackAvailable,
              style: SeoulType.body.copyWith(color: SeoulColors.ink),
            ),
            backgroundColor: SeoulColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  /// Manual end. Converges on the same `_completeAutoEnd` path the AI-driven
  /// end uses, so the call is torn down first and the row still transitions to
  /// 'completed' with feedback.
  void _endFromUser() {
    if (_didEndSession) return;
    _didEndSession = true;
    unawaited(_completeAutoEnd());
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

    // Seoul Night §3.7 — a dark, calm, focused screen: one breathing orb for
    // the interviewer's voice, the status line on glass, and an End control
    // that is ALWAYS on screen (connecting or mid-interview). Deliberately no
    // running transcript: this is a spoken interview and the text only
    // competed with the End control for space. Speech is still transcribed
    // and stored — it appears in the post-session feedback and in history.
    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            SeoulSizes.screenPadding,
            4,
            SeoulSizes.screenPadding,
            20,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Everything above the End control scrolls.
              //
              // It used to be one Column with two Spacers absorbing the
              // slack. That works at the default font size, but a fixed
              // 208px orb plus a long error status plus the coaching
              // banner overflows a 360x640 screen at Android's 200% font
              // setting — and because the End control is the last child,
              // the entire overflow lands on it: laid out below the screen
              // edge, invisible and untappable, with no way to scroll to
              // it. That is precisely the moment a student most needs to
              // stop the interview. The control is now pinned outside the
              // scrollable region, so it cannot be pushed anywhere.
              Expanded(
                child: LayoutBuilder(
                  builder: (context, viewport) => SingleChildScrollView(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: viewport.maxHeight,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (state.targetUniversityName != null)
                            Center(
                              child: _TargetUniPill(
                                name: state.targetUniversityName!,
                              ),
                            ),
                          if (_showCoachingWarning) ...[
                            const SizedBox(height: 12),
                            _CoachingWarning(text: l.coachingFiller),
                          ],

                          Center(
                            child: _VoiceOrb(
                              speaking: _isAI_Speaking,
                              connected: _isCallActive,
                              languageTag: state.selectedLanguage.toUpperCase(),
                            ),
                          ),
                          const SizedBox(height: 22),

                          GlassCard(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 14,
                            ),
                            child: Text(
                              _buildStatusText(l),
                              textAlign: TextAlign.center,
                              // Warning tint means a real failure only. "The interviewer
                              // is speaking" is a perfectly normal state, so it reads as
                              // plain white; lime = your turn; faint = not connected yet.
                              style: SeoulType.subtitle.copyWith(
                                color: _statusColor(),
                              ),
                            ),
                          ),

                          if (state.liveHints.isNotEmpty && _isCallActive)
                            // Inside the outer scroll view now, so it takes its
                            // natural height instead of competing with Spacers for
                            // the slack — and no longer needs a scroller of its own.
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: GlassCard(
                                radius: SeoulRadii.control,
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      l.lifelineHintsTitle,
                                      style: SeoulType.subtitle.copyWith(
                                        fontSize: 14,
                                        color: SeoulColors.lime,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    ...state.liveHints.map(
                                      (h) => Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: 4,
                                        ),
                                        child: Row(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '•',
                                              style: SeoulType.bodySecondary
                                                  .copyWith(
                                                    color: SeoulColors.lime,
                                                  ),
                                            ),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                h,
                                                style: SeoulType.bodySecondary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),
              // End control — pinned, rendered unconditionally, never
              // behind a state check: reachable while connecting AND
              // mid-interview.
              _EndInterviewButton(label: l.endInterview, onTap: _endFromUser),
            ],
          ),
        ),
        if (state.isProcessing || state.isLoading)
          const Center(
            child: CircularProgressIndicator(color: SeoulColors.lime),
          ),
      ],
    );
  }

  /// Colour of the status line. Purely presentational — it reads the same
  /// flags the status string itself is built from.
  Color _statusColor() {
    if (_errorMessage != null) return SeoulColors.dangerText;
    if (_isAI_Speaking) return SeoulColors.textPrimary;
    if (_isCallActive) return SeoulColors.lime;
    return SeoulColors.textSecondary;
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

/// The interviewer's voice as one calm object (spec §3.7): a 한 mark on glass,
/// a lime rim and glow while the AI speaks, dimmer while it listens, and the
/// slow 2.6s breathing ring from spec §1 Motion.
class _VoiceOrb extends StatefulWidget {
  const _VoiceOrb({
    required this.speaking,
    required this.connected,
    required this.languageTag,
  });

  final bool speaking;
  final bool connected;
  final String languageTag;

  @override
  State<_VoiceOrb> createState() => _VoiceOrbState();
}

class _VoiceOrbState extends State<_VoiceOrb>
    with SingleTickerProviderStateMixin {
  static const double _ringSize = 208;
  static const double _coreSize = 152;

  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: SeoulMotion.pulse,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, _) {
        final t = SeoulMotion.smooth.transform(_pulse.value);
        final speaking = widget.speaking;
        final double ringScale = 1.0 + (speaking ? 0.09 : 0.035) * t;
        final double ringAlpha = speaking ? 0.16 + 0.34 * (1.0 - t) : 0.10;

        return SizedBox(
          width: _ringSize,
          height: _ringSize,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Transform.scale(
                scale: ringScale,
                child: Container(
                  width: _ringSize,
                  height: _ringSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: SeoulColors.lime.withValues(alpha: ringAlpha),
                      width: 2,
                    ),
                  ),
                ),
              ),
              AnimatedContainer(
                duration: SeoulMotion.base,
                curve: SeoulMotion.smooth,
                width: _coreSize,
                height: _coreSize,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: SeoulColors.glass,
                  border: Border.all(
                    color: speaking
                        ? SeoulColors.lime
                        : SeoulColors.glassBorder,
                    width: speaking ? 3 : 1,
                  ),
                  boxShadow: speaking
                      ? SeoulShadows.limeGlow
                      : (widget.connected ? SeoulShadows.limeGlowSmall : null),
                ),
                child: Text(
                  '한',
                  style: SeoulType.hangulGlyph.copyWith(
                    fontSize: 58,
                    fontWeight: FontWeight.w900,
                    color: speaking
                        ? SeoulColors.lime
                        : SeoulColors.textSecondary,
                  ),
                ),
              ),
              Positioned(
                bottom: 20,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: SeoulColors.neutralFill,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: SeoulColors.glassBorder),
                  ),
                  child: Text(
                    widget.languageTag,
                    style: SeoulType.eyebrow.copyWith(
                      color: SeoulColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Lime-tinted pill naming the university this session is aimed at.
class _TargetUniPill extends StatelessWidget {
  const _TargetUniPill({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: SeoulColors.limeFill,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: SeoulColors.lime.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.school, color: SeoulColors.lime, size: 16),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              name,
              overflow: TextOverflow.ellipsis,
              style: SeoulType.caption.copyWith(
                color: SeoulColors.lime,
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "You are using too many filler words" nudge. Warning-tinted, not red —
/// Uses the `danger*` family — desaturated for the navy surface, not a raw red.
class _CoachingWarning extends StatelessWidget {
  const _CoachingWarning({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      radius: SeoulRadii.control,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      fillColor: SeoulColors.dangerFill,
      borderColor: SeoulColors.danger.withValues(alpha: 0.45),
      showShadow: false,
      blur: false,
      child: Row(
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            size: 18,
            color: SeoulColors.dangerText,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: SeoulType.bodySecondary.copyWith(
                color: SeoulColors.dangerText,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The always-visible End control. Destructive but legible: a warning-tinted
/// outline, full width, 52px tall (well over the 44px minimum, spec §4).
class _EndInterviewButton extends StatefulWidget {
  const _EndInterviewButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  State<_EndInterviewButton> createState() => _EndInterviewButtonState();
}

class _EndInterviewButtonState extends State<_EndInterviewButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedScale(
          scale: _pressed ? SeoulMotion.pressScale : 1.0,
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          child: Container(
            height: SeoulSizes.buttonHeight,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            decoration: BoxDecoration(
              color: SeoulColors.warningFill,
              borderRadius: SeoulRadii.controlR,
              border: Border.all(
                color: SeoulColors.warning.withValues(alpha: 0.55),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.call_end,
                  size: 18,
                  color: SeoulColors.warningText,
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    widget.label,
                    overflow: TextOverflow.ellipsis,
                    style: SeoulType.button.copyWith(
                      color: SeoulColors.warningText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
