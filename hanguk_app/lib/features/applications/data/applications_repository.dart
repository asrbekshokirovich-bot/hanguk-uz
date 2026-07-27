import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../domain/application.dart';
import '../../map/domain/university.dart';
import '../../auth/data/auth_repository.dart';

// Provider to fetch suggested universities for the student
final suggestedUniversitiesProvider = FutureProvider<List<University>>((
  ref,
) async {
  // Watch the provider directly (sync) to avoid async stream .future caching bugs
  final authState = ref.watch(authStateProvider);
  final user =
      authState.value?.session?.user ??
      Supabase.instance.client.auth.currentUser;
  if (user == null) {
    debugPrint('[Suggestions] user is null, returning empty list');
    return [];
  }

  final client = Supabase.instance.client;

  try {
    // Attempt to fetch from CRM suggestions table directly with joining institutions
    final data = await client
        .from('student_suggestions')
        .select('institution_id, university:institutions(*)')
        .eq('student_id', user.id);

    debugPrint(
      '[Suggestions] student_suggestions query for ${user.id} returned ${(data as List).length} rows',
    );
    final List<University> suggestions = [];
    for (var row in data as List) {
      if (row['university'] != null) {
        final u = row['university'] as Map<String, dynamic>;
        suggestions.add(
          University(
            id: u['id'] as String,
            name:
                u['name_en'] as String? ?? u['name_ko'] as String? ?? 'Unknown',
            location: u['city_ko'] as String? ?? '',
            isPartner: u['is_partner'] as bool? ?? false,
            latitude: u['latitude'] != null
                ? (u['latitude'] as num).toDouble()
                : null,
            longitude: u['longitude'] != null
                ? (u['longitude'] as num).toDouble()
                : null,
            logoUrl: u['logo_url'] as String?,
          ),
        );
      }
    }

    // If we have explicit CRM suggestions, return those
    if (suggestions.isNotEmpty) {
      debugPrint(
        '[Suggestions] returning ${suggestions.length} CRM suggestions',
      );
      return suggestions;
    }
  } catch (e) {
    if (e is PostgrestException && e.code == 'PGRST205') {
      debugPrint(
        '[Suggestions] student_suggestions table missing, falling back.',
      );
    } else {
      debugPrint('[Suggestions] Error fetching explicit suggestions: $e');
    }
  }

  try {
    // Fallback: If no explicit CRM suggestions exist yet, fetch partner institutions directly
    final fallbackData = await client
        .from('institutions')
        .select()
        .eq('is_partner', true)
        .limit(5);
    debugPrint(
      '[Suggestions] Fallback partner universities returned ${(fallbackData as List).length} rows',
    );
    if ((fallbackData as List).isEmpty) {
      debugPrint(
        '[Suggestions] WARNING: Fallback returned 0 universities. Ensure is_partner=true is set for some universities.',
      );
    }

    return fallbackData
        .map<University>(
          (u) => University(
            id: u['id'] as String,
            name:
                u['name_en'] as String? ?? u['name_ko'] as String? ?? 'Unknown',
            location: u['city_ko'] as String? ?? '',
            isPartner: u['is_partner'] as bool? ?? false,
            latitude: u['latitude'] != null
                ? (u['latitude'] as num).toDouble()
                : null,
            longitude: u['longitude'] != null
                ? (u['longitude'] as num).toDouble()
                : null,
            logoUrl: u['logo_url'] as String?,
          ),
        )
        .toList();
  } catch (e, st) {
    debugPrint('[Suggestions] Failed to fetch fallback suggestions: $e\n$st');
    throw e;
  }
});

// Method to submit selected universities for CRM approval
Future<void> submitSelectedUniversities(List<String> universityIds) async {
  final client = Supabase.instance.client;
  final user = client.auth.currentUser;
  if (user == null) throw Exception('User not logged in');

  final inserts = universityIds
      .map(
        (uId) => {
          'student_id': user.id,
          'institution_id': uId,
          'status': 'pending_approval',
        },
      )
      .toList();

  // 1. Insert into applications
  await client.from('applications').insert(inserts);

  // 2. Delete ALL university suggestions for this student
  // since they submitted their chosen batch of universities.
  try {
    await client.from('student_suggestions').delete().eq('student_id', user.id);
  } catch (e) {
    debugPrint(
      '[ApplicationsRepository] Failed to clear remaining suggestions: $e',
    );
    // We swallow this error because the application was successfully submitted
  }
}

final applicationsProvider = FutureProvider<List<StudentApplication>>((
  ref,
) async {
  // Watch the provider directly (sync) to avoid async stream .future caching bugs
  final authState = ref.watch(authStateProvider);
  final user =
      authState.value?.session?.user ??
      Supabase.instance.client.auth.currentUser;
  if (user == null) {
    debugPrint('[Applications] user is null, returning empty list');
    return [];
  }

  final client = Supabase.instance.client;
  try {
    // Join with institutions table to get university name/location in one call
    final data = await client
        .from('applications')
        .select('*, university:institutions(id, name_en, city_ko, is_partner)')
        .eq('student_id', user.id)
        .order('created_at', ascending: false);

    debugPrint(
      '[Applications] Query for student ${user.id} returned ${(data as List).length} applications',
    );

    return (data as List).map((row) {
      // Parse the joined university row (may be null if no join match)
      University? university;
      final uniRow = row['university'] as Map<String, dynamic>?;
      if (uniRow != null) {
        university = University(
          id: uniRow['id'] as String,
          name: uniRow['name_en'] as String? ?? 'Unknown University',
          location: uniRow['city_ko'] as String? ?? 'South Korea',
          isPartner: uniRow['is_partner'] as bool? ?? false,
        );
      }

      return StudentApplication(
        id: row['id'] as String,
        studentId: row['student_id'] as String,
        universityId: row['institution_id'] as String? ?? '',
        program: row['program'] as String? ?? '',
        status: row['status'] as String? ?? 'pending',
        createdAt: DateTime.parse(row['created_at'] as String),
        university: university,
      );
    }).toList();
  } catch (e, st) {
    debugPrint(
      '[ApplicationsRepository] Failed to fetch applications: $e\n$st',
    );
    throw e;
  }
});
