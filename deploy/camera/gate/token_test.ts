import { assert, assertEquals, TEST_SECRET } from "./testutil.ts";
import {
  allowsCamera,
  base64UrlDecode,
  base64UrlEncode,
  type CameraClaims,
  importSecret,
  MAX_LIFETIME_SEC,
  signToken,
  verifyToken,
} from "./token.ts";

const NOW = 1_800_000_000;
const claims = (over: Partial<CameraClaims> = {}): CameraClaims => ({
  u: "0525a29d-32ce-4c3e-94b1-bddf42a776f9",
  c: ["kirish", "zal"],
  iat: NOW,
  exp: NOW + 300,
  ...over,
});

Deno.test("kalit: imzolab tekshirish ishlaydi", async () => {
  const key = await importSecret(TEST_SECRET);
  const token = await signToken(key, claims());
  assert(token.startsWith("v1."), "v1 bilan boshlansin");
  const r = await verifyToken(key, token, NOW + 10);
  assert(r.ok, "ok bo'lsin");
  if (r.ok) assertEquals(r.claims.c, ["kirish", "zal"]);
});

Deno.test("kalit: muddati o'tgan rad etiladi (30 s farqdan keyin)", async () => {
  const key = await importSecret(TEST_SECRET);
  const token = await signToken(key, claims());
  assert((await verifyToken(key, token, NOW + 300 + 29)).ok, "farq ichida — ok");
  assertEquals(await verifyToken(key, token, NOW + 300 + 31), { ok: false, reason: "expired" });
});

Deno.test("kalit: o'zgartirilgan payload va boshqa sir rad etiladi", async () => {
  const key = await importSecret(TEST_SECRET);
  const token = await signToken(key, claims());
  const [v, , sig] = token.split(".");
  const forged = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims({ c: ["*"] }))));
  assertEquals(await verifyToken(key, `${v}.${forged}.${sig}`, NOW), { ok: false, reason: "signature" });
  const other = await importSecret(TEST_SECRET + "x");
  assertEquals(await verifyToken(other, token, NOW), { ok: false, reason: "signature" });
});

Deno.test("kalit: umri juda uzun yoki kelajakdan berilgan — rad", async () => {
  const key = await importSecret(TEST_SECRET);
  const long = await signToken(key, claims({ exp: NOW + MAX_LIFETIME_SEC + 1 }));
  assertEquals(await verifyToken(key, long, NOW), { ok: false, reason: "lifetime" });
  const future = await signToken(key, claims({ iat: NOW + 120, exp: NOW + 300 }));
  assertEquals(await verifyToken(key, future, NOW), { ok: false, reason: "claims" });
});

Deno.test("kalit: noto'g'ri shakllar rad etiladi", async () => {
  const key = await importSecret(TEST_SECRET);
  for (const t of [null, "", "abc", "v2.a.b", "v1.a", "v1.a.b.c", "v1.***.AAAA", "x".repeat(3000)]) {
    const r = await verifyToken(key, t as string, NOW);
    assertEquals(r, { ok: false, reason: "format" }, String(t).slice(0, 20));
  }
  const bad = await signToken(key, { u: "x", c: ["Kirish!"], iat: NOW, exp: NOW + 60 });
  assertEquals(await verifyToken(key, bad, NOW), { ok: false, reason: "claims" });
});

Deno.test("kalit: kamera ruxsati", () => {
  assert(allowsCamera(claims(), "kirish"));
  assert(!allowsCamera(claims(), "ombor"));
  assert(allowsCamera(claims({ c: ["*"] }), "ombor"));
});

Deno.test("base64url: kodlash va ochish", () => {
  const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
  assertEquals(Array.from(base64UrlDecode(base64UrlEncode(bytes)) ?? []), Array.from(bytes));
  assertEquals(base64UrlDecode("a"), null);
  assertEquals(base64UrlDecode("a+b/"), null);
});
