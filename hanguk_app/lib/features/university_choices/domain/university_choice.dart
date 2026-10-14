/// One university the consultant offered the student (the CRM's
/// "Universitet tanlash" page): two picked by staff and the third a partner
/// university. The student answers "Roziman" or "O'zgartirish so'rayman";
/// staff then give the final confirmation.
enum UniversityChoiceStatus { offered, accepted, changeRequested, confirmed }

UniversityChoiceStatus parseChoiceStatus(String? raw) => switch (raw) {
  'accepted' => UniversityChoiceStatus.accepted,
  'change_requested' => UniversityChoiceStatus.changeRequested,
  'confirmed' => UniversityChoiceStatus.confirmed,
  _ => UniversityChoiceStatus.offered,
};

/// The reason codes sent with "O'zgartirish so'rayman" — the CRM shows them
/// as text (CHANGE_REASON_LABELS in src/hooks/useUniversityChoices.ts).
enum ChangeReason { city, price, major, other }

/// Whether the student's IELTS / TOPIK meets the university's minimum; a
/// university accepts either track.
enum LanguageFit { ok, gap, unknown }

class UniversityChoice {
  const UniversityChoice({
    required this.id,
    required this.rank,
    required this.status,
    required this.name,
    this.nameKo,
    this.city,
    this.isPartner = false,
    this.ieltsMin,
    this.topikMin,
    this.contractMin,
    this.currency,
    this.onlineDeadline,
    this.studentIelts,
    this.studentTopik,
  });

  final String id;
  final int rank;
  final UniversityChoiceStatus status;
  final String name;
  final String? nameKo;
  final String? city;
  final bool isPartner;
  final double? ieltsMin;
  final double? topikMin;
  final double? contractMin;
  final String? currency;
  final DateTime? onlineDeadline;
  final double? studentIelts;
  final double? studentTopik;

  /// The student can still answer until staff confirm.
  bool get canAnswer => status == UniversityChoiceStatus.offered;

  LanguageFit get fit {
    if (ieltsMin == null && topikMin == null) return LanguageFit.unknown;
    if (studentIelts == null && studentTopik == null) return LanguageFit.unknown;
    if (ieltsMin != null && studentIelts != null && studentIelts! >= ieltsMin!) return LanguageFit.ok;
    if (topikMin != null && studentTopik != null && studentTopik! >= topikMin!) return LanguageFit.ok;
    return LanguageFit.gap;
  }

  static double? _num(Object? v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));

  factory UniversityChoice.fromJson(Map<String, dynamic> j) {
    final en = (j['name_en'] as String?)?.trim();
    final ko = (j['name_ko'] as String?)?.trim();
    final deadline = j['online_deadline'] as String?;
    return UniversityChoice(
      id: j['id'] as String,
      rank: (j['rank'] as num).toInt(),
      status: parseChoiceStatus(j['status'] as String?),
      name: (en != null && en.isNotEmpty) ? en : (ko ?? ''),
      nameKo: ko,
      city: (j['city'] as String?)?.trim(),
      isPartner: j['is_partner'] == true,
      ieltsMin: _num(j['ielts_min']),
      topikMin: _num(j['topik_min']),
      contractMin: _num(j['kontrakt_min']),
      currency: j['narx_valyuta'] as String?,
      onlineDeadline: deadline == null ? null : DateTime.tryParse(deadline),
      studentIelts: _num(j['student_ielts']),
      studentTopik: _num(j['student_topik']),
    );
  }
}
