import fs from 'fs';
import { Client } from 'pg';

const connectionString = 'postgresql://postgres.lysjdtyanhdfphqyijsr:Hanguk2026!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  console.log('Connecting to new database...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Loading export file...');
    const data = JSON.parse(fs.readFileSync('legacy_export_v2.json', 'utf8'));

    // Disable triggers/foreign key checks temporarily
    console.log('Disabling foreign key constraints for bulk insertion...');
    await client.query("SET session_replication_role = 'replica';");

    // Synthesize auth.users to preserve IDs
    if (data.profiles && data.profiles.length > 0) {
      console.log(`Synthesizing ${data.profiles.length} users in auth.users...`);
      for (const profile of data.profiles) {
        const uid = profile.user_id;
        const email = profile.phone ? `${profile.phone}@hanguk.local` : `user_${uid.substring(0, 8)}@hanguk.local`;
        
        await client.query(`
          INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) 
          VALUES (
            '00000000-0000-0000-0000-000000000000', 
            $1, 
            'authenticated', 
            'authenticated', 
            $2, 
            crypt('HangukPassword123!', gen_salt('bf')), 
            now(), 
            '{"provider":"email","providers":["email"]}', 
            '{}', 
            now(), 
            now()
          ) ON CONFLICT (id) DO NOTHING;
        `, [uid, email]);
      }
    }

    // Prepare table insertion order
    const tableNames = Object.keys(data).filter(k => data[k] && data[k].length > 0);
    
    // Some tables might have arrays, we need to map column names securely
    for (const tableName of tableNames) {
      if (tableName === 'crm_students' || tableName === 'magic_access_codes') {
         // These are usually views, skip them directly if they error, but let's try.
      }
      
      const rows = data[tableName];
      if (!rows || rows.length === 0) continue;
      
      console.log(`Importing ${rows.length} rows into table: ${tableName}`);
      
      const columns = Object.keys(rows[0]);
      
      for (const row of rows) {
        const values = columns.map(c => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const colNames = columns.map(c => `"${c}"`).join(', ');
        
        try {
          await client.query(
            `INSERT INTO public."${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
        } catch (err) {
          // Ignore views or tables that can't be inserted into directly
          if (err.message.includes('is a view')) {
            break; // Stop trying this table if it's a view
          }
          if (!err.message.includes('does not exist')) {
            console.error(`Row error in ${tableName}:`, err.message);
          }
        }
      }
    }
    
    console.log('Restoring foreign key constraints...');
    await client.query("SET session_replication_role = 'origin';");
    
    // Give Asrbek an explicit admin role if not mapped perfectly by phone
    const asrbekRow = data.profiles?.find(p => p.username === 'asrbek' || p.full_name?.toLowerCase().includes('asrbek'));
    if (asrbekRow) {
      console.log(`Setting up Admin explicitly for ${asrbekRow.full_name} (${asrbekRow.user_id})`);
      // Update their auth email back to their real email so they can log in via frontend
      await client.query(`UPDATE auth.users SET email = 'asrbekshokirovich@gmail.com' WHERE id = $1`, [asrbekRow.user_id]);
      
      // Ensure they have the owner role
      await client.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'owner') ON CONFLICT DO NOTHING`, [asrbekRow.user_id]);
    }

    console.log('MIGRATION COMPLETE!');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
