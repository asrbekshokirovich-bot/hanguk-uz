const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const anonUrlMatch = env.match(/VITE_SUPABASE_URL=([^\"\n\r]+|\"[^\"]+\")/);
const anonKeyMatch = env.match(/VITE_SUPABASE_ANON_KEY=([^\"\n\r]+|\"[^\"]+\")/);
const supUrl = anonUrlMatch[1].replace(/\"/g, '');
const supKey = anonKeyMatch[1].replace(/\"/g, '');
const supabase = createClient(supUrl, supKey);

async function run() {
  console.log('Fetching users with name test...');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').ilike('full_name', '%test%');
  if (pErr) console.error(pErr);
  console.log('Profiles:', profiles.map(p => ({id: p.id, user_id: p.user_id, full_name: p.full_name})));

  if (profiles && profiles.length > 0) {
    const userId = profiles[0].user_id || profiles[0].id; // profiles.user_id handles auth.users mapping normally
    console.log('Fetching applications for user', userId);
    
    // Auth bypass for apps? Since we use anon key, RLS will block us unless we have the user token!
    // But Wait! In CRM, we query this using logged in admin. Since I have anon key, I might not see applications!
    // Let's use service_role key to bypass RLS!
  }
}
run();
