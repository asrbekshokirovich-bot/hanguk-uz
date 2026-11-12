// Rows in interview_messages that are not something the student said.
//
// The start cue. A text interview begins with the client sending
// "[Interview started in en]" (app) or "[Interview started - AI begins]"
// (site) as the student's message, and it is saved as the session's first
// student row.
//
// The hint cue. During a voice call the app asks interview-ai for a hint
// (action "get_hint") after 8 seconds of silence, with this sentence — or the
// student's last words — as the message. The function never knew that action:
// it saved the message as a student row and its own reply as an interviewer
// row nobody heard. By 2026-11-12: 18 cue rows in 11 interviews. Builds
// already on phones keep sending it.

export const KICKOFF_MARK = "[Interview started";
export const STUCK_CUE = "The student is stuck and said nothing.";

export function isKickoff(text: string | null | undefined): boolean {
  return (text ?? "").includes(KICKOFF_MARK);
}

export function isStuckCue(text: string | null | undefined): boolean {
  return (text ?? "").trim() === STUCK_CUE;
}

/** A student row that holds a cue, not an answer. */
export function isCue(role: string, content: string | null | undefined): boolean {
  return role === "student" && (isKickoff(content) || isStuckCue(content));
}
