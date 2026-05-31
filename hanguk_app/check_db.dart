import 'package:supabase/supabase.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  const supabaseKey = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV';
  
  final client = SupabaseClient(supabaseUrl, supabaseKey);
  
  try {
    final res = await client.from('app_versions').select().limit(1);
    print('SUCCESS! app_versions table exists! Data: $res');
  } catch (e) {
    print('ERROR: $e');
  }
}
