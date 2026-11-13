// ish-delete-account: who may delete and in what order (a fake store).
// deno-lint-ignore-file require-await
import { assertEquals } from "jsr:@std/assert@1";
import { deleteAccount, type DeleteStore, isIshAccount } from "./delete.ts";

function fake(opts: { staff?: boolean; businesses?: string[]; photos?: string[] } = {}) {
  const log: string[] = [];
  const store: DeleteStore = {
    async isStaff(id) { log.push(`staff?${id}`); return opts.staff ?? false; },
    async ownedBusinesses() { return opts.businesses ?? []; },
    async deleteBusinesses(ids) { log.push(`businesses:${ids.join(",")}`); },
    async avatarPaths() { return opts.photos ?? []; },
    async removeAvatars(paths) { log.push(`photos:${paths.join(",")}`); },
    async deleteUser(id) { log.push(`user:${id}`); },
  };
  return { store, log };
}

const worker = { id: "u1", app_metadata: { app: "hanguk_ish", provider: "phone" } };

Deno.test("a Hanguk Ish worker: photos, then the account", async () => {
  const { store, log } = fake({ photos: ["u1/avatar-1.jpg"] });
  assertEquals(await deleteAccount(worker, store), { ok: true, businesses: 0, photos: 1 });
  assertEquals(log, ["staff?u1", "photos:u1/avatar-1.jpg", "user:u1"]);
});

Deno.test("a 사장님: the businesses go first, then the account", async () => {
  const { store, log } = fake({ businesses: ["b1", "b2"] });
  assertEquals(await deleteAccount(worker, store), { ok: true, businesses: 2, photos: 0 });
  assertEquals(log, ["staff?u1", "businesses:b1,b2", "user:u1"]);
});

Deno.test("hanguk.uz accounts and Hanguk Ish staff are refused, nothing deleted", async () => {
  const crm = { id: "s1", app_metadata: { provider: "email" } };
  let f = fake();
  assertEquals(await deleteAccount(crm, f.store), { ok: false, status: 403, error: "NOT_ISH_ACCOUNT" });
  assertEquals(f.log, []);

  f = fake({ staff: true });
  assertEquals(await deleteAccount(worker, f.store), { ok: false, status: 403, error: "STAFF" });
  assertEquals(f.log, ["staff?u1"]);

  f = fake();
  assertEquals(await deleteAccount(null, f.store), { ok: false, status: 401, error: "UNAUTHENTICATED" });
});

Deno.test("isIshAccount: marked or anonymous", () => {
  assertEquals(isIshAccount({ id: "a", is_anonymous: true }), true);
  assertEquals(isIshAccount({ id: "a", app_metadata: { app: "hanguk_ish" } }), true);
  assertEquals(isIshAccount({ id: "a", app_metadata: { guest: true } }), false);
  assertEquals(isIshAccount(null), false);
});
