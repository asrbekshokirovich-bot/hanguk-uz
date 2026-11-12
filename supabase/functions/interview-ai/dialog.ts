// What the model is asked, built from the rows of interview_messages.
import { isCue, isKickoff, isStuckCue } from "../_shared/interview-markers.ts";

export interface Row {
  role: string;
  content: string | null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * The saved rows as the model reads them, oldest first. Empty rows and hint
 * cues are left out. The start cue stays: it is the first thing the model has
 * always been given, and it keeps the conversation opening on a user turn.
 */
export function toChat(rows: Row[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const r of rows) {
    const text = r.content ?? "";
    if (!text.trim()) continue;
    if (r.role !== "interviewer" && isStuckCue(text)) continue;
    out.push({ role: r.role === "interviewer" ? "assistant" : "user", content: text });
  }
  return out;
}

/** The interviewer has not spoken yet: their greeting is due. */
export function isStart(chat: ChatMessage[]): boolean {
  return !chat.some((m) => m.role === "assistant");
}

/**
 * The request's messages. `chat` is read after the student's message was
 * saved, so it normally ends with it. The message used to be added once more
 * after it, and the model read every answer twice. It is added only when the
 * save did not happen.
 */
export function chatMessages(systemPrompt: string, chat: ChatMessage[], studentMessage: string): ChatMessage[] {
  const last = chat[chat.length - 1];
  const saved = last?.role === "user" && last.content === studentMessage;
  const out: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...chat];
  if (!saved) out.push({ role: "user", content: studentMessage });
  return out;
}

// ---- hints -----------------------------------------------------------------

export interface HintContext {
  /** The interviewer's last words. */
  question: string;
  /** What the student has said since; empty when nothing. */
  said: string;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(s.length - n) : s);

/**
 * What a hint is about: the interviewer's last words and what the student has
 * said since. `current` is what the app is hearing right now — it may not be
 * saved yet. Null when the interviewer has not asked anything.
 */
export function hintContext(rows: Row[], current: string | null | undefined): HintContext | null {
  const said: string[] = [];
  const question: string[] = [];
  let i = rows.length - 1;
  const skip = (r: Row) => !(r.content ?? "").trim() || isCue(r.role, r.content);
  for (; i >= 0 && rows[i].role !== "interviewer"; i--) {
    if (!skip(rows[i])) said.unshift(rows[i].content!.trim());
  }
  for (; i >= 0 && (rows[i].role === "interviewer" || skip(rows[i])); i--) {
    if (!skip(rows[i])) question.unshift(rows[i].content!.trim());
  }
  if (!question.length) return null;

  const now = (current ?? "").trim();
  if (now && !isStuckCue(now) && !isKickoff(now) && said[said.length - 1] !== now) said.push(now);
  return { question: clip(question.join(" "), 600), said: clip(said.join(" "), 600) };
}

export function hintMessages(ctx: HintContext, language: string | null | undefined): ChatMessage[] {
  const lang = language === "en" ? "English" : "Korean";
  return [
    {
      role: "system",
      content:
        "A student is practising a university admission interview and has gone silent. " +
        "Give exactly 3 short hints on what they could say next to answer the interviewer. " +
        `Each hint is one line of at most 12 words, in simple ${lang}. ` +
        "Do not write the whole answer for them and do not repeat the question. " +
        "Output the 3 lines only: no numbering, no bullets, no other text.",
    },
    {
      role: "user",
      content: `Interviewer: ${ctx.question}\nStudent so far: ${ctx.said || "(nothing yet)"}`,
    },
  ];
}

/** The model's reply as at most 3 clean lines. */
export function parseHints(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split("\n")
    .map((s) => s.trim().replace(/^(?:[-*•·]+|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}
