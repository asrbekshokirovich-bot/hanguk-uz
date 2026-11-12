/**
 * hanguk.uz's «Hanguk Ish» data layer (src/lib/ish/api.ts) with the real
 * supabase-js on a local Supabase stack of hanguk_ish, where it is the schema
 * `ish` as in hanguk.uz's project (P48). The staff member's client is a
 * hanguk.uz one (its default schema is `public`): ishApi() itself sends every
 * call to `ish`. The worker's is the app's (schema `ish`) (CI:
 * .github/workflows/ish-integration.yml, after the app's own tests). The
 * staff member signs in with a test phone number (supabase/config.toml),
 * keeps an employer from Telegram, posts an invite-only job, offers it; the
 * worker answers with the same calls the app makes; the staff confirm, chat,
 * mark who came and that they were paid. And the businesses the 사장님 app
 * opens without a check (P50): the staff name one and suspend it, and read
 * the workers' complaints (P52).
 *
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_KEY=… npx vitest run src/lib/ish/__e2e__
 *
 * Without those variables it is skipped.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IshError, ishApi, type IshApi } from '../api';
import { addDays, jobTimes, seoulToday } from '../time';

const url = process.env.SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? '';
const ready = Boolean(url && anonKey && serviceKey);

/** [schema] null: a hanguk.uz client (default `public`); 'ish': the apps'. */
const client = (key: string, schema: 'ish' | null = 'ish'): SupabaseClient =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(schema ? { db: { schema } } : {}),
  }) as unknown as SupabaseClient;

async function signIn(phone: string, schema: 'ish' | null = 'ish'): Promise<SupabaseClient> {
  const c = client(anonKey, schema);
  // The apps mark their sign-ups (hanguk.uz's sign-up skips them).
  const sent = await c.auth.signInWithOtp({ phone, options: schema ? { data: { app: 'hanguk_ish' } } : {} });
  if (sent.error) throw sent.error;
  const verified = await c.auth.verifyOtp({ phone, token: '123456', type: 'sms' });
  if (verified.error) throw verified.error;
  return c;
}

async function call<T>(c: SupabaseClient, fn: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await c.rpc(fn, params);
  if (error) throw new Error(error.message);
  return data as T;
}

