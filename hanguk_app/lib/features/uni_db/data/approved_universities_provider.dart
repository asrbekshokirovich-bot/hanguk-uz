import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../map/data/map_repository.dart';
import '../../map/domain/university.dart';

/// What an approved review actually established about one (institution,
/// intake year): the fee, the application window, the language bar.
///
/// Every field is nullable and a null means *the approved review did not
/// provide this value* — not zero, not "no requirement". Extraction covers the
/// fields unevenly (43 of 70 rows carry a document list, 10 carry a fee), so a
/// screen must render a missing field as missing rather than inventing one.
class ApprovedAdmission {
  const ApprovedAdmission({
    required this.intakeYear,
    this.tuitionMinKrw,
    this.tuitionMaxKrw,
    this.tuitionAcademicYear,
    this.applicationStart,
    this.applicationEnd,
    this.documentDeadline,
    this.topikMinLevel,
    this.interviewRequired,
    this.englishAccepted,
    this.requiredDocumentCount = 0,
    this.apostilleRequired,
  });

  final int intakeYear;

  final int? tuitionMinKrw;
  final int? tuitionMaxKrw;

  /// The year the fee belongs to. Korean guidelines quote the CURRENT year's
  /// fees as a reference, so a 2027 모집요강 carries a table stamped 2026 —
  /// every fee in the catalogue today is 2026 while most intakes are 2027. The
  /// card says which year rather than letting last year's figure pass as the
  /// intake's.
  final int? tuitionAcademicYear;

  final String? applicationStart; // YYYY-MM-DD
  final String? applicationEnd;
  final String? documentDeadline;

  /// The FLOOR across this year's tracks — a student wants the lowest bar that
  /// gets them in, not the highest.
  final int? topikMinLevel;

  final bool? interviewRequired;

  /// An English test is named somewhere in this year's requirements. Not a
  /// promise that English alone suffices — no column states that.
  final bool? englishAccepted;

  /// DISTINCT required document types, not rows: the source stores one row per
  /// (applicant category, document), so a raw count reads as a longer list
  /// than a student actually assembles.
  final int requiredDocumentCount;

  final bool? apostilleRequired;

  /// True when the fee on show is not the intake year's own.
  bool get tuitionIsFromAnotherYear =>
      tuitionAcademicYear != null && tuitionAcademicYear != intakeYear;

  factory ApprovedAdmission.fromRow(Map<String, dynamic> r) {
    String? date(Object? v) {
      final s = v as String?;
      if (s == null || s.isEmpty) return null;
      // The view returns `date`, which PostgREST renders as YYYY-MM-DD; keep
      // only that much if the column is ever widened to a timestamp.
      return s.length >= 10 ? s.substring(0, 10) : s;
    }

    return ApprovedAdmission(
      intakeYear: (r['intake_year'] as num?)?.toInt() ?? 0,
      tuitionMinKrw: (r['tuition_min_krw'] as num?)?.toInt(),
      tuitionMaxKrw: (r['tuition_max_krw'] as num?)?.toInt(),
      tuitionAcademicYear: (r['tuition_academic_year'] as num?)?.toInt(),
      applicationStart: date(r['application_start']),
      applicationEnd: date(r['application_end']),
      documentDeadline: date(r['document_deadline']),
      topikMinLevel: (r['topik_min_level'] as num?)?.toInt(),
      interviewRequired: r['interview_required'] as bool?,
      englishAccepted: r['english_accepted'] as bool?,
      requiredDocumentCount:
          (r['required_document_count'] as num?)?.toInt() ?? 0,
      apostilleRequired: r['apostille_required'] as bool?,
    );
  }
}

/// The approved catalogue: the institutions to list, and what the review
/// established about each.
class ApprovedCatalogue {
  const ApprovedCatalogue({required this.universities, required this.details});

  final List<University> universities;

  /// institution id → the detail for its most recent approved intake year.
  ///
  /// Where an institution is approved for both 2026 and 2027 the newer year
  /// wins: a student reading today wants the intake still open to them.
  final Map<String, ApprovedAdmission> details;

  static const empty = ApprovedCatalogue(universities: [], details: {});
}

