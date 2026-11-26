// Telegram Mini App data, checked with the bot's token
// (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
//
// `initData` (who opened the mini app) and the answer of requestContact (the
// phone number the person chose to share) are both query strings signed the
// same way: hash = HMAC_SHA256(data_check_string, HMAC_SHA256(bot_token,
// "WebAppData")), the data_check_string being every other field as
// key=value, sorted, joined with "\n".

export class TelegramError extends Error {
  constructor(readonly code: "INVALID" | "EXPIRED") {
    super(code);
  }
}

const enc = new TextEncoder();

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The fields of a signed string, after its hash is checked; throws a [TelegramError]. */
export async function verifySigned(
  raw: string,
  botToken: string,
  nowMs = Date.now(),
  maxAgeSeconds = 24 * 60 * 60,
): Promise<Record<string, string>> {
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!raw || !hash || !botToken) throw new TelegramError("INVALID");
  const fields: Record<string, string> = {};
  for (const [k, v] of params) if (k !== "hash") fields[k] = v;
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const check = (skip: string[]) =>
    Object.keys(fields).filter((k) => !skip.includes(k)).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  // Newer clients add `signature` (for checks without the token); the hash
  // covers it or not depending on the client, so both forms are tried.
  let ok = false;
  for (const skip of [[], ["signature"]]) {
    if (sameText(hex(await hmac(secret, check(skip))), hash.toLowerCase())) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new TelegramError("INVALID");
  const authDate = Number(fields["auth_date"]);
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > maxAgeSeconds) throw new TelegramError("EXPIRED");
  return fields;
}

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  languageCode: string;
}

/** The person who opened the mini app (initData's `user`). */
export function telegramUser(fields: Record<string, string>): TelegramUser {
  let u: Record<string, unknown>;
  try {
    u = JSON.parse(fields["user"] ?? "");
  } catch {
    throw new TelegramError("INVALID");
  }
  const id = Number(u?.["id"]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new TelegramError("INVALID");
  const text = (k: string) => (typeof u[k] === "string" ? (u[k] as string) : "");
  return { id, firstName: text("first_name"), lastName: text("last_name"), username: text("username"), languageCode: text("language_code") };
}

/** The shared phone number (digits only), when the contact is this person's own. */
export function contactPhone(fields: Record<string, string>, telegramId: number): string | null {
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(fields["contact"] ?? "");
  } catch {
    return null;
  }
  if (Number(c?.["user_id"]) !== telegramId) return null;
  const digits = String(c["phone_number"] ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** The account's e-mail: nobody receives mail there, it only names the account. */
export const telegramEmail = (telegramId: number) => `tg${telegramId}@telegram.hanguk.uz`;
