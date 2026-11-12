// deno test supabase/functions/infra-health-check/crashes_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { crashLine, type CrashRow, isStaleChunk } from "./crashes.ts";

const row = (path: string | null, message: string, hits: number, user: string): CrashRow => ({ path, message, hits, user_id: user });

Deno.test("no crash within the window is ok", () => {
  assertEquals(crashLine([], 24), { state: "ok", detail: "so'nggi 24 soatda birorta sahifa yiqilmadi" });
});

Deno.test("one crash names the page, the error and how often", () => {
  assertEquals(crashLine([row("/crm/leads", "Cannot read properties of undefined (reading 'map')", 2, "u1")], 24), {
    state: "fail",
    detail: "so'nggi 24 soatda 2 marta, 1 xodimda:\n/crm/leads — Cannot read properties of undefined (reading 'map') (2 marta)",
  });
});

Deno.test("the same crash for several people and hours is one line; the worst three are shown", () => {
  const r = crashLine([
    row("/crm/leads", "Boom", 2, "u1"),
    row("/crm/leads", "Boom", 5, "u2"),
    row("/crm/leads", "Boom", 1, "u1"), // another hour, the same person
    row("/crm/students", "No   student\n  found", 3, "u3"),
    row("/crm/payments", "x is not a function", 1, "u1"),
    row(null, "Minified React error #310", 1, "u2"),
  ], 24);
  assertEquals(r.state, "fail");
  assertEquals(r.detail, [
    "so'nggi 24 soatda 13 marta, 3 xodimda:",
    "/crm/leads — Boom (8 marta)",
    "/crm/students — No student found (3 marta)",
    "/crm/payments — x is not a function (1 marta)",
    "…va yana 1 xil xato",
  ].join("\n"));
});

Deno.test("a long message is cut and a missing hit count is one", () => {
  const r = crashLine([{ path: "/crm", message: "m".repeat(500), hits: 0, user_id: "u1" }], 6);
  assertEquals(r.detail, `so'nggi 6 soatda 1 marta, 1 xodimda:\n/crm — ${"m".repeat(160)} (1 marta)`);
});

// What an open tab reported on 2026-11-12 after a deploy (web_client_errors).
const STALE_STACK = "TypeError: Cannot read properties of undefined (reading 'default')\n    at y_ (https://www.hanguk.uz/assets/index-CFgAqY25.js:10:3572)\n\n    at Lazy\n    at Suspense\n    at Ex (https://www.hanguk.uz/assets/index-CFgAqY25.js:287:187)";
const stale: CrashRow = {
  path: "/crm/university-selection",
  message: "Cannot read properties of undefined (reading 'default')",
  hits: 1,
  user_id: "u1",
  stack: STALE_STACK,
};

Deno.test("a tab left open over a deploy is not a crash", () => {
  assertEquals(isStaleChunk(stale), true);
  assertEquals(crashLine([stale], 24), { state: "ok", detail: "so'nggi 24 soatda birorta sahifa yiqilmadi" });
  // Real crashes beside it are still counted, without it.
  assertEquals(crashLine([stale, row("/crm/leads", "Boom", 2, "u2")], 24), {
    state: "fail",
    detail: "so'nggi 24 soatda 2 marta, 1 xodimda:\n/crm/leads — Boom (2 marta)",
  });
});

Deno.test("the same words from a page's own code are a crash", () => {
  // Not thrown by React.lazy: some code of ours read `.default` of nothing.
  const own = { ...stale, stack: "TypeError: Cannot read properties of undefined (reading 'default')\n    at pickLocale (https://www.hanguk.uz/assets/x.js:1:1)\n\n    at LeadsTable\n    at div" };
  assertEquals(isStaleChunk(own), false);
  assertEquals(crashLine([own], 24).state, "fail");
  assertEquals(isStaleChunk({ message: "Cannot read properties of undefined (reading 'map')", stack: STALE_STACK }), false);
  assertEquals(isStaleChunk({ message: stale.message, stack: null }), false);
});
