/// One university the consultant offered the student (the CRM's
/// "Universitet tanlash" page): two picked by staff and the third a partner
/// university. The student answers "Roziman" or "O'zgartirish so'rayman" on
/// the two staff picks; the partner slot needs no answer. Staff then give the
/// final confirmation.
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

/// The university's answer, set by staff on the CRM's results map; null while
/// it is still awaited.
enum AdmissionOutcome { accepted, rejected }

AdmissionOutcome? parseAdmissionOutcome(String? raw) => switch (raw) {
  'accepted' => AdmissionOutcome.accepted,
  'rejected' => AdmissionOutcome.rejected,
  _ => null,
};

/// Whether the student's IELTS / TOPIK meets the university's minimum; a
/// university accepts either track.
enum LanguageFit { ok, gap, unknown }

class UniversityChoice {
  const UniversityChoice({
    required this.id,
    required this.rank,
    required this.status,
    required this.name,
    this.institutionId = '',
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
    this.outcome,
    this.isFinal = false,
    this.finalConfirmed = false,
  });

  final String id;
  final int rank;
  final UniversityChoiceStatus status;
  final String name;
  final String institutionId;
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

  /// The admission result, once staff record it.
  final AdmissionOutcome? outcome;

  /// Staff picked this as the student's final university …
  final bool isFinal;

  /// … and the student confirmed it ("Shu universitetga boraman").
  final bool finalConfirmed;

  bool get needsFinalConfirm => isFinal && !finalConfirmed;

  /// The same choice with its admission result from `my_admission_results()`.
  UniversityChoice withResult(Map<String, dynamic>? r) => r == null
      ? this
      : UniversityChoice(
          id: id,
          rank: rank,
          status: status,
          name: name,
          institutionId: institutionId,
          nameKo: nameKo,
          city: city,
          isPartner: isPartner,
          ieltsMin: ieltsMin,
          topikMin: topikMin,
          contractMin: contractMin,
          currency: currency,
          onlineDeadline: onlineDeadline,
          studentIelts: studentIelts,
          studentTopik: studentTopik,
          outcome: parseAdmissionOutcome(r['result'] as String?),
          isFinal: r['is_final'] == true,
          finalConfirmed: r['student_confirmed_at'] != null,
        );

  /// Rank of the partner-university slot (PARTNER_RANK in the CRM).
  static const partnerRank = 3;

  /// The third choice is the partner university staff attach themselves.
  bool get isPartnerSlot => rank == partnerRank;

  /// The student answers the two staff picks until staff confirm; the
  /// partner slot is never theirs to answer.
  bool get canAnswer => status == UniversityChoiceStatus.offered && !isPartnerSlot;

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
      institutionId: (j['institution_id'] as String?) ?? '',
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
