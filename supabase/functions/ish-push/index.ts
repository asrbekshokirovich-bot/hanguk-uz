// ish-push — Hanguk Ish push notifications (P56, 2026-11-13).
//
// A notification (ish.notifications) for someone with a phone registered for
// the app that shows it waits in ish.push_queue
// (hanguk_ish/supabase/migrations/20261113150000_ish_push.sql); the database
// calls this function through pg_net with the project's secret key — after
// the write, and every minute while something is due (pg_cron `ish-push`).
// It sends each one through FCM HTTP v1 with the service account of the
// Firebase project the apps are registered in (FCM_SERVICE_ACCOUNT_JSON —
// the one hanguk.uz's pushes use): the A12 / 알림 title and line, in the
// reader's language (push.ts). Refused: retried on the database's schedule
// (1, 2, 4, 8, 16 minutes); a token FCM no longer knows is dropped.
//
// Auth: server callers only (verify_jwt = false; isServiceRequest). It
// answers at once (202) and sends after the response (EdgeRuntime.waitUntil).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceRequest } from "../_shared/caller.ts";
import { fcmAccessToken, type ServiceAccount } from "../_shared/fcm.ts";
import { serviceKey } from "../_shared/keys.ts";
import { fcmMessage, pushStore, runPush, type Sender, tokenGone } from "./push.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function serviceAccount(): ServiceAccount | null {
  try {
    const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "");
    return sa?.client_email && sa?.private_key && sa?.project_id ? sa : null;
  } catch {
    return null;
  }
}

function sender(sa: ServiceAccount, access: string): Sender {
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  return async (token, text, data, ttl) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: fcmMessage(token, text, data, ttl) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      await res.body?.cancel();
      return { ok: true, gone: false };
    }
    const body = await res.text();
    return { ok: false, gone: tokenGone(res.status, body), error: `FCM ${res.status} ${body.slice(0, 300)}` };
  };
}

async function work(sa: ServiceAccount): Promise<void> {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    db: { schema: "ish" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const access = await fcmAccessToken(sa);
    const stats = await runPush(pushStore(db as any), sender(sa, access));
    if (stats.sent || stats.failed || stats.dropped) {
      console.log(`[ish-push] sent=${stats.sent} failed=${stats.failed} dropped=${stats.dropped} silent=${stats.silent}`);
    }
  } catch (e) {
    console.error("[ish-push] run failed:", e instanceof Error ? e.message : e);
  }
}

Deno.serve((req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!isServiceRequest(req)) return json(401, { error: "unauthorized" });
  const sa = serviceAccount();
  // Not set up: nothing is taken, the queue waits (a day at most).
  if (!sa) return json(503, { error: "FCM_SERVICE_ACCOUNT_JSON is not set" });
  const run = work(sa);
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(run);
    return json(202, { ok: true });
  }
  return run.then(() => json(200, { ok: true }));
});
