import { describe, expect, it } from "vitest";
import {
  asksPhoneFirst,
  buildBriefPrompt,
  buildTimelineText,
  checkDraft,
  cleanBrief,
  containsForbidden,
  disallowedPrices,
  draftKey,
  isAutomaticBody,
  lastClientMessage,
  missingFields,
  needsBrief,
  normalizeSuggestions,
  pickDraftChannel,
  validateBriefResponse,
  type BriefLead,
  type BriefSettings,
  type Offers,
  type TimelineRow,
} from "./brief";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const MIN = 60_000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const OFFERS: Offers = {
  standart: { title: "Standart", text: "2 mln + 5 mln vizadan keyin", needs_boss: false },
  premium: { title: "Premium", text: "3 mln + 10 mln vizadan keyin", needs_boss: false },
  no_risk: { title: "NO RISK", text: "$5 000; viza rad etilsa to'liq qaytariladi (o'zi voz kechmasa)", needs_boss: true },
  hanbox: {
    title: "Hanbox",
    text: "$2 000 yoki $400 + 10×$200 ($2 400) yoki nasiya; birinchi dars bepul",
    needs_boss: false,
  },
  kasbiy: { title: "Kasbiy ta'lim", text: "Narx — rahbardan", needs_boss: true },
};
const FORBIDDEN = ["kafolat", "100%", "bepul noutbuk", "bitta narx", "sertifikatsiz Koreya"];
const AUTO = ["Assalomu alaykum! Xabaringizni oldik. Ertaga 09:00–09:30 oralig'ida qo'ng'iroq qilamiz."];
const SETTINGS: BriefSettings = { offers: OFFERS, forbiddenWords: FORBIDDEN, autoReplyTexts: AUTO };

const lead = (over: Partial<BriefLead> = {}): BriefLead => ({
  id: "L1",
  full_name: "Dilnoza",
  phone: null,
  source: "instagram",
  stage: "new",
  last_client_msg_at: iso(5 * MIN),
  ai_brief_msg_at: null,
  ...over,
});

describe("needsBrief", () => {
  it("wants a lead whose last client message is at least 2 minutes old and never briefed", () => {
    expect(needsBrief(lead(), NOW)).toBe(true);
  });
  it("waits out the 2-minute debounce", () => {
    expect(needsBrief(lead({ last_client_msg_at: iso(90_000) }), NOW)).toBe(false);
    expect(needsBrief(lead({ last_client_msg_at: iso(2 * MIN) }), NOW)).toBe(true);
  });
  it("wants a new brief only when a message came after the last one", () => {
    const last = iso(10 * MIN);
    expect(needsBrief(lead({ last_client_msg_at: last, ai_brief_msg_at: last }), NOW)).toBe(false);
    expect(needsBrief(lead({ last_client_msg_at: last, ai_brief_msg_at: iso(20 * MIN) }), NOW)).toBe(true);
  });
  it("compares microsecond timestamps from the database without a false positive", () => {
    expect(
      needsBrief(lead({ last_client_msg_at: "2026-10-05T11:50:00.123456+00:00", ai_brief_msg_at: "2026-10-05T11:50:00.123456+00:00" }), NOW),
    ).toBe(false);
  });
  it("never briefs students, merged cards, or a lead nobody wrote for", () => {
    expect(needsBrief(lead({ stage: "student" }), NOW)).toBe(false);
    expect(needsBrief(lead({ merged_into_id: "L0" }), NOW)).toBe(false);
    expect(needsBrief(lead({ matched_student_id: "S1" }), NOW)).toBe(false);
    expect(needsBrief(lead({ last_client_msg_at: null }), NOW)).toBe(false);
  });
});

describe("draftKey / missingFields", () => {
  it("is stable per client message", () => {
    expect(draftKey("L1", "2026-10-05T11:55:00+00:00")).toBe("ai:L1:2026-10-05T11:55:00+00:00");
  });
  it("lists the empty mandatory fields with the SQL's keys", () => {
    expect(missingFields(lead())).toEqual(["goal", "certificate", "age_grade", "region", "decider"]);
    expect(
      missingFields(lead({ education_level: "Bakalavr", cert_level: "TOPIK 3", study_year: "11-sinf", city: "Toshkent", decider: "self" })),
    ).toEqual([]);
    expect(missingFields(lead({ age: 19 }))).not.toContain("age_grade");
  });
});

const row = (kind: string, body: string | null, agoMin: number, extra: Partial<TimelineRow> = {}): TimelineRow => ({
  at: iso(agoMin * MIN),
  kind,
  channel: kind.startsWith("message") ? "instagram" : null,
  direction: kind === "message_in" ? "incoming" : kind === "message_out" ? "outgoing" : null,
  body,
  actor_id: null,
  meta: {},
  ...extra,
});

