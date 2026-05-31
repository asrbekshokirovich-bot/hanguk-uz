import 'dart:io';
import 'package:supabase/supabase.dart';
void main() async {
  final client = SupabaseClient('https://lysjdtyanhdfphqyijsr.supabase.co', 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV');
  
  try {
    final msgs = await client.from('channel_messages').select('sender_id').limit(10);
    for (var m in msgs) {
       final sid = m['sender_id'];
       if (sid == null) continue;
       
       try {
         final p = await client.from('profiles').select('id').eq('id', sid).maybeSingle();
         if (p != null) print('Found $sid in profiles!');
       } catch(e) {}
       
       try {
         final s = await client.from('students').select('id').eq('id', sid).maybeSingle();
         if (s != null) print('Found $sid in students!');
       } catch(e) {}
    }
  } catch(e) {
    print('Failed: $e');
  }
  exit(0);
}
