// camera-session: bergan kalitini ofisdagi camera-gate qabul qiladimi (gate'ning o'z tekshiruvi bilan).
import { buildSession, clientIp, configProblems, type SessionDeps, TOKEN_TTL_SEC } from "./session.ts";
import { importSecret, verifyToken } from "../../../deploy/camera/gate/token.ts";

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const NOW = 1_800_000_000;

function assert(cond: unknown, msg = "assert"): asserts cond {
  if (!cond) throw new Error(msg);
}

function deps(over: Partial<SessionDeps> = {}) {
  const logged: string[][] = [];
  const d: SessionDeps = {
    userId: "0525a29d-32ce-4c3e-94b1-bddf42a776f9",
    secret: SECRET,
    gateUrl: "https://cam.hanguk.uz",
    nowSec: NOW,
    hasAccess: () => Promise.resolve(true),
    listCameras: () => Promise.resolve([{ id: "kirish", name: "Kirish" }, { id: "zal", name: "Zal" }]),
    log: (ids) => {
      logged.push(ids);
      return Promise.resolve();
    },
    ...over,
  };
  return { d, logged };
}

Deno.test("camera-session: kalitni camera-gate qabul qiladi, jurnalga yoziladi", async () => {
  const { d, logged } = deps();
  const r = await buildSession(d);
  assert(r.status === 200, `200 kutilgan, keldi ${r.status}`);
  if (r.status !== 200) return;
  assert(r.body.gate === "https://cam.hanguk.uz");
  assert(r.body.ttl === TOKEN_TTL_SEC && r.body.expires_at === new Date((NOW + 300) * 1000).toISOString());
  const v = await verifyToken(await importSecret(SECRET), r.body.token, NOW + 10);
  assert(v.ok, "gate kalitni qabul qilsin");
  if (v.ok) assert(JSON.stringify(v.claims.c) === '["kirish","zal"]' && v.claims.u === d.userId);
  assert(JSON.stringify(logged) === '[["kirish","zal"]]', "jurnalga bir marta yozilsin");
});

Deno.test("camera-session: ruxsatsizga 403, kamera yo'q bo'lsa 409 — jurnalga yozilmaydi", async () => {
  const a = deps({ hasAccess: () => Promise.resolve(false) });
  assert((await buildSession(a.d)).status === 403 && a.logged.length === 0);
  const b = deps({ listCameras: () => Promise.resolve([]) });
  assert((await buildSession(b.d)).status === 409 && b.logged.length === 0);
});

Deno.test("camera-session: jurnal yozilmasa kalit berilmaydi", async () => {
  const { d } = deps({ log: () => Promise.reject(new Error("insert failed")) });
  let thrown = false;
  try {
    await buildSession(d);
  } catch {
    thrown = true;
  }
  assert(thrown, "xato tashlansin (index.ts 500 qaytaradi)");
});

Deno.test("camera-session: sozlama va IP", () => {
  assert(configProblems(SECRET, "https://cam.hanguk.uz").length === 0);
  assert(configProblems("qisqa", "http://cam.hanguk.uz").join() === "CAMERA_GATE_SECRET,CAMERA_GATE_URL");
  const req = new Request("https://x", { headers: { "x-forwarded-for": "213.230.1.2, 10.0.0.1" } });
  assert(clientIp(req) === "213.230.1.2");
  assert(clientIp(new Request("https://x")) === null);
});
