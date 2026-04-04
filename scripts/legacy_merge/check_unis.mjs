import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query(`SELECT id, name_en, name_uz, is_partner FROM public.universities WHERE name_en ILIKE '%Gwangju%' OR name_uz ILIKE '%Gwangju%' OR name_en ILIKE '%Seoul National%' OR name_uz ILIKE '%Seoul National%'`);
    console.log("Matching universities:", res.rows);
  } finally {
    await client.end();
  }
}

run();
