import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: apps, error } = await supabase
    .from('applications')
    .select('id, student_id, university_id, university:universities(id, name_en, name_uz)');

  let out = `Total: ${apps?.length}\n`;
  if (apps) {
    for (const a of apps) {
      out += `Student: ${a.student_id} | Uni: ${a.university?.name_en} | Uni ID: ${a.university_id}\n`;
    }
  }
  fs.writeFileSync('test_db_apps_out.txt', out);
}

run();
