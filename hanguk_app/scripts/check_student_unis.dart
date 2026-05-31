import 'dart:io';
import 'dart:convert';
import 'package:supabase/supabase.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  
  // Use anon key and login
  const anonKey = 'sb_publishable_Ne64VlXnQ7tWJJ1e7aQLGg_5OgQiof3';
  final serviceRoleKey = Platform.environment['SUPABASE_SECRET_KEY'] ?? '';
  
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
