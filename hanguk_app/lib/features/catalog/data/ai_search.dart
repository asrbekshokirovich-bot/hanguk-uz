import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'catalog_filters.dart';

/// The search box, read by a language model (owner, 2026-10-13: "qidiruvda
/// yozganda sun'iy intellekt topsin"). The text goes to the
/// `ai-university-search` edge function while the student types; it answers
/// with universities from the same catalogue the app shows, so a result is
/// always one the app has a card for.

/// What the model read from the text. Field-of-study keywords stay on the
/// server: they are search stems, not words to show.
@immutable
class AiSearchIntent {
  const AiSearchIntent({
    this.cities = const [],
    this.degree,
    this.maxTuitionKrw,
    this.topikMax,
    this.type,
    this.englishOnly = false,
    this.partnerOnly = false,
  });

  factory AiSearchIntent.fromJson(Map<String, dynamic> j) => AiSearchIntent(
    cities: [for (final c in (j['cities'] as List? ?? const [])) if (c is String) c],
    degree: j['degree'] as String?,
    maxTuitionKrw: j['max_tuition_krw'] as num?,
    topikMax: j['topik_max'] as num?,
    type: j['type'] as String?,
    englishOnly: j['english_only'] == true,
    partnerOnly: j['partner_only'] == true,
  );

  final List<String> cities;

  /// `bakalavr` or `magistratura`.
  final String? degree;

  /// Highest fee per semester, in KRW.
  final num? maxTuitionKrw;

  /// The TOPIK level the student has; 0 means none.
  final num? topikMax;

  /// `national` or `private`.
  final String? type;
  final bool englishOnly;
  final bool partnerOnly;
}

@immutable
class AiSearchHit {
  const AiSearchHit({
    required this.institutionId,
    required this.guidelineId,
    this.matched = const [],
    this.matchCount = 0,
  });

  factory AiSearchHit.fromJson(Map<String, dynamic> j) => AiSearchHit(
    institutionId: j['institution_id'] as String,
    guidelineId: j['guideline_id'] as String,
    matched: [for (final m in (j['matched'] as List? ?? const [])) if (m is String) m],
    matchCount: (j['match_count'] as num?)?.toInt() ?? 0,
  );

  final String institutionId;
  final String guidelineId;

  /// Up to three faculty names that match the field of study.
  final List<String> matched;

  /// How many faculties match in all.
  final int matchCount;
}

@immutable
class AiSearchResult {
  const AiSearchResult({
    required this.hits,
    this.intent = const AiSearchIntent(),
    this.relaxed = const [],
    this.byModel = true,
  });

  factory AiSearchResult.fromJson(Map<String, dynamic> j) => AiSearchResult(
    hits: [
      for (final r in (j['results'] as List? ?? const []))
        if (r is Map<String, dynamic>) AiSearchHit.fromJson(r),
    ],
    intent: j['interpreted'] is Map<String, dynamic>
        ? AiSearchIntent.fromJson(j['interpreted'] as Map<String, dynamic>)
        : const AiSearchIntent(),
    relaxed: [for (final r in (j['relaxed'] as List? ?? const [])) if (r is String) r],
    byModel: j['mode'] == 'ai',
  );

  /// Best first.
  final List<AiSearchHit> hits;
  final AiSearchIntent intent;

  /// Conditions the server dropped to find anything: `tuition`, `topik`,
  /// `english`.
  final List<String> relaxed;

  /// False when the server fell back to a plain name search (the model was
  /// unavailable or the daily allowance was spent).
  final bool byModel;
}

/// The search's state: the newest answer and the text it answers.
@immutable
class AiSearchState {
  const AiSearchState({this.query = '', this.result, this.loading = false});

  /// The text [result] is for; it lags the box while a newer one is on its way.
  final String query;
  final AiSearchResult? result;

  /// A request for the box's current text is waiting or in flight.
  final bool loading;
}

/// Sends one query to the edge function; null when it could not answer.
typedef AiSearchCall = Future<AiSearchResult?> Function(String query);

final aiSearchCallProvider = Provider<AiSearchCall>((ref) {
  return (query) async {
    try {
      final res = await Supabase.instance.client.functions
          .invoke('ai-university-search', body: {'query': query})
          .timeout(const Duration(seconds: 15));
      final data = res.data;
      return data is Map<String, dynamic> ? AiSearchResult.fromJson(data) : null;
    } catch (e) {
      debugPrint('[AiSearch] $e');
      return null;
    }
  };
});

/// Shortest text worth sending; the server refuses less.
const int kAiSearchMinLength = 2;

/// Follows the search box ([catalogFilterProvider]'s query): waits for a
/// pause in typing, asks the server, and keeps only the answer to the newest
/// text, so a slow early reply cannot overwrite a later one.
class AiSearchNotifier extends Notifier<AiSearchState> {
  static const debounce = Duration(milliseconds: 450);

  Timer? _timer;
  int _ticket = 0;

  @override
  AiSearchState build() {
    ref.listen(catalogFilterProvider.select((f) => f.query.trim()), (_, q) => _schedule(q));
    ref.onDispose(() => _timer?.cancel());
    final q = ref.read(catalogFilterProvider).query.trim();
    if (q.length >= kAiSearchMinLength) {
      Future.microtask(() => _schedule(q));
      return AiSearchState(query: q, loading: true);
    }
    return const AiSearchState();
  }

  void _schedule(String q) {
    _timer?.cancel();
    final ticket = ++_ticket;
    if (q.length < kAiSearchMinLength) {
      state = const AiSearchState();
      return;
    }
    state = AiSearchState(query: state.query, result: state.result, loading: true);
    _timer = Timer(debounce, () async {
      final result = await ref.read(aiSearchCallProvider)(q);
      if (!ref.mounted || ticket != _ticket) return;
      state = AiSearchState(query: q, result: result);
    });
  }
}

final aiSearchProvider = NotifierProvider<AiSearchNotifier, AiSearchState>(AiSearchNotifier.new);