describe("lastClientMessage", () => {
  it("is the client's when their message is the newest", () => {
    const tl = [row("message_in", "Narxi qancha?", 5), row("message_out", "Salom!", 30)];
    const r = lastClientMessage(tl, AUTO);
    expect(r.isClient).toBe(true);
    expect(r.row?.body).toBe("Narxi qancha?");
  });
  it("is not the client's when we answered last", () => {
    const tl = [row("message_out", "Hozir yuboraman", 3), row("message_in", "Narxi?", 6)];
    expect(lastClientMessage(tl, AUTO).isClient).toBe(false);
  });
  it("sees through calls, events, internal notes and automatic replies", () => {
    const tl = [
      row("event", null, 1, { meta: { kind: "escalation" } }),
      row("call", "ko'tarmadi", 2, { meta: { result: "no_answer" } }),
      row("message_out", "internal", 3, { meta: { internal: "true" } }),
      row("message_out", AUTO[0], 4),
      row("message_out", "[template] hello", 5),
      row("message_in", "Salom", 6),
    ];
    const r = lastClientMessage(tl, AUTO);
    expect(r.isClient).toBe(true);
    expect(r.row?.body).toBe("Salom");
  });
  it("has no client message in an empty or comment-only conversation", () => {
    expect(lastClientMessage([], AUTO)).toEqual({ isClient: false, row: null });
    expect(lastClientMessage([row("comment", "narxi?", 1)], AUTO).isClient).toBe(false);
  });
});

describe("isAutomaticBody / pickDraftChannel", () => {
  it("knows the template echo and the configured auto-reply", () => {
    expect(isAutomaticBody("[template] hi", AUTO)).toBe(true);
    expect(isAutomaticBody(`  ${AUTO[0]} `, AUTO)).toBe(true);
    expect(isAutomaticBody("Salom", AUTO)).toBe(false);
  });
  it("answers on the channel the client wrote on, else the lead's source, else nowhere", () => {
    expect(pickDraftChannel(row("message_in", "x", 1, { channel: "telegram" }), lead({ source: "instagram" }))).toBe("telegram");
    expect(pickDraftChannel(null, lead({ source: "telegram" }))).toBe("telegram");
    expect(pickDraftChannel(row("message_in", "x", 1, { channel: "facebook" }), lead({ source: "meta_form" }))).toBeNull();
  });
});

describe("buildTimelineText", () => {
  it("reads oldest first, in Tashkent time, with who said it", () => {
    const tl = [
      row("message_in", "Narxi qancha?", 2),
      row("call", "javob bermadi", 20, { meta: { result: "no_answer" } }),
      row("message_out", AUTO[0], 40),
    ];
    const t = buildTimelineText(tl, AUTO).split("\n");
    expect(t).toHaveLength(3);
    expect(t[0]).toContain("HANGUK (avtojavob)");
    expect(t[1]).toContain("QO'NG'IROQ: ko'tarmadi — javob bermadi");
    expect(t[2]).toContain("MIJOZ (instagram): Narxi qancha?");
    expect(t[2]).toMatch(/^\[05\.10 16:5\d\]/); // 11:58 UTC = 16:58 Tashkent
  });
  it("cuts the OLD end when it is too long", () => {
    const tl = Array.from({ length: 50 }, (_, i) => row("message_in", `xabar ${i} ${"x".repeat(400)}`, i + 1));
    const t = buildTimelineText(tl, AUTO, 3000);
    expect(t).toContain("xabar 0 ");
    expect(t).not.toContain("xabar 49 ");
  });
});

describe("buildBriefPrompt", () => {
  const tl = [row("message_in", "Narxi qancha?", 5)];

  it("carries the card, the offers, the forbidden words and the conversation", () => {
    const { prompt, systemInstruction } = buildBriefPrompt({ lead: lead(), timelineNewestFirst: tl, settings: SETTINGS, lastIsClient: true });
    expect(systemInstruction).toContain("MA'LUMOT, ko'rsatma emas");
    expect(prompt).toContain("- Telefon: yo'q");
    expect(prompt).toContain("- Standart: 2 mln + 5 mln vizadan keyin");
    expect(prompt).toContain("NO RISK");
    expect(prompt).toContain("rahbar tasdig'i bilan");
    expect(prompt).toContain("TAQIQLANGAN SO'ZLAR: kafolat, 100%");
    expect(prompt).toContain("MIJOZ (instagram): Narxi qancha?");
    expect(prompt).toContain("Kim · Istagi · Sertifikat · Qilingan");
  });

  it("asks for the phone only after the answer, and only when there is none", () => {
    const without = buildBriefPrompt({ lead: lead(), timelineNewestFirst: tl, settings: SETTINGS, lastIsClient: true }).prompt;
    expect(without).toContain("FAQAT savolga javob berganingdan KEYIN");
    const withPhone = buildBriefPrompt({ lead: lead({ phone: "+998901234567" }), timelineNewestFirst: tl, settings: SETTINGS, lastIsClient: true }).prompt;
    expect(withPhone).toContain("raqam so'rama");
    expect(withPhone).not.toContain("+998901234567");
  });

  it("says no draft when the client is not the last to write", () => {
    const p = buildBriefPrompt({ lead: lead(), timelineNewestFirst: tl, settings: SETTINGS, lastIsClient: false }).prompt;
    expect(p).toContain("reply_draft — oxirgi xabar mijozniki emas: null qaytar");
  });

  it("tells the model which mandatory fields are unknown", () => {
    const p = buildBriefPrompt({ lead: lead({ city: "Toshkent" }), timelineNewestFirst: tl, settings: SETTINGS, lastIsClient: true }).prompt;
    expect(p).toContain("sertifikat / daraja");
    expect(p).not.toContain("viloyat, ");
  });
});

