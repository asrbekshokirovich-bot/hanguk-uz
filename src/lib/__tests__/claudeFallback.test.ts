import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  anthropicToGemini, anthropicToOpenai, geminiFetch, geminiKind, geminiToAnthropic, openaiToAnthropic, stripFences,
} from '../../../supabase/functions/_shared/claude-fallback';

const NATIVE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=k';
const OPENAI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const claudeReply = (text: string, extra: Record<string, unknown> = {}) => ({
  id: 'msg_1', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 }, ...extra,
});

describe('geminiKind', () => {
  it('knows the two generation endpoints and ignores the rest', () => {
    expect(geminiKind(NATIVE)).toBe('native');
    expect(geminiKind(OPENAI)).toBe('openai');
    expect(geminiKind('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=k')).toBeNull();
    expect(geminiKind('https://api.groq.com/openai/v1/chat/completions')).toBeNull();
  });
});

describe('native Gemini → Claude', () => {
  it('maps system, media, JSON schema and limits', () => {
    const { req, json } = geminiToAnthropic({
      systemInstruction: { parts: [{ text: 'You extract.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Read it' }, { inlineData: { mimeType: 'application/pdf', data: 'QUJD' } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 64000, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } },
    }, 'claude-x');
    expect(json).toBe(true);
    expect(req.model).toBe('claude-x');
    expect(req.max_tokens).toBe(32000);
    expect(req).not.toHaveProperty('temperature');
    expect(req.system).toContain('You extract.');
    expect(req.system).toContain('"type":"OBJECT"');
    expect(req.messages).toEqual([{ role: 'user', content: [
      { type: 'text', text: 'Read it' },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } },
    ] }]);
  });

  it('refuses audio (Claude cannot hear) and Gemini tools', () => {
    expect(() => geminiToAnthropic({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/ogg', data: 'x' } }] }] }, 'm')).toThrow();
    expect(() => geminiToAnthropic({ tools: [{ googleSearch: {} }], contents: [{ role: 'user', parts: [{ text: 'q' }] }] }, 'm')).toThrow();
  });

  it('answers in Gemini shape, without JSON fences', () => {
    const g = anthropicToGemini(claudeReply('```json\n{"a":1}\n```'), true);
    expect(g.candidates[0].content.parts[0].text).toBe('{"a":1}');
    expect(g.usageMetadata.totalTokenCount).toBe(15);
  });
});

describe('OpenAI-compatible → Claude', () => {
  it('maps image_url data URLs and a forced function', () => {
    const { req } = openaiToAnthropic({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Check documents.' },
        { role: 'user', content: [{ type: 'text', text: 'Is it a passport?' }, { type: 'image_url', image_url: { url: 'data:image/jpg;base64,AAAA' } }] },
      ],
      tools: [{ type: 'function', function: { name: 'validate_document', parameters: { type: 'object', properties: {} } } }],
      tool_choice: { type: 'function', function: { name: 'validate_document' } },
      temperature: 0.2, top_p: 0.9, top_k: 40,
    }, 'claude-x');
    expect(req).not.toHaveProperty('temperature');
    expect(req).not.toHaveProperty('top_p');
    expect(req).not.toHaveProperty('top_k');
    expect(req.system).toBe('Check documents.');
    expect(req.messages[0].content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'validate_document' });
  });

  it('returns tool calls the way OpenAI does', () => {
    const o = anthropicToOpenai({ content: [{ type: 'tool_use', id: 't1', name: 'validate_document', input: { ok: true } }], usage: {} }, false);
    expect(o.choices[0].finish_reason).toBe('tool_calls');
    expect(JSON.parse(o.choices[0].message.tool_calls[0].function.arguments)).toEqual({ ok: true });
  });
});

describe('geminiFetch', () => {
  beforeEach(() => {
    (globalThis as any).Deno = { env: { get: (k: string) => (k === 'ANTHROPIC_API_KEY' ? 'sk-test' : undefined) } };
  });
  afterEach(() => { delete (globalThis as any).Deno; });

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'salom' }] }],
    generationConfig: { temperature: 0.3, topP: 0.9, topK: 40 },
  });

  it('passes a good Gemini answer through untouched', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"candidates":[]}', { status: 200 }));
    const r = await geminiFetch(NATIVE, { method: 'POST', body }, f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.headers.get('x-ai-fallback')).toBeNull();
  });

  it('asks Claude when Gemini is out of quota', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":{"code":429}}', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(claudeReply('Salom!')), { status: 200 }));
    const r = await geminiFetch(NATIVE, { method: 'POST', body }, f);
    expect(f.mock.calls[1][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(f.mock.calls[1][1].headers['x-api-key']).toBe('sk-test');
    // claude-sonnet-5-5 rejects temperature (HTTP 400) — the body must not carry it
    const sent = JSON.parse(f.mock.calls[1][1].body);
    expect(sent.model).toBe('claude-sonnet-5-5');
    expect(sent).not.toHaveProperty('temperature');
    expect(sent).not.toHaveProperty('top_p');
    expect(sent).not.toHaveProperty('top_k');
    expect(r.status).toBe(200);
    expect(r.headers.get('x-ai-fallback')).toBe('anthropic');
    expect((await r.json()).candidates[0].content.parts[0].text).toBe('Salom!');
  });

  it('keeps the Gemini error when Claude also fails or the request cannot move', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(new Response('bad', { status: 500 }));
    expect((await geminiFetch(NATIVE, { method: 'POST', body }, f)).status).toBe(429);

    const g = vi.fn().mockResolvedValue(new Response('quota', { status: 429 }));
    const audio = JSON.stringify({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/ogg', data: 'x' } }] }] });
    expect((await geminiFetch(NATIVE, { method: 'POST', body: audio }, g)).status).toBe(429);
    expect(g).toHaveBeenCalledTimes(1);
  });

  it('does nothing without an Anthropic key', async () => {
    (globalThis as any).Deno = { env: { get: () => undefined } };
    const f = vi.fn().mockResolvedValue(new Response('quota', { status: 429 }));
    expect((await geminiFetch(OPENAI, { method: 'POST', body: '{"messages":[{"role":"user","content":"x"}]}' }, f)).status).toBe(429);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

it('stripFences leaves plain JSON alone', () => {
  expect(stripFences('{"a":1}')).toBe('{"a":1}');
});
