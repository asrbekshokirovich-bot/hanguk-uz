// One-time interactive login for a staff Telegram account.
//
//   npm run login
//
// Prompts for the phone, the code Telegram sends, and the 2FA password (if any),
// then prints a StringSession. Save that string as TG_SESSION (or an entry in
// TG_ACCOUNTS) — it is a CREDENTIAL for that account; treat it like a password.
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH first (get them at https://my.telegram.org → API development tools).");
  process.exit(1);
}

const rl = readline.createInterface({ input, output });
const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });

await client.start({
  phoneNumber: async () => (await rl.question("Phone number (e.g. +998901234567): ")).trim(),
  password: async () => (await rl.question("2FA password (leave blank if none): ")).trim(),
  phoneCode: async () => (await rl.question("Login code Telegram just sent you: ")).trim(),
  onError: (err) => console.error(err),
});

const me = await client.getMe();
console.log(`\n✅ Logged in as ${me.username ? "@" + me.username : me.firstName} (id ${me.id}).`);
console.log("\nSave this session string (KEEP IT SECRET) as TG_SESSION:\n");
console.log(client.session.save());
console.log("");

await rl.close();
await client.disconnect();
process.exit(0);
