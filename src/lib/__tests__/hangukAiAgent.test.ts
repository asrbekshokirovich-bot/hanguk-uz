import { afterEach, describe, expect, it, vi } from 'vitest';

// The edge function reads secrets through Deno.env; stub it for node.
const env: Record<string, string | undefined> = {};
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => env[k] } };

const { runAgent, sourcesFooter, isClarify } = await import('../../../supabase/functions/hanguk-ai-chat/agent.ts');
const { toAnthropicRequest, fromAnthropicResponse, chatProviders, LimitReachedError } = await import(
  '../../../supabase/functions/hanguk-ai-chat/llm.ts'
);
const { resolveCaller, quotaFor, CallerError } = await import('../../../supabase/functions/hanguk-ai-chat/identity.ts');
const { toolsFor } = await import('../../../supabase/functions/hanguk-ai-chat/tools/types.ts');
const { ALL_TOOLS } = await import('../../../supabase/functions/hanguk-ai-chat/tools/index.ts');
const { costUsd } = await import('../../../supabase/functions/hanguk-ai-chat/pricing.ts');

afterEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  vi.unstubAllGlobals();
});

const reply = (message: unknown, usage = { prompt_tokens: 100, completion_tokens: 10 }) => ({
  response: new Response(JSON.stringify({ choices: [{ message }], usage })),
  provider: { name: 'anthropic', model: 'claude-haiku-5-5', url: '', key: '' },
});

const ctx = {
  user: {}, service: {}, language: 'uz',
  caller: { audience: 'staff', userId: 'u1', name: 'A', roles: ['owner'], guestKey: null },
};

describe('Hanguk AI agent loop', () => {
  it('runs the requested tools, feeds results back and returns the answer with sources', async () => {
    const run = vi.fn().mockResolvedValue({
      data: { rows: 7 },
      sources: [{ kind: 'guideline', label: 'Hongik 2027 bahor bakalavr', page: '12-bet' }],
    });
    const tool = { name: 'uni_grants', description: '', parameters: {}, audiences: ['staff'], run };
    const complete = vi.fn()
      .mockResolvedValueOnce(reply({ content: null, tool_calls: [{ id: 't1', function: { name: 'uni_grants', arguments: '{"guideline_id":"g"}' } }] }))
      .mockResolvedValueOnce(reply({ content: '7 ta grant qatori bor.' }));
    const events: unknown[] = [];
    const r = await runAgent({
      system: 's', history: [], message: 'Hongik grant?', tools: [tool], ctx, complete,
      onEvent: (e: unknown) => events.push(e),
    });
    expect(run).toHaveBeenCalledWith(ctx, { guideline_id: 'g' });
    expect(r.outcome).toBe('ok');
    expect(r.text).toBe('7 ta grant qatori bor.');
    expect(r.steps).toBe(1);
    expect(events).toEqual([{ type: 'step', tools: ['uni_grants'] }]);
    const second = complete.mock.calls[1][0].messages;
    expect(second.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 't1', content: '{"rows":7}' });
    expect(r.sources).toHaveLength(1);
    expect(r.tokensIn).toBe(200);
    expect(r.costUsd).toBeGreaterThan(0);
  });

  it('answers an unknown tool with an error instead of crashing', async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce(reply({ content: null, tool_calls: [{ id: 't1', function: { name: 'nope', arguments: '{}' } }] }))
      .mockResolvedValueOnce(reply({ content: 'Topilmadi.' }));
    const r = await runAgent({ system: 's', history: [], message: 'x', tools: [], ctx, complete });
    expect(r.toolCalls[0]).toMatchObject({ name: 'nope', ok: false });
    expect(r.text).toBe('Topilmadi.');
  });

  it('forces an answer without tools after the step limit', async () => {
    const tool = { name: 'loop', description: '', parameters: {}, audiences: ['staff'], run: async () => ({ data: 1 }) };
    const call = reply({ content: null, tool_calls: [{ id: 't', function: { name: 'loop', arguments: '{}' } }] });
    const complete = vi.fn().mockImplementation(async (body: { tools?: unknown }) =>
      body.tools ? reply({ content: null, tool_calls: [{ id: 't', function: { name: 'loop', arguments: '{}' } }] }) : reply({ content: 'Yakun.' }));
    void call;
    const r = await runAgent({ system: 's', history: [], message: 'x', tools: [tool], ctx, complete, maxSteps: 3 });
    expect(r.steps).toBe(3);
    expect(r.text).toBe('Yakun.');
    expect(complete.mock.calls.at(-1)[0].tools).toBeUndefined();
  });

  it('turns a provider limit into the limit message', async () => {
    const complete = vi.fn().mockRejectedValue(new LimitReachedError('x'));
    const r = await runAgent({ system: 's', history: [], message: 'x', tools: [], ctx, complete });
    expect(r.outcome).toBe('limit');
    expect(r.text).toMatch(/limit/i);
  });

  it('marks a clarifying question', async () => {
    const complete = vi.fn().mockResolvedValue(reply({ content: '{"type":"clarify","question":"Q?","options":["a","b"]}' }));
    const r = await runAgent({ system: 's', history: [], message: 'x', tools: [], ctx, complete });
    expect(r.outcome).toBe('clarify');
    expect(isClarify('nope')).toBe(false);
  });
});

