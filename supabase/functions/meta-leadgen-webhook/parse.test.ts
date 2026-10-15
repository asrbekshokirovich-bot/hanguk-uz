import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyAdInfo,
  applyFormInfo,
  extractLeadgenRefs,
  hubVerification,
  mapGraphLead,
  needsNameLookup,
  parseGraphTime,
  verifySignature,
  type GraphLead,
  type LeadgenRef,
} from "./parse";

/** The same function as normalizePhone in _shared/identity.ts (that file has a remote import, so tests carry a copy). */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let n = phone.replace(/\D/g, "");
  if (!n) return null;
  if (n.startsWith("998")) n = "+" + n;
  else if (n.startsWith("9") && n.length === 9) n = "+998" + n;
  return n;
}
const deps = { normalizePhone, nowMs: Date.parse("2026-10-05T12:00:00Z") };

// What Meta POSTs to the webhook when somebody submits a lead form.
const DELIVERY = {
  object: "page",
  entry: [
    {
      id: "110000000000001",
      time: 1791195330,
      changes: [
        {
          field: "leadgen",
          value: {
            ad_id: "120210000000001",
            form_id: "1234567890123456",
            leadgen_id: "444444444444",
            created_time: 1791195329,
            page_id: "110000000000001",
            adgroup_id: "120210000000002",
          },
        },
      ],
    },
  ],
};

// What GET /{leadgen_id}?fields=... answers.
const GRAPH_LEAD: GraphLead = {
  id: "444444444444",
  created_time: "2026-10-05T10:15:29+0000",
  ad_id: "120210000000001",
  ad_name: "Hanbox video 1",
  adset_id: "120210000000010",
  adset_name: "Toshkent 18-24",
  campaign_id: "120210000000020",
  campaign_name: "Hanbox oktabr",
  form_id: "1234567890123456",
  form_name: "Hanbox 10-sent",
  platform: "ig",
  field_data: [
    { name: "full_name", values: ["Dilnoza Abdullayeva"] },
    { name: "phone_number", values: ["+998 90 123 45 67"] },
    { name: "email", values: ["dilnoza@example.com"] },
    { name: "topik_yoki_ielts_sertifikatingiz_bormi?", values: ["topik_3"] },
    { name: "yoshingiz", values: ["19"] },
    { name: "qaysi_viloyatda_yashaysiz?", values: ["farg'ona_viloyati"] },
    { name: "qaysi_yo'nalish_qiziqtiradi?", values: ["bakalavr"] },
    { name: "qachon_qo'ng'iroq_qilaylik?", values: ["18:00 dan keyin"] },
  ],
};
const REF: LeadgenRef = { leadgen_id: "444444444444", page_id: "110000000000001", form_id: "1234567890123456", ad_id: "120210000000001", created_time: 1791195329 };

describe("hubVerification", () => {
  const params = (o: Record<string, string>) => new URLSearchParams(o);
  it("echoes the challenge for the right token", () => {
    expect(
      hubVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "1158201444" }), "tok"),
    ).toEqual({ status: 200, body: "1158201444" });
  });
  it("refuses a wrong token or mode", () => {
    expect(hubVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1" }), "tok").status).toBe(403);
    expect(hubVerification(params({ "hub.mode": "unsubscribe", "hub.verify_token": "tok", "hub.challenge": "1" }), "tok").status).toBe(403);
    expect(hubVerification(params({}), "tok").status).toBe(403);
  });
  it("fails closed when the token is not configured", () => {
    expect(hubVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), undefined).status).toBe(503);
    expect(hubVerification(params({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), "").status).toBe(503);
  });
});

describe("verifySignature", () => {
  const raw = JSON.stringify(DELIVERY);
  const sig = "sha256=" + createHmac("sha256", "app-secret").update(raw).digest("hex");
  it("accepts Meta's HMAC-SHA256 of the raw body", async () => {
    expect(await verifySignature(raw, sig, "app-secret")).toBe(true);
  });
  it("refuses a different body, secret, prefix or nothing", async () => {
    expect(await verifySignature(raw + " ", sig, "app-secret")).toBe(false);
    expect(await verifySignature(raw, sig, "other-secret")).toBe(false);
    expect(await verifySignature(raw, sig.replace("sha256=", "sha1="), "app-secret")).toBe(false);
    expect(await verifySignature(raw, null, "app-secret")).toBe(false);
    expect(await verifySignature(raw, "sha256=", "app-secret")).toBe(false);
  });
});

