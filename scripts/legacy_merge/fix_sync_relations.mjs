import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const queries = [
      // Fix student_suggestions
      `ALTER TABLE public.student_suggestions DROP CONSTRAINT IF EXISTS student_suggestions_student_id_fkey;`,
      `ALTER TABLE public.student_suggestions ADD CONSTRAINT student_suggestions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;`,

      // Fix applications
      `ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_student_id_fkey;`,
      `ALTER TABLE public.applications ADD CONSTRAINT applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;`,

      // Fix documents
      `ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_student_id_fkey;`,
      `ALTER TABLE public.documents ADD CONSTRAINT documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;`,

      // Fix student_notes
      `ALTER TABLE public.student_notes DROP CONSTRAINT IF EXISTS student_notes_student_id_fkey;`,
      `ALTER TABLE public.student_notes ADD CONSTRAINT student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;`,

      // Fix student_comments
      `ALTER TABLE public.student_comments DROP CONSTRAINT IF EXISTS student_comments_student_id_fkey;`,
      `ALTER TABLE public.student_comments ADD CONSTRAINT student_comments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;`,

      // Fix payments
      `ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;`,
      `ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;`
    ];

    for (const q of queries) {
      console.log('Executing:', q);
      await client.query(q);
    }

    console.log('Successfully updated constraints to enable cascading updates on fake UUIDs.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
