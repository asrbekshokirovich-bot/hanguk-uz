import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("Uploading split x86_64 APK...");
  const pk = fs.readFileSync('C:\\Users\\user\\Desktop\\Anti gravity\\hanguk\\hanguk_app\\build\\app\\outputs\\flutter-apk\\app-x86_64-release.apk');
  
  const { error } = await supabase.storage.from('updates').upload('hanguk_v1.0.1_x86_64.apk', pk, {
    contentType: 'application/vnd.android.package-archive',
    upsert: true
  });

  if (error) { console.error("Upload error:", error); return; }

  const publicUrl = supabase.storage.from('updates').getPublicUrl('hanguk_v1.0.1_x86_64.apk').data.publicUrl;
  console.log("Uploaded! URL: " + publicUrl);

  const payload = {
    id: 'android',
    latest_version: '1.0.1', 
    download_url: publicUrl,
    force_update: true
  };

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
  console.log("DB Trigger pushed: " + response.status);
}

run();
