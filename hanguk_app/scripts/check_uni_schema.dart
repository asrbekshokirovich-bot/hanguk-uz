import 'dart:convert';
import 'package:supabase/supabase.dart';

Future<void> main() async {
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTUxMDYsImV4cCI6MjA4ODQzMTEwNn0.p-WlK-r4xqRk63N6zc_8JCIV53FVmjwAcqK7Lx25GJs';
  
  final client = SupabaseClient(supabaseUrl, anonKey);
  try {
    final unis = await client.from('universities').select('*').eq('is_partner', true).limit(1);
    print('UNI_FULL=' + jsonEncode(unis));
  } catch (e, st) {
    print('ERROR MSG:' + e.toString());
  }
}
