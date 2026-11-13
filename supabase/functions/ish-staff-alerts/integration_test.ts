// ish-staff-alerts against a real database: a local Supabase stack with the
// Hanguk Ish migrations (CI: ish-integration.yml). What the triggers put in
// the outbox, staff_alerts_claim / _done / _fail through PostgREST with the
// service key; Telegram is a stand-in.
//
//   ISH_IT_URL=http://127.0.0.1:54321 ISH_IT_SERVICE_KEY=<service key> \
//     deno test --no-check --allow-env --allow-net supabase/functions/ish-staff-alerts/integration_test.ts
//
// Without the two variables (edge-check.yml, a laptop) the test is skipped.
// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "jsr:@std/assert@1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { outboxStore, runAlerts } from "./alerts.ts";

const url = Deno.env.get("ISH_IT_URL") ?? "";
const key = Deno.env.get("ISH_IT_SERVICE_KEY") ?? "";
const phone = () => `8210${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

Deno.test({
  name: "an app business and a complaint reach the staff's chat; one that fails waits for its next try",
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
    must(await db.from("profiles").update({ first_name: "Malika", last_name: "Yusupova" }).eq("id", worker.id), "name");
    const name = `사업장 알림${Math.floor(Math.random() * 1e6)}`;
    const business: any = must(
      await db.from("businesses").insert({ owner_id: owner.id, name, status: "verified" }).select("id").single(),
      "business",
    );
    const report: any = must(
      await db.from("reports").insert({
        reporter_id: worker.id,
        business_id: business.id,
        reason: "safety",
        body: "Omborda dubulg'a berilmadi",
      }).select("id").single(),
      "report",
    );
    const waiting = must(
      await db.from("staff_alerts").select("kind").in("ref", [business.id, report.id]).is("sent_at", null),
      "outbox",
    ) as any[];
    assertEquals(waiting.map((w) => w.kind).sort(), ["business_opened", "report"]);
    // What the earlier tests on this stack left waiting is not this test's.
    must(
      await db.from("staff_alerts").update({ sent_at: new Date().toISOString() }).is("sent_at", null)
        .not("ref", "in", `(${business.id},${report.id})`),
      "others",
    );

    // Telegram refuses once: the run stops, the message waits.
    const refused: string[] = [];
    const first = await runAlerts(outboxStore(db as any), (t) => {
      refused.push(t);
      return Promise.resolve({ ok: false, description: "Telegram 429 Too Many Requests" });
    });
    assertEquals(first, { sent: 0, failed: 1 });
    const failed = must(
      await db.from("staff_alerts").select("attempts, last_error, sent_at").not("last_error", "is", null)
        .in("ref", [business.id, report.id]),
      "failed",
    ) as any[];
    assertEquals(failed.length, 1);
    assertEquals(failed[0].last_error, "Telegram 429 Too Many Requests");

    // Its next try (pulled forward here); now it goes, and the rest with it.
    must(await db.from("staff_alerts").update({ next_at: new Date(0).toISOString() }).is("sent_at", null), "due");
    const sent: string[] = [];
    const second = await runAlerts(outboxStore(db as any), (t) => {
      sent.push(t);
      return Promise.resolve({ ok: true });
    });
    assertEquals(second.failed, 0);
    assertEquals(sent.some((t) => t.includes(name) && t.includes("yangi biznes")), true);
    assertEquals(
      sent.some((t) => t.includes("Xavfsizlik") && t.includes("Malika Yusupova") && t.includes("dubulg'a")),
      true,
    );
    const left = must(
      await db.from("staff_alerts").select("kind").in("ref", [business.id, report.id]).is("sent_at", null),
      "left",
    ) as any[];
    assertEquals(left, [], "both sent");
  },
});
