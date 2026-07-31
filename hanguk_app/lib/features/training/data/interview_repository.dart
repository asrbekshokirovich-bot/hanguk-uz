import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import '../../../core/config/app_config.dart';

// ---------------------------------------------------------------------------
// Persona / Voice configuration — single source of truth for both Vapi and TTS
// ---------------------------------------------------------------------------
class InterviewPersonaConfig {
  static String getVoiceId(String persona, String language) {
    final isKo = language == 'ko';
    if (persona == 'strict') {
      return isKo ? AppConfig.voiceIdKoStrict : AppConfig.voiceIdEnStrict;
    } else if (persona == 'impatient') {
      return isKo ? AppConfig.voiceIdKoImpatient : AppConfig.voiceIdEnImpatient;
    }
    return isKo ? AppConfig.voiceIdKoFriendly : AppConfig.voiceIdEnFriendly;
  }
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
class InterviewMessage {
  final String id;
  final String role; // 'interviewer' | 'student'
  final String content;
  final String createdAt;

  const InterviewMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
  });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
class InterviewSessionState {
  final String? sessionId;
  final String sessionType;
  final String status;
  final List<InterviewMessage> messages;
  final Map<String, dynamic>? feedback;
  final String? targetUniversityId;
  final String? targetUniversityName;
  final String selectedLanguage;
  final bool isLoading;
  final bool isProcessing;
  final String interviewerPersona;
  final List<String> liveHints;
  final String? error;
  final bool isVapiConnected; // true when WebRTC call is live
  final String?
  vapiCallId; // Stores the underlying session ID for audio recordings
  final String? focusTopic; // Optional free-text steer for the AI's questions
  final bool timedMode;
  final int? timeLimitSeconds; // Hard cap; null = untimed

  const InterviewSessionState({
    this.sessionId,
    this.sessionType = 'general',
    this.status = 'idle',
    this.messages = const [],
    this.feedback,
    this.targetUniversityId,
    this.targetUniversityName,
    this.selectedLanguage = 'ko',
    this.isLoading = false,
    this.isProcessing = false,
    this.interviewerPersona = 'friendly',
    this.liveHints = const [],
    this.error,
    this.isVapiConnected = false,
    this.vapiCallId,
    this.focusTopic,
    this.timedMode = false,
    this.timeLimitSeconds,
  });

  InterviewSessionState copyWith({
    String? sessionId,
    String? sessionType,
    String? status,
    List<InterviewMessage>? messages,
    Map<String, dynamic>? feedback,
    String? targetUniversityId,
    String? targetUniversityName,
    String? selectedLanguage,
    bool? isLoading,
    bool? isProcessing,
    String? interviewerPersona,
    List<String>? liveHints,
    String? error,
    bool clearError = false,
    bool? isVapiConnected,
    String? vapiCallId,
    String? focusTopic,
    bool? timedMode,
    int? timeLimitSeconds,
  }) {
    return InterviewSessionState(
      sessionId: sessionId ?? this.sessionId,
      sessionType: sessionType ?? this.sessionType,
      status: status ?? this.status,
      messages: messages ?? this.messages,
      feedback: feedback ?? this.feedback,
      targetUniversityId: targetUniversityId ?? this.targetUniversityId,
      targetUniversityName: targetUniversityName ?? this.targetUniversityName,
      selectedLanguage: selectedLanguage ?? this.selectedLanguage,
      isLoading: isLoading ?? this.isLoading,
      isProcessing: isProcessing ?? this.isProcessing,
      interviewerPersona: interviewerPersona ?? this.interviewerPersona,
      liveHints: liveHints ?? this.liveHints,
      error: clearError ? null : (error ?? this.error),
      isVapiConnected: isVapiConnected ?? this.isVapiConnected,
      vapiCallId: vapiCallId ?? this.vapiCallId,
      focusTopic: focusTopic ?? this.focusTopic,
      timedMode: timedMode ?? this.timedMode,
      timeLimitSeconds: timeLimitSeconds ?? this.timeLimitSeconds,
    );
  }
}