describe("extractLeadgenRefs", () => {
  it("reads the leadgen id and its context from a delivery", () => {
    expect(extractLeadgenRefs(DELIVERY)).toEqual([
      { leadgen_id: "444444444444", page_id: "110000000000001", form_id: "1234567890123456", ad_id: "120210000000001", created_time: 1791195329 },
    ]);
  });
  it("takes every leadgen change of every entry, once each, and ignores other fields", () => {
    const body = {
      object: "page",
      entry: [
        {
          id: "P1",
          changes: [
            { field: "leadgen", value: { leadgen_id: 111 } },
            { field: "leadgen", value: { leadgen_id: "111" } },
            { field: "feed", value: { leadgen_id: "222" } },
          ],
        },
        { id: "P2", changes: [{ field: "leadgen", value: { leadgen_id: "333", page_id: "P9" } }] },
      ],
    };
    expect(extractLeadgenRefs(body).map((r) => [r.leadgen_id, r.page_id])).toEqual([["111", "P1"], ["333", "P9"]]);
  });
  it("refuses an id that could change the Graph API path", () => {
    const body = { entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: "1/../me/accounts" } }, { field: "leadgen", value: {} }] }] };
    expect(extractLeadgenRefs(body)).toEqual([]);
  });
  it("copes with garbage", () => {
    expect(extractLeadgenRefs(null)).toEqual([]);
    expect(extractLeadgenRefs({ entry: "x" })).toEqual([]);
  });
});

describe("parseGraphTime", () => {
  it("reads Graph's offset without a colon", () => {
    expect(parseGraphTime("2026-10-05T10:15:29+0000")).toBe(Date.parse("2026-10-05T10:15:29Z"));
    expect(parseGraphTime("2026-10-05T15:15:29+0500")).toBe(Date.parse("2026-10-05T10:15:29Z"));
    expect(parseGraphTime("2026-10-05T10:15:29Z")).toBe(Date.parse("2026-10-05T10:15:29Z"));
  });
  it("is null for nothing", () => {
    expect(parseGraphTime(undefined)).toBeNull();
    expect(parseGraphTime("yesterday")).toBeNull();
  });
});

describe("name lookups", () => {
  it("asks for the ad and form only when the lead has no names", () => {
    expect(needsNameLookup(GRAPH_LEAD)).toEqual({ ad: false, form: false });
    expect(needsNameLookup({ ad_id: "1", form_id: "2" })).toEqual({ ad: true, form: true });
    expect(needsNameLookup({ ad_id: "1", ad_name: "A", adset_name: "S" })).toEqual({ ad: true, form: false });
    expect(needsNameLookup({})).toEqual({ ad: false, form: false });
  });
  it("fills what is missing and keeps what is there", () => {
    const g = applyFormInfo(
      applyAdInfo({ ad_id: "1", form_id: "2", ad_name: "Mine" }, { name: "Other", adset: { name: "Set" }, campaign: { name: "Camp" } }),
      { name: "Forma" },
    );
    expect(g).toMatchObject({ ad_name: "Mine", adset_name: "Set", campaign_name: "Camp", form_name: "Forma" });
    expect(applyAdInfo({}, null)).toEqual({});
  });
});

