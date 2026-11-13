// ish-delete-account — a Hanguk Ish user deletes their own account
// (Google Play's account-deletion rule, 2026-11-13). Called by both apps
// (Profile → «Akkauntni o'chirish») and by hanguk.uz/ish/delete-account, with
// the user's own token. What it deletes: delete.ts.
//
// Auth: verify_jwt = false (config.toml) so the browser's CORS preflight
// passes; the token is checked here with auth.getUser. The deleting is done
// with the service key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { publishableKey, serviceKey } from "../_shared/keys.ts";
import { deleteAccount, type DeleteStore } from "./delete.ts";

const cors = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const AVATARS = "ish-avatars";

function store(url: string): DeleteStore {
  const admin = createClient(url, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const ish = admin.schema("ish");
  const must = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };
  return {
    async isStaff(id) {
      const rows = must(await ish.from("staff_members").select("user_id").eq("user_id", id).limit(1), "staff");
      return (rows ?? []).length > 0;
    },
    async ownedBusinesses(id) {
      const rows = must(await ish.from("businesses").select("id").eq("owner_id", id), "businesses");
      return (rows ?? []).map((r: { id: string }) => r.id);
    },
    async deleteBusinesses(ids) {
      must(await ish.from("businesses").delete().in("id", ids), "delete businesses");
    },
    async avatarPaths(id) {
      const files = must(await admin.storage.from(AVATARS).list(id, { limit: 1000 }), "list avatars");
      return (files ?? []).filter((f: { name: string }) => f.name).map((f: { name: string }) => `${id}/${f.name}`);
    },
    async removeAvatars(paths) {
      must(await admin.storage.from(AVATARS).remove(paths), "remove avatars");
    },
    async deleteUser(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error(`delete user: ${error.message}`);
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD" });

  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return json(401, { error: "UNAUTHENTICATED" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const client = createClient(url, publishableKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return json(401, { error: "UNAUTHENTICATED" });

  try {
    const result = await deleteAccount(data.user, store(url));
    return result.ok ? json(200, result) : json(result.status, { error: result.error });
  } catch (e) {
    console.error("ish-delete-account", e);
    return json(500, { error: "FAILED" });
  }
});
