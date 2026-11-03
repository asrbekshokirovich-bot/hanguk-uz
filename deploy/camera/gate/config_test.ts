import { ConfigError, loadConfig } from "./config.ts";
import { assert, assertEquals, HEALTH_KEY, TEST_SECRET } from "./testutil.ts";

const env = (over: Record<string, string> = {}) => (name: string) =>
  ({ GATE_SECRET: TEST_SECRET, HEALTH_KEY, CAMERAS: "kirish,zal", ...over } as Record<string, string>)[name];

Deno.test("sozlama: standart qiymatlar", () => {
  const c = loadConfig(env());
  assertEquals(c.hostname, "127.0.0.1");
  assertEquals(c.port, 8080);
  assertEquals(c.go2rtcUrl, "http://127.0.0.1:1984");
  assertEquals(c.origins, ["https://hanguk.uz", "https://www.hanguk.uz"]);
  assertEquals(c.cameras, ["kirish", "zal"]);
  assertEquals(c.sessionMaxSec, 900);
  assertEquals(c.snapshotCache, "8s");
});

Deno.test("sozlama: WireGuard manzili va o'zgaruvchilar", () => {
  const c = loadConfig(env({ GATE_LISTEN: "10.8.0.2:8080", GO2RTC_URL: "http://127.0.0.1:1984/", MAX_SESSIONS: "4" }));
  assertEquals([c.hostname, c.port, c.go2rtcUrl, c.maxSessions], ["10.8.0.2", 8080, "http://127.0.0.1:1984", 4]);
});

Deno.test("sozlama: xatolar bir yo'la ko'rsatiladi", () => {
  try {
    loadConfig(env({
      GATE_SECRET: "qisqa",
      HEALTH_KEY: "",
      CAMERAS: "kirish,Zal_1,kirish",
      GATE_ORIGINS: "https://hanguk.uz/",
      GATE_LISTEN: "8080",
      MAX_SESSIONS: "0",
    }));
    throw new Error("xato kutilgan edi");
  } catch (e) {
    assert(e instanceof ConfigError, "ConfigError bo'lsin");
    const text = e.problems.join("\n");
    for (
      const part of ["GATE_SECRET", "HEALTH_KEY", "Zal_1", "takror", "GATE_ORIGINS", "GATE_LISTEN", "MAX_SESSIONS"]
    ) {
      assert(text.includes(part), `${part} xabarda bo'lsin`);
    }
  }
});

Deno.test("sozlama: kameralar bo'sh bo'lmasin", () => {
  let thrown = false;
  try {
    loadConfig(env({ CAMERAS: " , " }));
  } catch (e) {
    thrown = e instanceof ConfigError;
  }
  assert(thrown, "CAMERAS bo'sh — xato");
});
