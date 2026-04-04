
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function getEnv() {
  const content = fs.readFileSync(".env", "utf8");
  return content.split(/\r?\n/).reduce((acc, line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) acc[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
    return acc;
  }, {});
}
const envVars = getEnv();
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

async function listAll() {
  const { data: suggestions, error: sugErr } = await supabase.from("student_suggestions").select("id, student_id, universities(name_en), profiles(full_name)");
  if (sugErr) return console.error(sugErr);
  
  console.log(JSON.stringify(suggestions, null, 2));
}

listAll();

