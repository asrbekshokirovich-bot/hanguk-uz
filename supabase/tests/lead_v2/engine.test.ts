import { beforeAll, describe, expect, it } from 'vitest';
import { addLead, addMessage, createHarness, getLead, type Harness } from './harness';

// Tashkent is UTC+5: 10:00Z = 15:00 local, 04:00Z = 09:00 local.
const Z = (s: string) => new Date(s).toISOString();
const t = async (h: Harness, sql: string) => {
  const [row] = await h.q<Record<string, any>>(sql);
  return Object.values(row)[0] as any;
};

let h: Harness;
let op: string; // call_operator
let op2: string; // another call_operator
let senior: string; // lead_senior
let boss: string; // owner
let docs: string; // document_handler

beforeAll(async () => {
  h = await createHarness();
  op = await h.addUser('call_operator');
  op2 = await h.addUser('call_operator');
  senior = await h.addUser('lead_senior');
  boss = await h.addUser('owner');
  docs = await h.addUser('document_handler');
});

const iso = (r: any) => (r instanceof Date ? r.toISOString() : r ? new Date(r).toISOString() : null);

const FULL_CARD = {
  education_level: 'Bakalavr',
  cert_level: 'TOPIK 3',
  age: 19,
  city: 'Toshkent',
  decider: 'parent',
  objection: 'price',
  competitor: "yo'q",
};

describe('working-hours helpers (spec §1.3, §4, §9)', () => {
  it('knows working hours: 09:00–22:00 every day, Sunday included', async () => {
    expect(await t(h, `select fn_lead_in_hours('2026-10-06T10:00:00Z')`)).toBe(true); // Tue 15:00
    expect(await t(h, `select fn_lead_in_hours('2026-10-04T10:00:00Z')`)).toBe(true); // Sunday 15:00
    expect(await t(h, `select fn_lead_in_hours('2026-10-06T17:00:00Z')`)).toBe(false); // 22:00 sharp: closed
    expect(await t(h, `select fn_lead_in_hours('2026-10-06T03:59:00Z')`)).toBe(false); // 08:59
  });

  it('shifts out-of-hours times to the next opening', async () => {
    expect(iso(await t(h, `select fn_lead_shift_into_hours('2026-10-06T17:00:00Z')`))).toBe(Z('2026-10-07T04:00:00Z'));
    expect(iso(await t(h, `select fn_lead_shift_into_hours('2026-10-06T22:00:00Z')`))).toBe(Z('2026-10-07T04:00:00Z')); // 03:00 -> 09:00 same day
    expect(iso(await t(h, `select fn_lead_shift_into_hours('2026-10-06T10:00:00Z')`))).toBe(Z('2026-10-06T10:00:00Z'));
  });

  it('computes the 10-minute deadline, carrying overflow past closing into the morning', async () => {
    expect(iso(await t(h, `select fn_lead_due_at('2026-10-06T10:00:00Z')`))).toBe(Z('2026-10-06T10:10:00Z'));
    expect(iso(await t(h, `select fn_lead_due_at('2026-10-06T16:55:00Z')`))).toBe(Z('2026-10-07T04:05:00Z')); // 21:55 -> 09:05
    expect(iso(await t(h, `select fn_lead_due_at('2026-10-06T17:30:00Z')`))).toBe(Z('2026-10-07T04:10:00Z')); // 22:30 -> 09:10
    expect(iso(await t(h, `select fn_lead_due_at('2026-10-06T22:00:00Z')`))).toBe(Z('2026-10-07T04:10:00Z')); // 03:00 -> 09:10
  });

  it('walks the ladder: +15 min, +2 h, tomorrow 10:00, +2 days 10:00, then over', async () => {
    expect(iso(await t(h, `select fn_lead_ladder_next(1, '2026-10-06T07:00:00Z')`))).toBe(Z('2026-10-06T07:15:00Z'));
    expect(iso(await t(h, `select fn_lead_ladder_next(2, '2026-10-06T07:00:00Z')`))).toBe(Z('2026-10-06T09:00:00Z'));
    expect(iso(await t(h, `select fn_lead_ladder_next(3, '2026-10-06T07:00:00Z')`))).toBe(Z('2026-10-07T05:00:00Z'));
    expect(iso(await t(h, `select fn_lead_ladder_next(4, '2026-10-07T05:00:00Z')`))).toBe(Z('2026-10-09T05:00:00Z'));
    expect(await t(h, `select fn_lead_ladder_next(5, '2026-10-07T05:00:00Z')`)).toBeNull();
  });

  it('shifts a ladder step that lands after closing: 21:50 + 15 min -> tomorrow 09:00', async () => {
    expect(iso(await t(h, `select fn_lead_ladder_next(1, '2026-10-06T16:50:00Z')`))).toBe(Z('2026-10-07T04:00:00Z'));
  });
});

describe('every conversation is a lead with a timer (spec §1.2, §4)', () => {
  it('starts a first-contact timer on a new lead', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-t1', first_contact_at: '2026-10-06T10:00:00Z' });
    expect(l.stage).toBe('new');
    expect(l.crm_generation).toBe('new');
    expect(l.timer_kind).toBe('first');
    expect(iso(l.timer_start_at)).toBe(Z('2026-10-06T10:00:00Z'));
    expect(iso(l.due_at)).toBe(Z('2026-10-06T10:10:00Z'));
    expect(iso(l.first_due_at)).toBe(iso(l.due_at));
    const ev = await h.q(`select kind from lead_events where lead_id = $1`, [l.id]);
    expect(ev.map((e: any) => e.kind)).toContain('created');
  });

  it('does not need a phone: a phone-less chat is a lead too', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-t2', phone: null, first_contact_at: '2026-10-06T10:00:00Z' });
    expect(l.due_at).not.toBeNull();
  });

  it('holds an off-hours lead back until 09:00 and gives it 09:10', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-t3', first_contact_at: '2026-10-06T17:30:00Z' });
    expect(iso(l.timer_start_at)).toBe(Z('2026-10-07T04:00:00Z'));
    expect(iso(l.due_at)).toBe(Z('2026-10-07T04:10:00Z'));
  });

  it('gives no timer to partner-centre students or to old-generation rows', async () => {
    const a = await addLead(h, { source: 'learning_center' });
    const b = await addLead(h, { crm_generation: 'old' });
    expect(a.due_at).toBeNull();
    expect(b.due_at).toBeNull();
  });

  it('maps a legacy status to a stage on insert', async () => {
    const a = await addLead(h, { status: 'converted' });
    const b = await addLead(h, { status: 'lost' });
    expect(a.stage).toBe('student');
    expect(a.due_at).toBeNull();
    expect(b.stage).toBe('lost');
  });

  it('keeps stage and legacy status in step when old code writes status', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-t4' });
    await h.q(`update leads set status = 'converted' where id = $1`, [l.id]);
    const after = await getLead(h, l.id);
    expect(after.stage).toBe('student');
    expect(after.due_at).toBeNull();
    await h.q(`update leads set stage = 'lost' where id = $1`, [l.id]);
    expect((await getLead(h, l.id)).status).toBe('lost');
  });
});

