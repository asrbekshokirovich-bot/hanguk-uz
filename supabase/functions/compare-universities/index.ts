import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Student-facing university comparison. Rebuilt (2026-07) onto the uni_db
// `institutions` + parsed-guideline tables after the legacy `universities` /
// `university_notes` tables were dropped. Data is scoped to the CRM's default
// intake (public.intakes.is_default). Streams Claude (Anthropic) back to the
// browser, transcoded into the OpenAI-style `data: {choices:[{delta:{content}}]}`
// SSE the student UI already parses — so the client stays format-stable.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANGS: Record<string, string> = { uz: "Uzbek", ru: "Russian", ko: "Korean", en: "English" };

// Service-role client: reads app-visible parsed data plus staff-only
// institution_notes (which are fed to the AI but never returned raw).
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function fmtKrw(n: number | null | undefined): string {
  return n === null || n === undefined ? "N/A" : `₩${Number(n).toLocaleString("en-US")}`;
}

function studentBlock(ctx: any): string {
  if (!ctx?.profile) return "";
  const p = ctx.profile;
  return `\n## Student\n- Name: ${p.full_name || "Unknown"}\n- TOPIK: ${
    p.topik_level ? "Level " + p.topik_level : "not provided"
  }\n- IELTS: ${p.ielts_score || "not provided"}\n- Region preference: ${
    p.korean_region_preference || "none"
  }\n- Study/work priority: ${p.study_work_priority || "not specified"}\n${
    ctx.applications?.length
      ? "- Previous applications: " +
        ctx.applications.map((a: any) => `${a.university_name} (${a.status})`).join(", ")
      : ""
  }\n`;
}

function prefsBlock(prefs: any): string {
  if (!prefs) return "";
  return `\n## Questionnaire preferences\n- Main goal: ${
    prefs.studyWorkPriority === "study" ? "studying" : prefs.studyWorkPriority === "work" ? "work opportunities" : "both"
  }\n- Korean connections: ${prefs.hasKoreanConnections || "none"}\n- Preferred region: ${
    prefs.preferredRegion || "no preference"
  }\n- Budget vs quality: ${
    prefs.budgetPriority === "low_tuition" ? "lower tuition" : prefs.budgetPriority === "quality" ? "higher quality" : "balanced"
  }\n- Field of interest: ${prefs.programInterest || "unspecified"}\n`;
}

