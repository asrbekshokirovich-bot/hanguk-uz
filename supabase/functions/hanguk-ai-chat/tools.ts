// Read-only SQL tool for Hanguk AI's staff analytics.
//
// Lets the assistant COUNT / AGGREGATE / JOIN / CONCLUDE over real data by
// running SQL — but only ever against the `ai` schema of safe views (no
// secrets), only SELECT/WITH, only inside a READ ONLY transaction with a
// statement timeout and a hard row cap. Defense in depth:
//   1. Column safety   — the `ai` views expose safe columns only (migration).
//   2. search_path=ai   — bare table names resolve to those views, nothing else.
//   3. Denylist         — blocks writes and any cross-schema / secret reference.
//   4. READ ONLY txn    — Postgres itself rejects any write, whatever the text.
//   5. Owner/admin only — the caller gates who ever gets this tool (index.ts).
//
// deno-lint-ignore-file no-explicit-any
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = new Pool(Deno.env.get("SUPABASE_DB_URL"), 3, true);
  return pool;
}

const MAX_ROWS = 500;

// Word-bounded data-changing verbs. created_at / updated_at etc. don't match
// (the trailing letter kills the \b). Kept deliberately tight — real DML/DDL
// only — so common search terms and aliases ("call", "do", "copy", "lock", …)
// aren't rejected; anything else that isn't a SELECT is caught by the READ ONLY
// transaction at execution time regardless.
const DENY_WRITE = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|merge)\b/i;
// Substring bans: cross-schema hops and anything secret-shaped. search_path only
// covers *bare* names, so qualified `public.profiles` must be blocked here.
const DENY_EXPOSURE = /(public\.|auth\.|vault\.|storage\.|extensions\.|cron\.|pg_|information_schema|password|magic_code|\bsip\d|decrypted_secret|service_role|current_setting|set_config|pg_sleep|dblink|lo_import|lo_export)/i;

export type QueryResult = { rows?: any[]; error?: string; note?: string; rowCount?: number };

/** Validate + run one read-only SELECT against the `ai` views. Never throws. */
export async function runReadOnlyQuery(sql: unknown): Promise<QueryResult> {
  if (typeof sql !== "string") return { error: "sql must be a string" };
  let q = sql.trim().replace(/;+\s*$/, "").trim();
  if (!q) return { error: "empty query" };
  if (q.includes(";")) return { error: "only a single statement is allowed (remove the ';')" };
  if (!/^(select|with)\b/i.test(q)) return { error: "only SELECT / WITH queries are allowed" };
  if (DENY_WRITE.test(q)) return { error: "write statements are not allowed — this tool is read-only" };
  if (DENY_EXPOSURE.test(q)) return { error: "query references a forbidden schema or column; use only the ai.* views and their listed columns" };

  const capped = `select * from (${q}) as _ai_sub limit ${MAX_ROWS}`;
  let client;
  try {
    client = await getPool().connect();
  } catch (e) {
    return { error: `db connection failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    await client.queryArray("begin read only");
    await client.queryArray("set local statement_timeout = '8000ms'");
    await client.queryArray("set local search_path = ai, pg_catalog");
    const res = await client.queryObject(capped);
    const rows = res.rows ?? [];
    return {
      rows,
      rowCount: rows.length,
      note: rows.length >= MAX_ROWS ? `truncated at ${MAX_ROWS} rows — refine with a tighter WHERE or an aggregate` : undefined,
    };
  } catch (e) {
    // Hand the DB error back to the model so it can fix its own SQL and retry.
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    try { await client.queryArray("rollback"); } catch { /* ignore */ }
    client.release();
  }
}

// Cache the schema string across warm invocations — it only changes on migration.
let schemaCache: string | null = null;

/** A compact `view(col type, …)` map of the ai schema, read from the catalog. */
export async function getAiSchema(): Promise<string> {
  if (schemaCache) return schemaCache;
  let client;
  try {
    client = await getPool().connect();
  } catch {
    return "(schema unavailable)";
  }
  try {
    const res = await client.queryObject<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name, column_name, data_type
         from information_schema.columns
        where table_schema = 'ai'
        order by table_name, ordinal_position`,
    );
    const byTable = new Map<string, string[]>();
    for (const r of res.rows) {
      if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
      byTable.get(r.table_name)!.push(`${r.column_name} ${r.data_type}`);
    }
    if (!byTable.size) return "(no ai views found)";
    const lines = [...byTable.entries()].map(([t, cols]) => `ai.${t}(${cols.join(", ")})`);
    schemaCache = lines.join("\n");
    return schemaCache;
  } catch (e) {
    return `(schema introspection failed: ${e instanceof Error ? e.message : String(e)})`;
  } finally {
    client.release();
  }
}

// OpenAI-compatible tool declaration (Gemini's OpenAI shim understands this).
export const QUERY_TOOL = {
  type: "function",
  function: {
    name: "query_database",
    description:
      "Run ONE read-only SQL SELECT against the ai.* analytics views to count, sum, average, group, join, filter or otherwise compute an exact answer over the whole CRM (students, applications, payments, documents, leads, calls, messages, tasks). Use this for any 'how many / how much / which / list / average / total / by-<group>' question instead of guessing. You may call it several times — e.g. first inspect the distinct values of a status/decision column, then compute. Postgres dialect; single statement, no semicolon; results are capped at 500 rows.",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "A single Postgres SELECT (or WITH … SELECT) over the ai.* views. Bare table names resolve to the ai schema, e.g. `select count(*) from applications where decision = 'accepted'`.",
        },
      },
      required: ["sql"],
    },
  },
};