describe('escalation (spec §4): everyone, repeating, working hours only', () => {
  it('alerts once the deadline has passed, again every 10 minutes, and stops when answered', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-e1', full_name: 'Dilnoza', first_contact_at: '2026-10-06T10:00:00Z' });
    expect(await t(h, `select fn_lead_timer_scan('2026-10-06T10:09:00Z')`)).toBe(0);
    expect(await t(h, `select fn_lead_timer_scan('2026-10-06T10:11:00Z')`)).toBeGreaterThanOrEqual(1);
    const alerts = await h.q<Record<string, any>>(`select * from lead_alert_outbox where lead_id = $1`, [l.id]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('escalation');
    expect(alerts[0].audience).toBe('everyone');
    expect(alerts[0].payload.name).toBe('Dilnoza');
    expect(alerts[0].payload.timer).toBe('first');

    // not again straight away, but again after the repeat interval
    await h.q(`select fn_lead_timer_scan('2026-10-06T10:12:00Z')`);
    expect(await h.q(`select 1 from lead_alert_outbox where lead_id = $1`, [l.id])).toHaveLength(1);
    await h.q(`select fn_lead_timer_scan('2026-10-06T10:21:30Z')`);
    expect(await h.q(`select 1 from lead_alert_outbox where lead_id = $1`, [l.id])).toHaveLength(2);

    // answered -> no more
    await h.q(`select fn_lead_clear_timer($1)`, [l.id]);
    await h.q(`select fn_lead_timer_scan('2026-10-06T10:40:00Z')`);
    expect(await h.q(`select 1 from lead_alert_outbox where lead_id = $1`, [l.id])).toHaveLength(2);
  });

  it('is silent outside working hours', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-e2', first_contact_at: '2026-10-06T10:00:00Z' });
    await h.q(`select fn_lead_timer_scan('2026-10-06T18:00:00Z')`); // 23:00 local
    expect(await h.q(`select 1 from lead_alert_outbox where lead_id = $1`, [l.id])).toHaveLength(0);
  });

  it('hands out each alert once and drops stale ones', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-e3', first_contact_at: '2026-10-06T10:00:00Z' });
    await h.q(`select fn_lead_timer_scan('2026-10-06T10:11:00Z')`);
    const first = await h.q<any>(`select * from fn_lead_alert_claim(100) where lead_id = $1`, [l.id]);
    expect(first).toHaveLength(1);
    const second = await h.q<any>(`select * from fn_lead_alert_claim(100) where lead_id = $1`, [l.id]);
    expect(second).toHaveLength(0); // already claimed
    await h.q(`select fn_lead_alert_done($1, true)`, [first[0].id]);
  });
});

