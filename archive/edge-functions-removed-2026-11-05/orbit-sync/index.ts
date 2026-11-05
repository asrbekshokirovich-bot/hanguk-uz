import { createClient } from "npm:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const J = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function ownerUid(): Promise<string | null> {
  const { data: c } = await db.from("orbit_sync_config").select("value").eq("key", "owner_uid").maybeSingle();
  if (c?.value) return c.value;
  const { data: o } = await db.from("user_roles").select("user_id").eq("role", "owner").limit(1).maybeSingle();
  return o?.user_id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return J({ service: "orbit-sync" });
  const { data: k } = await db.from("orbit_sync_config").select("value").eq("key", "sync_secret").maybeSingle();
  if (!k?.value || req.headers.get("x-sync-key") !== k.value) return J({ error: "unauthorized" }, 401);
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch { /* empty */ }
  try {
    switch (b.op) {
      case "pull_tasks": {
        const { data, error } = await db.rpc("orbit_pull_tasks", { p_since: b.since || "2000-01-01T00:00:00+00:00" });
        if (error) throw error;
        return J({ tasks: data, now: new Date().toISOString() });
      }
      case "push_task": {
        const t = b.task || {};
        if (!t.external_id || !t.title) return J({ error: "bad args" }, 400);
        const row: Record<string, unknown> = {
          title: t.title,
          description: t.description ?? null,
          priority: ["urgent", "high", "normal", "low"].includes(t.priority) ? t.priority : "normal",
          status: ["todo", "in_progress", "completed", "cancelled"].includes(t.status) ? t.status : "todo",
          due_date: t.due_at ?? null,
          external_task_id: String(t.external_id),
          source: "orbit",
          updated_at: new Date().toISOString(),
        };
        if (t.assigned_to_uid) row.assigned_to = t.assigned_to_uid;
        if (row.status === "completed") row.completed_at = new Date().toISOString();
        const { data: ex } = await db.from("tasks").select("id").eq("external_task_id", String(t.external_id)).maybeSingle();
        if (ex) {
          const { error } = await db.from("tasks").update(row).eq("id", ex.id);
          if (error) throw error;
          return J({ ok: true, id: ex.id, updated: true });
        }
        const cb = await ownerUid();
        if (!cb) return J({ error: "no owner uid for created_by" }, 500);
        row.created_by = cb;
        const { data, error } = await db.from("tasks").insert(row).select("id").single();
        if (error) throw error;
        return J({ ok: true, id: data.id, created: true });
      }
      case "set_status": {
        const id = String(b.task_id || "");
        const st = String(b.status || "");
        if (!id || !["todo", "in_progress", "completed", "cancelled"].includes(st)) return J({ error: "bad args" }, 400);
        const row: Record<string, unknown> = { status: st, updated_at: new Date().toISOString() };
        if (st === "completed") row.completed_at = new Date().toISOString();
        const { data, error } = await db.from("tasks").update(row).eq("id", id).select("id").maybeSingle();
        if (error) throw error;
        return J({ ok: true, found: !!data });
      }
      case "pull_finance": {
        const { data, error } = await db.rpc("orbit_pull_finance", { p_from: b.from || "2026-01-01" });
        if (error) throw error;
        return J(data);
      }
      case "staff": {
        const { data, error } = await db.rpc("orbit_staff");
        if (error) throw error;
        return J({ staff: data });
      }
      default:
        return J({ error: "unknown op" }, 400);
    }
  } catch (e) {
    console.error("orbit-sync error", e);
    return J({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
