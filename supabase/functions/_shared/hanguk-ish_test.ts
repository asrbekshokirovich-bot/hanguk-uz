// deno test --no-check --allow-env --allow-read supabase/functions/_shared/hanguk-ish_test.ts
//
// P53: Hanguk Ish's anonymous accounts are refused by hanguk.uz's functions;
// hanguk.uz's own accounts (students, staff, guests) pass as before.
import { assertEquals } from "jsr:@std/assert@1";
import { isAnonymousAccount, isHangukIshAccount } from "./hanguk-ish.ts";
import { requireCaller } from "./caller.ts";
import { requireAuth } from "./auth.ts";

Deno.test("only an account Supabase marks anonymous is one", () => {
  assertEquals(isAnonymousAccount({ is_anonymous: true }), true);
  assertEquals(isAnonymousAccount({ is_anonymous: false }), false);
  assertEquals(isAnonymousAccount({}), false, "older tokens carry no mark: a hanguk.uz account");
  assertEquals(isAnonymousAccount({ is_anonymous: null }), false);
  assertEquals(isAnonymousAccount(null), false);
  assertEquals(isAnonymousAccount(undefined), false);
});

Deno.test("P54: a phone account marked by the database is a Hanguk Ish account", () => {
  assertEquals(isHangukIshAccount({ is_anonymous: false, app_metadata: { app: "hanguk_ish", provider: "phone" } }), true);
  assertEquals(isHangukIshAccount({ is_anonymous: false, app_metadata: { provider: "email" } }), false);
  assertEquals(isHangukIshAccount({ app_metadata: null }), false);
  assertEquals(isHangukIshAccount({ app_metadata: { app: "other" } }), false);
  assertEquals(isAnonymousAccount({ app_metadata: { app: "hanguk_ish" } }), true, "the old name follows");
});

/** Supabase Auth answers GET /auth/v1/user with [user]; everything else is a test failure. */
async function withAuthServer<T>(user: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_PUBLISHABLE_KEYS", JSON.stringify({ default: "sb_publishable_test" }));
  globalThis.fetch = (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/auth/v1/user")) {
      return Promise.resolve(new Response(JSON.stringify(user), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.resolve(new Response(JSON.stringify({ message: `unexpected ${url}` }), { status: 500 }));
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
  }
}

const request = () => new Request("https://project.supabase.co/functions/v1/x", {
  method: "POST",
  headers: { Authorization: "Bearer user-token" },
});

const student = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", is_anonymous: false, app_metadata: {}, user_metadata: {} };
const anonymous = { ...student, id: "22222222-2222-4222-8222-222222222222", is_anonymous: true, user_metadata: { app: "hanguk_ish" } };
const phoneWorker = { ...student, id: "33333333-3333-4333-8333-333333333333", phone: "821012345678", app_metadata: { provider: "phone", providers: ["phone"], app: "hanguk_ish" }, user_metadata: { app: "hanguk_ish" } };

Deno.test("requireCaller: a signed-in student passes, an anonymous account is refused (403)", async () => {
  const ok = await withAuthServer(student, () => requireCaller(request(), "user", {}));
  assertEquals(ok.ok, true);
  const refused = await withAuthServer(anonymous, () => requireCaller(request(), "user", {}));
  assertEquals(refused.ok, false);
  if (!refused.ok) {
    assertEquals(refused.response.status, 403);
    await refused.response.body?.cancel();
  }
});

Deno.test("requireAuth: the same rule", async () => {
  const user = await withAuthServer(student, () => requireAuth(request()));
  assertEquals(user.id, student.id);
  const status = await withAuthServer(anonymous, () =>
    requireAuth(request()).then(() => 200, (e: { statusCode?: number }) => e.statusCode ?? 500));
  assertEquals(status, 403);
});

Deno.test("P54: requireCaller and requireAuth refuse a Hanguk Ish phone account (403)", async () => {
  const refused = await withAuthServer(phoneWorker, () => requireCaller(request(), "user", {}));
  assertEquals(refused.ok, false);
  if (!refused.ok) {
    assertEquals(refused.response.status, 403);
    await refused.response.body?.cancel();
  }
  const status = await withAuthServer(phoneWorker, () =>
    requireAuth(request()).then(() => 200, (e: { statusCode?: number }) => e.statusCode ?? 500));
  assertEquals(status, 403);
});