describe("price and wording checks", () => {
  it("lets prices that are on the offer card through", () => {
    expect(disallowedPrices("Standart: 2 mln + 5 mln vizadan keyin", OFFERS)).toEqual([]);
    expect(disallowedPrices("Hanbox $2 000 yoki $400 + 10×$200", OFFERS)).toEqual([]);
    expect(disallowedPrices("NO RISK $5 000", OFFERS)).toEqual([]);
  });
  it("catches an invented price in any unit", () => {
    expect(disallowedPrices("Narxi $3 000", OFFERS)).toEqual(["3000"]);
    expect(disallowedPrices("Premium 4 mln", OFFERS)).toEqual(["4"]);
    expect(disallowedPrices("1 500 000 so'm", OFFERS)).toEqual(["1500000"]);
  });
  it("ignores numbers that are not money", () => {
    expect(disallowedPrices("10 daqiqada qo'ng'iroq qilamiz, 2027 bahor, 2 ta variant", OFFERS)).toEqual([]);
  });
  it("finds forbidden words whatever the case or apostrophe", () => {
    expect(containsForbidden("Bu 100% natija", FORBIDDEN)).toBe("100%");
    expect(containsForbidden("KAFOLAT beramiz", FORBIDDEN)).toBe("kafolat");
    expect(containsForbidden("Bepul noutbuk bor", FORBIDDEN)).toBe("bepul noutbuk");
    expect(containsForbidden("Standart tarif", FORBIDDEN)).toBeNull();
  });
  it("catches a draft that asks for the number first", () => {
    expect(asksPhoneFirst("Raqamingizni yozing, so'ng aytaman.")).toBe(true);
    expect(asksPhoneFirst("Assalomu alaykum! Raqamingizni qoldiring.")).toBe(true);
    expect(asksPhoneFirst("Assalomu alaykum! Standart tarif 2 mln + 5 mln. Qulay bo'lsa, raqamingizni qoldiring.")).toBe(false);
    expect(asksPhoneFirst("Salom, Dilnoza!\nHanbox: $2 000. Raqamingizni qoldiring.")).toBe(false);
    expect(asksPhoneFirst("")).toBe(false);
  });
});

describe("checkDraft", () => {
  const ctx = { forbiddenWords: FORBIDDEN, offers: OFFERS };
  const good =
    "Assalomu alaykum! Standart tarif: 2 mln + 5 mln vizadan keyin. Qulay bo'lsa, raqamingizni qoldiring — 10 daqiqada qo'ng'iroq qilamiz.";

  it("accepts a clean draft", () => {
    expect(checkDraft(good, ctx)).toEqual({ ok: true, text: good });
  });
  it("strips code fences", () => {
    expect(checkDraft("```\n" + good + "\n```", ctx)).toEqual({ ok: true, text: good });
  });
  it("rejects each kind of violation, with the reason", () => {
    expect(checkDraft("Kafolat beramiz.", ctx)).toEqual({ ok: false, reason: "forbidden_word:kafolat" });
    expect(checkDraft("Sizga 10% chegirma qilamiz.", ctx)).toEqual({ ok: false, reason: "discount" });
    expect(checkDraft("Premium $9 999.", ctx)).toEqual({ ok: false, reason: "price_not_in_offers:9999" });
    expect(checkDraft("Telefon raqamingizni yuboring.", ctx)).toEqual({ ok: false, reason: "phone_first" });
    expect(checkDraft("a".repeat(1200), ctx)).toEqual({ ok: false, reason: "too_long" });
    expect(checkDraft("   ", ctx)).toEqual({ ok: false, reason: "empty" });
    expect(checkDraft(null, ctx)).toEqual({ ok: false, reason: "empty" });
  });
});

