import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/cache/cached_rows.dart';
import '../../../core/cache/snapshot_queries.dart';
import '../domain/eligibility_engine.dart';

final _rulesRows = CachedRows('eligibility_rules', query: kSnapshotReads[kRulesAsset]!, asset: kRulesAsset);

/// What `app_quiz_submit` answered.
enum QuizSubmitStatus { ok, student, invalidPhone, invalidName, network }

@immutable
class QuizSubmitResult {
  const QuizSubmitResult(this.status, {this.phone, this.linkCode});

  final QuizSubmitStatus status;
  final String? phone;

  /// The lead's personal code for `t.me/<bot>?start=L_<code>`.
  final String? linkCode;
}

QuizSubmitResult parseQuizSubmitResponse(Object? data) {
  if (data is Map) {
    final status = switch (data['status']) {
      'ok' => QuizSubmitStatus.ok,
      'student' => QuizSubmitStatus.student,
      'invalid_phone' => QuizSubmitStatus.invalidPhone,
      'invalid_name' => QuizSubmitStatus.invalidName,
      _ => QuizSubmitStatus.network,
    };
    final phone = data['phone'];
    final code = data['link_code'];
    return QuizSubmitResult(
      status,
      phone: phone is String ? phone : null,
      linkCode: code is String ? code : null,
    );
  }
  return const QuizSubmitResult(QuizSubmitStatus.network);
}

class QuizRepository {
  QuizRepository(this._client);

  final SupabaseClient _client;

  /// The rules from `eligibility_rules` — the last read, or the copy shipped
  /// in the app, while the network brings the current ones ([onFresh] then
  /// runs); the built-in defaults when none can be read, so the result is
  /// always computed.
  Future<EligibilityRules> fetchRules({void Function()? onFresh}) async {
    try {
      final rows = await _rulesRows.load(
        () => _client.from(kRulesTable).select(kRulesColumns).timeout(const Duration(seconds: 20)),
        onFresh: onFresh,
      );
      return EligibilityRules.fromRows(List<Map<String, dynamic>>.from(rows));
    } catch (e) {
      debugPrint('eligibility_rules failed: $e');
      return const EligibilityRules();
    }
  }

  /// S04: name, phone (`+998…` / `+996…`), the answers and the computed
  /// result. [country] is sent only when it is not Uzbekistan, the server's
  /// default (plan KG3), so a build that knows Kyrgyzstan still works with a
  /// server that does not.
  Future<QuizSubmitResult> submit({
    required String phoneE164,
    required String name,
    required Map<String, dynamic> answers,
    required Map<String, dynamic> result,
    String country = 'UZ',
  }) async {
    try {
      final data = await _client.rpc(
        'app_quiz_submit',
        params: {
          'p_phone': phoneE164,
          'p_name': name,
          'p_answers': answers,
          'p_result': result,
          if (country != 'UZ') 'p_country': country,
        },
      );
      return parseQuizSubmitResponse(data);
    } catch (e) {
      debugPrint('app_quiz_submit failed: $e');
      return const QuizSubmitResult(QuizSubmitStatus.network);
    }
  }

  /// The Telegram bot's @username, as the CRM reads it (`telegram-webhook`
  /// `?action=botinfo`). Null when it cannot be read.
  Future<String?> botUsername() async {
    try {
      final res = await _client.functions.invoke(
        'telegram-webhook?action=botinfo',
        method: HttpMethod.get,
      );
      final data = res.data;
      if (data is Map && data['username'] is String) {
        final name = (data['username'] as String).trim();
        return name.isEmpty ? null : name;
      }
    } catch (e) {
      debugPrint('telegram botinfo failed: $e');
    }
    return null;
  }
}

final quizRepositoryProvider = Provider<QuizRepository>((ref) {
  return QuizRepository(Supabase.instance.client);
});

/// The rules; read again when the network brings newer ones.
final eligibilityRulesProvider = FutureProvider<EligibilityRules>((ref) {
  return ref.watch(quizRepositoryProvider).fetchRules(
    onFresh: () {
      try {
        ref.invalidateSelf();
      } catch (_) {}
    },
  );
});
