import { assertEquals } from "jsr:@std/assert@1";
import { type GuestDb, type GuestLead, handleGuestAuth, type PasswordCheck } from "./logic.ts";

const NOW = "2026-11-12T03:00:00.000Z";

/** A database in memory. `migrated: false` is production before the migration. */
function fakeDb(opts: { migrated?: boolean; leads?: GuestLead[]; hashes?: Record<string, string>; locked?: string[] } = {}) {
  const migrated = opts.migrated ?? true;
  const leads: GuestLead[] = (opts.leads ?? []).map((l) => ({ ...l }));
  const hashes: Record<string, string> = { ...(opts.hashes ?? {}) };
  const locked = new Set(opts.locked ?? []);
  const logins: { id: string; count: number; history: string[] }[] = [];
  const db: GuestDb = {
    findLeadByEmail: (email) => Promise.resolve(leads.find((l) => l.email === email) ?? null),
    insertLead: (row) => {
      const lead: GuestLead = { id: `lead-${leads.length + 1}`, full_name: row.full_name, email: row.email, password: null };
      leads.push(lead);
      return Promise.resolve(lead);
    },
    setPassword: (id, password) => {
      if (!migrated) return Promise.resolve("missing");
      hashes[id] = `hash(${password})`;
      return Promise.resolve("ok");
    },
    checkPassword: (id, password): Promise<PasswordCheck> => {
      if (!migrated) return Promise.resolve("missing");
      if (!(id in hashes)) return Promise.resolve("none");
      if (locked.has(id)) return Promise.resolve("locked");
      return Promise.resolve(hashes[id] === `hash(${password})` ? "ok" : "wrong");
    },
    setLegacyPassword: (id, password) => {
      leads.find((l) => l.id === id)!.password = password;
      return Promise.resolve();
    },
    recordLogin: (id, count, history) => {
      logins.push({ id, count, history });
      return Promise.resolve();
    },
  };
  return { db, leads, hashes, logins };
}

const signup = (db: GuestDb, over: Record<string, unknown> = {}) =>
  handleGuestAuth(db, { action: "signup", email: " Ali@Example.com ", password: "secret1", fullName: " ALI VALIYEV ", ...over }, NOW);
const login = (db: GuestDb, over: Record<string, unknown> = {}) =>
  handleGuestAuth(db, { action: "login", email: "ali@example.com", password: "secret1", ...over }, NOW);

Deno.test("sign-up stores a hash and never the password as typed", async () => {
  const f = fakeDb();
  const r = await signup(f.db);
  assertEquals(r.status, 200);
  assertEquals(r.body, { success: true, lead: { id: "lead-1", full_name: "ALI VALIYEV", email: "ali@example.com" } });
  assertEquals(f.hashes, { "lead-1": "hash(secret1)" });
  assertEquals(f.leads[0].password, null);
});

Deno.test("the reply names the person and nothing the CRM keeps about them", async () => {
  const f = fakeDb({
    leads: [{ id: "L", full_name: "ALI", email: "ali@example.com", password: null, login_count: 3, login_history: ["x"],
      ...({ notes: "internal", assigned_to: "staff", phone: "+998" } as object) }],
    hashes: { L: "hash(secret1)" },
  });
  const r = await login(f.db);
  assertEquals(r.body, { success: true, lead: { id: "L", full_name: "ALI", email: "ali@example.com" } });
});

Deno.test("sign-in: right password, wrong password, unknown email", async () => {
  const f = fakeDb({ leads: [{ id: "L", full_name: "ALI", email: "ali@example.com", login_count: 1, login_history: ["old"] }], hashes: { L: "hash(secret1)" } });
  assertEquals((await login(f.db)).body.success, true);
  assertEquals(f.logins, [{ id: "L", count: 2, history: [NOW, "old"] }]);
  assertEquals((await login(f.db, { password: "nope" })).body, { success: false, code: "INVALID_PASSWORD", message: "Invalid email or password" });
  assertEquals((await login(f.db, { email: "nobody@example.com" })).body.code, "EMAIL_NOT_FOUND");
  assertEquals(f.logins.length, 1);
});

Deno.test("a locked account is refused even with the right password", async () => {
  const f = fakeDb({ leads: [{ id: "L", full_name: "ALI", email: "ali@example.com" }], hashes: { L: "hash(secret1)" }, locked: ["L"] });
  const r = await login(f.db);
  assertEquals(r.body.code, "TOO_MANY_ATTEMPTS");
  assertEquals(f.logins.length, 0);
});

Deno.test("an old account signs in with its typed password once, and it is moved out of leads", async () => {
  const f = fakeDb({ leads: [{ id: "L", full_name: "ALI", email: "ali@example.com", password: "secret1" }] });
  assertEquals((await login(f.db, { password: "wrong" })).body.code, "INVALID_PASSWORD");
  assertEquals(f.leads[0].password, "secret1");
  assertEquals((await login(f.db)).body.success, true);
  assertEquals(f.hashes, { L: "hash(secret1)" });
  assertEquals(f.leads[0].password, null);
  // From now on only the hash counts.
  assertEquals((await login(f.db)).body.success, true);
});

Deno.test("an account with no password anywhere cannot be signed in to with an empty or any password", async () => {
  const f = fakeDb({ leads: [{ id: "L", full_name: "ALI", email: "ali@example.com", password: null }] });
  assertEquals((await login(f.db, { password: "anything" })).body.code, "INVALID_PASSWORD");
  const g = fakeDb({ leads: [{ id: "L", full_name: "ALI", email: "ali@example.com", password: "" }] });
  assertEquals((await login(g.db, { password: "x" })).body.code, "INVALID_PASSWORD");
});

Deno.test("before the migration both forms keep working as they did", async () => {
  const f = fakeDb({ migrated: false });
  assertEquals((await signup(f.db)).body.success, true);
  assertEquals(f.leads[0].password, "secret1");
  assertEquals((await login(f.db)).body.success, true);
  assertEquals((await login(f.db, { password: "nope" })).body.code, "INVALID_PASSWORD");
  assertEquals(f.leads[0].password, "secret1");
});

Deno.test("a second sign-up with the same email is refused and changes nothing", async () => {
  const f = fakeDb();
  await signup(f.db);
  const r = await signup(f.db, { password: "other", email: "ALI@example.com" });
  assertEquals(r.body.code, "EMAIL_EXISTS");
  assertEquals(f.leads.length, 1);
  assertEquals(f.hashes, { "lead-1": "hash(secret1)" });
});

Deno.test("what is missing or malformed is refused before the database is asked", async () => {
  const f = fakeDb();
  assertEquals((await signup(f.db, { email: "" })).status, 400);
  assertEquals((await signup(f.db, { password: "" })).body.code, "MISSING_FIELDS");
  assertEquals((await signup(f.db, { password: 123 })).body.code, "MISSING_FIELDS");
  assertEquals((await signup(f.db, { fullName: "   " })).body.code, "MISSING_NAME");
  assertEquals((await signup(f.db, { email: "not-an-email" })).body.code, "INVALID_FIELDS");
  assertEquals((await signup(f.db, { password: "x".repeat(201) })).body.code, "INVALID_FIELDS");
  assertEquals((await signup(f.db, { fullName: "A".repeat(121) })).body.code, "INVALID_FIELDS");
  assertEquals(f.leads.length, 0);
});
