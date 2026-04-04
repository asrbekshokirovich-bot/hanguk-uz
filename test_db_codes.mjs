import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, user_id, full_name'); // magic_access_code removed for a sec

  if (error) {
    fs.writeFileSync('test_codes_out.txt', "ERROR: " + JSON.stringify(error));
    return;
  }
  let out = `Total: ${profiles?.length}\n`;
  for (const p of profiles) {
    out += `Name: ${p.full_name} | UserID: ${p.user_id}\n`;
  }
  fs.writeFileSync('test_codes_out.txt', out);
}

run();
