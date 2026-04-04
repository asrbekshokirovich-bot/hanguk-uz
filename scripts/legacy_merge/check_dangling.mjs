
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

async function checkDangling() {
  const { data: suggestions, error: sugErr } = await supabase.from("student_suggestions").select("id, student_id, university_id, universities!left(name_en)");
  if (sugErr) return console.error("sugErr", sugErr);

  let dangling = [];
  for (const sug of suggestions) {
    if (!sug.universities) {
      console.log(`FOUND DANGLING SUGGESTION! ID: ${sug.id}, UnivID: ${sug.university_id}`);
      dangling.push(sug.id);
    }
  }
  console.log(`Total dangling found: ${dangling.length}`);
}

checkDangling();

