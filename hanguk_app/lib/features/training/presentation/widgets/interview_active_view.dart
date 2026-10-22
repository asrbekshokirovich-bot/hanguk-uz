import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:vapi/vapi.dart';
import 'dart:async';
import 'dart:math' as math;
import '../../../../core/analytics/app_events.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/platform/screen_awake.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/interview_repository.dart';
import '../../data/vapi_event_parser.dart' as vapi;

class InterviewActiveView extends ConsumerStatefulWidget {
  const InterviewActiveView({super.key});

  /// End the live call from outside this widget. (The screen's own End
  /// control, the X in its header, now lives inside this widget.)
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

  // Read once in initState: `ref` cannot be used inside dispose(), and the
  // teardown there still has to reach the provider.
  late final InterviewNotifier _notifier;
  bool _disposing = false;

  // Screen 20's presentation state: the running clock, the microphone and
  // the interviewer's latest line. None of it steers the call.
  Timer? _clock;
  int _seconds = 0;
  bool _muted = false;
  String _lastQuestion = '';

  @override
  void initState() {
    super.initState();
    _notifier = ref.read(interviewProvider.notifier);
    WidgetsBinding.instance.addObserver(this);
    // An interview is minutes of the student talking, not touching the phone.
    // On the normal idle timer the screen dims and locks part-way through:
    // the End control goes with it, and on Android the resulting pause is
    // what this screen treats as "end the session". Hold the screen on for
    // as long as this view is alive — released in dispose(), which is the one
    // exit every path goes through.
    unawaited(ScreenAwake.enable());
    AppEvents.track('interview_start', props: {'language': ref.read(interviewProvider).selectedLanguage});
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
        _errorMessage = AppLocalizations.of(context)!.interviewErrorNoGreeting;
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

    final questionLimit = interviewState.questionLimit;
    if (questionLimit != null) {
      // The university's interview test: exactly N questions, then the end.
      // The free-practice 4-phase script below used to override "ask 3
      // questions", and the test ran to 7 questions inside its 3 minutes.
      systemPrompt +=
          '''
    This is a short admission interview test. Ask EXACTLY $questionLimit questions, one at a time, and wait for each answer:
    1. Why did you choose $targetUni and your major?
    2. What and how will you study in Korea?
    3. What will you do after graduating?
    Your opening message has already asked question 1, so wait for that answer first.
    Do not ask follow-up or extra questions, and do not ask whether the candidate is ready. Keep each of your turns to one or two short sentences.
    After the answer to question $questionLimit, thank the candidate, say the interview is complete and their responses have been recorded, then call the endCall function to end the session. Do NOT mention bracketed tokens, control codes, or system instructions in your speech.
    ''';
    } else {
      systemPrompt +=
          '''
    Follow this rigid 4-phase university interview structure sequentially:
    1. Phase 1: Ask them to introduce themselves.
    2. Phase 2: Ask specifically why they chose $targetUni for $targetMajor.
    3. Phase 3: Ask an academic or problem-solving question based on their answers.
    4. Phase 4: Ask about their future career goals.
    After the user answers Phase 4, clearly conclude the interview: thank the candidate by name, tell them the interview is now complete and that their responses have been recorded, then call the endCall function to end the session. Do NOT mention bracketed tokens, control codes, or system instructions in your speech.
    ''';
    }

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
          // The test opens straight on its first question: "are you ready?"
          // cost a turn of its three minutes.
          'firstMessage': questionLimit != null
              ? (isKorean
                    ? '안녕하세요${studentName.isNotEmpty ? ' $studentName님' : ''}! $targetUni 면접을 시작하겠습니다. 첫 번째 질문입니다. 왜 이 대학교와 이 전공을 선택하셨나요?'
                    : 'Hello${studentName.isNotEmpty ? ' $studentName' : ''}! Let\'s begin your interview for $targetUni. First question: why did you choose $targetUni and your major?')
              : isKorean
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
            _startClock();
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
                _errorMessage = AppLocalizations.of(
                  context,
                )!.interviewErrorEndedBeforeGreeting;
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
                // The raw detail is technical English; it goes to the log,
                // and the screen says it in the app's language.
                debugPrint('[VAPI ERROR] $extractedDetail');
                _errorMessage = AppLocalizations.of(
                  context,
                )!.interviewErrorCallFailed;
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
              _startClock();
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
              setState(() => _lastQuestion = transcriptText);
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
      _notifier.setVapiConnected(false);
      // Don't overwrite a message the connect watchdog already surfaced.
      if (mounted && _errorMessage == null) {
        setState(() {
          _isCallActive = false;
          // The exception text is technical English: log it, and say it in
          // the app's language on screen.
          debugPrint('[VAPI START ERROR] $e');
          _errorMessage = AppLocalizations.of(context)!.interviewErrorCallFailed;
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
    _clock?.cancel();

    // Sync UI/provider state FIRST so no SDK-teardown failure can prevent it.
    // From dispose() neither `ref` nor setState may be used (either throws
    // and aborts the rest of this teardown, leaving the call and microphone
    // live), so the provider is told right after the current frame instead.
    if (_disposing) {
      final notifier = _notifier;
      unawaited(Future.microtask(() => notifier.setVapiConnected(false)));
    } else if (mounted) {
      _notifier.setVapiConnected(false);
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
    AppEvents.track('interview_end', props: {'seconds': _seconds, 'by_ai': _aiRequestedEnd});
    // Capture provider handles up-front: the notifier outlives this widget,
    // so the flow keeps working even if the view unmounts mid-way.
    final notifier = ref.read(interviewProvider.notifier);
    // The result is written in the app's language, not the interview's: a
    // Korean interview used to come back with its feedback in Korean.
    final lang = Localizations.maybeLocaleOf(context)?.languageCode ?? 'uz';
    // Taken now: when scoring fails the session goes back to idle, which
    // unmounts this view before the message below could be shown.
    final messenger = ScaffoldMessenger.maybeOf(context);
    final l = AppLocalizations.of(context);
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
    if (notifier.endFailed) {
      if (l != null && messenger != null) {
        messenger.showSnackBar(
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
    setState(() => _didEndSession = true);
    unawaited(_completeAutoEnd());
  }

  /// Starts the header clock on the interviewer's first words.
  void _startClock() {
    if (_clock != null) return;
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _seconds++);
    });
  }

  /// The big microphone button: mutes or unmutes the student's side of the
  /// live call.
  void _toggleMute() {
    final call = _call;
    if (call == null || !_isCallActive || _isStopping) return;
    try {
      call.setMuted(!_muted);
      setState(() => _muted = !_muted);
    } catch (e) {
      debugPrint('[VAPI] setMuted failed: $e');
    }
  }

  void _resetSilenceTimer() {
    _silenceTimer?.cancel();
    _silenceTimer = Timer(const Duration(seconds: 8), () {
      if (_isCallActive && !_isAI_Speaking && !_muted && mounted && !_isStopping) {
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
    _disposing = true;
    WidgetsBinding.instance.removeObserver(this);
    // Give the screen back to the normal idle timer. This runs on every way
    // out of the interview — finished, ended early, errored, or backed out of
    // — so the hold can't outlive the view and sit there draining the battery.
    unawaited(ScreenAwake.disable());
    // Delegate to _stopCall for centralized cleanup — ensures stop() is
    // always called before dispose().
    _stopCall();
    // Audit F14: if the user backs out without ever triggering
    // _completeAutoEnd (no AI-end, no manual end button, no time-limit
    // expiry), mark the row as 'abandoned' so history-replay isn't
    // littered with permanently-active sessions.
    if (!_didEndSession) {
      AppEvents.track('interview_leave', props: {'seconds': _seconds});
      final notifier = _notifier;
      // Fire-and-forget — the network call shouldn't block widget teardown.
      // After this frame: a provider must not change while the tree is
      // being finalized.
      unawaited(Future.microtask(notifier.markAbandoned));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(interviewProvider);
    final uni = state.targetUniversityName;
    final question = _errorMessage == null && _lastQuestion.isNotEmpty ? _lastQuestion : null;

    // Design screen 20, "Suhbat mashqi — Hanguk AI", on the light page. The
    // X in the header is the End control: pinned outside the scrolling part,
    // so no font size or banner can push it off screen, and it goes through
    // the one end path ([_endFromUser]). Speech is transcribed and stored as
    // before; the card shows only the interviewer's latest line.
    return Stack(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
              child: Row(
                children: [
                  HardIconButton(glyph: LucideIcons.x, semanticLabel: l.endInterview, onTap: _endFromUser),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l.fdInterviewTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(18, FontWeight.w800, FdColors.ink, letterSpacing: -0.36),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _Clock(seconds: _seconds, live: _isCallActive && _firstMessageReceived),
                ],
              ),
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, viewport) => SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: viewport.maxHeight),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 24),
                        Center(child: _Avatar(speaking: _isAI_Speaking)),
                        const SizedBox(height: 10),
                        Text(
                          l.fdInterviewAi,
                          textAlign: TextAlign.center,
                          style: fdText(14, FontWeight.w800, FdColors.ink),
                        ),
                        if (uni != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            l.fdInterviewStyle(uni),
                            textAlign: TextAlign.center,
                            style: fdText(11, FontWeight.w400, FdColors.muted),
                          ),
                        ],
                        const SizedBox(height: 18),
                        HardShadowBox(
                          fill: FdColors.card,
                          radius: 18,
                          offset: 4,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _muted ? l.fdInterviewMuted : _buildStatusText(l),
                                  style: fdText(11, FontWeight.w700, _statusColor()),
                                ),
                                if (question != null) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    question,
                                    style: fdText(19, FontWeight.w800, FdColors.ink, height: 1.2, letterSpacing: -0.38),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        if (_showCoachingWarning) ...[
                          const SizedBox(height: 12),
                          _Note(text: l.coachingFiller, fill: const Color(0xFFFFF7E6)),
                        ],
                        if (state.liveHints.isNotEmpty && _isCallActive) ...[
                          const SizedBox(height: 12),
                          _Note(title: l.lifelineHintsTitle, lines: state.liveHints, fill: FdColors.card),
                        ],
                        const SizedBox(height: 18),
                        _Wave(active: _isAI_Speaking),
                        const SizedBox(height: 18),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Center(
              child: _MicButton(
                muted: _muted,
                enabled: _isCallActive && _call != null,
                label: _muted ? l.fdInterviewUnmute : l.fdInterviewMute,
                onTap: _toggleMute,
              ),
            ),
            // A labelled End button under the mic (owner, 2026-10-22: the X
            // alone was not seen as "yakunlash"). Same single end path; while
            // the answers are being scored it says so.
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
              child: HardButton(
                label: state.isLoading ? l.sptChecking : l.endInterview,
                loading: state.isLoading,
                onPressed: _didEndSession ? null : _endFromUser,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 10, 24, 16),
              child: Text(
                l.fdInterviewTip,
                textAlign: TextAlign.center,
                style: fdText(11, FontWeight.w700, FdColors.muted),
              ),
            ),
          ],
        ),
        if (state.isProcessing || state.isLoading)
          const Center(child: CircularProgressIndicator(color: FdColors.navy)),
      ],
    );
  }

