import { beforeAll, describe, expect, it } from 'vitest';
import { addLead, createHarness, getLead, type Harness } from './harness';

// Review finding: the "lead v2 update" policy limits rows, not columns, so a
// browser could write the engine's columns straight through PostgREST.
// fn_leads_v2_guard_columns refuses that for `authenticated`; the RPCs (run as
// the function owner) and edge functions (service_role) are not affected.

let h: Harness;
let op: string;
let op2: string;
let senior: string;
let boss: string;

beforeAll(async () => {
  h = await createHarness();
  op = await h.addUser('call_operator');
  op2 = await h.addUser('call_operator');
  senior = await h.addUser('lead_senior');
  boss = await h.addUser('owner');
});

const newLead = (fields: Record<string, unknown> = {}) =>
  addLead(h, { source: 'instagram', crm_generation: 'new', ...fields });

describe('engine columns cannot be written directly', () => {
  const cases: [string, string][] = [
    ['stop the timer', `due_at = null`],
    ['change the timer kind', `timer_kind = null`],
    ['skip the mandatory fields', `stage = 'interested'`],
    ['move the ladder', `next_attempt_at = now() + interval '3 days'`],
    ['change the attempt count', `attempt_no = 4`],
    ['pin', `pinned_at = now()`],
    ['take the lead for someone else', `owner_id = '${'00000000-0000-0000-0000-000000000001'}'`],
    ['mark it answered', `answered_at = now()`],
    ['silence the escalation', `escalation_count = 0, last_escalated_at = now()`],
    ['change the generation', `crm_generation = 'old'`],
    ['fake a merge', `merged_into_id = id`],
    ['edit the priority', `priority_score = 100`],
  ];

  for (const [what, set] of cases) {
    it(`an operator cannot ${what}`, async () => {
      const l = await newLead();
      const before = await getLead(h, l.id);
      await expect(h.as(op, `update leads set ${set} where id = $1`, [l.id])).rejects.toThrow(/not_allowed/);
      const after = await getLead(h, l.id);
      expect(after.updated_at).toEqual(before.updated_at);
      expect(after.due_at).toEqual(before.due_at);
      expect(after.stage).toBe(before.stage);
    });
  }

  it('a senior and the boss cannot either: they use the RPCs', async () => {
    const l = await newLead();
    await expect(h.as(senior, `update leads set pinned_at = now() where id = $1`, [l.id])).rejects.toThrow(/not_allowed/);
    await expect(h.as(boss, `update leads set due_at = null where id = $1`, [l.id])).rejects.toThrow(/not_allowed/);
  });

  it('status only moves directly to converted, with the student id (make-a-student flow)', async () => {
    const l = await newLead();
    await expect(h.as(op, `update leads set status = 'contacted' where id = $1`, [l.id])).rejects.toThrow(/not_allowed/);
    await expect(h.as(op, `update leads set status = 'lost' where id = $1`, [l.id])).rejects.toThrow(/not_allowed/);
    await expect(h.as(op, `update leads set status = 'converted' where id = $1`, [l.id])).rejects.toThrow(/not_allowed/);

    const sid = '00000000-0000-0000-0000-0000000000aa';
    await h.as(op, `update leads set status = 'converted', converted_to_student_id = $2 where id = $1`, [l.id, sid]);
    const a = await getLead(h, l.id);
    expect(a.stage).toBe('student');
    expect(a.due_at).toBeNull();
  });

  it('ordinary fields stay writable directly', async () => {
    const l = await newLead();
    await h.as(op, `update leads set notes = 'qo''ng''iroq qilish kerak', next_follow_up = now() + interval '1 day' where id = $1`, [l.id]);
    expect((await getLead(h, l.id)).notes).toBe("qo'ng'iroq qilish kerak");
  });
});

describe('the RPCs and the service role still write the engine columns', () => {
  it('lead_claim sets the owner, lead_pin pins (senior)', async () => {
    const l = await newLead();
    await h.as(op, `select lead_claim($1)`, [l.id]);
    expect((await getLead(h, l.id)).owner_id).toBe(op);
    await h.as(senior, `select lead_pin($1, true)`, [l.id]);
    expect((await getLead(h, l.id)).pinned_at).not.toBeNull();
  });

  it('service_role (edge functions) is not limited', async () => {
    const l = await newLead();
    await h.db.exec(`set role service_role`);
    try {
      await h.db.query(`update leads set due_at = now() + interval '1 hour' where id = $1`, [l.id]);
    } finally {
      await h.db.exec(`reset role`);
    }
    expect((await getLead(h, l.id)).due_at).not.toBeNull();
  });
});

describe('hard delete', () => {
  it('operators cannot delete a lead, even an unowned one; the boss can', async () => {
    const l = await newLead();
    await h.as(op, `delete from leads where id = $1`, [l.id]);
    await h.as(op2, `delete from leads where id = $1`, [l.id]);
    await h.as(senior, `delete from leads where id = $1`, [l.id]);
    expect(await getLead(h, l.id)).toBeDefined();
    await h.as(boss, `delete from leads where id = $1`, [l.id]);
    expect(await getLead(h, l.id)).toBeUndefined();
  });
});
