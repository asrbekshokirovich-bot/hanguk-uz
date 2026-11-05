// orbit-signal — receives "something changed" pings from cross-project sources
// (e.g. SkillHub triggers via pg_net) and records a non-sensitive change signal
// that the dashboard's realtime subscription listens for.
// verify_jwt = false; authenticated by the x-signal-secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const orbit = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "orbit" }, auth: { persistSession: false } });
const SECRET = Deno.env.get("ORBIT_SIGNAL_SECRET") || "";

Deno.serve(async (req) => {
  if (req.headers.get("x-signal-secret") !== SECRET) return new Response("forbidden", { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch { /* */ }
  await orbit.from("change_signals").insert({ source: b.source || "skillhub", table_name: b.table || "?", op: b.op || null });
  return new Response("ok");
});
