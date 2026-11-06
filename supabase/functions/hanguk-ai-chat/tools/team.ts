// Jamoa tool'lari (xodim boti 2.0, B3-3): kunlik hisobotlar, guruhning kunlik
// xulosalari va xodimlar guruhi tarixidan qidiruv. Hammasi xodimning o'z JWT'si
// bilan RPC; ruxsat RPC ichida ham tekshiriladi (owner — hammasi; xodim — faqat
// o'z hisoboti; guruh xulosasi va tarix — faqat owner, D3).
//
// deno-lint-ignore-file no-explicit-any
import { type AgentTool, rpc } from "./types.ts";

const str = (description: string) => ({ type: "string", description });
const isoDay = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
const text = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, 200) : null;
};

export const DAILY_REPORTS: AgentTool = {
  name: "daily_reports",
  description:
    "Staff daily reports from the staff Telegram bot (asked every workday at 17:00): for each date and person — done, blockers, plan (or the raw text), and who did NOT submit a report on each workday (with whether they are linked to the bot). Owners see everyone; any other staff member sees only their own reports. Use for 'X kecha/3 kunda nima qildi', 'kim hisobot topshirmadi', 'hisobotlarda qanday muammolar bor'. Max 31 days.",
  parameters: {
    type: "object",
    properties: {
      from: str("YYYY-MM-DD (Tashkent); omit with to for today"),
      to: str("YYYY-MM-DD; defaults to from (or today)"),
      staff: str("staff name or part of it; omit for everyone"),
    },
  },
  audiences: ["staff"],
  run: async (ctx, a) => ({
    data: await rpc(ctx.user, "ai_team_daily_reports", {
      p_from: isoDay(a?.from),
      p_to: isoDay(a?.to),
      p_staff: text(a?.staff),
    }),
  }),
};

export const GROUP_SUMMARY: AgentTool = {
  name: "group_summary",
  description:
    "Daily summaries of the staff Telegram group (written each evening by AI): summary, topics, decisions, open questions and message count per date. Use for 'kecha guruhda nima kelishildi', 'bu hafta guruhda qanday qarorlar bo'ldi'. Default: the last 7 days. Max 31 days.",
  parameters: {
    type: "object",
    properties: {
      from: str("YYYY-MM-DD (Tashkent)"),
      to: str("YYYY-MM-DD; defaults to from (or today)"),
    },
  },
  audiences: ["staff"],
  roles: ["owner"],
  run: async (ctx, a) => ({
    data: await rpc(ctx.user, "ai_group_summaries", { p_from: isoDay(a?.from), p_to: isoDay(a?.to) }),
  }),
};

export const TEAM_HISTORY_SEARCH: AgentTool = {
  name: "team_history_search",
  description:
    "Keyword search in the staff Telegram group history (messages and voice-message transcripts marked «🎤»; kept 90 days). Returns up to 20 messages: time, author, a 300-character snippet and a Telegram link; messages matching more words first. Use for 'guruhda X haqida nima deyilgan edi', 'kim Y haqida yozgan'. Give 1–4 distinctive words (word stems work: 'kamera', 'to'lov'), not a whole sentence.",
  parameters: {
    type: "object",
    properties: {
      query: str("1–4 keywords"),
      from: str("YYYY-MM-DD lower bound (Tashkent); optional"),
      to: str("YYYY-MM-DD upper bound; optional"),
      staff: str("author's name or part of it; optional"),
      limit: { type: "integer", description: "1–20, default 20" },
    },
    required: ["query"],
  },
  audiences: ["staff"],
  roles: ["owner"],
  run: async (ctx, a) => {
    const query = text(a?.query);
    if (!query) return { data: { error: "query is required" } };
    const limit = Number.isFinite(Number(a?.limit)) ? Math.min(Math.max(Math.trunc(Number(a.limit)), 1), 20) : 20;
    return {
      data: await rpc(ctx.user, "ai_team_history_search", {
        p_query: query,
        p_from: isoDay(a?.from),
        p_to: isoDay(a?.to),
        p_staff: text(a?.staff),
        p_limit: limit,
      }),
    };
  },
};

export const TEAM_TOOLS: AgentTool[] = [DAILY_REPORTS, GROUP_SUMMARY, TEAM_HISTORY_SEARCH];

