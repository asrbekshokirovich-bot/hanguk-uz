// Short-term chat memory for Hanguk AI.
//
// 2026-10-27: a question that hit the free limit was saved without an answer.
// The next message ("shohruh") was then sent after that orphan question, and
// the model answered the old question instead of the new one. Only complete
// question → answer pairs are replayed now, the latest few, with long answers
// trimmed so the history does not eat the free tokens-per-minute budget.

export interface StoredTurn {
  role: string;
  content: string;
}

export function answeredHistory(
  rows: StoredTurn[],
  opts: { maxPairs?: number; maxChars?: number } = {},
): StoredTurn[] {
  const maxPairs = opts.maxPairs ?? 4;
  const maxChars = opts.maxChars ?? 1200;
  const pairs: StoredTurn[][] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const q = rows[i];
    const a = rows[i + 1];
    if (q.role === "user" && a.role === "assistant" && q.content && a.content) {
      const answer = a.content.length > maxChars ? `${a.content.slice(0, maxChars)} …` : a.content;
      pairs.push([{ role: "user", content: q.content }, { role: "assistant", content: answer }]);
      i++;
    }
  }
  return pairs.slice(-maxPairs).flat();
}
