import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseKey = (Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get("SUPABASE_ANON_KEY"))!;
    const serviceRoleKey = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    
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
      .select("*, target_university_id")
      .eq("id", sessionId)
      .eq("student_id", user.id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if feedback already exists
    const { data: existingFeedback } = await adminClient
      .from("interview_feedback")
      .select("*")
      .eq("session_id", sessionId)
      .single();

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

    if (messagesError || !messages || messages.length < 2) {
      return new Response(
        JSON.stringify({ error: "Not enough conversation data for feedback" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get university information for context-aware feedback
    let universityContext = "";
    if (session.target_university_id) {
      const { data: university } = await adminClient
        .from("universities")
        .select("name_ko, name_en, description_en, ranking, city_en")
        .eq("id", session.target_university_id)
        .single();
      
      if (university) {
        universityContext = `
The interview was for: ${university.name_ko || university.name_en}
Location: ${university.city_en || 'Korea'}
Ranking: ${university.ranking ? `#${university.ranking}` : 'N/A'}
${university.description_en ? `About: ${university.description_en.substring(0, 200)}...` : ''}

IMPORTANT: Evaluate if the student demonstrated knowledge about this specific university in their answers.
`;
      }
    }

    // Build transcript for analysis with message IDs
    const transcript = messages.map(m => 
      `[${m.id}] ${m.role === "interviewer" ? "면접관" : "학생"}: ${m.content}`
    ).join("\n\n");

    // Get student message IDs for per-answer scoring
    const studentMessageIds = messages
      .filter(m => m.role === "student")
      .map(m => m.id);

    const feedbackLang = language === "uz" ? "Uzbek" : 
                         language === "ru" ? "Russian" :
                         language === "en" ? "English" : "Korean";

    const systemPrompt = `You are an expert Korean university admission interview evaluator. 
Analyze this practice interview transcript and provide detailed feedback.

${universityContext}

Evaluate the student on these criteria (score 1-10):
1. Communication: Clarity, structure, and articulation of answers
2. Confidence: Composure, self-assurance, and natural delivery
3. Content: Quality, relevance, and depth of answers. Did they:
   - Explain WHY they chose Korea specifically?
   - Show knowledge about the target university (if mentioned)?
   - Demonstrate clear academic/career goals?
   - Explain their interest in their chosen field?
4. Language: Language proficiency (grammar, vocabulary, fluency)
5. Overall: Holistic assessment of interview readiness

SPECIFIC EVALUATION POINTS:
- Did they give specific reasons for choosing Korea (culture, education quality, career opportunities)?
- Did they mention specific aspects of the university (programs, professors, facilities, location)?
- Did they connect their past experience to future goals?
- Did they show genuine interest and research about Korea/the university?
- Did they explain their post-graduation plans clearly?

PER-ANSWER SCORING:
For each student response (identified by message ID), provide individual feedback.
Student message IDs to score: ${studentMessageIds.join(", ")}

You MUST respond with a valid JSON object in this exact format:
{
  "communication_score": <number 1-10>,
  "confidence_score": <number 1-10>,
  "content_score": <number 1-10>,
  "language_score": <number 1-10>,
  "overall_score": <number 1-10>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "detailed_feedback": "A comprehensive paragraph of feedback in ${feedbackLang}. Include specific suggestions like: 'Research more about [university]'s specific programs', 'Prepare concrete examples of why you chose Korea', 'Practice explaining your career goals more clearly', etc.",
  "message_scores": [
    {
      "message_id": "<uuid>",
      "score": <number 1-10>,
      "strengths": ["what they did well"],
      "suggestions": ["how to improve"],
      "ideal_hint": "brief example of a better response (optional)"
    }
  ]
}

Be constructive and encouraging while providing actionable suggestions based on typical Korean university interview expectations.
Include message_scores for EVERY student response in the transcript.`;

    // Call gemini AI for analysis
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${geminiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Interview Transcript:\n\n${transcript}` },
        ],
        max_tokens: 2500,
      }),
    });

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

    const aiData = await aiResponse.json();
    const feedbackText = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let feedbackData;
    try {
      const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedbackData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse feedback JSON:", parseError, feedbackText);
      feedbackData = {
        communication_score: 7,
        confidence_score: 7,
        content_score: 7,
        language_score: 7,
        overall_score: 7,
        strengths: ["Good attempt at practice interview"],
        improvements: ["Continue practicing to improve"],
        detailed_feedback: "Thank you for completing the practice interview. Keep practicing to improve your skills.",
        message_scores: []
      };
    }

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