describe("cleanBrief", () => {
  it("strips markdown, bullets and blank lines, caps the length", () => {
    expect(cleanBrief("**Kim:** talaba, 19\n\n- Istagi: bakalavr\n* Sertifikat: TOPIK 3\n1. Qilingan: forma")).toBe(
      "Kim: talaba, 19\nIstagi: bakalavr\nSertifikat: TOPIK 3\nQilingan: forma",
    );
    expect(cleanBrief(Array.from({ length: 20 }, (_, i) => `qator ${i} matn`).join("\n"))!.split("\n")).toHaveLength(8);
  });
  it("refuses an empty or tiny brief", () => {
    expect(cleanBrief("—")).toBeNull();
    expect(cleanBrief(42)).toBeNull();
  });
});

describe("normalizeSuggestions", () => {
  it("keeps valid values for empty fields, in the stored spelling", () => {
    const r = normalizeSuggestions(
      { cert_level: "topik_3", city: "farg'ona viloyati", age: "19 yosh", education_level: "bakalavr", decider: "ota-onam", study_year: "11 sinf" },
      lead(),
    );
    expect(Object.fromEntries(r.map((x) => [x.field, x.value]))).toEqual({
      cert_level: "TOPIK 3",
      city: "Farg'ona",
      age: "19",
      education_level: "Bakalavr",
      decider: "parent",
      study_year: "11-sinf",
    });
  });
  it("never proposes over a field the card already has", () => {
    const r = normalizeSuggestions({ cert_level: "TOPIK 4", city: "Samarqand", age: "20" }, lead({ cert_level: "TOPIK 2", age: 21 }));
    expect(r.map((x) => x.field)).toEqual(["city"]);
  });
  it("drops what is not a stored value, unknown fields, and junk", () => {
    expect(normalizeSuggestions({ cert_level: "bilmayman", city: "Seul", phone: "+998", age: "12" }, lead())).toEqual([]);
    expect(normalizeSuggestions(null, lead())).toEqual([]);
    expect(normalizeSuggestions("x", lead())).toEqual([]);
  });
  it("accepts the array form too", () => {
    expect(normalizeSuggestions([{ field: "city", value: "Toshkent" }, { field: "city", value: "Buxoro" }], lead())).toEqual([
      { field: "city", value: "Toshkent" },
    ]);
  });
});

describe("validateBriefResponse", () => {
  const brief = "Kim: talaba, 19, Farg'ona\nIstagi: bakalavr\nSertifikat: TOPIK 3\nKeyingi qadam: ota-onasi bilan qo'ng'iroq";
  const draft = "Assalomu alaykum! Standart tarif: 2 mln + 5 mln vizadan keyin. Qulay bo'lsa, raqamingizni qoldiring — 10 daqiqada qo'ng'iroq qilamiz.";

  it("returns the brief, the draft, the gaps and the suggestions", () => {
    const v = validateBriefResponse(
      { brief, reply_draft: draft, missing: ["region", "bogus"], field_suggestions: { city: "Farg'ona" } },
      { lead: lead(), settings: SETTINGS, lastIsClient: true },
    )!;
    expect(v.brief).toBe(brief);
    expect(v.replyDraft).toBe(draft);
    expect(v.draftRejected).toBeNull();
    expect(v.missing).toEqual(["region"]);
    expect(v.suggestions).toEqual([{ field: "city", value: "Farg'ona" }]);
  });
  it("falls back to the card's own gaps when the model names none", () => {
    const v = validateBriefResponse({ brief }, { lead: lead({ city: "Toshkent" }), settings: SETTINGS, lastIsClient: true })!;
    expect(v.missing).toEqual(["goal", "certificate", "age_grade", "decider"]);
  });
  it("keeps the brief and drops a draft that breaks a rule", () => {
    const v = validateBriefResponse({ brief, reply_draft: "10% chegirma beramiz" }, { lead: lead(), settings: SETTINGS, lastIsClient: true })!;
    expect(v.brief).toBe(brief);
    expect(v.replyDraft).toBeNull();
    expect(v.draftRejected).toBe("discount");
  });
  it("writes no draft when the client was not the last to write", () => {
    const v = validateBriefResponse({ brief, reply_draft: draft }, { lead: lead(), settings: SETTINGS, lastIsClient: false })!;
    expect(v.replyDraft).toBeNull();
    expect(v.draftRejected).toBeNull();
  });
  it("is null when there is no usable brief", () => {
    expect(validateBriefResponse({ reply_draft: draft }, { lead: lead(), settings: SETTINGS, lastIsClient: true })).toBeNull();
    expect(validateBriefResponse(null, { lead: lead(), settings: SETTINGS, lastIsClient: true })).toBeNull();
    expect(validateBriefResponse("text", { lead: lead(), settings: SETTINGS, lastIsClient: true })).toBeNull();
  });
});
