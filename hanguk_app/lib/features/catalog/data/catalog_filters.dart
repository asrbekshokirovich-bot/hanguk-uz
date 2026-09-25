import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/catalog_models.dart';

/// Degree filter values, as the guideline template spells them.
class CatalogDegree {
  const CatalogDegree._();

  static const String all = 'all';
  static const String bachelor = 'bakalavr';
  static const String master = 'magistratura';
}

/// The Filtr screen's state (design screen 02). Price bounds are null until
/// the student moves them, which means "no price filter" — a university whose
/// Excel carries no fee stays listed until a range is actually chosen.
@immutable
class CatalogFilter {
  const CatalogFilter({
    this.query = '',
    this.cities = const {},
    this.degree = CatalogDegree.all,
    this.ielts,
    this.minPrice,
    this.maxPrice,
  });

  final String query;

  /// City labels as the Excel writes them (`shahar`).
  final Set<String> cities;
  final String degree;

  /// The student's IELTS score, or null for "not needed".
  final double? ielts;
  final int? minPrice;
  final int? maxPrice;

  bool get hasPrice => minPrice != null || maxPrice != null;

  /// The number on the filter button's badge: cities + degree + price + IELTS.
  int get activeCount =>
      cities.length +
      (degree != CatalogDegree.all ? 1 : 0) +
      (hasPrice ? 1 : 0) +
      (ielts != null ? 1 : 0);

  CatalogFilter copyWith({
    String? query,
    Set<String>? cities,
    String? degree,
    double? Function()? ielts,
    int? Function()? minPrice,
    int? Function()? maxPrice,
  }) {
    return CatalogFilter(
      query: query ?? this.query,
      cities: cities ?? this.cities,
      degree: degree ?? this.degree,
      ielts: ielts != null ? ielts() : this.ielts,
      minPrice: minPrice != null ? minPrice() : this.minPrice,
      maxPrice: maxPrice != null ? maxPrice() : this.maxPrice,
    );
  }

  /// Everything but the search text back to default — the Filtr screen's
  /// "Tozalash".
  CatalogFilter cleared() => CatalogFilter(query: query);
}

class CatalogFilterNotifier extends Notifier<CatalogFilter> {
  @override
  CatalogFilter build() => const CatalogFilter();

  void set(CatalogFilter value) => state = value;

  void setQuery(String q) => state = state.copyWith(query: q);
}

final catalogFilterProvider = NotifierProvider<CatalogFilterNotifier, CatalogFilter>(
  CatalogFilterNotifier.new,
);

/// The guideline a card shows for [u] under [f]: the chosen degree's, or the
/// bachelor's when the filter says "all".
CatalogGuideline? guidelineFor(CatalogUniversity u, CatalogFilter f) =>
    u.forDegree(f.degree == CatalogDegree.all ? null : f.degree);

/// The fee a card shows and the price filter compares: the lowest in the
/// guideline.
num? priceOf(CatalogGuideline g) => g.tuitionMin ?? g.tuitionMax;

/// Apply [f] to [all]. Cheapest first; a university with no fee sorts last.
List<CatalogUniversity> applyCatalogFilter(List<CatalogUniversity> all, CatalogFilter f) {
  final q = f.query.trim().toLowerCase();
  final out = all.where((u) {
    final g = guidelineFor(u, f);
    if (g == null) return false;
    if (f.cities.isNotEmpty && !f.cities.contains(u.city)) return false;
    if (q.isNotEmpty) {
      final hay = [
        u.displayName,
        u.nameKo,
        u.nameKoShort,
        u.city,
        g.cityKo,
      ].whereType<String>().join(' ').toLowerCase();
      if (!hay.contains(q)) return false;
    }
    if (f.ielts != null) {
      final need = g.ieltsMin;
      if (g.englishTrack != true || need == null || need > f.ielts!) return false;
    }
    if (f.hasPrice) {
      final p = priceOf(g);
      if (p == null) return false;
      if (f.minPrice != null && p < f.minPrice!) return false;
      if (f.maxPrice != null && p > f.maxPrice!) return false;
    }
    return true;
  }).toList();
  out.sort((a, b) {
    final pa = priceOf(guidelineFor(a, f)!);
    final pb = priceOf(guidelineFor(b, f)!);
    if (pa == null && pb == null) return a.displayName.compareTo(b.displayName);
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa.compareTo(pb);
  });
  return out;
}

