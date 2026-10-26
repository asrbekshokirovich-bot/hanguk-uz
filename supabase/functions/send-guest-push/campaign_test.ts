// deno test supabase/functions/send-guest-push/campaign_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import { campaignData, checkCampaign, textFor } from "./campaign.ts";

Deno.test("a campaign needs a key and Uzbek text", () => {
  assertEquals(checkCampaign({ campaign: "Deadline-Oct", title: { uz: " Muddat " }, body: { uz: "Matn", ru: "Текст" } }), {
    ok: true,
    value: { campaign: "deadline-oct", title: { uz: "Muddat" }, body: { uz: "Matn", ru: "Текст" } },
  });
  assertEquals(checkCampaign({ campaign: "x", title: { uz: "a" }, body: { uz: "b" } }), { ok: false, error: "bad_campaign" });
  assertEquals(checkCampaign({ campaign: "oct", title: { ru: "a" }, body: { uz: "b" } }), { ok: false, error: "uzbek_required" });
  assertEquals(checkCampaign({ campaign: "oct", title: { uz: "a".repeat(81) }, body: { uz: "b" } }), { ok: false, error: "too_long" });
});

Deno.test("each phone gets its language, or Uzbek", () => {
  const c = { campaign: "oct", title: { uz: "Muddat", ru: "Срок" }, body: { uz: "Matn" } };
  assertEquals(textFor(c, "ru"), { title: "Срок", body: "Matn" });
  assertEquals(textFor(c, "ko"), { title: "Muddat", body: "Matn" });
  assertEquals(textFor(c, null), { title: "Muddat", body: "Matn" });
  assertEquals(campaignData("oct"), { type: "campaign", campaign: "oct" });
});
