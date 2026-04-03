const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, count, error } = await supabase
    .from('profiles')
    .select('magic_code, full_name', { count: 'exact' })
    .not('magic_code', 'is', 'null');
    
  console.log(`Count: ${count}`);
  console.log(data);
}

run();