describe("mapGraphLead", () => {
  const row = mapGraphLead(GRAPH_LEAD, REF, deps);

  it("sets the source, the idempotency key and the status", () => {
    expect(row).toMatchObject({ source: "meta_form", source_id: "444444444444", status: "new", how_heard: "Ijtimoiy tarmoq reklamasi" });
  });
  it("reads the contact", () => {
    expect(row).toMatchObject({ full_name: "Dilnoza Abdullayeva", phone: "+998901234567", email: "dilnoza@example.com" });
  });
  it("fills the card's fields from answers that clearly match the stored values", () => {
    expect(row).toMatchObject({ cert_level: "TOPIK 3", age: 19, city: "Farg'ona", education_level: "Bakalavr" });
  });
  it("keeps the ad attribution", () => {
    expect(row).toMatchObject({
      contact_channel: "Instagram",
      campaign_name: "Hanbox oktabr",
      adset_name: "Toshkent 18-24",
      ad_name: "Hanbox video 1",
      form_name: "Hanbox 10-sent",
    });
    expect(row.utm).toEqual({
      campaign_id: "120210000000020",
      adset_id: "120210000000010",
      ad_id: "120210000000001",
      form_id: "1234567890123456",
      page_id: "110000000000001",
      leadgen_id: "444444444444",
    });
  });
  it("starts the clock at the form's own time", () => {
    expect(row.first_contact_at).toBe("2026-10-05T10:15:29.000Z");
  });
  it("puts the answers in the notes, the contact not", () => {
    const notes = String(row.notes);
    expect(notes.startsWith("Meta forma javoblari:")).toBe(true);
    expect(notes).toContain("qachon qo'ng'iroq qilaylik?: 18:00 dan keyin");
    expect(notes).toContain("yoshingiz: 19");
    expect(notes).not.toContain("998");
    expect(notes).not.toContain("example.com");
  });
  it("writes no timer field", () => {
    for (const k of ["timer_kind", "timer_start_at", "due_at", "first_due_at", "answered_at", "stage"]) expect(row).not.toHaveProperty(k);
  });

  it("builds the name from first and last name, and the channel from fb", () => {
    const r = mapGraphLead(
      { platform: "fb", field_data: [{ name: "first_name", values: ["Sardor"] }, { name: "last_name", values: ["Karimov"] }, { name: "phone_number", values: ["901112233"] }] },
      { leadgen_id: "555" },
      deps,
    );
    expect(r).toMatchObject({ full_name: "Sardor Karimov", phone: "+998901112233", contact_channel: "Facebook" });
  });

  it("does not map what does not clearly match — it goes to the notes", () => {
    const r = mapGraphLead(
      {
        field_data: [
          { name: "full_name", values: ["A B"] },
          { name: "phone_number", values: ["+998901234567"] },
          { name: "sertifikatingiz_bormi?", values: ["bilmayman"] },
          { name: "yoshingiz", values: ["12"] },
          { name: "viloyat", values: ["Seul"] },
          { name: "maqsad", values: ["boshqa narsa"] },
        ],
      },
      { leadgen_id: "666" },
      deps,
    );
    for (const k of ["cert_level", "age", "city", "education_level"]) expect(r).not.toHaveProperty(k);
    expect(String(r.notes)).toContain("sertifikatingiz bormi?: bilmayman");
    expect(String(r.notes)).toContain("viloyat: Seul");
  });

  it("reads 'no certificate' as an answer, but only for a certificate question", () => {
    const r = mapGraphLead({ field_data: [{ name: "topik_sertifikatingiz_bormi?", values: ["yo'q"] }, { name: "ingliz_tili_darajasi", values: ["yo'q"] }] }, { leadgen_id: "777" }, deps);
    expect(r.cert_level).toBe("Yo'q");
  });

  it("finds a certificate from the value when the question is worded oddly", () => {
    const r = mapGraphLead({ field_data: [{ name: "tilni_qanchalik_bilasiz", values: ["IELTS_6.5"] }] }, { leadgen_id: "888" }, deps);
    expect(r.cert_level).toBe("IELTS 6.5");
  });

  it("does not take a certificate number for a phone", () => {
    const r = mapGraphLead({ field_data: [{ name: "sertifikat_raqami", values: ["1234567890"] }, { name: "telefon_raqamingiz", values: ["+998901234567"] }] }, { leadgen_id: "999" }, deps);
    expect(r.phone).toBe("+998901234567");
  });

  it("still makes a lead out of a form with no usable contact", () => {
    const r = mapGraphLead({ field_data: [] }, { leadgen_id: "123456789012" }, deps);
    expect(r.full_name).toBe("Meta forma 789012");
    expect(r).not.toHaveProperty("phone");
    expect(r).not.toHaveProperty("notes");
    expect(r.first_contact_at).toBe("2026-10-05T12:00:00.000Z");
  });

  it("never dates a lead in the future, and falls back to the webhook's time", () => {
    expect(mapGraphLead({ created_time: "2030-01-01T00:00:00+0000" }, { leadgen_id: "1" }, deps).first_contact_at).toBe("2026-10-05T12:00:00.000Z");
    expect(mapGraphLead({}, { leadgen_id: "1", created_time: 1791195329 }, deps).first_contact_at).toBe("2026-10-05T10:15:29.000Z");
  });

  it("uses the e-mail's name when there is no other", () => {
    expect(mapGraphLead({ field_data: [{ name: "email", values: ["aziz.k@example.com"] }] }, { leadgen_id: "2" }, deps).full_name).toBe("aziz.k");
  });
});
