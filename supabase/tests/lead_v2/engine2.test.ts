import { beforeAll, describe, expect, it } from 'vitest';
import { addLead, addMessage, createHarness, getLead, type Harness } from './harness';

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

const CARD = { education_level: 'Magistr', cert_level: 'IELTS 6.0', age: 24, city: "Farg'ona", decider: 'self', objection: 'time', competitor: "yo'q" };

describe('manual stage moves (spec §8)', () => {
  it('Qiziqdi needs the 5 fields, Taklif needs a product, Shartnoma stamps the date', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998909000001' });
    await expect(h.as(op, `select lead_set_stage($1, 'interested')`, [l.id])).rejects.toThrow(/missing_fields:goal/);
    await h.as(op, `select lead_save_fields($1, $2::jsonb)`, [l.id, JSON.stringify(CARD)]);
    await h.as(op, `select lead_set_stage($1, 'interested')`, [l.id]);
    expect((await getLead(h, l.id)).stage).toBe('interested');
    await expect(h.as(op, `select lead_set_stage($1, 'offer')`, [l.id])).rejects.toThrow(/missing_fields:product_fit/);
    await h.as(op, `select lead_set_stage($1, 'offer', '{"product_fit":"premium"}'::jsonb)`, [l.id]);
    expect((await getLead(h, l.id)).product_fit).toBe('premium');
    await h.as(op, `select lead_set_stage($1, 'contract')`, [l.id]);
    const a = await getLead(h, l.id);
    expect(a.stage).toBe('contract');
    expect(a.contract_date).not.toBeNull();
    // the stage history is in the log
    const ev = await h.q<any>(`select payload from lead_events where lead_id = $1 and kind = 'stage' order by id`, [l.id]);
    expect(ev.map((e: any) => e.payload.to)).toEqual(['interested', 'offer', 'contract']);
  });

  it('refuses a manual move to student / lost / waiting, and for a student or lost lead', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998909000002' });
    await expect(h.as(op, `select lead_set_stage($1, 'student')`, [l.id])).rejects.toThrow(/bad_stage/);
    await h.as(op, `select lead_lose($1, 'not_interested')`, [l.id]);
    await expect(h.as(op, `select lead_set_stage($1, 'interested')`, [l.id])).rejects.toThrow(/use_reopen/);
    await h.as(op, `select lead_reopen($1)`, [l.id]);
    const a = await getLead(h, l.id);
    expect(a.stage).toBe('contacted');
    expect(a.next_action_kind).toBe('task');
    await expect(h.as(op, `select lead_reopen($1)`, [l.id])).rejects.toThrow(/not_lost/);
  });

  it('becoming a student (old convert flow) alerts the boss once and ends the timers', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-st1', phone: '+998909000003' });
    await h.q(`update leads set status = 'converted', converted_to_student_id = gen_random_uuid() where id = $1`, [l.id]);
    const a = await getLead(h, l.id);
    expect(a.stage).toBe('student');
    expect(a.due_at).toBeNull();
    const al = await h.q<any>(`select kind, audience from lead_alert_outbox where lead_id = $1`, [l.id]);
    expect(al).toEqual([{ kind: 'contract', audience: 'boss' }]);
  });
});

describe('card fields (spec §5)', () => {
  it('writes only whitelisted fields, rejects a bad age, and leaves the rest alone', async () => {
    const l = await addLead(h, { source: 'manual', phone: '+998909000010', city: 'Samarqand' });
    await h.as(op, `select lead_save_fields($1, $2::jsonb)`, [
      l.id,
      JSON.stringify({ age: 21, decider: 'parent', phone: '+998000000000', status: 'lost', owner_id: op2, stage: 'student' }),
    ]);
    const a = await getLead(h, l.id);
    expect(a.age).toBe(21);
    expect(a.decider).toBe('parent');
    expect(a.phone).toBe('+998909000010'); // not whitelisted
    expect(a.stage).toBe('new');
    expect(a.owner_id).toBeNull();
    expect(a.city).toBe('Samarqand'); // not mentioned: untouched
    await expect(h.as(op, `select lead_save_fields($1, '{"age": 5}'::jsonb)`, [l.id])).rejects.toThrow(/age/i);
    await expect(h.as(op, `select lead_save_fields($1, '{"decider": "cousin"}'::jsonb)`, [l.id])).rejects.toThrow(/decider/i);
  });
});

