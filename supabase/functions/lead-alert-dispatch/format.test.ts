import { describe, expect, it } from "vitest";
import { clip, crmLink, formatAlert, pickRecipients, sourceLabel, timerLabel, waitedMinutes, type AlertRow } from "./format";

const LEAD = "6f1c2d3e-0000-4000-8000-000000000001";

const row = (kind: string, payload: Record<string, unknown>, audience = "everyone"): AlertRow => ({
  id: 1,
  lead_id: LEAD,
  kind,
  audience,
  payload,
});

describe("crmLink", () => {
  it("defaults to the production domain and the desk card", () => {
    expect(crmLink(undefined, LEAD)).toBe(`https://hanguk.uz/crm/desk?lead=${LEAD}`);
  });
  it("honours CRM_BASE_URL, with or without a trailing slash", () => {
    expect(crmLink("https://crm.example.test/", LEAD)).toBe(`https://crm.example.test/crm/desk?lead=${LEAD}`);
    expect(crmLink("https://crm.example.test", null)).toBe("https://crm.example.test/crm/desk");
  });
});

describe("timerLabel", () => {
  it("names the four timers", () => {
    expect(timerLabel("first", 0)).toBe("yangi lid");
    expect(timerLabel("reply", 0)).toBe("mijoz yozdi");
    expect(timerLabel("callback", 0)).toBe("qayta qo'ng'iroq");
    expect(timerLabel(null, 0)).toBe("");
  });
  it("shows the ladder step that is due: the next attempt, never beyond 5", () => {
    expect(timerLabel("ladder", 1)).toBe("zinapoya 2/5");
    expect(timerLabel("ladder", 3)).toBe("zinapoya 4/5");
    expect(timerLabel("ladder", 9)).toBe("zinapoya 5/5");
    expect(timerLabel("ladder", 0)).toBe("zinapoya 1/5");
  });
});

describe("waitedMinutes", () => {
  it("adds the 10-minute window to a first / reply timer, not to a ladder step", () => {
    expect(waitedMinutes("first", 0)).toBe(10);
    expect(waitedMinutes("reply", 7)).toBe(17);
    expect(waitedMinutes("ladder", 3)).toBe(3);
    expect(waitedMinutes("callback", 0)).toBe(0);
    expect(waitedMinutes("first", 5, 15)).toBe(20);
    expect(waitedMinutes("first", -4)).toBe(10);
  });
});

describe("escalation text", () => {
  const payload = {
    name: "Dilnoza",
    username: "dilnoza_a",
    phone: "+998901234567",
    source: "meta_form",
    channel: "Instagram",
    campaign: "Hanbox oktabr",
    form: "Hanbox 10-sent",
    timer: "first",
    attempt: 0,
    minutes_late: 2,
    repeat: 3,
    owner_id: "u1",
  };

  it("carries everything an operator needs", () => {
    const t = formatAlert(row("escalation", payload), { names: { u1: "Omina" } })!;
    expect(t.split("\n")[0]).toBe("🔴 3. ogohlantirish — lid 12 daqiqa javobsiz");
    expect(t).toContain("Dilnoza (@dilnoza_a)");
    expect(t).toContain("Manba: Meta forma · Instagram");
    expect(t).toContain("Kampaniya: Hanbox oktabr · forma: Hanbox 10-sent");
    expect(t).toContain("Telefon: +998901234567");
    expect(t).toContain("Taymer: yangi lid");
    expect(t).toContain("Egasi: Omina");
    expect(t).toContain(`CRM: https://hanguk.uz/crm/desk?lead=${LEAD}`);
  });

  it("leaves out what is not there", () => {
    const t = formatAlert(row("escalation", { username: "sardor_k", source: "telegram", timer: "ladder", attempt: 1, minutes_late: 0 }))!;
    expect(t.split("\n")[0]).toBe("🔴 1. ogohlantirish — lid 0 daqiqa javobsiz");
    expect(t).toContain("@sardor_k");
    expect(t).toContain("Manba: Telegram");
    expect(t).toContain("Taymer: zinapoya 2/5");
    expect(t).not.toContain("Telefon:");
    expect(t).not.toContain("Egasi:");
    expect(t).not.toContain("Kampaniya:");
  });

  it("does not repeat a channel that is the source", () => {
    const t = formatAlert(row("escalation", { name: "A", source: "instagram", channel: "instagram", timer: "first" }))!;
    expect(t).toContain("Manba: Instagram\n");
  });

  it("names a lead with no name", () => {
    expect(formatAlert(row("escalation", { timer: "first" }))).toContain("(ismsiz lid)");
  });
});

