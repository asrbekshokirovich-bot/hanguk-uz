import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deploy() {
  const version = '1.0.2';
  const apkFileName = `hanguk_v${version}_redesign_final.apk`;
  const apkPath = '../hanguk_app/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk';

  console.log(`🚀 Starting deployment for version ${version}...`);

  if (!fs.existsSync(apkPath)) {
    console.error(`❌ APK not found at ${apkPath}. Build might have failed.`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(apkPath);
  console.log(`📦 Reading APK (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);

  console.log(`☁️  Uploading to Supabase 'updates' bucket...`);
  const { data, error } = await supabase.storage
    .from('updates')
    .upload(apkFileName, fileBuffer, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true
    });

  if (error) {
    console.error("❌ Upload failed:", error);
    process.exit(1);
  }

  const { data: publicUrlData } = supabase.storage.from('updates').getPublicUrl(apkFileName);
  const publicUrl = publicUrlData.publicUrl;
  console.log("✅ APK hosted at:", publicUrl);

  const payload = {
    id: 'android',
    latest_version: version,
    download_url: publicUrl,
    force_update: true
  };

  console.log("🔔 Updating app_versions table to trigger Student OTA...");
  const { error: dbError } = await supabase
    .from('app_versions')
    .upsert(payload, { onConflict: 'id' });

  if (dbError) {
    console.error("❌ DB update failed:", dbError);
    process.exit(1);
  }

  console.log("🎉 Successfully deployed version 1.0.2! Students will see the update now.");
  
  // Also copy to desktop for user convenience
  const desktopPath = path.join('C:', 'Users', 'user', 'Desktop', apkFileName);
  fs.copyFileSync(apkPath, desktopPath);
  console.log(`💾 Final APK also copied to Desktop as ${apkFileName}`);
}

deploy();
