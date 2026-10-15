import { beforeAll, describe, expect, it } from 'vitest';
import { addLead, createHarness, getLead, type Harness } from './harness';

// Review findings on fn_lead_merge (spec §3.4, §5): state that did not travel
// with the dropped card. The older card survives; here the dropped (newer)
// card is the one with the state, and a phone edit triggers the merge.

let h: Harness;
let op: string;
let boss: string;

beforeAll(async () => {
  h = await createHarness();
  op = await h.addUser('call_operator');
  boss = await h.addUser('owner');
});

const pause = () => new Promise((r) => setTimeout(r, 15));

/** An older plain card with `phone`, and a newer card (other phone) that `prep` sets up; then the newer one gets `phone`. */
async function mergeInto(phone: string, prep: (id: string) => Promise<void>, olderFields: Record<string, unknown> = {}) {
  const older = await addLead(h, { source: 'manual', phone, full_name: 'Older', ...olderFields });
  await pause();
  const newer = await addLead(h, { source: 'manual', phone: phone.replace(/\d$/, (d) => String((Number(d) + 5) % 10)), full_name: 'Newer' });
  await prep(newer.id);
  await h.as(op, `select lead_save_fields($1, $2::jsonb)`, [newer.id, JSON.stringify({ phone })]);
  expect((await getLead(h, newer.id)).merged_into_id).toBe(older.id);
  return getLead(h, older.id);
}

describe('fn_lead_merge carries the dropped card state', () => {
  it('Kutish: a waiting card keeps its date and reason', async () => {
    const k = await mergeInto('+998901440001', async (id) => {
      await h.q(
        `update leads set stage = 'waiting', wait_until = '2026-11-20', wait_reason = 'imtihon natijasi',
                timer_kind = null, timer_start_at = null, due_at = null where id = $1`,
        [id],
      );
    });
    expect(k.stage).toBe('waiting');
    expect(String(k.wait_until instanceof Date ? k.wait_until.toISOString().slice(0, 10) : k.wait_until).slice(0, 10)).toBe('2026-11-20');
    expect(k.wait_reason).toBe('imtihon natijasi');
  });

  it('a lost survivor merged with an active card is no longer marked lost', async () => {
    const older = await addLead(h, { source: 'manual', phone: '+998901440002', full_name: 'Lost older' });
    await h.as(op, `select lead_lose($1, 'other_center', 'X markaz', null)`, [older.id]);
    expect((await getLead(h, older.id)).lost_reason).toBe('other_center');
    await pause();
    const newer = await addLead(h, { source: 'manual', phone: '+998901440007', full_name: 'Active newer' });
    await h.as(op, `select lead_save_fields($1, '{"phone":"+998901440002"}'::jsonb)`, [newer.id]);
    const k = await getLead(h, older.id);
    expect(k.stage).toBe('new');
    expect(k.lost_reason).toBeNull();
    expect(k.lost_at).toBeNull();
  });

  it("the ladder travels with the dropped card's timer", async () => {
    const k = await mergeInto('+998901440003', async (id) => {
      await h.q(
        `update leads set answered_at = now(), answer_kind = 'call_attempt', attempt_no = 2, ladder_state = 'running',
                next_attempt_at = now() + interval '2 hours', timer_kind = 'ladder',
                timer_start_at = now() + interval '110 minutes', due_at = now() + interval '2 hours'
          where id = $1`,
        [id],
      );
    }, { crm_generation: 'old' });
    // the older (old-generation) card had no timer: the ladder one wins
    expect(k.timer_kind).toBe('ladder');
    expect(k.attempt_no).toBe(2);
    expect(k.ladder_state).toBe('running');
    expect(k.next_attempt_at).not.toBeNull();
  });

  it("a student's phone arriving by merge stops the sales timer and tells the boss", async () => {
    const sid = '00000000-0000-0000-0000-0000000000bb';
    await h.q(`insert into student_phones (student_id, phone, phone_norm) values ($1, '+998901440004', '998901440004')`, [sid]);
    // the older card has no phone yet; the newer one brings the student's number
    const older = await addLead(h, { source: 'instagram', source_id: 'ig-m4', instagram_handle: 'merge_student_4', full_name: 'Older' });
    expect(older.due_at).not.toBeNull();
    await pause();
    const newer = await addLead(h, { source: 'telegram', source_id: 'tg-m4', full_name: 'Newer' });
    await h.as(op, `select lead_save_fields($1, '{"phone":"+998901440004","instagram_handle":"merge_student_4"}'::jsonb)`, [newer.id]);
    expect((await getLead(h, newer.id)).merged_into_id).toBe(older.id);
    const k = await getLead(h, older.id);
    expect(k.matched_student_id).toBe(sid);
    expect(k.due_at).toBeNull();
    const alerts = await h.q<any>(`select kind from lead_alert_outbox where lead_id = $1 and kind = 'student'`, [older.id]);
    expect(alerts.length).toBeGreaterThan(0);
  });
});
