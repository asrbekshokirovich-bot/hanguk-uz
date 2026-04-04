import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function getEnv() {
  const content = fs.readFileSync(".env", "utf8");
  const lines = content.split(/\r?\n/);
  const currentEnv = {};
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      currentEnv[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
    }
  }
  return currentEnv;
}

const envVars = getEnv();
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials", { supabaseUrl, supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOverlap() {
  const { data: applications, error: appErr } = await supabase.from("applications").select("student_id, university_id, universities(name_en)");
  if (appErr) return console.error("appErr", appErr);

  const { data: suggestions, error: sugErr } = await supabase.from("student_suggestions").select("id, student_id, university_id, universities(name_en)");
  if (sugErr) return console.error("sugErr", sugErr);

  let overlaps = [];
  for (const sug of suggestions) {
    const hasApplication = applications.some(app => app.student_id === sug.student_id && app.university_id === sug.university_id);
    if (hasApplication) {
      console.log(`FOUND OVERLAP! Student: ${sug.student_id}, University: ${sug.universities?.name_en || sug.university_id}`);
      overlaps.push(sug.id);
    }
  }
  console.log(`Total overlaps found: ${overlaps.length}`);
  
  if (overlaps.length > 0) {
    console.log("Cleaning up...");
    for(const id of overlaps) {
       await supabase.from("student_suggestions").delete().eq("id", id);
    }
    console.log("Cleanup complete!");
  }
}

checkOverlap();
