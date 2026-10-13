import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/catalog_models.dart';
import 'catalog_filters.dart';
import 'catalog_repository.dart';

/// The search box, read by a language model, by field of study (owner,
/// 2026-10-13: "IT deb yozsam IT ga aloqador barcha universitetlar,
/// stomatologiya deb yozsa faqat stomatologiya yo'nalishi bor universitetlar
/// chiqsin"). The text goes to the `ai-university-search` edge function while
/// the student types; it answers with every university of the catalogue the
/// app shows that has a programme of that field. A name or a city is not a
/// field: then the app's own name filter answers, as before.

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

  /// The programmes of the field in this guideline, as staff typed them.
  final List<String> matched;

  /// How many there are.
  final int matchCount;
}

@immutable
class AiSearchResult {
  const AiSearchResult({required this.hits, this.byField = true});

  factory AiSearchResult.fromJson(Map<String, dynamic> j) => AiSearchResult(
    hits: [
      for (final r in (j['results'] as List? ?? const []))
        if (r is Map<String, dynamic>) AiSearchHit.fromJson(r),
    ],
    byField: j['mode'] == 'field',
  );

  /// Best first; a university's guidelines one after another, the bachelor's
  /// first.
  final List<AiSearchHit> hits;

  /// The text named a field and [hits] are its universities. False when it
  /// did not (a name, a city), or the model was unavailable or the daily
  /// allowance spent: the name filter answers then.
  final bool byField;
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

/// Shortest text worth sending; the server refuses less. Two, for "IT".
const int kAiSearchMinLength = 2;

/// Whether [query] is the start of a university's name ("woo" for Woosong
/// University, "서울" for 서울대학교): then the student is looking for that
/// university, the name filter finds it, and the model is not asked — every
/// call it is spared saves the free quota (owner, 2026-10-13). Three
/// characters at least, so "IT" is never mistaken for one.
@visibleForTesting
bool startsUniversityName(List<CatalogUniversity> all, String query) {
  final q = query.trim().toLowerCase();
  if (q.length < 3) return false;
  for (final u in all) {
    for (final n in [u.displayName, u.nameKo, u.nameKoShort]) {
      if (n != null && n.toLowerCase().startsWith(q)) return true;
    }
  }
  return false;
}

/// Follows the search box ([catalogFilterProvider]'s query): waits for a
/// pause in typing, asks the server, and keeps only the answer to the newest
/// text, so a slow early reply cannot overwrite a later one. A university's
/// name is left to the name filter ([startsUniversityName]).
class AiSearchNotifier extends Notifier<AiSearchState> {
  /// Long enough that a word typed at a normal pace is sent once, not once
  /// per letter: each call spends the free model quota.
  static const debounce = Duration(milliseconds: 800);

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
    if (q.length < kAiSearchMinLength || startsUniversityName(ref.read(catalogProvider).value ?? const [], q)) {
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
