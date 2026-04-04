import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

async function testExtract() {
  console.log("Testing Anon Key extraction capability...")
  
  const tablesToTest = ['profiles', 'user_roles', 'magic_access_codes', 'crm_students']
  
  for (const table of tablesToTest) {
    const { data, error } = await supabase.from(table).select('*').limit(5)
    if (error) {
       console.log(`[${table}] Failed: ${error.message} (Code: ${error.code})`)
    } else {
       console.log(`[${table}] Success! Retrieved ${data.length} rows.`)
    }
  }
}

testExtract()
