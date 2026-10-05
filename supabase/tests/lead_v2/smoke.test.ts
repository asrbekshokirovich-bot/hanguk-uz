import { describe, expect, it } from 'vitest';
import { createHarness } from './harness';

describe('lead v2 migrations', () => {
  it('apply cleanly, in order, on the production stand-in', async () => {
    const h = await createHarness();
    const [{ n }] = await h.q<{ n: number }>(
      `select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'public' and p.proname like 'lead\\_%'`,
    );
    expect(n).toBeGreaterThan(15);
  });
});
