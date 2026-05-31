import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── 1. Fetch all aggregate data ───────────────────────────────────────────

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();

    // Funnel stats
    const { data: leads } = await supabase
      .from("leads")
      .select("id, status, priority_score, interest_level, source, city, next_follow_up, last_contacted_at, updated_at, created_at, ai_summary");

    if (!leads) throw new Error("Failed to fetch leads");

    const total = leads.length;
    const byStatus: Record<string, number> = {};
    leads.forEach((l) => {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    });

    const overdue = leads.filter(
      (l) => l.next_follow_up && new Date(l.next_follow_up) < now && !["converted", "lost"].includes(l.status)
    ).length;

    const neverContacted = leads.filter(
      (l) => !l.last_contacted_at && !["converted", "lost"].includes(l.status)
    ).length;

    const hotStuck = leads.filter(
      (l) =>
        l.priority_score !== null &&
        l.priority_score >= 70 &&
        l.status === "contacted" &&
        new Date(l.updated_at) < new Date(sevenDaysAgo)
    ).length;

    const stuckContacted = leads.filter(
      (l) => l.status === "contacted" && new Date(l.updated_at) < new Date(sevenDaysAgo)
    ).length;

    // Source breakdown
    const bySource: Record<string, number> = {};
    leads.forEach((l) => {
      bySource[l.source] = (bySource[l.source] || 0) + 1;
    });

    // City breakdown (top 5)
    const byCity: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.city) byCity[l.city] = (byCity[l.city] || 0) + 1;
    });
    const topCities = Object.entries(byCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => `${city}: ${count}`);

    // Lost lead patterns
    const lostLeads = leads.filter((l) => l.status === "lost");
    const lostWithHighInterest = lostLeads.filter((l) => l.interest_level === "high").length;
    const lostPct = total > 0 ? Math.round((lostLeads.length / total) * 100) : 0;
    const highInterestLostPct = lostLeads.length > 0 ? Math.round((lostWithHighInterest / lostLeads.length) * 100) : 0;

    // Lead notes for call outcome analysis (last 21 days)
    const { data: recentNotes } = await supabase
      .from("lead_notes")
      .select("outcome, contact_type, contacted_at, created_at")
      .gte("created_at", twentyOneDaysAgo);

    // Weekly call stats
    const weeklyStats = {
      thisWeek: { total: 0, answered: 0, rejected: 0, no_answer: 0 },
      lastWeek: { total: 0, answered: 0, rejected: 0, no_answer: 0 },
      twoWeeksAgo: { total: 0, answered: 0, rejected: 0, no_answer: 0 },
    };

    (recentNotes || []).forEach((note) => {
      const noteDate = new Date(note.created_at);
      let bucket: keyof typeof weeklyStats | null = null;
      if (noteDate >= new Date(sevenDaysAgo)) bucket = "thisWeek";
      else if (noteDate >= new Date(fourteenDaysAgo)) bucket = "lastWeek";
      else if (noteDate >= new Date(twentyOneDaysAgo)) bucket = "twoWeeksAgo";

      if (bucket && note.contact_type === "call") {
        weeklyStats[bucket].total++;
        if (note.outcome === "answered" || note.outcome === "positive") weeklyStats[bucket].answered++;
        else if (note.outcome === "rejected" || note.outcome === "not_interested") weeklyStats[bucket].rejected++;
        else if (note.outcome === "no_answer") weeklyStats[bucket].no_answer++;
      }
    });

    const answerRateThisWeek =
      weeklyStats.thisWeek.total > 0
        ? Math.round((weeklyStats.thisWeek.answered / weeklyStats.thisWeek.total) * 100)
        : null;
    const answerRateLastWeek =
      weeklyStats.lastWeek.total > 0
        ? Math.round((weeklyStats.lastWeek.answered / weeklyStats.lastWeek.total) * 100)
        : null;
    const answerRateTwoWeeksAgo =
      weeklyStats.twoWeeksAgo.total > 0
        ? Math.round((weeklyStats.twoWeeksAgo.answered / weeklyStats.twoWeeksAgo.total) * 100)
        : null;

    // Overdue breakdown by days
    const overdueLeads = leads.filter(
      (l) => l.next_follow_up && new Date(l.next_follow_up) < now && !["converted", "lost"].includes(l.status)
    );
    const overdueOver3Days = overdueLeads.filter(
      (l) => new Date(l.next_follow_up!) < new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    ).length;
    const overdueOver7Days = overdueLeads.filter(
      (l) => new Date(l.next_follow_up!) < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    // Priority score distribution
    const highPriority = leads.filter((l) => l.priority_score !== null && l.priority_score >= 70 && !["converted", "lost"].includes(l.status)).length;
    const unscored = leads.filter((l) => l.priority_score === null && !["converted", "lost"].includes(l.status)).length;

    // ─── 2. Build context for AI ───────────────────────────────────────────────

    const dataContext = `
CURRENT DATE: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

=== LEAD FUNNEL ===
Total leads: ${total}
New (untouched): ${byStatus["new"] || 0}
Contacted: ${byStatus["contacted"] || 0}
Qualified: ${byStatus["qualified"] || 0}
Converted to students: ${byStatus["converted"] || 0}
Lost: ${byStatus["lost"] || 0} (${lostPct}% of total)
Contracted: ${leads.filter((l) => l.status === "contracted").length}

=== URGENCY INDICATORS ===
Overdue follow-ups (total): ${overdue}
Overdue > 3 days: ${overdueOver3Days}
Overdue > 7 days: ${overdueOver7Days}
Never been contacted: ${neverContacted}
Stuck in "contacted" > 7 days without update: ${stuckContacted}
HOT leads (score ≥70) stuck in "contacted" > 7 days: ${hotStuck}
Unscored leads (no priority score yet): ${unscored}
High-priority active leads: ${highPriority}

=== LOST LEAD ANALYSIS ===
Total lost: ${lostLeads.length}
Lost leads that initially had "high" interest: ${lostWithHighInterest} (${highInterestLostPct}% of lost leads)
Implication: ${highInterestLostPct > 60 ? "CRITICAL - Most lost leads were initially scored high-interest. Lead quality/source problem." : "Moderate - Some mis-scoring happening."}

=== CALL SUCCESS RATE (last 3 weeks) ===
This week: ${weeklyStats.thisWeek.total} calls, ${answerRateThisWeek !== null ? answerRateThisWeek + "% answered" : "no calls logged"} (${weeklyStats.thisWeek.answered} answered, ${weeklyStats.thisWeek.no_answer} no-answer, ${weeklyStats.thisWeek.rejected} rejected)
Last week: ${weeklyStats.lastWeek.total} calls, ${answerRateLastWeek !== null ? answerRateLastWeek + "% answered" : "no calls logged"}
Two weeks ago: ${weeklyStats.twoWeeksAgo.total} calls, ${answerRateTwoWeeksAgo !== null ? answerRateTwoWeeksAgo + "% answered" : "no calls logged"}

=== LEAD SOURCES ===
${Object.entries(bySource).map(([s, c]) => `${s}: ${c}`).join(", ")}

=== TOP CITIES ===
${topCities.join(", ")}

=== PIPELINE HEALTH ===
Conversion rate (converted / total): ${Math.round(((byStatus["converted"] || 0) / total) * 100)}%
Qualified-to-converted ratio: ${byStatus["qualified"] ? Math.round(((byStatus["converted"] || 0) / (byStatus["qualified"] || 1)) * 100) : "N/A"}%
Active pipeline (not converted/lost): ${total - (byStatus["converted"] || 0) - (byStatus["lost"] || 0)}
`;

    const systemPrompt = `You are a senior CRM analyst reviewing real lead data for a Korean university admissions consultancy in Uzbekistan. 
Your job is to identify SPECIFIC, DATA-BACKED problems and give actionable recommendations.

RULES:
- Every single statement MUST reference specific numbers from the data provided
- Do NOT write generic advice like "follow up with leads" or "improve your process"
- Be direct, clinical, and honest about what the numbers mean
- Severity levels: CRITICAL (immediate action needed), HIGH (action within 24h), MEDIUM (action this week), LOW (monitor)
- Focus on what is ACTUALLY wrong, not what could theoretically go wrong
- Today's focus items should be specific and immediately actionable

Return ONLY valid JSON matching this exact structure:
{
  "summary": "One sentence description of the overall situation",
  "overall_health": "critical|poor|fair|good",
  "problems": [
    {
      "severity": "critical|high|medium|low",
      "title": "Short problem title",
      "detail": "Specific description referencing exact numbers",
      "metric": "Key number to highlight (e.g., '63 overdue')"
    }
  ],
  "focus_today": [
    {
      "action": "Specific action to take today",
      "reason": "Why this is the priority (with numbers)",
      "count": "How many leads/items this affects"
    }
  ],
  "weekly_trend": {
    "direction": "improving|declining|stable",
    "summary": "What the trend data shows with exact percentages/numbers"
  },
  "recommendations": [
    {
      "priority": "immediate|short_term|strategic",
      "title": "Recommendation title",
      "action": "Specific action with measurable outcome"
    }
  ]
}`;

    // ─── 3. Call gemini AI ────────────────────────────────────────────────────

    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this leads data and return the JSON analysis:\n\n${dataContext}` },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    
    // Parse JSON from response (strip markdown code blocks if present)
    let analysis;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { summary: "Analysis unavailable", overall_health: "unknown", problems: [], focus_today: [], weekly_trend: { direction: "stable", summary: "No trend data" }, recommendations: [] };
    }

    // ─── 4. Return combined response ───────────────────────────────────────────

    return new Response(
      JSON.stringify({
        analysis,
        raw_stats: {
          total,
          byStatus,
          overdue,
          overdueOver3Days,
          overdueOver7Days,
          neverContacted,
          stuckContacted,
          hotStuck,
          highPriority,
          unscored,
          lostWithHighInterest,
          highInterestLostPct,
          weeklyStats,
          answerRateThisWeek,
          answerRateLastWeek,
          answerRateTwoWeeksAgo,
          bySource,
          topCities,
        },
        generated_at: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("leads-intelligence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
