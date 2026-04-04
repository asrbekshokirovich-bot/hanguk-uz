import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const q = `
      SELECT id, student_id FROM public.calls 
      WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL);
    `;
    const orphans = await client.query(q);
    console.log(`Orphans in calls:`, orphans.rows.length);
    
    if (orphans.rows.length > 0) {
      console.log(`Deleting orphans from calls...`);
      await client.query(`
        DELETE FROM public.calls 
        WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL);
      `);
    }

    console.log('Fixing constraints for calls...');
    await client.query(`ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_student_id_fkey;`);
    await client.query(`ALTER TABLE public.calls ADD CONSTRAINT calls_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;`);
    console.log('Done mapping calls table.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
