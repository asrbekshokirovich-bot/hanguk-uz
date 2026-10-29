import { afterEach, describe, expect, it, vi } from 'vitest';

// The edge function reads secrets through Deno.env; stub it for node.
const env: Record<string, string | undefined> = {};
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => env[k] } };

const { chatCompletion, chatProviders, LimitReachedError, setRetryWaitMs } = await import(
  '../../../supabase/functions/hanguk-ai-chat/llm.ts'
);

setRetryWaitMs(0);

const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
const status = (s: number) => new Response('err', { status: s });

afterEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  vi.unstubAllGlobals();
});

describe('Hanguk AI providers', () => {
  it('uses the free providers first and never Gemini when a free key exists', () => {
    Object.assign(env, { CEREBRAS_API_KEY: 'c', GROQ_API_KEY: 'g', GEMINI_API_KEY: 'x' });
    expect(chatProviders().map((p) => p.name)).toEqual(['cerebras', 'groq']);
  });

  it('keeps Gemini only while no free key is configured', () => {
    Object.assign(env, { GEMINI_API_KEY: 'x' });
    expect(chatProviders().map((p) => p.name)).toEqual(['gemini']);
  });

  it('waits and retries Cerebras once before moving on', async () => {
    Object.assign(env, { CEREBRAS_API_KEY: 'c', GROQ_API_KEY: 'g' });
    const fetchMock = vi.fn().mockResolvedValueOnce(status(429)).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);
    const { provider } = await chatCompletion({ messages: [] });
    expect(provider.name).toBe('cerebras');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls through to Groq when Cerebras is still at its limit', async () => {
    Object.assign(env, { CEREBRAS_API_KEY: 'c', GROQ_API_KEY: 'g' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(status(429))
      .mockResolvedValueOnce(status(429))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);
    const { provider } = await chatCompletion({ messages: [] });
    expect(provider.name).toBe('groq');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).model).toBe('openai/gpt-oss-120b');
  });

  it('reports a limit when every free provider is out of quota', async () => {
    Object.assign(env, { CEREBRAS_API_KEY: 'c', GROQ_API_KEY: 'g' });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => status(429)));
    await expect(chatCompletion({ messages: [] })).rejects.toBeInstanceOf(LimitReachedError);
  });

  it('does not retry a bad request on the next provider', async () => {
    Object.assign(env, { CEREBRAS_API_KEY: 'c', GROQ_API_KEY: 'g' });
    const fetchMock = vi.fn().mockImplementation(async () => status(400));
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatCompletion({ messages: [] })).rejects.toThrow('AI provider error 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
