import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/feature_flags/uni_db_flag.dart';
import '../domain/document_requirement_row.dart';
import '../domain/institution_facts.dart';
import '../domain/institution_summary.dart';
import '../domain/recruitment_target.dart';
import '../domain/requirements_row.dart';
import '../domain/scholarship_row.dart';
import '../domain/tuition_row.dart';
import '../domain/upcoming_deadline.dart';

/// Read-only Riverpod providers backed by the new uni_db views (plan §H).
///
/// Every provider short-circuits to an empty result when [kUniDbEnabled]
/// is false, so the production app behaves exactly as before until the
/// flag flips.
///
/// All reads target views, never raw tables, per plan §H.1 stable contract.

/// Institution detail — `/institutions/:id` route.
final institutionDetailProvider =
    FutureProvider.family<InstitutionSummary?, String>((ref, id) async {
      if (!kUniDbEnabled) return null;
      final client = Supabase.instance.client;
      final row = await client
          .from('v_institutions_for_map')
          .select()
          .eq('id', id)
          .maybeSingle();
      if (row == null) return null;
      return InstitutionSummary.fromMap(row);
    });

/// Institution comparison — `/institutions/compare?ids=a,b,c`.
///
/// Keyed by the raw comma-separated id string rather than a `List<String>`
/// on purpose: a Riverpod family looks its argument up with `==`, and two
/// equal lists are never `==`, so a list key silently creates a fresh
/// provider (and a fresh network request) on every rebuild that rebuilt the
/// list. A `String` key has value equality, so the result caches properly.
/// Use [parseInstitutionIds] to split it.
final compareInstitutionsProvider =
    FutureProvider.family<List<InstitutionSummary>, String>((
      ref,
      idsCsv,
    ) async {
      final ids = parseInstitutionIds(idsCsv);
      if (!kUniDbEnabled || ids.isEmpty) return const [];
      final client = Supabase.instance.client;
      final rows = await client
          .from('v_institutions_for_map')
          .select()
          .inFilter('id', ids);
      final byId = <String, InstitutionSummary>{};
      for (final r in rows as List) {
        final summary = InstitutionSummary.fromMap(r as Map<String, dynamic>);
        byId[summary.id] = summary;
      }
      // Preserve the order the student picked the institutions in — the
      // `in.(...)` filter returns rows in whatever order Postgres chooses,
      // and a comparison whose columns reshuffle between loads is confusing.
      return [
        for (final id in ids)
          if (byId[id] != null) byId[id]!,
      ];
    });

/// Splits the `ids` query parameter of `/institutions/compare` into ids,
/// dropping blanks and duplicates while preserving order.
List<String> parseInstitutionIds(String idsCsv) {
  final seen = <String>{};
  return [
    for (final part in idsCsv.split(','))
      if (part.trim().isNotEmpty && seen.add(part.trim())) part.trim(),
  ];
}

