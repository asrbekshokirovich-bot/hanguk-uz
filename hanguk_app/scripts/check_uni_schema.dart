import 'dart:convert';
import 'package:supabase/supabase.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  const anonKey = 'sb_publishable_Ne64VlXnQ7tWJJ1e7aQLGg_5OgQiof3';
  
  final client = SupabaseClient(supabaseUrl, anonKey);
  try {
    final unis = await client.from('universities').select('*').eq('is_partner', true).limit(1);
    print('UNI_FULL=' + jsonEncode(unis));
  } catch (e, st) {
    print('ERROR MSG:' + e.toString());
  }
}
