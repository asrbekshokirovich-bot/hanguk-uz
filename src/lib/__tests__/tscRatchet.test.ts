import { describe, it, expect } from 'vitest';
import { compare, countByFile, parseErrors } from '../../../scripts/tsc-ratchet.mjs';

const out = [
  "src/a.tsx(10,5): error TS2339: Property 'x' does not exist on type 'Y'.",
  "src/a.tsx(12,1): error TS2345: Argument of type 'string' is not assignable.",
  'src\\b.ts(1,1): error TS2304: Cannot find name \'Deno\'.',
  'Found 3 errors in 2 files.',
  '',
].join('\n');

describe('tsc ratchet', () => {
  it('counts errors per file, whatever the path separator', () => {
    expect(countByFile(parseErrors(out))).toEqual({ 'src/a.tsx': 2, 'src/b.ts': 1 });
  });

  it('a file with more errors, or a new file with errors, is worse', () => {
    const { worse, better } = compare({ 'src/a.tsx': 2 }, { 'src/a.tsx': 3, 'src/new.ts': 1 });
    expect(worse).toEqual([{ file: 'src/a.tsx', was: 2, now: 3 }, { file: 'src/new.ts', was: 0, now: 1 }]);
    expect(better).toEqual([]);
  });

  it('fewer errors, or a file that is now clean, is better and not a failure', () => {
    const { worse, better } = compare({ 'src/a.tsx': 2, 'src/b.ts': 1 }, { 'src/a.tsx': 1 });
    expect(worse).toEqual([]);
    expect(better).toEqual([{ file: 'src/a.tsx', was: 2, now: 1 }, { file: 'src/b.ts', was: 1, now: 0 }]);
  });

  it('the same counts are neither', () => {
    expect(compare({ 'src/a.tsx': 2 }, { 'src/a.tsx': 2 })).toEqual({ worse: [], better: [] });
  });
});
