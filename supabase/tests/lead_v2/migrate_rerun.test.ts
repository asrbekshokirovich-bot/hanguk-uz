import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addMessage, applyV2, createHarness, getLead, V2_FILES } from './harness';

const migrateSql = readFileSync(
  new URL('../../migrations/20261014204000_lead_v2_migrate_old_leads.sql', import.meta.url),
  'utf8',
);

const insertOld = async (h: Awaited<ReturnType<typeof createHarness>>, name: string, status: string, notes: string | null = null) => {
  const [r] = await h.q<{ id: string }>(
    `insert into public.leads (full_name, status, notes) values ($1, $2, $3) returning id`,
    [name, status, notes],
  );
  return r.id;
};

describe('the old-lead migration is safe to re-run (review finding)', () => {
  it('a re-run does not park queues that lead_lose dated after the first run', async () => {
    const h = await createHarness(0);
    const keep = await insertOld(h, 'Old active', 'new');
    await applyV2(h, 0);
    const op = await h.addUser('call_operator');

    // later, an operator closes the old card: other_center -> a dated queue (+30 d)
    await h.as(op, `select lead_lose($1, 'other_center', 'X markaz', null)`, [keep]);
    const before = await h.q<any>(`select due_at from reactivation_queues where lead_id = $1`, [keep]);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((r) => r.due_at !== null)).toBe(true);

    await h.db.exec(migrateSql);

    const after = await h.q<any>(`select due_at from reactivation_queues where lead_id = $1`, [keep]);
    expect(after.map((r) => String(r.due_at))).toEqual(before.map((r) => String(r.due_at)));
  });

  it('an old lead the engine moved to lost before this file ran still gets a reason and a waiting queue', async () => {
    const h = await createHarness(0);
    const id = await insertOld(h, 'Old, rejected in the gap', 'new', "Rad etildi: Byudjeti yetmaydi");
    // engine applied, data migration not yet (the runbook's gap)
    await applyV2(h, 0, V2_FILES.length - 1);
    // an old screen / edge function writes the status (service role, as the old reject flow)
    await h.q(`update leads set status = 'lost' where id = $1`, [id]);
    const mid = await getLead(h, id);
    expect(mid.stage).toBe('lost');
    expect(mid.stage_changed_at).not.toBeNull();
    expect(mid.lost_reason).toBeNull();

    await h.db.exec(migrateSql);

    const a = await getLead(h, id);
    expect(a.lost_reason).toBe('price');
    expect(new Date(a.stage_changed_at).getTime()).toBe(new Date(mid.stage_changed_at).getTime());
    const q = await h.q<any>(`select due_at from reactivation_queues where lead_id = $1`, [id]);
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((r) => r.due_at === null)).toBe(true);
  });
});

describe('the after-hours reply is never an answer (review finding)', () => {
  it('recognised by its metadata flag even when its text is not the current one', async () => {
    const h = await createHarness();
    const [{ a }] = await h.q<{ a: boolean }>(
      `select fn_is_automatic_outgoing('Eski matn: ertaga 09:00 da javob beramiz', '{"auto_reply":"after_hours"}'::jsonb) as a`,
    );
    expect(a).toBe(true);
    const [{ b }] = await h.q<{ b: boolean }>(`select fn_is_automatic_outgoing('Salom, qanday yordam bera olaman?', '{}'::jsonb) as b`);
    expect(b).toBe(false);
  });

  it("does not stop a phone-less lead's timer", async () => {
    const h = await createHarness();
    const [l] = await h.q<any>(
      `insert into leads (full_name, source, source_id, status) values ('IG', 'instagram', 'ig-ah-1', 'new') returning *`,
    );
    expect(l.due_at).not.toBeNull();
    await addMessage(h, {
      source: 'instagram', sender: 'ig-ah-1', direction: 'outgoing',
      content: 'Eski matn: ertaga 09:00 da javob beramiz', meta: { auto_reply: 'after_hours' },
    });
    const a = await getLead(h, l.id);
    expect(a.answered_at).toBeNull();
    expect(a.due_at).not.toBeNull();
  });
});
