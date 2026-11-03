import { describe, expect, it, vi } from 'vitest';
import {
  claudeTranscribe, documentSource, parseProgress, uploadToFiles, parseTranscript, transcribePrompt,
} from '../../../supabase/functions/guideline-index/claude';

describe('parseProgress', () => {
  it('starts from page 1 for a fresh document', () => {
    expect(parseProgress('started; the run ended before it finished')).toEqual({ done: 0, total: null, failures: 0, url: null, file: null });
    expect(parseProgress('larger than 40 MB')).toEqual({ done: 0, total: null, failures: 0, url: null, file: null });
    expect(parseProgress(null)).toEqual({ done: 0, total: null, failures: 0, url: null, file: null });
  });
  it('continues where it stopped, also after a failure', () => {
    expect(parseProgress('claude: 8/60')).toEqual({ done: 8, total: 60, failures: 0, url: null, file: null });
    expect(parseProgress('claude: 8/60 url=https://x.co/s/a.pdf?token=t')).toEqual({ done: 8, total: 60, failures: 0, url: 'https://x.co/s/a.pdf?token=t', file: null });
    expect(parseProgress('claude failed (2): claude 529: overloaded [8/60]')).toEqual({ done: 8, total: 60, failures: 2, url: null, file: null });
    expect(parseProgress('claude failed (1): no TOTAL_PAGES')).toEqual({ done: 0, total: null, failures: 1, url: null, file: null });
  });
});

describe('Files API (PDFs over 30 MB)', () => {
  it('keeps the file id in the progress', () => {
    expect(parseProgress('claude: 8/60 file=file_011abc')).toEqual({ done: 8, total: 60, failures: 0, url: null, file: 'file_011abc' });
    expect(parseProgress('claude: reset for the Files API (2026-11-03)')).toEqual({ done: 0, total: null, failures: 0, url: null, file: null });
  });
  it('builds a file or url document source', () => {
    expect(documentSource('file_011abc')).toEqual({ type: 'file', file_id: 'file_011abc' });
    expect(documentSource('https://x.co/a.pdf')).toEqual({ type: 'url', url: 'https://x.co/a.pdf' });
  });
  it('uploads the PDF as multipart field "file" and returns the id', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'file_011abc', type: 'file' }), { status: 200 }));
    const id = await uploadToFiles('https://x.co/s/a.pdf?token=t', 'a.pdf', 'sk', f);
    expect(id).toBe('file_011abc');
    const [url, init] = f.mock.calls[1];
    expect(url).toBe('https://api.anthropic.com/v1/files');
    expect(init.headers['x-api-key']).toBe('sk');
    const form = init.body as FormData;
    expect((form.get('file') as File).name).toBe('a.pdf');
    expect(form.get('expires_in_seconds')).toBe(String(7 * 24 * 3600));
  });
  it('throws when the upload fails', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('x', { status: 200 }))
      .mockResolvedValueOnce(new Response('too big', { status: 413 }));
    await expect(uploadToFiles('u', 'a.pdf', 'sk', f)).rejects.toThrow('files 413');
  });
  it('sends a file document block', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'TOTAL_PAGES: 1' }] }), { status: 200 }));
    await claudeTranscribe('file_011abc', 1, 4, 'sk', 'm', f);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.messages[0].content[0]).toEqual({ type: 'document', source: { type: 'file', file_id: 'file_011abc' }, cache_control: { type: 'ephemeral' } });
  });
});

describe('parseTranscript', () => {
  it('splits the pages and reads the total', () => {
    const t = 'TOTAL_PAGES: 12\n=== PAGE 5 ===\n2027학년도 외국인 신입생 모집요강\n전형 | 기간\n=== PAGE 6 ===\n(empty)\n=== PAGE 7 ===\n기숙사 안내';
    const r = parseTranscript(t);
    expect(r.total).toBe(12);
    expect(r.pages.get(5)).toBe('2027학년도 외국인 신입생 모집요강\n전형 | 기간');
    expect(r.pages.get(6)).toBe('');
    expect(r.pages.get(7)).toBe('기숙사 안내');
    expect(r.pages.has(8)).toBe(false);
  });
  it('asks for exactly the page range', () => {
    expect(transcribePrompt(5, 8)).toContain('pages 5 to 8');
    expect(transcribePrompt(5, 8)).toContain('=== PAGE 5 ===');
  });
});

describe('claudeTranscribe', () => {
  it('sends the PDF by URL with a cached document block', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'TOTAL_PAGES: 3\n=== PAGE 1 ===\n안녕' }], usage: { input_tokens: 1 },
    }), { status: 200 }));
    const r = await claudeTranscribe('https://x.supabase.co/storage/v1/object/sign/a.pdf?token=t', 1, 4, 'sk', 'claude-x', f);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.model).toBe('claude-x');
    expect(body).not.toHaveProperty('temperature');
    expect(body.messages[0].content[0]).toEqual({
      type: 'document', source: { type: 'url', url: 'https://x.supabase.co/storage/v1/object/sign/a.pdf?token=t' },
      cache_control: { type: 'ephemeral' },
    });
    expect(r.text).toContain('안녕');
  });
  it('throws on an API error', async () => {
    const f = vi.fn().mockResolvedValue(new Response('overloaded', { status: 529 }));
    await expect(claudeTranscribe('u', 1, 4, 'sk', 'm', f)).rejects.toThrow('claude 529');
  });
});