describe("boss alerts", () => {
  it("promise: lead, operator, text, reason and the approve link", () => {
    const t = formatAlert(
      row("promise", { name: "Aziz", kind: "discount", text: "10% chegirma", reason: "ota-onasi so'radi", operator_id: "u2" }, "boss"),
      { names: { u2: "Malika" } },
    )!;
    expect(t.split("\n")[0]).toBe("🟠 Chegirma / maxsus shart so'rovi");
    expect(t).toContain("Lid: Aziz");
    expect(t).toContain("Operator: Malika");
    expect(t).toContain("Turi: Chegirma");
    expect(t).toContain("So'rov: 10% chegirma");
    expect(t).toContain("Sabab: ota-onasi so'radi");
    expect(t).toContain(`Tasdiqlash/Rad etish: https://hanguk.uz/crm/desk?lead=${LEAD}`);
  });

  it("keyword: the word and a 300-character excerpt", () => {
    const long = "x".repeat(500);
    const t = formatAlert(row("keyword", { name: "Jasur", word: "direktor", text: long }, "boss"))!;
    expect(t).toContain("«direktor»");
    expect(t).toContain("Lid: Jasur");
    const excerpt = t.split("\n").find((l) => l.startsWith("Xabar: "))!;
    expect(excerpt.length).toBe("Xabar: ".length + 300);
  });

  it("contract and student", () => {
    expect(formatAlert(row("contract", { name: "Nilufar", owner_id: "u3" }, "boss"), { names: { u3: "Omina" } })).toContain(
      "✅ Shartnoma / to'lov: Nilufar",
    );
    expect(formatAlert(row("student", { name: "Bekzod" }, "boss"))!.split("\n")[0]).toBe("ℹ️ Talaba yozdi: Bekzod");
  });

  it("report rows carry their own text; unknown kinds are not sent", () => {
    expect(formatAlert(row("report", { text: "hisobot" }))).toBe("hisobot");
    expect(formatAlert(row("report", {}))).toBeNull();
    expect(formatAlert(row("something_new", {}))).toBeNull();
  });
});

describe("clip", () => {
  it("keeps a message under Telegram's limit", () => {
    expect(clip("a".repeat(5000)).length).toBe(4000);
    expect(clip("short")).toBe("short");
  });
});

describe("pickRecipients", () => {
  const rows = [
    { chat_id: "1", escalate: true, boss_alerts: false },
    { chat_id: "2", escalate: true, boss_alerts: true },
    { chat_id: "3", escalate: false, boss_alerts: true },
    { chat_id: 4, escalate: true, boss_alerts: false, enabled: false },
    { chat_id: "", escalate: true },
    { chat_id: null, boss_alerts: true },
  ];

  it("everyone -> the escalate list", () => {
    expect(pickRecipients("everyone", rows).sort()).toEqual(["1", "2"]);
  });
  it("boss -> the boss_alerts list", () => {
    expect(pickRecipients("boss", rows).sort()).toEqual(["2", "3"]);
  });
  it("adds the staff channel to both audiences and dedupes", () => {
    expect(pickRecipients("everyone", rows, " -100123 ").sort()).toEqual(["-100123", "1", "2"]);
    expect(pickRecipients("boss", rows, "2").sort()).toEqual(["2", "3"]);
    expect(pickRecipients("boss", [], "-100123")).toEqual(["-100123"]);
  });
  it("is empty when nobody is configured", () => {
    expect(pickRecipients("everyone", [])).toEqual([]);
  });
});

describe("sourceLabel", () => {
  it("translates known sources and passes unknown ones through", () => {
    expect(sourceLabel("instagram")).toBe("Instagram");
    expect(sourceLabel("Public Registration")).toBe("Sayt formasi");
    expect(sourceLabel("something")).toBe("something");
    expect(sourceLabel(null)).toBe("");
  });
});
