import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadAndTrigger() {
  console.log("Creating public bucket 'updates' (if it doesn't exist)...");
  await supabase.storage.createBucket('updates', { public: true }).catch(e => { /* ignores if exists */ });

  console.log("Reading APK from desktop...");
  const apkPath = 'C:\\Users\\user\\Desktop\\hanguk_v1.0.1.apk';
  const fileBuffer = fs.readFileSync(apkPath);

  console.log(`Uploading ${fileBuffer.length} bytes to Supabase Storage...`);
  const { data, error } = await supabase.storage.from('updates').upload('hanguk_v1.0.1.apk', fileBuffer, {
    contentType: 'application/vnd.android.package-archive',
    upsert: true
  });

  if (error) {
    console.error("Failed to upload APK:", error);
    return;
  }

  const { data: publicUrlData } = supabase.storage.from('updates').getPublicUrl('hanguk_v1.0.1.apk');
  const publicUrl = publicUrlData.publicUrl;
  console.log("APK successfully hosted at:", publicUrl);

  const payload = {
    id: 'android',
    // Must be > '1.0.0' which is the pubspec version
    latest_version: '1.0.1', 
    download_url: publicUrl,
    force_update: true
  };

  console.log("Updating app_versions table to trigger update...");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_versions?on_conflict=id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error("Failed to trigger update in DB:", await response.text());
  } else {
    console.log("✅ Successfully ACTUALLY PUSHED REAL OTA UPDATE!");
  }
}

uploadAndTrigger();
