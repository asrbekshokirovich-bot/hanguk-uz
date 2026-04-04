import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: universities } = await supabase.from('universities').select('*');
  
  const search = "kongju";
  const q = search.toLowerCase().trim();
  
  const filtered = universities.filter((u) =>
    u.name_en?.toLowerCase().includes(q) ||
    u.name_uz?.toLowerCase().includes(q) ||
    u.name_ko?.toLowerCase().includes(q)
  );
  
  console.log("Results for 'kongju':");
  for (const u of filtered) {
    console.log(u.name_en, u.id);
  }
}

run();
