// ish-translate against a real database: a local Supabase stack with the
// Hanguk Ish migrations (CI: ish-integration.yml). What the triggers queue,
// translation_claim / _save / _fail through PostgREST with the service key,
// and what lands in the rows the apps read. The model is a stand-in.
//
//   ISH_IT_URL=http://127.0.0.1:54321 ISH_IT_SERVICE_KEY=<service key> \
//     deno test --no-check --allow-env --allow-net supabase/functions/ish-translate/integration_test.ts
//
// Without the two variables (edge-check.yml, a laptop) the test is skipped.
// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "jsr:@std/assert@1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runQueue, supabaseStore, SYSTEM } from "./translate.ts";

const url = Deno.env.get("ISH_IT_URL") ?? "";
const key = Deno.env.get("ISH_IT_SERVICE_KEY") ?? "";

/** Answers every item: «[ru] …» for each field and language asked. */
function standIn(log: string[]) {
  return (system: string, user: string) => {
    const kind = Object.entries(SYSTEM).find(([, s]) => s === system)?.[0] ?? "?";
    log.push(kind);
    const items = JSON.parse(user).items as Record<string, string>[];
    const langs = kind === "business" ? ["uz", "ru", "en"] : ["uz", "ru", "en", "ko"];
    return Promise.resolve(JSON.stringify({
      items: items.map(({ id, ...fields }) => {
        const korean = Object.values(fields).some((v) => /[가-힣]/.test(v));
        const out: Record<string, unknown> = { id, source: korean ? "ko" : "uz" };
        for (const lang of langs) {
          const translated = Object.fromEntries(Object.entries(fields).map(([f, v]) => [f, `[${lang}] ${v}`]));
          out[lang] = kind === "message" ? translated.text : translated;
        }
        return out;
      }),
    }));
  };
}

const phone = () => `8210${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

Deno.test({
  name: "a message, a shift and a business are queued, translated and read back",
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

    // A worker and an owner (phone accounts get their ish profile from the database).
    const worker = must(await root.auth.admin.createUser({ phone: phone(), phone_confirm: true }), "worker").user!;
    const owner = must(await root.auth.admin.createUser({ phone: phone(), phone_confirm: true }), "owner").user!;
    const business: any = must(
      await db.rpc("register_business", {
        p_owner: owner.id,
        p_biz_no: String(Math.floor(1e9 + Math.random() * 8e9)),
        p_name: "번역카페 합정점",
        p_nts_status: "01",
        p_category: "cafe",
        p_address: "마포구 양화로 160",
      }),
      "business",
    );
    const start = new Date(Date.now() + 2 * 86400_000);
    const shift: any = must(
      await db.from("shifts").insert({
        business_id: business.id,
        title: "홀 서빙",
        duties: "서빙\n테이블 정리",
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 4 * 3600_000).toISOString(),
        hourly_wage: 11000,
        slots: 2,
      }).select("id").single(),
      "shift",
    );
    const application: any = must(
      await db.from("applications").insert({ shift_id: shift.id, worker_id: worker.id, status: "confirmed" })
        .select("id").single(),
      "application",
    );
    const message: any = must(
      await db.from("messages").insert({
        application_id: application.id,
        sender_id: worker.id,
        body: "Salom! Ertaga 10:00 da kelaman",
      }).select("id").single(),
      "message",
    );

    // Queued by the database.
    const queued = must(
      await db.from("translation_queue").select("kind, ref, attempts")
        .in("ref", [String(message.id), shift.id, business.id]),
      "queue",
    ) as any[];
    assertEquals(queued.map((q) => q.kind).sort(), ["business", "message", "shift"]);

    // Translated (with whatever the earlier tests on this stack left queued).
    const log: string[] = [];
    const stats = await runQueue(supabaseStore(db as any), standIn(log));
    assertEquals(stats.failed, 0);
    assertEquals(log.includes("message") && log.includes("shift") && log.includes("business"), true);

    const m: any = must(await db.from("messages").select("lang, translations").eq("id", message.id).single(), "m");
    assertEquals(m.lang, "uz");
    assertEquals(m.translations, {
      ru: "[ru] Salom! Ertaga 10:00 da kelaman",
      en: "[en] Salom! Ertaga 10:00 da kelaman",
      ko: "[ko] Salom! Ertaga 10:00 da kelaman",
    });
    const s: any = must(await db.from("shifts").select("translations").eq("id", shift.id).single(), "s");
    assertEquals(Object.keys(s.translations).sort(), ["en", "ru", "uz"]);
    assertEquals(s.translations.uz, { title: "[uz] 홀 서빙", duties: "[uz] 서빙\n테이블 정리" });
    const b: any = must(
      await db.from("businesses").select("name_i18n, translations").eq("id", business.id).single(),
      "b",
    );
    assertEquals(b.name_i18n, { uz: "[uz] 번역카페 합정점", ru: "[ru] 번역카페 합정점", en: "[en] 번역카페 합정점" });
    assertEquals(b.translations.en, { address: "[en] 마포구 양화로 160" });
    const left = must(
      await db.from("translation_queue").select("ref").in("ref", [String(message.id), shift.id, business.id]),
      "left",
    ) as any[];
    assertEquals(left, [], "off the queue");

    // A text that changes while it is being translated: the old translation
    // is refused, the new text waits.
    must(await db.from("shifts").update({ title: "마감 정리" }).eq("id", shift.id), "retitle");
    const [job] = (await supabaseStore(db as any).claim(50)).filter((j) => j.ref === shift.id);
    assertEquals(job.texts.title, "마감 정리");
    must(await db.from("shifts").update({ title: "오픈 준비" }).eq("id", shift.id), "retitle again");
    assertEquals(
      await supabaseStore(db as any).save(job, { lang: "ko", translations: { uz: { title: "Yopish" } }, names: {} }),
      false,
    );
    const again = must(
      await db.from("translation_queue").select("attempts").eq("kind", "shift").eq("ref", shift.id).single(),
      "again",
    ) as any;
    assertEquals(again.attempts, 0);
    assertEquals(
      (must(await db.from("shifts").select("translations").eq("id", shift.id).single(), "t") as any).translations,
      {},
    );

    // A failure is recorded on the row.
    await supabaseStore(db as any).fail(job, "the model said nothing");
    const failed = must(
      await db.from("translation_queue").select("last_error").eq("kind", "shift").eq("ref", shift.id).single(),
      "failed",
    ) as any;
    assertEquals(failed.last_error, "the model said nothing");
  },
});
