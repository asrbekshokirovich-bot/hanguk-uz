import 'dart:io';
import 'package:supabase/supabase.dart';
void main() async {
  final client = SupabaseClient('https://lysjdtyanhdfphqyijsr.supabase.co', (Platform.environment['SUPABASE_SECRET_KEY'] ?? ''));
  
  try {
    final res = await client.rpc('get_schema_info_for_channel_messages', params: {}); // just seeing if we can query channel_messages
    final msg = await client.from('channel_messages').select('*, students(*)').limit(1);
    print('Students: $msg');
  } catch(e) {
    print('Failed with students: $e');
  }
  
  try {
    final msg2 = await client.from('channel_messages').select('*, profiles(*)').limit(1);
    print('Profiles: $msg2');
  } catch(e) {
    print('Failed with profiles: $e');
  }
  
  try {
    final msg3 = await client.from('channel_messages').select('*, users(*)').limit(1);
    print('Users: $msg3');
  } catch(e) {
    print('Failed with users: $e');
  }
  exit(0);
}
