/// One per-faculty per-semester tuition row from `public.tuition`.
class TuitionRow {
  const TuitionRow({
    required this.id,
    required this.facultyGroup,
    required this.academicYear,
    required this.semesterNumber,
    required this.amountKrw,
    this.admissionFeeKrw,
    required this.isFirstSemester,
    this.extractorConfidence,
  });

  factory TuitionRow.fromMap(Map<String, dynamic> map) => TuitionRow(
    id: map['id'] as String,
    facultyGroup: (map['faculty_group'] as String?) ?? '',
    academicYear: (map['academic_year'] as num?)?.toInt() ?? 0,
    semesterNumber: (map['semester_number'] as num?)?.toInt() ?? 0,
    amountKrw: (map['amount_krw'] as num?)?.toInt() ?? 0,
    admissionFeeKrw: (map['admission_fee_krw'] as num?)?.toInt(),
    isFirstSemester: (map['is_first_semester'] as bool?) ?? false,
    extractorConfidence: (map['extractor_confidence'] as num?)?.toDouble(),
  );

  final String id;
  final String facultyGroup;
  final int academicYear;
  final int semesterNumber;
  final int amountKrw;
  final int? admissionFeeKrw;
  final bool isFirstSemester;
  final double? extractorConfidence;
}