/// The comparable facts (tuition, TOPIK, next deadline, scholarships,
/// paperwork) for a set of institutions, keyed by institution id.
///
/// The per-institution providers below each fetch one institution's rows,
/// which the detail screen uses five times over for a single university. A
/// comparison of three would be fifteen round trips, so this provider issues
/// **five bulk queries** filtered with `in.(...)` and reduces the rows into
/// one [InstitutionFacts] per id.
///
/// Institutions the queries return no rows for still get a map entry — an
/// [InstitutionFacts.empty] — so the compare grid can tell "nothing
/// published yet" apart from "id not in the result".
///
/// Reads `requirements` / `documents_required` through their `admission_cycles`
/// parent with `status = 'verified'`, matching
/// [institutionRequirementsProvider]: an unreviewed extraction must never
/// reach a student as a fact.
///
/// Keyed by comma-separated ids for the same cache-correctness reason as
/// [compareInstitutionsProvider].
final compareFactsProvider =
    FutureProvider.family<Map<String, InstitutionFacts>, String>((
      ref,
      idsCsv,
    ) async {
      final ids = parseInstitutionIds(idsCsv);
      if (!kUniDbEnabled || ids.isEmpty) return const {};
      final client = Supabase.instance.client;
      final nowIso = DateTime.now().toIso8601String();

      // Five requests in flight at once. `Future.wait<dynamic>` because each
      // builder resolves to its own row shape; every result is cast below.
      final results = await Future.wait<dynamic>([
        client
            .from('tuition')
            .select(
              'institution_id, academic_year, amount_krw, admission_fee_krw',
            )
            .inFilter('institution_id', ids),
        client
            .from('requirements')
            .select(
              'topik_min_level, topik_deferred, english_test, gpa_floor_pct, '
              'interview_required, '
              'admission_cycles!inner(institution_id, status)',
            )
            .inFilter('admission_cycles.institution_id', ids)
            .eq('admission_cycles.status', 'verified'),
        client
            .from('scholarships')
            .select()
            .inFilter('institution_id', ids)
            .order('scope')
            .order('award_value', ascending: false, nullsFirst: false),
        client
            .from('cycle_dates')
            .select(
              'event_type, starts_at, is_tentative, '
              'admission_cycles!inner(institution_id)',
            )
            .inFilter('admission_cycles.institution_id', ids)
            .gte('starts_at', nowIso)
            .order('starts_at'),
        client
            .from('documents_required')
            .select('id, admission_cycles!inner(institution_id, status)')
            .inFilter('admission_cycles.institution_id', ids)
            .eq('admission_cycles.status', 'verified'),
      ]);

      final tuitionRows = (results[0] as List).cast<Map<String, dynamic>>();
      final requirementRows = (results[1] as List).cast<Map<String, dynamic>>();
      final scholarshipRows = (results[2] as List).cast<Map<String, dynamic>>();
      final deadlineRows = (results[3] as List).cast<Map<String, dynamic>>();
      final documentRows = (results[4] as List).cast<Map<String, dynamic>>();

      // ── Tuition: newest academic_year per institution wins ──────────────
      final latestYear = <String, int>{};
      for (final row in tuitionRows) {
        final id = row['institution_id'] as String?;
        final year = (row['academic_year'] as num?)?.toInt();
        if (id == null || year == null) continue;
        final current = latestYear[id];
        if (current == null || year > current) latestYear[id] = year;
      }

      final tuitionMin = <String, int>{};
      final tuitionMax = <String, int>{};
      final admissionFee = <String, int>{};
      for (final row in tuitionRows) {
        final id = row['institution_id'] as String?;
        if (id == null) continue;
        final year = (row['academic_year'] as num?)?.toInt();
        if (year != latestYear[id]) continue;
        final amount = (row['amount_krw'] as num?)?.toInt();
        if (amount != null && amount > 0) {
          final min = tuitionMin[id];
          final max = tuitionMax[id];
          if (min == null || amount < min) tuitionMin[id] = amount;
          if (max == null || amount > max) tuitionMax[id] = amount;
        }
        final fee = (row['admission_fee_krw'] as num?)?.toInt();
        if (fee != null && fee > 0) {
          final current = admissionFee[id];
          if (current == null || fee > current) admissionFee[id] = fee;
        }
      }

      // ── Requirements: the most permissive value across verified tracks ──
      // A university with a TOPIK 3 track and a TOPIK 5 track is open to a
      // level-3 applicant, so the minimum is the honest headline. Interview
      // is the opposite: any track requiring one means "prepare for one".
      final topikMin = <String, int>{};
      final topikDeferred = <String, bool>{};
      final englishTest = <String, String>{};
      final gpaFloor = <String, double>{};
      final interview = <String, bool>{};
      final hasRequirements = <String, bool>{};
      for (final row in requirementRows) {
        final cycle = row['admission_cycles'] as Map<String, dynamic>?;
        final id = cycle?['institution_id'] as String?;
        if (id == null) continue;
        hasRequirements[id] = true;

        final topik = (row['topik_min_level'] as num?)?.toInt();
        if (topik != null) {
          final current = topikMin[id];
          if (current == null || topik < current) topikMin[id] = topik;
        }
        if ((row['topik_deferred'] as bool?) ?? false) {
          topikDeferred[id] = true;
        }
        if ((row['interview_required'] as bool?) ?? false) {
          interview[id] = true;
        }
        final gpa = (row['gpa_floor_pct'] as num?)?.toDouble();
        if (gpa != null) {
          final current = gpaFloor[id];
          if (current == null || gpa < current) gpaFloor[id] = gpa;
        }
        if (!englishTest.containsKey(id)) {
          final label = _englishTestLabel(row['english_test']);
          if (label != null) englishTest[id] = label;
        }
      }

      // ── Scholarships: count + the first row, which the query already
      // ordered national-scope-first then by descending award value. ───────
      final scholarshipCount = <String, int>{};
      final bestScholarship = <String, ScholarshipRow>{};
      for (final row in scholarshipRows) {
        final id = row['institution_id'] as String?;
        if (id == null) continue;
        scholarshipCount[id] = (scholarshipCount[id] ?? 0) + 1;
        bestScholarship.putIfAbsent(id, () => ScholarshipRow.fromMap(row));
      }

      // ── Calendar: rows arrive ordered by starts_at, so the first hit per
      // institution is the soonest one. ───────────────────────────────────
      final nextEvent = <String, Map<String, dynamic>>{};
      for (final row in deadlineRows) {
        final cycle = row['admission_cycles'] as Map<String, dynamic>?;
        final id = cycle?['institution_id'] as String?;
        if (id == null) continue;
        nextEvent.putIfAbsent(id, () => row);
      }

      final documentCount = <String, int>{};
      for (final row in documentRows) {
        final cycle = row['admission_cycles'] as Map<String, dynamic>?;
        final id = cycle?['institution_id'] as String?;
        if (id == null) continue;
        documentCount[id] = (documentCount[id] ?? 0) + 1;
      }

      return {
        for (final id in ids)
          id: InstitutionFacts(
            institutionId: id,
            academicYear: latestYear[id],
            tuitionMinKrw: tuitionMin[id],
            tuitionMaxKrw: tuitionMax[id],
            admissionFeeKrw: admissionFee[id],
            topikMinLevel: topikMin[id],
            topikDeferred: topikDeferred[id] ?? false,
            englishTestLabel: englishTest[id],
            gpaFloorPct: gpaFloor[id],
            interviewRequired: interview[id] ?? false,
            hasRequirementsRow: hasRequirements[id] ?? false,
            nextDeadlineEvent: nextEvent[id]?['event_type'] as String?,
            nextDeadlineAt: nextEvent[id] == null
                ? null
                : DateTime.tryParse(
                    nextEvent[id]!['starts_at']?.toString() ?? '',
                  ),
            nextDeadlineIsTentative:
                (nextEvent[id]?['is_tentative'] as bool?) ?? false,
            scholarshipCount: scholarshipCount[id] ?? 0,
            bestScholarship: bestScholarship[id],
            documentCount: documentCount[id] ?? 0,
          ),
      };
    });

