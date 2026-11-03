// assess_chances — admission and visa chances by the SAME formula as the app's
// "Baholash" screen (../assess.ts is a port of assessment.dart and
// visa_model.dart), so the AI and the app never give different numbers.
//
// Inputs come from the conversation (the model asks for the key ones); what
// is not given keeps the app's defaults. The catalogue rows and the rules are
// public data (v_app_university_catalog, eligibility_rules), read with the
// service client so a guest gets the same answer as the app.
//
// deno-lint-ignore-file no-explicit-any
import { assess, type AssessmentInputLike, groupCatalogRows, rulesFromRows, DEFAULT_RULES } from "../assess.ts";
import type { AgentTool, Source } from "./types.ts";

const ROUTES: Record<string, string> = {
  bachelor: "bachelor", bakalavr: "bachelor",
  master: "master", magistratura: "master",
  language: "languageCourse", languagecourse: "languageCourse", tilkursi: "languageCourse", d4: "languageCourse",
  college: "college", kasbiy: "college", vocational: "college",
};

/** The tool's snake_case arguments → the app's AssessmentInput fields. */
export function inputFromArgs(a: any, universityIds: string[]): AssessmentInputLike {
  const out: Record<string, unknown> = { universityIds };
  const map: Record<string, string> = {
    topik: "topik", topik_fresh: "topikFresh", gpa: "gpa", ielts: "ielts", age: "age", gap_years: "gapYears",
    bank_krw: "bankKrw", education: "education", sponsor: "sponsor", income: "income",
    income_documented: "incomeDocumented", visa_refused: "visaRefused", korea_before: "koreaBefore",
    motivation: "motivation", recommendation: "recommendation", portfolio: "portfolio", experience: "experience",
    olympiad: "olympiad", activity: "activity", study_plan: "studyPlan", interview_prep: "interviewPrep",
  };
  for (const [k, f] of Object.entries(map)) if (a?.[k] !== undefined && a?.[k] !== null) out[f] = a[k];
  const route = ROUTES[String(a?.route ?? "").toLowerCase().replace(/[\s_-]/g, "")];
  if (route) out.route = route;
  return out as AssessmentInputLike;
}

const like = (s: string) => `%${s.replace(/[%_,()]/g, " ").trim()}%`;

export const ASSESS_TOOL: AgentTool = {
  name: "assess_chances",
  description:
    "Admission chance per university and the D-2/D-4 visa chance, computed with the SAME formula as the app's 'Baholash' screen (an estimate, not a guarantee). " +
    "Give the universities by name (max 5) and what you know about the person: route (bachelor | master | language | college), topik (0–6), topik_fresh (certificate under 2 years), gpa (5-point school average), ielts, age, gap_years (0–3), bank_krw (money in the bank, won), education (0 school, 1 college/lyceum, 2 bachelor, 3 master), sponsor (0 self, 1 parents, 2 other relative), income (0 <$5k … 3 $20k+), income_documented, visa_refused, korea_before (0 no, 1 left on time, 2 overstayed), motivation (0–2), recommendation, portfolio, experience (0–3), olympiad (0–3), activity (0–3), study_plan (0–2), interview_prep (0–2). " +
    "Ask for route, TOPIK, GPA and bank money if unknown before calling; never state a chance without this tool. Returns percent per university (open = 60+), visa percent alone and with Hanguk's help, the bank amount the visa needs, and the fixes that raise the chance.",
  parameters: {
    type: "object",
    properties: {
      universities: { type: "array", items: { type: "string" }, description: "University names, max 5" },
      route: { type: "string" }, topik: { type: "number" }, topik_fresh: { type: "boolean" }, gpa: { type: "number" },
      ielts: { type: "number" }, age: { type: "integer" }, gap_years: { type: "integer" }, bank_krw: { type: "number" },
      education: { type: "integer" }, sponsor: { type: "integer" }, income: { type: "integer" },
      income_documented: { type: "boolean" }, visa_refused: { type: "boolean" }, korea_before: { type: "integer" },
      motivation: { type: "integer" }, recommendation: { type: "boolean" }, portfolio: { type: "boolean" },
      experience: { type: "integer" }, olympiad: { type: "integer" }, activity: { type: "integer" },
      study_plan: { type: "integer" }, interview_prep: { type: "integer" },
    },
    required: ["universities"],
  },
  audiences: ["staff", "student", "guest"],
  run: async (ctx, a) => {
    const names: string[] = (Array.isArray(a?.universities) ? a.universities : [])
      .map((x: unknown) => String(x ?? "").trim()).filter(Boolean).slice(0, 5);
    if (!names.length) return { data: { error: "name at least one university" } };

    const or = names.flatMap((n) => [`name_en.ilike.${like(n)}`, `name_ko.ilike.${like(n)}`, `univ_nomi_en.ilike.${like(n)}`]).join(",");
    const { data: rows, error } = await ctx.service.from("v_app_university_catalog").select("*").or(or).limit(200);
    if (error) return { data: { error: error.message } };
    const catalog = groupCatalogRows(rows ?? []);
    if (!catalog.length) return { data: { error: "no such university in the catalogue", asked: names } };

    const { data: ruleRows } = await ctx.service.from("eligibility_rules").select("key, value");
    const rules = ruleRows?.length ? rulesFromRows(ruleRows) : DEFAULT_RULES;

    const input = inputFromArgs(a, catalog.map((u) => u.institutionId));
    const o = assess(input, catalog, rules);
    const sources: Source[] = [{ kind: "crm", label: "Hanguk ilovasi — Baholash formulasi" }];
    return {
      data: {
        method: "the app's Baholash formula (estimate, not a guarantee; the university and the embassy decide)",
        assumed_defaults: "anything not given uses the app's defaults (gpa 4.0, age 19, TOPIK certificate fresh, others 0/no)",
        universities: o.chances.map((c) => ({ name: c.name, percent: c.percent, open: c.open })),
        visa_percent: o.visaPercent,
        visa_percent_with_hanguk: o.visaWithConsultantPercent,
        band: o.band,
        required_bank_krw: o.requiredBankKrw,
        fixes: o.fixes,
        weak_point: o.hints.low,
      },
      sources,
    };
  },
};
