import 'dart:io';
import 'package:supabase/supabase.dart';
void main() async {
  final client = SupabaseClient('https://lysjdtyanhdfphqyijsr.supabase.co', 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV');
  
  try {
    final res = await client.from('app_versions').select().eq('id', 'android').single();
    print('Row: $res');
  } catch(e) {
    print('Failed: $e');
  }
  exit(0);
}
