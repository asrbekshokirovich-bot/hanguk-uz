import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://lysjdtyanhdfphqyijsr.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ.68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E');

async function assign() {
  const code = 'QR6ZUBDZ';
  
  // 1. Get user id
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, user_id, magic_code').eq('magic_code', code);
  if (pErr || !profiles || profiles.length === 0) {
    console.log('User not found:', pErr);
    return;
  }
  
  // test_student_login.mjs selects user_id, but the profiles table pk is id usually.
  const student_id = profiles[0].user_id || profiles[0].id;
  console.log('Student ID:', student_id);

  // 2. Get 2 universities
  const { data: unis } = await supabase.from('universities').select('id, name_en').limit(2);
  if (!unis || unis.length === 0) {
    console.log('No universities found');
    return;
  }
  const university_ids = unis.map(u => u.id);
  console.log('Universities to assign:', unis);

  // 3. Insert into student_suggestions
  for (const uni_id of university_ids) {
    const { error: insErr } = await supabase.from('student_suggestions').upsert({
      student_id: student_id,
      university_id: uni_id
    }, { onConflict: 'student_id,university_id' });
    
    if (insErr) {
       console.log('Insert error:', insErr);
    } else {
       console.log('Inserted suggestion:', uni_id);
    }
  }
  console.log('Assignment Complete');
}

assign();
