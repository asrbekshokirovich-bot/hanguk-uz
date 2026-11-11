import { describe, it, expect, vi } from 'vitest';
import { fetchAllRows } from '../fetchAllRows';

const table = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));
/** A PostgREST stand-in: answers the asked range, never more than `cap` rows. */
const api = (rows: { id: number }[], cap = 1000) =>
  vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }));

describe('fetchAllRows', () => {
  it('reads past the 1000-row cap of one request (the 1065 leads of 2026-11-11)', async () => {
    const page = api(table(1065));
    const { data, error } = await fetchAllRows(page);
    expect(error).toBeNull();
    expect(data).toHaveLength(1065);
    expect(data.map((r) => r.id)).toEqual(table(1065).map((r) => r.id));
    expect(page.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it('makes one request for a short list', async () => {
    const page = api(table(12));
    const { data } = await fetchAllRows(page);
    expect(data).toHaveLength(12);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('a list of exactly one page costs one empty request more and loses nothing', async () => {
    const page = api(table(1000));
    const { data, error } = await fetchAllRows(page);
    expect(error).toBeNull();
    expect(data).toHaveLength(1000);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('an empty table is an empty list', async () => {
    const { data, error } = await fetchAllRows(api([]));
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  it('stops at the first error and reports it', async () => {
    const boom = { message: 'boom' };
    const page = vi.fn()
      .mockResolvedValueOnce({ data: table(1000), error: null })
      .mockResolvedValueOnce({ data: null, error: boom });
    const { data, error } = await fetchAllRows(page);
    expect(error).toBe(boom);
    expect(data).toHaveLength(1000);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('honours a custom page size', async () => {
    const page = api(table(25), 10);
    const { data } = await fetchAllRows(page, { pageSize: 10 });
    expect(data).toHaveLength(25);
    expect(page.mock.calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it('gives up, loudly, on a list that never ends', async () => {
    const page = vi.fn(async () => ({ data: table(10), error: null }));
    const { data, error } = await fetchAllRows(page, { pageSize: 10, maxPages: 3 });
    expect(page).toHaveBeenCalledTimes(3);
    expect(data).toHaveLength(30);
    expect(String((error as Error).message)).toMatch(/more than 30 rows/);
  });
});
