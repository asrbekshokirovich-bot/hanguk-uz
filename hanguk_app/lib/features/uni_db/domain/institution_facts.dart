import 'scholarship_row.dart';

/// The decision-driving facts for one institution, reduced from the uni_db
/// tables that back `/institutions/:id`.
///
/// The detail screen queries `tuition`, `requirements`, `scholarships`,
/// `cycle_dates` and `documents_required` one institution at a time — five
/// round trips per university, which is fine for a single page but not for a
/// side-by-side comparison of three. [InstitutionFacts] is the flattened
/// shape the compare grid and the map sheet render: one object per
/// institution, built from five *bulk* queries in
/// `compareFactsProvider`.
///
/// Every field is nullable or zero-valued on purpose. The crawl publishes a
/// university's rows as its guideline PDF is parsed and reviewed, so a real
/// institution can legitimately have a tier and a campus location but no
/// tuition yet. The UI renders those as "not published yet" rather than
/// inventing a number — see [hasAnyData].
///
/// Pure data — no Flutter imports — matching the other files in `domain/`.
class InstitutionFacts {
  const InstitutionFacts({
    required this.institutionId,
    this.academicYear,
    this.tuitionMinKrw,
    this.tuitionMaxKrw,
    this.admissionFeeKrw,
    this.topikMinLevel,
    this.topikDeferred = false,
    this.englishTestLabel,
    this.gpaFloorPct,
    this.interviewRequired = false,
    this.hasRequirementsRow = false,
    this.nextDeadlineEvent,
    this.nextDeadlineAt,
    this.nextDeadlineIsTentative = false,
    this.scholarshipCount = 0,
    this.bestScholarship,
    this.documentCount = 0,
  });

  /// Empty facts for an institution the bulk queries returned nothing for.
  const InstitutionFacts.empty(this.institutionId)
    : academicYear = null,
      tuitionMinKrw = null,
      tuitionMaxKrw = null,
      admissionFeeKrw = null,
      topikMinLevel = null,
      topikDeferred = false,
      englishTestLabel = null,
      gpaFloorPct = null,
      interviewRequired = false,
      hasRequirementsRow = false,
      nextDeadlineEvent = null,
      nextDeadlineAt = null,
      nextDeadlineIsTentative = false,
      scholarshipCount = 0,
      bestScholarship = null,
      documentCount = 0;

  final String institutionId;

  // ── Tuition ─────────────────────────────────────────────────────────────
  /// The most recent `academic_year` the institution has tuition rows for.
  /// The min/max below are drawn from that year only, so a stale 2024 row
  /// never widens the range shown for 2026.
  final int? academicYear;

  /// Per-semester tuition spread across faculty groups for [academicYear].
  /// Equal values mean the institution charges one flat rate.
  final int? tuitionMinKrw;
  final int? tuitionMaxKrw;

  /// One-off admission fee (입학금), when the guideline states one.
  final int? admissionFeeKrw;

  // ── Requirements ────────────────────────────────────────────────────────
  /// The *lowest* TOPIK level accepted on any verified track — the honest
  /// answer to "can I get in with what I have", since a university with a
  /// TOPIK 3 track and a TOPIK 5 track is open to a level-3 applicant.
  final int? topikMinLevel;

  /// Whether at least one track lets the applicant submit TOPIK after
  /// admission.
  final bool topikDeferred;

  /// e.g. "TOEFL iBT 80", from the first track that names an English test.
  final String? englishTestLabel;

  /// Lowest GPA floor across tracks, as a percentage.
  final double? gpaFloorPct;

  /// Whether any verified track requires an interview.
  final bool interviewRequired;

  /// Whether the institution has *any* verified requirements row at all.
  /// Distinguishes "no interview required" from "we don't know yet" — both
  /// leave [interviewRequired] false.
  final bool hasRequirementsRow;

  // ── Calendar ────────────────────────────────────────────────────────────
  /// The soonest future `cycle_dates` event, as a raw `event_type` the UI
  /// localizes through `eventLabel`.
  final String? nextDeadlineEvent;
  final DateTime? nextDeadlineAt;
  final bool nextDeadlineIsTentative;

  // ── Money in ────────────────────────────────────────────────────────────
  final int scholarshipCount;

  /// Highest-value scholarship, national scope first — the query orders by
  /// `scope` then `award_value desc`, and this is that first row.
  final ScholarshipRow? bestScholarship;

  // ── Paperwork ───────────────────────────────────────────────────────────
  final int documentCount;

  bool get hasTuition => tuitionMinKrw != null;

  /// True when tuition varies by faculty group, so the UI shows a range
  /// rather than a single figure.
  bool get tuitionIsRange =>
      tuitionMinKrw != null &&
      tuitionMaxKrw != null &&
      tuitionMaxKrw != tuitionMinKrw;

  /// Whether anything at all has been published for this institution. When
  /// false the compare column shows a single "not published yet" note
  /// instead of a stack of em dashes.
  bool get hasAnyData =>
      hasTuition ||
      hasRequirementsRow ||
      nextDeadlineAt != null ||
      scholarshipCount > 0 ||
      documentCount > 0;

  /// "₩3,200,000" or "₩3,200,000–5,100,000", per semester, for
  /// [academicYear]. Null when no tuition is published.
  String? get tuitionLabel {
    final min = tuitionMinKrw;
    if (min == null) return null;
    if (!tuitionIsRange) return formatKrw(min);
    return '${formatKrw(min)}–${thousands(tuitionMaxKrw!)}';
  }

  /// "TOPIK 3+" / "TOPIK 3+ (deferred allowed)". Null when no track names a
  /// TOPIK minimum — which is *not* the same as "no Korean needed", so the
  /// UI must not render that as a zero.
  String? get topikLabel {
    final level = topikMinLevel;
    if (level == null) return null;
    return 'TOPIK $level+';
  }
}

/// `1234567` → `"1,234,567"`.
String thousands(int n) {
  final negative = n < 0;
  final digits = n.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write(',');
    buf.write(digits[i]);
  }
  return negative ? '-$buf' : buf.toString();
}

/// `3200000` → `"₩3,200,000"`.
String formatKrw(int amount) => '₩${thousands(amount)}';
