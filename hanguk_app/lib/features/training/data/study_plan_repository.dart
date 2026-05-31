import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class StudyPlanSession {
  final String id;
  final String studentId;
  final String documentType;
  final String? targetUniversityId;
  final int currentStep;
  final String status;
  final String? universityNameEn;
  final String? selectedTrack; // 'english' or 'korean'
  final String? updatedAt;
  final String? createdAt;

  StudyPlanSession({
    required this.id,
    required this.studentId,
    required this.documentType,
    this.targetUniversityId,
    required this.currentStep,
    required this.status,
    this.universityNameEn,
    this.selectedTrack,
    this.updatedAt,
    this.createdAt,
  });

  factory StudyPlanSession.fromJson(Map<String, dynamic> json) {
    return StudyPlanSession(
      id: json['id'],
      studentId: json['student_id'],
      documentType: json['document_type'],
      targetUniversityId: json['target_institution_id'],
      currentStep: json['current_step'],
      status: json['status'],
      universityNameEn:
          (json['institution'] as Map?)?['name_en'] ??
          (json['institution'] as Map?)?['name_ko'] ??
          (json['university'] as Map?)?['name_en'],
      selectedTrack: json['selected_track'],
      updatedAt: json['updated_at']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }

  StudyPlanSession copyWith({
    String? id,
    String? studentId,
    String? documentType,
    String? targetUniversityId,
    int? currentStep,
    String? status,
    String? universityNameEn,
    String? selectedTrack,
    String? updatedAt,
    String? createdAt,
  }) {
    return StudyPlanSession(
      id: id ?? this.id,
      studentId: studentId ?? this.studentId,
      documentType: documentType ?? this.documentType,
      targetUniversityId: targetUniversityId ?? this.targetUniversityId,
      currentStep: currentStep ?? this.currentStep,
      status: status ?? this.status,
      universityNameEn: universityNameEn ?? this.universityNameEn,
      selectedTrack: selectedTrack ?? this.selectedTrack,
      updatedAt: updatedAt ?? this.updatedAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class StudyPlanDraft {
  final String id;
  final String content;
  final int version;

  StudyPlanDraft({
    required this.id,
    required this.content,
    required this.version,
  });

  factory StudyPlanDraft.fromJson(Map<String, dynamic> json) {
    return StudyPlanDraft(
      id: json['id'],
      content: json['content'],
      version: json['version'],
    );
  }
}

class StudyPlanAnalysis {
  final String id;
  final num? overallScore;
  final List<dynamic>? grammarErrors;
  final String? contentFeedback;
  final List<dynamic>? strengths;
  final List<dynamic>? improvements;
  final String? aiResponse;

  StudyPlanAnalysis({
    required this.id,
    this.overallScore,
    this.grammarErrors,
    this.contentFeedback,
    this.strengths,
    this.improvements,
    this.aiResponse,
  });

  factory StudyPlanAnalysis.fromJson(Map<String, dynamic> json) {
    return StudyPlanAnalysis(
      id: json['id'],
      overallScore: json['overall_score'],
      grammarErrors: json['grammar_errors'],
      contentFeedback: json['content_feedback'],
      strengths: json['strengths'],
      improvements: json['improvements'],
      aiResponse: json['ai_response'],
    );
  }
}

class ChatMessage {
  final String role;
  final String content;
  ChatMessage({required this.role, required this.content});

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(role: json['role'], content: json['content']);
  }
}

class StudyPlanSessionState {
  final bool isLoading;
  final bool isSessionsLoading;
  // Audit U6: dedicated flag for the AI analyze call so the analysis
  // view's spinner doesn't trigger on unrelated state mutations
  // (createSession, loadSession, saveDraft).
  final bool isAnalyzing;
  final String? error;

  final List<StudyPlanSession> sessions;
  final StudyPlanSession? currentSession;
  final List<StudyPlanDraft> drafts;
  final List<StudyPlanAnalysis> analyses;
  final List<ChatMessage> chatHistory;

  // Track ongoing drafted text to preserve state across tabs locally before saving
  final String draftContent;

  const StudyPlanSessionState({
    this.isLoading = false,
    this.isSessionsLoading = false,
    this.isAnalyzing = false,
    this.error,
    this.sessions = const [],
    this.currentSession,
    this.drafts = const [],
    this.analyses = const [],
    this.chatHistory = const [],
    this.draftContent = '',
  });

  StudyPlanSessionState copyWith({
    bool? isLoading,
    bool? isSessionsLoading,
    bool? isAnalyzing,
    String? error,
    List<StudyPlanSession>? sessions,
    StudyPlanSession? currentSession,
    List<StudyPlanDraft>? drafts,
    List<StudyPlanAnalysis>? analyses,
    List<ChatMessage>? chatHistory,
    String? draftContent,
    bool clearError = false,
  }) {
    return StudyPlanSessionState(
      isLoading: isLoading ?? this.isLoading,
      isSessionsLoading: isSessionsLoading ?? this.isSessionsLoading,
      isAnalyzing: isAnalyzing ?? this.isAnalyzing,
      error: clearError ? null : (error ?? this.error),
      sessions: sessions ?? this.sessions,
      currentSession: currentSession ?? this.currentSession,
      drafts: drafts ?? this.drafts,
      analyses: analyses ?? this.analyses,
      chatHistory: chatHistory ?? this.chatHistory,
      draftContent: draftContent ?? this.draftContent,
    );
  }
}

class StudyPlanSessionNotifier
    extends Notifier<Map<String, StudyPlanSessionState>> {
  @override
  Map<String, StudyPlanSessionState> build() {
    return const {};
  }

  StudyPlanSessionState _getState(String type) =>
      state[type] ?? const StudyPlanSessionState();

  void _setState(String type, StudyPlanSessionState newState) {
    state = {...state, type: newState};
  }

  void setDraftContent(String type, String text) {
    _setState(type, _getState(type).copyWith(draftContent: text));
  }

  void clearError(String type) {
    _setState(type, _getState(type).copyWith(clearError: true));
  }

  Future<void> fetchSessions(String type) async {
    _setState(type, _getState(type).copyWith(isSessionsLoading: true));
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) return;

    try {
      final response = await client
          .from('study_plan_sessions')
          .select('*, institution:target_institution_id(name_en, name_ko)')
          .eq('student_id', user.id)
          .eq('document_type', type) // Filter by document type
          .order('updated_at', ascending: false);

      final List<StudyPlanSession> loaded = (response as List)
          .map((data) => StudyPlanSession.fromJson(data))
          .toList();

      // Audit D4: sort completed sessions to the bottom so they don't
      // dominate the in-progress list, but keep them visible (revisiting
      // feedback is a common use case). Within each bucket the existing
      // updated_at DESC order is preserved.
      // Alternative considered: filter completed entirely. Rejected —
      // users would lose access to past feedback.
      loaded.sort((a, b) {
        final aCompleted = a.status == 'completed' ? 1 : 0;
        final bCompleted = b.status == 'completed' ? 1 : 0;
        return aCompleted - bCompleted;
      });

      _setState(
        type,
        _getState(type).copyWith(isSessionsLoading: false, sessions: loaded),
      );
    } on Exception catch (e) {
      _setState(
        type,
        _getState(type).copyWith(isSessionsLoading: false, error: e.toString()),
      );
    }
  }

  Future<StudyPlanSession?> createSession(
    String type, {
    String? targetUniversityId,
    String? selectedTrack,
  }) async {
    final documentType = type;
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) return null;

    _setState(
      type,
      _getState(type).copyWith(isLoading: true, clearError: true),
    );
    try {
      final response = await client
          .from('study_plan_sessions')
          .insert({
            'student_id': user.id,
            'document_type': documentType,
            'target_institution_id': targetUniversityId,
            'current_step': 1,
            'status': 'in_progress',
            'selected_track': selectedTrack, // audit F2 — was in-memory only
          })
          .select('*, institution:target_institution_id(name_en, name_ko)')
          .single();

      // fromJson now reads selected_track straight from the row; the
      // explicit copyWith is a no-op overwrite that defends against an
      // older Edge Function response shape where the column would be
      // absent.
      final session = StudyPlanSession.fromJson(response);
      final sessionWithTrack = session.selectedTrack == null
          ? session.copyWith(selectedTrack: selectedTrack)
          : session;

      _setState(
        type,
        _getState(type).copyWith(
          isLoading: false,
          sessions: [sessionWithTrack, ..._getState(type).sessions],
          currentSession: sessionWithTrack,
          drafts: [],
          analyses: [],
          chatHistory: [],
          draftContent: '',
        ),
      );
      return sessionWithTrack;
    } on Exception catch (e) {
      _setState(
        type,
        _getState(
          type,
        ).copyWith(isLoading: false, error: 'Failed to create session: $e'),
      );
      return null;
    }
  }

  Future<void> loadSession(String type, String sessionId) async {
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) return;

    _setState(
      type,
      _getState(type).copyWith(isLoading: true, clearError: true),
    );
    try {
      final sessionResp = await client
          .from('study_plan_sessions')
          .select('*, institution:target_institution_id(name_en, name_ko)')
          .eq('id', sessionId)
          .eq('student_id', user.id)
          .single();

      final draftsResp = await client
          .from('study_plan_drafts')
          .select()
          .eq('session_id', sessionId)
          .order('version', ascending: false);

      final analysesResp = await client
          .from('study_plan_analyses')
          .select()
          .eq('session_id', sessionId)
          .order('created_at', ascending: false);

      final chatResp = await client
          .from('study_plan_chat_history')
          .select()
          .eq('session_id', sessionId)
          .order('created_at', ascending: true);

      final session = StudyPlanSession.fromJson(sessionResp);
      final drafts = (draftsResp as List)
          .map((j) => StudyPlanDraft.fromJson(j))
          .toList();
      final analyses = (analysesResp as List)
          .map((j) => StudyPlanAnalysis.fromJson(j))
          .toList();
      final chatHistory = (chatResp as List)
          .map((j) => ChatMessage.fromJson(j))
          .toList();

      _setState(
        type,
        _getState(type).copyWith(
          isLoading: false,
          currentSession: session,
          drafts: drafts,
          analyses: analyses,
          chatHistory: chatHistory,
          draftContent: drafts.isNotEmpty ? drafts.first.content : '',
        ),
      );
    } on Exception catch (e) {
      _setState(
        type,
        _getState(
          type,
        ).copyWith(isLoading: false, error: 'Failed to load session data: $e'),
      );
    }
  }

  Future<void> updateSessionStep(String type, int step) async {
    final currentSession = _getState(type).currentSession;
    if (currentSession == null) return;
    try {
      final nowIso = DateTime.now().toUtc().toIso8601String();
      await Supabase.instance.client
          .from('study_plan_sessions')
          .update({'current_step': step, 'updated_at': nowIso})
          .eq('id', currentSession.id);

      // Audit F3: previous version reconstructed the session manually,
      // dropping updatedAt/createdAt. copyWith preserves all fields.
      final updatedSession = currentSession.copyWith(
        currentStep: step,
        updatedAt: nowIso,
      );

      final updatedSessions = _getState(type).sessions
          .map((s) => s.id == updatedSession.id ? updatedSession : s)
          .toList();

      _setState(
        type,
        _getState(
          type,
        ).copyWith(currentSession: updatedSession, sessions: updatedSessions),
      );
    } on Exception catch (e) {
      debugPrint('Failed to update session step: $e');
    }
  }

  /// Persists a draft for the active session. Returns `true` on success.
  /// Audit U1/A5: previously this swallowed failures and the workspace
  /// still flipped to "saved" status. The bool result lets the caller
  /// surface failure in the UI.
  ///
  /// Audit D1: a per-session save mutex serializes concurrent saves so
  /// they don't race on `(session_id, version)`. The mutex lives on the
  /// notifier (in-memory) — across-device concurrency is still a
  /// follow-up.
  ///
  /// Audit D2: no longer overwrites `draftContent` after a successful
  /// save — the latest text is already in state from `setDraftContent`,
  /// and overwriting could clobber characters typed during the save.
  Future<bool> saveDraft(String type, String content) async {
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    final currentState = _getState(type);
    if (currentState.currentSession == null || user == null) return false;

    final sessionId = currentState.currentSession!.id;
    return _withSessionLock<bool>(sessionId, () async {
      // Audit D5: best-effort multi-device stale-draft protection.
      // Re-fetch the session row's updated_at right before insert; if
      // a newer version exists than what we remember locally, refuse
      // the save and surface an error so the user can refresh.
      try {
        final remote = await client
            .from('study_plan_drafts')
            .select('version')
            .eq('session_id', sessionId)
            .order('version', ascending: false)
            .limit(1)
            .maybeSingle();
        if (remote != null) {
          final remoteVersion = (remote['version'] as num?)?.toInt() ?? 0;
          final localMax = _getState(type).drafts.isEmpty
              ? 0
              : _getState(
                  type,
                ).drafts.map((d) => d.version).reduce((a, b) => a > b ? a : b);
          if (remoteVersion > localMax) {
            _setState(
              type,
              _getState(type).copyWith(
                error:
                    'Another device saved a newer draft. Please refresh to merge.',
              ),
            );
            return false;
          }
        }
      } on Exception catch (e) {
        // Non-fatal — fall through and rely on the (session_id, version)
        // unique constraint as the last line of defense.
        debugPrint('D5 stale check failed: $e');
      }

      // Recompute under the lock so concurrent calls don't pick the
      // same version number.
      final localState = _getState(type);
      final nextVersion = localState.drafts.isNotEmpty
          ? localState.drafts
                    .map((d) => d.version)
                    .reduce((a, b) => a > b ? a : b) +
                1
          : 1;
      final wordCount = content
          .split(RegExp(r'\s+'))
          .where((s) => s.isNotEmpty)
          .length;

      try {
        final response = await client
            .from('study_plan_drafts')
            .insert({
              'session_id': sessionId,
              'student_id': user.id,
              'version': nextVersion,
              'content': content,
              'word_count': wordCount,
              'source': 'typed',
            })
            .select()
            .single();

        final draft = StudyPlanDraft.fromJson(response);
        final stateNow = _getState(type);
        _setState(type, stateNow.copyWith(drafts: [draft, ...stateNow.drafts]));
        return true;
      } on Exception catch (e) {
        _setState(
          type,
          _getState(type).copyWith(error: 'Failed to save draft: $e'),
        );
        return false;
      }
    });
  }

  // ── Per-session save mutex (audit D1) ───────────────────────────────────
  final Map<String, Completer<void>> _saveLocks = {};

  Future<T> _withSessionLock<T>(
    String sessionId,
    Future<T> Function() body,
  ) async {
    while (_saveLocks[sessionId] != null) {
      try {
        await _saveLocks[sessionId]!.future;
      } on Exception {
        // ignore — predecessor surfaced its own error
      }
    }
    final completer = Completer<void>();
    _saveLocks[sessionId] = completer;
    try {
      return await body();
    } finally {
      _saveLocks.remove(sessionId);
      completer.complete();
    }
  }

  /// Audit U8: lets the user change the session's selected track after
  /// creation (Korean ↔ English). Target university change is the
  /// alternative considered — rejected because the dialog already
  /// covers that flow during creation and changing it mid-session
  /// invalidates the analyses written against the prior target.
  Future<bool> updateSelectedTrack(
    String type, {
    required String sessionId,
    required String track,
  }) async {
    try {
      final nowIso = DateTime.now().toUtc().toIso8601String();
      await Supabase.instance.client
          .from('study_plan_sessions')
          .update({'selected_track': track, 'updated_at': nowIso})
          .eq('id', sessionId);

      final state = _getState(type);
      final updated = state.sessions
          .map(
            (s) => s.id == sessionId
                ? s.copyWith(selectedTrack: track, updatedAt: nowIso)
                : s,
          )
          .toList();
      _setState(
        type,
        state.copyWith(
          sessions: updated,
          currentSession: state.currentSession?.id == sessionId
              ? state.currentSession?.copyWith(
                  selectedTrack: track,
                  updatedAt: nowIso,
                )
              : state.currentSession,
        ),
      );
      return true;
    } on Exception catch (e) {
      _setState(
        type,
        _getState(type).copyWith(error: 'Failed to update track: $e'),
      );
      return false;
    }
  }

  Future<void> deleteSession(String type, String sessionId) async {
    try {
      await Supabase.instance.client
          .from('study_plan_sessions')
          .delete()
          .eq('id', sessionId);

      final updatedSessions = _getState(
        type,
      ).sessions.where((s) => s.id != sessionId).toList();
      _setState(
        type,
        _getState(type).copyWith(
          sessions: updatedSessions,
          currentSession: _getState(type).currentSession?.id == sessionId
              ? null
              : _getState(type).currentSession,
        ),
      );
    } catch (e) {
      debugPrint('delete error: $e');
    }
  }

  void clearCurrentSession(String type) {
    // Audit D3: preserve the sessions list so the user doesn't see an
    // empty list flash + a re-fetch when they close a session.
    final s = _getState(type);
    _setState(type, StudyPlanSessionState(sessions: s.sessions));
  }

  /// AI Invocation using Edge Functions
  Future<StudyPlanAnalysis?> analyzeCurrentDraft(String type) async {
    final currentState = _getState(type);
    final draft = currentState.drafts.isNotEmpty
        ? currentState.drafts.first
        : null;
    if (draft == null || currentState.currentSession == null) return null;

    _setState(type, currentState.copyWith(isAnalyzing: true, clearError: true));
    try {
      final client = Supabase.instance.client;
      final response = await client.functions.invoke(
        'study-plan-trainer',
        body: {
          'action': 'analyze',
          'documentType': currentState.currentSession!.documentType,
          'content': draft.content,
          'targetUniversityId': currentState.currentSession!.targetUniversityId,
          'selectedTrack': currentState.currentSession!.selectedTrack,
          'language': 'en',
        },
      );

      final data = response.data as Map<String, dynamic>?;
      if (data == null || data['error'] != null) {
        throw Exception(data?['error'] ?? 'Empty response from Trainer AI');
      }

      final aiResponseText = data['response'] as String? ?? '';

      // Audit F6: try to parse a structured JSON envelope. The Edge
      // Function sometimes returns plain prose (legacy shape) and
      // sometimes returns
      //   { overall_score, grammar_errors, content_feedback,
      //     strengths, improvements, narrative }
      // (newer shape). Populate the matching DB columns when present.
      Map<String, dynamic>? parsed;
      final trimmed = aiResponseText.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          final decoded = jsonDecode(trimmed);
          if (decoded is Map<String, dynamic>) parsed = decoded;
        } on FormatException catch (e) {
          debugPrint('Analysis JSON parse failed (treating as prose): $e');
        }
      }

      final insertPayload = <String, dynamic>{
        'session_id': currentState.currentSession!.id,
        'draft_id': draft.id,
        'ai_response': aiResponseText,
        if (parsed != null) ...{
          if (parsed['overall_score'] is num)
            'overall_score': parsed['overall_score'],
          if (parsed['grammar_errors'] is List)
            'grammar_errors': parsed['grammar_errors'],
          if (parsed['content_feedback'] is String)
            'content_feedback': parsed['content_feedback'],
          if (parsed['strengths'] is List) 'strengths': parsed['strengths'],
          if (parsed['improvements'] is List)
            'improvements': parsed['improvements'],
        },
      };
      final insertResp = await client
          .from('study_plan_analyses')
          .insert(insertPayload)
          .select()
          .single();

      final analysis = StudyPlanAnalysis.fromJson(insertResp);
      _setState(
        type,
        _getState(type).copyWith(
          isAnalyzing: false,
          analyses: [analysis, ..._getState(type).analyses],
        ),
      );
      return analysis;
    } on Exception catch (e) {
      _setState(
        type,
        _getState(type).copyWith(isAnalyzing: false, error: 'AI Error: $e'),
      );
      return null;
    }
  }

  Future<Map<String, dynamic>?> superviseDraft(
    String type,
    String content,
  ) async {
    final currentState = _getState(type);
    if (currentState.currentSession == null || content.isEmpty) return null;

    try {
      final client = Supabase.instance.client;
      final response = await client.functions.invoke(
        'study-plan-trainer',
        body: {
          'action': 'draft_supervise',
          'documentType': currentState.currentSession!.documentType,
          'content': content,
          'targetUniversityId': currentState.currentSession!.targetUniversityId,
          'selectedTrack': currentState.currentSession!.selectedTrack,
          'language': 'en',
        },
      );

      final data = response.data as Map<String, dynamic>?;
      if (data == null || data['error'] != null) {
        return null;
      }

      final aiResponseText = data['response'] as String? ?? '{}';

      // Parse JSON
      if (aiResponseText.startsWith('{') && aiResponseText.endsWith('}')) {
        return Map<String, dynamic>.from(jsonDecode(aiResponseText));
      }
      return {};
    } on Exception catch (e) {
      debugPrint('Supervise AI Error: $e');
      return null;
    }
  }
}

final studyPlanSessionProvider =
    NotifierProvider<
      StudyPlanSessionNotifier,
      Map<String, StudyPlanSessionState>
    >(() {
      return StudyPlanSessionNotifier();
    });

// Helper provider to get state for a specific document type
final documentSessionProvider = Provider.family<StudyPlanSessionState, String>((
  ref,
  type,
) {
  final allStates = ref.watch(studyPlanSessionProvider);
  return allStates[type] ?? const StudyPlanSessionState();
});
