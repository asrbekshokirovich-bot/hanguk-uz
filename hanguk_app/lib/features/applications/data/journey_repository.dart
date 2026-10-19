import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../auth/data/auth_repository.dart';
import '../domain/application_journey.dart';

/// Everything the Ariza tab draws, in one call: `my_application_journey()`
/// (migration 20261019190000). The submissions, guideline dates and document
/// checks behind it are staff-only tables, so the function hands the student
/// just their own.
final applicationJourneyProvider = FutureProvider<ApplicationJourney>((ref) async {
  final authState = ref.watch(authStateProvider);
  final user = authState.value?.session?.user ?? Supabase.instance.client.auth.currentUser;
  if (user == null) return const ApplicationJourney(facts: JourneyFacts(), universities: []);
  final data = await Supabase.instance.client
      .rpc('my_application_journey')
      .timeout(const Duration(seconds: 20));
  if (data is! Map) return const ApplicationJourney(facts: JourneyFacts(), universities: []);
  return ApplicationJourney.fromJson(Map<String, dynamic>.from(data));
});
