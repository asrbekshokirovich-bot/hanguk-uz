
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const content = fs.readFileSync(".env", "utf8");
const envVars = content.split(/\r?\n/).reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  return acc;
}, {});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

async function checkUniv() {
  const { data, error } = await supabase.from("universities").select("*").ilike("name_en", "%Gwangju%");
  console.log(data);
}
checkUniv();

