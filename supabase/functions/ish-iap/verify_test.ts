import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { appleToken, jwsPayload, verifyApple, VerifyError, verifyGoogle } from "./verify.ts";

const reply = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jws = (payload: unknown) => `${b64({ alg: "ES256" })}.${b64(payload)}.sig`;

Deno.test("Google: a purchased token; refused, pending and unknown ones", async () => {
  const seen: string[] = [];
  const ok = await verifyGoogle((url) => {
    seen.push(url);
    return reply(200, { purchaseState: 0, orderId: "GPA.3300-1", consumptionState: 0 });
  }, "acc", "uz.hanguk.ish", "puyl_100", "tok/1");
  assertEquals(ok, { transactionId: "GPA.3300-1", productId: "puyl_100" });
  assertEquals(
    seen[0],
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/uz.hanguk.ish/purchases/products/puyl_100/tokens/tok%2F1",
  );
  // A test purchase has no order id: the token is the id.
  assertEquals(
    (await verifyGoogle(() => reply(200, { purchaseState: 0 }), "a", "p", "puyl_30", "T")).transactionId,
    "T",
  );
  await assertRejects(
    () => verifyGoogle(() => reply(200, { purchaseState: 1 }), "a", "p", "puyl_30", "T"),
    VerifyError,
    "NOT_PURCHASED",
  );
  await assertRejects(
    () => verifyGoogle(() => reply(200, { purchaseState: 2 }), "a", "p", "puyl_30", "T"),
    VerifyError,
    "NOT_PURCHASED",
  );
  await assertRejects(() => verifyGoogle(() => reply(404, {}), "a", "p", "puyl_30", "T"), VerifyError, "NOT_FOUND");
});

Deno.test("Apple: production, then the sandbox; wrong app, refunded, unknown product", async () => {
  const good = { bundleId: "uz.hanguk.ish", productId: "puyl_300", transactionId: "2000000555" };
  const hosts: string[] = [];
  const v = await verifyApple((url) => {
    hosts.push(new URL(url).host);
    return url.includes("sandbox") ? reply(200, { signedTransactionInfo: jws(good) }) : reply(404, {});
  }, "t", "uz.hanguk.ish", "2000000555", ["puyl_300"]);
  assertEquals(v, { transactionId: "2000000555", productId: "puyl_300" });
  assertEquals(hosts, ["api.storekit.itunes.apple.com", "api.storekit-sandbox.itunes.apple.com"]);

  const one = (payload: unknown) => () => reply(200, { signedTransactionInfo: jws(payload) });
  await assertRejects(
    () => verifyApple(one({ ...good, bundleId: "other.app" }), "t", "uz.hanguk.ish", "1", ["puyl_300"]),
    VerifyError,
    "WRONG_APP",
  );
  await assertRejects(
    () => verifyApple(one({ ...good, revocationDate: 1 }), "t", "uz.hanguk.ish", "1", ["puyl_300"]),
    VerifyError,
    "REVOKED",
  );
  await assertRejects(
    () => verifyApple(one({ ...good, productId: "gems" }), "t", "uz.hanguk.ish", "1", ["puyl_300"]),
    VerifyError,
    "INVALID",
  );
  await assertRejects(() => verifyApple(one(good), "t", "uz.hanguk.ish", "abc", ["puyl_300"]), VerifyError, "INVALID");
});

Deno.test("Apple token: ES256 with the key id, for the app", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----`;
  const token = await appleToken({ keyId: "K1", issuerId: "I1", privateKey: pem, bundleId: "uz.hanguk.ish" });
  const [h, p, s] = token.split(".");
  assertEquals(jwsPayload(`x.${h}.y`), { alg: "ES256", kid: "K1", typ: "JWT" });
  assertEquals(jwsPayload(token).bid, "uz.hanguk.ish");
  assertEquals(jwsPayload(token).aud, "appstoreconnect-v1");
  const sig = Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, sig, new TextEncoder().encode(`${h}.${p}`));
  assertEquals(ok, true);
});
