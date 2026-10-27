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
    this.field,
    this.regions = const {},
    this.topik,
    this.type,
    this.grant,
    this.onePercent = false,
  });

  final String query;

  /// City labels as the Excel writes them (`shahar`).
  final Set<String> cities;
  final String degree;

  /// The student's IELTS score, or null for "not needed".
  final double? ielts;
  final int? minPrice;
  final int? maxPrice;

  /// The full design's filter board (screen 05): a field of study, read by
  /// the field search (`ai-university-search`) — an [AiSearchField] key.
  final String? field;

  /// City groups ([CatalogRegion]): Seul, Gyeonggi, Busan …, Boshqa.
  final Set<String> regions;

  /// "Qabul uchun TOPIK talabi": null for "Farqi yo'q", [CatalogTopik.none]
  /// for "Talab yo'q", or "2" / "3" / "4" for "≤ n".
  final String? topik;

  /// `state` or `private`; null for "Farqi yo'q".
  final String? type;

  /// "Grant / stipendiya": the least tuition waiver wanted, in percent (30,
  /// 50, 100); null for "Shart emas".
  final int? grant;

  /// Only the "1% universitetlar" ([kOnePercentUniversities]).
  final bool onePercent;

  bool get hasPrice => minPrice != null || maxPrice != null;

  /// The number on the filter button's badge: cities + degree + price + IELTS.
  int get activeCount =>
      cities.length +
      (degree != CatalogDegree.all ? 1 : 0) +
      (hasPrice ? 1 : 0) +
      (ielts != null ? 1 : 0) +
      (field != null ? 1 : 0) +
      regions.length +
      (topik != null ? 1 : 0) +
      (type != null ? 1 : 0) +
      (grant != null ? 1 : 0) +
      (onePercent ? 1 : 0);

  CatalogFilter copyWith({
    String? query,
    Set<String>? cities,
    String? degree,
    double? Function()? ielts,
    int? Function()? minPrice,
    int? Function()? maxPrice,
    String? Function()? field,
    Set<String>? regions,
    String? Function()? topik,
    String? Function()? type,
    int? Function()? grant,
    bool? onePercent,
  }) {
    return CatalogFilter(
      query: query ?? this.query,
      cities: cities ?? this.cities,
      degree: degree ?? this.degree,
      ielts: ielts != null ? ielts() : this.ielts,
      minPrice: minPrice != null ? minPrice() : this.minPrice,
      maxPrice: maxPrice != null ? maxPrice() : this.maxPrice,
      field: field != null ? field() : this.field,
      regions: regions ?? this.regions,
      topik: topik != null ? topik() : this.topik,
      type: type != null ? type() : this.type,
      grant: grant != null ? grant() : this.grant,
      onePercent: onePercent ?? this.onePercent,
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

/// Hanguk's "1% universitetlar ro'yxati" (2026-10-21), by Korean name as the
/// catalog writes it. A few are not in the catalog yet and match nothing.
const Set<String> kOnePercentUniversities = {
  '건국대학교',
  '건양대학교',
  '경북대학교',
  '경성대학교',
  '경희대학교',
  '계명대학교',
  '고려대학교',
  '덕성여자대학교',
  '동국대학교',
  '부산대학교',
  '부산외국어대학교',
  '서울시립대학교',
  '서울신학대학교',
  '선문대학교',
  '성결대학교',
  '성균관대학교',
  '성신여자대학교',
  '세종대학교',
  '숙명여자대학교',
  '아주대학교',
  '울산과학기술원',
  '이화여자대학교',
  '인하대학교',
  '제주대학교',
  '중부대학교',
  '중앙대학교',
  '충남대학교',
  '충북대학교',
  '포항공과대학교',
  '한국항공대학교',
  '한성대학교',
  '한양대학교',
  '홍익대학교',
};

/// Whether [u] is on [kOnePercentUniversities].
bool isOnePercent(CatalogUniversity u) => kOnePercentUniversities.contains(u.nameKo?.trim());

/// The guideline a card shows for [u] under [f]: the chosen degree's, or the
/// bachelor's when the filter says "all".
CatalogGuideline? guidelineFor(CatalogUniversity u, CatalogFilter f) =>
    u.forDegree(f.degree == CatalogDegree.all ? null : f.degree);

/// The fee a card shows and the price filter compares: the lowest in the
/// guideline.
num? priceOf(CatalogGuideline g) => g.tuitionMin ?? g.tuitionMax;

/// Apply [f] to [all]. Cheapest first; a university with no fee sorts last.
/// [fieldMatches] is the field search's answer for [CatalogFilter.field]:
/// the universities with a programme of that field (null while it loads, or
/// with no field chosen — then the field does not filter). [grants] is each
/// university's largest tuition waiver in percent, for [CatalogFilter.grant]
/// (null while it loads — then the grant does not filter).
List<CatalogUniversity> applyCatalogFilter(
  List<CatalogUniversity> all,
  CatalogFilter f, {
  Set<String>? fieldMatches,
  Map<String, int>? grants,
}) {
  final q = f.query.trim().toLowerCase();
  final out = all.where((u) {
    final g = guidelineFor(u, f);
    if (g == null) return false;
    if (f.cities.isNotEmpty && !f.cities.contains(u.city)) return false;
    if (f.onePercent && !isOnePercent(u)) return false;
    if (f.field != null && fieldMatches != null && !fieldMatches.contains(u.institutionId)) return false;
    if (f.regions.isNotEmpty && !f.regions.contains(catalogRegionOf(g.city ?? u.city))) return false;
    if (f.grant != null && grants != null && (grants[u.institutionId] ?? 0) < f.grant!) return false;
    if (f.topik != null) {
      final need = g.topikMin;
      if (f.topik == CatalogTopik.none) {
        if (need != null && need > 0) return false;
      } else {
        final max = int.tryParse(f.topik!) ?? 6;
        if (need != null && need > max) return false;
      }
    }
    if (f.type != null) {
      final t = switch (g.institutionType) {
        'national' || 'public' || 'national_special' => 'state',
        'private' => 'private',
        _ => null,
      };
      if (t != f.type) return false;
    }
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
  // Official partners first, then cheapest first, no fee last.
  out.sort((a, b) {
    if (a.isPartner != b.isPartner) return a.isPartner ? -1 : 1;
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

/// "Talab yo'q" on the filter board's TOPIK row.
class CatalogTopik {
  const CatalogTopik._();

  static const String none = 'none';
}

/// The filter board's city groups (design screen 05), keyed by the label the
/// design gives them.
class CatalogRegion {
  const CatalogRegion._();

  static const String seoul = 'Seul';
  static const String gyeonggi = 'Gyeonggi';
  static const String busan = 'Busan';
  static const String daejeon = 'Daejeon';
  static const String daegu = 'Daegu';
  static const String gwangju = 'Gwangju';
  static const String jeju = 'Jeju';
  static const String other = 'Boshqa';

  static const List<String> all = [seoul, gyeonggi, busan, daejeon, daegu, gwangju, jeju, other];
}

/// Gyeonggi's cities as the Excel writes them without the province.
const Set<String> _gyeonggiCities = {
  'ansan', 'anseong', 'anyang', 'bucheon', 'gimpo', 'goyang', 'hanam', 'hwaseong', 'namyangju', 'osan',
  'paju', 'pyeongtaek', 'seongnam', 'siheung', 'suwon', 'uijeongbu', 'yangju', 'yangpyeong', 'yongin',
};

/// The group a guideline's city (`shahar`, "Suwon (Gyeonggi-do)") falls in.
/// Read from the city the student studies in, not the institution's seat.
String catalogRegionOf(String? city) {
  final c = (city ?? '').toLowerCase().trim();
  if (c.isEmpty) return CatalogRegion.other;
  if (c.startsWith('seoul')) return CatalogRegion.seoul;
  final head = c.split(RegExp(r'[\s(/,]')).first;
  if (c.contains('gyeonggi') || _gyeonggiCities.contains(head)) return CatalogRegion.gyeonggi;
  if (head == 'busan') return CatalogRegion.busan;
  if (head == 'daejeon') return CatalogRegion.daejeon;
  if (head == 'daegu') return CatalogRegion.daegu;
  if (head == 'gwangju') return CatalogRegion.gwangju;
  if (head == 'jeju') return CatalogRegion.jeju;
  return CatalogRegion.other;
}
