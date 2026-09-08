// instagram-token-refresh — refreshes long-lived Instagram tokens for all active accounts.
// Called weekly by pg_cron. Auth: x-refresh-secret header must equal instagram_app_config.verify_token.
//
// RECOVERED FROM PRODUCTION 2026-09-03. This function was running live and had
// never been committed; it is reproduced here verbatim. An Instagram long-lived
// token expires after 60 days, so if this stops running the Instagram channel
// goes dark two months later with no obvious cause — which is worth knowing
// given the Telegram channel had just done exactly that for a different reason.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const { data: cfg } = await admin.from("instagram_app_config").select("verify_token").eq("id", "main").maybeSingle();
  const secret = req.headers.get("x-refresh-secret");
  if (!cfg?.verify_token || !secret || secret !== cfg.verify_token) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const { data: accounts } = await admin.from("instagram_accounts").select("id, access_token, token_expires_at").eq("active", true);
  const results: any[] = [];
  for (const a of accounts ?? []) {
    try {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(a.access_token)}`);
      const j = await r.json();
      if (r.ok && j?.access_token) {
        const expiresAt = new Date(Date.now() + (j.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();
        await admin.from("instagram_accounts").update({ access_token: j.access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("id", a.id);
        results.push({ id: a.id, ok: true, expires_at: expiresAt });
      } else {
        console.error("refresh failed:", JSON.stringify(j));
        results.push({ id: a.id, ok: false, error: j?.error?.message ?? `HTTP ${r.status}` });
      }
    } catch (e) {
      results.push({ id: a.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
