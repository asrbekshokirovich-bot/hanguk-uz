import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IshError, ishApi, ishErrorCode, plannedMinutes } from '../api';

/** A client whose rpc answers [result] and records the calls. */
function fakeClient(result: { data?: unknown; error?: { message: string; code?: string } | null } = {}) {
  const rpc = vi.fn(async (_fn: string, _params?: Record<string, unknown>) => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }));
  const schema = vi.fn(() => ({ rpc }));
  return { client: { schema } as unknown as SupabaseClient, rpc, schema };
}

describe('ishApi', () => {
  it('saves an employer with trimmed fields, the Uzbek name and the contact', async () => {
    const { client, rpc, schema } = fakeClient({ data: 'biz-1' });
    const id = await ishApi(client).saveBusiness({
      id: null,
      name: ' 홍대 이삿짐센터 ',
      nameUz: " Hongdae ko'chish xizmati ",
      category: 'logistics',
      area: '홍대',
      address: '마포구 와우산로 21',
      addressDetail: '',
      district: 'Mapo-gu',
      lat: 37.556,
      lng: 126.923,
      contact: { contact_name: '김사장', phone: ' 010-5555-1234 ', telegram: '@hongdae_move', source: '', notes: '' },
    });
    expect(id).toBe('biz-1');
    // Hanguk Ish is the schema `ish` of hanguk.uz's project (P48).
    expect(schema).toHaveBeenCalledWith('ish');
    expect(rpc).toHaveBeenCalledWith('staff_save_business', {
      p_business: null,
      p_name: '홍대 이삿짐센터',
      p_category: 'logistics',
      p_area: '홍대',
      p_address: '마포구 와우산로 21',
      p_address_detail: '',
      p_district: 'Mapo-gu',
      p_lat: 37.556,
      p_lng: 126.923,
      p_name_i18n: { uz: "Hongdae ko'chish xizmati" },
      p_contact: { contact_name: '김사장', phone: '010-5555-1234', telegram: '@hongdae_move', source: '', notes: '' },
    });
  });

  it('no Uzbek name: no translation sent', async () => {
    const { client, rpc } = fakeClient({ data: 'biz-2' });
    await ishApi(client).saveBusiness({
      id: 'biz-2', name: '가게', nameUz: ' ', category: 'other', area: '', address: '', addressDetail: '',
      district: null, lat: null, lng: null,
      contact: { contact_name: '', phone: '', telegram: '', source: '', notes: '' },
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_business: 'biz-2', p_name_i18n: {} });
  });

  it('saves a job: the shift follows its employer\'s point', async () => {
    const { client, rpc } = fakeClient({ data: 'job-1' });
    await ishApi(client).saveJob({
      id: null,
      businessId: 'biz-1',
      title: '이삿짐 운반 보조',
      startsAt: '2026-11-12T10:00:00+09:00',
      endsAt: '2026-11-12T14:00:00+09:00',
      hourlyWage: 13000,
      slots: 2,
      duties: '짐 나르기',
      dress: '',
      address: '',
      autoConfirm: false,
      inviteOnly: true,
      source: 'https://t.me/koreajobs_uz/1234',
      notes: 'Naqd',
    });
    expect(rpc).toHaveBeenCalledWith('staff_save_shift', expect.objectContaining({
      p_shift: null,
      p_business: 'biz-1',
      p_starts_at: '2026-11-12T10:00:00+09:00',
      p_ends_at: '2026-11-12T14:00:00+09:00',
      p_hourly_wage: 13000,
      p_slots: 2,
      p_lat: null,
      p_lng: null,
      p_invite_only: true,
      p_auto_confirm: false,
      p_source: 'https://t.me/koreajobs_uz/1234',
      p_notes: 'Naqd',
    }));
  });

  it('the board, candidates and offers pass what the functions take', async () => {
    const { client, rpc } = fakeClient({ data: null });
    const api = ishApi(client);
    expect(await api.board(new Date('2026-11-09T00:00:00+09:00'), new Date('2026-11-16T00:00:00+09:00'))).toEqual([]);
    expect(rpc).toHaveBeenLastCalledWith('staff_board', { p_from: '2026-11-08T15:00:00.000Z', p_to: '2026-11-15T15:00:00.000Z' });
    expect(await api.candidates('job-1', null)).toEqual([]);
    expect(rpc).toHaveBeenLastCalledWith('staff_candidates', { p_shift: 'job-1', p_max_km: null, p_limit: 100 });
    await api.sendOffers('job-1', ['w1', 'w2'], '  Ertalab 10 da  ');
    expect(rpc).toHaveBeenLastCalledWith('staff_send_offers', { p_shift: 'job-1', p_workers: ['w1', 'w2'], p_note: 'Ertalab 10 da' });
    await api.markAttendance('app-1', true, 210);
    expect(rpc).toHaveBeenLastCalledWith('staff_mark_attendance', { p_application: 'app-1', p_came: true, p_worked_minutes: 210 });
    await api.markAttendance('app-2', false);
    expect(rpc).toHaveBeenLastCalledWith('staff_mark_attendance', { p_application: 'app-2', p_came: false, p_worked_minutes: null });
  });

  it('unread: only what the worker wrote and nobody read; reading marks only the worker\'s', async () => {
    // A query builder that records each step and answers [rows] at the end.
    const steps: [string, ...unknown[]][] = [];
    const rows = [
      { application_id: 'app-1', sender_id: 'worker-1' },
      { application_id: 'app-1', sender_id: 'worker-1' },
      { application_id: 'app-1', sender_id: 'staff-9' },
      { application_id: 'app-2', sender_id: 'staff-9' },
    ];
    const builder: Record<string, unknown> = {};
    for (const name of ['select', 'in', 'is', 'update', 'eq']) {
      builder[name] = (...args: unknown[]) => {
        steps.push([name, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
    const from = vi.fn(() => builder);
    const api = ishApi({ schema: () => ({ from }) } as unknown as SupabaseClient);

    const counts = await api.unread([
      { id: 'app-1', workerId: 'worker-1' },
      { id: 'app-2', workerId: 'worker-2' },
    ]);
    expect(counts).toEqual({ 'app-1': 2 });
    expect(from).toHaveBeenCalledWith('messages');
    expect(steps).toEqual([
      ['select', 'application_id, sender_id'],
      ['in', 'application_id', ['app-1', 'app-2']],
      ['is', 'read_at', null],
    ]);
    expect(await api.unread([])).toEqual({});

    steps.length = 0;
    await api.markRead('app-1', 'worker-1');
    expect(steps[0][0]).toBe('update');
    expect(Object.keys(steps[0][1] as object)).toEqual(['read_at']);
    expect(steps.slice(1)).toEqual([
      ['eq', 'application_id', 'app-1'],
      ['eq', 'sender_id', 'worker-1'],
      ['is', 'read_at', null],
    ]);
  });

  it('P58: the staff list — who is an admin, the list, adding with a role, the role, removing', async () => {
    const { client, rpc } = fakeClient({ data: true });
    const api = ishApi(client);
    expect(await api.isStaffAdmin()).toBe(true);
    await api.addStaff('u-1', 'operator');
    await api.setStaffRole('u-1', 'admin');
    await api.removeStaff('u-1');
    expect(rpc.mock.calls).toEqual([
      ['is_staff_admin', undefined],
      ['staff_add', { p_user: 'u-1', p_role: 'operator' }],
      ['staff_set_role', { p_user: 'u-1', p_role: 'admin' }],
      ['staff_remove', { p_user: 'u-1' }],
    ]);
    const empty = fakeClient({ data: null });
    expect(await ishApi(empty.client).staffPeople()).toEqual({ staff: [], candidates: [] });
    expect(empty.rpc).toHaveBeenCalledWith('staff_people', undefined);
  });

  it('a refusal comes back with its code', async () => {
    const { client } = fakeClient({ error: { message: 'FORBIDDEN', code: 'P0001' } });
    await expect(ishApi(client).businesses()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(ishApi(client).businesses()).rejects.toBeInstanceOf(IshError);
  });
});

describe('ishErrorCode', () => {
  it('the function\'s own code first, then the kind of failure', () => {
    expect(ishErrorCode({ message: 'SHIFT_CLOSED' })).toBe('SHIFT_CLOSED');
    expect(ishErrorCode({ message: 'permission denied for function staff_board', code: '42501' })).toBe('FORBIDDEN');
    expect(ishErrorCode({ message: 'new row violates check constraint', code: '23514' })).toBe('INVALID');
    expect(ishErrorCode({ message: 'TypeError: Failed to fetch' })).toBe('OFFLINE');
    expect(ishErrorCode({ message: 'something else' })).toBe('UNKNOWN');
  });

  it('planned minutes of a job', () => {
    expect(plannedMinutes({ starts_at: '2026-11-12T10:00:00+09:00', ends_at: '2026-11-12T14:30:00+09:00' })).toBe(270);
  });
});