// ---------------------------------------------------------------------------
// Notifier
// ---------------------------------------------------------------------------
class InterviewNotifier extends Notifier<InterviewSessionState> {
  // Audit D8: track every TTS temp file we write so the next session
  // boundary (or `cleanupTtsFiles()` call) can delete them. Without
  // tracking, repeated sessions accumulated `tts_<epoch>.mp3` files
  // forever in the temp dir.
  final List<String> _ttsFilePaths = [];

  /// True once this notifier has been torn down. `_awaitSavedFeedback` can
  /// still be sleeping between polls at that point; writing to `state`
  /// afterwards throws, so it checks this before every write.
  bool _disposed = false;

  @override
  InterviewSessionState build() {
    _disposed = false;
    ref.onDispose(() => _disposed = true);
    return const InterviewSessionState();
  }

  /// Delete any temp TTS files written during the current/previous
  /// session. Safe to call eagerly — missing files are ignored.
  Future<void> cleanupTtsFiles() async {
    final paths = List<String>.from(_ttsFilePaths);
    _ttsFilePaths.clear();
    for (final p in paths) {
      try {
        final f = File(p);
        if (await f.exists()) {
          await f.delete();
        }
      } on FileSystemException catch (e) {
        debugPrint('TTS cleanup failed for $p: $e');
      }
    }
  }

  // ── Session lifecycle ────────────────────────────────────────────────────

  /// Clears any prior error message in state. Used by the interview-setup
  /// dialog so a stale error doesn't render on a re-open (audit U17).
  void clearError() {
    if (state.error != null) {
      state = state.copyWith(clearError: true);
    }
  }

  /// Mark the current session row as `abandoned` and clear in-memory
  /// state. Used when the user backs out of the interview screen
  /// without ever pressing End — previously the row stayed `status =
  /// 'active'` forever and history-replay couldn't tell what happened
  /// (audit F14). The status string follows the existing `'completed'` /
  /// `'rejected'` pattern in the table; no enum migration needed.
  Future<void> markAbandoned() async {
    final sessionId = state.sessionId;
    if (sessionId == null) return;
    if (state.status != 'active') return;
    try {
      await Supabase.instance.client
          .from('interview_sessions')
          .update({'status': 'abandoned'})
          .eq('id', sessionId);
    } on Exception catch (e) {
      debugPrint('Failed to mark session abandoned: $e');
    }
    state = state.copyWith(status: 'abandoned', isVapiConnected: false);
  }

  Future<void> startSession({
    String sessionType = 'general',
    String? targetUniversityId,
    String? targetUniversityName,
    String language = 'ko',
    String? focusTopic,
    String persona = 'friendly',
    bool timedMode = false,
    int? timeLimitSeconds,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final client = Supabase.instance.client;
      final user = client.auth.currentUser;
      if (user == null) throw Exception('User not authenticated');

      // Create Session in DB
      final response = await client
          .from('interview_sessions')
          .insert({
            'student_id': user.id,
            'session_type': sessionType,
            'target_institution_id': targetUniversityId,
            'status': 'active',
            'focus_topic': focusTopic,
            'timed_mode': timedMode,
            'time_limit_seconds': timeLimitSeconds,
          })
          .select()
          .single();

      final newSessionId = response['id'] as String;

      state = state.copyWith(
        sessionId: newSessionId,
        sessionType: sessionType,
        status: 'active',
        messages: [],
        feedback: null,
        targetUniversityId: targetUniversityId,
        targetUniversityName: targetUniversityName,
        selectedLanguage: language,
        interviewerPersona: persona,
        liveHints: [],
        focusTopic: focusTopic,
        timedMode: timedMode,
        timeLimitSeconds: timeLimitSeconds,
        // NOTE: We do NOT call sendMessage here anymore.
        // Vapi handles the greeting via its own firstMessage field.
        // Calling sendMessage here caused a duplicate greeting race condition.
      );
    } on Exception catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to start interview: ${e.toString()}',
      );
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  // ── Vapi connection state sync ───────────────────────────────────────────

