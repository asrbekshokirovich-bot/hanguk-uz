import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const checkOrphansData = await client.query(`
      SELECT student_id FROM public.student_suggestions 
      WHERE student_id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL);
    `);
    
    console.log(`Orphaned student_id in student_suggestions:`, checkOrphansData.rows);

    // Delete orphans from student_suggestions
    if (checkOrphansData.rows.length > 0) {
      console.log('Deleting orphaned student_suggestions...');
      await client.query(`
        DELETE FROM public.student_suggestions 
        WHERE student_id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL);
      `);
      console.log('Deleted orphaned student_suggestions.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