describe('visibility of the child tables follows the lead', () => {
  it("hides another operator's events, attempts and drafts", async () => {
    const mine = await addLead(h, { full_name: 'CH mine', source: 'manual', phone: '+998909000020' });
    await h.q(`select fn_lead_clear_timer($1)`, [mine.id]);
    await h.q(`update leads set owner_id = $2 where id = $1`, [mine.id, op]);
    await h.as(op, `select lead_record_call($1, 'no_answer', '{}'::jsonb)`, [mine.id]);
    await h.q(`insert into lead_drafts (lead_id, kind, text) values ($1, 'ladder_dm', 'x')`, [mine.id]);

    const count = async (u: string, sql: string) => (await h.as<any>(u, sql, [mine.id])).length;
    expect(await count(op, `select 1 from lead_events where lead_id = $1`)).toBeGreaterThan(0);
    expect(await count(op, `select 1 from call_attempts where lead_id = $1`)).toBe(1);
    expect(await count(op, `select 1 from lead_drafts where lead_id = $1`)).toBe(1);
    expect(await count(op2, `select 1 from lead_events where lead_id = $1`)).toBe(0);
    expect(await count(op2, `select 1 from call_attempts where lead_id = $1`)).toBe(0);
    expect(await count(op2, `select 1 from lead_drafts where lead_id = $1`)).toBe(0);
    expect(await count(senior, `select 1 from call_attempts where lead_id = $1`)).toBe(1);
  });

  it('lets only the boss touch settings and recipients, a senior only the templates', async () => {
    await expect(h.as(op, `update lead_settings set value = '99' where key = 'queue_daily_limit' returning key`)).resolves.toEqual([]);
    expect((await h.q<any>(`select value from lead_settings where key = 'queue_daily_limit'`))[0].value).toBe(15);
    await h.as(boss, `update lead_settings set value = '20' where key = 'queue_daily_limit'`);
    expect((await h.q<any>(`select value from lead_settings where key = 'queue_daily_limit'`))[0].value).toBe(20);
    await h.q(`update lead_settings set value = '15' where key = 'queue_daily_limit'`);

    const rows = await h.as<any>(senior, `update lead_settings set value = value where key in ('templates', 'forbidden_words') returning key`);
    expect(rows.map((r: any) => r.key)).toEqual(['templates']);

    await h.as(boss, `insert into lead_alert_recipients (chat_id, label) values ('1', 'Boss')`);
    expect(await h.as(op, `select 1 from lead_alert_recipients`)).toHaveLength(0);
    expect(await h.as(boss, `select 1 from lead_alert_recipients`)).toHaveLength(1);
  });

  it('every staff role can read the comments and the settings', async () => {
    await h.q(`insert into social_comments (platform, comment_id, text) values ('instagram', 'c-vis', 'Salom')`);
    expect(await h.as(op, `select 1 from social_comments where comment_id = 'c-vis'`)).toHaveLength(1);
    expect(await h.as(op, `select 1 from lead_settings where key = 'templates'`)).toHaveLength(1);
  });
});