  /// Called by InterviewActiveView to sync the WebRTC call state into the
  /// global provider so other widgets can react to connection status.
  void setVapiConnected(bool value) {
    state = state.copyWith(isVapiConnected: value);
  }

  void setVapiCallId(String callId) {
    state = state.copyWith(vapiCallId: callId);
    // Persist the call id so history/analytics can replay the recording later.
    final sessionId = state.sessionId;
    if (sessionId != null) {
      unawaited(_persistVapiCallId(sessionId, callId));
    }
  }

  Future<void> _persistVapiCallId(String sessionId, String callId) async {
    // Audit D6: failures here meant the row had vapi_call_id=NULL and
    // history-replay later showed "Audio recording not found". We now
    // retry up to 3 times with exponential backoff, then surface a
    // non-blocking error so the UI can show "audio unavailable" later.
    const delays = [
      Duration(seconds: 1),
      Duration(seconds: 4),
      Duration(seconds: 12),
    ];
    Object? lastError;
    for (var attempt = 0; attempt < delays.length; attempt++) {
      try {
        await Supabase.instance.client
            .from('interview_sessions')
            .update({'vapi_call_id': callId})
            .eq('id', sessionId);
        return;
      } on Exception catch (e) {
        lastError = e;
        debugPrint(
          'Failed to persist vapi_call_id (attempt ${attempt + 1}/${delays.length}): $e',
        );
        if (attempt < delays.length - 1) {
          await Future<void>.delayed(delays[attempt]);
        }
      }
    }
    state = state.copyWith(
      error:
          'Could not save audio link for this session ($lastError). '
          'Replay may be unavailable.',
    );
  }

  // ── Text-only interview: full AI round-trip ──────────────────────────────

  Future<String?> sendMessage(
    String studentText, {
    String language = 'ko',
  }) async {
    final sessionId = state.sessionId;
    if (sessionId == null) {
      state = state.copyWith(error: 'No active session');
      return null;
    }

    state = state.copyWith(isProcessing: true, clearError: true);

    // Audit D7: previously a temp student message was added with id
    // `'temp-…'` and never removed if the AI call failed — the user
    // saw their utterance but no response. We now track the temp id
    // so the catch block can roll it back.
    String? tempId;

    try {
      // Add temporary student message
      if (!studentText.contains('[Interview started')) {
        tempId = 'temp-${DateTime.now().millisecondsSinceEpoch}';
        final newStudentMsg = InterviewMessage(
          id: tempId,
          role: 'student',
          content: studentText,
          createdAt: DateTime.now().toIso8601String(),
        );
        state = state.copyWith(messages: [...state.messages, newStudentMsg]);
      }

      final client = Supabase.instance.client;

      // Call interview-ai edge function for text-based response
      final response = await client.functions.invoke(
        'interview-ai',
        body: {
          'sessionId': sessionId,
          'studentMessage': studentText,
          'sessionType': state.sessionType,
          'language': state.selectedLanguage,
          'persona': state.interviewerPersona,
        },
      );

      final data = response.data as Map<String, dynamic>?;
      if (data == null || data['error'] != null) {
        throw Exception(data?['error'] ?? 'Empty response from AI Interviewer');
      }

      final aiText = data['response'] as String? ?? 'No response generated.';

      final aiMsg = InterviewMessage(
        id: 'interviewer-${DateTime.now().millisecondsSinceEpoch}',
        role: 'interviewer',
        content: aiText,
        createdAt: DateTime.now().toIso8601String(),
      );

      state = state.copyWith(messages: [...state.messages, aiMsg]);
      return aiText;
    } on FunctionException catch (e) {
      final errDetail = (e.details is Map)
          ? (e.details as Map)['error']
          : e.details;
      _rollbackTempMessage(tempId);
      state = state.copyWith(
        error: 'AI Interview error: ${errDetail ?? e.toString()}',
      );
      return null;
    } on Exception catch (e) {
      _rollbackTempMessage(tempId);
      state = state.copyWith(
        error: 'Failed to process answer: ${e.toString()}',
      );
      return null;
    } finally {
      state = state.copyWith(isProcessing: false);
    }
  }

