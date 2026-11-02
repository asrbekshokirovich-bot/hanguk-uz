import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => (k === 'GEMINI_API_KEY' ? 'k' : undefined) } };

const { chunkPages, cleanText } = await import('../../../supabase/functions/guideline-index/chunk.ts');
const { makeCMapReader, CMAP_BASE } = await import('../../../supabase/functions/guideline-index/pdf.ts');
const { GUIDELINE_TEXT_TOOL } = await import('../../../supabase/functions/hanguk-ai-chat/tools/guideline_text.ts');

afterEach(() => vi.unstubAllGlobals());

describe('Guideline PDF chunks', () => {
  it('keeps every chunk on one page with its page number', () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => `${i}-qator 모집요강 내용입니다`).join('\n');
    const chunks = chunkPages([page(200), '', page(5)], { size: 1500, overlap: 200 });
    expect(chunks.length).toBeGreaterThan(2);
    expect(new Set(chunks.map((c: { page: number }) => c.page))).toEqual(new Set([1, 3]));
    expect(chunks.every((c: { text: string }) => c.text.length <= 1500)).toBe(true);
    expect(chunks.map((c: { index: number }) => c.index)).toEqual(chunks.map((_: unknown, i: number) => i));
  });

  it('overlaps neighbouring chunks so a sentence cut at the edge is still found', () => {
    const text = Array.from({ length: 400 }, (_, i) => `so'z${i}`).join(' ');
    const [a, b] = chunkPages([text], { size: 500, overlap: 100 });
    const lastWord = a.text.trim().split(' ').at(-1);
    expect(b.text.split(' ')).toContain(lastWord);
    expect(b.text.startsWith(a.text.slice(0, 20))).toBe(false);
  });

  it('drops pages without text and tidies whitespace', () => {
    expect(chunkPages(['   ', 'abc'])).toEqual([]);
    expect(cleanText('a   b \n\n\n\n c')).toBe('a b\n\nc');
  });

  it('loads each CMap once from the pinned pdfjs-dist CDN path', async () => {
    const load = vi.fn().mockResolvedValue(new Uint8Array([1, 2]));
    const Reader = makeCMapReader(load);
    const r = new Reader({ baseUrl: CMAP_BASE, isCompressed: true });
    await r.fetch({ name: 'UniKS-UCS2-H' });
    const again = await new Reader({ baseUrl: CMAP_BASE, isCompressed: true }).fetch({ name: 'UniKS-UCS2-H' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(`${CMAP_BASE}UniKS-UCS2-H.bcmap`);
    expect(again).toEqual({ cMapData: new Uint8Array([1, 2]), compressionType: 1 });
  });
});

describe('guideline_text_search tool', () => {
  it('still searches by keywords when the embedding call fails, and cites pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 503 })));
    const rpc = vi.fn().mockResolvedValue({
      data: { results: [{ university: 'Ajou University', academic_year: 2027, page: 7, official_url: 'https://www.ajou.ac.kr/x.pdf' }] },
      error: null,
    });
    const out = await GUIDELINE_TEXT_TOOL.run({ user: { rpc }, service: {}, caller: {}, language: 'uz' }, { query: 'suhbat', query_ko: '면접' });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_query: 'suhbat', p_query_ko: '면접', p_embedding: null });
    expect(out.sources).toEqual([{ kind: 'pdf', label: "Yo'riqnoma PDF: Ajou University 2027", page: '7-bet', url: 'https://www.ajou.ac.kr/x.pdf' }]);
  });
});
