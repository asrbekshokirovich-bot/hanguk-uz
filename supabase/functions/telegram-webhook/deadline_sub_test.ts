// deno test supabase/functions/telegram-webhook/deadline_sub_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { lang, linkedText, stopButton, subCode } from "./deadline_sub.ts";

Deno.test("the code from /start D_<code>", () => {
  assertEquals(subCode("/start D_ABCDEFGH23"), "ABCDEFGH23");
  assertEquals(subCode("/start d_abcdefgh23"), "ABCDEFGH23");
  assertEquals(subCode("/start D_ABCDEFGH2"), null); // 9
  assertEquals(subCode("/start D_ABCDEFGHI3"), null); // I is not in the alphabet
  assertEquals(subCode("/start A_ABC234"), null);
  assertEquals(("D_" + "ABCDEFGH23").length <= 64, true);
});

Deno.test("five languages and a stop button", () => {
  for (const l of ["uz", "ru", "en", "ko", "vi"]) assertEquals(linkedText(lang(l)).length > 20, true);
  assertEquals(lang("de"), "uz");
  assertEquals(stopButton("uz").inline_keyboard[0][0].callback_data, "sub_stop");
});
