// Shared instruction: when a request is ambiguous, ask ONE multiple-choice
// question (rendered as clickable chips in the web client) instead of guessing.
export const CLARIFY_GUIDE = `## ASK A MULTIPLE-CHOICE QUESTION WHEN AMBIGUOUS
If the request is ambiguous, or a word doesn't map to a single field (e.g.
"accepted / qabul qilingan" — there is no explicit acceptance field), do NOT
guess a definition and do NOT just refuse. Ask ONE short multiple-choice
question, then stop and wait for the answer.
Reply with ONLY this JSON envelope and nothing else — no prose before or after:
{"type":"clarify","question":"<short question>","options":["<opt 1>","<opt 2>","<opt 3>"]}
- 2–4 concrete options, written in the SAME language as the user. Keep the JSON
  keys exactly as shown.
- Ask only when the choice actually changes the answer, and at most once. If the
  user already made it clear, just answer. After they choose, give the full answer.`;
