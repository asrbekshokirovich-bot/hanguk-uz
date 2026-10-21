// The Study Plan test of one university (student app, university page →
// "Baholash testlari"). The student answers the three questions every
// foreign-student study plan (학업계획서) answers, the AI marks them out of
// 100 on the items the admission guides name, and the result is saved as a
// study_plan_analyses row of a completed session for that university, which
// the app reads into its admission chance.
//
// Rubric, from the guides' document-evaluation items (Kyung Hee: 전공 이해도,
// 학업 및 진로계획; Keimyung: 학업소양 — 지원동기, 학업계획):
//   motivation  30 — why this university and this major, how well it is known
//   plan        30 — what and how they will study, year by year, concretely
//   career      20 — the plan after graduation and its tie to the major
//   language    20 — clarity, grammar and register of the writing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const LANGS: Record<string, string> = {
  uz: "Uzbek (Latin script)",
  ru: "Russian",
  ko: "Korean",
  vi: "Vietnamese",
  en: "English",
};

const clamp = (n: unknown, lo: number, hi: number) => {
  const v = typeof n === "number" && isFinite(n) ? Math.round(n) : lo;
  return Math.min(hi, Math.max(lo, v));
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("authorization");
    if (!auth) return json({ error: "Authorization required" }, 401);

    const { institutionId, answers, language = "uz", seconds } = await req.json();
    if (typeof institutionId !== "string" || !Array.isArray(answers) || answers.length !== 3) {
      return json({ error: "institutionId and three answers are required" }, 400);
    }
    const texts = answers.map((a: unknown) => (typeof a === "string" ? a.trim().slice(0, 4000) : ""));

    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: uni } = await admin
      .from("institutions")
      .select("name_en, name_ko, city_ko")
      .eq("id", institutionId)
      .maybeSingle();
    if (!uni) return json({ error: "Unknown university" }, 404);
    const uniName = uni.name_en || uni.name_ko;

    // Taken once per university.
    const { data: earlier } = await admin
      .from("study_plan_sessions")
      .select("id, study_plan_analyses!inner(overall_score)")
      .eq("student_id", user.id)
      .eq("target_institution_id", institutionId)
      .not("study_plan_analyses.overall_score", "is", null)
      .limit(1);
    if (earlier && earlier.length > 0) return json({ error: "already_taken" }, 409);

    let result = {
      score: 0,
      motivation: 0,
      plan: 0,
      career: 0,
      language: 0,
      strengths: [] as string[],
      improvements: [] as string[],
      summary: "",
    };

    if (texts.every((t: string) => t.length < 20)) {
      // Nothing to mark: no call, the lowest score.
      result.summary = "";
    } else {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) return json({ error: "AI service not configured" }, 500);
      const system = `You are an admissions officer of ${uniName} (${uni.name_ko ?? ""}, ${uni.city_ko ?? "Korea"}) reviewing the study plan (학업계획서) of a foreign applicant from Uzbekistan.
Mark it strictly, as the real document evaluation would, on this rubric:
- motivation (0-30): why this university and this major; does it show real knowledge of them (not generic)?
- plan (0-30): what and how they will study, year by year, concrete courses/skills/Korean study.
- career (0-20): the plan after graduation and how it follows from the major.
- language (0-20): clarity, grammar, formal register (Korean or English, whichever is used).
Empty, off-topic or copied-template answers score near 0 on their items. Do not be generous.
Write strengths, improvements and summary in ${LANGS[language] ?? LANGS.uz}; 2-3 short items each, summary one sentence.
Reply with JSON only: {"motivation":n,"plan":n,"career":n,"language":n,"strengths":[...],"improvements":[...],"summary":"..."}`;
      const user_ = `1) Why this university and this major?\n${texts[0]}\n\n2) What and how will you study in Korea?\n${texts[1]}\n\n3) What will you do after graduating?\n${texts[2]}`;
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user_ },
          ],
          temperature: 0,
          max_tokens: 1500,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        console.error("AI error", res.status, await res.text());
        return json({ error: res.status === 429 ? "rate_limited" : "ai_failed" }, res.status === 429 ? 429 : 502);
      }
      const raw = (await res.json()).choices?.[0]?.message?.content ?? "";
      const body = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const p = JSON.parse(body);
      const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 4) : []);
      result = {
        motivation: clamp(p.motivation, 0, 30),
        plan: clamp(p.plan, 0, 30),
        career: clamp(p.career, 0, 20),
        language: clamp(p.language, 0, 20),
        score: 0,
        strengths: list(p.strengths),
        improvements: list(p.improvements),
        summary: typeof p.summary === "string" ? p.summary : "",
      };
      result.score = result.motivation + result.plan + result.career + result.language;
    }

    // Saved as the student's: a completed session for this university, the
    // answers as its draft, the marks as its analysis (1-10 there).
    const now = new Date().toISOString();
    const { data: session, error: sErr } = await admin
      .from("study_plan_sessions")
      .insert({
        student_id: user.id,
        document_type: "study_plan",
        target_institution_id: institutionId,
        status: "completed",
        current_step: 4,
        completed_at: now,
      })
      .select("id")
      .single();
    if (sErr) throw sErr;
    const content = texts.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n\n");
    const { data: draft, error: dErr } = await admin
      .from("study_plan_drafts")
      .insert({
        session_id: session.id,
        student_id: user.id,
        version: 1,
        content,
        word_count: content.split(/\s+/).filter(Boolean).length,
        source: "typed",
      })
      .select("id")
      .single();
    if (dErr) throw dErr;
    const { error: aErr } = await admin.from("study_plan_analyses").insert({
      session_id: session.id,
      draft_id: draft.id,
      overall_score: clamp(result.score / 10, 1, 10),
      strengths: result.strengths,
      improvements: result.improvements,
      content_feedback: result.summary,
      ai_response: JSON.stringify({ ...result, seconds: typeof seconds === "number" ? seconds : null }),
    });
    if (aErr) throw aErr;

    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: "failed" }, 500);
  }
});
