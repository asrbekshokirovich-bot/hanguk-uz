import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // 1. Check if the student_suggestions table exists and has rows
  const { data: suggestions, error: err1 } = await supabase.from('student_suggestions').select('*').limit(10);
  
  if (err1) {
    console.log("ERROR 1: Table might not exist or other error:", err1.message);
  } else {
    console.log("Suggestions in DB:", suggestions);
  }

  // 2. Check applications for pending approval to see if they were just placed in `applications` instead
  const { data: activeApps, error: err2 } = await supabase.from('applications').select('*').eq('status', 'pending_approval').limit(5);
  if (err2) {
    console.log("ERROR 2:", err2.message);
  } else {
    console.log("Applications pending_approval:", activeApps);
  }

  // 3. Test the exact join query Flutter is doing
  const { data: joined, error: err3 } = await supabase.from('student_suggestions').select('university_id, university:universities(*)').limit(1);
  if (err3) {
    console.log("ERROR 3 (Join Failed):", err3.message);
  } else {
    if (joined && joined.length > 0) {
      console.log("Dart Join Result Keys:", Object.keys(joined[0]));
      console.log("Is university null?:", joined[0].university === null);
    }
  }
}

run();
