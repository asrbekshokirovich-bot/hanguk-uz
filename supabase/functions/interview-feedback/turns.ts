// What the feedback is scored from, and how its reply is read.
//
// The app saves the interview as it hears it: every "final" piece the
// speech-to-text returns is one row in interview_messages. A student who
// talks for a minute leaves ten rows of a few words each — on 2026-11-11 one
// interview had 130 student rows for 15 answers. The function used to ask the
// model for a score, strengths, suggestions and a sample answer for EVERY row.
// The reply ran past its length limit, could not be parsed, and the fallback
// asked again without the per-answer part: of the 12 interviews scored in the
// 30 days before, 6 came back with no answer-by-answer review at all (every
// one of the long ones), and the rest reviewed fragments like "and then I".

import { isCue } from "../_shared/interview-markers.ts";

export interface TranscriptMessage {
  id: string;
  role: string;
  content: string | null;
}

export interface Turn {
  /** The id of the first row of the turn — what message_scores refer to. */
  id: string;
  role: string;
  content: string;
  /** Every row that went into this turn, in order. */
  messageIds: string[];
}

/**
 * One turn per speaker change: consecutive rows by the same speaker are one
 * thing said. Empty rows are dropped, and so are the rows that hold a cue
 * from the client instead of the student's words ("[Interview started…]",
 * the hint cue): 24 interviews were scored on nothing but the start cue, and
 * the hint cue was read as the opening of the student's answer. The order is
 * the order given.
 */
export function groupTurns(messages: TranscriptMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const m of messages) {
    const text = (m.content ?? "").trim();
    if (!text || isCue(m.role, text)) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content} ${text}`;
      last.messageIds.push(m.id);
    } else {
      turns.push({ id: m.id, role: m.role, content: text, messageIds: [m.id] });
    }
  }
  return turns;
}

/** The transcript as the model reads it: one line per turn, with its id. */
export function transcriptOf(turns: Turn[]): string {
  return turns
    .map((t) => `[${t.id}] ${t.role === "interviewer" ? "면접관" : "학생"}: ${t.content}`)
    .join("\n\n");
}

/**
 * Room for the reply. The overall part takes about the same space whatever
 * the interview; each answer adds its own review. 8000 is what a short
 * interview has always had (the model's own reasoning is counted in it).
 */
export function feedbackTokenBudget(studentTurns: number): number {
  const extra = Math.max(0, studentTurns - 8) * 600;
  return Math.min(20000, 8000 + extra);
}

/** The JSON object in a model reply, without markdown fences or stray prose. */
function jsonBody(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) throw new Error("empty content");
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const first = s.indexOf("{");
  if (first === -1) throw new Error("no JSON object found");
  return s.slice(first);
}

export interface ParsedFeedback {
  data: Record<string, unknown>;
  /** The reply was cut short and only its complete answers were kept. */
  truncated: boolean;
}

/**
 * Reads the model's reply.
 *
 * A reply that stopped part-way through `message_scores` (it is the last and
 * longest field) still holds the whole overall evaluation and every answer
 * reviewed before the cut. Those are kept instead of throwing the reply away
 * and asking again for less.
 *
 * Throws when there is nothing usable: no object, or a cut before the
 * per-answer part.
 */
export function parseFeedback(raw: string): ParsedFeedback {
  const body = jsonBody(raw);
  const last = body.lastIndexOf("}");
  if (last > 0) {
    try {
      return { data: JSON.parse(body.slice(0, last + 1)), truncated: false };
    } catch {
      // cut short, or malformed — try to keep what is whole
    }
  }

  const key = body.search(/"message_scores"\s*:\s*\[/);
  if (key === -1) throw new Error("reply cut before message_scores");
  const head = body.slice(0, key).replace(/,\s*$/, "");
  const data = JSON.parse(`${head}}`) as Record<string, unknown>;

  const start = body.indexOf("[", key) + 1;
  const scores: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let from = -1;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) from = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && from !== -1) {
        try {
          scores.push(JSON.parse(body.slice(from, i + 1)));
        } catch {
          break;
        }
        from = -1;
      }
    } else if (c === "]" && depth === 0) {
      break;
    }
  }
  data.message_scores = scores;
  return { data, truncated: true };
}

/**
 * The per-answer reviews as they are stored: only for answers the student
 * actually gave (the model sometimes invents an id), one per answer, in the
 * order of the interview, each with the words it is about — the app has no
 * other way to show which answer a review belongs to.
 */
export function normalizeMessageScores(raw: unknown, studentTurns: Turn[]): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = String((entry as Record<string, unknown>).message_id ?? "");
    if (id && !byId.has(id)) byId.set(id, entry as Record<string, unknown>);
  }
  const out: Record<string, unknown>[] = [];
  for (const turn of studentTurns) {
    // The model may answer with the id of any row of the turn.
    const entry = turn.messageIds.map((id) => byId.get(id)).find(Boolean);
    if (!entry) continue;
    out.push({ ...entry, message_id: turn.id, answer: turn.content });
  }
  return out;
}
