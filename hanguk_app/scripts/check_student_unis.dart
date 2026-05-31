import 'dart:convert';
import 'package:supabase/supabase.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  
  // Use anon key and login
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTUxMDYsImV4cCI6MjA4ODQzMTEwNn0.p-WlK-r4xqRk63N6zc_8JCIV53FVmjwAcqK7Lx25GJs';
  const serviceRoleKey = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV';
  
  final client = SupabaseClient(supabaseUrl, serviceRoleKey);
  try {
    final response = await client.functions.invoke('student-login', body: {'magicCode': 'QR6ZUBDZ'});
    final data = response.data;
    if (data['session'] != null) {
      final studentClient = SupabaseClient(supabaseUrl, anonKey);
      await studentClient.auth.setSession(data['session']['refresh_token']);
      
      final unis = await studentClient.from('universities').select('id, name_en, is_partner').eq('is_partner', true).limit(5);
      print('STUDENT_UNIS=' + jsonEncode(unis));
      
      // also check apps
      final apps = await studentClient.from('applications').select().eq('student_id', data['user']['id']);
      print('STUDENT_APPS_COUNT=' + apps.length.toString());
    } else {
      print('Failed login: ' + jsonEncode(data));
    }
  } catch (e, st) {
    print('ERROR MSG:' + e.toString());
  }
}
