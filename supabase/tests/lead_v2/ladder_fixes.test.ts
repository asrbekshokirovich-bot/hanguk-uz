import { beforeAll, describe, expect, it } from 'vitest';
import { addLead, createHarness, getLead, type Harness } from './harness';

// Review findings on the no-answer ladder (spec §4.2, §9).
// Tashkent is UTC+5: 04:00Z = 09:00 local, 05:00Z = 10:00 local.

let h: Harness;
let op: string;

beforeAll(async () => {
  h = await createHarness();
  op = await h.addUser('call_operator');
});

const iso = (r: any) => (r ? new Date(r).toISOString() : null);
const miss = (id: string) => h.as<any>(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb) as r`, [id]);

describe('the 7-day window counts from the first miss of the current ladder', () => {
  it('a lead that came in 10 days ago gets the full 5 attempts on a new ladder', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901220001' });
    await h.q(`update leads set first_contact_at = now() - interval '10 days' where id = $1`, [l.id]);
    for (let i = 1; i <= 4; i++) {
      const r = await miss(l.id);
      expect(r[0].r.lost).toBeUndefined();
      expect((await getLead(h, l.id)).attempt_no).toBe(i);
    }
    const last = await miss(l.id);
    expect(last[0].r.lost).toBe(true);
  });

  it('a ladder still running 8 days after its first miss closes at the 3rd miss', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901220002' });
    await h.q(
      `insert into call_attempts (lead_id, operator_id, started_at, ended_at, result, attempt_no)
       values ($1, $2, now() - interval '8 days', now() - interval '8 days', 'no_answer', 1),
              ($1, $2, now() - interval '6 days', now() - interval '6 days', 'no_answer', 2)`,
      [l.id, op],
    );
    await h.q(`update leads set attempt_no = 2, ladder_state = 'running' where id = $1`, [l.id]);
    const r = await miss(l.id);
    expect(r[0].r.lost).toBe(true);
    expect((await getLead(h, l.id)).lost_reason).toBe('no_contact');
  });

  it('misses before a finished call do not count towards the new ladder', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901220003' });
    // an old ladder 20 days ago, then a talk (attempt_no back to 0)
    await h.q(
      `insert into call_attempts (lead_id, operator_id, started_at, ended_at, result, attempt_no)
       values ($1, $2, now() - interval '20 days', now() - interval '20 days', 'no_answer', 1),
              ($1, $2, now() - interval '19 days', now() - interval '19 days', 'no_answer', 2),
              ($1, $2, now() - interval '18 days', now() - interval '18 days', 'talked', 3)`,
      [l.id, op],
    );
    for (let i = 1; i <= 3; i++) {
      const r = await miss(l.id);
      expect(r[0].r.lost).toBeUndefined();
    }
  });
});

describe('a ladder call pushed to opening time gets a 10-minute window', () => {
  it('09:00 -> visible 09:00, due 09:10', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901220010' });
    await h.q(`update leads set next_attempt_at = '2026-10-07T04:00:00Z' where id = $1`, [l.id]);
    await h.q(`select fn_lead_arm_ladder($1)`, [l.id]);
    const a = await getLead(h, l.id);
    expect(iso(a.timer_start_at)).toBe('2026-10-07T04:00:00.000Z');
    expect(iso(a.due_at)).toBe('2026-10-07T04:10:00.000Z');
    // not breached at 09:00:30 (the scan used to alert everyone right at opening)
    expect(new Date(a.due_at).getTime()).toBeGreaterThan(new Date('2026-10-07T04:00:30Z').getTime());
  });

  it('any other time -> visible 10 minutes before, due on time', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901220011' });
    await h.q(`update leads set next_attempt_at = '2026-10-07T05:00:00Z' where id = $1`, [l.id]);
    await h.q(`select fn_lead_arm_ladder($1)`, [l.id]);
    const a = await getLead(h, l.id);
    expect(iso(a.timer_start_at)).toBe('2026-10-07T04:50:00.000Z');
    expect(iso(a.due_at)).toBe('2026-10-07T05:00:00.000Z');
  });
});

describe('"Nomer xato" clears the ladder and call-back timers', () => {
  const chatLead = async (phone: string, src: string) => {
    const l = await addLead(h, { source: 'telegram', source_id: src, phone, crm_generation: 'new' });
    await h.q(`update leads set answered_at = now(), answer_kind = 'call_attempt' where id = $1`, [l.id]);
    return l;
  };

  it('during the ladder', async () => {
    const l = await chatLead('+998901220020', 'tg-wn-1');
    await h.q(
      `update leads set attempt_no = 2, ladder_state = 'running', next_attempt_at = now() + interval '2 hours',
              timer_kind = 'ladder', timer_start_at = now() + interval '110 minutes', due_at = now() + interval '2 hours'
        where id = $1`,
      [l.id],
    );
    const r = await h.as<any>(op, `select lead_record_call($1, 'wrong_number', '{}'::jsonb) as r`, [l.id]);
    expect(r[0].r.chat_prompt).toBe(true);
    const a = await getLead(h, l.id);
    expect(a.phone).toBeNull();
    expect(a.timer_kind).toBeNull();
    expect(a.due_at).toBeNull();
    expect(a.next_attempt_at).toBeNull();
    expect(a.ladder_state).toBe('stopped');
    expect(a.stage).not.toBe('lost'); // stays: the chat can still reach them
  });

  it('with a call-back set', async () => {
    const l = await chatLead('+998901220021', 'tg-wn-2');
    await h.q(
      `update leads set timer_kind = 'callback', timer_start_at = now(), due_at = now() + interval '10 minutes' where id = $1`,
      [l.id],
    );
    await h.as(op, `select lead_record_call($1, 'wrong_number', '{}'::jsonb)`, [l.id]);
    const a = await getLead(h, l.id);
    expect(a.timer_kind).toBeNull();
    expect(a.due_at).toBeNull();
  });

  it('a first-contact timer is kept: the chat message answers it', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-wn-3', phone: '+998901220022', crm_generation: 'new' });
    await h.q(`update leads set timer_kind = 'first', timer_start_at = now(), due_at = now() + interval '10 minutes' where id = $1`, [l.id]);
    await h.as(op, `select lead_record_call($1, 'wrong_number', '{}'::jsonb)`, [l.id]);
    expect((await getLead(h, l.id)).timer_kind).toBe('first');
  });
});
