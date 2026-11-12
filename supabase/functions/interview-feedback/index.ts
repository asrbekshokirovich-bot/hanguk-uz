import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiFetch } from "../_shared/claude-fallback.ts";
import { serviceKey, publishableKey } from "../_shared/keys.ts";
import { feedbackTokenBudget, groupTurns, normalizeMessageScores, parseFeedback, transcriptOf } from "./turns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sessionId, language } = await req.json();
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = publishableKey();
    const serviceRoleKey = serviceKey();
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if feedback already exists. (maybeSingle: "none yet" is the
    // normal case on the first request, not an error — .single() logged a 406
    // for every interview.)
    const { data: existingFeedback } = await adminClient
      .from("interview_feedback")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingFeedback) {
      return new Response(
        JSON.stringify({ feedback: existingFeedback }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all messages from session with IDs
    const { data: messages, error: messagesError } = await adminClient
      .from("interview_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    // Score whatever the candidate actually said, however short. The old
    // "at least 2 messages" rule also counted the interviewer's own turns, so
    // a student who stopped after one answer could still be refused feedback
    // — they ended up with no result at all for a real attempt. The only case
    // with genuinely nothing to grade is "the student never spoke".
    const studentTurns = (messages ?? []).filter((m) => m.role === "student");

    if (messagesError || !messages || studentTurns.length === 0) {
      return new Response(
        JSON.stringify({ error: "Not enough conversation data for feedback" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get university information for context-aware feedback.
    // Phase 3R-B: the legacy `universities` table was dropped and the column
    // renamed to target_institution_id — this block still referenced both,
    // which made the session SELECT above fail (undefined column) and the
    // whole function return 404 "Session not found" for every request.
    let universityContext = "";
    if (session.target_institution_id) {
      const { data: university } = await adminClient
        .from("institutions")
        .select("name_ko, name_en, city_ko, tier")
        .eq("id", session.target_institution_id)
        .maybeSingle();

      if (university) {
        universityContext = `
The interview was for: ${university.name_en || university.name_ko}
Location: ${university.city_ko || 'Korea'}
${university.tier !== null && university.tier !== undefined ? `Quality tier: ${university.tier} (0 = flagship)` : ''}

IMPORTANT: Evaluate if the student demonstrated knowledge about this specific university in their answers.
`;
      }
    }

    // The transcript, one line per thing said. interview_messages has a row
    // for every piece the speech-to-text returned, so one answer is many rows:
    // they are joined here, and an answer is scored once (see turns.ts).
    const turns = groupTurns(messages);
    const answers = turns.filter((t) => t.role === "student");
    if (answers.length === 0) {
      // Rows, but nothing in them: the same as never having spoken.
      return new Response(
        JSON.stringify({ error: "Not enough conversation data for feedback" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const transcript = transcriptOf(turns);

    // The ids the per-answer review refers to: the first row of each answer.
    const studentMessageIds = answers.map((t) => t.id);

    const feedbackLang = language === "uz" ? "Uzbek" : 
                         language === "ru" ? "Russian" :
                         language === "en" ? "English" :
                         language === "vi" ? "Vietnamese" :
                         language === "ky" ? "Kyrgyz" : "Korean";

    const systemPrompt = `You are an expert Korean university admission interview evaluator. 
Analyze this practice interview transcript and provide detailed feedback.

${universityContext}

Score ONLY on evidence present in the transcript. Never award a point for
something the student did not actually say. If the interview is short, judge
what is there — do not inflate to be kind, and do not deduct for length alone
beyond what the band descriptors say.

Use these fixed bands. Pick the band whose description matches the transcript,
then choose the lower number in that band if the match is partial:

  1-2  Almost nothing usable: no substantive answer, or off-topic throughout.
  3-4  Answers are present but vague, generic, or very short; no specifics; a
       reader learns almost nothing concrete about this student.
  5-6  Adequate: answers address the question with some real content, but stay
       general, lack examples, or are loosely structured.
  7-8  Strong: specific, concrete answers with examples or reasons, clearly
       structured, sustained through the interview.
  9-10 Excellent: specific, well-evidenced, well-structured AND showing
       genuine research into Korea / the university; nothing generic.

Evaluate the student on these four criteria (score 1-10 each):
1. Communication: Clarity, structure, and articulation of answers
2. Confidence: Composure, self-assurance, and natural delivery
3. Content: Quality, relevance, and depth of answers. Did they:
   - Explain WHY they chose Korea specifically?
   - Show knowledge about the target university (if mentioned)?
   - Demonstrate clear academic/career goals?
   - Explain their interest in their chosen field?
4. Language: Language proficiency (grammar, vocabulary, fluency)

Do NOT produce an overall score. It is computed from the four criteria above,
so that the headline number can never disagree with the breakdown shown to the
student.

For each of the four scores, score_evidence must quote or closely paraphrase
the part of the transcript that justifies the band you chose. A score with no
supporting evidence in the transcript is not allowed.

SPECIFIC EVALUATION POINTS:
- Did they give specific reasons for choosing Korea (culture, education quality, career opportunities)?
- Did they mention specific aspects of the university (programs, professors, facilities, location)?
- Did they connect their past experience to future goals?
- Did they show genuine interest and research about Korea/the university?
- Did they explain their post-graduation plans clearly?

PER-ANSWER SCORING:
For each student response (identified by the ID in square brackets before it), provide individual feedback.
Be concrete about WHAT went wrong and WHERE: name the weak part of that specific answer, and give a stronger version.
Student message IDs to score: ${studentMessageIds.join(", ")}

You MUST respond with a valid JSON object in this exact format:
{
  "communication_score": <integer 1-10>,
  "confidence_score": <integer 1-10>,
  "content_score": <integer 1-10>,
  "language_score": <integer 1-10>,
  "score_evidence": {
    "communication": "<quote or close paraphrase from the transcript>",
    "confidence": "<quote or close paraphrase from the transcript>",
    "content": "<quote or close paraphrase from the transcript>",
    "language": "<quote or close paraphrase from the transcript>"
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "detailed_feedback": "A comprehensive paragraph of feedback in ${feedbackLang}, referring to what the student actually said.",
  "message_scores": [
    {
      "message_id": "<uuid>",
      "score": <number 1-10>,
      "strengths": ["what they did well"],
      "suggestions": ["what was wrong in this answer and how to fix it"],
      "ideal_hint": "a short example of a stronger version of this answer"
    }
  ]
}

Write strengths, improvements, detailed_feedback, and every message_scores entry in ${feedbackLang}.
Base every comment on the actual transcript - quote or paraphrase what the student said. Never use generic filler like "good attempt, keep practicing".
Include message_scores for EVERY student response in the transcript.`;

    // Call gemini AI for analysis
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callModel = async (sys: string, maxTokens: number) => {
      const res = await geminiFetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${geminiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: `Interview Transcript:\n\n${transcript}` },
          ],
          // 2500 was far too low: gemini-2.5-flash spends output tokens on
          // internal reasoning, so it hit the cap before emitting any JSON.
          // The content came back empty, parsing failed, and the function
          // silently saved a hardcoded 7/10 — a fake score the student had
          // no way to tell apart from a real evaluation.
          max_tokens: maxTokens,
          // 0, not 0.3: the same transcript must produce the same score every
          // time. At 0.3 a student could re-open the same finished interview
          // and see a different number, which is exactly what "approximate"
          // looks like from the outside.
          temperature: 0,
          // "low": the model's own reasoning was most of the ~40s wait after
          // "Suhbatni tugatish"; the score comes from the rubric, not from
          // long deliberation, so keep it short and the result comes fast.
          reasoning_effort: "low",
          response_format: { type: "json_object" },
        }),
      });
      return res;
    };

    // A long interview needs a longer reply: 8000 was enough for eight
    // answers and cut every longer review short.
    const aiResponse = await callModel(systemPrompt, feedbackTokenBudget(answers.length));

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate feedback" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiData = await aiResponse.json();
    let feedbackText = aiData.choices?.[0]?.message?.content || "";
    let finishReason = aiData.choices?.[0]?.finish_reason;

    // deno-lint-ignore no-explicit-any
    let feedbackData: any;
    try {
      const parsed = parseFeedback(feedbackText);
      feedbackData = parsed.data;
      if (parsed.truncated) {
        // Cut short all the same: the overall evaluation and the answers
        // reviewed before the cut are whole, and are kept.
        console.warn(
          `Feedback reply cut short (finish_reason: ${finishReason}): kept ` +
            `${Array.isArray(feedbackData.message_scores) ? feedbackData.message_scores.length : 0} of ${answers.length} answers`,
        );
      }
    } catch (parseError) {
      console.error(
        "Feedback parse failed (finish_reason:", finishReason, "):",
        parseError,
        "content preview:", String(feedbackText).slice(0, 400)
      );

      // Retry once WITHOUT the per-answer breakdown. That section is by far
      // the longest part of the reply, so dropping it leaves plenty of room
      // for a complete, parseable object — the student still gets real
      // overall scores instead of a fabricated one.
      const compactPrompt = systemPrompt
        .replace(/PER-ANSWER SCORING:[\s\S]*?Student message IDs to score:[^\n]*\n/, "")
        + "\n\nDo NOT include message_scores. Return only the overall fields.";

      const retry = await callModel(compactPrompt, 4000);
      if (retry.ok) {
        aiData = await retry.json();
        feedbackText = aiData.choices?.[0]?.message?.content || "";
        finishReason = aiData.choices?.[0]?.finish_reason;
        try {
          feedbackData = parseFeedback(feedbackText).data;
          feedbackData.message_scores = [];
        } catch (retryError) {
          console.error("Retry parse failed too:", retryError);
        }
      }

      // Still nothing usable — report the failure. Never invent a score:
      // a fabricated 7/10 is indistinguishable from a real evaluation and
      // actively misleads the student about their readiness.
      if (!feedbackData) {
        return new Response(
          JSON.stringify({ error: "Could not analyze this interview. Please try again." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Make the headline number real ────────────────────────────────────
    //
    // The model used to return `overall_score` as its own "holistic" figure,
    // unconnected to the four criteria. It could — and did — hand back 4/5/3/4
    // with an overall of 7. That is the approximate score the student was
    // seeing: a number with nothing behind it.
    //
    // The four criteria are the evaluation. The overall is their mean, rounded
    // half-up, so the headline can never contradict the breakdown printed
    // directly beneath it, and the same transcript always yields the same
    // number.
    const CRITERIA = [
      "communication_score",
      "confidence_score",
      "content_score",
      "language_score",
    ] as const;

    const componentScores: number[] = [];
    for (const key of CRITERIA) {
      const raw = feedbackData[key];
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        console.error(
          `Model returned no usable ${key}:`,
          String(feedbackText).slice(0, 400),
        );
        return new Response(
          JSON.stringify({ error: "Could not analyze this interview. Please try again." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Clamp into the band the rubric defines, then store the integer the
      // student will actually be shown.
      const clamped = Math.min(10, Math.max(1, Math.round(raw)));
      feedbackData[key] = clamped;
      componentScores.push(clamped);
    }

    const mean = componentScores.reduce((a, b) => a + b, 0) / componentScores.length;
    feedbackData.overall_score = Math.min(10, Math.max(1, Math.round(mean)));

    // One review per answer the student gave, each with the words it is
    // about: the app shows them under the review, and has no other way to
    // tell which answer it belongs to.
    feedbackData.message_scores = normalizeMessageScores(feedbackData.message_scores, answers);

    // Save feedback to database with message_scores
    const { data: savedFeedback, error: saveError } = await adminClient
      .from("interview_feedback")
      .insert({
        session_id: sessionId,
        communication_score: feedbackData.communication_score,
        confidence_score: feedbackData.confidence_score,
        content_score: feedbackData.content_score,
        language_score: feedbackData.language_score,
        overall_score: feedbackData.overall_score,
        strengths: feedbackData.strengths,
        improvements: feedbackData.improvements,
        detailed_feedback: feedbackData.detailed_feedback,
        message_scores: feedbackData.message_scores || [],
      })
      .select()
      .single();

    if (saveError) {
      // interview_feedback.session_id is unique. A second request for the same
      // interview (a double tap, a retry while the first is still being
      // written) loses the race here: the feedback exists — return it rather
      // than "Failed to save feedback".
      if (saveError.code === "23505") {
        const { data: already } = await adminClient
          .from("interview_feedback")
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle();
        if (already) {
          return new Response(
            JSON.stringify({ feedback: already }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      console.error("Failed to save feedback:", saveError);
      return new Response(
        JSON.stringify({ error: "Failed to save feedback" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session as completed
    await adminClient
      .from("interview_sessions")
      .update({ 
        status: "completed", 
        ended_at: new Date().toISOString(),
        duration_seconds: Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      })
      .eq("id", sessionId);

    console.log(`Feedback generated for session ${sessionId} with ${feedbackData.message_scores?.length || 0} per-answer scores`);

    return new Response(
      JSON.stringify({ feedback: savedFeedback }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Feedback error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
