/// One scholarship row from `public.scholarships` (uni_db shape, not
/// the legacy Lovable shape that was renamed to legacy_scholarships).
class ScholarshipRow {
  const ScholarshipRow({
    required this.id,
    required this.scope,
    required this.nameKo,
    this.nameEn,
    required this.awardType,
    this.awardValue,
    this.applicantCategories,
    this.topikTierTable,
    this.proseKo,
    this.extractorConfidence,
  });

  factory ScholarshipRow.fromMap(Map<String, dynamic> map) => ScholarshipRow(
    id: map['id'] as String,
    scope: (map['scope'] as String?) ?? 'university',
    nameKo: (map['name_ko'] as String?) ?? '',
    nameEn: map['name_en'] as String?,
    awardType: (map['award_type'] as String?) ?? '',
    awardValue: (map['award_value'] as num?)?.toDouble(),
    applicantCategories: (map['applicant_categories'] as List?)?.cast<String>(),
    topikTierTable: (map['topik_tier_table'] as Map?)?.cast<String, dynamic>(),
    proseKo: map['prose_ko'] as String?,
    extractorConfidence: (map['extractor_confidence'] as num?)?.toDouble(),
  );

  final String id;
  final String
  scope; // 'national' | 'university' | 'department' | 'foundation' | 'regional'
  final String nameKo;
  final String? nameEn;
  final String
  awardType; // 'tuition_waiver_pct' | 'tuition_waiver_krw' | 'stipend_monthly' | 'airfare' | 'other'
  final double? awardValue;
  final List<String>? applicantCategories;
  final Map<String, dynamic>?
  topikTierTable; // e.g. {'4': 50, '5': 70, '6': 100}
  final String? proseKo;
  final double? extractorConfidence;

  /// e.g. "tuition 50% waiver", "₩300,000/mo stipend", "airfare ₩800,000"
  String get awardLabel {
    final v = awardValue;
    return switch (awardType) {
      'tuition_waiver_pct' =>
        v != null
            ? 'tuition ${v.toStringAsFixed(0)}% waiver'
            : 'tuition waiver',
      'tuition_waiver_krw' =>
        v != null
            ? 'tuition ₩${_thousands(v.round())} waiver'
            : 'tuition waiver',
      'stipend_monthly' =>
        v != null ? '₩${_thousands(v.round())}/mo stipend' : 'monthly stipend',
      'airfare' => v != null ? 'airfare ₩${_thousands(v.round())}' : 'airfare',
      _ => awardType,
    };
  }

  static String _thousands(int n) {
    final s = n.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}
