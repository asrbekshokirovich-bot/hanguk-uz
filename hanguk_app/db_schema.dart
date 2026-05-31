import 'dart:io';
import 'package:supabase/supabase.dart';
void main() async {
  final client = SupabaseClient('https://lysjdtyanhdfphqyijsr.supabase.co', 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV');
  
  try {
    final msg = await client.from('channel_messages').select('*, students(*)').limit(1);
    print('Students works');
  } catch(e) {
    print('Students: $e');
  }
  
  try {
    final msg = await client.from('channel_messages').select('*, profiles(*)').limit(1);
    print('Profiles works');
  } catch(e) {
    print('Profiles: $e');
  }
  
  try {
    final msg = await client.from('channel_messages').select('*, users(*)').limit(1);
    print('Users works');
  } catch(e) {
    print('Users: $e');
  }
  exit(0);
}
