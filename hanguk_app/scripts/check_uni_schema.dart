import 'dart:convert';
import 'package:supabase/supabase.dart';
import 'package:hanguk_app/core/config/app_config.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  const anonKey = AppConfig.supabasePublishableKey;
  
  final client = SupabaseClient(supabaseUrl, anonKey);
  try {
    final unis = await client.from('universities').select('*').eq('is_partner', true).limit(1);
    print('UNI_FULL=' + jsonEncode(unis));
  } catch (e, st) {
    print('ERROR MSG:' + e.toString());
  }
}