  void _rollbackTempMessage(String? tempId) {
    if (tempId == null) return;
    final remaining = state.messages
        .where((m) => m.id != tempId)
        .toList(growable: false);
    if (remaining.length != state.messages.length) {
      state = state.copyWith(messages: remaining);
    }
  }

  // ── Vapi mode: transcript logging only (NO AI call) ─────────────────────

  /// Used during a live Vapi WebRTC session to persist the student's
  /// transcript to the DB without triggering a redundant Gemini AI response.
  /// The voice AI (GPT-4o via Vapi) already handles the conversation.
  Future<void> logTranscript(String studentText) =>
      logTranscriptWithRole(studentText, 'student');

  /// Persist a transcript line for either side of the conversation. Adding
  /// AI-side transcripts (role = 'interviewer') closes a regression where
  /// `interview-feedback` was scoring a one-sided dialogue — see audit F9.
  Future<void> logTranscriptWithRole(String text, String role) async {
    final sessionId = state.sessionId;
    if (sessionId == null) return;
    if (text.isEmpty) return;

    final dbRole = role == 'assistant' ? 'interviewer' : role;

    try {
      final client = Supabase.instance.client;
      await client.from('interview_messages').insert({
        'session_id': sessionId,
        'role': dbRole,
        'content': text,
      });

      final newMsg = InterviewMessage(
        id: 'vapi-$dbRole-${DateTime.now().millisecondsSinceEpoch}',
        role: dbRole,
        content: text,
        createdAt: DateTime.now().toIso8601String(),
      );
      state = state.copyWith(messages: [...state.messages, newMsg]);
    } on Exception catch (e) {
      // Non-critical — don't surface to user, just log.
      debugPrint('Failed to log Vapi transcript ($dbRole): $e');
    }
  }

  // ── End session & feedback ───────────────────────────────────────────────

  /// Reentrancy latch for endSession. Previously the guard piggybacked on
  /// `state.isLoading`, but ANY stray isLoading=true (e.g. a hung network
  /// call that never reached its finally) then turned endSession into a
  /// permanent no-op — the user could never leave the interview screen.
  bool _ending = false;

  /// Last-resort escape hatch for the interview view: whatever went wrong,
  /// return the UI to the setup screen (unless the session finished
  /// normally and is showing feedback).
  void forceIdleIfActive() {
    // Never yank the screen out from under an end-flow that is still
    // running (e.g. the AppBar End is generating feedback) — that would
    // flash the setup view and then bounce to analytics.
    if (_ending) return;
    if (state.status == 'active' || state.status == 'abandoned') {
      state = state.copyWith(
        status: 'idle',
        isLoading: false,
        isProcessing: false,
        isVapiConnected: false,
        clearError: true,
      );
    }
  }

  Future<Map<String, dynamic>?> endSession({String language = 'ko'}) async {
    final sessionId = state.sessionId;
    if (sessionId == null) {
      // Nothing to end — but never leave the screen trapped on 'active'.
      forceIdleIfActive();
      return null;
    }
    // Audit D10: guard against double-fire. Tapping "End Session" twice
    // (or the AppBar end + the auto-end timer triggering simultaneously)
    // would otherwise hit `interview-feedback` twice and produce
    // duplicate feedback rows.
    if (_ending || state.status == 'completed') return state.feedback;
    _ending = true;
    try {
      return await _endSessionInner(sessionId, language);
    } finally {
      _ending = false;
    }
  }

