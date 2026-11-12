// deno test supabase/functions/instagram-webhook/background_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { retryFilter, runAfterResponse, STALE_EVENT_MS } from "./background.ts";

Deno.test("without the edge runtime the caller keeps the work", async () => {
  let done = false;
  const work = Promise.resolve().then(() => { done = true; });
  assertEquals(runAfterResponse(work), false);
  await work;
  assertEquals(done, true);
});

Deno.test("with the edge runtime the work is handed over, not awaited", async () => {
  const handed: Promise<unknown>[] = [];
  const runtime = globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } };
  runtime.EdgeRuntime = { waitUntil: (p) => { handed.push(p); } };
  try {
    let release!: () => void;
    const work = new Promise<void>((resolve) => { release = resolve; });
    // Returns at once although the work has not finished.
    assertEquals(runAfterResponse(work), true);
    assertEquals(handed.length, 1);
    assertEquals(handed[0], work);
    release();
    await work;
  } finally {
    delete runtime.EdgeRuntime;
  }
});

Deno.test("upkeep retries what failed and what was left unfinished for five minutes", () => {
  const now = Date.parse("2026-11-12T09:30:00.000Z");
  assertEquals(STALE_EVENT_MS, 5 * 60 * 1000);
  assertEquals(retryFilter(now), "error.not.is.null,created_at.lt.2026-11-12T09:25:00.000Z");
});
