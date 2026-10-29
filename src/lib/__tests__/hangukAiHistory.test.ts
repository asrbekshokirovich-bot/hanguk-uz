import { describe, expect, it } from 'vitest';
import { answeredHistory } from '../../../supabase/functions/hanguk-ai-chat/history.ts';

describe('Hanguk AI chat memory', () => {
  it('drops a question that never got an answer', () => {
    const rows = [
      { role: 'user', content: 'Muratov haqida' },
      { role: 'assistant', content: 'MURATOV ...' },
      { role: 'user', content: 'nechta talabaning hujjati tayyor?' }, // hit the limit, no answer
    ];
    expect(answeredHistory(rows)).toEqual(rows.slice(0, 2));
  });

  it('keeps only the latest pairs and trims long answers', () => {
    const rows = Array.from({ length: 6 }, (_, i) => [
      { role: 'user', content: `q${i}` },
      { role: 'assistant', content: 'x'.repeat(2000) },
    ]).flat();
    const h = answeredHistory(rows, { maxPairs: 2, maxChars: 100 });
    expect(h.map((r) => r.content.slice(0, 2))).toEqual(['q4', 'xx', 'q5', 'xx']);
    expect(h[1].content.length).toBeLessThan(110);
  });

  it('ignores two questions in a row', () => {
    const rows = [
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'B' },
    ];
    expect(answeredHistory(rows)).toEqual([{ role: 'user', content: 'b' }, { role: 'assistant', content: 'B' }]);
  });
});