/// The slider's ends: the cheapest and dearest fee in the catalogue, rounded
/// out to the nearest 500,000 so the handles land on round numbers.
({int min, int max}) priceBounds(List<CatalogUniversity> all) {
  final prices = [
    for (final u in all)
      for (final g in u.guidelines)
        if (priceOf(g) != null) priceOf(g)!.toInt(),
  ];
  if (prices.isEmpty) return (min: 0, max: 10000000);
  const step = 500000;
  final lo = (prices.reduce((a, b) => a < b ? a : b) ~/ step) * step;
  final hiRaw = prices.reduce((a, b) => a > b ? a : b);
  final hi = ((hiRaw + step - 1) ~/ step) * step;
  return (min: lo, max: hi <= lo ? lo + step : hi);
}

/// Korean spelling of the cities the Excel names in English, for the city
/// tiles' 서울 / Seoul pair. Not taken from `institutions.city_ko`: that is
/// the institution's seat, which is not always the city the Excel lists (a
/// Sejong-campus guideline of a Seoul university, a multi-campus school).
const Map<String, String> _cityKo = {
  'Seoul': '서울', 'Busan': '부산', 'Incheon': '인천', 'Daegu': '대구',
  'Daejeon': '대전', 'Gwangju': '광주', 'Ulsan': '울산', 'Sejong': '세종',
  'Suwon': '수원', 'Yongin': '용인', 'Seongnam': '성남', 'Goyang': '고양',
  'Bucheon': '부천', 'Ansan': '안산', 'Anseong': '안성', 'Hwaseong': '화성',
  'Siheung': '시흥', 'Yangju': '양주', 'Paju': '파주', 'Gimpo': '김포',
  'Uijeongbu': '의정부', 'Pyeongtaek': '평택', 'Osan': '오산', 'Hanam': '하남',
  'Cheonan': '천안', 'Asan': '아산', 'Nonsan': '논산', 'Gongju': '공주',
  'Cheongju': '청주', 'Chungju': '충주', 'Jecheon': '제천', 'Wonju': '원주',
  'Chuncheon': '춘천', 'Gangneung': '강릉', 'Jeonju': '전주', 'Iksan': '익산',
  'Gunsan': '군산', 'Namwon': '남원', 'Mokpo': '목포', 'Suncheon': '순천',
  'Yeosu': '여수', 'Naju': '나주', 'Gyeongsan': '경산', 'Gyeongju': '경주',
  'Andong': '안동', 'Pohang': '포항', 'Gumi': '구미', 'Gimcheon': '김천',
  'Sangju': '상주', 'Changwon': '창원', 'Jinju': '진주', 'Gimhae': '김해',
  'Jeju': '제주',
};

/// The Filtr screen's city tiles: every city in the catalogue, most
/// universities first. `ko` is the Korean spelling when the table knows it.
List<({String name, String? ko, int count})> catalogCities(List<CatalogUniversity> all) {
  final counts = <String, int>{};
  final ko = <String, String>{};
  for (final u in all) {
    final c = u.city;
    if (c == null) continue;
    counts[c] = (counts[c] ?? 0) + 1;
    final k = _cityKo[c];
    if (k != null) ko[c] = k;
  }
  final names = counts.keys.toList()
    ..sort((a, b) {
      final byCount = counts[b]!.compareTo(counts[a]!);
      return byCount != 0 ? byCount : a.compareTo(b);
    });
  return [for (final n in names) (name: n, ko: ko[n], count: counts[n]!)];
}
