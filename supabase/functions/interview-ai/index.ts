import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { ApiError, handleError } from "../_shared/error-handler.ts";
import { fetchWithRetry } from "../_shared/api-utils.ts";
import { ipLimiter } from "../_shared/rate-limiter.ts";

interface InterviewMessage {
  role: "interviewer" | "student";
  content: string;
}

// Focus topic definitions
const FOCUS_TOPIC_PROMPTS: Record<string, string> = {
  motivation: `
FOCUS MODE: Motivation & University Choice
Concentrate primarily on these question types:
- Why did you choose to study in South Korea specifically?
- What attracted you to this university?
- How did you first become interested in Korea?
- What specific aspects of Korean education appeal to you?
Ask 4-6 focused questions on motivation before wrapping up.`,
  
  academic: `
FOCUS MODE: Academic Background
Concentrate primarily on these question types:
- Tell me about your academic background
- What subjects did you excel in?
- How have you prepared academically for this program?
- What research interests do you have?
Ask 4-6 focused questions on academics before wrapping up.`,
  
  career: `
FOCUS MODE: Career Goals
Concentrate primarily on these question types:
- What are your career plans after graduation?
- How does this program support your career goals?
- Do you plan to work in Korea or return home?
- What industry interests you most?
Ask 4-6 focused questions on career before wrapping up.`,
  
  personal: `
FOCUS MODE: Personal Strengths & Challenges
Concentrate primarily on these question types:
- What do you consider your greatest strength?
- What challenges do you expect while studying abroad?
- How do you handle difficult situations?
- What makes you unique compared to other applicants?
Ask 4-6 focused questions on personal qualities before wrapping up.`,
  
  language: `
FOCUS MODE: Language & Preparation
Concentrate primarily on these question types:
- How long have you been learning Korean/English?
- What methods have you used to study the language?
- How do you plan to improve your language skills in Korea?
- How have you prepared for studying in a foreign language?
Ask 4-6 focused questions on language before wrapping up.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Lightweight ip rate-limiting per isolate to stop interview scraping bots
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const allowed = await ipLimiter.checkLimit(clientIp, 60, 60 * 1000); 
    if (!allowed) {
      throw new ApiError(429, "Rate limit exceeded. Please try again later.");
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new ApiError(401, "Authorization required");
    }

    const { sessionId, studentMessage, sessionType, targetUniversityId, language, focusTopic } = await req.json();
    
    if (!sessionId || !studentMessage) {
      return new Response(
        JSON.stringify({ error: "sessionId and studentMessage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user and session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VIP plan check — only PREMIUM and NO RISK plans can use interview practice (whitelist approach)
    const { data: userProfile } = await adminClient
      .from("profiles")
      .select("payment_plan")
      .eq("user_id", user.id)
      .single();

    // Check if user is staff (staff can always access)
    const { data: staffRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1);

    const isStaff = staffRole && staffRole.length > 0;
    const allowedPlans = ['PREMIUM', 'NO RISK', 'premium', 'no_risk', 'no risk'];
    const userPlan = userProfile?.payment_plan || '';

    if (!isStaff && !allowedPlans.includes(userPlan)) {
      return new Response(
        JSON.stringify({ error: "This feature requires a Premium or No Risk plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("student_id", user.id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save student message
    await adminClient.from("interview_messages").insert({
      session_id: sessionId,
      role: "student",
      content: studentMessage,
    });

    // Get conversation history
    const { data: messages } = await adminClient
      .from("interview_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    // Get student profile for personalized interview
    const { data: studentProfile } = await adminClient
      .from("profiles")
      .select("full_name, topik_level, ielts_score, language_track, korean_region_preference, study_work_priority")
      .eq("user_id", user.id)
      .single();

    // Get student's applications
    const { data: studentApplications } = await adminClient
      .from("applications")
      .select("university_id, status")
      .eq("student_id", user.id);

    // Get relevant questions for context
    const { data: questions } = await adminClient
      .from("interview_questions")
      .select("question_ko, question_en, question_uz, question_ru, category, tips")
      .eq("is_active", true)
      .limit(10);

    // Document-based interview context
    let documentContext = "";
    
    if (sessionType === "document_based") {
      const { data: studyPlanSessions } = await adminClient
        .from("study_plan_sessions")
        .select("id, document_type")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (studyPlanSessions && studyPlanSessions.length > 0) {
        for (const spSession of studyPlanSessions) {
          const { data: drafts } = await adminClient
            .from("study_plan_drafts")
            .select("content, word_count")
            .eq("session_id", spSession.id)
            .neq("source", "ai_generated")
            .order("version", { ascending: false })
            .limit(1);

          if (drafts && drafts.length > 0 && drafts[0].content) {
            const docType = spSession.document_type === "study_plan" ? "STUDY PLAN" : "PERSONAL STATEMENT";
            const truncatedContent = drafts[0].content.substring(0, 2000);
            documentContext += `\n\n=== STUDENT'S ${docType} ===\n${truncatedContent}${drafts[0].content.length > 2000 ? '...' : ''}`;
          }
        }
      }
    }

    // Build university context
    let universityContext = "";
    let universityPrograms = "";
    let universityNotes = "";
    
    let targetUniId = targetUniversityId;
    if (!targetUniId && studentApplications && studentApplications.length > 0) {
      targetUniId = studentApplications[0].university_id;
    }

    if (targetUniId) {
      const { data: university } = await adminClient
        .from("universities")
        .select("*")
        .eq("id", targetUniId)
        .single();
      
      if (university) {
        universityContext = `
=== TARGET UNIVERSITY INFORMATION ===
University Name: ${university.name_ko || university.name_en} (${university.name_en || ''})
Location: ${university.city_ko || university.city_en || 'Seoul'}, South Korea
Ranking: ${university.ranking ? `#${university.ranking} in Korea` : 'Well-regarded institution'}
Website: ${university.website || 'N/A'}
Description: ${university.description_en || university.description_ko || 'A prestigious Korean university'}
`;
      }

      const { data: programs } = await adminClient
        .from("university_programs")
        .select("program_name, faculty_name, language_track, topik_requirement, ielts_requirement, program_level")
        .eq("university_id", targetUniId)
        .eq("is_available_for_international", true)
        .limit(20);
      
      if (programs && programs.length > 0) {
        universityPrograms = `
=== AVAILABLE PROGRAMS ===
${programs.map(p => `- ${p.program_name} (${p.faculty_name || 'General'}) - ${p.language_track} track, ${p.program_level}
  Requirements: TOPIK ${p.topik_requirement || 'N/A'}, IELTS ${p.ielts_requirement || 'N/A'}`).join('\n')}
`;
      }

      const { data: notes } = await adminClient
        .from("university_notes")
        .select("content, note_type")
        .eq("university_id", targetUniId)
        .limit(5);
      
      if (notes && notes.length > 0) {
        universityNotes = `
=== INSIDER TIPS & NOTES ===
${notes.map(n => `[${n.note_type}]: ${n.content}`).join('\n')}
`;
      }

      const { data: admissionPeriods } = await adminClient
        .from("university_admission_periods")
        .select("semester, year, application_start, application_end, language_track")
        .eq("university_id", targetUniId)
        .gte("application_end", new Date().toISOString())
        .order("application_start", { ascending: true })
        .limit(3);
      
      if (admissionPeriods && admissionPeriods.length > 0) {
        universityContext += `
=== UPCOMING ADMISSIONS ===
${admissionPeriods.map(a => `- ${a.year} ${a.semester}: Applications ${a.application_start} to ${a.application_end} (${a.language_track || 'All tracks'})`).join('\n')}
`;
      }
    }

    // Build student profile context
    let studentContext = "";
    if (studentProfile) {
      studentContext = `
=== STUDENT PROFILE ===
Name: ${studentProfile.full_name || 'Student'}
Language Track: ${studentProfile.language_track || 'Not specified'}
Korean Level: ${studentProfile.topik_level ? `TOPIK Level ${studentProfile.topik_level}` : 'Not specified'}
English Level: ${studentProfile.ielts_score ? `IELTS ${studentProfile.ielts_score}` : 'Not specified'}
Region Preference: ${studentProfile.korean_region_preference || 'Open to all'}
Study/Work Priority: ${studentProfile.study_work_priority || 'Not specified'}
`;
    }

    // Build conversation for AI
    const conversationHistory = (messages || []).map((m: InterviewMessage) => ({
      role: m.role === "interviewer" ? "assistant" : "user",
      content: m.content,
    }));

    const questionBank = questions?.map(q => {
      const lang = language || "ko";
      const questionText = lang === "ko" ? q.question_ko :
                          lang === "en" ? q.question_en :
                          lang === "uz" ? q.question_uz :
                          lang === "ru" ? q.question_ru : q.question_ko;
      return `- ${questionText} (${q.category})${q.tips ? ` [Tip: ${q.tips}]` : ''}`;
    }).join("\n") || "";

    // Determine language for interview
    const interviewLang = language === 'en' ? 'English' : 'Korean';
    const languageInstruction = language === 'en' 
      ? 'Speak ONLY in English. Do not use Korean at all.'
      : 'Speak ONLY in Korean (한국어). Do not use English at all.';

    // Focus topic prompt
    const focusTopicPrompt = focusTopic && focusTopic !== 'all' 
      ? FOCUS_TOPIC_PROMPTS[focusTopic] || ''
      : '';

    // Document-based interview instructions
    const documentInstructions = sessionType === "document_based" && documentContext ? `
DOCUMENT-BASED INTERVIEW MODE:
You have access to the student's written Study Plan and/or Personal Statement below.

IMPORTANT INSTRUCTIONS FOR DOCUMENT-BASED QUESTIONS:
1. Reference SPECIFIC details from their Study Plan/Personal Statement
2. Ask follow-up questions about claims they made
3. Challenge them to elaborate on their stated goals
4. Verify consistency between their written content and verbal answers
5. If the student's verbal answer contradicts their written document, politely ask for clarification

${documentContext}
` : '';

    const systemPrompt = `You are a professional Korean university admission interviewer conducting a practice interview. 
Your role is to help students prepare for real university admission interviews in Korea.

IMPORTANT LANGUAGE RULE:
${languageInstruction}

CRITICAL QUESTION STYLE:
- Ask SHORT, FOCUSED questions (1-2 sentences maximum)
- Never ask multiple questions at once
- Keep your responses under 50 words (this will be spoken aloud)

${focusTopicPrompt}

${documentInstructions}

CORE INTERVIEW QUESTIONS TO ASK (adapt based on conversation flow):
1. Self-introduction: "Can you briefly introduce yourself?"
2. Why Korea: "Why did you choose to study in South Korea?"
3. Why this university: "Why did you choose ${targetUniId ? 'this specific university' : 'Korean universities'}?"
4. Why this major/faculty: "Why are you interested in this field of study?"
5. Language learning: "How long have you been learning Korean/English?"
6. Interest origin: "How did you first become interested in Korea?"
7. How you found us: "How did you learn about our university?"
8. Future plans: "What are your plans after graduation?"
9. Stay or return: "Do you plan to work in Korea or return to your home country?"
10. Strengths: "What do you consider your greatest strength?"
11. Challenges: "What challenges do you expect while studying abroad?"
12. Preparation: "How have you prepared for studying in Korea?"

${universityContext ? `
USE THIS UNIVERSITY INFORMATION IN YOUR QUESTIONS:
${universityContext}
${universityPrograms}
${universityNotes}
` : ''}

${studentContext ? `
STUDENT BACKGROUND (use to personalize questions):
${studentContext}
` : ''}

Guidelines:
1. Be warm and encouraging - this is practice to build confidence.
2. Ask ONE simple question at a time.
3. Give brief positive feedback before next question (e.g., "Good answer!" or "I see.")
4. After 8-10 exchanges, naturally wrap up with encouragement.
5. Cover topics gradually: introduction → motivation → academics → plans.
${sessionType === "document_based" ? "6. For document-based interviews, focus primarily on verifying and elaborating on the student's written documents." : ""}

Session type: ${sessionType || "general"}
${focusTopic && focusTopic !== 'all' ? `Focus topic: ${focusTopic}` : ''}

Sample questions for inspiration:
${questionBank}

Current conversation length: ${conversationHistory.length} messages
${conversationHistory.length === 0 ? `START THE INTERVIEW NOW. Warmly greet the student in ${interviewLang} and ask them to introduce themselves briefly.` : ""}
${conversationHistory.length >= 8 ? "The interview is nearing end. Ask 1-2 more questions, then give a warm closing with brief suggestions for improvement." : ""}`;

    // Call gemini AI
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new ApiError(500, "AI service not configured");
    }

    // Leveraging fetchWithRetry to gracefully handle Gemini 429 quota spikes behind the scenes
    const aiResponse = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${geminiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: studentMessage },
        ],
        max_tokens: 300,
      }),
    }, 4); // Optional 4 retries for robustness

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error details:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new ApiError(429, "Rate limit exceeded. Please try again in a moment.");
      }
      if (aiResponse.status === 402) {
        throw new ApiError(402, "AI service temporarily unavailable.");
      }
      throw new ApiError(500, "Failed to generate response");
    }

    const aiData = await aiResponse.json();
    const interviewerResponse = aiData.choices?.[0]?.message?.content || "죄송합니다, 다시 말씀해 주시겠어요?";

    // Save interviewer message
    await adminClient.from("interview_messages").insert({
      session_id: sessionId,
      role: "interviewer",
      content: interviewerResponse,
    });

    console.log(`Interview ${sessionId}: Generated response for user ${user.id} (type: ${sessionType}, focus: ${focusTopic || 'all'})`);

    return new Response(
      JSON.stringify({ 
        response: interviewerResponse,
        messageCount: (conversationHistory.length || 0) + 2
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return handleError(error);
  }
});