describe('desk bookkeeping', () => {
  it('leaves merged-away cards off the desk and out of the counts', async () => {
    const a = await addLead(h, { full_name: 'BK keep', phone: '+998909000030', source: 'manual' });
    const b = await addLead(h, { full_name: 'BK dup', phone: '+998909000030', source: 'instagram', source_id: 'ig-bk' });
    expect((await getLead(h, b.id)).merged_into_id).toBe(a.id);
    const rows = await h.as<any>(senior, `select id from lead_desk() where full_name like 'BK %'`);
    expect(rows.map((r: any) => r.id)).toEqual([a.id]);
  });

  it('counts HOZIR and breached separately', async () => {
    await addLead(h, { full_name: 'BK hozir', source: 'manual', first_contact_at: '2026-01-01T10:00:00Z' });
    const [{ c }] = await h.as<any>(senior, `select lead_desk_counts() as c`);
    expect(c.hozir).toBeGreaterThanOrEqual(1);
    expect(c.breached).toBeGreaterThanOrEqual(1);
    expect(c.hozir).toBeGreaterThanOrEqual(c.breached);
  });

  it('re-engages an old card when the app quiz is submitted again', async () => {
    const o = await addLead(h, { full_name: 'BK quiz', crm_generation: 'old', source: 'app', phone: '+998909000031' });
    expect(o.due_at).toBeNull();
    await h.q(`update leads set quiz_submitted_at = now() where id = $1`, [o.id]);
    const a = await getLead(h, o.id);
    expect(a.timer_kind).toBe('first');
    expect(a.crm_generation).toBe('old');
    expect(a.first_contact_at).not.toBeNull();
  });

  it('does not put a student on the desk when they write', async () => {
    const s = await addLead(h, { full_name: 'BK student', source: 'telegram', source_id: 'tg-bks', status: 'converted' });
    await addMessage(h, { source: 'telegram', sender: 'tg-bks', direction: 'incoming', content: 'Salom, savolim bor' });
    const a = await getLead(h, s.id);
    expect(a.due_at).toBeNull();
    expect(a.last_client_msg_at).not.toBeNull();
    expect(await h.as(senior, `select 1 from lead_desk() where id = $1`, [s.id])).toHaveLength(0);
  });
});

describe('alert outbox', () => {
  it('expires an escalation that was answered while queued and retries a failed send', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-ob1', first_contact_at: '2026-10-06T10:00:00Z' });
    await h.q(`select fn_lead_timer_scan('2026-10-06T10:11:00Z')`);
    const [{ id }] = await h.q<any>(`select id from lead_alert_outbox where lead_id = $1`, [l.id]);
    // claim, fail, claim again
    let got = await h.q<any>(`select id from fn_lead_alert_claim(100) where lead_id = $1`, [l.id]);
    expect(got).toHaveLength(1);
    await h.q(`select fn_lead_alert_done($1, false, 'telegram 403')`, [id]);
    got = await h.q<any>(`select id, attempts from fn_lead_alert_claim(100) where lead_id = $1`, [l.id]);
    expect(got).toHaveLength(1);
    expect(got[0].attempts).toBe(2);
    // answered before it went out: not sent, expired
    await h.q(`select fn_lead_alert_done($1, false, 'again')`, [id]);
    await h.q(`select fn_lead_clear_timer($1)`, [l.id]);
    expect(await h.q<any>(`select id from fn_lead_alert_claim(100) where lead_id = $1`, [l.id])).toHaveLength(0);
    await h.q(`select fn_lead_alert_expire()`);
    expect((await h.q<any>(`select sent_at, last_error from lead_alert_outbox where id = $1`, [id]))[0].last_error).toBe('expired');
  });

  it('feeds the office TV with unanswered new leads, by username when there is one', async () => {
    const l = await addLead(h, { source: 'instagram', source_id: 'ig-tv1', instagram_handle: 'sardor_k', first_contact_at: '2026-01-01T10:00:00Z' });
    const w = await h.q<any>(`select * from fn_lead_tv_warnings() where lead_id = $1`, [l.id]);
    expect(w).toHaveLength(1);
    expect(w[0].label).toBe('sardor_k');
    expect(w[0].timer_kind).toBe('first');
    await h.q(`update lead_settings set value = 'false' where key = 'tv_warning'`);
    expect(await h.q<any>(`select * from fn_lead_tv_warnings() where lead_id = $1`, [l.id])).toHaveLength(0);
    await h.q(`update lead_settings set value = 'true' where key = 'tv_warning'`);
  });
});