/// `requirements.english_test` jsonb → "TOEFL iBT 80". Mirrors
/// [RequirementsRow.englishTestLabel], which operates on a parsed row this
/// bulk reducer never builds.
String? _englishTestLabel(dynamic englishTest) {
  final map = (englishTest as Map?)?.cast<String, dynamic>();
  if (map == null || map.isEmpty) return null;
  final type = map['type'] as String?;
  if (type == null) return null;
  final score = map['min_score'] ?? map['score'] ?? map['minimum'];
  return score == null ? type : '$type $score';
}

/// Single-institution facts, for the map detail sheet's quick-facts strip.
/// A one-id case of [compareFactsProvider] — the csv key of a single id is
/// just the id, so a sheet opened before a comparison shares its cache entry
/// with nothing, but a sheet reopened for the same university hits the cache.
final institutionFactsProvider =
    FutureProvider.family<InstitutionFacts, String>((ref, id) async {
      final facts = await ref.watch(compareFactsProvider(id).future);
      return facts[id] ?? InstitutionFacts.empty(id);
    });

/// User-tracked summary — `/applications/tracker`.
final userTrackedProvider = FutureProvider<List<UpcomingDeadline>>((ref) async {
  if (!kUniDbEnabled) return const [];
  final client = Supabase.instance.client;
  final rows = await client
      .from('v_user_upcoming_deadlines')
      .select()
      .order('starts_at');
  return (rows as List)
      .map((r) => UpcomingDeadline.fromMap(r as Map<String, dynamic>))
      .toList(growable: false);
});

/// Notification settings — `/notifications/settings`. Backed by
/// `user_tracked_universities` rows scoped by RLS to the current user.
final notificationSettingsProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) async {
    if (!kUniDbEnabled) return const [];
    final client = Supabase.instance.client;
    final rows = await client.from('user_tracked_universities').select();
    return List<Map<String, dynamic>>.from(rows as List);
  },
);

