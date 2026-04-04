import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: joined, error: err3 } = await supabase
    .from('student_suggestions')
    .select('id, student_id, university_id, university:universities(id, name_en, name_uz)');
    
  let out = "";
  if (err3) {
    out += "ERROR: " + err3.message;
  } else {
    out += "TOTAL SUGGESTIONS: " + joined.length + "\n";
    for (const sug of joined) {
      out += `student_id: ${sug.student_id} | uni_en: ${sug.university?.name_en}\n`;
    }
  }
  fs.writeFileSync('db_out3.txt', out);
}

run();