describe('call result popup (spec §7)', () => {
  it('refuses "talked" until the 5 mandatory fields and the two objection taps are in', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110001' });
    await expect(
      h.as(op, `select lead_record_call($1, 'talked', '{}'::jsonb)`, [l.id]),
    ).rejects.toThrow(/missing_fields:goal,certificate,age_grade,region,decider,objection,competitor/);
    // nothing was written
    expect(await h.q(`select 1 from call_attempts where lead_id = $1`, [l.id])).toHaveLength(0);
  });

  it('saves "talked": answered, owner, stage Aloqada, timer cleared, callback armed', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110002', first_contact_at: '2026-10-06T10:00:00Z' });
    const at = new Date(Date.now() + 3 * 3600_000).toISOString();
    const r = await h.as<any>(
      op,
      `select lead_record_call($1, 'talked', $2::jsonb) as r`,
      [l.id, JSON.stringify({ fields: FULL_CARD, next_action_at: at, next_action_kind: 'callback', note: 'ota-onasi bilan' })],
    );
    expect(r[0].r.ok).toBe(true);
    const after = await getLead(h, l.id);
    expect(after.stage).toBe('contacted');
    expect(after.owner_id).toBe(op);
    expect(after.answer_kind).toBe('call');
    expect(after.answered_at).not.toBeNull();
    expect(after.timer_kind).toBe('callback');
    expect(iso(after.due_at)).toBe(iso(at));
    expect(after.education_level).toBe('Bakalavr');
    const attempts = await h.q<any>(`select result, operator_id from call_attempts where lead_id = $1`, [l.id]);
    expect(attempts).toEqual([{ result: 'talked', operator_id: op }]);
  });

  it('demands a next action after "talked"', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110003' });
    await expect(
      h.as(op, `select lead_record_call($1, 'talked', $2::jsonb)`, [l.id, JSON.stringify({ fields: FULL_CARD })]),
    ).rejects.toThrow(/next_action_required/);
  });

  it('never lowers a stage, and "offer" needs a product', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110004' });
    await expect(
      h.as(op, `select lead_record_call($1, 'talked', $2::jsonb)`, [
        l.id,
        JSON.stringify({ fields: FULL_CARD, stage: 'offer', next_action_kind: 'followup' }),
      ]),
    ).rejects.toThrow(/missing_fields:product_fit/);
    await h.as(op, `select lead_record_call($1, 'talked', $2::jsonb)`, [
      l.id,
      JSON.stringify({ fields: { ...FULL_CARD, product_fit: 'standart' }, stage: 'offer', next_action_kind: 'followup' }),
    ]);
    expect((await getLead(h, l.id)).stage).toBe('offer');
    await h.as(op, `select lead_record_call($1, 'talked', $2::jsonb)`, [
      l.id,
      JSON.stringify({ stage: 'contacted', next_action_kind: 'followup' }),
    ]);
    expect((await getLead(h, l.id)).stage).toBe('offer'); // not lowered
  });

  it('puts a talked lead into Kutish with a date and a reason', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110005' });
    const until = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    await h.as(op, `select lead_record_call($1, 'talked', $2::jsonb)`, [
      l.id,
      JSON.stringify({ fields: FULL_CARD, stage: 'waiting', wait_until: until, wait_reason: 'exam_result' }),
    ]);
    const a = await getLead(h, l.id);
    expect(a.stage).toBe('waiting');
    expect(a.due_at).toBeNull();
    expect(a.wait_reason).toBe('exam_result');
    expect(a.next_action_kind).toBe('wait_end');
    await expect(
      h.as(op, `select lead_wait($1, current_date, 'money')`, [l.id]),
    ).rejects.toThrow(/wait_date_required/);
  });

  it('closes a talked lead as lost with a reason, and queues it for reactivation', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110006' });
    await h.as(op, `select lead_record_call($1, 'talked', $2::jsonb)`, [
      l.id,
      JSON.stringify({ fields: FULL_CARD, stage: 'lost', lost_reason: 'no_certificate' }),
    ]);
    const a = await getLead(h, l.id);
    expect(a.stage).toBe('lost');
    expect(a.status).toBe('lost');
    expect(a.lost_reason).toBe('no_certificate');
    const q = await h.q<any>(`select queue_key, status, due_at from reactivation_queues where lead_id = $1`, [l.id]);
    expect(q).toEqual([{ queue_key: 'hanbox', status: 'waiting', due_at: null }]);
    await expect(h.as(op, `select lead_lose($1, 'nonsense')`, [l.id])).rejects.toThrow(/bad_lost_reason/);
  });

  it('refuses an unknown result and a student', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110007' });
    await expect(h.as(op, `select lead_record_call($1, 'maybe', '{}'::jsonb)`, [l.id])).rejects.toThrow(/bad_result/);
    const s = await addLead(h, { status: 'converted' });
    await expect(h.as(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb)`, [s.id])).rejects.toThrow(/lead_is_student/);
  });

  it('"busy" asks for a time and arms a callback', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110008' });
    await expect(h.as(op, `select lead_record_call($1, 'busy', '{}'::jsonb)`, [l.id])).rejects.toThrow(/next_action_required/);
    const at = new Date(Date.now() + 3600_000).toISOString();
    await h.as(op, `select lead_record_call($1, 'busy', $2::jsonb)`, [l.id, JSON.stringify({ next_action_at: at })]);
    const a = await getLead(h, l.id);
    expect(a.timer_kind).toBe('callback');
    expect(iso(a.due_at)).toBe(iso(at));
    expect(a.answer_kind).toBe('call_attempt');
  });

  it('"wrong number" clears the phone; with no chat the lead is lost as "aloqa yo\'q"', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110009' });
    const r = await h.as<any>(op, `select lead_record_call($1, 'wrong_number', '{}'::jsonb) as r`, [l.id]);
    expect(r[0].r.lost).toBe(true);
    const a = await getLead(h, l.id);
    expect(a.phone).toBeNull();
    expect(a.stage).toBe('lost');
    expect(a.lost_reason).toBe('no_contact');

    const c = await addLead(h, { source: 'instagram', source_id: 'ig-w1', phone: '+998901110010' });
    const r2 = await h.as<any>(op, `select lead_record_call($1, 'wrong_number', '{}'::jsonb) as r`, [c.id]);
    expect(r2[0].r.chat_prompt).toBe(true);
    expect((await getLead(h, c.id)).stage).toBe('new'); // still on the desk, phone-less
  });
});

describe('no-answer ladder (spec §9)', () => {
  it('with no chat channel, each missed call arms the next step; the 5th closes the lead', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110020' });
    const seen: any[] = [];
    for (let i = 1; i <= 4; i++) {
      const r = await h.as<any>(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb) as r`, [l.id]);
      expect(r[0].r.lost).toBeUndefined();
      const a = await getLead(h, l.id);
      seen.push(a);
      expect(a.attempt_no).toBe(i);
      expect(a.ladder_state).toBe('running');
      expect(a.timer_kind).toBe('ladder');
      expect(iso(a.due_at)).toBe(iso(a.next_attempt_at));
      // visible from 10 minutes before it is due
      expect(new Date(a.due_at).getTime() - new Date(a.timer_start_at).getTime()).toBe(10 * 60_000);
      expect(a.answer_kind).toBe('call_attempt');
    }
    // attempt 1 -> ~+15 min from now (shifted into hours); attempt 2 further out
    expect(new Date(seen[1].next_attempt_at).getTime()).toBeGreaterThan(new Date(seen[0].next_attempt_at).getTime());

    const last = await h.as<any>(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb) as r`, [l.id]);
    expect(last[0].r.lost).toBe(true);
    const done = await getLead(h, l.id);
    expect(done.stage).toBe('lost');
    expect(done.lost_reason).toBe('no_contact');
    expect(done.due_at).toBeNull();
    expect(done.ladder_state).toBe('exhausted');
    const q = await h.q<any>(`select channel, status from reactivation_queues where lead_id = $1 order by channel`, [l.id]);
    expect(q).toEqual([
      { channel: 'call', status: 'waiting' },
      { channel: 'dm', status: 'waiting' },
    ]);
    // 5 attempts in the log
    expect(await h.q(`select 1 from call_attempts where lead_id = $1`, [l.id])).toHaveLength(5);
  });

  it('with a chat channel the first timer stays until the operator writes; then the ladder takes over', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-l1', phone: '+998901110021' });
    const r = await h.as<any>(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb) as r`, [l.id]);
    expect(r[0].r.chat_prompt).toBe(true);
    let a = await getLead(h, l.id);
    expect(a.timer_kind).toBe('first'); // still the 10-minute timer
    expect(a.answered_at).toBeNull();
    expect(a.ladder_state).toBe('running');

    await addMessage(h, { sender: 'ig-l1', direction: 'outgoing', content: "Qo'ng'iroq qildik, qachon qulay?", by: op });
    a = await getLead(h, l.id);
    expect(a.answer_kind).toBe('call_attempt+chat');
    expect(a.answered_at).not.toBeNull();
    expect(a.timer_kind).toBe('ladder'); // the next call, not the first-contact timer
    expect(a.stage).toBe('contacted');
  });

  it('a "we called" draft appears from attempt 2', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-l2', full_name: 'Aziz Karimov', phone: '+998901110022' });
    await h.as(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb)`, [l.id]);
    expect(await h.q(`select 1 from lead_drafts where lead_id = $1`, [l.id])).toHaveLength(0);
    await h.as(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb)`, [l.id]);
    const d = await h.q<any>(`select kind, channel, text from lead_drafts where lead_id = $1`, [l.id]);
    expect(d).toHaveLength(1);
    expect(d[0].kind).toBe('ladder_dm');
    expect(d[0].channel).toBe('instagram');
    expect(d[0].text).toContain('Aziz'); // {ism} filled
  });
});

