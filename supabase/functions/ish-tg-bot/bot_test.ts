import { assertEquals } from "jsr:@std/assert@1";
import { reply, startCode, webhookSecret } from "./bot.ts";

Deno.test("/start with an invite code: the button carries the code into the app", () => {
  assertEquals(startCode("/start ab12cd"), "AB12CD");
  assertEquals(startCode("/start"), null);
  assertEquals(startCode("/start x"), null);
  assertEquals(startCode("/start <script>"), null);
  const r = reply(7, "/start AB12CD", "uz", "https://app.example");
  assertEquals(r.reply_markup.inline_keyboard[0][0].web_app.url, "https://app.example?ref=AB12CD");
  assertEquals(r.text.startsWith("Assalomu alaykum"), true);
});

Deno.test("plain /start and other messages: the app's own address; Russian for Russian Telegram", () => {
  assertEquals(reply(7, "/start", "uz", "https://app.example").reply_markup.inline_keyboard[0][0].web_app.url,
    "https://app.example");
  assertEquals(reply(7, "salom", "ru", "https://app.example").text.startsWith("Чтобы открыть"), true);
});

Deno.test("the webhook secret: fixed per token, 32 hex characters", async () => {
  const a = await webhookSecret("123:abc");
  assertEquals(a.length, 32);
  assertEquals(a, await webhookSecret("123:abc"));
  assertEquals(a === await webhookSecret("123:abd"), false);
});
