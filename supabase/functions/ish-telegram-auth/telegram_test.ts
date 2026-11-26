import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { contactPhone, TelegramError, telegramEmail, telegramUser, verifySigned } from "./telegram.ts";
import { type Accounts, signIn, type SignInToken } from "./auth.ts";

const TOKEN = "123456:TEST-token";
const enc = new TextEncoder();

async function sign(fields: Record<string, string>, token = TOKEN, skip: string[] = []): Promise<string> {
  const mac = async (key: Uint8Array, data: string) => {
    const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
  };
  const secret = await mac(enc.encode("WebAppData"), token);
  const check = Object.keys(fields).filter((k) => !skip.includes(k)).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const hash = [...await mac(secret, check)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const NOW = 1_795_000_000_000;
const user = JSON.stringify({ id: 42, first_name: "Aziz", last_name: "K", username: "aziz", language_code: "uz" });

Deno.test("initData: a genuine one is read; a forged, foreign or old one is refused", async () => {
  const fields = { auth_date: String(NOW / 1000 - 60), query_id: "AAA", user };
  const raw = await sign(fields);
  const read = await verifySigned(raw, TOKEN, NOW);
  assertEquals(telegramUser(read), { id: 42, firstName: "Aziz", lastName: "K", username: "aziz", languageCode: "uz" });

  const forged = raw.replace("Aziz", "Bobur");
  await assertRejects(() => verifySigned(forged, TOKEN, NOW), TelegramError, "INVALID");
  const foreign = await sign(fields, "999:other");
  await assertRejects(() => verifySigned(foreign, TOKEN, NOW), TelegramError, "INVALID");
  await assertRejects(() => verifySigned("", TOKEN, NOW), TelegramError, "INVALID");
  const old = await sign({ ...fields, auth_date: String(NOW / 1000 - 2 * 86400) });
  await assertRejects(() => verifySigned(old, TOKEN, NOW), TelegramError, "EXPIRED");
});

Deno.test("initData with a signature field: hashed with or without it", async () => {
  const fields = { auth_date: String(NOW / 1000), user, signature: "abc" };
  await verifySigned(await sign(fields), TOKEN, NOW);
  await verifySigned(await sign(fields, TOKEN, ["signature"]), TOKEN, NOW);
});

Deno.test("contact: the person's own number, digits only", () => {
  const c = (o: unknown) => ({ contact: JSON.stringify(o) });
  assertEquals(contactPhone(c({ user_id: 42, phone_number: "+82 10-1234-5678" }), 42), "821012345678");
  assertEquals(contactPhone(c({ user_id: 7, phone_number: "821012345678" }), 42), null);
  assertEquals(contactPhone(c({ user_id: 42, phone_number: "12" }), 42), null);
  assertEquals(contactPhone({}, 42), null);
});

function fakeAccounts(start: { emails?: Record<string, number>; phones?: Record<string, { id: string; email: string }> } = {}) {
  const emails = { ...(start.emails ?? {}) };
  const log: string[] = [];
  const token = (email: string, type: SignInToken["type"]): SignInToken => ({ token_hash: `t:${email}`, type });
  const accounts: Accounts = {
    existing(email, id) {
      if (!(email in emails)) return Promise.resolve(null);
      if (emails[email] !== id) return Promise.reject(new Error("MISMATCH"));
      return Promise.resolve(token(email, "recovery"));
    },
    byPhone: (digits) => Promise.resolve(start.phones?.[digits] ?? null),
    attach(userId, email, id) {
      log.push(`attach ${userId}`);
      emails[email] = id;
      return Promise.resolve();
    },
    create(email, u, phone) {
      log.push(`create ${phone ?? "-"}`);
      emails[email] = u.id;
      return Promise.resolve();
    },
    link: (email) => Promise.resolve(token(email, "magiclink")),
  };
  return { accounts, log };
}

const aziz = { id: 42, firstName: "Aziz", lastName: "", username: "", languageCode: "uz" };

Deno.test("sign in: known, new (asks for the number), joined to the phone account", async () => {
  const known = fakeAccounts({ emails: { [telegramEmail(42)]: 42 } });
  assertEquals(await signIn(known.accounts, aziz, undefined), { token_hash: "t:tg42@telegram.hanguk.uz", type: "recovery" });

  const fresh = fakeAccounts();
  assertEquals(await signIn(fresh.accounts, aziz, undefined), { need_contact: true });
  assertEquals((await signIn(fresh.accounts, aziz, null)).type, "magiclink");
  assertEquals(fresh.log, ["create -"]);

  const phoneUser = fakeAccounts({ phones: { "821012345678": { id: "u-1", email: "" } } });
  assertEquals((await signIn(phoneUser.accounts, aziz, "821012345678")).type, "magiclink");
  assertEquals(phoneUser.log, ["attach u-1"]);

  // The number is someone's account with an e-mail already: a new account, without it.
  const taken = fakeAccounts({ phones: { "821012345678": { id: "u-2", email: "x@y.z" } } });
  await signIn(taken.accounts, aziz, "821012345678");
  assertEquals(taken.log, ["create -"]);

  const newWithPhone = fakeAccounts();
  await signIn(newWithPhone.accounts, aziz, "998901234567");
  assertEquals(newWithPhone.log, ["create 998901234567"]);
});
