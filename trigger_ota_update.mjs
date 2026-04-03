const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

async function forceUpdateTrigger() {
  const url = `${SUPABASE_URL}/rest/v1/app_versions?on_conflict=id`;
  
  const payload = {
    id: 'android',
    latest_version: '1.0.1',
    download_url: 'https://archive.org/download/hanguk-update/hanguk-v1.0.1.apk', // Placeholder publicly accessible URL 
    force_update: true
  };

  const response = await fetch(url, {
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
    const err = await response.text();
    console.error("Failed to insert update trigger. Error: ", err);
  } else {
    const data = await response.json();
    console.log("✅ Successfully configured OTA Update Trigger in Supabase!");
    console.log(data);
  }
}

forceUpdateTrigger();