// Build a rich per-institution block from the normalized uni_db tables.
function institutionBlock(inst: any, bundle: any, intakeLabel: string): string {
  const cycles: any[] = bundle.cycles ?? [];
  const scholarships: any[] = bundle.scholarships ?? [];
  const tuition: any[] = bundle.tuition ?? [];
  const notes: any[] = bundle.notes ?? [];

  const reqLines: string[] = [];
  for (const c of cycles) {
    for (const r of c.requirements ?? []) {
      const bits = [
        r.topik_min_level != null ? `TOPIK≥${r.topik_min_level}` : null,
        r.topik_deferred ? "TOPIK can be deferred" : null,
        r.english_test ? `English: ${r.english_test}` : null,
        r.gpa_floor_pct != null ? `GPA floor ${r.gpa_floor_pct}%` : null,
        r.interview_required ? "interview required" : null,
      ].filter(Boolean);
      if (bits.length) reqLines.push(`  - [${c.cycle_track || c.intake_term || "track"}] ${bits.join(", ")}`);
    }
  }

  const tuitionLines = tuition
    .slice(0, 4)
    .map(
      (t) =>
        `  - ${t.faculty_group || t.academic_year || "program"}: ${fmtKrw(t.amount_krw)}/yr` +
        (t.admission_fee_krw ? ` (admission fee ${fmtKrw(t.admission_fee_krw)})` : ""),
    );

  const scholarshipLines = scholarships
    .slice(0, 6)
    .map((s) => {
      const langTracks = [
        s.topik_tier_table ? "TOPIK-based" : null,
        s.ielts_tier_table ? "IELTS-based" : null,
      ].filter(Boolean);
      return `  - ${s.name_en || s.name_ko || "Scholarship"}${
        s.award_value ? ` — ${s.award_value}` : ""
      }${langTracks.length ? ` (${langTracks.join(" / ")})` : ""}`;
    });

  const noteLines = notes.map((n) => `  - [${n.note_type}] ${n.content}`);

  return `
## ${inst.name_en || inst.name_ko || "Institution"}${inst.name_ko && inst.name_en ? ` (${inst.name_ko})` : ""}
- City: ${inst.city_ko || "N/A"} | Type: ${inst.institution_type || "N/A"} | Tier: ${inst.tier || "N/A"}
- Partner university: ${inst.is_partner ? "Yes (special benefits)" : "No"}${
    inst.is_women_only ? " | Women-only" : ""
  }
- Admission requirements (${intakeLabel}):
${reqLines.length ? reqLines.join("\n") : "  - not published yet for this intake"}
- Tuition:
${tuitionLines.length ? tuitionLines.join("\n") : "  - N/A"}
- Scholarships:
${scholarshipLines.length ? scholarshipLines.join("\n") : "  - N/A"}
- Staff notes & insider tips:
${noteLines.length ? noteLines.join("\n") : "  - none"}
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      universityIds,
      language = "uz",
      followUpQuestion,
      studentContext,
      studentPreferences,
      skipDbFetch,
      conversationHistory,
    } = await req.json();

    if (!universityIds || !Array.isArray(universityIds) || universityIds.length < 2) {
      return new Response(JSON.stringify({ error: "Please select at least 2 universities to compare" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let contextBlock = "";
    let intakeLabel = "the current intake";

    // Skip the (expensive) DB read on follow-ups that carry conversation history.
    if (!skipDbFetch || !followUpQuestion) {
      const sb = adminClient();

      const { data: intake } = await sb
        .from("intakes")
        .select("season, year")
        .eq("is_default", true)
        .maybeSingle();
      if (intake) intakeLabel = `${intake.season} ${intake.year}`;

      const [instRes, cyclesRes, tuitionRes, scholarshipsRes, notesRes] = await Promise.all([
        sb.from("institutions").select("*").in("id", universityIds),
        sb
          .from("admission_cycles")
          .select("*, requirements(*), documents_required(*)")
          .in("institution_id", universityIds)
          .neq("status", "superseded"),
        sb.from("tuition").select("*").in("institution_id", universityIds).order("academic_year", { ascending: false }),
        sb.from("scholarships").select("*").in("institution_id", universityIds),
        sb.from("institution_notes").select("*").in("institution_id", universityIds).eq("is_active", true),
      ]);

      if (instRes.error) throw instRes.error;
      const institutions = instRes.data ?? [];
      const targetYear = intake?.year ?? null;

      const byInst = (rows: any[] | null, key = "institution_id") => {
        const m = new Map<string, any[]>();
        for (const r of rows ?? []) {
          const arr = m.get(r[key]) ?? [];
          arr.push(r);
          m.set(r[key], arr);
        }
        return m;
      };
      // Prefer the target intake year, but never hide data if the term/year
      // labels don't line up — fall back to all non-superseded rows.
      const preferYear = (rows: any[], field: string) => {
        if (!targetYear) return rows;
        const hit = rows.filter((r) => r[field] === targetYear);
        return hit.length ? hit : rows;
      };

      const cyclesMap = byInst(cyclesRes.data);
      const tuitionMap = byInst(tuitionRes.data);
      const scholarshipsMap = byInst(scholarshipsRes.data);
      const notesMap = byInst(notesRes.data);

      contextBlock = institutions
        .map((inst: any) =>
          institutionBlock(
            inst,
            {
              cycles: preferYear(cyclesMap.get(inst.id) ?? [], "intake_year"),
              tuition: preferYear(tuitionMap.get(inst.id) ?? [], "academic_year"),
              scholarships: scholarshipsMap.get(inst.id) ?? [],
              notes: notesMap.get(inst.id) ?? [],
            },
            intakeLabel,
          ),
        )
        .join("\n---\n");
    }

    const systemPrompt = `You are Hanguk AI, an expert advisor for students applying to Korean universities through the Hanguk education consultancy.

Help the student compare universities and decide. You have normalized admission data (requirements, tuition, scholarships) plus staff insider notes.
${studentBlock(studentContext)}${prefsBlock(studentPreferences)}
Guidelines:
- Respond in ${LANGS[language] || "Uzbek"}.
- Compare on: admission difficulty (TOPIK/IELTS/GPA), tuition & fees, scholarships (note whether TOPIK- or IELTS-based, since students have one or the other), partner-university benefits, and fit with the student's profile and preferences.
- Be concrete and cite the numbers you were given; if a field says "not published yet", say so rather than inventing it.
- Structure the comparison clearly, then end with ONE personalized recommendation grounded in the student's TOPIK/IELTS scores, budget, and goals.`;

    let userPrompt: string;
    if (followUpQuestion && skipDbFetch) {
      userPrompt = `Follow-up question about the universities we just compared: ${followUpQuestion}`;
    } else if (followUpQuestion) {
      userPrompt = `University data (intake ${intakeLabel}):\n${contextBlock}\n\nFollow-up question: ${followUpQuestion}`;
    } else {
      userPrompt = `Compare these universities for me (intake ${intakeLabel}) and help me decide:\n${contextBlock}`;
    }

    // Anthropic messages: first turn must be `user`. Carry prior history on
    // follow-ups, dropping any leading assistant turn.
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (followUpQuestion && Array.isArray(conversationHistory)) {
      for (const m of conversationHistory) {
        const role = m.role === "user" ? "user" : "assistant";
        if (!messages.length && role !== "user") continue;
        messages.push({ role, content: String(m.content ?? "") });
      }
    }
    messages.push({ role: "user", content: userPrompt });

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("COMPARE_MODEL") || "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const status = upstream.status === 429 ? 429 : upstream.status === 401 ? 402 : 502;
      const msg =
        status === 429
          ? "Rate limit exceeded. Please try again later."
          : status === 402
            ? "AI credits exhausted. Please contact support."
            : `AI gateway error: ${upstream.status}`;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transcode Anthropic SSE (content_block_delta → delta.text) into the
    // OpenAI-shaped SSE the client parser expects, ending with `data: [DONE]`.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            const text = evt?.type === "content_block_delta" ? evt?.delta?.text : "";
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`),
              );
            }
          } catch {
            // ignore non-JSON keepalive lines
          }
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (error) {
    console.error("compare-universities error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Comparison failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
