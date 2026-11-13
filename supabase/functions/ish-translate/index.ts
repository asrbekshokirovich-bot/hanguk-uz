// ish-translate — Hanguk Ish's machine translation (P55, 2026-11-13).
//
// The database queues what is written — chat messages, shifts, businesses
// (hanguk_ish/supabase/migrations/20261113120000_ish_translations.sql) — and
// calls this function through pg_net with the project's secret key: after
// each write, and every minute while something is due (pg_cron
// `ish-translate`). It takes the due rows (ish.translation_claim), translates
// them with Hanguk AI's providers (../hanguk-ai-chat/llm.ts — the same keys
// and order, no key of its own) and writes the result (ish.translation_save),
// which the database takes only while the original is unchanged. A failed
// try is retried on the database's schedule (1, 2, 4 … 60 minutes, 10 tries).
//
// Auth: server callers only (an sb_secret_ / service_role key; verify_jwt =
// false, as for the other pg_net callers). It answers at once (202) and
// works after the response (EdgeRuntime.waitUntil).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatCompletion, chatProviders } from "../hanguk-ai-chat/llm.ts";
import { isServiceRequest } from "../_shared/caller.ts";
import { serviceKey } from "../_shared/keys.ts";
import { chatLlm, runQueue, supabaseStore } from "./translate.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function work(): Promise<void> {
  const started = Date.now();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    db: { schema: "ish" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const stats = await runQueue(supabaseStore(db as any), chatLlm(chatCompletion as any));
    if (stats.calls || stats.saved || stats.failed || stats.stale) {
      const ms = Date.now() - started;
      const { saved, stale, failed, calls } = stats;
      console.log(`[ish-translate] saved=${saved} stale=${stale} failed=${failed} calls=${calls} ms=${ms}`);
    }
  } catch (e) {
    console.error("[ish-translate] run failed:", e instanceof Error ? e.message : e);
  }
}

Deno.serve((req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!isServiceRequest(req)) return json(401, { error: "unauthorized" });
  // No provider: the rows wait in the queue (the minute job asks again).
  if (chatProviders().length === 0) return json(503, { error: "ai_not_configured" });
  const run = work();
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(run);
    return json(202, { ok: true });
  }
  return run.then(() => json(200, { ok: true }));
});
