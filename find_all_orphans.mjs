import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  const tables = [
    'student_suggestions', 'applications', 'documents', 'student_notes', 'student_comments', 'payments'
  ];

  try {
    for (const table of tables) {
      const q = `
        SELECT id, student_id FROM public.${table} 
        WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL);
      `;
      const orphans = await client.query(q);
      console.log(`Orphans in ${table}:`, orphans.rows.length);
      
      if (orphans.rows.length > 0) {
        console.log(`Deleting orphans from ${table}...`);
        await client.query(`
          DELETE FROM public.${table} 
          WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL);
        `);
      }
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
