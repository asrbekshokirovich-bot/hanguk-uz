import 'dart:io';
import 'package:supabase/supabase.dart';

Future<void> main() async {
  print('--- Supabase Updater Script ---');
  
  // Credentials from .env.edge (using Service Role Key to bypass RLS for UPSERT)
  const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
  const supabaseKey = 'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV';
  
  final client = SupabaseClient(supabaseUrl, supabaseKey);
  
  // Verify the APK exists
  final apkFile = File('build/app/outputs/flutter-apk/app-arm64-v8a-release.apk');
  if (!apkFile.existsSync()) {
    print('ERROR: APK file not found at ${apkFile.path}');
    print('Make sure "flutter build apk --release" completed successfully.');
    exit(1);
  }
  
  final version = '1.0.18+2031';
  final fileName = 'hanguk_app_v1.0.18_2031.apk';
  final bucketName = 'releases';
  
  print('1. Uploading $fileName to Supabase storage (bucket: $bucketName)...');
  try {
    await client.storage.from(bucketName).upload(
      fileName,
      apkFile,
      fileOptions: const FileOptions(cacheControl: '3600', upsert: true),
    );
    print('  -> Upload completed successfully.');
  } catch(e) {
    print('  -> Upload failed: $e');
    exit(1);
  }

  print('\n2. Retrieving public download URL...');
  final publicUrl = client.storage.from(bucketName).getPublicUrl(fileName);
  print('  -> URL: $publicUrl');
  
  print('\n3. Updating app_versions table (id = android)...');
  try {
    await client.from('app_versions').update({
      'latest_version': version,
      'download_url': publicUrl,
      'force_update': true, // Optional: forces users to update to break loop
    }).eq('id', 'android');
    print('  -> Database updated successfully.');
  } catch(e) {
    print('  -> Failed to update database: $e');
    exit(1);
  }
  
  print('\n✅ DONE! The update loop is broken!');
  print('Any user trying to install the update will now receive $version.');
  exit(0);
}
