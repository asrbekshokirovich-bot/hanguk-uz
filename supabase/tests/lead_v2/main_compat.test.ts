import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { addLead, createHarness, getLead, type Harness } from './harness';

// main's 20261012080000 (#400) made leads.qualified = "a phone, or new_lead_at".
// v2 drops the trigger that set new_lead_at, so it redefines the guard: every
// live v2 card is qualified (the old leads list, used by "Talabaga aylantirish",
// filters on it).

let h: Harness;
let op: string;

beforeAll(async () => {
  h = await createHarness();
  op = await h.addUser('call_operator');
});

describe('leads.qualified with v2 (#400 compatibility)', () => {
  it('a phone-less chat lead of the new system is qualified', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-q1' });
    expect(l.crm_generation).toBe('new');
    expect(l.new_lead_at).toBeNull();
    expect(l.qualified).toBe(true);
  });

  it('stays qualified after "Nomer xato" (it is still worked in the chat)', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-q2', phone: '+998901330002' });
    await h.as(op, `select lead_record_call($1, 'wrong_number', '{}'::jsonb)`, [l.id]);
    const a = await getLead(h, l.id);
    expect(a.phone).toBeNull();
    expect(a.qualified).toBe(true);
  });

  it('a merged-away card is not qualified', async () => {
    const older = await addLead(h, { source: 'manual', phone: '+998901330003', full_name: 'Older' });
    await new Promise((r) => setTimeout(r, 15));
    const dup = await addLead(h, { source: 'instagram', source_id: 'ig-q3', phone: '+998901330003', full_name: 'Dup' });
    const d = await getLead(h, dup.id);
    expect(d.merged_into_id).toBe(older.id);
    expect(d.qualified).toBe(false);
  });

  it('an old-generation card keeps the #400 rule (phone or new_lead_at)', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-q4', crm_generation: 'old' });
    expect(l.qualified).toBe(false);
    const withPhone = await addLead(h, { source: 'manual', phone: '+998901330005', crm_generation: 'old' });
    expect(withPhone.qualified).toBe(true);
  });

  it('the rollback puts the #400 guard back', async () => {
    const r = await createHarness();
    await r.db.exec(readFileSync(new URL('../../rollback/lead_v2_rollback.sql', import.meta.url), 'utf8'));
    const l = await addLead(r, { source: 'instagram', source_id: 'ig-q6' });
    // the restored trg_leads_mark_new_lead (stand-in) stamps new_lead_at, so #400's rule qualifies it
    expect(l.new_lead_at).not.toBeNull();
    expect(l.qualified).toBe(true);
    const [{ src }] = await r.q<{ src: string }>(`select prosrc as src from pg_proc where proname = 'fn_leads_qualified_guard'`);
    expect(src).not.toMatch(/crm_generation/);
  });
});
