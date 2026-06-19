import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveIdentity, normalizePhone } from "../_shared/identity.ts";

// Voice Agent Brain — the tool/webhook endpoint the phone voice agent calls.
//
// Phase 1 of the Uzbek AI phone agent (see docs/research/uzbek-voice-agent.md).
// The real-time loop (telephony + Uzbek STT + Uzbek TTS + turn-taking) lives on a
// managed platform (Vapi for the demo → LiveKit Agents for production). That
// platform calls THIS function as a tool/webhook to: identify the caller, answer
// study-abroad questions with our Gemini brain, and capture the caller as a lead.
//
// It reuses the existing identity spine (resolveIdentity) and the same Gemini
// model as hanguk-ai-chat — but NON-streaming and SHORT, because the reply is
// spoken aloud, not rendered as chat.
//
// Auth: shared secret header `x-voice-agent-secret` == VOICE_AGENT_SECRET (the
// platform sends it). Public edge function (verify_jwt = false in config.toml),
// same pattern as telegram-webhook / voip-webhook.
//
// deno-lint-ignore-file no-explicit-any

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const VOICE_AGENT_SECRET = Deno.env.get("VOICE_AGENT_SECRET");

// The agent's persona + hard scope. The platform speaks the greeting/disclosure
// as the first turn; the brain stays in character and keeps replies short.
const SYSTEM_PROMPT = `You are Hanguk Education's Uzbek-speaking phone assistant for students who want to study in South Korea.

VOICE RULES (you are being SPOKEN ALOUD on a phone call):
- Reply in the SAME language the caller used. Default to natural, conversational UZBEK (Latin script). If they speak Russian, reply in Russian.
- Keep it SHORT: 1–3 sentences. No lists, no markdown, no emojis, no English unless they used it.
- Sound warm and human; it's fine to use small natural fillers. Never say you are an AI again mid-call (the opening line already disclosed it). If asked directly "are you a robot/AI?", answer honestly and briefly, then continue helping.

SCOPE — only help with: Korean universities (Bachelor's/Master's), the GKS government scholarship, TOPIK/IELTS, Korean language courses, the D-2 student visa, documents, costs, and booking a consultation.
- If asked anything sensitive or outside scope (legal/immigration advice, payments, another person's data, complaints): say you'll connect them to a human specialist and stop. Do NOT invent facts, prices, deadlines, or admission decisions.
- Always try to move the call toward: understand their goal → answer briefly → offer to take their name + phone so a specialist follows up.`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // Shared-secret auth (skip only if no secret configured, e.g. local dev).
  if (VOICE_AGENT_SECRET) {
    const provided = req.headers.get("x-voice-agent-secret");
    if (provided !== VOICE_AGENT_SECRET) return json(401, { error: "Unauthorized" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  // Normalized shape: { tool, args }. If no tool, treat as a free-form answer.
  const tool: string = payload.tool || "answer";
  const args = payload.args ?? payload;

  try {
    switch (tool) {
      case "get_caller":
        return json(200, await getCaller(supabase, args));
      case "capture_lead":
        return json(200, await captureLead(supabase, args));
      case "answer":
        return json(200, await answer(supabase, args));
      default:
        return json(400, { error: `Unknown tool: ${tool}` });
    }
  } catch (e) {
    console.error("voice-agent-brain error:", e);
    // Speak a safe fallback rather than failing the call.
    return json(200, {
      text: "Kechirasiz, sizni mutaxassisimizga ulab qo'yaman, u sizga yordam beradi.",
      error: String((e as any)?.message || e),
    });
  }
});

// ── Tools ────────────────────────────────────────────────────────────────────

/** Who is calling? Resolve the phone to a known student/lead via the spine. */
async function getCaller(supabase: any, args: any) {
  const phone = String(args.caller_phone ?? args.phone ?? "");
  if (!phone) return { known: false };
  const r = await resolveIdentity(supabase, "phone", phone);
  return {
    known: !!(r.studentId || r.leadId),
    name: r.displayName,
    is_student: !!r.studentId,
    is_lead: !!r.leadId && !r.studentId,
    confidence: r.confidence,
  };
}

/** Capture / update the caller as a lead. Deduped by normalized phone. */
async function captureLead(supabase: any, args: any) {
  const phone = normalizePhone(String(args.caller_phone ?? args.phone ?? ""));
  if (!phone) return { ok: false, reason: "no phone" };

  const fields: Record<string, unknown> = {
    full_name: args.full_name ?? args.name ?? null,
    phone,
    preferred_program: args.preferred_program ?? args.interest ?? null,
    how_heard: "AI phone agent",
  };
  // Drop nulls so we never overwrite existing data with blanks on update.
  for (const k of Object.keys(fields)) if (fields[k] == null) delete fields[k];

  const { data: existing } = await supabase
    .from("leads").select("id").eq("phone", phone).maybeSingle();

  if (existing) {
    if (Object.keys(fields).length > 1) {
      await supabase.from("leads").update(fields).eq("id", existing.id);
    }
    return { ok: true, lead_id: existing.id, created: false };
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({ source: "phone_ai", source_id: phone, status: "new", ...fields })
    .select("id").single();
  if (error) {
    console.error("lead insert error:", error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true, lead_id: data.id, created: true };
}

/** Answer a caller's question with the Gemini brain — short, spoken, in-language. */
async function answer(supabase: any, args: any) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  const message = String(args.message ?? args.text ?? "").trim();
  if (!message) return { text: "Eshitaman, sizga qanday yordam bera olaman?" };

  // Personalize lightly if we recognize the caller.
  let callerNote = "";
  if (args.caller_phone) {
    const r = await resolveIdentity(supabase, "phone", String(args.caller_phone));
    if (r.displayName) {
      callerNote = `\n\nThe caller is a known ${r.studentId ? "student" : "lead"}: ${r.displayName}.`;
    }
  }

  // Optional short history from the platform: [{role:'user'|'assistant', content}]
  const history = Array.isArray(args.history) ? args.history.slice(-6) : [];

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + callerNote },
    ...history,
    { role: "user", content: message },
  ];

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages,
        max_tokens: 200, // keep spoken replies short
        temperature: 0.6,
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim()
    || "Kechirasiz, qaytadan ayta olasizmi?";
  return { text };
}
