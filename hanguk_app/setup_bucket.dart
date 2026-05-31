import 'dart:io';
import 'package:supabase/supabase.dart';
void main() async {
  final client = SupabaseClient('https://lysjdtyanhdfphqyijsr.supabase.co', (Platform.environment['SUPABASE_SECRET_KEY'] ?? ''));
  
  try {
    print('Creating releases bucket...');
    await client.storage.createBucket('releases', const BucketOptions(public: true));
    print('Bucket created successfully!');
  } catch(e) {
    if (e.toString().contains('already exists')) {
      print('Bucket already exists, making it public...');
      await client.storage.updateBucket('releases', const BucketOptions(public: true));
    } else {
      print('Error: $e');
    }
  }
}
