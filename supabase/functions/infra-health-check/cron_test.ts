// deno test supabase/functions/infra-health-check/cron_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { type CronFailure, cronJobsLine } from "./cron.ts";

const job = (o: Partial<CronFailure> = {}): CronFailure => ({
  jobname: "app-signals", failed_runs: 3, last_error: null, failing_since: null, ...o,
});

Deno.test("no failing job is ok", () => {
  assertEquals(cronJobsLine([]), { state: "ok", detail: "hamma cron ishi ishlayapti" });
});

Deno.test("a failing job is named, with when it started and what it says", () => {
  const line = cronJobsLine([job({
    failing_since: "2026-11-07T12:10:00.334423+00:00",
    last_error: 'ERROR:  insert or update on table "student_stage_notifications"\nviolates foreign key constraint',
  })]);
  assertEquals(line.state, "fail");
  assertEquals(
    line.detail,
    "1 ta ish ketma-ket yiqilyapti: app-signals (2026-11-07 12:10 UTC dan beri)\n" +
      'app-signals: ERROR: insert or update on table "student_stage_notifications" violates foreign key constraint',
  );
});

Deno.test("many failing jobs: five names, the rest counted; a long error is cut", () => {
  const rows = ["a", "b", "c", "d", "e", "f", "g"].map((n) => job({ jobname: n, last_error: "x".repeat(500) }));
  const line = cronJobsLine(rows);
  assertEquals(line.detail.split("\n")[0], "7 ta ish ketma-ket yiqilyapti: a, b, c, d, e va yana 2 ta");
  assertEquals(line.detail.split("\n")[1], "a: " + "x".repeat(200));
});
