const { createClient } = require('@supabase/supabase-js');

// Using the keys from .env.edge
const supabaseUrl = 'https://lysjdtyanhdfphqyijsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCodes() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, magic_code')
    .not('magic_code', 'is', 'null')
    .limit(10);
    
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Available magic codes in DB:');
    console.log(data);
  }
}

checkCodes();
