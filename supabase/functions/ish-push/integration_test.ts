// ish-push against a real database: a local Supabase stack with the Hanguk
// Ish migrations (CI: ish-integration.yml). A notification for someone with
// a phone registered waits in ish.push_queue; push_claim / _done /
// _drop_token through PostgREST with the service key; FCM is a stand-in.
//
//   ISH_IT_URL=http://127.0.0.1:54321 ISH_IT_SERVICE_KEY=<service key> \
//     deno test --no-check --allow-env --allow-net --allow-read supabase/functions/ish-push/integration_test.ts
//
// Without the two variables (edge-check.yml, a laptop) the test is skipped.
// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "jsr:@std/assert@1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pushStore, runPush } from "./push.ts";

const url = Deno.env.get("ISH_IT_URL") ?? "";
const key = Deno.env.get("ISH_IT_SERVICE_KEY") ?? "";
const phone = () => `8210${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

Deno.test({
  name: "a notification reaches the worker's phone in their language; a gone phone is forgotten",
  ignore: !url || !key,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const root = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const db = createClient(url, key, {
      db: { schema: "ish" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const must = <T>(r: { data: T; error: any }, what: string): T => {
      if (r.error) throw new Error(`${what}: ${r.error.message}`);
      return r.data;
    };
    const owner = must(await root.auth.admin.createUser({ phone: phone(), phone_confirm: true }), "owner").user!;
    const worker = must(await root.auth.admin.createUser({ phone: phone(), phone_confirm: true }), "worker").user!;
    must(await db.from("profiles").update({ language: "ru" }).eq("id", worker.id), "language");
    const name = `사업장 푸시${Math.floor(Math.random() * 1e6)}`;
    const business: any = must(
      await db.from("businesses").insert({ owner_id: owner.id, name, area: "신촌", status: "verified" })
        .select("id").single(),
      "business",
    );
    const ok = `it-ok-${crypto.randomUUID()}`;
    const gone = `it-gone-${crypto.randomUUID()}`;
    must(
      await db.from("push_tokens").insert([
        { token: gone, user_id: worker.id, app: "worker", updated_at: new Date(Date.now() - 60_000).toISOString() },
        { token: ok, user_id: worker.id, app: "worker" },
      ]),
      "tokens",
    );
    // The owner has no phone for the 사장님 app: nothing waits for them.
    const notes: any[] = must(
      await db.from("notifications").insert([
        { user_id: worker.id, kind: "application_confirmed", data: { business_id: business.id } },
        { user_id: owner.id, kind: "new_applicant", data: { worker_id: worker.id } },
      ]).select("id, user_id"),
      "notifications",
    ) as any[];
    const mine = notes.find((n) => n.user_id === worker.id).id;
    const waiting = must(
      await db.from("push_queue").select("notification_id").in("notification_id", notes.map((n) => n.id)),
      "queue",
    ) as any[];
    assertEquals(waiting.map((w) => w.notification_id), [mine]);
    // What the earlier tests on this stack left waiting is not this test's.
    must(await db.from("push_queue").delete().neq("notification_id", mine), "others");

    const sent: [string, string, string, Record<string, string>][] = [];
    const stats = await runPush(pushStore(db as any), (token, text, data) => {
      sent.push([token, text.title, text.body, data]);
      return Promise.resolve(token === gone ? { ok: false, gone: true, error: "FCM 404 UNREGISTERED" } : { ok: true, gone: false });
    });
    assertEquals(stats, { sent: 1, failed: 0, dropped: 1, silent: 0 });
    assertEquals(sent.map((s) => s[0]), [ok, gone], "the newest phone first");
    assertEquals(sent[0][1], "Смена подтверждена", "in Russian, as A12 shows it");
    assertEquals(sent[0][2], `${name} · 신촌`, "the business under it");
    assertEquals(sent[0][3], { kind: "application_confirmed", notification_id: String(mine), app: "worker" });
    const tokens = must(await db.from("push_tokens").select("token").eq("user_id", worker.id), "left") as any[];
    assertEquals(tokens.map((t) => t.token), [ok], "the gone one is dropped");
    const left = must(await db.from("push_queue").select("notification_id").eq("notification_id", mine), "sent") as any[];
    assertEquals(left, [], "sent: off the queue");
  },
});
