import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query(`SELECT id, name_en, name_uz, is_partner FROM public.universities WHERE is_partner = true LIMIT 10`);
    console.log("Partner universities:", res.rows);
  } finally {
    await client.end();
  }
}

run();
