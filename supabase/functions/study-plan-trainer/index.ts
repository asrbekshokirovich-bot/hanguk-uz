import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

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

    const { 
      action, // 'teach', 'analyze', 'chat', 'generate_example'
      documentType, // 'study_plan' or 'personal_statement'
      content, // The document content or chat message
      targetUniversityId,
      language = 'en'
    } = await req.json();
    
    if (!action || !documentType) {
      return new Response(
        JSON.stringify({ error: "action and documentType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 'draft_supervise' is what the drafting workspace calls while the student
    // types. It was missing from this list, so every live-supervision request
    // was rejected with 400 "Invalid action" and the workspace never received
    // a single grammar mark or ghost-text suggestion.
    const validActions = [
      'teach',
      'analyze',
      'chat',
      'generate_example',
      'draft_supervise',
    ];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be teach, analyze, chat, or generate_example" }),
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

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VIP plan check — only PREMIUM and NO RISK plans can use study plan trainer (whitelist approach)
    const { data: planProfile } = await adminClient
      .from("profiles")
      .select("payment_plan")
      .eq("user_id", user.id)
      .single();

    // Check if user is staff (staff can always access)
    const { data: staffRoleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1);

    const isStaffUser = staffRoleCheck && staffRoleCheck.length > 0;
    const vipPlans = ['PREMIUM', 'NO RISK', 'premium', 'no_risk', 'no risk'];
    const currentPlan = planProfile?.payment_plan || '';

    if (!isStaffUser && !vipPlans.includes(currentPlan)) {
      return new Response(
        JSON.stringify({ error: "This feature requires a Premium or No Risk plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get student profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, language_track, topik_level, ielts_score, korean_region_preference, study_work_priority")
      .eq("user_id", user.id)
      .single();

    // Get student's applications with university and program info
    const { data: applications } = await adminClient
      .from("applications")
      .select(`
        id,
        status,
        university_id,
        universities:university_id (
          id,
          name_ko,
          name_en,
          city_en,
          city_ko,
          ranking,
          description_en,
          description_ko,
          website
        )
      `)
      .eq("student_id", user.id)
      .in("status", ["pending", "submitted", "in_review"]);

    // Build applications context for personalized examples
    let applicationsContext = "";
    if (applications && applications.length > 0) {
      applicationsContext = "\n\nSTUDENT'S ACTIVE APPLICATIONS:\n";
      for (const app of applications) {
        const uni = app.universities as any;
        if (uni) {
          applicationsContext += `- ${uni.name_en || uni.name_ko} (${uni.city_en || uni.city_ko || 'South Korea'})\n`;
          
          // Get programs for this university
          const { data: programs } = await adminClient
            .from("university_programs")
            .select("program_name, faculty_name, language_track, program_level")
            .eq("university_id", uni.id)
            .eq("is_available_for_international", true)
            .limit(5);
          
          if (programs && programs.length > 0) {
            applicationsContext += `  Programs: ${programs.map(p => p.program_name).join(', ')}\n`;
          }
        }
      }
    }

    // Get university information if specifically selected
    let universityContext = "";
    let selectedUniversityName = "";
    if (targetUniversityId) {
      const { data: university } = await adminClient
        .from("universities")
        .select("*")
        .eq("id", targetUniversityId)
        .single();
      
      if (university) {
        selectedUniversityName = university.name_en || university.name_ko || '';
        universityContext = `
TARGET UNIVERSITY: ${university.name_ko || university.name_en}
Location: ${university.city_en || university.city_ko || 'South Korea'}
Ranking: ${university.ranking ? `#${university.ranking} in Korea` : 'Respected institution'}
Description: ${university.description_en || university.description_ko || ''}
Website: ${university.website || ''}
`;

        // Get programs
        const { data: programs } = await adminClient
          .from("university_programs")
          .select("program_name, faculty_name, language_track, program_level, topik_requirement, ielts_requirement")
          .eq("university_id", targetUniversityId)
          .eq("is_available_for_international", true)
          .limit(10);
        
        if (programs && programs.length > 0) {
          universityContext += `\nAvailable Programs:\n${programs.map(p => 
            `- ${p.program_name} (${p.faculty_name || 'General'}) - ${p.language_track} track` +
            (p.topik_requirement ? `, TOPIK ${p.topik_requirement}+ required` : '') +
            (p.ielts_requirement ? `, IELTS ${p.ielts_requirement}+ required` : '')
          ).join('\n')}`;
        }
      }
    }

    // Determine the language for writing based on student's track
    const writingLanguage = profile?.language_track === 'korean' ? 'Korean' : 'English';
    
    const studentContext = profile ? `
STUDENT PROFILE:
Name: ${profile.full_name || 'Student'}
Language Track: ${profile.language_track || 'Not specified'} (Study Plan should be written in ${writingLanguage})
Korean Level: ${profile.topik_level ? `TOPIK ${profile.topik_level}` : 'Beginner'}
English Level: ${profile.ielts_score ? `IELTS ${profile.ielts_score}` : 'Not specified'}
Study/Work Priority: ${profile.study_work_priority || 'Not specified'}
Regional Preference: ${profile.korean_region_preference || 'No preference'}
${applicationsContext}
` : '';

    const langInstruction = language === 'ko' ? 'Respond in Korean (한국어).' :
                            language === 'uz' ? 'Respond in Uzbek.' :
                            language === 'ru' ? 'Respond in Russian.' :
                            'Respond in English.';

    let systemPrompt = "";
    let userPrompt = "";

    // Live supervision while the student writes. Handled before the
    // document-type split because the job is the same for a Study Plan and a
    // Personal Statement: look at the draft as it stands and hand back marks.
    //
    // Unlike every other action here, the reply is not prose for the student
    // to read — it is data the editor renders: `issues` become the red wavy
    // underlines and the one-tap fix chips, `ghostText` becomes the greyed
    // continuation the student accepts with Tab. So it must be strict JSON,
    // and it must be short: this fires repeatedly while someone is typing.
    const documentLabel = documentType === 'study_plan'
      ? 'Study Plan'
      : 'Personal Statement';
    const isSupervise = action === 'draft_supervise';

    if (isSupervise) {
      systemPrompt = `You supervise a student writing a ${documentLabel} for a Korean university application, while they type.

Return ONLY a JSON object of this exact shape:
{
  "issues": [ { "originalText": "<text exactly as it appears in the draft>", "suggestion": "<the corrected replacement>" } ],
  "ghostText": "<a short natural continuation of the draft, or an empty string>"
}

Rules for "issues":
- "originalText" MUST be copied character-for-character from the draft. It is
  matched against the draft to position the underline; text that does not
  appear verbatim is silently dropped and the student sees nothing.
- Flag only real errors: grammar, verb tense, articles, agreement, plainly
  wrong word choice, and informal wording that has no place in an application.
- Do not flag matters of taste, and do not restate the whole sentence — keep
  "originalText" to the smallest span that is actually wrong.
- Return at most 6, the most serious first. An empty list is a valid answer.

Rules for "ghostText":
- At most one sentence continuing from exactly where the draft stops.
- Return "" if the draft ends mid-word, or if any continuation would be a
  guess about the student's own life — their city, family, grades, or plans.
  Inventing those puts words in their mouth that an admissions officer will
  read as fact.

${universityContext ? `\nTARGET UNIVERSITY:\n${universityContext}` : ''}
${studentContext}`;
      userPrompt = `Draft so far:\n---\n${content ?? ''}\n---`;
    } else if (documentType === 'study_plan') {
      if (action === 'teach') {
        systemPrompt = `You are an expert advisor helping international students write effective Study Plans for Korean university applications.

${langInstruction}

Provide a comprehensive guide on writing a Study Plan. Structure your response clearly with:

1. **What is a Study Plan?**
   - Purpose and importance in Korean university applications
   - How it differs from a personal statement

2. **Key Sections to Include:**
   - Academic Background (your previous education)
   - Why Korea? (specific reasons for choosing Korea)
   - Why This University? (research about the specific university)
   - Why This Program/Major? (your academic interests)
   - Study Goals (what you want to learn and achieve)
   - Career Plans (how this degree connects to your future)
   - Timeline (semester-by-semester plan if possible)

3. **Writing Tips:**
   - Be specific and concrete (avoid vague statements)
   - Show research about the university and program
   - Connect your past → present → future
   - Use formal academic language
   - Typical length: 1-2 pages (500-1000 words)

4. **Common Mistakes to Avoid:**
   - Being too general ("I want to learn many things")
   - Not mentioning the specific university
   - Focusing only on personal life, not academics
   - Grammar and spelling errors
   - Copy-pasting generic templates

5. **Example Structure:**
   Provide a brief outline example

${universityContext ? `\n${universityContext}` : ''}
${studentContext}`;
        userPrompt = "Please teach me how to write an effective Study Plan for my Korean university application.";
      } else if (action === 'analyze') {
        systemPrompt = `You are an expert Study Plan reviewer and grammar checker for Korean university applications.

${langInstruction}

CRITICAL: Analyze the Study Plan thoroughly and provide detailed, actionable feedback.

## Your Analysis Must Include:

### 1. 📊 Overall Score (1-10)
Rate the study plan and explain why.

### 2. ✅ Strengths (What's Good)
List 2-4 specific things the student did well. Quote the good parts.

### 3. ❌ Grammar & Language Errors
**This is CRITICAL - be thorough!**
- List EVERY grammar mistake you find
- Show the error and the correction: "❌ [error] → ✅ [correction]"
- Include spelling errors, awkward phrasing, verb tense issues, article problems
- Note informal language that should be formal

### 4. 📝 Content Issues
- What important information is MISSING?
- What should be REMOVED (irrelevant content)?
- Does it specifically mention the target university?
- Are career goals connected to the degree?

### 5. 🔄 Suggested Revisions
Rewrite weak paragraphs to show how they could be improved.

### 6. 💡 Final Tips
3 specific action items the student should focus on.

${universityContext ? `\nTARGET UNIVERSITY INFO:\n${universityContext}` : ''}
${studentContext}

Be encouraging but honest. The goal is to help the student improve.`;
        userPrompt = `Please analyze my Study Plan and check for grammar mistakes:\n\n---\n${content}\n---`;
      } else if (action === 'generate_example') {
        // Generate a personalized example study plan
        const langForWriting = profile?.language_track === 'korean' ? 'Korean (한국어)' : 'English';
        
        systemPrompt = `You are an expert Study Plan writer helping international students with Korean university applications.

IMPORTANT: Write the example Study Plan in ${langForWriting} because the student is on the ${profile?.language_track || 'english'} track.

${studentContext}
${universityContext}

Based on the student's profile, language proficiency, and target university, write a COMPLETE, READY-TO-USE example Study Plan that:

1. Is approximately 600-800 words
2. Uses the student's actual name and background
3. References the specific target university and its programs
4. Incorporates the student's TOPIK/IELTS level appropriately
5. Reflects their study/work priorities
6. Is written in formal academic ${langForWriting}
7. Follows this structure:
   - Opening: Background and motivation
   - Why Korea: Specific reasons
   - Why This University: Research-based reasons
   - Study Goals: Specific academic objectives
   - Career Plans: How this connects to future
   - Conclusion: Commitment and readiness

Make it personal and specific, NOT a generic template. The student should be able to use this as a strong starting point.`;
        
        userPrompt = `Please write a personalized example Study Plan for me based on my profile and target university.`;
      } else {
        // Chat mode
        systemPrompt = `You are an AI tutor helping students improve their Study Plan for Korean university applications. 
${langInstruction}
Answer questions, provide examples, and help them refine their writing.
${universityContext ? `\nContext: ${universityContext}` : ''}
${studentContext}`;
        userPrompt = content;
      }
    } else {
      // Personal Statement
      if (action === 'teach') {
        systemPrompt = `You are an expert advisor helping international students write compelling Personal Statements for Korean university applications.

${langInstruction}

Provide a comprehensive guide on writing a Personal Statement. Structure your response clearly with:

1. **What is a Personal Statement?**
   - Purpose: Show who you are as a person
   - How it differs from a Study Plan (more personal, less academic)

2. **Key Elements to Include:**
   - Your Background and Story (family, hometown, formative experiences)
   - Your Personality and Values (what drives you?)
   - Key Life Experiences (challenges overcome, achievements)
   - Why You're Passionate About Your Field
   - What Makes You Unique
   - Your Character Strengths

3. **Storytelling Tips:**
   - Start with a hook (an interesting anecdote)
   - Show, don't just tell (use specific examples)
   - Be authentic and genuine
   - Show growth and self-reflection
   - End with a forward-looking conclusion

4. **Writing Guidelines:**
   - Use first person ("I")
   - Be specific with details
   - Typical length: 1-2 pages (500-800 words)
   - Formal but personal tone

5. **Common Mistakes to Avoid:**
   - Being too generic ("I am a hardworking person")
   - Listing achievements without context
   - Repeating information from your CV
   - Being too humble or too boastful
   - Writing what you think they want to hear

6. **Example Opening Lines:**
   Provide 2-3 example hooks

${universityContext ? `\n${universityContext}` : ''}
${studentContext}`;
        userPrompt = "Please teach me how to write an effective Personal Statement for my Korean university application.";
      } else if (action === 'analyze') {
        systemPrompt = `You are an expert Personal Statement reviewer and grammar checker for Korean university applications.

${langInstruction}

CRITICAL: Analyze the Personal Statement thoroughly and provide detailed, actionable feedback.

## Your Analysis Must Include:

### 1. 📊 Overall Score (1-10)
Rate the personal statement and explain why.

### 2. ✅ Strengths (What's Good)
List 2-4 specific things the student did well. Quote the good parts.

### 3. ❌ Grammar & Language Errors
**This is CRITICAL - be thorough!**
- List EVERY grammar mistake you find
- Show the error and the correction: "❌ [error] → ✅ [correction]"
- Include spelling errors, awkward phrasing, verb tense issues
- Note informal language that should be more polished

### 4. 📖 Storytelling Assessment
- Is there a compelling hook/opening?
- Does the narrative flow logically?
- Is the conclusion memorable?
- Does it show the student's personality?

### 5. 📝 Content Issues
- What personal details are MISSING that would make it stronger?
- What should be REMOVED (too generic or irrelevant)?
- Does it show growth/learning from experiences?

### 6. 🔄 Suggested Revisions
Rewrite weak sections to show how they could be improved.

### 7. 💡 Final Tips
3 specific action items for improvement.

${universityContext ? `\nTARGET UNIVERSITY INFO:\n${universityContext}` : ''}
${studentContext}

Be encouraging but honest.`;
        userPrompt = `Please analyze my Personal Statement and check for grammar mistakes:\n\n---\n${content}\n---`;
      } else if (action === 'generate_example') {
        const langForWriting = profile?.language_track === 'korean' ? 'Korean (한국어)' : 'English';
        
        systemPrompt = `You are an expert Personal Statement writer helping international students with Korean university applications.

IMPORTANT: Write the example Personal Statement in ${langForWriting} because the student is on the ${profile?.language_track || 'english'} track.

${studentContext}
${universityContext}

Based on the student's profile, write a COMPLETE, COMPELLING example Personal Statement that:

1. Is approximately 500-700 words
2. Uses a creative, engaging hook/opening
3. Tells a personal story (you can create realistic details based on the profile)
4. Shows personality, values, and character
5. Connects experiences to passion for their field
6. Is written in formal but personal ${langForWriting}
7. Follows this flow:
   - Hook: An engaging opening (anecdote, question, or surprising fact)
   - Background: Family, hometown, formative experiences
   - Key Experience: A challenge overcome or achievement
   - Values & Passion: What drives them
   - Future Vision: How this connects to their goals
   - Conclusion: A memorable closing

Make it personal, specific, and emotionally resonant. NOT a generic template.`;
        
        userPrompt = `Please write a personalized example Personal Statement for me based on my profile.`;
      } else {
        // Chat mode
        systemPrompt = `You are an AI tutor helping students improve their Personal Statement for Korean university applications.
${langInstruction}
Answer questions, provide examples, and help them express their unique story.
${universityContext ? `\nContext: ${universityContext}` : ''}
${studentContext}`;
        userPrompt = content;
      }
    }

    // Call gemini AI
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
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // Supervision is machine-read, fires while the student is typing, and
        // is capped at six issues plus one sentence — it needs a fraction of
        // the room a full lesson or analysis does, and the student is waiting
        // on it. The teaching actions keep their original budget.
        max_tokens: isSupervise ? 1200 : 3000,
        // Same draft, same marks. Without this the underlines flicker on and
        // off between keystrokes as the model changes its mind.
        ...(isSupervise
          ? { temperature: 0, response_format: { type: "json_object" } }
          : {}),
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
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content ?? "";

    let response: string;
    if (isSupervise) {
      // The editor accepts the payload only if it starts with '{' and ends
      // with '}', so hand it exactly that. Models still fence their JSON in
      // ```json blocks now and then even when asked for a JSON object, and a
      // fenced reply would be discarded in full — every mark in it lost.
      //
      // The parse round-trip is the point: it guarantees what we return is
      // real JSON rather than something that merely looks like it. Anything
      // unusable degrades to an empty result, which the editor reads as
      // "nothing to flag" — never an error in the student's face.
      response = '{"issues":[],"ghostText":""}';
      const first = rawContent.indexOf("{");
      const last = rawContent.lastIndexOf("}");
      if (first !== -1 && last > first) {
        try {
          const parsed = JSON.parse(rawContent.slice(first, last + 1));
          response = JSON.stringify({
            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
            ghostText: typeof parsed.ghostText === "string"
              ? parsed.ghostText
              : "",
          });
        } catch (e) {
          console.error("draft_supervise: unparseable model reply:", e);
        }
      }
    } else {
      response = rawContent || "Sorry, I couldn't generate a response.";
    }

    console.log(`Study plan trainer: ${action} for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        response,
        action,
        documentType
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Study plan trainer error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
