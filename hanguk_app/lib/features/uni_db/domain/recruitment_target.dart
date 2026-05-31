/// Row shape from `v_recruitment_for_interview` (plan §H.4).
///
/// Used by the `university_specific` interview path so the
/// interviewer prompt can be seeded with real recruitment data instead
/// of falling back to generic questions.
class RecruitmentTarget {
  const RecruitmentTarget({
    required this.institutionId,
    required this.nameKo,
    this.nameEn,
    required this.recruitmentUnitId,
    this.facultyKo,
    this.departmentKo,
    this.majorTrackKo,
    this.facultyGroup,
    required this.cycleId,
    required this.intakeYear,
    required this.intakeTerm,
    required this.cycleTrack,
    this.applicantCategory,
    this.upcomingEvents,
    this.topScholarships,
    this.requirementsSummary,
  });

  factory RecruitmentTarget.fromMap(Map<String, dynamic> map) =>
      RecruitmentTarget(
        institutionId: map['institution_id'] as String,
        nameKo: map['name_ko'] as String? ?? '',
        nameEn: map['name_en'] as String?,
        recruitmentUnitId: map['recruitment_unit_id'] as String,
        facultyKo: map['faculty_ko'] as String?,
        departmentKo: map['department_ko'] as String?,
        majorTrackKo: map['major_track_ko'] as String?,
        facultyGroup: map['faculty_group'] as String?,
        cycleId: map['cycle_id'] as String,
        intakeYear: (map['intake_year'] as num).toInt(),
        intakeTerm: map['intake_term'] as String? ?? 'fall',
        cycleTrack: map['cycle_track'] as String? ?? 'foreign',
        applicantCategory: map['applicant_category'] as String?,
        upcomingEvents: map['upcoming_events'] as List<dynamic>?,
        topScholarships: map['top_scholarships'] as List<dynamic>?,
        requirementsSummary:
            map['requirements_summary'] as Map<String, dynamic>?,
      );

  final String institutionId;
  final String nameKo;
  final String? nameEn;
  final String recruitmentUnitId;
  final String? facultyKo;
  final String? departmentKo;
  final String? majorTrackKo;
  final String? facultyGroup;
  final String cycleId;
  final int intakeYear;
  final String intakeTerm;
  final String cycleTrack;
  final String? applicantCategory;
  final List<dynamic>? upcomingEvents;
  final List<dynamic>? topScholarships;
  final Map<String, dynamic>? requirementsSummary;
}