describe('chat answers (spec §1.4, §6.1)', () => {
  it('a phone-less lead is answered by a human chat message, not by the auto-reply', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-c1', phone: null });
    // the automatic reply is not an answer
    const [{ txt }] = await h.q<{ txt: string }>(`select fn_after_hours_reply_text('2026-10-06T18:00:00Z') as txt`);
    await addMessage(h, { source: 'telegram', sender: 'tg-c1', direction: 'outgoing', content: txt, by: null });
    expect((await getLead(h, l.id)).answered_at).toBeNull();
    // a human message is
    await addMessage(h, { source: 'telegram', sender: 'tg-c1', direction: 'outgoing', content: 'Assalomu alaykum!', by: op });
    const a = await getLead(h, l.id);
    expect(a.answer_kind).toBe('chat');
    expect(a.due_at).toBeNull();
    expect(a.owner_id).toBe(op); // the first operator who replies owns the lead
  });

  it('a lead WITH a phone is not answered by chat alone — call first', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-c2', phone: '+998901110030' });
    await addMessage(h, { sender: 'ig-c2', direction: 'outgoing', content: 'Salom', by: op });
    const a = await getLead(h, l.id);
    expect(a.answered_at).toBeNull();
    expect(a.timer_kind).toBe('first');
  });

  it("Meta's [template] echo is not an answer", async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-c3', phone: null });
    await addMessage(h, { sender: 'ig-c3', direction: 'outgoing', content: '[template]', by: null });
    expect((await getLead(h, l.id)).answered_at).toBeNull();
  });

  it('a client who writes again to an answered lead starts a reply timer that shows in HOZIR only after 10 minutes', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-c4', phone: null });
    await addMessage(h, { source: 'telegram', sender: 'tg-c4', direction: 'outgoing', by: op });
    expect((await getLead(h, l.id)).due_at).toBeNull();

    await addMessage(h, { source: 'telegram', sender: 'tg-c4', direction: 'incoming', content: 'Shartnomani qachon yuborasiz?' });
    let a = await getLead(h, l.id);
    expect(a.timer_kind).toBe('reply');
    expect(iso(a.timer_start_at)).toBe(iso(a.due_at)); // quiet until the deadline
    expect(a.asked_price).toBe(true); // "shartnoma"
    expect(a.last_client_msg_at).not.toBeNull();

    await addMessage(h, { source: 'telegram', sender: 'tg-c4', direction: 'outgoing', by: op });
    a = await getLead(h, l.id);
    expect(a.due_at).toBeNull();
  });

  it('a client message ends the ladder and brings the lead back as "reply"', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901110031' });
    await h.as(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb)`, [l.id]);
    expect((await getLead(h, l.id)).timer_kind).toBe('ladder');
    // the lead writes on a channel we know them by
    await h.q(`insert into communication_identities (channel, identifier, lead_id) values ('telegram', 'tg-c5', $1)`, [l.id]);
    await addMessage(h, { source: 'telegram', sender: 'tg-c5', direction: 'incoming', content: 'Salom, men javob bera olmadim' });
    const a = await getLead(h, l.id);
    expect(a.timer_kind).toBe('reply');
    expect(a.ladder_state).toBe('stopped');
    expect(a.next_attempt_at).toBeNull();
  });

  it('ignores a backfilled old message', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-c6', phone: null });
    await addMessage(h, { source: 'telegram', sender: 'tg-c6', direction: 'outgoing', by: op });
    await addMessage(h, { source: 'telegram', sender: 'tg-c6', direction: 'incoming', at: new Date(Date.now() - 5 * 86400_000).toISOString() });
    expect((await getLead(h, l.id)).due_at).toBeNull();
  });

  it('alerts the boss when a chat says "direktor"', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-c7', phone: null });
    await addMessage(h, { source: 'telegram', sender: 'tg-c7', direction: 'incoming', content: 'Direktor bilan gaplashmoqchiman' });
    const a = await h.q<any>(`select kind, audience, payload from lead_alert_outbox where lead_id = $1 and kind = 'keyword'`, [l.id]);
    expect(a).toHaveLength(1);
    expect(a[0].audience).toBe('boss');
    expect(a[0].payload.word).toBe('direktor');
  });

  it('writes the auto-reply in the language of the message, once, and never counts it as an answer', async () => {
    const uz = await t(h, `select fn_lead_auto_reply_text('2026-10-06T18:00:00Z', 'Salom')`);
    const ru = await t(h, `select fn_lead_auto_reply_text('2026-10-06T18:00:00Z', 'Здравствуйте')`);
    expect(uz).toMatch(/Ertaga 09:00–09:30/);
    expect(ru).toMatch(/Завтра с 09:00/);
    expect(await t(h, `select fn_lead_auto_reply_text('2026-10-06T10:00:00Z', 'Salom')`)).toBeNull(); // open
    expect(await t(h, `select fn_is_automatic_outgoing($1, '{}'::jsonb)`.replace('$1', `'${uz.replace(/'/g, "''")}'`))).toBe(true);
  });
});

