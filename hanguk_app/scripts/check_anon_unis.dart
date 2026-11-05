import 'dart:convert';
import 'package:supabase/supabase.dart';
import 'package:hanguk_app/core/config/app_config.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  const anonKey = AppConfig.supabasePublishableKey;
  
  final client = SupabaseClient(supabaseUrl, anonKey);
  try {
    // DO NOT LOGIN. JUST FETCH AS ANON
    final unis = await client.from('universities').select('id, name_en, is_partner').limit(5);
    print('ANON_UNIS=' + jsonEncode(unis));
  } catch (e, st) {
    print('ERROR MSG:' + e.toString());
  }
}
