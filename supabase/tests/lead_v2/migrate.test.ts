import { describe, expect, it } from 'vitest';
import { applyV2, createHarness } from './harness';

// The data migration (spec §16) is exercised on rows that exist BEFORE the v2
// schema does — exactly like production — not on rows inserted afterwards.
describe('old leads -> Baza (spec §16)', () => {
  it('re-labels every existing lead, maps stages and lost reasons, and starts nothing', async () => {
    const h = await createHarness(0);
    const mk = async (name: string, status: string, extra: Record<string, unknown> = {}) => {
      const cols = ['full_name', 'status', ...Object.keys(extra)];
      const [r] = await h.q<{ id: string }>(
        `insert into public.leads (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning id`,
        [name, status, ...Object.values(extra)],
      );
      return r.id;
    };

    const active = await mk('Active new', 'new', { ai_summary: '📋 Tahlil · 05.10.2026', next_follow_up: '2026-10-07T05:00:00Z' });
    const contacted = await mk('Active contacted', 'contacted', { call_result: 'Gaplashildi' });
    const student = await mk('A student', 'converted');
    const lostPlain = await mk('Lost interest', 'lost', { notes: "Rad etildi: Qiziqmaydi — hozir kerak emas" });
    const lostPrice = await mk('Lost price', 'lost', { notes: 'avval yozdi\nRad etildi: Byudjeti yetmaydi' });
    const lostDocsNoCert = await mk('Lost docs, no cert', 'lost', { notes: 'Rad etildi: Hujjatlari mos emas', cert_level: "Yo'q" });
    const lostDocsCert = await mk('Lost docs, cert', 'lost', { notes: 'Rad etildi: Hujjatlari mos emas', cert_level: 'TOPIK 3' });
    const lostOther = await mk('Lost other centre', 'lost', { notes: 'Rad etildi: Boshqa markazni tanladi — Bright Future' });
    const lostNoContact = await mk('Lost no contact', 'lost', { notes: "Rad etildi: Bog'lanib bo'lmadi" });
    const lostDup = await mk('Lost dup', 'lost', { notes: 'Rad etildi: Dublikat yozuv' });
    const lostBare = await mk('Lost bare', 'lost', { notes: null });

    await applyV2(h, 0);

    const get = async (id: string) => (await h.q<Record<string, any>>(`select * from public.leads where id = $1`, [id]))[0];

    // everybody is old, nobody has a timer, nothing is due
    const all = await h.q<Record<string, any>>(`select * from public.leads`);
    expect(all.every((l) => l.crm_generation === 'old')).toBe(true);
    expect(all.every((l) => l.due_at === null && l.timer_kind === null && l.first_contact_at === null)).toBe(true);
    expect(await h.q(`select 1 from lead_alert_outbox`)).toHaveLength(0);
    expect(await h.q(`select 1 from lead_events`)).toHaveLength(0);

    // stages
    expect((await get(active)).stage).toBe('contacted');
    expect((await get(contacted)).stage).toBe('contacted');
    expect((await get(student)).stage).toBe('student');

    // the old data is untouched
    expect((await get(active)).ai_summary).toBe('📋 Tahlil · 05.10.2026');
    expect(new Date((await get(active)).next_follow_up).toISOString()).toBe('2026-10-07T05:00:00.000Z');
    expect((await get(contacted)).call_result).toBe('Gaplashildi');

    // lost reasons
    const reason = async (id: string) => (await get(id)).lost_reason;
    expect(await reason(lostPlain)).toBe('not_interested');
    expect(await reason(lostPrice)).toBe('price');
    expect(await reason(lostDocsNoCert)).toBe('no_certificate');
    expect(await reason(lostDocsCert)).toBe('not_fit');
    expect(await reason(lostOther)).toBe('other_center');
    expect((await get(lostOther)).lost_competitor).toBe('Bright Future');
    expect(await reason(lostNoContact)).toBe('no_contact');
    expect(await reason(lostDup)).toBe('spam_duplicate');
    expect(await reason(lostBare)).toBe('not_interested');

    // queues are filled but wait for "Navbatni boshlash"
    const q = await h.q<any>(`select l.full_name, q.queue_key, q.channel, q.due_at, q.status
                                from reactivation_queues q join leads l on l.id = q.lead_id order by 1, 3`);
    const byName = (n: string) => q.filter((r: any) => r.full_name === n);
    expect(byName('Lost docs, no cert')).toMatchObject([{ queue_key: 'hanbox', due_at: null, status: 'waiting' }]);
    expect(byName('Lost price')).toMatchObject([{ queue_key: 'price', due_at: null }]);
    expect(byName('Lost other centre')).toMatchObject([{ queue_key: 'other_center', due_at: null }]);
    expect(byName('Lost no contact')).toHaveLength(2); // DM and call
    expect(byName('Lost interest')).toHaveLength(0); // not interested: no queue
    expect(byName('Lost dup')).toHaveLength(0);
    expect(q.every((r: any) => r.due_at === null && r.status === 'waiting')).toBe(true);

    // so the daily feed does nothing until a senior starts a queue
    const [{ n }] = await h.q<{ n: number }>(`select fn_lead_reactivation_run() as n`);
    expect(n).toBe(0);

    // ...and running the migration twice changes nothing
    await h.db.exec(
      (await import('node:fs')).readFileSync(
        new URL('../../migrations/20261015004000_lead_v2_migrate_old_leads.sql', import.meta.url),
        'utf8',
      ),
    );
    expect(await h.q(`select 1 from reactivation_queues`)).toHaveLength(q.length);
  });
});