/// Powers the `university_specific` interview path (plan §H.4) — fetches
/// the recruitment unit + cycle + requirements bundle the Edge Function
/// will eventually consume. Returns null until the flag is on so existing
/// behaviour is preserved.
final recruitmentForInterviewProvider =
    FutureProvider.family<RecruitmentTarget?, String>((
      ref,
      institutionId,
    ) async {
      if (!kUniDbEnabled) return null;
      final client = Supabase.instance.client;
      final rows = await client
          .from('v_recruitment_for_interview')
          .select()
          .eq('institution_id', institutionId)
          .limit(1);
      final list = rows as List;
      if (list.isEmpty) return null;
      return RecruitmentTarget.fromMap(list.first as Map<String, dynamic>);
    });

/// Upcoming deadlines for one institution. Joins cycle_dates against
/// admission_cycles to give the institution-scoped slice that
/// v_user_upcoming_deadlines doesn't expose (the user-view filters by
/// what the user is currently tracking; this returns everything for
/// the institution regardless).
final institutionDeadlinesProvider =
    FutureProvider.family<List<UpcomingDeadline>, String>((
      ref,
      institutionId,
    ) async {
      if (!kUniDbEnabled) return const [];
      final client = Supabase.instance.client;
      final rows = await client
          .from('cycle_dates')
          .select(
            'event_type, starts_at, ends_at, is_tentative, '
            'admission_cycles!inner(institution_id, applicant_category, cycle_year, '
            'institutions!inner(id, name_ko, name_ko_short))',
          )
          .eq('admission_cycles.institution_id', institutionId)
          .gte('starts_at', DateTime.now().toIso8601String())
          .order('starts_at')
          .limit(20);
      return (rows as List)
          .map((r) {
            final m = r as Map<String, dynamic>;
            final cycle =
                m['admission_cycles'] as Map<String, dynamic>? ?? const {};
            final inst =
                cycle['institutions'] as Map<String, dynamic>? ?? const {};
            return UpcomingDeadline(
              institutionId: (inst['id'] as String?) ?? institutionId,
              nameKo: (inst['name_ko'] as String?) ?? '',
              nameKoShort: inst['name_ko_short'] as String?,
              eventType: (m['event_type'] as String?) ?? '',
              startsAt:
                  DateTime.tryParse(m['starts_at']?.toString() ?? '') ??
                  DateTime.now(),
              endsAt: m['ends_at'] != null
                  ? DateTime.tryParse(m['ends_at'].toString())
                  : null,
              isTentative: (m['is_tentative'] as bool?) ?? false,
              cycleTrack: cycle['applicant_category'] as String?,
            );
          })
          .toList(growable: false);
    });

/// Whether the current user tracks the given institution.
/// Returns null if the row doesn't exist (not tracked).
final institutionTrackingProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((
      ref,
      institutionId,
    ) async {
      if (!kUniDbEnabled) return null;
      final client = Supabase.instance.client;
      final user = client.auth.currentUser;
      if (user == null) return null;
      return await client
          .from('user_tracked_universities')
          .select()
          .eq('user_id', user.id)
          .eq('institution_id', institutionId)
          .maybeSingle();
    });

/// Toggle tracking. Inserts a row with default notification prefs
/// (correction + calendar on; scholarship off) when track=true.
/// Deletes the row when track=false.
///
/// Caller is responsible for invalidating the relevant providers
/// (institutionTrackingProvider(id), notificationSettingsProvider,
/// userTrackedProvider) after this returns.
Future<void> setInstitutionTracking({
  required String institutionId,
  required bool track,
}) async {
  if (!kUniDbEnabled) return;
  final client = Supabase.instance.client;
  final user = client.auth.currentUser;
  if (user == null) {
    throw StateError('Cannot toggle tracking without an authenticated user');
  }
  if (track) {
    await client.from('user_tracked_universities').upsert({
      'user_id': user.id,
      'institution_id': institutionId,
      'notify_on_calendar_change': true,
      'notify_on_correction': true,
      'notify_on_requirement_change': true,
      'notify_on_scholarship_change': false,
    }, onConflict: 'user_id,institution_id');
  } else {
    await client
        .from('user_tracked_universities')
        .delete()
        .eq('user_id', user.id)
        .eq('institution_id', institutionId);
  }
}

