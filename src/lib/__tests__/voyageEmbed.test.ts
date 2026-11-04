import { describe, expect, it, vi } from 'vitest';
import { voyageEmbed, VOYAGE_MODEL } from '../../../supabase/functions/_shared/voyage';

describe('voyageEmbed', () => {
  it('sends voyage-4 @1024 with input_type and keeps the order', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }],
    }), { status: 200 }));
    const v = await voyageEmbed(['a', 'b'], 'document', 'vk', f);
    expect(v).toEqual([[1, 0], [0, 1]]);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(init.headers.Authorization).toBe('Bearer vk');
    expect(JSON.parse(init.body)).toEqual({ input: ['a', 'b'], model: VOYAGE_MODEL, input_type: 'document', output_dimension: 1024 });
  });
  it('splits big batches and fails on an API error', async () => {
    const f = vi.fn().mockImplementation(async (_u: string, init: any) => {
      const n = JSON.parse(init.body).input.length;
      return new Response(JSON.stringify({ data: Array.from({ length: n }, (_, i) => ({ index: i, embedding: [i] })) }), { status: 200 });
    });
    expect((await voyageEmbed(Array(300).fill('x'), 'query', 'vk', f)).length).toBe(300);
    expect(f).toHaveBeenCalledTimes(3);
    const bad = vi.fn().mockResolvedValue(new Response('no', { status: 401 }));
    await expect(voyageEmbed(['a'], 'query', 'vk', bad)).rejects.toThrow('voyage 401');
  });
  it('needs a key', async () => {
    await expect(voyageEmbed(['a'], 'query', '')).rejects.toThrow('VOYAGE_API_KEY');
  });
});

describe('fitBudget (Voyage free tier)', async () => {
  const { fitBudget } = await import('../../../supabase/functions/_shared/voyage');
  it('takes texts until the character budget, at least one', () => {
    expect(fitBudget(['a'.repeat(1500), 'b'.repeat(1500), 'c'.repeat(1500), 'd'.repeat(1500), 'e'.repeat(1500)], 6000)).toBe(4);
    expect(fitBudget(['x'.repeat(9000)], 6000)).toBe(1);
    expect(fitBudget([], 6000)).toBe(0);
  });
});
