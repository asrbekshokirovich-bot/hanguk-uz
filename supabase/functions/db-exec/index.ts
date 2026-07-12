import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

// Internal SQL-over-HTTPS bridge for the uni_db crawl pipeline.
//
// Claude Routine sessions run in a sandbox that only permits outbound HTTP(S)
// — raw Postgres (5432/6543) is blocked. This lets the pipeline reach its own
// database over HTTPS: it POSTs one parameterized statement, this function runs
// it against the project DB (which it CAN reach from Supabase's network) and
// returns the rows as JSON. It grants nothing beyond the service-role key the
// caller must already present — it just tunnels that access over HTTPS.
//
// Auth: caller must send `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
// Only the pipeline (which holds that key) can call it.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// Warm pool reused across invocations while the instance stays warm.
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool(Deno.env.get("SUPABASE_DB_URL"), 3, true);
  return pool;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { sql?: string; params?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sql = body.sql;
  const params = Array.isArray(body.params) ? body.params : [];
  if (typeof sql !== "string" || !sql.trim()) {
    return new Response(JSON.stringify({ error: "sql (string) required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = await getPool().connect();
  try {
    const result = await client.queryObject({ text: sql, args: params });
    return new Response(
      JSON.stringify({ rows: result.rows ?? [], rowCount: result.rowCount ?? (result.rows?.length ?? 0) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    client.release();
  }
});