describe.skipIf(!ready)('hanguk.uz → Hanguk Ish on a real stack', () => {
  let admin: SupabaseClient;
  let staff: SupabaseClient;
  let worker: SupabaseClient;
  let api: IshApi;
  let workerId: string;
  let businessId: string;
  let jobId: string;
  let applicationId: string;

  beforeAll(async () => {
    admin = client(serviceKey);
    staff = await signIn('+821000000071', null);
    worker = await signIn('+821000000072');
    workerId = (await worker.auth.getUser()).data.user!.id;
    const staffId = (await staff.auth.getUser()).data.user!.id;
    const added = await admin.from('staff_members').insert({ user_id: staffId });
    expect(added.error).toBeNull();
    // The worker's A02, as the app saves it, and the phone's position.
    await call(worker, 'save_worker_profile', {
      p_first_name: 'Dilshod',
      p_last_name: 'Ergashev',
      p_languages: ['uz', 'ru', 'ko'],
      p_topik: 3,
      p_university: null,
      p_district: 'mapo',
      p_availability: 0,
      p_visa: 'D-2',
      p_avatar_path: null,
    });
    const moved = await worker.from('worker_profiles').update({ lat: 37.557, lng: 126.924 }).eq('user_id', workerId);
    expect(moved.error).toBeNull();
    api = ishApi(staff);
  });

  it('hanguk.uz\'s client reaches Hanguk Ish only through ishApi (the schema `ish`)', async () => {
    const { error } = await staff.from('shifts').select('id').limit(1);
    expect(error).not.toBeNull(); // no Hanguk Ish table in public
    expect(await api.isStaff()).toBe(true);
  });

  it('only the staff: a worker is refused', async () => {
    expect(await api.isStaff()).toBe(true);
    await expect(ishApi(worker).businesses()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(ishApi(worker).businesses()).rejects.toBeInstanceOf(IshError);
  });

  it('an employer from Telegram and an invite-only job tomorrow', async () => {
    businessId = await api.saveBusiness({
      id: null,
      name: '마포 물류센터',
      nameUz: 'Mapo logistika markazi',
      category: 'logistics',
      area: '마포',
      address: '마포구 월드컵로 100',
      addressDetail: '',
      district: 'Mapo-gu',
      lat: 37.556,
      lng: 126.923,
      contact: { contact_name: '박사장', phone: '010-7777-8888', telegram: '@mapo_box', source: 'https://t.me/ishlar/9', notes: '' },
    });
    const kept = (await api.businesses()).find((b) => b.id === businessId);
    expect(kept?.contact.phone).toBe('010-7777-8888');
    expect(kept?.name_i18n.uz).toBe('Mapo logistika markazi');

    const { startsAt, endsAt } = jobTimes(addDays(seoulToday(), 1), '10:00', '14:00');
    jobId = await api.saveJob({
      id: null,
      businessId,
      title: '박스 분류',
      startsAt,
      endsAt,
      hourlyWage: 13000,
      slots: 2,
      duties: '박스 분류\n포장',
      dress: '',
      address: '',
      autoConfirm: false,
      inviteOnly: true,
      source: 'https://t.me/ishlar/9',
      notes: 'Telegram posti',
    });
    const page = await api.job(jobId);
    expect(page.invite_only).toBe(true);
    expect(page.managed).toBe(true);
    expect(Date.parse(page.starts_at)).toBe(Date.parse(startsAt));
    expect(page.notes?.notes).toBe('Telegram posti');
    const board = await api.board(new Date(), new Date(Date.now() + 3 * 86_400_000));
    expect(board.map((r) => r.id)).toContain(jobId);

    // Not in the worker's feed or details before an offer.
    const feed = await call<{ id: string }[]>(worker, 'shift_feed', {
      p_from: new Date().toISOString(),
      p_to: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    });
    expect(feed.map((s) => s.id)).not.toContain(jobId);
    await expect(call(worker, 'shift_details', { p_shift: jobId })).rejects.toThrow('NOT_FOUND');
  });

  it('who fits, the offer; the worker reads it and takes the job', async () => {
    const candidates = await api.candidates(jobId, 5);
    const dilshod = candidates.find((c) => c.id === workerId);
    expect(dilshod).toMatchObject({ first_name: 'Dilshod', busy: false, available: true, offer_status: null });
    expect(dilshod!.distance_km).toBeLessThan(1);

    expect(await api.sendOffers(jobId, [workerId], 'Ertalab 9:50 da darvozada')).toBe(1);
    expect(await api.sendOffers(jobId, [workerId], '')).toBe(0);

    const notices = await call<{ kind: string; data: { note?: string; shift_id?: string } }[]>(worker, 'my_notifications', {
      p_limit: 100,
      p_kinds: ['job_offer'],
    });
    expect(notices).toHaveLength(1);
    expect(notices[0].data).toMatchObject({ note: 'Ertalab 9:50 da darvozada', shift_id: jobId });
    const card = await call<{ offer: { status: string } }>(worker, 'shift_details', { p_shift: jobId });
    expect(card.offer.status).toBe('sent');
    const applied = await call<{ id: string; status: string }>(worker, 'apply_to_shift', { p_shift: jobId });
    expect(applied.status).toBe('pending');
    applicationId = applied.id;

    const page = await api.job(jobId);
    expect(page.offers[0].status).toBe('applied');
    expect(page.applications[0]).toMatchObject({ id: applicationId, status: 'pending' });
    expect(page.applications[0].worker.phone).toBeTruthy();
  });

  it('확정 after the call; the chat goes both ways; the QR', async () => {
    expect((await api.decide(applicationId, true)).status).toBe('confirmed');
    const mine = await call<{ status: string; shift: { id: string } }[]>(worker, 'my_shifts');
    expect(mine.find((a) => a.shift.id === jobId)?.status).toBe('confirmed');

    const sent = await worker.from('messages').insert({ application_id: applicationId, body: 'Salom! Ertaga boraman' });
    expect(sent.error).toBeNull();
    expect((await api.messages(applicationId)).map((m) => m.body)).toContain('Salom! Ertaga boraman');
    await api.sendMessage(applicationId, '네, 9시 50분에 정문에서 만나요');
    const seen = await worker.from('messages').select('body').eq('application_id', applicationId);
    expect((seen.data ?? []).map((m) => m.body)).toContain('네, 9시 50분에 정문에서 만나요');

    // The number on the CRM's chat button: what the worker wrote, until the
    // staff open the chat. The staff's own message stays unread for the
    // worker (A10).
    const apps = [{ id: applicationId, workerId }];
    expect(await api.unread(apps)).toEqual({ [applicationId]: 1 });
    await api.markRead(applicationId, workerId);
    expect(await api.unread(apps)).toEqual({});
    const states = await admin.from('messages').select('sender_id, read_at').eq('application_id', applicationId);
    for (const m of states.data ?? []) {
      expect(m.read_at === null, `read_at of ${m.sender_id === workerId ? 'the worker' : 'the staff'}`).toBe(m.sender_id !== workerId);
    }

    expect(await api.qr(jobId)).toMatch(/^hanguk-ish:v1:/);
  });

  it('the day is over: who came, the pay, paid', async () => {
    // As if the job had been this morning.
    const back = await admin
      .from('shifts')
      .update({
        starts_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
        ends_at: new Date(Date.now() - 3_600_000).toISOString(),
      })
      .eq('id', jobId);
    expect(back.error).toBeNull();
    const done = await api.markAttendance(applicationId, true, 210);
    expect(done).toMatchObject({ status: 'completed', worked_minutes: 210, pay_amount: 45500 });
    await expect(api.markAttendance(applicationId, false)).rejects.toMatchObject({ code: 'NOT_CONFIRMED' });
    expect(await api.setPaid(jobId, true)).toBe(1);
    const page = await api.job(jobId);
    expect(page.applications[0].paid_at).toBeTruthy();
    const earned = await call<{ status: string; pay_amount: number; paid_at: string | null; shift: { id: string } }[]>(
      worker,
      'my_shifts',
    );
    expect(earned.find((a) => a.shift.id === jobId)).toMatchObject({ status: 'completed', pay_amount: 45500 });
  });

  it('a business the 사장님 app opened at once: the staff name it, suspend it and let it back (P52)', async () => {
    // The 사장님 app: an anonymous account, «시작하기» (P50) and a shift.
    const owner = client(anonKey);
    const started = await owner.auth.signInAnonymously({ options: { data: { app: 'hanguk_ish' } } });
    expect(started.error).toBeNull();
    const opened = await call<string>(owner, 'open_business');
    const { startsAt, endsAt } = jobTimes(addDays(seoulToday(), 2), '11:00', '15:00');
    const posted = await owner
      .from('shifts')
      .insert({ business_id: opened, title: '홀 서빙', starts_at: startsAt, ends_at: endsAt, hourly_wage: 13000, slots: 1 })
      .select('id')
      .single();
    expect(posted.error).toBeNull();
    const shiftId = (posted.data as { id: string }).id;

    const listed = await api.appBusinesses();
    expect(listed.find((b) => b.id === opened)).toMatchObject({
      status: 'verified',
      biz_no: null,
      shifts: 1,
      open_shifts: 1,
      shifts_24h: 1,
      crew: 0,
    });
    expect(listed.find((b) => b.id === opened)?.name).toMatch(/^사업장 [0-9A-F]{4}$/);
    expect(listed.some((b) => b.id === businessId)).toBe(false);

    expect(
      await api.updateAppBusiness({
        id: opened,
        name: ' 순대국집 신촌점 ',
        nameUz: 'Sundaeguk',
        category: 'restaurant',
        area: '신촌',
        address: '마포구 신촌로 1',
        addressDetail: '1층',
      }),
    ).toBe(opened);
    expect((await api.appBusinesses()).find((b) => b.id === opened)).toMatchObject({
      name: '순대국집 신촌점',
      name_i18n: { uz: 'Sundaeguk' },
      category: 'restaurant',
      area: '신촌',
    });

    const feed = async () =>
      (
        await call<{ id: string }[]>(worker, 'shift_feed', {
          p_from: new Date().toISOString(),
          p_to: new Date(Date.now() + 4 * 86_400_000).toISOString(),
        })
      ).map((x) => x.id);
    expect(await feed()).toContain(shiftId);

    expect(await api.setAppBusinessBlocked(opened, true)).toBe('rejected');
    expect(await feed()).not.toContain(shiftId);
    await expect(call(worker, 'apply_to_shift', { p_shift: shiftId })).rejects.toThrow('SHIFT_CLOSED');
    // The owner's app sees it suspended (BA1) and cannot post.
    const mine = await call<{ id: string; status: string; biz_no: string | null }[]>(owner, 'my_businesses');
    expect(mine.find((b) => b.id === opened)).toMatchObject({ status: 'rejected', biz_no: null });
    const refused = await owner
      .from('shifts')
      .insert({ business_id: opened, title: '마감', starts_at: startsAt, ends_at: endsAt, hourly_wage: 13000, slots: 1 });
    expect(refused.error?.message).toBe('BUSINESS_NOT_VERIFIED');

    expect(await api.setAppBusinessBlocked(opened, false)).toBe('verified');
    expect(await feed()).toContain(shiftId);
    // Not the staff's own employers.
    await expect(api.setAppBusinessBlocked(businessId, true)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a worker\'s complaint (A11) reaches the staff, who note where it stands (P52)', async () => {
    // What the app sends (A11 «Shikoyat»).
    const sent = await worker.from('reports').insert({ reason: 'employer', body: 'Ish beruvchi kech to\'ladi' });
    expect(sent.error).toBeNull();
    const seen = (await api.reports()).find((r) => r.body === "Ish beruvchi kech to'ladi");
    expect(seen).toMatchObject({ reason: 'employer', status: 'open' });
    expect(seen?.worker).toMatchObject({ id: workerId, first_name: 'Dilshod', last_name: 'Ergashev' });
    expect(await api.setReportStatus(seen!.id, 'closed')).toBe('closed');
    // The worker sees theirs only (RLS), with where it stands.
    const own = await worker.from('reports').select('status').eq('id', seen!.id).single();
    expect(own.data).toEqual({ status: 'closed' });
    await expect(call(worker, 'staff_reports')).rejects.toThrow('FORBIDDEN');
  });
});
