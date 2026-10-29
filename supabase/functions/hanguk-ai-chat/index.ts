// deno-lint-ignore-file no-explicit-any no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAiSchema } from "./analytics.ts";
import { runAgent, sourcesFooter, type AgentEvent, type AgentResult } from "./agent.ts";
import { answeredHistory, type StoredTurn } from "./history.ts";
import { CallerError, quotaFor, resolveCaller } from "./identity.ts";
import { guestSystem, staffSystem, studentSystem } from "./prompts.ts";
import { ALL_TOOLS } from "./tools/index.ts";
import { SQL_TOOL } from "./tools/sql.ts";
import { type Caller, toolsFor } from "./tools/types.ts";

// Hanguk AI 2.0 — one agent for staff (CRM), students and guests (app).
// Plan: claude/hanguk-ai-reja.md. Who is asking comes from the JWT only
// (identity.ts); which tools exist depends on that (tools/*); every answer is
// built from tool results with its sources (prompts.ts RELIABILITY_RULES).
//
// Response: OpenAI-compatible SSE (`data: {choices:[{delta:{content}}]}`), which
// both clients already parse, plus `data: {"hanguk":{...}}` progress events that
// older clients ignore.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANGS = new Set(["uz", "en", "ru", "ko", "vi"]);

function isUzbek(message: string): boolean {
  const s = message.toLowerCase();
  const markers = ["o'", "g'", "ning", "uchun", "kerak", "haqida", "qanday", "qancha", "talaba", "rahmat", "salom", "bo'", "hujjat", "to'lov"];
  let n = 0;
  for (const w of markers) if (s.includes(w)) n++;
  return n >= 2;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function ownThread(service: any, threadId: unknown, userId: string): Promise<string | null> {
  if (typeof threadId !== "string" || !/^[0-9a-f-]{36}$/i.test(threadId)) return null;
  const { data } = await service.from("ai_threads").select("id").eq("id", threadId).eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

async function loadHistory(service: any, caller: Caller, threadId: string | null, body: any): Promise<StoredTurn[]> {
  if (!caller.userId) {
    // Guests have no stored history; the app sends its own last turns. It only
    // shapes this guest's own answer, so it is taken as given (trimmed).
    const raw = Array.isArray(body?.conversationHistory) ? body.conversationHistory : [];
    const rows = raw
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
    return answeredHistory(rows);
  }
  let q = service.from("ai_conversations").select("role, content").eq("user_id", caller.userId);
  q = threadId ? q.eq("thread_id", threadId) : q.is("thread_id", null);
  const { data: prev } = await q.order("created_at", { ascending: false }).limit(16);
  return answeredHistory((prev || []).reverse());
}

// Staff names for the prompt, read from user_roles + profiles (they used to be
// typed into the prompt by hand). Cached per warm isolate for 10 minutes.
let teamCache: { at: number; text: string } | null = null;
async function teamLine(service: any): Promise<string> {
  if (teamCache && Date.now() - teamCache.at < 600_000) return teamCache.text;
  const { data: roles } = await service.from("user_roles").select("user_id, role");
  const ids = [...new Set((roles || []).filter((r: any) => r.role !== "investor").map((r: any) => r.user_id))];
  if (!ids.length) return "";
  const { data: profs } = await service.from("profiles").select("user_id, full_name").in("user_id", ids);
  const name = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
  const byUser = new Map<string, string[]>();
  for (const r of roles || []) {
    if (r.role === "investor") continue;
    byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r.role]);
  }
  const text = [...byUser.entries()]
    .filter(([u]) => name.get(u))
    .map(([u, rs]) => `${name.get(u)} (${rs.join(", ")})`)
    .join("; ");
  teamCache = { at: Date.now(), text };
  return text;
}

async function takeQuota(service: any, caller: Caller): Promise<boolean> {
  const { key, limit } = quotaFor(caller);
  const { data, error } = await service.rpc("ai_take_quota", { p_key: key, p_limit: limit });
  if (error) {
    // Migration not applied yet: do not block answers over a missing counter.
    console.error("[hanguk-ai] quota check failed:", error.message);
    return true;
  }
  return data !== false;
}

function quotaMessage(language: string, caller: Caller): string {
  const guest = caller.audience === "guest";
  switch (language) {
    case "ru": return guest ? "Дневной лимит вопросов для гостей исчерпан. Войдите по коду клиента или напишите консультанту." : "Лимит вопросов на сейчас исчерпан. Попробуйте позже.";
    case "en": return guest ? "The daily question limit for guests is used up. Sign in with your client code or contact a consultant." : "The question limit is used up for now. Please try again later.";
    case "ko": return guest ? "게스트의 하루 질문 한도를 모두 사용했습니다. 고객 코드로 로그인하거나 상담원에게 문의하세요." : "현재 질문 한도를 모두 사용했습니다. 나중에 다시 시도해 주세요.";
    case "vi": return guest ? "Đã hết giới hạn câu hỏi trong ngày cho khách. Hãy đăng nhập bằng mã khách hàng hoặc liên hệ tư vấn viên." : "Đã hết giới hạn câu hỏi trong lúc này. Vui lòng thử lại sau.";
    default: return guest ? "Mehmonlar uchun kunlik savol limiti tugadi. Mijoz kodingiz bilan kiring yoki maslahatchiga yozing." : "Savollar limiti hozircha tugadi. Keyinroq qayta urinib ko'ring.";
  }
}

