import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// One row of a guideline's scholarship table: the tuition grant a test
/// result earns on admission (`app_grant_tiers()`, from
/// university_guideline_grants).
@immutable
class GrantTier {
  const GrantTier({
    required this.test,
    required this.percent,
    this.topikMin,
    this.topikMax,
    this.ieltsMin,
    this.toeflMin,
    this.sum,
  });

  factory GrantTier.fromRow(Map<String, dynamic> r) {
    double? n(String k) => (r[k] as num?)?.toDouble();
    final mezon = (r['mezon'] as String? ?? '').toUpperCase();
    return GrantTier(
      test: mezon.contains(' VA ')
          ? GrantTest.both
          : mezon.contains('YOKI') && mezon.contains('TOPIK')
          ? GrantTest.either
          : mezon.contains('TOPIK')
          ? GrantTest.topik
          : GrantTest.ielts,
      percent: (r['grant_pct'] as num?)?.toInt() ?? 0,
      topikMin: n('topik_min'),
      topikMax: n('topik_max'),
      ieltsMin: n('ielts_min'),
      toeflMin: n('toefl_ibt_min'),
      sum: r['grant_sum'] as num?,
    );
  }

  final GrantTest test;
  final int percent;
  final double? topikMin;
  final double? topikMax;
  final double? ieltsMin;
  final double? toeflMin;

  /// The grant as a sum off the tuition (KRW) when the guideline gives one
  /// instead of a percent ([percent] is 0 then).
  final num? sum;

  /// Whether TOPIK [topik] (0 for none) earns it: within the row's levels;
  /// a TOPIK row with no level is the grant every new student gets.
  bool _topik(int topik) {
    final lo = topikMin;
    final hi = topikMax;
    if (lo == null && hi == null) return test == GrantTest.topik;
    if (topik <= 0) return false;
    return (lo == null || topik >= lo) && (hi == null || topik <= hi);
  }

  /// IELTS [ielts] (0 for none) at or above the row's band; a row with no
  /// band asks for TOEFL, which the board does not.
  bool _ielts(double ielts) => ieltsMin != null && ielts > 0 && ielts >= ieltsMin!;

  bool earnedBy({required int topik, required double ielts}) => switch (test) {
    GrantTest.topik => _topik(topik),
    GrantTest.ielts => _ielts(ielts),
    GrantTest.either => _topik(topik) || _ielts(ielts),
    GrantTest.both => _topik(topik) && _ielts(ielts),
  };
}

enum GrantTest { topik, ielts, either, both }

/// The largest grant [tiers] give for these results; 0 for none.
int grantPercentFor(List<GrantTier> tiers, {required int topik, required double ielts}) {
  var best = 0;
  for (final t in tiers) {
    if (t.percent > best && t.earnedBy(topik: topik, ielts: ielts)) best = t.percent;
  }
  return best;
}

/// Every guideline's tiers, by guideline id; open to guests.
final grantTiersProvider = FutureProvider<Map<String, List<GrantTier>>>((ref) async {
  final rows = await Supabase.instance.client.rpc('app_grant_tiers').timeout(const Duration(seconds: 20));
  return grantTiersFrom(rows as List? ?? const []);
});

@visibleForTesting
Map<String, List<GrantTier>> grantTiersFrom(List<dynamic> rows) {
  final out = <String, List<GrantTier>>{};
  for (final r in rows) {
    if (r is! Map<String, dynamic>) continue;
    final id = r['guideline_id'] as String?;
    if (id == null) continue;
    out.putIfAbsent(id, () => []).add(GrantTier.fromRow(r));
  }
  return out;
}

/// One guideline's admission grants for TOPIK / IELTS, in its own order —
/// percents and sums alike (`app_university_grants`); open to guests.
final universityGrantsProvider = FutureProvider.family<List<GrantTier>, String>((ref, guidelineId) async {
  final rows = await Supabase.instance.client
      .rpc('app_university_grants', params: {'p_guideline': guidelineId})
      .timeout(const Duration(seconds: 20));
  // A guideline's table can repeat a row (one per campus or track): once.
  final seen = <Object>{};
  return [
    for (final r in rows as List? ?? const [])
      if (r is Map<String, dynamic>)
        if (GrantTier.fromRow(r) case final t
            when seen.add((t.test, t.percent, t.sum, t.topikMin, t.topikMax, t.ieltsMin, t.toeflMin)))
          t,
  ];
});
