import 'package:flutter/foundation.dart';

/// One guideline Excel staff loaded in the CRM's "Universitetlar → Ma'lumotli"
/// section: a university's admission terms for one degree and intake.
///
/// Values are shown exactly as staff typed them — the English name stays
/// English, the Uzbek notes stay Uzbek — and money stays in the currency the
/// guideline quotes (KRW today). Nothing here is converted or translated.
@immutable
class CatalogGuideline {
  const CatalogGuideline({
    required this.id,
    required this.institutionId,
    this.nameKo,
    this.nameKoShort,
    this.nameEn,
    this.cityKo,
    this.institutionType,
    this.univNameEn,
    this.univNameKr,
    this.campus,
    this.city,
    this.intakeYear,
    this.semester,
    this.degree,
    this.englishTrack,
    this.koreanTrack,
    this.topikMin,
    this.ieltsMin,
    this.toeflMin,
    this.currency,
    this.entranceFee,
    this.tuitionMin,
    this.tuitionMax,
    this.tuitionPeriod,
    this.facultyCount,
    this.applicationFee,
    this.applicationFeeCurrency,
    this.bankAmount,
    this.bankCurrency,
    this.recommendation,
  });

  final String id;
  final String institutionId;

  // From `institutions`.
  final String? nameKo;
  final String? nameKoShort;
  final String? nameEn;
  final String? cityKo;
  final String? institutionType;

  // From the Excel.
  final String? univNameEn;
  final String? univNameKr;
  final String? campus;
  final String? city;
  final int? intakeYear;

  /// 'bahor' | 'kuz', as the template spells it.
  final String? semester;

  /// 'bakalavr' | 'magistratura'.
  final String? degree;
  final bool? englishTrack;
  final bool? koreanTrack;
  final num? topikMin;
  final num? ieltsMin;
  final num? toeflMin;
  final String? currency;
  final num? entranceFee;
  final num? tuitionMin;
  final num? tuitionMax;

  /// 'semestr' | 'yil' | null.
  final String? tuitionPeriod;
  final int? facultyCount;
  final num? applicationFee;
  final String? applicationFeeCurrency;
  final num? bankAmount;
  final String? bankCurrency;

  /// 'ha' | 'yoq' | 'ixtiyoriy'.
  final String? recommendation;

  static num? _num(Object? v) =>
      v == null ? null : (v is num ? v : num.tryParse(v.toString()));

  factory CatalogGuideline.fromRow(Map<String, dynamic> r) {
    return CatalogGuideline(
      id: r['guideline_id'] as String,
      institutionId: r['institution_id'] as String,
      nameKo: r['name_ko'] as String?,
      nameKoShort: r['name_ko_short'] as String?,
      nameEn: r['name_en'] as String?,
      cityKo: r['city_ko'] as String?,
      institutionType: r['institution_type'] as String?,
      univNameEn: r['univ_nomi_en'] as String?,
      univNameKr: r['univ_nomi_kr'] as String?,
      campus: r['kampus'] as String?,
      city: r['shahar'] as String?,
      intakeYear: _num(r['qabul_yili'])?.toInt(),
      semester: r['semestr'] as String?,
      degree: r['daraja'] as String?,
      englishTrack: r['english_track'] as bool?,
      koreanTrack: r['korean_track'] as bool?,
      topikMin: _num(r['topik_min']),
      ieltsMin: _num(r['ielts_min']),
      toeflMin: _num(r['toefl_ibt_min']),
      currency: r['narx_valyuta'] as String?,
      entranceFee: _num(r['kirish_tolovi']),
      tuitionMin: _num(r['kontrakt_min']),
      tuitionMax: _num(r['kontrakt_max']),
      tuitionPeriod: r['kontrakt_davri'] as String?,
      facultyCount: _num(r['fakultet_soni'])?.toInt(),
      applicationFee: _num(r['ariza_tolovi']),
      applicationFeeCurrency: r['ariza_tolovi_valyuta'] as String?,
      bankAmount: _num(r['bank_summa']),
      bankCurrency: r['bank_valyuta'] as String?,
      recommendation: r['tavsiyanoma'] as String?,
    );
  }
}

/// A university in the catalogue: every guideline loaded for it, one per
/// degree (and intake).
@immutable
class CatalogUniversity {
  const CatalogUniversity({required this.institutionId, required this.guidelines});

  final String institutionId;

  /// Newest intake first.
  final List<CatalogGuideline> guidelines;

  CatalogGuideline get primary => forDegree(null)!;

  /// The guideline for [degree], or — for null — the bachelor's one when it
  /// exists, since that is what most students open the catalogue for.
  CatalogGuideline? forDegree(String? degree) {
    if (degree == null) {
      return guidelines.where((g) => g.degree == 'bakalavr').firstOrNull ??
          guidelines.firstOrNull;
    }
    return guidelines.where((g) => g.degree == degree).firstOrNull;
  }