function fallbackText(language: string): string {
  if (language === "ru") return "Не удалось получить проверенный ответ из данных. Переформулируйте вопрос или проверьте раздел напрямую.";
  if (language === "en") return "I couldn't produce a verified answer from the data. Please rephrase, or check the relevant section directly.";
  return "Ma'lumotlardan tasdiqlangan javob chiqara olmadim. Savolni boshqacha yozing yoki bo'limni o'zingiz tekshiring.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return json(400, { error: "Missing required field: message" });
  if (message.length > 4000) return json(400, { error: "Message too long" });

  const requested = typeof body?.language === "string" && LANGS.has(body.language) ? body.language : "en";
  const language = isUzbek(message) ? "uz" : requested;

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let caller: Caller;
  let userClient: any;
  try {
    ({ caller, client: userClient } = await resolveCaller(req, body, {
      service,
      publicKeys: [anonKey, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || ""].filter(Boolean),
      userClient: (token) => createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    }));
  } catch (e) {
    if (e instanceof CallerError) return json(e.status, { error: e.message });
    console.error("[hanguk-ai] identity failed:", e);
    return json(500, { error: "Could not verify the session" });
  }

  const threadId = caller.userId ? await ownThread(service, body?.thread_id, caller.userId) : null;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendRaw = (s: string) => controller.enqueue(enc.encode(s));
      const sendEvent = (e: Record<string, unknown>) => sendRaw(`data: ${JSON.stringify({ hanguk: e })}\n\n`);
      const sendText = (text: string) => {
        for (let i = 0; i < text.length; i += 90) {
          sendRaw(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 90) } }] })}\n\n`);
        }
      };
      sendRaw(": hanguk-ai\n\n");

      let result: AgentResult | null = null;
      let outcome: string = "ok";
      let text = "";
      try {
        if (!(await takeQuota(service, caller))) {
          outcome = "quota";
          text = quotaMessage(language, caller);
        } else {
          const history = await loadHistory(service, caller, threadId, body);
          if (caller.userId) {
            await service.from("ai_conversations").insert({
              user_id: caller.userId, user_type: caller.audience, role: "user", content: message, thread_id: threadId,
            });
          }

          const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
          const canQuery = caller.audience === "staff" && caller.roles.some((r) => r === "owner" || r === "admin");
          const tools = toolsFor([...ALL_TOOLS, SQL_TOOL], caller);
          const system = caller.audience === "staff"
            ? staffSystem({
              language, today, staffName: caller.name || "Staff", team: await teamLine(service),
              sqlSchema: canQuery ? await getAiSchema() : null,
            })
            : caller.audience === "student"
            ? studentSystem({ language, today, name: caller.name })
            : guestSystem({ language, today });

          result = await runAgent({
            system, history, message, tools,
            ctx: { user: userClient, service, caller, language },
            onEvent: (e: AgentEvent) => sendEvent(e),
          });
          outcome = result.outcome;
          text = result.text;
          if (result.outcome === "error" || result.outcome === "empty") {
            console.error("[hanguk-ai] agent:", result.outcome, result.error ?? "");
            text = fallbackText(language);
          } else if (result.outcome === "ok") {
            text += sourcesFooter(result.sources, language);
          }
        }
      } catch (e) {
        console.error("[hanguk-ai] failed:", e);
        outcome = "error";
        text = fallbackText(language);
      }

      sendText(text);

      // Bookkeeping before the stream closes (work after the response ends may
      // be cut off by the runtime). The answer is stored only when it came from
      // the model, so a limit message never enters the history.
      try {
        if (caller.userId && (outcome === "ok" || outcome === "clarify")) {
          await service.from("ai_conversations").insert({
            user_id: caller.userId, user_type: caller.audience, role: "assistant", content: text, thread_id: threadId,
          });
        }
        await service.from("ai_runs").insert({
          user_id: caller.userId,
          audience: caller.audience,
          thread_id: threadId,
          language,
          provider: result?.provider ?? null,
          model: result?.model ?? null,
          steps: result?.steps ?? 0,
          tool_calls: result?.toolCalls ?? [],
          tokens_in: result?.tokensIn ?? 0,
          tokens_out: result?.tokensOut ?? 0,
          tokens_cached: result?.tokensCached ?? 0,
          cost_usd: result?.costUsd ?? 0,
          latency_ms: Date.now() - started,
          outcome,
          sources_count: result?.sources.length ?? 0,
          error_text: result?.error ? result.error.slice(0, 300) : null,
        });
        console.log(`[hanguk-ai] ${caller.audience} ${outcome} ${result?.provider ?? "-"} steps=${result?.steps ?? 0} tools=${(result?.toolCalls ?? []).map((t) => t.name).join(",")} ms=${Date.now() - started}`);
      } catch (e) {
        console.error("[hanguk-ai] bookkeeping failed:", e);
      }
      sendRaw("data: [DONE]\n\n");
      controller.close();
    },
  });

  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
});
