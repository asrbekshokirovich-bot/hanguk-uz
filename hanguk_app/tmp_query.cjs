const SUPABASE_URL = 'https://lysjdtyanhdfphqyijsr.supabase.co';
const ANON_KEY = process.env.SUPABASE_SECRET_KEY;

async function test() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/applications?select=*,university:universities(id,name_en)`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    }
  });
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("RESPONSE:", text);
}

test();
