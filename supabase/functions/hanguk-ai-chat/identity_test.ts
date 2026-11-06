// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "jsr:@std/assert@1";
import { resolveCaller } from "./identity.ts";

const install = "0f8a2c1e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

function deps(user: any) {
  return {
    userClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
    service: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }), then: (r: any) => r({ data: [] }) }) }) }) },
    publicKeys: ["pk"],
  };
}

function req(token?: string) {
  return new Request("https://x", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

Deno.test("no token → guest, counted by the phone's install id", async () => {
  const { caller } = await resolveCaller(req(), { install_id: install }, deps(null));
  assertEquals(caller.audience, "guest");
  assertEquals(caller.guestKey, `i:${install}`);
});

Deno.test("a guest's test session is still a guest (D4: 10 a day)", async () => {
  const { caller } = await resolveCaller(req("jwt"), { install_id: install }, deps({ id: "u1", app_metadata: { guest: true } }));
  assertEquals(caller.audience, "guest");
  assertEquals(caller.userId, null);
  assertEquals(caller.guestKey, `i:${install}`);
});
