/**
 * Read a whole PostgREST result, however long it is.
 *
 * The API answers at most `max-rows` rows per request — 1000 on this project —
 * and says nothing when it cut the list short. On 2026-11-11 the Leads page was
 * showing 1000 of the season's 1065 leads for exactly that reason, and 65
 * people were simply not in the CRM. A list that can outgrow a thousand rows
 * has to be read in pages.
 *
 *   const { data, error } = await fetchAllRows((from, to) =>
 *     supabase.from('leads').select('*').eq('qualified', true)
 *       .order('created_at').order('id').range(from, to));
 *
 * The query MUST have a total order (end it on a unique column): pages of an
 * unordered query can overlap or skip rows.
 */
export interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

export const API_PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: {
    pageSize?: number;
    maxPages?: number;
    /** Called with each page as it arrives — to show the first one without waiting for the rest. */
    onPage?: (batch: T[], index: number) => void;
  } = {},
): Promise<{ data: T[]; error: unknown }> {
  const pageSize = options.pageSize ?? API_PAGE_SIZE;
  const maxPages = options.maxPages ?? 100;
  const rows: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    options.onPage?.(batch, i);
    // A short page is the last one. (A full page may be too — then the next
    // request comes back empty, which costs one round trip and loses nothing.)
    if (batch.length < pageSize) return { data: rows, error: null };
  }
  return { data: rows, error: new Error(`fetchAllRows: more than ${maxPages * pageSize} rows`) };
}
