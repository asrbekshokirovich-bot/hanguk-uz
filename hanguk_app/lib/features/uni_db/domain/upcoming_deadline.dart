/// Row shape from `v_user_upcoming_deadlines` (plan §H.5) and from
/// the institution-scoped query in `institutionDeadlinesProvider`.
class UpcomingDeadline {
  const UpcomingDeadline({
    required this.institutionId,
    required this.nameKo,
    this.nameKoShort,
    this.nameEn,
    required this.eventType,
    required this.startsAt,
    this.endsAt,
    this.isTentative = false,
    this.applicantCategory,
    this.cycleTrack,
    this.notesKo,
  });

  factory UpcomingDeadline.fromMap(Map<String, dynamic> map) =>
      UpcomingDeadline(
        institutionId: map['institution_id'] as String,
        nameKo: map['name_ko'] as String? ?? '',
        nameKoShort: map['name_ko_short'] as String?,
        nameEn: map['name_en'] as String?,
        eventType: map['event_type'] as String? ?? '',
        startsAt: DateTime.parse(map['starts_at'].toString()),
        endsAt: map['ends_at'] != null
            ? DateTime.tryParse(map['ends_at'].toString())
            : null,
        isTentative: (map['is_tentative'] as bool?) ?? false,
        applicantCategory: map['applicant_category'] as String?,
        cycleTrack: map['cycle_track'] as String?,
        notesKo: map['notes_ko'] as String?,
      );

  final String institutionId;
  final String nameKo;
  final String? nameKoShort;
  final String? nameEn;
  final String eventType;
  final DateTime startsAt;
  final DateTime? endsAt;
  final bool isTentative;
  final String? applicantCategory;
  final String? cycleTrack;
  final String? notesKo;

  /// Days from now to startsAt. Negative if already past.
  int get daysUntil {
    final diff = startsAt.difference(DateTime.now());
    return diff.inDays;
  }
}