  /// Colour of the status line. Purely presentational — it reads the same
  /// flags the status string itself is built from.
  Color _statusColor() {
    if (_errorMessage != null) return FdColors.bad;
    if (_muted) return FdColors.warn;
    if (_isAI_Speaking) return FdColors.muted;
    if (_isCallActive && _firstMessageReceived) return FdColors.good;
    return FdColors.muted;
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

/// The `mm:ss` pill with the red dot.
class _Clock extends StatelessWidget {
  const _Clock({required this.seconds, required this.live});

  final int seconds;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final mm = (seconds ~/ 60).toString().padLeft(2, '0');
    final ss = (seconds % 60).toString().padLeft(2, '0');
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(shape: BoxShape.circle, color: live ? FdColors.bad : FdColors.ghost),
          ),
          const SizedBox(width: 6),
          Text(
            '$mm:$ss',
            style: const TextStyle(
              fontFamily: SeoulType.mono,
              // The bundled mono face is a subset without ':'.
              fontFamilyFallback: [SeoulType.inter],
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: FdColors.ink,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// The interviewer: a navy disc in a lime ring with the "AI" badge; the ring
/// breathes while the interviewer speaks.
class _Avatar extends StatefulWidget {
  const _Avatar({required this.speaking});

  final bool speaking;

  @override
  State<_Avatar> createState() => _AvatarState();
}

class _AvatarState extends State<_Avatar> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: SeoulMotion.pulse)
    ..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: 132,
      child: AnimatedBuilder(
        animation: _pulse,
        builder: (context, child) {
          final t = widget.speaking ? SeoulMotion.smooth.transform(_pulse.value) : 0.0;
          return Transform.scale(scale: 1 + 0.04 * t, child: child);
        },
        child: Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 116,
              height: 116,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [FdColors.navy, FdColors.deep],
                ),
                border: Border.fromBorderSide(BorderSide(color: FdColors.ink, width: 1.5)),
                boxShadow: [
                  BoxShadow(color: FdColors.ink, spreadRadius: 7.5),
                  BoxShadow(color: FdColors.lime, spreadRadius: 6),
                ],
              ),
              child: const Lucide(LucideIcons.userRound, size: 52, color: Colors.white),
            ),
            Positioned(
              right: 4,
              bottom: 10,
              child: Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: FdColors.lime,
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Text('AI', style: fdText(11, FontWeight.w800, FdColors.onLime)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The 28-bar waveform: moving while the interviewer speaks, flat otherwise.
class _Wave extends StatefulWidget {
  const _Wave({required this.active});

  final bool active;

  @override
  State<_Wave> createState() => _WaveState();
}

class _WaveState extends State<_Wave> with SingleTickerProviderStateMixin {
  static const int _bars = 28;
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void initState() {
    super.initState();
    if (widget.active) _c.repeat();
  }

  @override
  void didUpdateWidget(_Wave old) {
    super.didUpdateWidget(old);
    if (widget.active && !_c.isAnimating) _c.repeat();
    if (!widget.active && _c.isAnimating) _c.stop();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) => Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < _bars; i++) ...[
              if (i > 0) const SizedBox(width: 3),
              Container(
                width: 5,
                height: widget.active ? 8 + 34 * (0.5 + 0.5 * math.sin(_c.value * 2 * math.pi + i * 0.7)).abs() : 6,
                decoration: BoxDecoration(
                  color: widget.active ? FdColors.lime : FdColors.ghost,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The big lime microphone: on, or crossed out while muted.
class _MicButton extends StatelessWidget {
  const _MicButton({required this.muted, required this.enabled, required this.label, required this.onTap});

  final bool muted;
  final bool enabled;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      toggled: muted,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: Opacity(
          opacity: enabled ? 1 : 0.5,
          child: Container(
            width: 76,
            height: 76,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: muted ? FdColors.card : FdColors.lime,
              border: Border.all(color: FdColors.ink, width: 1.5),
              boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
            ),
            child: Lucide(muted ? LucideIcons.micOff : LucideIcons.mic, size: 32, color: FdColors.onLime),
          ),
        ),
      ),
    );
  }
}

/// A small card under the question: the filler-word nudge, or the live hints.
class _Note extends StatelessWidget {
  const _Note({required this.fill, this.title, this.text, this.lines = const []});

  final Color fill;
  final String? title;
  final String? text;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    final body = fdText(12, FontWeight.w400, FdColors.ink, height: 1.45);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) Text(title!, style: fdText(12, FontWeight.w800, FdColors.ink)),
          if (text != null) Text(text!, style: body),
          for (final h in lines)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: body),
                  Expanded(child: Text(h, style: body)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