/// All tuition rows for an institution, sorted academic_year desc then
/// faculty_group then semester. Returns the most recent year first so
/// the UI can show "current rate" cleanly.
final institutionTuitionProvider =
    FutureProvider.family<List<TuitionRow>, String>((ref, institutionId) async {
      if (!kUniDbEnabled) return const [];
      final client = Supabase.instance.client;
      final rows = await client
          .from('tuition')
          .select()
          .eq('institution_id', institutionId)
          .order('academic_year', ascending: false)
          .order('faculty_group')
          .order('semester_number');
      return (rows as List)
          .map((r) => TuitionRow.fromMap(r as Map<String, dynamic>))
          .toList(growable: false);
    });

/// All requirements for the most-recent verified admission cycle of
/// an institution, one row per applicant_category. Joins through
/// admission_cycles to find the institution-scoped cycle ids.
final institutionRequirementsProvider =
    FutureProvider.family<List<RequirementsRow>, String>((
      ref,
      institutionId,
    ) async {
      if (!kUniDbEnabled) return const [];
      final client = Supabase.instance.client;
      final rows = await client
          .from('requirements')
          .select(
            '*, admission_cycles!inner(institution_id, intake_year, status)',
          )
          .eq('admission_cycles.institution_id', institutionId)
          .eq('admission_cycles.status', 'verified')
          .order('applicant_category');
      return (rows as List)
          .map((r) => RequirementsRow.fromMap(r as Map<String, dynamic>))
          .toList(growable: false);
    });

/// All scholarships scoped to one institution, ordered by scope
/// (national first) then award_value desc.
final institutionScholarshipsProvider =
    FutureProvider.family<List<ScholarshipRow>, String>((
      ref,
      institutionId,
    ) async {
      if (!kUniDbEnabled) return const [];
      final client = Supabase.instance.client;
      final rows = await client
          .from('scholarships')
          .select()
          .eq('institution_id', institutionId)
          .order('scope')
          .order('award_value', ascending: false, nullsFirst: false);
      return (rows as List)
          .map((r) => ScholarshipRow.fromMap(r as Map<String, dynamic>))
          .toList(growable: false);
    });

/// The most-recent successfully-parsed guideline_documents row for an
/// institution. Used by the detail screen to power "Open admission
/// guide PDF" via PdfUrlService. Returns null when the institution has
/// no parsed guideline yet.
final institutionPrimaryGuidelineProvider =
    FutureProvider.family<String?, String>((ref, institutionId) async {
      if (!kUniDbEnabled) return null;
      final client = Supabase.instance.client;
      final row = await client
          .from('guideline_documents')
          .select('id')
          .eq('institution_id', institutionId)
          .eq('parse_status', 'succeeded')
          .order('fetched_at', ascending: false)
          .limit(1)
          .maybeSingle();
      return row?['id'] as String?;
    });

/// All required-document rows for an institution's most-recent verified
/// cycle. Grouped by applicant_category in the UI.
final institutionDocumentsRequiredProvider =
    FutureProvider.family<List<DocumentRequirementRow>, String>((
      ref,
      institutionId,
    ) async {
      if (!kUniDbEnabled) return const [];
      final client = Supabase.instance.client;
      final rows = await client
          .from('documents_required')
          .select('*, admission_cycles!inner(institution_id, status)')
          .eq('admission_cycles.institution_id', institutionId)
          .eq('admission_cycles.status', 'verified')
          .order('applicant_category')
          .order('document_type');
      return (rows as List)
          .map((r) => DocumentRequirementRow.fromMap(r as Map<String, dynamic>))
          .toList(growable: false);
    });

/// Update notification prefs for one tracked institution.
///
/// Caller is responsible for invalidating notificationSettingsProvider
/// (and optionally institutionTrackingProvider) after this returns.
Future<void> updateNotificationPrefs({
  required String institutionId,
  bool? notifyOnCalendarChange,
  bool? notifyOnCorrection,
  bool? notifyOnRequirementChange,
  bool? notifyOnScholarshipChange,
}) async {
  if (!kUniDbEnabled) return;
  final client = Supabase.instance.client;
  final user = client.auth.currentUser;
  if (user == null) {
    throw StateError('Cannot update prefs without an authenticated user');
  }
  await client
      .from('user_tracked_universities')
      .update({
        'notify_on_calendar_change': ?notifyOnCalendarChange,
        'notify_on_correction': ?notifyOnCorrection,
        'notify_on_requirement_change': ?notifyOnRequirementChange,
        'notify_on_scholarship_change': ?notifyOnScholarshipChange,
      })
      .eq('user_id', user.id)
      .eq('institution_id', institutionId);
}
