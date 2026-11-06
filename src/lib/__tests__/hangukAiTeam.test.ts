import { describe, expect, it, vi } from 'vitest';

// Jamoa tool'lari (xodim boti 2.0, B3-3): ruxsat va RPC parametrlari.
const { TEAM_TOOLS } = await import('../../../supabase/functions/hanguk-ai-chat/tools/team.ts');
const { toolsFor } = await import('../../../supabase/functions/hanguk-ai-chat/tools/types.ts');
const { ALL_TOOLS } = await import('../../../supabase/functions/hanguk-ai-chat/tools/index.ts');
const { staffSystem } = await import('../../../supabase/functions/hanguk-ai-chat/prompts.ts');

type T = { name: string; run: (ctx: unknown, a: unknown) => Promise<{ data: unknown }> };
const byName = (n: string) => (TEAM_TOOLS as T[]).find((t) => t.name === n)!;
const caller = (audience: string, roles: string[] = []) => ({ audience, userId: 'u', name: '', roles, guestKey: null });
const names = (c: ReturnType<typeof caller>) => toolsFor(ALL_TOOLS, c).map((t: { name: string }) => t.name);
const client = (data: unknown = { ok: true }, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) });

describe('Team tools access', () => {
  it('owner gets all three; other staff only daily_reports; students and guests none', () => {
    const owner = names(caller('staff', ['owner']));
    for (const n of ['daily_reports', 'group_summary', 'team_history_search']) expect(owner).toContain(n);

    for (const roles of [['admin'], ['call_operator'], ['document_handler', 'university_staff']]) {
      const staff = names(caller('staff', roles));
      expect(staff).toContain('daily_reports');
      expect(staff).not.toContain('group_summary');
      expect(staff).not.toContain('team_history_search');
    }
    for (const c of [caller('student'), caller('guest')]) {
      for (const n of ['daily_reports', 'group_summary', 'team_history_search']) expect(names(c)).not.toContain(n);
    }
  });
});

describe('Team tools RPCs', () => {
  it('daily_reports runs as the caller with cleaned dates and name', async () => {
    const user = client({ scope: 'own', reports: [] });
    const out = await byName('daily_reports').run(
      { user, service: {}, caller: caller('staff', ['call_operator']), language: 'uz' },
      { from: '2026-11-03', to: 'kecha', staff: '  Diyora ' },
    );
    expect(user.rpc).toHaveBeenCalledWith('ai_team_daily_reports', { p_from: '2026-11-03', p_to: null, p_staff: 'Diyora' });
    expect(out.data).toEqual({ scope: 'own', reports: [] });
  });

  it('group_summary passes the range and reports RPC errors as {error}', async () => {
    const user = client(null, { message: 'not authorized: owner only' });
    const out = await byName('group_summary').run(
      { user, service: {}, caller: caller('staff', ['owner']), language: 'uz' },
      { from: '2026-11-05' },
    );
    expect(user.rpc).toHaveBeenCalledWith('ai_group_summaries', { p_from: '2026-11-05', p_to: null });
    expect(out.data).toEqual({ error: 'not authorized: owner only' });
  });

  it('team_history_search needs a query and caps the limit at 20', async () => {
    const user = client({ results: [] });
    const ctx = { user, service: {}, caller: caller('staff', ['owner']), language: 'uz' };
    expect((await byName('team_history_search').run(ctx, { query: '  ' })).data).toEqual({ error: 'query is required' });
    expect(user.rpc).not.toHaveBeenCalled();

    await byName('team_history_search').run(ctx, { query: 'kamera', staff: 'Xushnud', limit: 99, from: '2026-11-01' });
    expect(user.rpc).toHaveBeenCalledWith('ai_team_history_search', {
      p_query: 'kamera', p_from: '2026-11-01', p_to: null, p_staff: 'Xushnud', p_limit: 20,
    });
    await byName('team_history_search').run(ctx, { query: 'to\'lov' });
    expect(user.rpc).toHaveBeenLastCalledWith('ai_team_history_search', expect.objectContaining({ p_limit: 20, p_query: "to'lov" }));
  });
});

describe('Team rules in the staff prompt', () => {
  it('tells the model to cite the date and that non-owners see only their own reports', () => {
    const s = staffSystem({ language: 'uz', today: '2026-11-06', staffName: 'A', team: '', sqlSchema: null });
    expect(s).toContain('## TEAM TOOLS');
    expect(s).toContain('hisobot 05.11.2026');
    expect(s).toContain('other staff only themselves');
  });
});

describe('Team tool step labels', async () => {
  const { stepKeys } = await import('@/lib/hangukAiAnswer');
  it('have their own chips', () => {
    expect(stepKeys(['daily_reports', 'group_summary', 'team_history_search', 'team_history_search']))
      .toEqual(['reports', 'groupSummary', 'teamHistory']);
  });
});