/// The institutions whose admission data the review queue has actually
/// approved — the only ones any "the universities we have researched" list
/// should show.
///
/// One definition, read live from `v_guest_approved_admissions`, so Explore
/// and the Applications browse list can never disagree and no one maintains a
/// list by hand: a guideline approved today joins on the next refresh.
///
/// Why not `University.hasIntakeData`, which Explore used before: that flag is
/// true when a non-superseded admission cycle exists for the CRM's *default*
/// intake, which is neither "approved" nor complete. It counts a cycle that
/// carries no extracted field at all — a card of dashes — and drops an
/// institution approved for a year that is not the default one. Against this
/// catalogue it answers 45 where the approved set is 57.
///
/// Why not filter the map list by approved ids: `v_institutions_for_map` gates
/// on `is_visible_on_map`, false for 10 institutions that do have approved
/// data. Filtering would silently lose them, which is the bug the sibling app
/// fixed by reading this view directly. So the map rows are used where they
/// exist — they carry coordinates and the tour fields — and the remaining 10
/// are built from the view's own display columns.
final approvedCatalogueProvider = FutureProvider<ApprovedCatalogue>((
  ref,
) async {
  // The map rows first: they are the richer record, and this provider is
  // already cached for the map and every other list in the app.
  final onMap = await ref.watch(universitiesProvider.future);
  final byId = {for (final u in onMap) u.id: u};

  try {
    final data = await Supabase.instance.client
        .from('v_guest_approved_admissions')
        .select(
          'institution_id, intake_year, '
          'name_ko, name_ko_short, name_en, name_uz, '
          'city_ko, tier, ieqas_status, is_partner, logo_url, primary_domain, '
          'tuition_academic_year, tuition_min_krw, tuition_max_krw, '
          'application_start, application_end, document_deadline, '
          'topik_min_level, interview_required, english_accepted, '
          'required_document_count, apostille_required',
        )
        // Ascending, so the fold below can let each later row for the same
        // institution overwrite the earlier one and leave the newest year.
        .order('intake_year', ascending: true)
        // Weak-network guard: fail (→ Retry) instead of an endless spinner,
        // matching universitiesProvider.
        .timeout(const Duration(seconds: 20));

    return mergeApprovedRows(data as List, byId);
  } on PostgrestException catch (e) {
    debugPrint('[ApprovedUniversities] Postgrest error: ${e.code} ${e.message}');
    rethrow;
  } on Exception catch (e) {
    debugPrint('[ApprovedUniversities] Failed to load: $e');
    rethrow;
  }
});

/// Just the list, for the screens that render one.
///
/// A derived provider rather than a second query: Explore, the Applications
/// browse list and Compare all resolve from the one fetch.
final approvedUniversitiesProvider = FutureProvider<List<University>>((
  ref,
) async => (await ref.watch(approvedCatalogueProvider.future)).universities);

/// Turn view rows into what the screens render: one entry per institution, the
/// map's record where there is one, sorted the way every other list in the app
/// is sorted, plus the admission detail for each.
///
/// Split out from the provider so it can be tested against real row shapes
/// without a backend — the network call is the only part that needs one.
@visibleForTesting
ApprovedCatalogue mergeApprovedRows(
  List<dynamic> rows,
  Map<String, University> byId,
) {
  // The view is one row per (institution, intake year), so an institution
  // approved for both 2026 and 2027 arrives twice. The list takes the first
  // occurrence; the detail takes the LAST, which under the provider's
  // ascending order is the newest intake year — the one still open to a
  // student reading today.
  final seen = <String>{};
  final approved = <University>[];
  final details = <String, ApprovedAdmission>{};
  for (final row in rows) {
    final map = row as Map<String, dynamic>;
    final id = map['institution_id'] as String?;
    if (id == null) continue;
    if (seen.add(id)) approved.add(byId[id] ?? _fromViewRow(id, map));
    details[id] = ApprovedAdmission.fromRow(map);
  }

  // Top tier first, then by name — the order the map provider already sorts
  // by, so a student reading two screens sees one order. Unclassified (null)
  // tiers sort last rather than leading the list.
  approved.sort((a, b) {
    final at = a.tier ?? 99;
    final bt = b.tier ?? 99;
    return at != bt ? at.compareTo(bt) : a.name.compareTo(b.name);
  });
  return ApprovedCatalogue(universities: approved, details: details);
}

/// Build the catalogue entry for an approved institution the map view does not
/// carry. Name resolution mirrors `map_repository` exactly — en → uz → ko_short
/// → ko, and its 'South Korea' stand-in for a missing city — so a tile built
/// here reads the same as one built there.
///
/// No coordinates: this institution is absent from the map view, so there are
/// none to have. Nothing that needs them puts these rows on a map.
University _fromViewRow(String id, Map<String, dynamic> map) {
  final nameEn = map['name_en'] as String?;
  final nameUz = map['name_uz'] as String?;
  final nameKoShort = map['name_ko_short'] as String?;
  final nameKo = map['name_ko'] as String?;
  final cityKo = map['city_ko'] as String?;

  return University(
    id: id,
    name: (nameEn?.isNotEmpty ?? false)
        ? nameEn!
        : (nameUz?.isNotEmpty ?? false)
        ? nameUz!
        : (nameKoShort?.isNotEmpty ?? false)
        ? nameKoShort!
        : nameKo ?? 'Unknown Institution',
    location: (cityKo?.isNotEmpty ?? false) ? cityKo! : University.unknownCity,
    nameKo: nameKo,
    nameKoShort: nameKoShort,
    nameEn: nameEn,
    nameUz: nameUz,
    logoUrl: map['logo_url'] as String?,
    tier: (map['tier'] as num?)?.toInt(),
    ieqasStatus: map['ieqas_status'] as String?,
    isPartner: map['is_partner'] as bool? ?? false,
    isVisibleOnMap: false,
    primaryDomain: map['primary_domain'] as String?,
    // It is in the approved view; that is what the flag means to every list
    // reading this provider.
    hasIntakeData: true,
  );
}
