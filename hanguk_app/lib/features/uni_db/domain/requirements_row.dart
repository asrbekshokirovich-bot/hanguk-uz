/// Admission requirements for one applicant_category in a cycle.
class RequirementsRow {
  const RequirementsRow({
    required this.id,
    required this.applicantCategory,
    this.topikMinLevel,
    required this.topikDeferred,
    this.englishTest,
    this.gpaFloorPct,
    required this.interviewRequired,
    required this.practicalExamRequired,
    this.proseKo,
    this.extractorConfidence,
  });

  factory RequirementsRow.fromMap(Map<String, dynamic> map) => RequirementsRow(
    id: map['id'] as String,
    applicantCategory: (map['applicant_category'] as String?) ?? '',
    topikMinLevel: (map['topik_min_level'] as num?)?.toInt(),
    topikDeferred: (map['topik_deferred'] as bool?) ?? false,
    englishTest: (map['english_test'] as Map?)?.cast<String, dynamic>(),
    gpaFloorPct: (map['gpa_floor_pct'] as num?)?.toDouble(),
    interviewRequired: (map['interview_required'] as bool?) ?? false,
    practicalExamRequired: (map['practical_exam_required'] as bool?) ?? false,
    proseKo: map['prose_ko'] as String?,
    extractorConfidence: (map['extractor_confidence'] as num?)?.toDouble(),
  );

  final String id;
  final String applicantCategory;
  final int? topikMinLevel;
  final bool topikDeferred;
  final Map<String, dynamic>? englishTest;
  final double? gpaFloorPct;
  final bool interviewRequired;
  final bool practicalExamRequired;
  final String? proseKo;
  final double? extractorConfidence;

  /// e.g. "TOPIK 4+ (deferred allowed)" or "TOPIK 5+"
  String? get topikLabel {
    if (topikMinLevel == null) return null;
    final base = 'TOPIK $topikMinLevel+';
    return topikDeferred ? '$base (deferred allowed)' : base;
  }

  /// e.g. "TOEFL iBT 80" — pulled from the english_test jsonb if present.
  String? get englishTestLabel {
    final t = englishTest;
    if (t == null || t.isEmpty) return null;
    final type = t['type'] as String?;
    final score = t['min_score'] ?? t['score'] ?? t['minimum'];
    if (type == null) return null;
    return score == null ? type : '$type $score';
  }
}
