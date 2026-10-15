import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addLead, createHarness } from './harness';

const rollbackSql = readFileSync(new URL('../../rollback/lead_v2_rollback.sql', import.meta.url), 'utf8');

describe('rollback', () => {
  it('switches the new behaviour off and the old alert mechanism back on', async () => {
    const h = await createHarness();
    const trig = async (table: string) =>
      (await h.q<{ tgname: string }>(
        `select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
          where c.relname = $1 and not t.tgisinternal order by 1`, [table])).map((r) => r.tgname);

    expect(await trig('leads')).toContain('trg_leads_v2_before_insert');
    expect(await trig('leads')).not.toContain('trg_leads_mark_new_lead');

    await h.db.exec(rollbackSql);

    const leadTriggers = await trig('leads');
    expect(leadTriggers).toContain('trg_leads_mark_new_lead');
    expect(leadTriggers.some((t) => t.includes('v2'))).toBe(false);
    const msgTriggers = await trig('messages');
    expect(msgTriggers).toContain('trg_mark_lead_contacted_on_reply');
    expect(msgTriggers).not.toContain('trg_leads_v2_on_message');

    // old row level security is back: all four policies, none of the v2 ones
    const pol = (await h.q<{ policyname: string }>(
      `select policyname from pg_policies where tablename = 'leads' order by 1`)).map((r) => r.policyname);
    expect(pol).toEqual(['Staff can create leads', 'Staff can delete leads', 'Staff can update leads', 'Staff can view all leads']);

    // the hours live before v2 are back (09:00–18:00 Mon–Sat, 20261014172806): Sunday and evenings are off
    const [{ t }] = await h.q<{ t: string | null }>(`select fn_after_hours_reply_text('2026-10-04T10:00:00Z') as t`); // Sunday 15:00
    expect(t).toMatch(/dushanba kuni soat 09:00/);
    const [{ e }] = await h.q<{ e: string | null }>(`select fn_after_hours_reply_text('2026-10-06T13:30:00Z') as e`); // Tue 18:30
    expect(e).toMatch(/09:00–18:00/);

    // and a new lead no longer gets a v2 timer
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-rb1' });
    expect(l.due_at).toBeNull();

    // running it twice is harmless
    await h.db.exec(rollbackSql);
  });
});
