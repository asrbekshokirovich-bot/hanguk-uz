import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Problem 11: Build Supabase client with user's JWT for RLS compliance
function buildSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');

  // Use user's JWT if available, otherwise fall back to anon key
  if (authHeader?.startsWith('Bearer ') && authHeader.length > 20) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

function buildLanguageMap(): Record<string, string> {
  return { uz: 'Uzbek', ru: 'Russian', ko: 'Korean', en: 'English' };
}

function buildStudentInfo(studentContext: any): string {
  if (!studentContext) return '';
  const { profile, staffNotes, staffComments, applications } = studentContext;
  return `
## Student Information:
- Name: ${profile?.full_name || 'Unknown'}
- TOPIK Level: ${profile?.topik_level ? 'Level ' + profile.topik_level : 'Not provided'}
- IELTS Score: ${profile?.ielts_score || 'Not provided'}
- Region Preference: ${profile?.korean_region_preference || 'None specified'}
- Study/Work Priority: ${profile?.study_work_priority || 'Not specified'}
${profile?.notes ? '- Profile Notes: ' + profile.notes : ''}

### Additional Context:
${'' /* Problem 4: Staff notes about student removed from student-facing AI */}

### Previous Applications:
${applications?.length > 0 ? applications.map((a: any) => '- ' + a.university_name + ': ' + a.status).join('\n') : 'No previous applications'}
`;
}

function buildPreferencesInfo(studentPreferences: any): string {
  if (!studentPreferences) return '';
  return `
## Student Preferences (from questionnaire):
- Main Goal: ${studentPreferences.studyWorkPriority === 'study' ? 'Primarily studying' : studentPreferences.studyWorkPriority === 'work' ? 'Primarily work opportunities' : 'Both equally'}
- Korean Connections: ${studentPreferences.hasKoreanConnections === 'yes_family' ? 'Has family in Korea' : studentPreferences.hasKoreanConnections === 'yes_friends' ? 'Has friends in Korea' : 'No connections in Korea'}
- Preferred Region: ${studentPreferences.preferredRegion === 'no_preference' ? 'No preference' : studentPreferences.preferredRegion}
- Budget vs Quality Priority: ${studentPreferences.budgetPriority === 'low_tuition' ? 'Prefers lower tuition' : studentPreferences.budgetPriority === 'quality' ? 'Prefers higher quality' : 'Balanced'}
- Field of Interest: ${studentPreferences.programInterest}
`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { universityIds, language = 'uz', followUpQuestion, studentContext, studentPreferences, skipDbFetch, conversationHistory } = await req.json();

    if (!universityIds || !Array.isArray(universityIds) || universityIds.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Please select at least 2 universities to compare' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let universities: any[] | null = null;
    let notes: any[] | null = null;

    // Problem 6: Skip DB queries on follow-up questions
    if (!skipDbFetch || !followUpQuestion) {
      const supabase = buildSupabaseClient(req);

      const { data: uniData, error: uniError } = await supabase
        .from('universities')
        .select('*')
        .in('id', universityIds);

      if (uniError) throw uniError;
      universities = uniData;

      const { data: notesData, error: notesError } = await supabase
        .from('university_notes')
        .select('*')
        .in('university_id', universityIds)
        .in('note_type', ['tip', 'general'])
        .order('created_at', { ascending: false });

      if (notesError) {
        console.warn('Could not fetch university notes (RLS may restrict):', notesError.message);
      }
      notes = notesData;
    }

    const languageMap = buildLanguageMap();
    const studentInfo = buildStudentInfo(studentContext);
    const preferencesInfo = buildPreferencesInfo(studentPreferences);

    // Build context for AI
    const universitiesWithNotes = universities?.map(uni => {
      const uniNotes = notes?.filter(n => n.university_id === uni.id) || [];
      return { ...uni, staff_notes: uniNotes.map(n => ({ type: n.note_type, content: n.content })) };
    });

    const systemPrompt = `You are Hanguk AI, an expert advisor for students applying to Korean universities through the Hanguk education consultancy.

Your role is to help students compare universities and make informed decisions. You have access to detailed university data including staff notes with insider information.

${studentInfo}
${preferencesInfo}

IMPORTANT GUIDELINES:
- Respond in ${languageMap[language] || 'Uzbek'} language
- Be helpful, encouraging, and provide actionable insights
- Highlight key differences between universities
- Consider tuition costs, rankings, programs, acceptance rates
- Use any available tips to enrich your comparison
- PERSONALIZE your recommendation based on the student's TOPIK/IELTS scores, preferences, and goals
- If the student prioritizes work, emphasize universities with better job placement
- If they have connections in a specific region, consider universities there
- Structure your comparison clearly with categories
- End with a personalized recommendation based on both university data AND student profile`;

    const universityContext = universitiesWithNotes?.map(uni => {
      // Problem 9: Remove _ru suffix (columns don't exist), fallback ru to en
      const langSuffix = language === 'en' ? '_en' : language === 'ko' ? '_ko' : language === 'ru' ? '_ru' : '_uz';
      const name = uni[`name${langSuffix}`] || uni.name_uz;
      const city = uni[`city${langSuffix}`] || uni.city_uz;
      const description = uni[`description${langSuffix}`] || uni.description_uz;
      
      return `
## ${name}
- City: ${city || 'N/A'}
- Ranking: ${uni.ranking ? `#${uni.ranking}` : 'N/A'}
- Tuition: ${uni.tuition_min && uni.tuition_max ? `₩${uni.tuition_min.toLocaleString()} - ₩${uni.tuition_max.toLocaleString()}/year` : 'N/A'}
- Acceptance Rate: ${uni.acceptance_rate ? `${uni.acceptance_rate}%` : 'N/A'}
- Partner University: ${uni.is_partner ? 'Yes (special benefits available)' : 'No'}
- Programs: ${uni.programs?.join(', ') || 'N/A'}
- Description: ${description || 'N/A'}

### Staff Notes & Insider Tips:
${uni.staff_notes?.length > 0 
  ? uni.staff_notes.map((n: { type: string; content: string }) => `- [${n.type}]: ${n.content}`).join('\n')
  : 'No staff notes available'}
`;
    }).join('\n---\n') || '';

    let userPrompt: string;
    
    if (followUpQuestion && skipDbFetch) {
      // Problem 6: For follow-ups with skipDbFetch, use lighter prompt without re-sending full context
      userPrompt = `The student has a follow-up question about the universities we just compared: ${followUpQuestion}

Please answer based on your knowledge of the universities from our earlier conversation.`;
    } else if (followUpQuestion) {
      userPrompt = `Based on the university data I provided earlier:

${universityContext}

The student has a follow-up question: ${followUpQuestion}

Please answer their question specifically, referencing the university data and any relevant staff notes.`;
    } else {
      userPrompt = `Please compare these universities and help me decide which one might be best for me:

${universityContext}

Provide a comprehensive comparison covering:
1. Academic reputation and rankings
2. Cost analysis (tuition, living expenses if mentioned in notes)
3. Admission difficulty
4. Special benefits (especially for partner universities)
5. Staff insights and tips
6. Final recommendation`;
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          // Include conversation history for follow-ups
          ...(followUpQuestion && conversationHistory?.length > 0
            ? conversationHistory.map((m: { role: string; content: string }) => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content,
              }))
            : []),
          { role: 'user', content: userPrompt }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error comparing universities:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Comparison failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