describe('Sources footer', () => {
  it('lists knowledge sources once and skips CRM rows', () => {
    const f = sourcesFooter([
      { kind: 'guideline', label: 'CAU 2027 bahor bakalavr', page: '12-bet' },
      { kind: 'guideline', label: 'CAU 2027 bahor bakalavr', page: '12-bet' },
      { kind: 'crm', label: 'Arizalar' },
      { kind: 'web', label: 'Study in Korea', url: 'https://www.studyinkorea.go.kr', date: '2026-10-31' },
    ], 'uz');
    expect(f).toContain('**Manbalar:**');
    expect(f.match(/CAU/g)).toHaveLength(1);
    expect(f).not.toContain('Arizalar');
    expect(f).toContain('[Study in Korea](https://www.studyinkorea.go.kr) (2026-10-31)');
    expect(sourcesFooter([{ kind: 'crm', label: 'x' }], 'uz')).toBe('');
  });
});

describe('Anthropic translation', () => {
  it('maps system, tools, tool calls and tool results', () => {
    const req = toAnthropicRequest({
      messages: [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'savol' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'a', function: { name: 'f', arguments: '{"x":1}' } }, { id: 'b', function: { name: 'g', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'a', content: '1' },
        { role: 'tool', tool_call_id: 'b', content: '2' },
      ],
      tools: [{ type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object', properties: {} } } }],
      tool_choice: 'auto',
    }, 'claude-sonnet-5-5');
    expect(req.system[0]).toMatchObject({ text: 'rules', cache_control: { type: 'ephemeral' } });
    expect(req.tools[0]).toMatchObject({ name: 'f', input_schema: { type: 'object' }, cache_control: { type: 'ephemeral' } });
    expect(req.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(req.messages[1].content[0]).toEqual({ type: 'tool_use', id: 'a', name: 'f', input: { x: 1 } });
    expect(req.messages[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'a', content: '1' },
      { type: 'tool_result', tool_use_id: 'b', content: '2' },
    ]);
    expect(req.max_tokens).toBeGreaterThan(0);
  });

  it('maps the response back, with cached tokens', () => {
    const out = fromAnthropicResponse({
      content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', id: 'x', name: 'f', input: { a: 1 } }],
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 },
    });
    expect(out.choices[0].message.content).toBe('ok');
    expect(out.choices[0].message.tool_calls[0].function).toEqual({ name: 'f', arguments: '{"a":1}' });
    expect(out.usage).toMatchObject({ prompt_tokens: 100, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 90 } });
  });

  it('orders providers by AI_PROVIDERS and skips missing keys', () => {
    Object.assign(env, { AI_PROVIDERS: 'anthropic,gemini,groq', ANTHROPIC_API_KEY: 'a', GROQ_API_KEY: 'g' });
    expect(chatProviders().map((p: { name: string }) => p.name)).toEqual(['anthropic', 'groq']);
  });
});

