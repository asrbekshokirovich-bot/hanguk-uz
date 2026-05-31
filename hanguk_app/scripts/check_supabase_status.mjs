import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lysjdtyanhdfphqyijsr.supabase.co";
const SUPABASE_KEY = "SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_LOAD_FROM_ENV";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStatus() {
  const { data, error } = await supabase
    .from('app_versions')
    .select('*');

  if (error) {
    console.error("Error fetching app versions:", error);
    return;
  }

  console.log("Current App Versions in Supabase:");
  console.log(JSON.stringify(data, null, 2));
}

checkStatus();
