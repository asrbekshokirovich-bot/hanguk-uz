import 'package:supabase/supabase.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  const supabaseKey = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV';
  
  final client = SupabaseClient(supabaseUrl, supabaseKey);
  
  try {
    final unis = await client.from('universities').select('id, name_en, is_partner').limit(5);
    print('Universities: $unis');

    final partnerUnis = await client.from('universities').select('id, name_en, is_partner').eq('is_partner', true).limit(5);
    print('Partner Universities: $partnerUnis');
    
  } catch (e) {
    print('ERROR: $e');
  }
}
