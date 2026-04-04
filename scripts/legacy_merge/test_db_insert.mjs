import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const KONGJU_ID = 'c1c3597e-e2eb-4602-898a-7bc8782f65b0';
  const KANGWON_ID = 'd4c75cc1-dcdf-4e3d-8c04-3f69649097e7';
  const STUDENT_ID = 'c270d0f8-f539-47e0-bf9e-443e92a56160';

  console.log("Attempting to insert Kongju...");
  const { error: e1 } = await supabase.from('student_suggestions').insert({
    student_id: STUDENT_ID,
    university_id: KONGJU_ID
  });
  console.log("Kongju Result:", e1 ? e1.message : "Success");

  console.log("Attempting to insert Kangwon...");
  const { error: e2 } = await supabase.from('student_suggestions').insert({
    student_id: STUDENT_ID,
    university_id: KANGWON_ID
  });
  console.log("Kangwon Result:", e2 ? e2.message : "Success");
}

run();
