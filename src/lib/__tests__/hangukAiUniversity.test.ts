import { describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => undefined } };

const { UNIVERSITY_TOOLS, sourcesOf } = await import('../../../supabase/functions/hanguk-ai-chat/tools/university.ts');
const { toolsFor } = await import('../../../supabase/functions/hanguk-ai-chat/tools/types.ts');
const { ALL_TOOLS } = await import('../../../supabase/functions/hanguk-ai-chat/tools/index.ts');
const { staffSystem, studentSystem, guestSystem } = await import('../../../supabase/functions/hanguk-ai-chat/prompts.ts');

const byName = (n: string) => UNIVERSITY_TOOLS.find((t: { name: string }) => t.name === n)!;

describe('University tools', () => {
  it('are offered to staff, students and guests', () => {
    for (const audience of ['staff', 'student', 'guest']) {
      const names = toolsFor(ALL_TOOLS, { audience, userId: null, name: '', roles: [], guestKey: 'g' }).map((t: { name: string }) => t.name);
      for (const n of ['uni_search', 'uni_card', 'uni_grants', 'uni_deadlines', 'uni_eligibility']) expect(names).toContain(n);
    }
  });

  it('calls the RPC as the caller with mapped parameters and returns the guideline as a source', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { grants: [], source: { kind: 'guideline', label: 'Hongik University 2027 bahor bakalavr', date: '2026-10-05' } },
      error: null,
    });
    const out = await byName('uni_grants').run({ user: { rpc }, service: {}, caller: {}, language: 'uz' }, { guideline_id: 'g1' });
    expect(rpc).toHaveBeenCalledWith('ai_uni_grants', { p_guideline_id: 'g1' });
    expect(out.sources).toEqual([{ kind: 'guideline', label: "Yo'riqnoma: Hongik University 2027 bahor bakalavr", date: '2026-10-05' }]);
  });

  it('caps a comparison at four guidelines and reports RPC errors as data', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const out = await byName('uni_compare').run({ user: { rpc }, service: {}, caller: {}, language: 'uz' }, { guideline_ids: ['a', 'b', 'c', 'd', 'e'] });
    expect(rpc.mock.calls[0][1].p_guideline_ids).toEqual(['a', 'b', 'c', 'd']);
    expect(out.data).toEqual({ error: 'boom' });
  });

  it('collects per-university sources of a comparison', () => {
    expect(sourcesOf({ universities: [{ source: { label: 'A' } }, { source: { label: 'B' } }] }).map((s: { label: string }) => s.label))
      .toEqual(["Yo'riqnoma: A", "Yo'riqnoma: B"]);
    expect(sourcesOf({ error: 'x' })).toEqual([]);
  });

  it('teaches every audience the reliability and university rules', () => {
    for (const p of [
      staffSystem({ language: 'uz', today: '2026-10-31', staffName: 'A', team: '', sqlSchema: null }),
      studentSystem({ language: 'uz', today: '2026-10-31', name: 'B' }),
      guestSystem({ language: 'vi', today: '2026-10-31' }),
    ]) {
      expect(p).toContain('RELIABILITY RULES');
      expect(p).toContain('UNIVERSITY QUESTIONS');
    }
    expect(guestSystem({ language: 'vi', today: 'x' })).toContain('tiếng Việt');
  });
});
