import { beforeAll, describe, expect, it } from 'vitest';
import { addLead, createHarness, getLead, type Harness } from './harness';

// TT items closed on 2026-10-15 (gaps found against the spec):
//   §5 / 3.3  phone calls, phase 1: «Qo'ng'iroq keldi» / «O'tkazib yuborilgan» by hand
//   5.4 / §11 product fit filled by the rule
//   8.3 / §14 the office TV warns only about NEW unanswered leads

let h: Harness;
let op: string;
let op2: string;

beforeAll(async () => {
  h = await createHarness();
  op = await h.addUser('call_operator');
  op2 = await h.addUser('call_operator');
});

const create = (who: string, name: string, phone: string, origin: string) =>
  h.as<{ id: string }>(who, `select lead_create_manual($1, $2, $3) as id`, [name, phone, origin]).then((r) => r[0].id);

describe('phone calls logged by hand (spec §5, 3.3)', () => {
  it("«Qo'ng'iroq keldi»: a call lead owned by the operator who took it", async () => {
    const id = await create(op, 'Javohir', '+998 90 700 00 01', 'call');
    const l = await getLead(h, id);
    expect(l.source).toBe('call');
    expect(l.contact_channel).toBe('Telefon');
    expect(l.owner_id).toBe(op);
    expect(l.crm_generation).toBe('new');
    expect(l.timer_kind).toBe('first'); // stopped by the result popup ("Gaplashildi")
    // the other operator does not see it (it is op's now)
    expect(await h.as(op2, `select 1 from leads where id = $1`, [id])).toHaveLength(0);
  });

  it("«O'tkazib yuborilgan»: a pool lead with the 10-minute timer, a name is optional", async () => {
    const id = await create(op, '', '+998 90 700 00 02', 'missed');
    const l = await getLead(h, id);
    expect(l.source).toBe('call');
    expect(l.owner_id).toBeNull();
    expect(l.full_name).toBe("Qo'ng'iroq: +998 90 700 00 02");
    expect(l.timer_kind).toBe('first');
    expect(l.due_at).not.toBeNull();
    // anybody can take it
    expect(await h.as(op2, `select 1 from leads where id = $1`, [id])).toHaveLength(1);
  });

  it('a call from a known number lands on the existing card', async () => {
    const older = await addLead(h, { source: 'instagram', source_id: 'ig-call-3', phone: '+998907000003', full_name: 'Known' });
    await new Promise((r) => setTimeout(r, 15));
    const id = await create(op, '', '90 700 00 03', 'missed');
    expect((await getLead(h, id)).merged_into_id).toBe(older.id);
  });

  it('still needs a name for the other origins, and refuses an unknown origin', async () => {
    await expect(create(op, '', '+998 90 700 00 04', 'call')).rejects.toThrow(/name_required/);
    await expect(create(op, '', '+998 90 700 00 05', 'office')).rejects.toThrow(/name_required/);
    await expect(create(op, 'X', '+998 90 700 00 06', 'sms')).rejects.toThrow(/bad_origin/);
  });
});

describe('product fit by the rule (spec 5.4, §11)', () => {
  const fit = async (fields: Record<string, unknown>) => {
    const l = await addLead(h, { source: 'manual', phone: null, ...fields });
    return (await getLead(h, l.id)).product_fit;
  };

  it('picks the product the card recommends first', async () => {
    expect(await fit({ cert_level: 'TOPIK 4' })).toBe('standart');
    expect(await fit({ cert_level: 'IELTS 6.0' })).toBe('standart');
    expect(await fit({ cert_level: "Yo'q" })).toBe('hanbox');
    expect(await fit({ study_year: '10-sinf' })).toBe('hanbox');
    expect(await fit({ objection: 'Hujjat / moliya' })).toBe('no_risk');
    expect(await fit({ objection: 'viza rad etilishidan qo‘rqadi' })).toBe('no_risk');
    expect(await fit({ cert_level: 'TOPIK 2' })).toBe('kasbiy');
    expect(await fit({ education_level: 'GKS' })).toBe('gks');
    expect(await fit({})).toBeNull();
  });

  it('fills it when the card fields arrive, and never overrides the operator', async () => {
    const l = await addLead(h, { source: 'manual', phone: null });
    expect((await getLead(h, l.id)).product_fit).toBeNull();
    await h.as(op, `select lead_save_fields($1, '{"cert_level":"TOPIK 3"}'::jsonb)`, [l.id]);
    expect((await getLead(h, l.id)).product_fit).toBe('standart');
    await h.as(op, `select lead_save_fields($1, '{"product_fit":"premium"}'::jsonb)`, [l.id]);
    await h.as(op, `select lead_save_fields($1, '{"cert_level":"Yo''q"}'::jsonb)`, [l.id]);
    expect((await getLead(h, l.id)).product_fit).toBe('premium');
  });
});

describe('office TV (spec 8.3, §14)', () => {
  it('shows a new unanswered lead, not a late call-back or ladder step', async () => {
    const fresh = await addLead(h, { source: 'instagram', source_id: 'ig-tv-g1', first_contact_at: '2026-01-01T10:00:00Z' });
    const cb = await addLead(h, { source: 'manual', phone: '+998907000010' });
    await h.q(`update leads set timer_kind = 'callback', timer_start_at = now() - interval '1 hour', due_at = now() - interval '30 minutes' where id = $1`, [cb.id]);
    const ids = (await h.q<{ lead_id: string }>(`select lead_id from fn_lead_tv_warnings()`)).map((r) => r.lead_id);
    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(cb.id);
  });
});
