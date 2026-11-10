import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The phone's copy of a Study Plan's text (Tayyorgarlik T3, 2026-11-10):
/// what the server's newest draft held the last time this phone opened or
/// saved the plan. The builder shows it at once, read-only, while the server
/// answers; the server's text then takes its place — the server is the
/// source of truth, the copy only spares the student the wait.
@immutable
class StudyPlanCopy {
  const StudyPlanCopy({required this.sessionId, required this.version, required this.content, required this.savedAt});

  final String sessionId;

  /// The draft's version; 0 for a plan with no draft yet.
  final int version;
  final String content;

  /// When the phone kept it.
  final DateTime savedAt;

  Map<String, Object?> toJson() => {
    'sessionId': sessionId,
    'version': version,
    'content': content,
    'savedAt': savedAt.toUtc().toIso8601String(),
  };

  /// Null for anything that is not a copy this app wrote.
  static StudyPlanCopy? fromJson(Object? json) {
    if (json is! Map) return null;
    final sessionId = json['sessionId'];
    final version = json['version'];
    final content = json['content'];
    final savedAt = DateTime.tryParse('${json['savedAt']}');
    if (sessionId is! String || version is! num || content is! String || savedAt == null) return null;
    return StudyPlanCopy(sessionId: sessionId, version: version.toInt(), content: content, savedAt: savedAt);
  }
}

/// The copy's key: one per student, document type and target university
/// ('any' when the plan is not for a chosen one).
String studyPlanCopyKey({required String userId, required String type, String? targetUniversityId}) =>
    'study_plan_copy_v1:$userId:$type:${targetUniversityId ?? 'any'}';

/// Where the copies are kept. Neither call throws: a copy that cannot be
/// read is no copy, and one that cannot be written is simply not kept.
abstract interface class StudyPlanCache {
  Future<StudyPlanCopy?> read(String key);

  Future<void> write(String key, StudyPlanCopy copy);
}

/// [StudyPlanCache] in the phone's secure storage (the Keychain, Android's
/// encrypted storage), like the app's other per-student data: a plan is the
/// student's own writing.
class SecureStudyPlanCache implements StudyPlanCache {
  const SecureStudyPlanCache();

  static const _storage = FlutterSecureStorage();

  @override
  Future<StudyPlanCopy?> read(String key) async {
    try {
      final raw = await _storage.read(key: key);
      return raw == null ? null : StudyPlanCopy.fromJson(jsonDecode(raw));
    } catch (e) {
      debugPrint('[StudyPlanCache] read: $e');
      return null;
    }
  }

  @override
  Future<void> write(String key, StudyPlanCopy copy) async {
    try {
      await _storage.write(key: key, value: jsonEncode(copy.toJson()));
    } catch (e) {
      debugPrint('[StudyPlanCache] write: $e');
    }
  }
}

/// The builder's [StudyPlanCache]. Tests put an in-memory one in its place:
/// secure storage talks to the platform.
final studyPlanCacheProvider = Provider<StudyPlanCache>((ref) => const SecureStudyPlanCache());
