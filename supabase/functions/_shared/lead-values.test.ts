import { describe, expect, it } from "vitest";
import {
  CERTIFICATES,
  GOALS,
  REGIONS,
  fold,
  matchAge,
  matchCertificate,
  matchDecider,
  matchGoal,
  matchRegion,
  matchStudyYear,
} from "./lead-values";

describe("fold", () => {
  it("lower-cases, unifies apostrophes, reads underscores as spaces", () => {
    expect(fold("Farg‘ona_Viloyati")).toBe("farg'ona viloyati");
    expect(fold("  Yoʼq ")).toBe("yo'q");
  });
});

describe("stored lists", () => {
  it("keeps the exact stored values of copy.ts", () => {
    expect(GOALS).toContain("Kasbiy ta’lim");
    expect(CERTIFICATES).toContain("Yo'q");
    expect(CERTIFICATES).toContain("IELTS 7.0+");
    expect(REGIONS).toContain("Farg'ona");
  });
});

describe("matchCertificate", () => {
  it("reads TOPIK levels in every spelling Meta forms produce", () => {
    expect(matchCertificate("topik_3")).toBe("TOPIK 3");
    expect(matchCertificate("TOPIK 4")).toBe("TOPIK 4");
    expect(matchCertificate("TOPIK-2")).toBe("TOPIK 2");
    expect(matchCertificate("3-daraja TOPIK")).toBe("TOPIK 3");
  });
  it("maps IELTS bands to the stored bands", () => {
    expect(matchCertificate("IELTS 5.5")).toBe("IELTS 5.5");
    expect(matchCertificate("ielts_6.0")).toBe("IELTS 6.0");
    expect(matchCertificate("IELTS 6,5")).toBe("IELTS 6.5");
    expect(matchCertificate("IELTS 7.5")).toBe("IELTS 7.0+");
    expect(matchCertificate("IELTS 5")).toBeNull();
  });
  it("reads TOEFL and 'no certificate' (an answer, not a blank)", () => {
    expect(matchCertificate("TOEFL 90")).toBe("TOEFL");
    expect(matchCertificate("yo'q")).toBe("Yo'q");
    expect(matchCertificate("hali yo’q")).toBe("Yo'q");
    expect(matchCertificate("нет")).toBe("Yo'q");
  });
  it("does not guess", () => {
    expect(matchCertificate("")).toBeNull();
    expect(matchCertificate("bilmayman")).toBeNull();
    expect(matchCertificate("Интернет реклама")).toBeNull();
  });
});

describe("matchRegion", () => {
  it("matches Latin, Cyrillic and 'shahri/viloyati' forms", () => {
    expect(matchRegion("Toshkent shahri")).toBe("Toshkent");
    expect(matchRegion("farg'ona viloyati")).toBe("Farg'ona");
    expect(matchRegion("fargona")).toBe("Farg'ona");
    expect(matchRegion("Самарканд")).toBe("Samarqand");
    expect(matchRegion("Surxondaryo")).toBe("Termiz");
    expect(matchRegion("Qoraqalpog‘iston")).toBe("Nukus");
    expect(matchRegion("Chet el")).toBe("Chet el");
  });
  it("returns null for anything else", () => {
    expect(matchRegion("Seul")).toBeNull();
    expect(matchRegion("")).toBeNull();
  });
});

describe("matchGoal / matchStudyYear / matchDecider / matchAge", () => {
  it("maps goals", () => {
    expect(matchGoal("Bakalavr")).toBe("Bakalavr");
    expect(matchGoal("magistratura (magistr)")).toBe("Magistr");
    expect(matchGoal("hanbox")).toBe("HanBox");
    expect(matchGoal("GKS stipendiya")).toBe("GKS");
    expect(matchGoal("kasbiy ta'lim")).toBe("Kasbiy ta’lim");
    expect(matchGoal("til kursi")).toBe("Til kursi");
    expect(matchGoal("bilmayman")).toBeNull();
  });
  it("maps study years", () => {
    expect(matchStudyYear("11 sinf")).toBe("11-sinf");
    expect(matchStudyYear("2-kurs")).toBe("2-kurs");
    expect(matchStudyYear("kollej")).toBe("Kollej");
    expect(matchStudyYear("oliy")).toBeNull();
  });
  it("maps deciders", () => {
    expect(matchDecider("ota-onam")).toBe("parent");
    expect(matchDecider("self")).toBe("self");
    expect(matchDecider("o'zim")).toBe("self");
    expect(matchDecider("qarindoshim")).toBe("relative");
    expect(matchDecider("hech kim")).toBeNull();
  });
  it("keeps ages in the card's 15-45 range", () => {
    expect(matchAge("19")).toBe(19);
    expect(matchAge("19 yosh")).toBe(19);
    expect(matchAge("12")).toBeNull();
    expect(matchAge("60")).toBeNull();
    expect(matchAge("yosh")).toBeNull();
  });
});