  Future<Map<String, dynamic>?> _endSessionInner(
    String sessionId,
    String language,
  ) async {
    // If the interview never produced a real exchange (still connecting, or
    // the student ended right away), there is nothing to analyze. Abandon the
    // session and drop back to the setup screen instead of calling the
    // feedback function — which errors/hangs on an empty transcript and would
    // otherwise leave the student stuck on the "Connecting…" screen with a
    // dead End button. This makes the End control work at the very start of a
    // session, not only mid-conversation.
    final hasTranscript = state.messages.any(
      (m) => !m.content.contains('[Interview started'),
    );
    if (!hasTranscript) {
      // Return to the setup screen instantly so the End button feels
      // responsive even on a slow network; mark the row abandoned in the
      // background (inline, so its write can't fight the 'idle' reset).
      final abandonedId = sessionId;
      state = state.copyWith(
        status: 'idle',
        isVapiConnected: false,
        isLoading: false,
      );
      unawaited(
        Supabase.instance.client
            .from('interview_sessions')
            .update({'status': 'abandoned'})
            .eq('id', abandonedId)
            .then((_) {}, onError: (_) {}),
      );
      return null;
    }

    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final client = Supabase.instance.client;

      // Timed: a hung feedback call must never trap the user on the
      // interview screen (the catch below guarantees an exit).
      //
      // 90s, not 25: the function makes a second model call whenever the
      // first reply doesn't parse, and production logs show those runs
      // finishing at ~40s with a 200. At 25s the app was hanging up on a
      // request that was about to succeed, so the student saw "couldn't
      // analyse" for an interview that had in fact been scored and saved.
      final response = await client.functions
          .invoke(
            'interview-feedback',
            body: {'sessionId': sessionId, 'language': language},
          )
          .timeout(const Duration(seconds: 90));

      final data = response.data as Map<String, dynamic>?;
      if (data == null || data['error'] != null) {
        throw Exception(data?['error'] ?? 'Failed to get feedback');
      }

      // Audit F15: the `interview-feedback` Edge Function persists into
      // public.interview_feedback (UNIQUE on session_id). We defensively
      // verify the row landed; if it didn't, insert it ourselves so
      // history-replay always has feedback to show.
      final fbRaw = data['feedback'];
      if (fbRaw is! Map) {
        throw Exception('Unexpected feedback shape from server');
      }
      final fb = Map<String, dynamic>.from(fbRaw);

      try {
        // Timed: these run AFTER the feedback is already in hand, so a hang
        // here must never delay the transition to 'completed' (it would
        // strand the user on the interview screen with a spinner).
        final row = await client
            .from('interview_feedback')
            .select('session_id')
            .eq('session_id', sessionId)
            .maybeSingle()
            .timeout(const Duration(seconds: 10));
        if (row == null) {
          await client
              .from('interview_feedback')
              .insert({
                'session_id': sessionId,
                if (fb['overall_score'] is num)
                  'overall_score': (fb['overall_score'] as num).round().clamp(
                    1,
                    10,
                  ),
                if (fb['communication_score'] is num)
                  'communication_score': (fb['communication_score'] as num)
                      .round()
                      .clamp(1, 10),
                if (fb['confidence_score'] is num)
                  'confidence_score': (fb['confidence_score'] as num)
                      .round()
                      .clamp(1, 10),
                if (fb['content_score'] is num)
                  'content_score': (fb['content_score'] as num).round().clamp(
                    1,
                    10,
                  ),
                if (fb['language_score'] is num)
                  'language_score': (fb['language_score'] as num).round().clamp(
                    1,
                    10,
                  ),
                if (fb['strengths'] is List) 'strengths': fb['strengths'],
                if (fb['improvements'] is List)
                  'improvements': fb['improvements'],
                if (fb['message_scores'] is List)
                  'message_scores': fb['message_scores'],
                if (fb['detailed_feedback'] is String)
                  'detailed_feedback': fb['detailed_feedback'],
              })
              .timeout(const Duration(seconds: 10));
        }
      } on Exception catch (e) {
        // Non-fatal — the in-memory feedback is still available.
        debugPrint('Defensive interview_feedback insert failed: $e');
      }

      state = state.copyWith(
        status: 'completed',
        feedback: fb,
        isVapiConnected: false, // Vapi call is over at this point
      );

      return fb;
    } on Exception catch (e) {
      debugPrint('endSession: feedback call failed: $e');

      // A failed call does NOT mean the interview went unscored.
      //
      // The Edge Function does the analysis and writes the row into
      // public.interview_feedback regardless of whether we are still on the
      // line — it keeps running server-side until it finishes (the platform
      // allows it 150s; ours lands around 40s). So every failure here is
      // really one of two things:
      //
      //   * we hung up while it was still working (our 90s timeout, the phone
      //     losing signal, the student walking out of the building), or
      //   * it had already finished and the reply itself was lost.
      //
      // Either way the result is coming, or is already there. Waiting for the
      // row is what makes the result survive a bad connection — it is the
      // difference between "the network held for 40 uninterrupted seconds"
      // and "the interview was scored". Poll until it lands.
      if (mayStillBeRunning(e)) {
        final fb = await _awaitSavedFeedback(sessionId);
        if (fb != null) {
          state = state.copyWith(
            status: 'completed',
            feedback: fb,
            isVapiConnected: false,
            clearError: true,
          );
          return fb;
        }
      }

      // Genuinely no result — do NOT trap the user on the interview screen.
      // Exit to setup and mark the row abandoned in the background.
      // Keep the error on state (don't clear it) so the view can tell the
      // student the analysis failed instead of silently dropping them back
      // on the setup screen.
      if (_disposed) return null;
      state = state.copyWith(
        status: 'idle',
        isVapiConnected: false,
        error: 'feedback_failed',
      );
      unawaited(
        Supabase.instance.client
            .from('interview_sessions')
            .update({'status': 'abandoned'})
            .eq('id', sessionId)
            .then((_) {}, onError: (_) {}),
      );
      return null;
    } finally {
      // This can now run well over a minute after the end tap (the poll
      // below waits for the analysis to land), by which point the notifier
      // may be gone — writing to `state` then throws out of the finally and
      // would mask the real result.
      if (!_disposed) {
        state = state.copyWith(isLoading: false);
      }
    }
  }

  /// Waits for `interview-feedback` to land its row for [sessionId].
  ///
  /// Called only after the direct call already failed. The analysis is still
  /// running (or has finished) on the server, so this watches the table the
  /// function writes to instead of depending on an HTTP connection that has
  /// already proven unreliable.
  ///
  /// Checks immediately, then every 3s up to [_feedbackPollWindow]. That
  /// window is sized against the platform's 150s request ceiling — past it the
  /// function has been killed and no row is ever coming, so continuing to wait
  /// would only stall the student.
  ///
  /// A poll that returns no row means "not finished yet" and keeps waiting.
  /// A poll that *throws* means the phone still has no usable connection;
  /// [_feedbackPollFailureLimit] consecutive throws end the wait, so a student
  /// who ended the interview with the network genuinely down gets told so in a
  /// few seconds instead of watching a spinner for the whole window.
  static const Duration _feedbackPollWindow = Duration(seconds: 75);
  static const Duration _feedbackPollInterval = Duration(seconds: 3);
  static const int _feedbackPollFailureLimit = 3;

  /// Whether [error] leaves any chance that the analysis is still coming.
  ///
  /// The function replies with a non-2xx status for every case it can name —
  /// empty transcript, bad session, rate limit, unparseable model output. Those
  /// are complete answers: no row was written and none ever will be, so waiting
  /// on them just delays the bad news. What is worth waiting on is the opposite
  /// shape of failure — we never got a verdict at all.
  ///
  /// Getting this wrong is costly in both directions: too strict and a scored
  /// interview is thrown away, too loose and a student who cannot be scored
  /// waits out the whole poll window to be told so. Pinned by
  /// `interview_feedback_recovery_test.dart`.
  @visibleForTesting
  static bool mayStillBeRunning(Object error) {
    // Our own 90s cutoff, or the socket dying under us.
    if (error is TimeoutException) return true;
    if (error is SocketException) return true;
    if (error is http.ClientException) return true;

    if (error is FunctionException) {
      // 504 is the platform's request-idle timeout and 546 its wall-clock
      // kill; in both the worker was still alive and can have finished (and
      // saved) after the gateway stopped waiting. Every other status is the
      // function's own considered reply.
      return error.status == 504 || error.status == 546;
    }

    // Unrecognised failure: a lookup costs one query, a lost result costs the
    // student their interview.
    return true;
  }

  Future<Map<String, dynamic>?> _awaitSavedFeedback(String sessionId) async {
    final deadline = DateTime.now().add(_feedbackPollWindow);
    var attempt = 0;
    var consecutiveFailures = 0;

    while (true) {
      attempt++;
      try {
        final saved = await Supabase.instance.client
            .from('interview_feedback')
            .select()
            .eq('session_id', sessionId)
            .maybeSingle()
            .timeout(const Duration(seconds: 10));

        consecutiveFailures = 0;
        if (saved != null && saved['overall_score'] != null) {
          debugPrint('endSession: recovered saved feedback on poll $attempt');
          return Map<String, dynamic>.from(saved);
        }
      } on Exception catch (e) {
        consecutiveFailures++;
        debugPrint(
          'endSession: feedback poll $attempt failed '
          '($consecutiveFailures in a row): $e',
        );
        if (consecutiveFailures >= _feedbackPollFailureLimit) return null;
      }

      if (!DateTime.now().isBefore(deadline)) return null;

      // The notifier can be disposed while we wait (the student backs out of
      // the interview). Writing to `state` after that throws, so stop.
      if (_disposed) return null;

      await Future<void>.delayed(_feedbackPollInterval);
      if (_disposed) return null;
    }
  }

  // ── TTS Audio (fallback for non-Vapi text mode) ──────────────────────────

  /// Extracts MP3 bytes from the ElevenLabs TTS edge function.
  /// Uses InterviewPersonaConfig for voice selection (single source of truth).
  Future<String?> generateTTSAudioPath(String text, String language) async {
    try {
      final client = Supabase.instance.client;
      final token = client.auth.currentSession?.accessToken;
      if (token == null) return null;

      // Centralized voice selection — no more duplicated voice ID strings here
      final voiceId = InterviewPersonaConfig.getVoiceId(
        state.interviewerPersona,
        language,
      );

      final edgeUrl = Uri.parse(
        '${AppConfig.supabaseUrl}/functions/v1/elevenlabs-tts',
      );

      final response = await http.post(
        edgeUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          'apikey': AppConfig.supabaseAnonKey,
        },
        body: jsonEncode({'text': text, 'voiceId': voiceId}),
      );

      // Audit B6: rely on the status code only. The previous string
      // match against `'Invalid_api_key'` was brittle and would silently
      // miss any other 401 shape the ElevenLabs TTS proxy returns.
      if (response.statusCode == 401 || response.statusCode == 403) {
        debugPrint(
          'ElevenLabs TTS auth error (${response.statusCode}). '
          'Falling back to browser TTS.',
        );
        return '__BROWSER_TTS__';
      }

      if (response.statusCode != 200) {
        throw Exception(
          'TTS Request failed with ${response.statusCode}: ${response.body}',
        );
      }

      // Save binary to temp local file for playback via just_audio
      final tempDir = await getTemporaryDirectory();
      final file = File(
        '${tempDir.path}/tts_${DateTime.now().millisecondsSinceEpoch}.mp3',
      );
      await file.writeAsBytes(response.bodyBytes);
      // Audit D8: register so cleanupTtsFiles can sweep on
      // session-end / resetSession.
      _ttsFilePaths.add(file.path);
      return file.path;
    } on Exception catch (e) {
      state = state.copyWith(error: 'Voice playback error: ${e.toString()}');
      return null;
    }
  }

  // ── Hint generation ──────────────────────────────────────────────────────

  Future<void> getHint(String contextText) async {
    final sessionId = state.sessionId;
    if (sessionId == null) return;

    try {
      final client = Supabase.instance.client;
      final response = await client.functions.invoke(
        'interview-ai',
        body: {
          'sessionId': sessionId,
          'studentMessage': contextText,
          'sessionType': state.sessionType,
          'language': state.selectedLanguage,
          'persona': state.interviewerPersona,
          'action': 'get_hint',
        },
      );

      final data = response.data as Map<String, dynamic>?;
      if (data != null && data['hints'] != null) {
        final hintsRaw = data['hints'] as String;
        final parsedHints = hintsRaw
            .split('\n')
            .map((s) => s.trim().replaceAll(RegExp(r'^[-*•]\s*'), ''))
            .where((s) => s.isNotEmpty)
            .take(3)
            .toList();
        state = state.copyWith(liveHints: parsedHints);
      }
    } on Exception catch (e) {
      debugPrint('Failed to get hints: $e');
    }
  }

  // ── Feedback & History ──────────────────────────────────────────────────

  Future<void> loadFeedback(String targetSessionId) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final client = Supabase.instance.client;
      final response = await client.functions.invoke(
        'interview-feedback',
        body: {
          'sessionId': targetSessionId,
          'language': state.selectedLanguage,
        },
      );

      final data = response.data as Map<String, dynamic>?;
      if (data != null && data['feedback'] != null) {
        state = state.copyWith(feedback: data['feedback']);
      } else if (data != null && data['error'] != null) {
        state = state.copyWith(error: data['error']);
      }
    } catch (e) {
      debugPrint('Failed to load feedback: $e');
      state = state.copyWith(error: 'Failed to load feedback: $e');
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Returns at most [limit] historical sessions, ordered newest-first.
  /// Audit D9: previously unbounded — could OOM for prolific users.
  /// Conservative default of 50; raise via [limit] or pass [offset] to
  /// fetch older pages.
  Future<List<Map<String, dynamic>>> getSessionHistory({
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final client = Supabase.instance.client;
      final user = client.auth.currentUser;
      if (user == null) return [];

      final response = await client
          .from('interview_sessions')
          .select('*, institution:target_institution_id(name_en, name_ko)')
          .eq('student_id', user.id)
          .order('created_at', ascending: false)
          .range(offset, offset + limit - 1);

      return List<Map<String, dynamic>>.from(response);
    } on Exception catch (e) {
      debugPrint('Failed to fetch session history: $e');
      return [];
    }
  }

  Future<String?> fetchRecordingUrl(String vapiCallId) async {
    try {
      final client = Supabase.instance.client;
      final response = await client.functions.invoke(
        'vapi-fetch-recording',
        body: {'callId': vapiCallId},
      );

      final data = response.data as Map<String, dynamic>?;
      return data?['recordingUrl'] as String?;
    } catch (e) {
      debugPrint('Failed to fetch Vapi recording URL: $e');
      return null;
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  void resetSession() {
    unawaited(cleanupTtsFiles()); // audit D8
    state = const InterviewSessionState();
  }

  /// Audit U15: like [resetSession] but **preserves the feedback** from
  /// the most-recent completed session so the user can revisit it via
  /// history without it being wiped. Used by the "Start another"
  /// button on the post-session analytics view.
  void resetForNewSession() {
    unawaited(cleanupTtsFiles()); // audit D8
    final keep = state.feedback;
    state = InterviewSessionState(feedback: keep);
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
final interviewProvider =
    NotifierProvider<InterviewNotifier, InterviewSessionState>(() {
      return InterviewNotifier();
    });
