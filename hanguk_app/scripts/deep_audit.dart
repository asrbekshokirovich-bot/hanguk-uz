import 'dart:io';
import 'dart:convert';
import 'package:supabase/supabase.dart';

// ============================================================
// DEEP AUDIT SCRIPT
// Checks auth.uid() vs applications.student_id mismatch
// Run: dart run scripts/deep_audit.dart
// ============================================================
Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  final serviceRoleKey = Platform.environment['SUPABASE_SECRET_KEY'] ?? '';
  const anonKey = 'sb_publishable_Ne64VlXnQ7tWJJ1e7aQLGg_5OgQiof3';

  final adminClient = SupabaseClient(supabaseUrl, serviceRoleKey);
  
  // Step 1: Login via edge function to get refresh token
  print('\n=== STEP 1: Login via student-login ===');
  final loginResp = await adminClient.functions.invoke('student-login', body: {'magicCode': 'QR6ZUBDZ'});
  final loginData = loginResp.data as Map<String, dynamic>;
  
  if (loginData['session'] == null) {
    print('LOGIN FAILED: ${jsonEncode(loginData)}');
    return;
  }
  
  final refreshToken = loginData['session']['refresh_token'] as String;
  final sessionUserId = loginData['user']['id'] as String;
  print('Edge Function returned user.id (auth UID): $sessionUserId');
  
  // Step 2: Check what student_id is stored in applications
  print('\n=== STEP 2: All applications (via service role) ===');
  final allApps = await adminClient.from('applications').select('id, student_id, status, university_id').limit(10);
  for (final app in allApps as List) {
    print('  App: id=${app['id']}, student_id=${app['student_id']}, status=${app['status']}');
    final matches = app['student_id'] == sessionUserId;
    print('    -> student_id matches auth.uid()? $matches');
  }
  
  // Step 3: Log in as the student and run the SAME query the app runs
  print('\n=== STEP 3: Simulating app query (as authenticated student) ===');
  final studentClient = SupabaseClient(supabaseUrl, anonKey);
  await studentClient.auth.setSession(refreshToken);
  
  final currentUser = studentClient.auth.currentUser;
  print('Currently signed in as: ${currentUser?.id} (email: ${currentUser?.email})');
  
  // Check auth.uid() from database perspective
  try {
    final uid = await studentClient.rpc('get_auth_uid_function').select();
    print('DB auth.uid(): $uid');
  } catch (e) {
    // This RPC probably doesn't exist, that's OK
  }
  
  final appsQuery = await studentClient
    .from('applications')
    .select('*, university:universities(id, name_en, city_en, is_partner)')
    .eq('student_id', currentUser?.id ?? '')
    .order('created_at', ascending: false);
  
  print('Apps returned for student (${currentUser?.id}): ${(appsQuery as List).length}');
  for (final app in appsQuery) {
    print('  App: ${app['id']}, status: ${app['status']}, university: ${app['university']?['name_en']}');
  }
  
  // Step 4: Check partner universities (as student)
  print('\n=== STEP 4: Partner universities (as student) ===');
  final unis = await studentClient.from('universities').select('id, name_en, is_partner').eq('is_partner', true).limit(5);
  print('Partner unis visible to student: ${(unis as List).length}');
  for (final uni in unis) {
    print('  ${uni['name_en']} (partner=${uni['is_partner']})');
  }
  
  // Step 5: Check student_suggestions
  print('\n=== STEP 5: Student suggestions ===');
  try {
    final suggestions = await studentClient
      .from('student_suggestions')
      .select('university_id, university:universities(*)')
      .eq('student_id', currentUser?.id ?? '');
    print('Suggestions for student: ${(suggestions as List).length}');
  } catch (e) {
    print('student_suggestions error: $e');
  }
  
  print('\n=== DIAGNOSIS SUMMARY ===');
  print('Auth UID from edge function: $sessionUserId');
  print('Auth UID after setSession: ${currentUser?.id}');
  if (sessionUserId == currentUser?.id) {
    print('✅ UIDs match — auth is working correctly');
  } else {
    print('❌ UID MISMATCH! This is the bug.');
    print('  Fix: Update applications.student_id from $sessionUserId to ${currentUser?.id}');
  }
}
