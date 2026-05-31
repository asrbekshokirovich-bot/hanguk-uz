import 'dart:io';
import 'package:supabase/supabase.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  final supabaseKey = Platform.environment['SUPABASE_SECRET_KEY'] ?? '';
  
  final client = SupabaseClient(supabaseUrl, supabaseKey);
  
  try {
    final res = await client.from('app_versions').select().limit(1);
    print('SUCCESS! app_versions table exists! Data: $res');
  } catch (e) {
    print('ERROR: $e');
  }
}
