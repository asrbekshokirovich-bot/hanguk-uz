import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/eligibility_engine.dart';

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

  /// The rules from `eligibility_rules`; the built-in defaults when the table
  /// cannot be read (offline), so the result is always computed.
  Future<EligibilityRules> fetchRules() async {
    try {
      final rows = await _client.from('eligibility_rules').select('key, value');
      return EligibilityRules.fromRows(List<Map<String, dynamic>>.from(rows));
    } catch (e) {
      debugPrint('eligibility_rules failed: $e');
      return const EligibilityRules();
    }
  }

  /// S04: name, phone (`+998…`), the answers and the computed result.
  Future<QuizSubmitResult> submit({
    required String phoneE164,
    required String name,
    required Map<String, dynamic> answers,
    required Map<String, dynamic> result,
  }) async {
    try {
      final data = await _client.rpc(
        'app_quiz_submit',
        params: {
          'p_phone': phoneE164,
          'p_name': name,
          'p_answers': answers,
          'p_result': result,
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

/// The rules, read once per app run.
final eligibilityRulesProvider = FutureProvider<EligibilityRules>((ref) {
  return ref.watch(quizRepositoryProvider).fetchRules();
});
