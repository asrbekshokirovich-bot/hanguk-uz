import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Create the INSERT policy
    const query = `
      DO $$
      BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'applications' 
            AND policyname = 'Students can insert their own applications'
        ) THEN
            CREATE POLICY "Students can insert their own applications" 
            ON public.applications 
            FOR INSERT 
            WITH CHECK (auth.uid() = student_id);
        END IF;
      END
      $$;
    `;
    
    console.log('Applying RLS Insert Policy to applications...');
    await client.query(query);
    console.log('Policy successfully applied!');
  } catch (err) {
    console.error('Error applying policy:', err);
  } finally {
    await client.end();
  }
}

run();
