import { describe, expect, it } from "vitest";
import {
  addDays,
  bestAd,
  dayLabel,
  formatDailyReport,
  formatWeeklyReport,
  rangeLabel,
  reportRange,
  tashkentDate,
  type LeadReport,
} from "./format";

const daily: LeadReport = {
  from: "2026-10-04",
  to: "2026-10-04",
  totals: { leads: 25, answered: 20, answered_in_10: 18, talked: 14, offers: 6, contracts_sent: 2, students: 1 },
  by_source: [
    { source: "instagram", leads: 12, answered: 10, talked: 7, offers: 3, students: 1 },
    { source: "meta_form", leads: 8 },
    { source: "telegram", leads: 5 },
    { source: "app", leads: 0 },
  ],
  lost: [
    { reason: "price", n: 2 },
    { reason: "not_interested", n: 1 },
    { reason: null, n: 1 },
  ],
};

describe("dates", () => {
  it("reads the Tashkent calendar day, not the UTC one", () => {
    // 2026-10-05 20:00 UTC is already 01:00 on the 6th in Tashkent
    expect(tashkentDate(Date.UTC(2026, 9, 5, 20, 0, 0))).toBe("2026-10-06");
    expect(tashkentDate(Date.UTC(2026, 9, 5, 18, 59, 0))).toBe("2026-10-05");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("daily = yesterday, weekly = the seven days before today", () => {
    expect(reportRange("daily", "2026-10-06")).toEqual({ from: "2026-10-05", to: "2026-10-05" });
    expect(reportRange("weekly", "2026-10-05")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });
  it("labels days in Uzbek", () => {
    expect(dayLabel("2026-10-04")).toBe("4-oktabr");
    expect(rangeLabel("2026-09-28", "2026-10-04")).toBe("28-sentabr – 4-oktabr");
    expect(rangeLabel("2026-10-04", "2026-10-04")).toBe("4-oktabr");
  });
});

describe("daily report", () => {
  it("lists yesterday's results", () => {
    const t = formatDailyReport(daily, {
      bugunCount: 41,
      lostLabels: { price: "Narx", not_interested: "Qiziqmaydi" },
    });
    expect(t.split("\n")[0]).toBe("📊 Kechagi lidlar (4-oktabr)");
    expect(t).toContain("Yangi lidlar: 25");
    expect(t).toContain("Manba bo'yicha: Instagram 12 · Meta forma 8 · Telegram 5");
    expect(t).not.toContain("Ilova");
    expect(t).toContain("Javob berilgan: 20 · Javobsiz: 5");
    expect(t).toContain("Gaplashildi: 14 · Taklif: 6");
    expect(t).toContain("Shartnoma yuborilgan: 2 · Talaba bo'lgan (to'lov): 1");
    expect(t).toContain("Yo'qotilganlar: 4 — Narx 2 · Qiziqmaydi 1 · Sabab ko'rsatilmagan 1");
    expect(t).toContain("Bugungi BUGUN hajmi: 41");
  });

  it("shows the 10-minute control line only when it is switched on", () => {
    expect(formatDailyReport(daily, { showControlLine: false })).not.toContain("10 daqiqada javob");
    expect(formatDailyReport(daily)).not.toContain("10 daqiqada javob");
    expect(formatDailyReport(daily, { showControlLine: true })).toContain("10 daqiqada javob: 72%");
  });

  it("copes with a quiet day and an unknown BUGUN count", () => {
    const t = formatDailyReport({ from: "2026-10-04", to: "2026-10-04", totals: {}, by_source: [], lost: [] });
    expect(t).toContain("Yangi lidlar: 0");
    expect(t).toContain("Javob berilgan: 0 · Javobsiz: 0");
    expect(t).toContain("Yo'qotilganlar: 0");
    expect(t).not.toContain("BUGUN hajmi");
    expect(formatDailyReport({ from: "2026-10-04", to: "2026-10-04", totals: {} }, { showControlLine: true })).toContain(
      "10 daqiqada javob: —",
    );
  });
});

describe("weekly report", () => {
  const weekly: LeadReport = {
    from: "2026-09-28",
    to: "2026-10-04",
    totals: { leads: 120, answered: 98, talked: 60, offers: 25, contracts_sent: 8, students: 5 },
    by_source: [
      { source: "telegram", leads: 40, students: 3 },
      { source: "instagram", leads: 60, students: 2 },
      { source: "app", leads: 20, students: 0 },
    ],
    by_operator: [
      { operator_id: "11111111-aaaa", students: 3 },
      { operator_id: "22222222-bbbb", students: 2 },
      { operator_id: "33333333-cccc", students: 0 },
    ],
    by_ad: [
      { ad: "Hanbox 10-sent", leads: 40, students: 3 },
      { ad: "Magistr", leads: 55, students: 3 },
      { ad: "TOPIK 2", leads: 10, students: 0 },
    ],
    lost: [{ reason: "docs_finance", n: 7 }],
  };

  it("shows contracts by operator and source, the funnel, lost reasons and the best ad", () => {
    const t = formatWeeklyReport(weekly, {
      names: { "11111111-aaaa": "Omina", "22222222-bbbb": "Malika" },
      lostLabels: { docs_finance: "Hujjat / moliya" },
    });
    expect(t.split("\n")[0]).toBe("📈 Haftalik hisobot (28-sentabr – 4-oktabr)");
    expect(t).toContain("Shartnoma / to'lov (talaba bo'lganlar): 5");
    expect(t).toContain("Operator bo'yicha: Omina 3 · Malika 2");
    expect(t).not.toContain("Operator 333333");
    expect(t).toContain("Manba bo'yicha: Telegram 3 · Instagram 2");
    expect(t).toContain("• Lid: 120");
    expect(t).toContain("• Javob berildi: 98 (82%)");
    expect(t).toContain("• Gaplashildi: 60 (50%)");
    expect(t).toContain("• Taklif: 25 (21%)");
    expect(t).toContain("• Shartnoma yuborildi: 8 (7%)");
    expect(t).toContain("• Talaba: 5 (4%)");
    expect(t).toContain("Yo'qotish sabablari: Hujjat / moliya 7");
    // 3 students each: the one with more leads wins
    expect(t).toContain("🏆 Eng yaxshi reklama: «Magistr» — 3 talaba / 55 lid");
  });

  it("never shows the 10-minute control line", () => {
    expect(formatWeeklyReport(weekly, { showControlLine: true })).not.toContain("10 daqiqada");
  });

  it("names an operator it cannot resolve, and survives an empty week", () => {
    const t = formatWeeklyReport({ ...weekly, by_operator: [{ operator_id: "abcdef12-0000", students: 1 }] });
    expect(t).toContain("Operator abcdef 1");
    const empty = formatWeeklyReport({ from: "2026-09-28", to: "2026-10-04", totals: {} });
    expect(empty).toContain("• Lid: 0");
    expect(empty).toContain("• Talaba: 0");
    expect(empty).toContain("Yo'qotish sabablari: yo'q");
    expect(empty).toContain("Reklama ma'lumoti yo'q");
  });
});

describe("bestAd", () => {
  it("prefers students, then leads, and ignores unnamed ads", () => {
    expect(bestAd([{ ad: "A", leads: 5, students: 1 }, { ad: "B", leads: 50, students: 0 }])?.ad).toBe("A");
    expect(bestAd([{ ad: "A", leads: 5, students: 0 }, { ad: "B", leads: 50, students: 0 }])?.ad).toBe("B");
    expect(bestAd([{ ad: "—", leads: 5, students: 9 }])).toBeNull();
    expect(bestAd(null)).toBeNull();
  });
});