describe('one person, one card (spec §5)', () => {
  it('merges a new lead into the older one with the same phone', async () => {
    const older = await addLead(h, { full_name: 'Malika', phone: '+998 90 555 00 01', source: 'manual', city: 'Samarqand' });
    const newer = await addLead(h, {
      full_name: 'instagram 99', phone: '998905550001', source: 'instagram', source_id: 'ig-m1', age: 20,
    });
    const a = await getLead(h, older.id);
    const b = await getLead(h, newer.id);
    expect(b.merged_into_id).toBe(older.id);
    expect(b.stage).toBe('lost');
    expect(b.due_at).toBeNull();
    expect(a.age).toBe(20); // empty field filled from the other card
    expect(a.city).toBe('Samarqand'); // full field not overwritten
    expect(a.full_name).toBe('Malika');
  });

  it('follows the merge: a chat tied to the dropped card now belongs to the survivor', async () => {
    const older = await addLead(h, { phone: '+998905550002', source: 'manual' });
    const newer = await addLead(h, { phone: '+998905550002', source: 'telegram', source_id: 'tg-m2' });
    expect((await getLead(h, newer.id)).merged_into_id).toBe(older.id);
    await addMessage(h, { source: 'telegram', sender: 'tg-m2', direction: 'outgoing', by: op });
    const a = await getLead(h, older.id);
    expect(a.last_operator_msg_at).not.toBeNull();
    const tl = await h.as<any>(senior, `select * from lead_timeline_v2($1, 50)`, [older.id]);
    expect(tl.some((e: any) => e.kind === 'message_out')).toBe(true);
  });

  it('keeps the earliest deadline and drops a first-contact timer once answered', async () => {
    const older = await addLead(h, { phone: '+998905550003', source: 'manual', first_contact_at: '2026-10-06T10:00:00Z' });
    await h.q(`select fn_lead_clear_timer($1)`, [older.id]);
    await h.q(`update leads set answered_at = '2026-10-06T10:05:00Z', answer_kind = 'call' where id = $1`, [older.id]);
    const newer = await addLead(h, { phone: '+998905550003', source: 'instagram', source_id: 'ig-m3', first_contact_at: '2026-10-06T11:00:00Z' });
    const a = await getLead(h, older.id);
    expect(a.answered_at).not.toBeNull();
    // the person was already answered, so this is a reply timer, not a new first-contact timer
    expect(a.timer_kind).toBe('reply');
    expect(iso(a.due_at)).toBe(Z('2026-10-06T11:10:00Z'));
    expect((await getLead(h, newer.id)).merged_into_id).toBe(older.id);
  });

  it('restarts the timer on an already-answered card when the same person turns up again', async () => {
    const older = await addLead(h, { phone: '+998905550010', source: 'manual', first_contact_at: '2026-10-06T10:00:00Z' });
    await h.q(`select fn_lead_clear_timer($1)`, [older.id]);
    await h.q(`update leads set answered_at = now() - interval '1 day', answer_kind = 'call', stage = 'contacted' where id = $1`, [older.id]);
    const form = await addLead(h, { phone: '+998905550010', source: 'meta_form', source_id: 'leadgen-1', form_name: 'Hanbox 10-sent' });
    expect((await getLead(h, form.id)).merged_into_id).toBe(older.id);
    const a = await getLead(h, older.id);
    expect(a.timer_kind).toBe('reply'); // answered before: the person is waiting for a reply
    expect(a.due_at).not.toBeNull();
    // the same form can not be stored twice
    await expect(addLead(h, { phone: null, source: 'meta_form', source_id: 'leadgen-1' })).rejects.toThrow(/duplicate|unique/i);
  });

  it('records a public comment reply as the answer', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-cm1', phone: null });
    const [{ id }] = await h.q<any>(
      `insert into social_comments (platform, comment_id, author_username, text, lead_id) values ('instagram', 'c-1', 'malika.r', 'Narxi qancha?', $1) returning id`,
      [l.id],
    );
    expect((await getLead(h, l.id)).due_at).not.toBeNull();
    await h.as(op, `select lead_comment_answer($1, 'DMga yozdik')`, [id]);
    const a = await getLead(h, l.id);
    expect(a.answer_kind).toBe('comment');
    expect(a.due_at).toBeNull();
    expect(a.owner_id).toBe(op);
    expect((await h.q<any>(`select replied_by, reply_text from social_comments where id = $1`, [id]))[0]).toEqual({ replied_by: op, reply_text: 'DMga yozdik' });
  });

  it('moves related rows to the survivor', async () => {
    const older = await addLead(h, { phone: '+998905550004', source: 'manual' });
    const dup = await addLead(h, { phone: null, source: 'manual', full_name: 'Dup' });
    await h.q(`insert into lead_notes (lead_id, content) values ($1, 'eslatma')`, [dup.id]);
    await h.q(`insert into communication_identities (channel, identifier, lead_id) values ('telegram', 'tg-m4', $1)`, [dup.id]);
    await h.q(`update leads set phone = '+998905550004' where id = $1`, [dup.id]);
    expect((await getLead(h, dup.id)).merged_into_id).toBe(older.id);
    expect(await h.q(`select 1 from lead_notes where lead_id = $1`, [older.id])).toHaveLength(1);
    expect(await h.q(`select 1 from communication_identities where lead_id = $1`, [older.id])).toHaveLength(1);
  });

  it('suggests, rather than merges, when only the name matches', async () => {
    const a = await addLead(h, { full_name: 'Nilufar Rahimova', phone: '+998905550005', source: 'manual' });
    const b = await addLead(h, { full_name: 'nilufar rahimova', phone: '+998905550006', source: 'manual' });
    expect((await getLead(h, b.id)).merged_into_id).toBeNull();
    const s = await h.q<any>(`select reason from lead_merge_suggestions where lead_id = $1 and other_id = $2`, [b.id, a.id]);
    expect(s).toEqual([{ reason: 'same_name' }]);
  });

  it('does not sell to an existing student: the lead is flagged, silent, and the boss hears of it', async () => {
    const sid = '11111111-1111-1111-1111-111111111111';
    await h.q(`insert into student_phones (student_id, phone, phone_norm) values ($1, '+998 90 777 00 01', '+998907770001')`, [sid]);
    const l = await addLead(h, { phone: '90 777 00 01', source: 'instagram', source_id: 'ig-s1' });
    const a = await getLead(h, l.id);
    expect(a.matched_student_id).toBe(sid);
    expect(a.due_at).toBeNull();
    const alerts = await h.q<any>(`select kind, audience from lead_alert_outbox where lead_id = $1`, [l.id]);
    expect(alerts).toEqual([{ kind: 'student', audience: 'boss' }]);
  });
});

