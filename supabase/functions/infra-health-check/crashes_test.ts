// deno test supabase/functions/infra-health-check/crashes_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { crashLine, type CrashRow } from "./crashes.ts";

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