  bool hasDegree(String degree) => guidelines.any((g) => g.degree == degree);

  /// English name as staff wrote it in the Excel, then the catalogue's.
  String get displayName =>
      _firstNonEmpty([primary.univNameEn, primary.nameEn, primary.univNameKr, primary.nameKo]) ??
      '';

  String? get nameKo => _firstNonEmpty([primary.nameKo, primary.univNameKr]);

  /// The short Korean form for the cover ("연세대"), falling back to the full
  /// name.
  String? get nameKoShort =>
      _firstNonEmpty([primary.nameKoShort, primary.nameKo, primary.univNameKr]);

  String? get city => _firstNonEmpty([primary.city, primary.cityKo]);

  static String? _firstNonEmpty(List<String?> xs) {
    for (final x in xs) {
      if (x != null && x.trim().isNotEmpty) return x.trim();
    }
    return null;
  }
}

/// One faculty row from the Excel.
@immutable
class CatalogFaculty {
  const CatalogFaculty({
    required this.order,
    this.track,
    this.collegeEn,
    this.collegeKr,
    this.facultyEn,
    this.facultyKr,
    this.topikMin,
    this.ieltsMin,
    this.toeflMin,
    this.tuition,
    this.tuitionPeriod,
  });

  final int order;
  final String? track;
  final String? collegeEn;
  final String? collegeKr;
  final String? facultyEn;
  final String? facultyKr;
  final num? topikMin;
  final num? ieltsMin;
  final num? toeflMin;
  final num? tuition;
  final String? tuitionPeriod;

  factory CatalogFaculty.fromRow(Map<String, dynamic> r) => CatalogFaculty(
    order: CatalogGuideline._num(r['tartib'])?.toInt() ?? 0,
    track: r['track'] as String?,
    collegeEn: r['kollej_en'] as String?,
    collegeKr: r['kollej_kr'] as String?,
    facultyEn: r['fakultet_en'] as String?,
    facultyKr: r['fakultet_kr'] as String?,
    topikMin: CatalogGuideline._num(r['topik_min']),
    ieltsMin: CatalogGuideline._num(r['ielts_min']),
    toeflMin: CatalogGuideline._num(r['toefl_ibt_min']),
    tuition: CatalogGuideline._num(r['kontrakt_summa']),
    tuitionPeriod: r['kontrakt_davri'] as String?,
  );
}

/// One stage of the admission timeline from the Excel.
@immutable
class CatalogRound {
  const CatalogRound({
    required this.stage,
    required this.step,
    this.name,
    this.startDate,
    this.endDate,
    this.status,
  });

  final int stage;
  final int step;
  final String? name;

  /// YYYY-MM-DD.
  final String? startDate;
  final String? endDate;

  /// 'tasdiqlangan' | 'taxminiy' | 'nisbiy' | 'keyin_elon' | 'etap_yoq'.
  final String? status;

  factory CatalogRound.fromRow(Map<String, dynamic> r) {
    String? date(Object? v) {
      final s = v as String?;
      if (s == null || s.isEmpty) return null;
      return s.length >= 10 ? s.substring(0, 10) : s;
    }

    return CatalogRound(
      stage: CatalogGuideline._num(r['bosqich'])?.toInt() ?? 1,
      step: CatalogGuideline._num(r['etap_raqam'])?.toInt() ?? 0,
      name: r['etap_nomi'] as String?,
      startDate: date(r['boshlanish_sana']),
      endDate: date(r['tugash_sana']),
      status: r['holat'] as String?,
    );
  }
}

/// One required document from the Excel.
@immutable
class CatalogDoc {
  const CatalogDoc({this.name, this.required, this.apostille});

  final String? name;

  /// 'ha' | 'yoq' | 'shartli' ...
  final String? required;
  final String? apostille;

  bool get isRequired => required == 'ha';
  bool get needsApostille => apostille == 'ha';

  factory CatalogDoc.fromRow(Map<String, dynamic> r) => CatalogDoc(
    name: r['hujjat_nomi'] as String?,
    required: r['majburiy'] as String?,
    apostille: r['apostil'] as String?,
  );
}

/// Everything the detail screen shows for one guideline.
@immutable
class CatalogGuidelineDetail {
  const CatalogGuidelineDetail({
    required this.faculties,
    required this.rounds,
    required this.docs,
  });

  final List<CatalogFaculty> faculties;
  final List<CatalogRound> rounds;
  final List<CatalogDoc> docs;

  static const empty = CatalogGuidelineDetail(faculties: [], rounds: [], docs: []);
}