describe('who sees what (spec §2.4, §13)', () => {
  it('shows an operator the pool and their own leads only; a senior and the boss see everything', async () => {
    const pool = await addLead(h, { full_name: 'RLS pool', source: 'manual' });
    await h.q(`update leads set owner_id = null where id = $1`, [pool.id]);
    const mine = await addLead(h, { full_name: 'RLS mine', source: 'manual', owner_id: op });
    const theirs = await addLead(h, { full_name: 'RLS theirs', source: 'manual', owner_id: op2 });
    await h.q(`update leads set owner_id = $2 where id = $1`, [mine.id, op]);
    await h.q(`update leads set owner_id = $2 where id = $1`, [theirs.id, op2]);

    const names = async (u: string) =>
      (await h.as<any>(u, `select full_name from leads where full_name like 'RLS %' order by full_name`)).map((r) => r.full_name);
    expect(await names(op)).toEqual(['RLS mine', 'RLS pool']);
    expect(await names(op2)).toEqual(['RLS pool', 'RLS theirs']);
    expect(await names(senior)).toEqual(['RLS mine', 'RLS pool', 'RLS theirs']);
    expect(await names(boss)).toEqual(['RLS mine', 'RLS pool', 'RLS theirs']);
    expect(await names(docs)).toEqual([]);
  });

  it('shows a breached lead to every operator until it is answered, and lets them take it over', async () => {
    const l = await addLead(h, { full_name: 'RLS breached', source: 'manual', first_contact_at: '2026-01-01T10:00:00Z' });
    await h.q(`update leads set owner_id = $2 where id = $1`, [l.id, op2]);
    const seen = await h.as<any>(op, `select id from leads where id = $1`, [l.id]);
    expect(seen).toHaveLength(1); // due_at is in the past
    await h.as(op, `select lead_claim($1)`, [l.id]);
    expect((await getLead(h, l.id)).owner_id).toBe(op);
  });

  it('keeps one operator out of another operator\'s calm lead, even through the RPC', async () => {
    const l = await addLead(h, { full_name: 'RLS calm', source: 'manual', phone: '+998901119999' });
    await h.q(`select fn_lead_clear_timer($1)`, [l.id]);
    await h.q(`update leads set owner_id = $2 where id = $1`, [l.id, op2]);
    await expect(h.as(op, `select lead_claim($1)`, [l.id])).rejects.toThrow(/not_allowed|owned_by_other/);
    await expect(h.as(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb)`, [l.id])).rejects.toThrow(/not_allowed/);
    await h.as(senior, `select lead_reassign($1, $2)`, [l.id, op]);
    expect((await getLead(h, l.id)).owner_id).toBe(op);
    await expect(h.as(op, `select lead_reassign($1, $2)`, [l.id, op2])).rejects.toThrow(/not_allowed/);
    await expect(h.as(op, `select lead_pin($1, true)`, [l.id])).rejects.toThrow(/not_allowed/);
    await h.as(senior, `select lead_pin($1, true)`, [l.id]);
    expect((await getLead(h, l.id)).pinned_at).not.toBeNull();
  });

  it('lets a document handler read only leads that became students', async () => {
    const s = await addLead(h, { full_name: 'RLS student', status: 'converted' });
    const rows = await h.as<any>(docs, `select full_name from leads where full_name like 'RLS %'`);
    expect(rows.map((r: any) => r.full_name)).toEqual(['RLS student']);
    expect(s.stage).toBe('student');
  });
});

describe('the desk (spec §3.1)', () => {
  it('sorts leads into HOZIR, BUGUN and KEYIN', async () => {
    const hozir = await addLead(h, { full_name: 'DESK hozir', source: 'manual', first_contact_at: '2026-01-01T10:00:00Z' });
    const reply = await addLead(h, { full_name: 'DESK reply', source: 'manual' });
    await h.q(`select fn_lead_set_timer($1, 'reply', now() + interval '5 minutes', now() + interval '5 minutes')`, [reply.id]);
    const later = await addLead(h, { full_name: 'DESK keyin', source: 'manual' });
    await h.q(`select fn_lead_clear_timer($1)`, [later.id]);
    await h.q(`update leads set next_action_at = now() + interval '3 days', next_action_kind = 'callback' where id = $1`, [later.id]);
    const contract = await addLead(h, { full_name: 'DESK contract', source: 'manual' });
    await h.q(`select fn_lead_clear_timer($1)`, [contract.id]);
    await h.q(`update leads set stage = 'contract' where id = $1`, [contract.id]);
    const quiet = await addLead(h, { full_name: 'DESK quiet', source: 'manual' });
    await h.q(`select fn_lead_clear_timer($1)`, [quiet.id]);

    const rows = await h.as<any>(senior, `select full_name, bucket from lead_desk() where full_name like 'DESK %'`);
    const by = Object.fromEntries(rows.map((r: any) => [r.full_name, r.bucket]));
    expect(by['DESK hozir']).toBe('hozir');
    expect(by['DESK reply']).toBe('bugun');
    expect(by['DESK keyin']).toBe('keyin');
    expect(by['DESK contract']).toBe('bugun');
    expect(by['DESK quiet']).toBeUndefined(); // nothing to do: not on the desk
    // HOZIR first
    const order = (await h.as<any>(senior, `select full_name from lead_desk() where full_name like 'DESK %'`)).map((r: any) => r.full_name);
    expect(order[0]).toBe('DESK hozir');
  });

  it('keeps old leads off the desk (Baza) and counts them', async () => {
    const o = await addLead(h, { full_name: 'DESK old', crm_generation: 'old', source: 'manual' });
    const rows = await h.as<any>(senior, `select 1 from lead_desk() where full_name = 'DESK old'`);
    expect(rows).toHaveLength(0);
    const [{ c }] = await h.as<any>(senior, `select lead_desk_counts() as c`);
    expect(c.baza).toBeGreaterThanOrEqual(1);
    expect(o.stage).toBe('new');
  });

  it('puts an old lead that writes again on the desk and leaves it "old"', async () => {
    const o = await addLead(h, { full_name: 'DESK back', crm_generation: 'old', source: 'telegram', source_id: 'tg-d1' });
    await h.q(`update leads set stage = 'contacted' where id = $1`, [o.id]);
    await addMessage(h, { source: 'telegram', sender: 'tg-d1', direction: 'incoming', content: 'Salom, yana yozyapman' });
    const a = await getLead(h, o.id);
    expect(a.crm_generation).toBe('old');
    expect(a.timer_kind).toBe('first');
    expect(a.first_contact_at).not.toBeNull();
    const rows = await h.as<any>(senior, `select bucket from lead_desk() where id = $1`, [o.id]);
    expect(rows[0].bucket).toBe('hozir');
  });
});

describe('Kutish, lost, reactivation (spec §8)', () => {
  it('brings a waiting lead back to Aloqada / BUGUN on its date and prepares a reminder 7 days before', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-w1', phone: null });
    await addMessage(h, { source: 'telegram', sender: 'tg-w1', direction: 'outgoing', by: op });
    const soon = new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10);
    await h.as(op, `select lead_wait($1, $2::date, 'family_decision')`, [l.id, soon]);
    expect((await getLead(h, l.id)).stage).toBe('waiting');
    await h.q(`select fn_lead_waiting_run()`);
    const d = await h.q<any>(`select kind from lead_drafts where lead_id = $1`, [l.id]);
    expect(d.map((x: any) => x.kind)).toEqual(['wait_reminder']);
    await h.q(`select fn_lead_waiting_run()`);
    expect(await h.q(`select 1 from lead_drafts where lead_id = $1`, [l.id])).toHaveLength(1); // not twice

    await h.q(`update leads set wait_until = current_date where id = $1`, [l.id]);
    expect(await t(h, `select fn_lead_waiting_run()`)).toBeGreaterThanOrEqual(1);
    const a = await getLead(h, l.id);
    expect(a.stage).toBe('contacted');
    expect(a.next_action_kind).toBe('wait_end');
    expect(a.wait_until).toBeNull();
  });

  it('feeds queues to BUGUN a few a day, only after a senior starts them', async () => {
    await h.q(`update lead_settings set value = '2' where key = 'queue_daily_limit'`);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const l = await addLead(h, { full_name: `QUEUE ${i}`, source: 'manual', phone: `+99890333000${i}` });
      await h.as(op, `select lead_lose($1, 'no_certificate')`, [l.id]);
      ids.push(l.id);
    }
    expect(await t(h, `select fn_lead_reactivation_run()`)).toBe(0); // nothing started yet
    await expect(h.as(op, `select lead_start_queue('hanbox')`)).rejects.toThrow(/not_allowed/);
    const started = await h.as<any>(senior, `select lead_start_queue('hanbox') as n`);
    expect(started[0].n).toBeGreaterThanOrEqual(3);
    expect(await t(h, `select fn_lead_reactivation_run()`)).toBe(2); // daily limit
    expect(await t(h, `select fn_lead_reactivation_run()`)).toBe(0); // limit used up today
    // other tests may have queued hanbox leads too: the limit counts them all
    const moved = await h.q<any>(`select stage, reactivation_queue, owner_id, next_action_kind from leads where reactivation_queue = 'hanbox' and stage = 'contacted'`);
    expect(moved).toHaveLength(2);
    expect(moved[0]).toMatchObject({ reactivation_queue: 'hanbox', owner_id: null, next_action_kind: 'reactivation' });
    expect(ids).toHaveLength(3);
    await h.q(`update lead_settings set value = '15' where key = 'queue_daily_limit'`);
  });

  it('does not start the NO RISK queue before the condition is announced', async () => {
    await expect(h.as(senior, `select lead_start_queue('no_risk')`)).rejects.toThrow(/queue_not_announced/);
  });

  it('reopens a lost lead and when the client writes again', async () => {
    const l = await addLead(h, { source: 'telegram', source_id: 'tg-r1', phone: null });
    await h.as(op, `select lead_lose($1, 'other_center', 'ON201')`, [l.id]);
    const lost = await getLead(h, l.id);
    expect(lost.lost_competitor).toBe('ON201');
    expect(lost.competitor).toBe('ON201');
    const q = await h.q<any>(`select due_at from reactivation_queues where lead_id = $1`, [l.id]);
    expect(new Date(q[0].due_at).getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);

    await addMessage(h, { source: 'telegram', sender: 'tg-r1', direction: 'incoming', content: 'Salom, fikrim o‘zgardi' });
    const back = await getLead(h, l.id);
    expect(back.stage).toBe('contacted');
    expect(back.timer_kind).not.toBeNull();
    expect((await h.q<any>(`select status from reactivation_queues where lead_id = $1`, [l.id]))[0].status).toBe('done');
  });
});

describe('silence sequence (spec §10)', () => {
  it('prepares a day-1, day-3 and day-7 draft, one each, never sent by itself', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-f1', full_name: 'Sardor Aliyev', phone: null });
    await addMessage(h, { sender: 'ig-f1', direction: 'outgoing', by: op });
    // our last message was `days` ago and the client has been quiet since (their
    // first message came an hour before ours)
    const at = async (days: number) =>
      h.q(
        `update leads set last_operator_msg_at = now() - make_interval(days => $2),
                          last_client_msg_at = now() - make_interval(days => $2) - interval '1 hour' where id = $1`,
        [l.id, days],
      );

    await at(0);
    await h.q(`select fn_lead_followup_drafts_run()`);
    expect(await h.q(`select 1 from lead_drafts where lead_id = $1`, [l.id])).toHaveLength(0); // < 24 h

    await at(2);
    await h.q(`select fn_lead_followup_drafts_run()`);
    await h.q(`select fn_lead_followup_drafts_run()`);
    let d = await h.q<any>(`select kind, status, text from lead_drafts where lead_id = $1 order by kind`, [l.id]);
    expect(d.map((x: any) => x.kind)).toEqual(['followup_d1']);
    expect(d[0].status).toBe('pending');
    expect(d[0].text).toContain('Sardor');

    await at(4);
    await h.q(`select fn_lead_followup_drafts_run()`);
    await at(8);
    await h.q(`select fn_lead_followup_drafts_run()`);
    d = await h.q<any>(`select kind from lead_drafts where lead_id = $1 order by kind`, [l.id]);
    expect(d.map((x: any) => x.kind)).toEqual(['followup_d1', 'followup_d3', 'followup_d7']);

    // the client answers: the sequence stops and the drafts are dropped
    await addMessage(h, { sender: 'ig-f1', direction: 'incoming', content: 'Ha, qiziqaman' });
    d = await h.q<any>(`select status from lead_drafts where lead_id = $1`, [l.id]);
    expect(d.every((x: any) => x.status === 'skipped')).toBe(true);
  });
});

describe('promises (spec §11)', () => {
  it('asks the boss for a discount; only the boss can decide', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998901118888' });
    const [{ id }] = await h.as<any>(op, `select lead_request_promise($1, 'discount', '10% chegirma', 'oila ko''p') as id`, [l.id]);
    const alert = await h.q<any>(`select kind, audience, payload from lead_alert_outbox where lead_id = $1 and kind = 'promise'`, [l.id]);
    expect(alert).toHaveLength(1);
    expect(alert[0].audience).toBe('boss');
    expect(alert[0].payload.text).toBe('10% chegirma');
    await expect(h.as(op, `select lead_decide_promise($1, true)`, [id])).rejects.toThrow(/not_allowed/);
    await expect(h.as(senior, `select lead_decide_promise($1, true)`, [id])).rejects.toThrow(/not_allowed/);
    await h.as(boss, `select lead_decide_promise($1, true)`, [id]);
    expect((await h.q<any>(`select status from lead_promises where id = $1`, [id]))[0].status).toBe('approved');
    await expect(h.as(boss, `select lead_decide_promise($1, false)`, [id])).rejects.toThrow(/promise_not_pending/);
  });
});

describe('priority score (spec §12)', () => {
  it('rates a referred TOPIK-3 lead who asked the price above a bare chat', async () => {
    const hot = await addLead(h, {
      source: 'telegram', source_id: 'tg-p1', referral_type: 'student', cert_level: 'TOPIK 3',
      education_level: 'Bakalavr', age: 19, city: 'Toshkent', decider: 'self',
    });
    await addMessage(h, { source: 'telegram', sender: 'tg-p1', direction: 'incoming', content: 'Narxi qancha?' });
    const cold = await addLead(h, { source: 'instagram', source_id: 'ig-p2' });
    const a = await getLead(h, hot.id);
    const b = await getLead(h, cold.id);
    expect(a.priority_score).toBe(30 + 25 + 20 + 10 + 5); // referral + cert + asked price + recent + telegram
    expect(b.priority_score).toBe(5); // wrote just now (+10), card incomplete (-5)
  });
});

describe('manual lead (spec §5 "+ Lid")', () => {
  it('requires a phone and, for a referral, who referred', async () => {
    await expect(h.as(op, `select lead_create_manual('Ali', '', 'office')`)).rejects.toThrow(/phone_required/);
    await expect(h.as(op, `select lead_create_manual('Ali', '+998901112233', 'referral')`)).rejects.toThrow(/referral_required/);
    const [{ id }] = await h.as<any>(op, `select lead_create_manual('Ali', '+998901112233', 'referral', 'alumni', 'Bekzod aka') as id`);
    const l = await getLead(h, id);
    expect(l.owner_id).toBe(op);
    expect(l.referral_type).toBe('alumni');
    expect(l.referral_name).toBe('Bekzod aka');
    expect(l.timer_kind).toBe('first');
  });
});

describe('report (spec §14)', () => {
  it('counts results, not calls', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-rep', phone: '+998901117777', campaign_name: 'Hanbox 10-sent' });
    await h.as(op, `select lead_record_call($1, 'talked', $2::jsonb)`, [
      l.id,
      JSON.stringify({ fields: { ...FULL_CARD, product_fit: 'hanbox' }, stage: 'offer', next_action_kind: 'followup' }),
    ]);
    await h.q(`update leads set status = 'converted' where id = $1`, [l.id]);
    const [{ r }] = await h.as<any>(senior, `select lead_report($1::date, $1::date) as r`, [day]);
    expect(r.totals.leads).toBeGreaterThanOrEqual(1);
    expect(r.totals.talked).toBeGreaterThanOrEqual(1);
    expect(r.totals.students).toBeGreaterThanOrEqual(1);
    expect(r.by_ad.find((a: any) => a.ad === 'Hanbox 10-sent').students).toBe(1);
    await expect(h.as(op, `select lead_report($1::date, $1::date)`, [day])).rejects.toThrow(/not_allowed/);
  });
});
