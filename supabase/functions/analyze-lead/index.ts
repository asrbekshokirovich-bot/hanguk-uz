import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LeadNote {
  id: string;
  content: string;
  contact_type: string | null;
  outcome: string | null;
  duration_minutes: number | null;
  contacted_at: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  interest_level: string | null;
  notes: string | null;
  ai_summary: string | null;
  preferred_university: string | null;
  preferred_program: string | null;
  budget_range: string | null;
  city: string | null;
  education_level: string | null;
  english_level: string | null;
  korean_level: string | null;
  preferred_start_date: string | null;
  priority_score: number | null;
  next_follow_up: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, analyze_all } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get leads to analyze
    let leadsQuery = supabase.from('leads').select('*');
    
    if (lead_id) {
      leadsQuery = leadsQuery.eq('id', lead_id);
    } else if (!analyze_all) {
      // Only analyze leads that haven't been analyzed in 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      leadsQuery = leadsQuery.or(`priority_score.is.null,updated_at.lt.${yesterday}`);
    }

    const { data: leads, error: leadsError } = await leadsQuery;
    
    if (leadsError) throw leadsError;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ message: 'No leads to analyze' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const lead of leads) {
      // Fetch contact notes for this lead
      const { data: notes, error: notesError } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.error(`Error fetching notes for lead ${lead.id}:`, notesError);
        continue;
      }

      // Calculate priority score and generate insights
      const analysis = await analyzeLead(lead, notes || [], lovableApiKey);

      // Build update object conditionally - protect manually-set values
      // AI NEVER updates last_contacted_at — that field is staff-only (SmartContactDialog)
      const updateData: Record<string, unknown> = {
        priority_score: analysis.priority_score,
        interest_level: analysis.interest_level,
        ai_summary: analysis.ai_summary,
      };

      // Only update next_follow_up if lead doesn't have a future one already set
      if (analysis.should_update_follow_up) {
        updateData.next_follow_up = analysis.next_follow_up;
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id);

      if (updateError) {
        console.error(`Error updating lead ${lead.id}:`, updateError);
        continue;
      }

      results.push({
        lead_id: lead.id,
        ...analysis,
      });
    }

    return new Response(JSON.stringify({ 
      analyzed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-lead:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeLead(lead: Lead, notes: LeadNote[], apiKey: string | undefined) {
  // Find last contacted date from notes
  const lastContactedAt = notes.length > 0 
    ? notes[0].contacted_at || notes[0].created_at 
    : null;

  // Calculate base priority score from rule-based logic
  let basePriorityScore = 50;

  // Interest level bonus
  if (lead.interest_level === 'high') basePriorityScore += 20;
  else if (lead.interest_level === 'medium') basePriorityScore += 10;
  else if (lead.interest_level === 'low') basePriorityScore -= 10;

  // Status-based adjustments
  if (lead.status === 'new') basePriorityScore += 15; // New leads need attention
  else if (lead.status === 'contacted') basePriorityScore += 5;
  else if (lead.status === 'qualified') basePriorityScore += 10;
  else if (lead.status === 'lost') basePriorityScore -= 30;
  else if (lead.status === 'converted') basePriorityScore -= 40; // Already converted

  // Days since last contact
  if (lastContactedAt) {
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceContact > 7) basePriorityScore += 15; // Needs follow-up
    else if (daysSinceContact > 3) basePriorityScore += 10;
    else if (daysSinceContact === 0) basePriorityScore -= 5; // Just contacted today
  } else {
    basePriorityScore += 20; // Never contacted, high priority
  }

  // Contact outcome analysis
  const outcomes = notes.map(n => n.outcome).filter(Boolean);
  const answeredCount = outcomes.filter(o => o === 'answered' || o === 'interested').length;
  const noAnswerCount = outcomes.filter(o => o === 'no_answer' || o === 'busy').length;
  
  if (answeredCount > noAnswerCount) basePriorityScore += 10;
  if (outcomes.includes('interested')) basePriorityScore += 15;
  if (outcomes.includes('not_interested')) basePriorityScore -= 20;
  if (outcomes.includes('callback_requested')) basePriorityScore += 25;

  // Has complete profile
  const profileFields = [
    lead.preferred_university,
    lead.preferred_program,
    lead.budget_range,
    lead.education_level,
  ].filter(Boolean).length;
  basePriorityScore += profileFields * 3;

  // Clamp score between 0 and 100
  basePriorityScore = Math.max(0, Math.min(100, basePriorityScore));

  // Calculate next follow-up date
  let nextFollowUp: string | null = null;
  let shouldUpdateFollowUp = true;
  const now = new Date();
  
  // Check if lead already has a future follow-up date (manually set by staff)
  if (lead.next_follow_up) {
    const existingFollowUp = new Date(lead.next_follow_up);
    existingFollowUp.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    if (existingFollowUp >= today) {
      // Keep existing future/today follow-up date — don't overwrite staff's manual entry
      nextFollowUp = lead.next_follow_up;
      shouldUpdateFollowUp = false;
      console.log(`Lead ${lead.id}: keeping existing follow-up ${lead.next_follow_up}`);
    }
  }
  
  // Only calculate a new follow-up if there isn't a valid future one
  if (shouldUpdateFollowUp) {
    if (lead.status === 'new' || !lastContactedAt) {
      nextFollowUp = now.toISOString();
    } else if (outcomes.includes('callback_requested')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextFollowUp = tomorrow.toISOString();
    } else if (basePriorityScore >= 70) {
      const followUp = new Date(now);
      followUp.setDate(followUp.getDate() + 2);
      nextFollowUp = followUp.toISOString();
    } else if (basePriorityScore >= 50) {
      const followUp = new Date(now);
      followUp.setDate(followUp.getDate() + 5);
      nextFollowUp = followUp.toISOString();
    } else {
      const followUp = new Date(now);
      followUp.setDate(followUp.getDate() + 7);
      nextFollowUp = followUp.toISOString();
    }
  }

  // Determine interest level from analysis
  let interestLevel = lead.interest_level || 'medium';
  if (basePriorityScore >= 75) interestLevel = 'high';
  else if (basePriorityScore >= 40) interestLevel = 'medium';
  else interestLevel = 'low';

  // Generate AI summary if API key available
  let aiSummary = lead.ai_summary;
  
  if (apiKey && notes.length > 0) {
    try {
      aiSummary = await generateAISummary(lead, notes, apiKey);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      // Fall back to rule-based summary
      aiSummary = generateRuleBasedSummary(lead, notes, basePriorityScore);
    }
  } else {
    aiSummary = generateRuleBasedSummary(lead, notes, basePriorityScore);
  }

  return {
    priority_score: basePriorityScore,
    interest_level: interestLevel,
    ai_summary: aiSummary,
    next_follow_up: nextFollowUp,
    should_update_follow_up: shouldUpdateFollowUp,
  };
}

function generateRuleBasedSummary(lead: Lead, notes: LeadNote[], priorityScore: number): string {
  const parts: string[] = [];

  // Priority indicator
  if (priorityScore >= 75) {
    parts.push('🔥 High priority lead.');
  } else if (priorityScore >= 50) {
    parts.push('⚡ Medium priority.');
  } else {
    parts.push('📋 Lower priority.');
  }

  // Contact summary
  if (notes.length === 0) {
    parts.push('No contact attempts yet.');
  } else {
    const outcomes = notes.map(n => n.outcome).filter(Boolean);
    const answeredCount = outcomes.filter(o => o === 'answered' || o === 'interested').length;
    parts.push(`${notes.length} contact(s), ${answeredCount} answered.`);
  }

  // Profile completeness
  const hasProfile = lead.preferred_university || lead.budget_range || lead.education_level;
  if (!hasProfile) {
    parts.push('Profile incomplete - gather more info.');
  }

  // Recommendations
  if (lead.status === 'new') {
    parts.push('Action: Make first contact.');
  } else if (notes.some(n => n.outcome === 'callback_requested')) {
    parts.push('Action: Callback requested!');
  } else if (notes.some(n => n.outcome === 'interested')) {
    parts.push('Action: Schedule consultation.');
  }

  return parts.join(' ');
}

async function generateAISummary(lead: Lead, notes: LeadNote[], apiKey: string): Promise<string> {
  const notesText = notes.slice(0, 10).map(n => {
    const date = n.contacted_at || n.created_at;
    const outcome = n.outcome ? ` [${n.outcome}]` : '';
    return `- ${new Date(date).toLocaleDateString()}: ${n.content}${outcome}`;
  }).join('\n');

  const prompt = `Analyze this lead and provide a brief 2-3 sentence summary with actionable recommendation.

Lead: ${lead.full_name}
Status: ${lead.status}
Interest Level: ${lead.interest_level || 'unknown'}
Source: ${lead.source}
University Interest: ${lead.preferred_university || 'not specified'}
Budget: ${lead.budget_range || 'not specified'}
Education: ${lead.education_level || 'not specified'}

Contact History:
${notesText || 'No contact notes yet.'}

Provide a concise summary focusing on:
1. Lead quality assessment
2. Key interests/concerns from notes
3. Specific next action recommendation

Keep response under 100 words, in a professional CRM tone.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a CRM assistant analyzing leads for a student consultancy. Be concise and actionable.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || generateRuleBasedSummary(lead, notes, 50);
}