describe('Pricing', () => {
  it('charges cached input at the cache price and free tiers nothing', () => {
    const u = { prompt_tokens: 1_000_000, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 1_000_000 } };
    expect(costUsd('anthropic', 'claude-sonnet-5-5', u)).toBeCloseTo(0.10, 6);
    expect(costUsd('anthropic', 'claude-sonnet-5-5', { prompt_tokens: 0, completion_tokens: 1_000_000 })).toBeCloseTo(10, 6);
    expect(costUsd('groq', 'openai/gpt-oss-120b', { prompt_tokens: 1_000_000, completion_tokens: 0 })).toBe(0);
  });
});

describe('Who is asking (JWT only)', () => {
  const req = (auth?: string) => new Request('https://x', { method: 'POST', headers: auth ? { Authorization: auth } : {} });
  const service = (roles: string[], name = 'Ali') => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => table === 'user_roles'
          ? Promise.resolve({ data: roles.map((role) => ({ role })) })
          : { maybeSingle: () => Promise.resolve({ data: { full_name: name } }) },
      }),
    }),
  });
  const deps = (user: unknown, roles: string[]) => ({
    service: service(roles),
    publicKeys: ['pub-key'],
    userClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: 'bad' } }) } }),
  });

  it('treats no token and the publishable key as a guest, ignoring body user_id', async () => {
    for (const h of [undefined, 'Bearer ', 'Bearer pub-key']) {
      const { caller } = await resolveCaller(req(h), { user_id: 'victim', user_type: 'staff' }, deps(null, []));
      expect(caller).toMatchObject({ audience: 'guest', userId: null });
      expect(caller.guestKey).toMatch(/^ip:/);
    }
  });

  it('uses the app install id as the guest key when it is a uuid', async () => {
    const id = '0b9e6c8a-1111-4222-8333-944455556666';
    const { caller } = await resolveCaller(req(), { install_id: id }, deps(null, []));
    expect(caller.guestKey).toBe(`i:${id}`);
  });

  it('rejects an expired token instead of silently downgrading', async () => {
    await expect(resolveCaller(req('Bearer jwt'), {}, deps(null, []))).rejects.toBeInstanceOf(CallerError);
  });

  it('staff from roles, student without roles, investor refused', async () => {
    const u = { id: 'me' };
    expect((await resolveCaller(req('Bearer jwt'), { user_id: 'other' }, deps(u, ['admin']))).caller)
      .toMatchObject({ audience: 'staff', userId: 'me', roles: ['admin'] });
    expect((await resolveCaller(req('Bearer jwt'), { user_type: 'staff' }, deps(u, []))).caller)
      .toMatchObject({ audience: 'student', userId: 'me' });
    await expect(resolveCaller(req('Bearer jwt'), {}, deps(u, ['investor']))).rejects.toMatchObject({ status: 403 });
  });

  it('limits per audience', () => {
    const now = new Date('2026-10-31T06:30:00Z'); // 11:30 Tashkent
    expect(quotaFor({ audience: 'staff', userId: 's', name: '', roles: [], guestKey: null }, now))
      .toEqual({ key: 'staff:s:2026-10-31T11', limit: 60 });
    expect(quotaFor({ audience: 'student', userId: 'p', name: '', roles: [], guestKey: null }, now).limit).toBe(30);
    expect(quotaFor({ audience: 'guest', userId: null, name: '', roles: [], guestKey: 'i:x' }, now))
      .toEqual({ key: 'guest:i:x:2026-10-31', limit: 10 });
  });
});

describe('Tool access', () => {
  it('never offers staff tools to students or guests', () => {
    const student = toolsFor(ALL_TOOLS, { audience: 'student', userId: 'u', name: '', roles: [], guestKey: null });
    const guest = toolsFor(ALL_TOOLS, { audience: 'guest', userId: null, name: '', roles: [], guestKey: 'g' });
    const staff = toolsFor(ALL_TOOLS, { audience: 'staff', userId: 'u', name: '', roles: ['call_operator'], guestKey: null });
    const names = (l: { name: string }[]) => l.map((t) => t.name);
    expect(names(student)).toContain('my_card');
    for (const n of ['get_student_card', 'search_students', 'finance_summary', 'get_lead_card', 'search_communications']) {
      expect(names(student)).not.toContain(n);
      expect(names(guest)).not.toContain(n);
      expect(names(staff)).toContain(n);
    }
    expect(names(staff)).not.toContain('my_card');
  });
});
